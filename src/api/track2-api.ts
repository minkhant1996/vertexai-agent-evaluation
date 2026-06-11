/**
 * Track 2: API Routes for Simulation, Observability, and Optimization
 *
 * These endpoints power the Track 2 dashboards.
 */

import { EDGE_CASE_SCENARIOS, buildScenario, buildScenarios, getTemplate } from '../simulation/edge-cases.js';
import { getTemplates, updateTemplate, resetTemplates, renderTemplate, PromptTemplate } from '../simulation/templates.js';
import {
  getAgentTemplates,
  getAgentTemplate,
  updateAgentTemplate,
  resetAgentTemplates,
  resetSingleTemplate,
  getPromptHistory,
  applyHistoricalPrompt,
  getDefaultTemplate,
  renderAgentInstruction,
  AGENT_TEMPLATES,
} from '../agents/agent-templates.js';
import { AgentSimulator } from '../simulation/simulator.js';
import { cloudTrace, getAnalytics } from '../observability/cloud-trace.js';
import { vertexTrace, getAnalytics as getVertexAnalytics } from '../observability/vertex-trace.js';
import { AgentOptimizer, getTargetAgentForPattern } from '../optimizer/optimizer.js';

import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = process.env.STORAGE_BUCKET || 'founder-validation-data';
const STORAGE_FILE = 'simulation-storage.json';

// Cloud Storage client
const cloudStorage = new Storage();
const bucket = cloudStorage.bucket(BUCKET_NAME);

