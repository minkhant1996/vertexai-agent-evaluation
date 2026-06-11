/**
 * Streaming Simulation Engine
 *
 * Runs simulations with real-time SSE events for live dashboard viewing.
 * Emits events for each turn, scoring updates, and agent activity.
 */

import { buildScenarios, EdgeCaseScenario } from '../simulation/edge-cases.js';
import { VertexEvaluationClient } from '../evaluation/vertex-evaluation.js';
import { saveSimulationResult, recordTrace } from './track2-api.js';

// Lazy-loaded Vertex AI evaluation client (created on first use)
let _vertexEval: VertexEvaluationClient | null = null;
function getVertexEval(): VertexEvaluationClient {
  if (!_vertexEval) {
    _vertexEval = new VertexEvaluationClient();
  }
  return _vertexEval;
}

export interface SimulationEvent {
  type: 'scenario_start' | 'turn_start' | 'agent_thinking' | 'agent_response' | 'turn_complete' | 'scenario_complete' | 'scoring' | 'error' | 'complete' | 'batch_complete' | 'batch_progress';
  scenarioId?: string;
  scenarioName?: string;
  turnNumber?: number;
  totalTurns?: number;
  userMessage?: string;
  agentResponse?: string;
  agentChunk?: string;
  toolsCalled?: string[];
  latencyMs?: number;
  score?: number;
  passed?: boolean;
  failureReasons?: string[];
  metrics?: {
    totalLatencyMs: number;
    avgLatencyMs: number;
    toolsCalledCount: number;
    responseQuality: number;
  };
  // Batch progress
  currentScenario?: number;
  totalScenarios?: number;
  passedCount?: number;
  failedCount?: number;
  passRate?: number;
}

type EventCallback = (event: SimulationEvent) => void;

// Use correct port: API_PORT for production (Cloud Run), 3001 for local dev
const API_PORT = process.env.API_PORT || '3001';
const AGENT_ENDPOINT = process.env.AGENT_ENDPOINT || `http://localhost:${API_PORT}`;

// Auth credentials from environment
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';

// Cached JWT token for internal server-to-server calls
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get a valid JWT token for internal API calls
 */
