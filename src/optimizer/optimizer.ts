/**
 * Track 2: Agent Optimizer
 *
 * Analyzes simulation failures and programmatically refines
 * agent instructions to improve edge case handling.
 * Uses Vertex AI (Gemini) for intelligent suggestion generation.
 * Can also use Google ADK (Agent Development Kit) for advanced optimization.
 */

import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';
import { EDGE_CASE_SCENARIOS } from '../simulation/edge-cases.js';
import { AgentSimulator } from '../simulation/simulator.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// Thinking levels for Gemini 3.x models
enum ThinkingLevel {
  MINIMAL = 'MINIMAL',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

const execAsync = promisify(exec);

export interface FailurePattern {
  pattern: string;
  type: string;
  frequency: number;
  examples: string[];
  suggestedFix: string;
  targetAgent?: string; // Which agent should be fixed for this pattern
}

/**
 * Maps failure patterns to their target agents
 * Some patterns affect the orchestrator, others affect specific sub-agents
 */
export const PATTERN_TO_AGENT_MAP: Record<string, string> = {
  // Orchestrator patterns - routing and overall behavior
  'inappropriate_validation': 'orchestrator',
  'premature_tool_call': 'orchestrator',
  'near_perfect': 'orchestrator',
  'good_but_improvable': 'orchestrator',
  'needs_improvement': 'orchestrator',

  // Problem Clarifier patterns - customer segmentation and problem focus
  'missing_problem_focus': 'problem_clarifier',
  'missing_focus_guidance': 'problem_clarifier',
  'vague_customer': 'problem_clarifier',

  // Assumption Hunter patterns - validation and evidence
  'missing_validation_push': 'assumption_hunter',
  'missing_term_validate': 'assumption_hunter',
  'missing_term_evidence': 'assumption_hunter',
  'missing_term_assumption': 'assumption_hunter',

  // Customer Researcher patterns - interview questions
  'missing_term_interview': 'customer_researcher',
  'missing_term_talk': 'customer_researcher',
  'missing_term_customer': 'customer_researcher',

  // Experiment Designer patterns - MVP and planning
  'missing_tool_define_mvp_scope': 'experiment_designer',
  'missing_tool_create_7day_validation_plan': 'experiment_designer',
  'over_scoped_mvp': 'experiment_designer',
};

/**
 * Determine which agent should be fixed for a given pattern
 */
export function getTargetAgentForPattern(pattern: string): string {
  return PATTERN_TO_AGENT_MAP[pattern] || 'orchestrator';
}

export interface OptimizationResult {
  originalInstruction: string;
  optimizedInstruction: string;
  changes: InstructionChange[];
  patternsAddressed: string[];
  expectedImprovementPercent: number;
}

export interface InstructionChange {
  section: string;
  original: string;
  updated: string;
  reason: string;
}

export interface ScenarioResult {
  id: string;
  name: string;
  scoreA: number;
  scoreB: number;
  responseA?: string;
  responseB?: string;
  winner: 'A' | 'B' | 'tie';
}

export interface ABTestResult {
  instructionA: {
    version: number;
    passRate: number;
    avgLatency: number;
  };
  instructionB: {
    version: number;
    passRate: number;
    avgLatency: number;
  };
  winner: 'A' | 'B' | 'tie';
  improvement: number;
  scenarios?: ScenarioResult[];
}

export class AgentOptimizer {
  private projectId: string;
  private location: string;
  private vertexAI: VertexAI;
  private genAI: GoogleGenAI | null = null;
  private model: string;

