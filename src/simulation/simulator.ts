/**
 * Track 2: Agent Simulation Engine
 *
 * Runs synthetic founder personas against the agent to test edge cases.
 * Uses Vertex AI for evaluation and agent testing.
 */

import { EdgeCaseScenario, PassCriteria, EDGE_CASE_SCENARIOS } from './edge-cases.js';
import { VertexEvaluationClient, EvaluationResult } from '../evaluation/vertex-evaluation.js';

// Pass threshold is 80% per project rules (docs/metrics.md)
const PASS_THRESHOLD = 0.8;

export interface SimulationTurnResult {
  turnNumber: number;
  userMessage: string;
  agentResponse: string;
  toolsCalled: string[];
  latencyMs: number;
  traceId?: string;
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  score: number;
  turns: SimulationTurnResult[];
  failureReasons: string[];
  metrics: {
    totalLatencyMs: number;
    avgLatencyMs: number;
    toolsCalledCount: number;
    correctToolsCalled: boolean;
    responseQuality: number;
  };
}

export interface SimulationBatchResult {
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  results: SimulationResult[];
  summary: {
    byDifficulty: Record<string, { passed: number; total: number }>;
    byType: Record<string, { passed: number; total: number }>;
    commonFailures: string[];
  };
}

export class AgentSimulator {
  private agentEndpoint: string;
  private projectId: string;
  private authHeader?: string;
  private vertexEval: VertexEvaluationClient;

  constructor(agentEndpoint: string, projectId?: string) {
    // Extract auth from URL if present (e.g., https://user:pass@host)
    const urlMatch = agentEndpoint.match(/^(https?:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (urlMatch) {
      const [, protocol, user, pass, host] = urlMatch;
      this.agentEndpoint = `${protocol}${host}`;
      this.authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
      console.log(`  Auth: Using credentials for ${user}@${host}`);
    } else {
      this.agentEndpoint = agentEndpoint;
    }
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.vertexEval = new VertexEvaluationClient({ projectId: this.projectId });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }
    return headers;
  }

  /**
   * Run a single scenario simulation
   */
  async runScenario(scenario: EdgeCaseScenario): Promise<SimulationResult> {
    const turns: SimulationTurnResult[] = [];
    const failureReasons: string[] = [];
    let totalLatencyMs = 0;
    const allToolsCalled: string[] = [];

    // Create a new session for this simulation
    const sessionId = `sim_${Date.now()}_${scenario.id}`;

    // Run initial prompt
    const initialResult = await this.sendMessage(sessionId, scenario.initialPrompt);
    turns.push({
      turnNumber: 1,
      userMessage: scenario.initialPrompt,
      agentResponse: initialResult.response,
      toolsCalled: initialResult.toolsCalled,
      latencyMs: initialResult.latencyMs,
      traceId: initialResult.traceId,
    });
    totalLatencyMs += initialResult.latencyMs;
    allToolsCalled.push(...initialResult.toolsCalled);

    // Run follow-up prompts if any
    if (scenario.followUpPrompts) {
      for (let i = 0; i < scenario.followUpPrompts.length; i++) {
        const followUp = scenario.followUpPrompts[i];
        const result = await this.sendMessage(sessionId, followUp);
        turns.push({
          turnNumber: i + 2,
          userMessage: followUp,
          agentResponse: result.response,
          toolsCalled: result.toolsCalled,
          latencyMs: result.latencyMs,
          traceId: result.traceId,
        });
        totalLatencyMs += result.latencyMs;
        allToolsCalled.push(...result.toolsCalled);
      }
    }

    // Evaluate the simulation using Vertex AI with rule-based fallback
    const fullResponse = turns.map(t => t.agentResponse).join('\n');
    let evaluation: { score: number; failures: string[]; correctTools: boolean; evaluationType: string };

    try {
      // Try Vertex AI evaluation first
      const vertexResult = await this.vertexEval.evaluateResponse(scenario, fullResponse, allToolsCalled);

      // Map Vertex AI result to our format
      const failures: string[] = [];
      if (!vertexResult.passed) {
        for (const detail of vertexResult.evaluation) {
          if (detail.score < 0.8) {
            failures.push(`${detail.criteria}: ${detail.reasoning}`);
          }
        }
      }

      evaluation = {
        score: vertexResult.overallScore,
        failures,
        correctTools: vertexResult.metrics.fulfillment >= 0.8,
        evaluationType: 'vertex_ai',
      };
      console.log(`  [Vertex AI] Score: ${(vertexResult.overallScore * 100).toFixed(0)}%`);
    } catch (error) {
      // Fallback to rule-based evaluation
      console.log(`  [Fallback] Using rule-based evaluation (Vertex AI error: ${error})`);
      const ruleBasedEval = this.evaluateResponse(fullResponse, allToolsCalled, scenario.passCriteria);
      evaluation = {
        ...ruleBasedEval,
        evaluationType: 'rule_based',
      };
    }

    failureReasons.push(...evaluation.failures);

    // Pass threshold is 80% per project rules (docs/metrics.md)
    const score = evaluation.score;
    const passed = score >= PASS_THRESHOLD;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      score,
      turns,
      failureReasons,
      metrics: {
        totalLatencyMs,
        avgLatencyMs: totalLatencyMs / turns.length,
        toolsCalledCount: allToolsCalled.length,
        correctToolsCalled: evaluation.correctTools,
        responseQuality: evaluation.score,
      },
    };
  }