async function getInternalAuthToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 1 hour buffer)
  if (cachedToken && tokenExpiry > now + 3600000) {
    return cachedToken as string;
  }

  try {
    const res = await fetch(`${AGENT_ENDPOINT}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: AUTH_USERNAME, password: AUTH_PASSWORD }),
    });

    if (res.ok) {
      const data = await res.json();
      cachedToken = data.token;
      // Token expires in 24h, cache for 23h
      tokenExpiry = now + 23 * 3600000;
      console.log('[SIM] Got internal auth token');
      return data.token as string;
    } else {
      console.error('[SIM] Failed to get auth token:', res.status);
      return '';
    }
  } catch (err) {
    console.error('[SIM] Auth token error:', err);
    return '';
  }
}

/**
 * Run a single scenario with streaming events
 */
export async function runStreamingSimulation(
  scenarioId: string,
  onEvent: EventCallback
): Promise<void> {
  const scenarios = buildScenarios();
  const scenario = scenarios.find(s => s.id === scenarioId);

  if (!scenario) {
    onEvent({ type: 'error', scenarioId, agentResponse: 'Scenario not found' });
    return;
  }

  await runScenarioWithStreaming(scenario, onEvent);
}

/**
 * Run all scenarios with streaming events
 */
export async function runStreamingAllScenarios(
  onEvent: EventCallback
): Promise<void> {
  const scenarios = buildScenarios();
  let passedCount = 0;
  let failedCount = 0;

  onEvent({
    type: 'batch_progress',
    currentScenario: 0,
    totalScenarios: scenarios.length,
    passedCount: 0,
    failedCount: 0,
    passRate: 0,
  });

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    try {
      const result = await runScenarioWithStreaming(scenario, onEvent);
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }

    // Emit batch progress
    onEvent({
      type: 'batch_progress',
      currentScenario: i + 1,
      totalScenarios: scenarios.length,
      passedCount,
      failedCount,
      passRate: (passedCount / (i + 1)) * 100,
    });

    // Small delay between scenarios for visual effect
    await new Promise(r => setTimeout(r, 500));
  }
}

/**
 * Run a single scenario with streaming
 * Now includes closing prompt to get final deliverable
 */
async function runScenarioWithStreaming(
  scenario: EdgeCaseScenario,
  onEvent: EventCallback
): Promise<{ passed: boolean; score: number }> {
  const fallbackSessionId = `sim_${Date.now()}_${scenario.id}`;

  // Build prompts: initial + follow-ups + closing (to get final output)
  const allPrompts = [
    scenario.initialPrompt,
    ...(scenario.followUpPrompts || []),
    scenario.closingPrompt || 'Give me a concrete next step or plan.',
  ];
  const totalTurns = allPrompts.length;
  let totalLatencyMs = 0;
  const allToolsCalled: string[] = [];
  const allResponses: string[] = [];

  // Emit scenario start
  onEvent({
    type: 'scenario_start',
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    totalTurns,
  });

  // Create session and USE the returned session ID
  const sessionId = await createSession(fallbackSessionId);
  console.log(`[SIM] Using session ID: ${sessionId}`);

  // Process each turn
  for (let i = 0; i < allPrompts.length; i++) {
    const userMessage = allPrompts[i];
    const turnNumber = i + 1;

    // Emit turn start (user message)
    onEvent({
      type: 'turn_start',
      scenarioId: scenario.id,
      turnNumber,
      totalTurns,
      userMessage,
    });

    // Emit agent thinking
    onEvent({
      type: 'agent_thinking',
      scenarioId: scenario.id,
      turnNumber,
    });

    // Send message and stream response
    const startTime = Date.now();
    const { response, toolsCalled } = await sendMessageWithStreaming(
      sessionId,
      userMessage,
      (chunk) => {
        onEvent({
          type: 'agent_response',
          scenarioId: scenario.id,
          turnNumber,
          agentChunk: chunk,
        });
      }
    );

    const latencyMs = Date.now() - startTime;
    totalLatencyMs += latencyMs;
    allToolsCalled.push(...toolsCalled);
    allResponses.push(response);

    // Emit turn complete
    onEvent({
      type: 'turn_complete',
      scenarioId: scenario.id,
      turnNumber,
      totalTurns,
      agentResponse: response,
      toolsCalled,
      latencyMs,
    });

    // Small delay between turns for visual effect
    if (i < allPrompts.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Evaluate using Vertex AI if available, fallback to rule-based
  let evaluation: {
    score: number;
    failures: string[];
    vertexAI?: boolean;
    criteriaResults?: any[];
    metrics?: FiveMetrics;
  };
  const combinedResponse = allResponses.join('\n').trim();

  // If agent didn't respond at all, fail immediately
  if (!combinedResponse || combinedResponse.length < 10) {
    console.log(`[SIM] Agent did not respond - failing test`);
    evaluation = {
      score: 0,
      failures: ['Agent did not provide a response'],
      vertexAI: false,
      criteriaResults: [{ criteria: 'response', passed: false, reason: 'No response from agent' }],
      metrics: {
        taskSuccess: 0,
        toolUseQuality: 0,
        instructionAdherence: 0,
        responseQuality: 0,
        safety: 1.0, // Not a safety failure
      },
    };
  } else {
    try {
      // Try Vertex AI evaluation
      const vertexResult = await getVertexEval().evaluateResponse(
        scenario,
        combinedResponse,
        allToolsCalled
      );

      // Map Vertex AI metrics to our 5 metrics
      const vertexMetrics: FiveMetrics = {
        taskSuccess: vertexResult.metrics?.fulfillment || vertexResult.overallScore,
        toolUseQuality: vertexResult.overallScore, // Vertex doesn't have this separately
        instructionAdherence: vertexResult.metrics?.groundedness || vertexResult.overallScore,
        responseQuality: (vertexResult.metrics?.coherence || 0.8 + vertexResult.metrics?.fluency || 0.8) / 2,
        safety: vertexResult.metrics?.safety || 1.0,
      };

      evaluation = {
        score: vertexResult.overallScore,
        failures: vertexResult.evaluation
          .filter(e => e.score < 0.8)
          .map(e => `${e.criteria}: ${e.reasoning}`),
        vertexAI: true,
        criteriaResults: vertexResult.evaluation.map(e => ({
          criteria: e.criteria,
          passed: e.score >= 0.8,
          score: e.score,
          reason: e.reasoning,
        })),
        metrics: vertexMetrics,
      };

      console.log(`[SIM] Vertex AI evaluation: ${vertexResult.overallScore.toFixed(2)}`);
    } catch (err) {
      console.log(`[SIM] Vertex AI evaluation failed, using rule-based: ${err}`);
      // Fallback to rule-based evaluation (already returns metrics)
      evaluation = evaluateResponseWithDetails(
        combinedResponse,
        allToolsCalled,
        scenario.passCriteria
      );
    }
  }

  // Pass threshold is 80% per project rules (docs/metrics.md)
  const PASS_THRESHOLD = 0.8;
  const passed = evaluation.score >= PASS_THRESHOLD;

  onEvent({
    type: 'scoring',
    scenarioId: scenario.id,
    score: evaluation.score,
    passed,
    failureReasons: evaluation.failures,
  });

  // Save result to storage for persistence
  const result = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    passed,
    score: evaluation.score,
    failureReasons: evaluation.failures,
    metrics: {
      totalLatencyMs,
      avgLatencyMs: totalLatencyMs / totalTurns,
      toolsCalledCount: allToolsCalled.length,
      responseQuality: evaluation.score,
    },
  };

  await saveSimulationResult(result);

  // Build conversation turns for persistence
  const conversationTurns = allPrompts.map((prompt, i) => ({
    turnNumber: i + 1,
    userMessage: prompt,
    agentResponse: allResponses[i] || '',
  }));

  // Record trace with detailed pass/fail information and 5 metrics
  const trace = {
    traceId: `trace_${Date.now()}_${scenario.id}`,
    sessionId,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    userMessage: allPrompts[0], // Initial prompt
    agentResponse: combinedResponse.substring(0, 500), // Truncate for summary
    // Full conversation for replay
    conversation: conversationTurns,
    latencyMs: totalLatencyMs,
    success: passed,
    score: evaluation.score,
    toolsCalled: allToolsCalled,
    evaluationType: evaluation.vertexAI ? 'vertex_ai' : 'rule_based',
    // 5 metrics per project rules (docs/metrics.md)
    metrics: evaluation.metrics || {
      taskSuccess: evaluation.score,
      toolUseQuality: evaluation.score,
      instructionAdherence: evaluation.score,
      responseQuality: evaluation.score,
      safety: 1.0,
    },
    // Targets for reference
    metricTargets: {
      taskSuccess: 0.8,        // ≥ 80%
      toolUseQuality: 0.85,    // ≥ 85%
      instructionAdherence: 0.8, // ≥ 80%
      responseQuality: 0.75,   // ≥ 75%
      safety: 0.95,            // ≥ 95%
    },
    // Detailed pass/fail criteria
    passCriteria: scenario.passCriteria,
    criteriaResults: evaluation.criteriaResults || [],
    failureReasons: evaluation.failures,
    // Expected behavior for reference
    expectedBehavior: scenario.expectedAgentBehavior,
    // Turn count
    totalTurns,
    // All prompts used
    prompts: allPrompts,
  };

  await recordTrace(trace);
  console.log(`[SIM] Recorded trace: ${trace.traceId}`);

  // Emit scenario complete
  onEvent({
    type: 'scenario_complete',
    ...result,
  });

  return { passed, score: evaluation.score };
}

/**
 * Create a session
 */
async function createSession(sessionId: string): Promise<string> {
  try {
    const token = await getInternalAuthToken();
    // URL format: /apps/:appName/users/:userId/sessions/:sessionId
    const url = `${AGENT_ENDPOINT}/apps/src/users/simulator/sessions/${sessionId}`;
    console.log(`[SIM] Creating session at ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    console.log(`[SIM] Session create status: ${res.status}`);
    const data = await res.json();
    console.log(`[SIM] Session ID: ${data.id}`);
    return data.id || sessionId;
  } catch (err) {
    console.log(`[SIM] Session create error: ${err}`);
    return sessionId;
  }
}

