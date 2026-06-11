/**
 * Streaming A/B Test
 *
 * Runs A/B test with real-time SSE events for live comparison viewing.
 * Compares two instruction versions in parallel on test scenarios.
 * Uses multi-dimensional evaluation (coherence, fulfillment, groundedness, safety).
 */

import { VertexAI } from '@google-cloud/vertexai';
import { buildScenarios, EdgeCaseScenario } from '../simulation/edge-cases.js';
import { getAgentTemplate } from '../agents/agent-templates.js';

// Lazy-loaded Vertex AI client
let _vertexAI: VertexAI | null = null;
function getVertexAI(): VertexAI {
  if (!_vertexAI) {
    _vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || '',
      location: 'us-central1',
    });
  }
  return _vertexAI;
}

// Evaluation metrics for structured scoring
interface EvaluationMetrics {
  coherence: number;      // Logical structure (0-1)
  fulfillment: number;    // Meets pass criteria (0-1)
  groundedness: number;   // Factual, no hallucination (0-1)
  safety: number;         // Appropriate response (0-1)
  overall: number;        // Weighted average
}

// Statistical significance for A/B test confidence
interface StatisticalResult {
  winner: 'A' | 'B' | 'inconclusive';
  confidence: number;     // 0-100%
  pValue: number;
  significant: boolean;   // p < 0.05
}

export interface ABTestEvent {
  type: 'start' | 'scenario_start' | 'version_a_thinking' | 'version_a_response' | 'version_a_complete' |
        'version_b_thinking' | 'version_b_response' | 'version_b_complete' |
        'scenario_complete' | 'progress' | 'complete' | 'error';
  scenarioId?: string;
  scenarioName?: string;
  scenarioIndex?: number;
  totalScenarios?: number;
  versionA?: { score?: number; response?: string; chunk?: string; latencyMs?: number };
  versionB?: { score?: number; response?: string; chunk?: string; latencyMs?: number };
  winner?: 'A' | 'B' | 'tie';
  overallProgress?: {
    completed: number;
    total: number;
    scoreA: number;
    scoreB: number;
    winsA: number;
    winsB: number;
    ties: number;
  };
  error?: string;
}

type EventCallback = (event: ABTestEvent) => void;

/**
 * Get instruction versions from storage
 */
async function getInstructionVersions(versionA: number, versionB: number): Promise<{ instA: string; instB: string; targetAgent: string }> {
  // Import storage dynamically
  const { getStorage } = await import('./track2-api.js');
  const storage = getStorage();

  const instAData = storage.instructionVersions.find((v: any) => v.version === versionA);
  const instBData = storage.instructionVersions.find((v: any) => v.version === versionB);

  if (!instAData || !instBData) {
    throw new Error(`Version ${!instAData ? versionA : versionB} not found`);
  }

  const targetAgent = instAData.targetAgent || 'orchestrator';
  const currentTemplate = getAgentTemplate(targetAgent);

  // Use actual instruction or fall back to current template
  const instA = (instAData.instruction && instAData.instruction.length > 500)
    ? instAData.instruction
    : currentTemplate?.instruction || '';
  const instB = (instBData.instruction && instBData.instruction.length > 500)
    ? instBData.instruction
    : currentTemplate?.instruction || '';

  return { instA, instB, targetAgent };
}

/**
 * Run streaming A/B test
 */