// Default storage structure
const defaultStorage = {
  simulationRuns: [] as any[],
  traces: [] as any[],
  instructionVersions: [
    {
      id: 'v1',
      version: 1,
      targetAgent: 'orchestrator', // Which agent this version applies to
      agentName: 'Root Orchestrator',
      instruction: 'Default instruction',
      failurePatternsAddressed: [] as string[],
      passRateBefore: null as number | null,
      passRateAfter: null as number | null,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  abTests: [] as any[],
};

// In-memory storage (loaded from Cloud Storage on startup)
let storage = { ...defaultStorage };
let storageLoaded = false;

// Load storage from Cloud Storage with timeout
async function loadStorage(): Promise<void> {
  if (storageLoaded) return;

  try {
    console.log('[Storage] Loading from Cloud Storage...');
    const file = bucket.file(STORAGE_FILE);

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<[boolean]>((_, reject) =>
      setTimeout(() => reject(new Error('Storage load timeout')), 5000)
    );

    const [exists] = await Promise.race([file.exists(), timeoutPromise]);

    if (exists) {
      const downloadTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Download timeout')), 10000)
      );
      const [contents] = await Promise.race([file.download(), downloadTimeout]) as [Buffer];
      storage = JSON.parse(contents.toString());
      console.log(`[Storage] Loaded ${storage.simulationRuns.length} runs from Cloud Storage`);
    } else {
      console.log('[Storage] No existing data, using defaults');
    }
    storageLoaded = true;
  } catch (err) {
    console.warn('[Storage] Could not load from Cloud Storage, using defaults:', err);
    storageLoaded = true; // Mark as loaded to prevent repeated attempts
  }
}

// Save storage to Cloud Storage (immediate, async)
let savePromise: Promise<void> | null = null;

async function saveStorageNow(): Promise<void> {
  try {
    const file = bucket.file(STORAGE_FILE);
    const data = JSON.stringify(storage, null, 2);
    console.log(`[Storage] Saving ${data.length} bytes to Cloud Storage...`);
    await file.save(data, {
      contentType: 'application/json',
    });
    console.log('[Storage] Saved to Cloud Storage successfully');
  } catch (err) {
    console.error('[Storage] Failed to save to Cloud Storage:', err);
    throw err;
  }
}

// Fire-and-forget save (for non-critical paths)
function saveStorage(): void {
  // Chain saves to avoid race conditions
  savePromise = (savePromise || Promise.resolve())
    .then(() => saveStorageNow())
    .catch(err => console.error('[Storage] Background save failed:', err));
}

// Storage is loaded lazily on first request
// This prevents blocking server startup

/**
 * Handle API requests
 * This can be integrated with Express or used standalone
 */
export async function handleTrack2Request(
  path: string,
  method: string,
  body?: any
): Promise<{ status: number; data: any }> {
  // Ensure storage is loaded before handling requests
  await loadStorage();
  // ========================================
  // SIMULATION ROUTES
  // ========================================

  // ========================================
  // TEMPLATE ROUTES
  // ========================================

  if (path === '/api/templates' && method === 'GET') {
    const templates = getTemplates();
    return {
      status: 200,
      data: Object.values(templates),
    };
  }

  if (path.startsWith('/api/templates/') && method === 'GET') {
    const templateId = path.split('/').pop();
    const template = getTemplates()[templateId!];
    if (!template) {
      return { status: 404, data: { error: 'Template not found' } };
    }
    return { status: 200, data: template };
  }

  if (path.startsWith('/api/templates/') && method === 'PUT') {
    const templateId = path.split('/').pop();
    const updated = updateTemplate(templateId!, body);
    if (!updated) {
      return { status: 404, data: { error: 'Template not found' } };
    }
    return { status: 200, data: updated };
  }

  if (path === '/api/templates/reset' && method === 'POST') {
    resetTemplates();
    return { status: 200, data: { success: true, message: 'Templates reset to defaults' } };
  }

  if (path === '/api/templates/preview' && method === 'POST') {
    const { template, variables } = body;
    const rendered = renderTemplate(template, variables || {});
    return { status: 200, data: { rendered } };
  }

  // ========================================
  // AGENT TEMPLATE ROUTES
  // ========================================

  if (path === '/api/agent-templates' && method === 'GET') {
    const templates = getAgentTemplates();
    return {
      status: 200,
      data: Object.values(templates),
    };
  }

  // Reset all agent templates (must come before single template routes)
  if (path === '/api/agent-templates/reset' && method === 'POST') {
    resetAgentTemplates();
    return { status: 200, data: { success: true, message: 'Agent templates reset to defaults' } };
  }

  if (path === '/api/agent-templates/preview' && method === 'POST') {
    const { agentId, variables } = body;
    const rendered = renderAgentInstruction(agentId, variables || {});
    return { status: 200, data: { rendered } };
  }

  // Get all prompt history
  if (path === '/api/agent-templates/history' && method === 'GET') {
    const history = getPromptHistory();
    return { status: 200, data: history };
  }

  // Apply a historical prompt
  if (path === '/api/agent-templates/history/apply' && method === 'POST') {
    const { historyId } = body;
    if (!historyId) {
      return { status: 400, data: { error: 'History ID required' } };
    }
    const result = applyHistoricalPrompt(historyId);
    if (!result) {
      return { status: 404, data: { error: 'History entry not found' } };
    }
    return { status: 200, data: { success: true, template: result } };
  }

  // Get default template for comparison (MUST come before generic GET)
  if (path.match(/^\/api\/agent-templates\/([^/]+)\/default$/) && method === 'GET') {
    const match = path.match(/^\/api\/agent-templates\/([^/]+)\/default$/);
    const templateId = match?.[1];
    if (!templateId) {
      return { status: 400, data: { error: 'Template ID required' } };
    }
    const defaultTemplate = getDefaultTemplate(templateId);
    if (!defaultTemplate) {
      return { status: 404, data: { error: 'Template not found' } };
    }
    return { status: 200, data: defaultTemplate };
  }

  // Get prompt history for an agent (MUST come before generic GET)
  if (path.match(/^\/api\/agent-templates\/([^/]+)\/history$/) && method === 'GET') {
    const match = path.match(/^\/api\/agent-templates\/([^/]+)\/history$/);
    const templateId = match?.[1];
    if (!templateId) {
      return { status: 400, data: { error: 'Template ID required' } };
    }
    const history = getPromptHistory(templateId);
    return { status: 200, data: history };
  }

  // Reset a single agent template to default (MUST come before generic routes)
  if (path.match(/^\/api\/agent-templates\/([^/]+)\/reset$/) && method === 'POST') {
    const match = path.match(/^\/api\/agent-templates\/([^/]+)\/reset$/);
    const templateId = match?.[1];
    if (!templateId) {
      return { status: 400, data: { error: 'Template ID required' } };
    }
    const result = resetSingleTemplate(templateId);
    if (!result) {
      return { status: 404, data: { error: 'Template not found' } };
    }
    return { status: 200, data: { success: true, template: result } };
  }

  // Generic GET for single template (comes AFTER specific routes)
  if (path.match(/^\/api\/agent-templates\/[^/]+$/) && method === 'GET') {
    const templateId = path.split('/').pop();
    const template = getAgentTemplate(templateId!);
    if (!template) {
      return { status: 404, data: { error: 'Agent template not found' } };
    }
    return { status: 200, data: template };
  }

  // Generic PUT for single template (comes AFTER specific routes)
  if (path.match(/^\/api\/agent-templates\/[^/]+$/) && method === 'PUT') {
    const templateId = path.split('/').pop();
    const updated = updateAgentTemplate(templateId!, body);
    if (!updated) {
      return { status: 404, data: { error: 'Agent template not found' } };
    }
    return { status: 200, data: updated };
  }

  // ========================================
  // SIMULATION ROUTES
  // ========================================

  if (path === '/api/simulation/scenarios' && method === 'GET') {
    // Rebuild scenarios with current templates
    const scenarios = buildScenarios();
    return {
      status: 200,
      data: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        templateId: s.templateId,
        difficulty: s.difficulty,
        description: s.description,
        initialPrompt: s.initialPrompt,
        followUpPrompts: s.followUpPrompts,
        expectedAgentBehavior: s.expectedAgentBehavior,
        passCriteria: s.passCriteria, // Include for UI criteria display
      })),
    };
  }

  if (path === '/api/simulation/run' && method === 'POST') {
    const { scenarioId, variables } = body;

    // Build scenario with custom variables if provided
    const scenario = variables
      ? buildScenario(scenarioId, variables)
      : buildScenarios().find(s => s.id === scenarioId);

    if (!scenario) {
      return { status: 404, data: { error: 'Scenario not found' } };
    }

    const simulator = new AgentSimulator(
      process.env.AGENT_ENDPOINT || 'http://localhost:8000'
    );

    try {
      const result = await simulator.runScenario(scenario);

      // Store result and persist
      storage.simulationRuns.push({
        id: `run_${Date.now()}`,
        ...result,
        scenarioId, // Override if result has different scenarioId
        createdAt: new Date().toISOString(),
      });
      saveStorage();

      return { status: 200, data: result };
    } catch (error) {
      return {
        status: 500,
        data: { error: `Simulation failed: ${error}` },
      };
    }
  }

  if (path === '/api/simulation/run-all' && method === 'POST') {
    const simulator = new AgentSimulator(
      process.env.AGENT_ENDPOINT || 'http://localhost:8101'
    );

    const results = await simulator.runAllScenarios();
    return { status: 200, data: results };
  }

  if (path === '/api/simulation/history' && method === 'GET') {
    return { status: 200, data: storage.simulationRuns.slice(-50) };
  }

  // ========================================
  // OBSERVABILITY ROUTES
  // ========================================

  if (path.startsWith('/api/observability/traces/') && method === 'GET') {
    const sessionId = path.split('/').pop();
    console.log(`[Traces API] Requested sessionId: ${sessionId}`);
    console.log(`[Traces API] storage.traces length: ${storage.traces?.length || 0}`);

    // Combine traces from storage and Vertex AI
    let vertexTraces: any[] = [];
    try {
      vertexTraces = vertexTrace.getAllTraces();
      console.log(`[Traces API] vertexTraces length: ${vertexTraces?.length || 0}`);
    } catch (err) {
      console.error(`[Traces API] vertexTrace.getAllTraces() error:`, err);
    }

    if (sessionId === 'all') {
      // Return all fields from local traces
      const localTraces = storage.traces?.slice(-100).map((t: any) => ({ ...t, source: 'Cloud Storage' })) || [];
      // Preserve all fields from Vertex traces too
      const mappedVertexTraces = vertexTraces?.slice(-100).map(t => ({
        ...t,
        source: 'Cloud Trace',
      })) || [];

      const combinedTraces = [...localTraces, ...mappedVertexTraces];
      console.log(`[Traces API] Returning ${combinedTraces.length} traces (${localTraces.length} local + ${mappedVertexTraces.length} vertex)`);
      return { status: 200, data: combinedTraces };
    }

    const sessionTraces = [
      ...storage.traces.filter((t: any) => t.sessionId === sessionId).map((t: any) => ({ ...t, source: 'Cloud Storage' })),
      ...vertexTraces.filter(t => t.sessionId === sessionId).map(t => ({ ...t, source: 'Cloud Trace' })),
    ];
    return { status: 200, data: sessionTraces };
  }

  if (path.startsWith('/api/observability/trace/') && method === 'GET') {
    const traceId = path.split('/').pop();
    const trace = cloudTrace.getTrace(traceId!);

    if (!trace) {
      return { status: 404, data: { error: 'Trace not found' } };
    }

    return {
      status: 200,
      data: {
        ...trace,
        cloudTraceUrl: cloudTrace.getCloudTraceUrl(traceId!),
      },
    };
  }

  if (path === '/api/observability/analytics' && method === 'GET') {
    // Calculate analytics from persisted traces (survives container restarts)
    const traces = storage.traces || [];
    console.log(`[Analytics API] storage.traces length: ${traces.length}`);

    if (traces.length === 0) {
      return {
        status: 200,
        data: {
          totalTraces: 0,
          successRate: 0,
          avgLatency: 0,
          intentAccuracy: 0,
          toolUsage: {},
          p50Latency: 0,
          p95Latency: 0,
          p99Latency: 0,
        },
      };
    }

    const successCount = traces.filter((t: any) => t.success).length;
    const latencies = traces.map((t: any) => t.latencyMs || 0).sort((a: number, b: number) => a - b);
    const avgLatency = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;

    // Calculate percentiles
    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      status: 200,
      data: {
        totalTraces: traces.length,
        successRate: successCount / traces.length,
        avgLatency: Math.round(avgLatency),
        intentAccuracy: successCount / traces.length, // Same as success rate for now
        toolUsage: {},
        p50Latency: latencies[p50Index] || 0,
        p95Latency: latencies[p95Index] || 0,
        p99Latency: latencies[p99Index] || 0,
      },
    };
  }

  // ========================================
  // OPTIMIZER ROUTES
  // ========================================

  if (path === '/api/optimizer/analyze-failures' && method === 'GET') {
    const optimizer = new AgentOptimizer();

    // Get runs that failed OR scored below 100% (room for improvement)
    const improvableRuns = storage.simulationRuns.filter((r: any) => {
      // Failed tests
      if (!r.passed) return true;
      // Passed but not perfect (score < 100%)
      if (r.score !== undefined && r.score < 1.0) return true;
      return false;
    });

    console.log(`[Optimizer] Found ${improvableRuns.length} improvable runs out of ${storage.simulationRuns.length} total`);

    if (improvableRuns.length === 0) {
      return { status: 200, data: [] };
    }

    const patterns = await optimizer.analyzeFailures(improvableRuns);
    return { status: 200, data: patterns };
  }

  if (path === '/api/optimizer/optimize' && method === 'POST') {
    const optimizer = new AgentOptimizer();
    const selectedPatternNames = body?.patterns as string[] | undefined; // Optional: specific patterns to fix
    const targetAgentId = body?.targetAgent || 'orchestrator'; // Which agent to optimize
    const useADK = body?.useADK === true; // Use Google ADK optimizer

    // Get the actual instruction from agent templates
    const targetTemplate = getAgentTemplate(targetAgentId);
    if (!targetTemplate) {
      return { status: 404, data: { error: `Agent template '${targetAgentId}' not found` } };
    }
    const currentInstruction = targetTemplate.instruction;

    // Analyze runs that need improvement (failed OR < 100%)
    const improvableRuns = storage.simulationRuns.filter((r: any) => {
      if (!r.passed) return true;
      if (r.score !== undefined && r.score < 1.0) return true;
      return false;
    });
    let patterns = await optimizer.analyzeFailures(improvableRuns);

    // Filter to selected patterns if specified
    if (selectedPatternNames && selectedPatternNames.length > 0) {
      patterns = patterns.filter(p => selectedPatternNames.includes(p.pattern));
      console.log(`[Optimizer] Fixing ${patterns.length} selected patterns for ${targetTemplate.name}: ${selectedPatternNames.join(', ')}`);
    } else {
      console.log(`[Optimizer] Fixing all ${patterns.length} patterns for ${targetTemplate.name}`);
    }

    if (patterns.length === 0) {
      return { status: 400, data: { error: 'No improvement patterns found' } };
    }

    // Generate optimized instruction
    // Options: built-in, ADK, or full Quality Flywheel
    const useQualityFlywheel = body?.useQualityFlywheel === true;
    let result;
    let evaluationData = null;

    if (useQualityFlywheel) {
      console.log(`[Optimizer] Using Google Quality Flywheel (full evaluation pipeline)...`);
      const flywheelResult = await optimizer.runQualityFlywheel(currentInstruction, patterns);
      result = flywheelResult;
      evaluationData = flywheelResult.evaluation;
    } else if (useADK) {
      console.log(`[Optimizer] Using Google ADK optimizer...`);
      result = await optimizer.optimizeWithADK(currentInstruction, patterns);
    } else {
      result = await optimizer.optimizeInstruction(currentInstruction, patterns);
    }

    // Calculate next version number (find max existing + 1)
    const maxVersion = storage.instructionVersions.reduce((max: number, v: any) => Math.max(max, v.version || 0), 0);
    const nextVersion = maxVersion + 1;

    // Create new version with evaluation data
    const newVersion = {
      id: `v${nextVersion}`,
      version: nextVersion,
      targetAgent: targetAgentId,
      agentName: targetTemplate.name,
      instruction: result.optimizedInstruction,
      previousInstruction: currentInstruction,
      failurePatternsAddressed: result.patternsAddressed,
      changes: result.changes,
      passRateBefore: calculatePassRate(storage.simulationRuns),
      passRateAfter: null, // Will be set after re-testing
      isActive: false,
      createdAt: new Date().toISOString(),
      // New fields for Quality Flywheel
      optimizerMethod: useQualityFlywheel ? 'quality_flywheel' : (useADK ? 'adk' : 'built_in'),
      evaluation: evaluationData, // Metrics, loss clusters, etc.
    };

    storage.instructionVersions.unshift(newVersion);
    saveStorage();

    return { status: 200, data: { version: newVersion, optimization: result, evaluation: evaluationData } };
  }

  // Optimize ALL agents at once - Fix All patterns across all relevant agents
  if (path === '/api/optimizer/optimize-all' && method === 'POST') {
    const optimizer = new AgentOptimizer();
    const useADK = body?.useADK === true;

    // Analyze all improvable runs
    const improvableRuns = storage.simulationRuns.filter((r: any) => {
      if (!r.passed) return true;
      if (r.score !== undefined && r.score < 1.0) return true;
      return false;
    });

    if (improvableRuns.length === 0) {
      return { status: 200, data: { results: [], summary: { totalPatterns: 0, agentsOptimized: 0 } } };
    }

    // Get all patterns with their target agents
    const patterns = await optimizer.analyzeFailures(improvableRuns);

    // Helper to get instruction for an agent
    const getInstruction = (agentId: string): string | null => {
      const template = getAgentTemplate(agentId);
      return template?.instruction || null;
    };

    // Optimize all agents
    const multiAgentResult = await optimizer.optimizeAllAgents(patterns, getInstruction);

    // Create versions for each optimized agent
    const newVersions = [];
    const nextVersion = storage.instructionVersions.length + 1;

    for (let i = 0; i < multiAgentResult.results.length; i++) {
      const agentResult = multiAgentResult.results[i];
      const versionNum = nextVersion + i;

      const newVersion = {
        id: `v${versionNum}`,
        version: versionNum,
        targetAgent: agentResult.agentId,
        agentName: agentResult.agentName,
        instruction: agentResult.optimization.optimizedInstruction,
        failurePatternsAddressed: agentResult.patternsFixed,
        passRateBefore: null,
        passRateAfter: null,
        isActive: false,
        createdAt: new Date().toISOString(),
        optimizerMethod: useADK ? 'adk_multi_agent' : 'built_in_multi_agent',
      };

      storage.instructionVersions.unshift(newVersion);
      newVersions.push(newVersion);

      console.log(`[Optimizer] Created version ${versionNum} for ${agentResult.agentId} (${agentResult.patternsFixed.length} patterns)`);
    }

    saveStorage();

    return {
      status: 200,
      data: {
        versions: newVersions,
        results: multiAgentResult.results,
        summary: multiAgentResult.summary,
      },
    };
  }

  if (path === '/api/optimizer/apply' && method === 'POST') {
    const { versionId } = body;

    const version = storage.instructionVersions.find((v: any) => v.id === versionId);
    if (!version) {
      return { status: 404, data: { error: 'Version not found' } };
    }

    // Actually apply the instruction to the agent template
    const targetAgentId = version.targetAgent || 'orchestrator';

    // Safety check: Don't apply if instruction is too short (likely a corrupted fix snippet)
    const MIN_INSTRUCTION_LENGTH = 500; // Full instructions are typically 2000+ chars
    if (version.instruction && version.instruction !== 'Default instruction') {
      if (version.instruction.length < MIN_INSTRUCTION_LENGTH) {
        console.warn(`[Optimizer] Version ${version.version} has short instruction (${version.instruction.length} chars) - likely corrupted. Skipping apply.`);
        return {
          status: 400,
          data: {
            error: `This version appears to contain only a fix snippet (${version.instruction.length} chars), not a full instruction. This is likely corrupted data from an earlier bug. Please create a new version using "Fix This Pattern" instead.`,
            corrupted: true
          }
        };
      }

      const updated = updateAgentTemplate(targetAgentId, { instruction: version.instruction }, 'optimizer', `Applied optimization version ${version.version}`);
      if (!updated) {
        return { status: 500, data: { error: `Failed to update agent template '${targetAgentId}'` } };
      }
      console.log(`[Optimizer] Applied version ${version.version} (${version.instruction.length} chars) to ${targetAgentId}`);
    }

    // Deactivate all versions for this agent, activate selected
    storage.instructionVersions.forEach((v: any) => {
      if (v.targetAgent === targetAgentId || (!v.targetAgent && targetAgentId === 'orchestrator')) {
        v.isActive = false;
      }
    });
    version.isActive = true;
    saveStorage();

    return { status: 200, data: { success: true, appliedVersion: version, targetAgent: targetAgentId } };
  }

  if (path === '/api/optimizer/history' && method === 'GET') {
    return { status: 200, data: storage.instructionVersions };
  }

  // Get available agents for optimization
  if (path === '/api/optimizer/agents' && method === 'GET') {
    const agents = Object.values(AGENT_TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }));
    return { status: 200, data: agents };
  }

  if (path === '/api/optimizer/ab-test' && method === 'POST') {
    const { versionA, versionB } = body;

    const instA = storage.instructionVersions.find((v: any) => v.version === versionA);
    const instB = storage.instructionVersions.find((v: any) => v.version === versionB);

    if (!instA || !instB) {
      return { status: 404, data: { error: 'Version not found' } };
    }

    console.log(`[A/B Test] Comparing Version ${versionA} vs Version ${versionB} using Vertex AI`);

    // Use the real optimizer A/B test with Vertex AI
    const optimizer = new AgentOptimizer();
    const scenarios = buildScenarios().slice(0, 5); // Test with 5 scenarios

    // Get instructions (use actual template if version instruction is missing/corrupted)
    const targetAgentId = instA.targetAgent || 'orchestrator';
    const currentTemplate = getAgentTemplate(targetAgentId);
    const instructionA = (instA.instruction && instA.instruction.length > 500)
      ? instA.instruction
      : currentTemplate?.instruction || '';
    const instructionB = (instB.instruction && instB.instruction.length > 500)
      ? instB.instruction
      : currentTemplate?.instruction || '';

    try {
      // Run real A/B test using Vertex AI evaluation
      const abResult = await optimizer.runABTest(instructionA, instructionB, scenarios);

      const result = {
        instructionA: {
          version: instA.version,
          passRate: abResult.instructionA.passRate,
          avgLatency: Math.round(abResult.instructionA.avgLatency),
          patternsAddressed: instA.failurePatternsAddressed?.length || 0,
        },
        instructionB: {
          version: instB.version,
          passRate: abResult.instructionB.passRate,
          avgLatency: Math.round(abResult.instructionB.avgLatency),
          patternsAddressed: instB.failurePatternsAddressed?.length || 0,
        },
        winner: abResult.winner,
        improvement: abResult.improvement,
        testedScenarios: scenarios.length,
        evaluatedBy: 'vertex_ai',
        // Include detailed scenario results for side-by-side comparison
        scenarios: abResult.scenarios || [],
      };

      console.log(`[A/B Test] Real Vertex AI Result: Winner=${result.winner}, Improvement=${result.improvement}%`);

      // Store A/B test result
      storage.abTests.push({
        id: `ab_${Date.now()}`,
        ...result,
        createdAt: new Date().toISOString(),
      });
      saveStorage();

      return { status: 200, data: result };
    } catch (error) {
      console.error(`[A/B Test] Vertex AI error:`, error);
      return {
        status: 500,
        data: {
          error: `A/B test failed: ${error}`,
          hint: 'Make sure Vertex AI is properly configured and the agent endpoint is accessible.',
        },
      };
    }
  }

  // ========================================
  // 404 for unknown routes
  // ========================================

  return { status: 404, data: { error: 'Not found' } };
}