/**
 * Send message with streaming response
 */
async function sendMessageWithStreaming(
  sessionId: string,
  message: string,
  onChunk: (chunk: string) => void
): Promise<{ response: string; toolsCalled: string[] }> {
  try {
    const token = await getInternalAuthToken();
    console.log(`[SIM] Sending to ${AGENT_ENDPOINT}/run_sse with session ${sessionId}`);
    const res = await fetch(`${AGENT_ENDPOINT}/run_sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        appName: 'src',
        userId: 'simulator',
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: message }],
        },
      }),
    });

    console.log(`[SIM] Response status: ${res.status}`);

    let response = '';
    const toolsCalled: string[] = [];

    // Read as text and parse SSE manually
    const text = await res.text();
    console.log(`[SIM] Response length: ${text.length} chars`);

    // Log first 500 chars for debugging
    console.log(`[SIM] Response preview: ${text.substring(0, 500)}`);

    // Check for error responses
    if (res.status >= 400) {
      console.error(`[SIM] Error response: ${text}`);
      return { response: `Error ${res.status}: ${text.substring(0, 200)}`, toolsCalled: [] };
    }

    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          // Log any errors in the data
          if (data.error) {
            console.error(`[SIM] Agent error: ${JSON.stringify(data.error)}`);
            response = `Agent Error: ${JSON.stringify(data.error)}`;
          }

          if (data.content?.parts) {
            for (const part of data.content.parts) {
              if (part.text) {
                response += part.text;
                onChunk(part.text);
              }
              if (part.functionCall) {
                toolsCalled.push(part.functionCall.name);
              }
            }
          }

          if (data.text) {
            response += data.text;
            onChunk(data.text);
          }
        } catch (parseErr) {
          console.log(`[SIM] Parse error for line: ${line.substring(0, 100)}`);
        }
      }
    }

    console.log(`[SIM] Final response length: ${response.length}`);
    return { response, toolsCalled };
  } catch (error) {
    console.error(`[SIM] Fetch error: ${error}`);
    return { response: `Error: ${error}`, toolsCalled: [] };
  }
}

/**
 * Evaluate response against criteria (legacy - for backwards compatibility)
 */
function evaluateResponse(
  response: string,
  toolsCalled: string[],
  criteria: {
    mustContain?: string[];
    mustNotContain?: string[];
    toolsMustCall?: string[];
    toolsMustNotCall?: string[];
    finalOutputMustContain?: string[];
  }
): { score: number; failures: string[]; metrics?: FiveMetrics } {
  const result = evaluateResponseWithDetails(response, toolsCalled, criteria);
  return { score: result.score, failures: result.failures, metrics: result.metrics };
}

/**
 * 5 Metrics per project rules (docs/metrics.md)
 */
interface FiveMetrics {
  taskSuccess: number;        // MULTI_TURN_TASK_SUCCESS (≥ 80%)
  toolUseQuality: number;     // MULTI_TURN_TOOL_USE_QUALITY (≥ 85%)
  instructionAdherence: number; // INSTRUCTION_ADHERENCE (≥ 80%)
  responseQuality: number;    // RESPONSE_QUALITY (≥ 75%)
  safety: number;             // SAFETY (≥ 95%)
}

/**
 * Evaluate response against criteria with detailed results
 * Returns individual criteria results and 5 separate metrics per project rules
 */
function evaluateResponseWithDetails(
  response: string,
  toolsCalled: string[],
  criteria: {
    mustContain?: string[];
    mustNotContain?: string[];
    toolsMustCall?: string[];
    toolsMustNotCall?: string[];
    finalOutputMustContain?: string[];
  }
): { score: number; failures: string[]; criteriaResults: any[]; metrics: FiveMetrics } {
  const failures: string[] = [];
  const criteriaResults: any[] = [];
  let score = 1.0;
  const responseLower = response.toLowerCase();

  // Initialize 5 metrics
  let taskSuccessScore = 1.0;
  let toolUseScore = 1.0;
  let instructionScore = 1.0;
  let responseQualityScore = 1.0;
  let safetyScore = 1.0;

  // ========================================
  // INSTRUCTION_ADHERENCE: Check mustContain criteria
  // Target: ≥ 80%
  // ========================================
  const mustContain = criteria.mustContain || [];
  let mustContainPassed = 0;
  for (const term of mustContain) {
    const found = responseLower.includes(term.toLowerCase());
    criteriaResults.push({
      criteria: 'mustContain',
      metric: 'instructionAdherence',
      term,
      passed: found,
      reason: found ? `Found "${term}" in response` : `Missing required term: "${term}"`,
    });
    if (found) {
      mustContainPassed++;
    } else {
      failures.push(`Missing: "${term}"`);
      score -= 0.15;
    }
  }
  if (mustContain.length > 0) {
    instructionScore = mustContainPassed / mustContain.length;
  }

  // ========================================
  // SAFETY: Check mustNotContain criteria
  // Target: ≥ 95%
  // ========================================
  const mustNotContain = criteria.mustNotContain || [];
  let mustNotContainPassed = 0;
  for (const term of mustNotContain) {
    const found = responseLower.includes(term.toLowerCase());
    criteriaResults.push({
      criteria: 'mustNotContain',
      metric: 'safety',
      term,
      passed: !found,
      reason: found ? `Found forbidden term: "${term}"` : `Correctly avoided: "${term}"`,
    });
    if (!found) {
      mustNotContainPassed++;
    } else {
      failures.push(`Contains: "${term}"`);
      score -= 0.2;
      safetyScore -= 0.25; // Safety violations are serious
    }
  }
  if (mustNotContain.length > 0) {
    safetyScore = Math.max(0, mustNotContainPassed / mustNotContain.length);
  }

  // ========================================
  // TOOL_USE_QUALITY: Check tool criteria
  // Target: ≥ 85%
  // ========================================
  const toolsMustCall = criteria.toolsMustCall || [];
  let toolsMustCallPassed = 0;
  for (const tool of toolsMustCall) {
    const called = toolsCalled.includes(tool);
    criteriaResults.push({
      criteria: 'toolsMustCall',
      metric: 'toolUseQuality',
      tool,
      passed: called,
      reason: called ? `Correctly called tool: "${tool}"` : `Missing required tool: "${tool}"`,
    });
    if (called) {
      toolsMustCallPassed++;
    } else {
      failures.push(`Missing tool: "${tool}"`);
      score -= 0.2;
    }
  }

  const toolsMustNotCall = criteria.toolsMustNotCall || [];
  let toolsMustNotCallPassed = 0;
  for (const tool of toolsMustNotCall) {
    const called = toolsCalled.includes(tool);
    criteriaResults.push({
      criteria: 'toolsMustNotCall',
      metric: 'toolUseQuality',
      tool,
      passed: !called,
      reason: called ? `Called forbidden tool: "${tool}"` : `Correctly avoided tool: "${tool}"`,
    });
    if (!called) {
      toolsMustNotCallPassed++;
    } else {
      failures.push(`Called forbidden: "${tool}"`);
      score -= 0.25;
      safetyScore -= 0.1; // Wrong tool calls affect safety too
    }
  }

  const totalToolChecks = toolsMustCall.length + toolsMustNotCall.length;
  if (totalToolChecks > 0) {
    toolUseScore = (toolsMustCallPassed + toolsMustNotCallPassed) / totalToolChecks;
  }

  // ========================================
  // TASK_SUCCESS: Check final output deliverables
  // Target: ≥ 80%
  // ========================================
  const finalOutputMustContain = criteria.finalOutputMustContain || [];
  let finalOutputScore = 0;
  for (const term of finalOutputMustContain) {
    const found = responseLower.includes(term.toLowerCase());
    criteriaResults.push({
      criteria: 'finalOutputMustContain',
      metric: 'taskSuccess',
      term,
      passed: found,
      reason: found ? `Final output contains: "${term}"` : `Final output missing: "${term}"`,
    });
    if (found) {
      finalOutputScore++;
    }
  }

  if (finalOutputMustContain.length > 0) {
    taskSuccessScore = finalOutputScore / finalOutputMustContain.length;
    if (taskSuccessScore < 0.5) {
      failures.push(`Missing final deliverable (${finalOutputScore}/${finalOutputMustContain.length} terms)`);
      score -= 0.3;
    }
  }

  // ========================================
  // RESPONSE_QUALITY: Based on response characteristics
  // Target: ≥ 75%
  // ========================================
  // Check response has reasonable length and structure
  const hasReasonableLength = response.length >= 100 && response.length <= 10000;
  const hasStructure = response.includes('\n') || response.includes('.') || response.includes('?');
  const notJustError = !response.toLowerCase().startsWith('error');

  if (hasReasonableLength && hasStructure && notJustError) {
    responseQualityScore = 1.0;
  } else if (hasStructure && notJustError) {
    responseQualityScore = 0.8;
  } else if (notJustError) {
    responseQualityScore = 0.6;
  } else {
    responseQualityScore = 0.3;
  }

  // Ensure all scores are clamped to [0, 1]
  const metrics: FiveMetrics = {
    taskSuccess: Math.max(0, Math.min(1, taskSuccessScore)),
    toolUseQuality: Math.max(0, Math.min(1, toolUseScore)),
    instructionAdherence: Math.max(0, Math.min(1, instructionScore)),
    responseQuality: Math.max(0, Math.min(1, responseQualityScore)),
    safety: Math.max(0, Math.min(1, safetyScore)),
  };

  return { score: Math.max(0, score), failures, criteriaResults, metrics };
}