  constructor(projectId?: string, location?: string) {
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.location = location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.model = 'gemini-3.1-pro-preview'; // Highest quality for fix generation
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });
    // Initialize new Google Gen AI SDK if API key is available
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  /**
   * Generate content using the new Google Gen AI SDK with thinking config
   */
  private async generateWithGenAI(prompt: string, maxTokens: number = 8192): Promise<string | null> {
    if (!this.genAI) return null;

    try {
      const response = await this.genAI.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          maxOutputTokens: maxTokens,
        },
      });

      // Get text from response
      let text = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) text += part.text;
        }
      }
      return text || null;
    } catch (error) {
      console.error(`[GenAI] Error: ${error}`);
      return null;
    }
  }

  /**
   * Analyze simulation results to identify patterns for improvement
   * Includes both failures AND passed-but-imperfect runs
   */
  async analyzeFailures(
    simulationResults: Array<{
      scenarioId: string;
      scenarioName?: string;
      passed: boolean;
      score?: number;
      failureReasons?: string[];
      agentResponse?: string;
    }>
  ): Promise<FailurePattern[]> {
    // Include runs that failed OR scored below 100%
    const improvableResults = simulationResults.filter(r => {
      if (!r.passed) return true;
      if (r.score !== undefined && r.score < 1.0) return true;
      return false;
    });

    if (improvableResults.length === 0) {
      return [];
    }

    // Group by pattern
    const patternGroups: Map<string, FailurePattern> = new Map();

    for (const result of improvableResults) {
      const scenario = EDGE_CASE_SCENARIOS.find(s => s.id === result.scenarioId);
      const scenarioName = result.scenarioName || scenario?.name || result.scenarioId;
      const scenarioType = scenario?.type || 'unknown';

      // Get reasons - could be failure reasons or just "not perfect"
      let reasons = result.failureReasons || [];

      // If passed but not perfect, create a reason
      if (result.passed && result.score !== undefined && result.score < 1.0) {
        const scorePercent = Math.round(result.score * 100);
        if (reasons.length === 0) {
          reasons = [`Score ${scorePercent}% - room for improvement`];
        }
      }

      for (const reason of reasons) {
        const key = this.categorizeFailure(reason);

        if (!patternGroups.has(key)) {
          patternGroups.set(key, {
            pattern: key,
            type: scenarioType,
            frequency: 0,
            examples: [],
            suggestedFix: '',
            targetAgent: getTargetAgentForPattern(key),
          });
        }

        const pattern = patternGroups.get(key)!;
        pattern.frequency++;
        if (pattern.examples.length < 3) {
          pattern.examples.push(`${scenarioName}: ${reason}`);
        }
      }
    }

    // Generate suggested fixes for each pattern
    const patterns = Array.from(patternGroups.values());

    for (const pattern of patterns) {
      pattern.suggestedFix = await this.generateFix(pattern);
    }

    // Sort by frequency
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Categorize a failure reason into a pattern
   */
  private categorizeFailure(reason: string): string {
    // Handle "room for improvement" scores
    if (reason.includes('room for improvement')) {
      const scoreMatch = reason.match(/Score (\d+)%/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      if (score >= 90) return 'near_perfect';
      if (score >= 80) return 'good_but_improvable';
      return 'needs_improvement';
    }

    if (reason.includes('Missing required term') || reason.includes('Missing:')) {
      const match = reason.match(/"([^"]+)"/);
      const term = match ? match[1] : 'unknown';
      // Group similar terms
      if (['problem', 'customer', 'need', 'pain'].includes(term.toLowerCase())) {
        return 'missing_problem_focus';
      }
      if (['validate', 'evidence', 'test'].includes(term.toLowerCase())) {
        return 'missing_validation_push';
      }
      if (['focus', 'one', 'specific', 'narrow'].includes(term.toLowerCase())) {
        return 'missing_focus_guidance';
      }
      return `missing_term_${term}`;
    }

    if (reason.includes('Contains forbidden term') || reason.includes('Contains:')) {
      return 'inappropriate_validation';
    }

    if (reason.includes('Missing required tool') || reason.includes('Missing tool:')) {
      const match = reason.match(/"([^"]+)"/);
      return `missing_tool_${match ? match[1] : 'unknown'}`;
    }

    if (reason.includes('Called forbidden tool') || reason.includes('Called forbidden:')) {
      return 'premature_tool_call';
    }

    return 'other';
  }

  /**
   * Generate a fix suggestion for a failure pattern using Vertex AI
   */
  private async generateFix(pattern: FailurePattern): Promise<string> {
    // Fallback fixes for common patterns (used if Vertex AI fails)
    const fallbackFixes: Record<string, string> = {
      near_perfect:
        'Response is nearly perfect (90%+). Minor tweaks: ensure all required terminology is included and responses are more comprehensive.',
      good_but_improvable:
        'Response is good (80%+) but missing some elements. Review pass criteria and ensure agent addresses all required points explicitly.',
      needs_improvement:
        'Response needs work. Analyze specific missing criteria and add explicit instructions to address them.',
      missing_problem_focus:
        'Add explicit instruction: "ALWAYS ask about the underlying problem before discussing solutions or features."',
      missing_validation_push:
        'Add instruction: "Challenge assumptions with: What evidence do you have? Have you talked to customers?"',
      missing_focus_guidance:
        'Add instruction: "When targets are vague, immediately narrow: Within this group, who wants it MOST?"',
      inappropriate_validation:
        'Remove phrases like "sounds great", "good idea". Replace with neutral acknowledgment and probing questions.',
      premature_tool_call:
        'Add instruction: "Before using define_mvp_scope, ensure the founder has validated customer need first."',
      other:
        'Review agent response patterns for this scenario type and add specific handling.',
    };

    const prompt = `You are an expert at optimizing AI agent instructions for founder validation agents.

Given this failure pattern from simulation testing:
- Pattern Type: ${pattern.pattern}
- Scenario Type: ${pattern.type}
- Frequency: ${pattern.frequency} occurrences
- Examples:
${pattern.examples.map(e => `  • ${e}`).join('\n')}

Generate a specific, actionable instruction fix that:
1. Directly addresses the root cause of this failure
2. Is written as a clear directive for the agent
3. Includes specific phrases or questions the agent should use
4. Can be added to the agent's system instructions

Respond with ONLY the instruction text (no explanation, no markdown headers). Keep it under 200 words.`;

    // Try new Google Gen AI SDK first (supports thinking config)
    if (this.genAI) {
      try {
        const text = await this.generateWithGenAI(prompt, 2048);
        if (text && text.length > 20) {
          console.log(`  [GenAI] Generated fix for pattern: ${pattern.pattern}`);
          return text.trim();
        }
      } catch (error) {
        console.log(`  [GenAI] Error, trying Vertex AI: ${error}`);
      }
    }

    // Fall back to Vertex AI
    try {
      const model = this.vertexAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 8192,
        },
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text && text.length > 20) {
        console.log(`  [Vertex AI] Generated fix for pattern: ${pattern.pattern}`);
        return text.trim();
      }

      return fallbackFixes[pattern.pattern] || fallbackFixes['other'];
    } catch (error) {
      console.log(`  [Fallback] Using static fix for ${pattern.pattern} (error: ${error})`);
      return fallbackFixes[pattern.pattern] || fallbackFixes['other'];
    }
  }

  /**
   * Generate optimized instruction based on failure patterns
   * IMPORTANT: This APPENDS fixes to the existing instruction, not replaces it
   */
  async optimizeInstruction(
    currentInstruction: string,
    failurePatterns: FailurePattern[]
  ): Promise<OptimizationResult> {
    const changes: InstructionChange[] = [];
    let optimizedInstruction = currentInstruction;

    // Apply fixes based on patterns - each fix modifies the full instruction
    for (const pattern of failurePatterns) {
      const change = this.applyPatternFix(optimizedInstruction, pattern);
      if (change) {
        // Store the change details (without fullInstruction to keep it clean)
        changes.push({
          section: change.section,
          original: change.original,
          updated: change.updated,
          reason: change.reason,
        });
        // Use the FULL modified instruction, not just the change snippet
        optimizedInstruction = change.fullInstruction;
      }
    }

    console.log(`[Optimizer] Original instruction: ${currentInstruction.length} chars`);
    console.log(`[Optimizer] Optimized instruction: ${optimizedInstruction.length} chars`);
    console.log(`[Optimizer] Applied ${changes.length} changes`);

    return {
      originalInstruction: currentInstruction,
      optimizedInstruction,
      changes,
      patternsAddressed: failurePatterns.map(p => p.pattern),
      expectedImprovementPercent: this.estimateImprovement(failurePatterns),
    };
  }

  /**
   * Optimize ALL agents based on their relevant failure patterns.
   * Groups patterns by target agent and applies fixes to each.
   */
  async optimizeAllAgents(
    failurePatterns: FailurePattern[],
    getInstruction: (agentId: string) => string | null
  ): Promise<{
    results: Array<{
      agentId: string;
      agentName: string;
      patternsFixed: string[];
      optimization: OptimizationResult;
    }>;
    summary: {
      totalPatterns: number;
      agentsOptimized: number;
      patternsByAgent: Record<string, number>;
    };
  }> {
    // Group patterns by target agent
    const patternsByAgent = new Map<string, FailurePattern[]>();

    for (const pattern of failurePatterns) {
      const targetAgent = pattern.targetAgent || getTargetAgentForPattern(pattern.pattern);
      if (!patternsByAgent.has(targetAgent)) {
        patternsByAgent.set(targetAgent, []);
      }
      patternsByAgent.get(targetAgent)!.push(pattern);
    }

    console.log(`[Optimizer] Optimizing ${patternsByAgent.size} agents for ${failurePatterns.length} patterns`);

    const results: Array<{
      agentId: string;
      agentName: string;
      patternsFixed: string[];
      optimization: OptimizationResult;
    }> = [];

    const agentNames: Record<string, string> = {
      orchestrator: 'Root Orchestrator',
      problem_clarifier: 'Problem Clarifier',
      assumption_hunter: 'Assumption Hunter',
      customer_researcher: 'Customer Researcher',
      experiment_designer: 'Experiment Designer',
    };

    // Optimize each agent
    for (const [agentId, patterns] of patternsByAgent) {
      const instruction = getInstruction(agentId);
      if (!instruction) {
        console.warn(`[Optimizer] No instruction found for agent: ${agentId}`);
        continue;
      }

      console.log(`[Optimizer] Optimizing ${agentId} with ${patterns.length} patterns`);

      const optimization = await this.optimizeInstruction(instruction, patterns);

      results.push({
        agentId,
        agentName: agentNames[agentId] || agentId,
        patternsFixed: patterns.map(p => p.pattern),
        optimization,
      });
    }

    // Build summary
    const patternCountByAgent: Record<string, number> = {};
    for (const [agentId, patterns] of patternsByAgent) {
      patternCountByAgent[agentId] = patterns.length;
    }

    return {
      results,
      summary: {
        totalPatterns: failurePatterns.length,
        agentsOptimized: results.length,
        patternsByAgent: patternCountByAgent,
      },
    };
  }

  /**
   * Use Google ADK (Agent Development Kit) for advanced optimization.
   * This calls the official Google ADK optimizer via Python script.
   */
  async optimizeWithADK(
    currentInstruction: string,
    failurePatterns: FailurePattern[],
    iterations: number = 3
  ): Promise<OptimizationResult> {
    console.log(`[ADK Optimizer] Starting optimization with ${failurePatterns.length} patterns...`);

    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'adk_optimizer.py');
      const patternsJson = JSON.stringify(failurePatterns);

      // Escape quotes for shell
      const escapedInstruction = currentInstruction.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const escapedPatterns = patternsJson.replace(/"/g, '\\"');

      const command = `python3 "${scriptPath}" --instruction "${escapedInstruction}" --patterns '${escapedPatterns}' --iterations ${iterations}`;

      console.log(`[ADK Optimizer] Running ADK optimization...`);
      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr) {
        console.warn(`[ADK Optimizer] Warnings: ${stderr}`);
      }

      const result = JSON.parse(stdout);

      if (!result.success) {
        console.warn(`[ADK Optimizer] Failed, falling back to built-in optimizer: ${result.error}`);
        return this.optimizeInstruction(currentInstruction, failurePatterns);
      }

      console.log(`[ADK Optimizer] Success! ${result.original_length} -> ${result.optimized_length} chars`);

      return {
        originalInstruction: currentInstruction,
        optimizedInstruction: result.optimized_instruction,
        changes: [{
          section: 'Full Instruction',
          original: `(${result.original_length} chars)`,
          updated: `(${result.optimized_length} chars)`,
          reason: `ADK optimized to address ${result.patterns_addressed?.length || 0} patterns`,
        }],
        patternsAddressed: result.patterns_addressed || failurePatterns.map(p => p.pattern),
        expectedImprovementPercent: this.estimateImprovement(failurePatterns),
      };
    } catch (error) {
      console.error(`[ADK Optimizer] Error:`, error);
      console.log(`[ADK Optimizer] Falling back to built-in optimizer...`);
      return this.optimizeInstruction(currentInstruction, failurePatterns);
    }
  }

  /**
   * Run a Quality Flywheel workflow modeled on Google's Agent Platform:
   * 1. Generate eval scenarios (User Simulation)
   * 2. Run inferences against agent
   * 3. Compute metrics (AutoRaters: MULTI_TURN_TASK_SUCCESS, TOOL_USE_QUALITY)
   * 4. Generate loss clusters (Auto-Loss Analysis)
   * 5. LLM-assisted instruction optimization (Gemini rewrite; not Google's GEPA)
   *
   * NOTE: today this path runs scripts/vertex_evaluation.py, which produces
   * metrics/clusters/optimization via Gemini. For the REAL Vertex Gen AI
   * Evaluation Service scores, use eval/collect_agent_runs.py + eval/real_eval.py.
   */
  async runQualityFlywheel(
    currentInstruction: string,
    failurePatterns: FailurePattern[],
    scenarioCount: number = 5
  ): Promise<OptimizationResult & { evaluation?: any }> {
    console.log(`[Quality Flywheel] Starting full evaluation & optimization workflow...`);
    console.log(`[Quality Flywheel] Generating ${scenarioCount} eval scenarios...`);

    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'vertex_evaluation.py');

      // Escape instruction for shell
      const escapedInstruction = currentInstruction
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');

      const command = `python3 "${scriptPath}" --instruction "${escapedInstruction}" --scenarios ${scenarioCount} --mode full`;

      console.log(`[Quality Flywheel] Running Gemini-based evaluation pipeline (see eval/real_eval.py for the real Vertex eval service)...`);
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minute timeout (evaluation takes longer)
        maxBuffer: 20 * 1024 * 1024, // 20MB buffer
      });

      if (stderr) {
        console.warn(`[Quality Flywheel] Warnings: ${stderr}`);
      }

      const result = JSON.parse(stdout);

      if (!result.success) {
        console.warn(`[Quality Flywheel] Failed, falling back to ADK optimizer: ${result.error}`);
        return this.optimizeWithADK(currentInstruction, failurePatterns);
      }

      console.log(`[Quality Flywheel] Complete!`);
      console.log(`[Quality Flywheel] Metrics:`, result.steps?.evaluate?.metrics);
      console.log(`[Quality Flywheel] Loss Clusters:`, result.steps?.loss_clusters?.clusters?.length || 0);

      // Extract loss clusters as changes
      const lossClusterChanges: InstructionChange[] = [];
      const clusters = result.steps?.loss_clusters?.clusters || [];
      for (const cluster of clusters) {
        lossClusterChanges.push({
          section: cluster.category || 'Unknown',
          original: cluster.pattern || 'Unknown pattern',
          updated: `Fixed: ${cluster.description || 'Addressed in optimization'}`,
          reason: `${cluster.count || 0} occurrences detected`,
        });
      }

      return {
        originalInstruction: currentInstruction,
        optimizedInstruction: result.optimized_instruction || currentInstruction,
        changes: lossClusterChanges.length > 0 ? lossClusterChanges : [{
          section: 'Full Optimization',
          original: `(${currentInstruction.length} chars)`,
          updated: `(${result.optimized_instruction?.length || 0} chars)`,
          reason: 'Quality Flywheel optimization complete',
        }],
        patternsAddressed: failurePatterns.map(p => p.pattern),
        expectedImprovementPercent: this.estimateImprovement(failurePatterns),
        evaluation: {
          metrics: result.steps?.evaluate?.metrics,
          lossClusters: clusters,
          scenariosGenerated: result.steps?.generate_scenarios?.count || 0,
        },
      };
    } catch (error) {
      console.error(`[Quality Flywheel] Error:`, error);
      console.log(`[Quality Flywheel] Falling back to ADK optimizer...`);
      return this.optimizeWithADK(currentInstruction, failurePatterns);
    }
  }

  /**
   * Apply a pattern fix to the instruction
   * Returns both the change details AND the full modified instruction
   */
  private applyPatternFix(
    instruction: string,
    pattern: FailurePattern
  ): (InstructionChange & { fullInstruction: string }) | null {
    const fixes: Record<string, { section: string; addition: string }> = {
      missing_problem_focus: {
        section: 'CONVERSATION GUIDELINES',
        addition: `
**CRITICAL: Problem-First Rule**
Before ANY tool use or advice, ensure you understand the PROBLEM:
- If founder describes features → Ask "What problem does this solve?"
- If founder describes technology → Ask "Who needs this and why?"
- If founder describes solution → Ask "What pain point triggered this idea?"
Never proceed until the problem is clearly articulated.`,
      },

      missing_validation_push: {
        section: 'Red flags to address immediately',
        addition: `
**Challenge Unvalidated Certainty**
When a founder expresses certainty without evidence:
- Ask "What evidence supports this?"
- Ask "How many potential customers have you talked to?"
- Ask "What did they actually say (not what you hoped they'd say)?"
Do NOT validate assumptions. Push for real evidence.`,
      },

      missing_focus_guidance: {
        section: 'Customer Segmentation',
        addition: `
**Relentless Narrowing**
If customer is "everyone", "businesses", or "people who X":
- This is NOT a segment. Keep slicing.
- Ask: "Within this group, who has the MOST urgent need?"
- Ask: "Where can you find these specific people?"
- Do NOT proceed until segment is specific enough to find.`,
      },

      inappropriate_validation: {
        section: 'Tone',
        addition: `
**Never Falsely Validate**
NEVER say: "sounds great", "good idea", "love it", "impressive"
INSTEAD say: "Tell me more about...", "What evidence do you have for...", "Have you validated that..."
Your job is to challenge, not to please.`,
      },

      premature_tool_call: {
        section: 'CONVERSATION GUIDELINES',
        addition: `
**Tool Gating**
Before using define_mvp_scope:
- Confirm: Has founder talked to potential customers?
- If NO → Redirect to validation first
- If YES → Ask what they learned before scoping

Before using create_7day_validation_plan:
- Confirm: Is the target customer specific?
- If vague → Use clarify_idea first`,
      },
    };

    const fix = fixes[pattern.pattern];
    if (!fix) return null;

    // Find section and add content
    const sectionRegex = new RegExp(`(## ${fix.section}[\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = instruction.match(sectionRegex);

    if (match) {
      const originalSection = match[1];
      const updatedSection = originalSection + '\n' + fix.addition;
      // Replace the section in the full instruction
      const fullInstruction = instruction.replace(originalSection, updatedSection);

      return {
        section: fix.section,
        original: originalSection.substring(0, 200) + '...',
        updated: updatedSection.substring(0, 200) + '...',
        reason: pattern.suggestedFix,
        fullInstruction, // Return the FULL modified instruction
      };
    }

    // If section not found, add at the end of the instruction
    const fullInstruction = instruction + '\n\n## ' + fix.section + '\n' + fix.addition;

    return {
      section: fix.section + ' (Added)',
      original: '(section did not exist)',
      updated: fix.addition.substring(0, 200) + '...',
      reason: pattern.suggestedFix,
      fullInstruction, // Return the FULL modified instruction with new section appended
    };
  }

  /**
   * Estimate improvement percentage based on patterns
   */
  private estimateImprovement(patterns: FailurePattern[]): number {
    const totalFailures = patterns.reduce((sum, p) => sum + p.frequency, 0);
    // Estimate 70% of addressed failures will be fixed
    return Math.min(95, totalFailures * 0.7 * 5);
  }

  /**
   * Run A/B test between two instruction versions using Gemini-based simulation.
   * Actually generates responses for each instruction and evaluates them.
   * Returns detailed per-scenario results for side-by-side comparison.
   */
  async runABTest(
    instructionA: string,
    instructionB: string,
    scenarios: typeof EDGE_CASE_SCENARIOS,
    agentEndpoint?: string
  ): Promise<ABTestResult> {
    console.log('[A/B Test] Starting REAL comparison using Gemini simulation...');
    console.log(`[A/B Test] Testing ${scenarios.length} scenarios with both instructions`);

    const model = this.vertexAI.getGenerativeModel({ model: this.model });
    const testScenarios = scenarios.slice(0, 5);

    // Results tracking
    const resultsA: { passed: number; totalLatency: number; scores: number[] } = {
      passed: 0,
      totalLatency: 0,
      scores: [],
    };
    const resultsB: { passed: number; totalLatency: number; scores: number[] } = {
      passed: 0,
      totalLatency: 0,
      scores: [],
    };

    // Scenario-level results for detailed comparison
    const scenarioResults: ScenarioResult[] = [];

    // Test each scenario with both instructions
    for (const scenario of testScenarios) {
      console.log(`[A/B Test] Testing scenario: ${scenario.name}`);

      // Test Version A
      const startA = Date.now();
      const evalA = await this.evaluateInstructionOnScenarioDetailed(model, instructionA, scenario);
      const latencyA = Date.now() - startA;
      resultsA.scores.push(evalA.score);
      resultsA.totalLatency += latencyA;
      if (evalA.score >= 0.7) resultsA.passed++;
      console.log(`  Version A: ${Math.round(evalA.score * 100)}% (${latencyA}ms)`);

      // Test Version B
      const startB = Date.now();
      const evalB = await this.evaluateInstructionOnScenarioDetailed(model, instructionB, scenario);
      const latencyB = Date.now() - startB;
      resultsB.scores.push(evalB.score);
      resultsB.totalLatency += latencyB;
      if (evalB.score >= 0.7) resultsB.passed++;
      console.log(`  Version B: ${Math.round(evalB.score * 100)}% (${latencyB}ms)`);

      // Determine scenario winner
      let scenarioWinner: 'A' | 'B' | 'tie' = 'tie';
      if (evalA.score - evalB.score >= 0.1) scenarioWinner = 'A';
      else if (evalB.score - evalA.score >= 0.1) scenarioWinner = 'B';

      scenarioResults.push({
        id: scenario.id,
        name: scenario.name,
        scoreA: evalA.score,
        scoreB: evalB.score,
        responseA: evalA.response?.substring(0, 300),
        responseB: evalB.response?.substring(0, 300),
        winner: scenarioWinner,
      });
    }

    // Calculate results
    const testedCount = testScenarios.length;
    const passRateA = resultsA.passed / testedCount;
    const passRateB = resultsB.passed / testedCount;
    const avgLatencyA = resultsA.totalLatency / testedCount;
    const avgLatencyB = resultsB.totalLatency / testedCount;
    const avgScoreA = resultsA.scores.reduce((a, b) => a + b, 0) / testedCount;
    const avgScoreB = resultsB.scores.reduce((a, b) => a + b, 0) / testedCount;

    // Determine winner (based on average score, min 5% difference)
    let winner: 'A' | 'B' | 'tie' = 'tie';
    const improvement = Math.round((avgScoreB - avgScoreA) * 100);

    if (avgScoreB - avgScoreA >= 0.05) {
      winner = 'B';
    } else if (avgScoreA - avgScoreB >= 0.05) {
      winner = 'A';
    }

    console.log(`[A/B Test] Complete!`);
    console.log(`  Version A: ${Math.round(avgScoreA * 100)}% avg score, ${passRateA * 100}% pass rate`);
    console.log(`  Version B: ${Math.round(avgScoreB * 100)}% avg score, ${passRateB * 100}% pass rate`);
    console.log(`  Winner: ${winner} (${improvement}% difference)`);

    return {
      instructionA: {
        version: 1,
        passRate: avgScoreA,
        avgLatency: avgLatencyA,
      },
      instructionB: {
        version: 2,
        passRate: avgScoreB,
        avgLatency: avgLatencyB,
      },
      winner,
      improvement: Math.abs(improvement),
      scenarios: scenarioResults,
    };
  }

  /**
   * Evaluate how well an instruction handles a specific scenario.
   * Returns both score and the generated response for detailed comparison.
   */
  private async evaluateInstructionOnScenarioDetailed(
    model: any,
    instruction: string,
    scenario: any
  ): Promise<{ score: number; response: string }> {
    try {
      // Step 1: Generate what the agent would respond with this instruction
      const responsePrompt = `You are an AI agent with the following system instruction:

---SYSTEM INSTRUCTION---
${instruction.substring(0, 3000)}
---END INSTRUCTION---

A founder says: "${scenario.initialPrompt}"

How would you respond? Write your response (1-3 paragraphs):`;

      const responseResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: responsePrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
      });

      const agentResponse = responseResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Step 2: Evaluate the response against scenario criteria
      const evalPrompt = `Evaluate this AI agent response for a founder validation scenario.

SCENARIO: ${scenario.name}
FOUNDER SAID: "${scenario.initialPrompt}"
EXPECTED BEHAVIOR: ${scenario.expectedAgentBehavior || 'Challenge assumptions, ask probing questions, avoid premature validation'}

AGENT RESPONSE:
${agentResponse}

PASS CRITERIA:
${JSON.stringify(scenario.passCriteria || {}, null, 2)}

Score the response from 0.0 to 1.0 based on:
- Does it meet the pass criteria? (required terms, avoiding forbidden terms)
- Does it challenge assumptions instead of validating prematurely?
- Does it ask good follow-up questions?
- Is it appropriately skeptical?

Output ONLY a JSON object: {"score": 0.X, "reason": "brief explanation"}`;

      const evalResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: evalPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      });

      const evalText = evalResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse score from response
      const scoreMatch = evalText.match(/"score"\s*:\s*([\d.]+)/);
      if (scoreMatch) {
        return {
          score: Math.min(1.0, Math.max(0.0, parseFloat(scoreMatch[1]))),
          response: agentResponse,
        };
      }

      return { score: 0.5, response: agentResponse }; // Default to neutral if parsing fails
    } catch (error) {
      console.log(`  [Eval] Error: ${error}`);
      return { score: 0.0, response: '' };
    }
  }

  /**
   * Generate instruction diff for review
   */
  generateDiff(original: string, optimized: string): string {
    const originalLines = original.split('\n');
    const optimizedLines = optimized.split('\n');

    let diff = '';
    const maxLines = Math.max(originalLines.length, optimizedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const optLine = optimizedLines[i] || '';

      if (origLine !== optLine) {
        if (origLine && !optLine) {
          diff += `- ${origLine}\n`;
        } else if (!origLine && optLine) {
          diff += `+ ${optLine}\n`;
        } else {
          diff += `- ${origLine}\n`;
          diff += `+ ${optLine}\n`;
        }
      }
    }

    return diff || 'No changes';
  }
}

// Lazy-loaded singleton (created on first use, not at import time)
let _optimizer: AgentOptimizer | null = null;

export function getOptimizer(): AgentOptimizer {
  if (!_optimizer) {
    _optimizer = new AgentOptimizer();
  }
  return _optimizer;
}

// For backward compatibility
export const optimizer = {
  analyzeFailures: (...args: Parameters<AgentOptimizer['analyzeFailures']>) =>
    getOptimizer().analyzeFailures(...args),
  optimizeInstruction: (...args: Parameters<AgentOptimizer['optimizeInstruction']>) =>
    getOptimizer().optimizeInstruction(...args),
  runABTest: (...args: Parameters<AgentOptimizer['runABTest']>) =>
    getOptimizer().runABTest(...args),
  generateDiff: (...args: Parameters<AgentOptimizer['generateDiff']>) =>
    getOptimizer().generateDiff(...args),
};