/**
 * Calculate pass rate from simulation runs
 */
function calculatePassRate(runs: any[]): number {
  if (runs.length === 0) return 0;
  const passed = runs.filter(r => r.passed).length;
  return passed / runs.length;
}

/**
 * Save a simulation result (called from streaming simulation)
 */
export async function saveSimulationResult(result: any): Promise<void> {
  console.log(`[Simulation] Saving result for ${result.scenarioId}...`);

  storage.simulationRuns.push({
    id: `run_${Date.now()}`,
    ...result,
    createdAt: new Date().toISOString(),
  });

  // Keep only last 100 runs
  if (storage.simulationRuns.length > 100) {
    storage.simulationRuns = storage.simulationRuns.slice(-100);
  }

  // Await the save to ensure it completes before container shutdown
  try {
    await saveStorageNow();
    console.log(`[Simulation] Result saved for ${result.scenarioId}: ${result.passed ? 'PASSED' : 'FAILED'}`);
  } catch (err) {
    console.error(`[Simulation] Failed to save result for ${result.scenarioId}:`, err);
  }
}

/**
 * Record a trace (called from agent middleware)
 */
export async function recordTrace(trace: any): Promise<void> {
  storage.traces.push({
    ...trace,
    createdAt: new Date().toISOString(),
  });

  // Keep only last 1000 traces
  if (storage.traces.length > 1000) {
    storage.traces = storage.traces.slice(-1000);
  }

  // Persist to Cloud Storage
  try {
    await saveStorageNow();
  } catch (err) {
    console.error('[Trace] Failed to save trace:', err);
  }
}

/**
 * Export storage for testing
 */
export function getStorage() {
  return storage;
}