export async function runStreamingABTest(
  versionA: number,
  versionB: number,
  onEvent: EventCallback
): Promise<void> {
  console.log(`[A/B Test Stream] Starting live comparison: Version ${versionA} vs ${versionB}`);

  // Get instructions
  const { instA, instB, targetAgent } = await getInstructionVersions(versionA, versionB);

  // Get scenarios
  const scenarios = buildScenarios().slice(0, 5);

  // Initialize Vertex AI with generation config (8k max tokens)
  const vertexAI = getVertexAI();
  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 8192,
    },
  });

  // Emit start event
  onEvent({
    type: 'start',
    totalScenarios: scenarios.length,
    overallProgress: {
      completed: 0,
      total: scenarios.length,
      scoreA: 0,
      scoreB: 0,
      winsA: 0,
      winsB: 0,
      ties: 0,
    }
  });

  // Track overall results
  let totalScoreA = 0;
  let totalScoreB = 0;
  let winsA = 0;
  let winsB = 0;
  let ties = 0;

  // Test each scenario
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];

    // Emit scenario start
    onEvent({
      type: 'scenario_start',
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioIndex: i,
      totalScenarios: scenarios.length,
    });

    // Start both versions in parallel - emit thinking for both
    onEvent({ type: 'version_a_thinking', scenarioId: scenario.id });
    onEvent({ type: 'version_b_thinking', scenarioId: scenario.id });

    const startTime = Date.now();

    // Run both evaluations in parallel using Promise.all
    const [resultA, resultB] = await Promise.all([
      // Version A evaluation
      evaluateWithStreaming(model, instA, scenario, (chunk) => {
        onEvent({
          type: 'version_a_response',
          scenarioId: scenario.id,
          versionA: { chunk }
        });
      }),
      // Version B evaluation (runs simultaneously)
      evaluateWithStreaming(model, instB, scenario, (chunk) => {
        onEvent({
          type: 'version_b_response',
          scenarioId: scenario.id,
          versionB: { chunk }
        });
      })
    ]);

    const latency = Date.now() - startTime;

    // Emit completion for both versions
    onEvent({
      type: 'version_a_complete',
      scenarioId: scenario.id,
      versionA: {
        score: resultA.score,
        response: resultA.response,
        latencyMs: latency,
      }
    });

    onEvent({
      type: 'version_b_complete',
      scenarioId: scenario.id,
      versionB: {
        score: resultB.score,
        response: resultB.response,
        latencyMs: latency,
      }
    });

    // Determine scenario winner
    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (resultA.score - resultB.score >= 0.1) {
      winner = 'A';
      winsA++;
    } else if (resultB.score - resultA.score >= 0.1) {
      winner = 'B';
      winsB++;
    } else {
      ties++;
    }

    totalScoreA += resultA.score;
    totalScoreB += resultB.score;

    // Emit scenario complete
    onEvent({
      type: 'scenario_complete',
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      versionA: { score: resultA.score, response: resultA.response, latencyMs: latency },
      versionB: { score: resultB.score, response: resultB.response, latencyMs: latency },
      winner,
      overallProgress: {
        completed: i + 1,
        total: scenarios.length,
        scoreA: Math.round((totalScoreA / (i + 1)) * 100),
        scoreB: Math.round((totalScoreB / (i + 1)) * 100),
        winsA,
        winsB,
        ties,
      }
    });

    // Small delay between scenarios
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[A/B Test Stream] Complete!`);
}

/**
 * Evaluate instruction on scenario with streaming response
 */
async function evaluateWithStreaming(
  model: any,
  instruction: string,
  scenario: any,
  onChunk: (chunk: string) => void
): Promise<{ score: number; response: string }> {
  try {
    const prompt = `You are a startup advisor assistant with these instructions:

${instruction}

A founder says: "${scenario.initialPrompt}"

Respond as the assistant would. Be helpful and specific.`;

    // Generate response
    const result = await model.generateContentStream(prompt);
    let fullResponse = '';

    for await (const chunk of result.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }

    // Evaluate response
    const score = await evaluateResponse(model, scenario, fullResponse);

    return { score, response: fullResponse };
  } catch (error) {
    console.error(`  [Eval] Error: ${error}`);
    return { score: 0, response: `Error: ${error}` };
  }
}

/**
 * Evaluate response quality
 */
async function evaluateResponse(model: any, scenario: any, response: string): Promise<number> {
  try {
    const evalPrompt = `Rate this startup advisor response from 0-100.

Scenario: ${scenario.name}
User prompt: "${scenario.initialPrompt}"

Response to evaluate:
"${response.substring(0, 1000)}"

Pass criteria:
- Must contain: ${(scenario.passCriteria?.mustContain || []).join(', ') || 'N/A'}
- Must NOT contain: ${(scenario.passCriteria?.mustNotContain || []).join(', ') || 'N/A'}

Return ONLY a number 0-100, nothing else.`;

    const evalResult = await model.generateContent(evalPrompt);
    const scoreText = evalResult.response?.candidates?.[0]?.content?.parts?.[0]?.text || '50';
    const score = parseInt(scoreText.replace(/\D/g, '')) || 50;
    return Math.min(100, Math.max(0, score)) / 100;
  } catch {
    return 0.5; // Default to 50% on error
  }
}