  /**
   * Run all scenarios
   */
  async runAllScenarios(): Promise<SimulationBatchResult> {
    const results: SimulationResult[] = [];

    for (const scenario of EDGE_CASE_SCENARIOS) {
      try {
        console.log(`Running scenario: ${scenario.name}...`);
        const result = await this.runScenario(scenario);
        results.push(result);
        console.log(`  ${result.passed ? '✓ PASSED' : '✗ FAILED'} (score: ${(result.score * 100).toFixed(0)}%)`);
      } catch (error) {
        console.error(`  ✗ ERROR: ${error}`);
        results.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          passed: false,
          score: 0,
          turns: [],
          failureReasons: [`Error running scenario: ${error}`],
          metrics: {
            totalLatencyMs: 0,
            avgLatencyMs: 0,
            toolsCalledCount: 0,
            correctToolsCalled: false,
            responseQuality: 0,
          },
        });
      }
    }

    return this.summarizeResults(results);
  }

  /**
   * Run scenarios by difficulty
   */
  async runByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<SimulationBatchResult> {
    const scenarios = EDGE_CASE_SCENARIOS.filter(s => s.difficulty === difficulty);
    const results: SimulationResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    return this.summarizeResults(results);
  }

  /**
   * Create a session for the agent
   */
  private async createSession(sessionId: string): Promise<string> {
    try {
      const res = await fetch(`${this.agentEndpoint}/apps/src/users/simulator/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      return data.id || sessionId;
    } catch {
      return sessionId;
    }
  }

  /**
   * Send a message to the agent
   */
  private async sendMessage(
    sessionId: string,
    message: string
  ): Promise<{ response: string; toolsCalled: string[]; latencyMs: number; traceId?: string }> {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}`;

    try {
      // First, ensure we have a valid session
      const actualSessionId = await this.createSession(sessionId);

      // Send message using the correct ADK endpoint
      const res = await fetch(`${this.agentEndpoint}/run_sse`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          appName: 'src',
          userId: 'simulator',
          sessionId: actualSessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
        }),
      });

      const text = await res.text();
      const { response, toolsCalled } = this.parseSSEResponse(text);

      return {
        response,
        toolsCalled,
        latencyMs: Date.now() - startTime,
        traceId,
      };
    } catch (error) {
      return {
        response: `Error: ${error}`,
        toolsCalled: [],
        latencyMs: Date.now() - startTime,
        traceId,
      };
    }
  }

  /**
   * Parse SSE response from agent
   */
  private parseSSEResponse(text: string): { response: string; toolsCalled: string[] } {
    let response = '';
    const toolsCalled: string[] = [];

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.content?.parts) {
            for (const part of data.content.parts) {
              if (part.text) {
                response += part.text;
              }
              if (part.functionCall) {
                toolsCalled.push(part.functionCall.name);
              }
            }
          }

          if (data.text) {
            response += data.text;
          }
        } catch {
          // Skip parse errors
        }
      }
    }

    return { response, toolsCalled };
  }

  /**
   * Evaluate agent response against pass criteria
   */
  private evaluateResponse(
    response: string,
    toolsCalled: string[],
    criteria: PassCriteria
  ): { score: number; failures: string[]; correctTools: boolean } {
    const failures: string[] = [];
    let score = 1.0;
    const responseLower = response.toLowerCase();

    // Check mustContain (with null safety)
    const mustContain = criteria.mustContain || [];
    for (const term of mustContain) {
      if (!responseLower.includes(term.toLowerCase())) {
        failures.push(`Missing required term: "${term}"`);
        score -= 0.15;
      }
    }

    // Check mustNotContain (with null safety)
    const mustNotContain = criteria.mustNotContain || [];
    for (const term of mustNotContain) {
      if (responseLower.includes(term.toLowerCase())) {
        failures.push(`Contains forbidden term: "${term}"`);
        score -= 0.2;
      }
    }

    // Check toolsMustCall (with null safety)
    let correctTools = true;
    const toolsMustCall = criteria.toolsMustCall || [];
    for (const tool of toolsMustCall) {
      if (!toolsCalled.includes(tool)) {
        failures.push(`Missing required tool call: "${tool}"`);
        score -= 0.2;
        correctTools = false;
      }
    }

    // Check toolsMustNotCall (with null safety)
    const toolsMustNotCall = criteria.toolsMustNotCall || [];
    for (const tool of toolsMustNotCall) {
      if (toolsCalled.includes(tool)) {
        failures.push(`Called forbidden tool: "${tool}"`);
        score -= 0.25;
        correctTools = false;
      }
    }

    return {
      score: Math.max(0, score),
      failures,
      correctTools,
    };
  }

  /**
   * Summarize batch results
   */
  private summarizeResults(results: SimulationResult[]): SimulationBatchResult {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    // Group by difficulty
    const byDifficulty: Record<string, { passed: number; total: number }> = {};
    const byType: Record<string, { passed: number; total: number }> = {};

    for (const result of results) {
      const scenario = EDGE_CASE_SCENARIOS.find(s => s.id === result.scenarioId);
      if (!scenario) continue;

      // By difficulty
      if (!byDifficulty[scenario.difficulty]) {
        byDifficulty[scenario.difficulty] = { passed: 0, total: 0 };
      }
      byDifficulty[scenario.difficulty].total++;
      if (result.passed) byDifficulty[scenario.difficulty].passed++;

      // By type
      if (!byType[scenario.type]) {
        byType[scenario.type] = { passed: 0, total: 0 };
      }
      byType[scenario.type].total++;
      if (result.passed) byType[scenario.type].passed++;
    }

    // Find common failures
    const failureCounts: Record<string, number> = {};
    for (const result of results) {
      for (const failure of result.failureReasons) {
        failureCounts[failure] = (failureCounts[failure] || 0) + 1;
      }
    }
    const commonFailures = Object.entries(failureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([failure]) => failure);

    return {
      totalScenarios: results.length,
      passed,
      failed,
      passRate: passed / results.length,
      results,
      summary: {
        byDifficulty,
        byType,
        commonFailures,
      },
    };
  }
}

/**
 * CLI runner for simulations
 */
export async function runSimulationCLI(agentEndpoint?: string): Promise<void> {
  const endpoint = agentEndpoint || process.env.AGENT_ENDPOINT || 'http://localhost:8101';
  const simulator = new AgentSimulator(endpoint);

  console.log('='.repeat(60));
  console.log('TRACK 2: AGENT SIMULATION');
  console.log('='.repeat(60));
  console.log(`Agent Endpoint: ${endpoint}`);
  console.log(`Total Scenarios: ${EDGE_CASE_SCENARIOS.length}`);
  console.log('='.repeat(60));
  console.log('');

  const results = await simulator.runAllScenarios();

  console.log('');
  console.log('='.repeat(60));
  console.log('SIMULATION RESULTS');
  console.log('='.repeat(60));
  console.log(`Pass Rate: ${(results.passRate * 100).toFixed(1)}% (${results.passed}/${results.totalScenarios})`);
  console.log('');

  console.log('By Difficulty:');
  for (const [diff, stats] of Object.entries(results.summary.byDifficulty)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  ${diff}: ${rate}% (${stats.passed}/${stats.total})`);
  }
  console.log('');

  if (results.summary.commonFailures.length > 0) {
    console.log('Most Common Failures:');
    for (const failure of results.summary.commonFailures) {
      console.log(`  - ${failure}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
}
