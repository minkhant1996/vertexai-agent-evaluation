/**
 * SoeMind Foundry: Root Orchestrator Agent
 *
 * A2A (Agent-to-Agent) Multi-Agent Orchestrator
 * Coordinates 4 specialist sub-agents for founder validation:
 * 1. Problem Clarifier → Extract specific problem & customer
 * 2. Assumption Hunter → Find risky assumptions
 * 3. Customer Researcher → Design interviews, analyze feedback
 * 4. Experiment Designer → Scope cheapest validation experiment
 *
 * Built on proven frameworks from:
 * - Truth Questions (Rob Fitzpatrick)
 * - The Lean Startup (Eric Ries)
 * - Inspired (Marty Cagan)
 * - The Lean Product Playbook (Dan Olsen)
 * - YC Startup Library
 */

import { LlmAgent, GOOGLE_SEARCH } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Import sub-agents
import { problemClarifierAgent } from './agents/problem-clarifier.js';
import { assumptionHunterAgent } from './agents/assumption-hunter.js';
import { customerResearcherAgent } from './agents/customer-researcher.js';
import { experimentDesignerAgent } from './agents/experiment-designer.js';
import { agentRegistry, agentCards } from './agents/index.js';

// Import existing tools for data persistence
import {
  saveVentureTool,
  saveAssumptionsTool,
  saveInterviewNotesTool,
  saveMVPScopeTool,
  saveValidationPlanTool,
  logBlockerTool,
} from './tools/index.js';

// Import template system for dynamic instruction
import { getRenderedInstruction } from './agents/agent-templates.js';

// A2A Agent Discovery Tool
const discoverAgentsTool = new FunctionTool({
  name: 'discover_agents',
  description: 'Discovers available specialist agents and their capabilities (A2A protocol)',
  parameters: z.object({
    capability: z.string().optional().describe('Filter by capability type'),
  }),
  execute: async (input) => {
    const agents = agentCards.filter(agent => {
      if (!input.capability) return true;
      return agent.triggers.some(t => t.toLowerCase().includes(input.capability!.toLowerCase()));
    });
    return {
      status: 'agents_discovered',
      availableAgents: agents,
      protocol: 'a2a',
      message: 'Use delegate_to_agent tool to invoke a specialist',
    };
  },
});

// A2A Delegation Tool - Routes to specialist sub-agents
const delegateToAgentTool = new FunctionTool({
  name: 'delegate_to_agent',
  description: 'Delegates a task to a specialist sub-agent using A2A protocol',
  parameters: z.object({
    agentId: z.enum([
      'problem_clarifier',
      'assumption_hunter',
      'customer_researcher',
      'experiment_designer',
    ]).describe('The specialist agent to delegate to'),
    task: z.string().describe('The task/context to send to the agent'),
    context: z.object({
      founderInput: z.string().describe('What the founder said/shared'),
      currentStage: z.number().optional().describe('Current validation stage (1-4)'),
      previousOutputs: z.record(z.string(), z.any()).optional().describe('Outputs from previous stages'),
    }),
  }),
  execute: async (input) => {
    const agentMeta = agentRegistry[input.agentId as keyof typeof agentRegistry];

    return {
      status: 'delegated',
      delegatedTo: {
        agentId: input.agentId,
        name: agentMeta.name,
        stage: agentMeta.stage,
      },
      task: input.task,
      context: input.context,
      instruction: `The ${agentMeta.name} agent will now analyze the founder's input using its specialized tools.`,
      expectedOutputs: agentMeta.outputs,
      a2aMetadata: {
        protocol: 'a2a',
        sourceAgent: 'founder_validation_orchestrator',
        targetAgent: input.agentId,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

// Validation Progress Tracker Tool - tracks what has been completed
const getValidationProgressTool = new FunctionTool({
  name: 'get_validation_progress',
  description: 'Returns the current validation progress to help you decide which specialist agent to delegate to',
  parameters: z.object({
    hasExistingIdea: z.boolean().describe('Whether we already have a clarified idea'),
    hasAssumptions: z.boolean().describe('Whether assumptions have been identified'),
    hasInterviewData: z.boolean().describe('Whether interview data exists'),
  }),
  execute: async (input) => {
    return {
      status: 'progress_retrieved',
      completedStages: {
        ideaClarified: input.hasExistingIdea,
        assumptionsIdentified: input.hasAssumptions,
        customerInterviewed: input.hasInterviewData,
      },
      availableAgents: [
        { id: 'problem_clarifier', stage: 1, name: 'Problem Clarifier', use: 'When idea is vague, customer undefined, or problem unclear' },
        { id: 'assumption_hunter', stage: 2, name: 'Assumption Hunter', use: 'When need to identify risky assumptions to test' },
        { id: 'customer_researcher', stage: 3, name: 'Customer Researcher', use: 'When need interview questions or analyzing customer feedback' },
        { id: 'experiment_designer', stage: 4, name: 'Experiment Designer', use: 'When ready to scope MVP or create validation plan' },
      ],
      note: 'YOU decide which agent to delegate to based on the conversation context. Use delegate_to_agent with your chosen agentId.',
    };
  },
});

// Synthesize Agent Outputs Tool
const synthesizeOutputsTool = new FunctionTool({
  name: 'synthesize_outputs',
  description: 'Combines outputs from multiple agents into a coherent validation summary',
  parameters: z.object({
    outputs: z.array(z.object({
      agentId: z.string(),
      stage: z.number(),
      output: z.any(),
    })),
  }),
  execute: async (input) => {
    const summary: Record<string, any> = {
      stages: {},
      overallProgress: 0,
      nextAction: '',
      blockers: [],
    };

    input.outputs.forEach(o => {
      summary.stages[o.agentId] = {
        stage: o.stage,
        completed: true,
        output: o.output,
      };
    });

    summary.overallProgress = (Object.keys(summary.stages).length / 4) * 100;

    if (!summary.stages.problem_clarifier) {
      summary.nextAction = 'Clarify the problem and customer segment';
    } else if (!summary.stages.assumption_hunter) {
      summary.nextAction = 'Identify risky assumptions to test';
    } else if (!summary.stages.customer_researcher) {
      summary.nextAction = 'Conduct customer interviews';
    } else if (!summary.stages.experiment_designer) {
      summary.nextAction = 'Design validation experiment';
    } else {
      summary.nextAction = 'Execute experiment and measure results';
    }

    return {
      status: 'synthesized',
      ...summary,
      recommendation: `You are ${summary.overallProgress}% through validation. ${summary.nextAction}.`,
    };
  },
});

// Get the orchestrator instruction from the template system
// This reads from .agent-templates.json which is edited via the UI
// Note: Changes require server restart to take effect
const orchestratorInstruction = getRenderedInstruction('orchestrator') || `You are the SoeMind Foundry Orchestrator — a multi-agent coordinator helping founders validate startup ideas.
Your job is to:
1. Understand what the founder needs
2. Route to the RIGHT specialist agent
3. Synthesize outputs into actionable guidance

Use delegate_to_agent to route to specialists:
- problem_clarifier: For vague ideas, unclear customers
- assumption_hunter: For identifying risks to test
- customer_researcher: For interview design and analysis
- experiment_designer: For MVP scoping`;

console.log('[Agent] Using instruction from template system (length: ' + orchestratorInstruction.length + ')');

/**
 * Root Orchestrator Agent
 *
 * Uses A2A protocol to coordinate specialist sub-agents.
 * Each sub-agent has deep expertise in one validation stage.
 *
 * NOTE: The instruction is loaded from the template system at startup.
 * Edit templates via the UI at /templates - changes require server restart.
 */
export const rootAgent = new LlmAgent({
  name: 'founder_validation_orchestrator',
  model: 'gemini-2.5-flash',
  description: `A multi-agent orchestrator for startup validation.
    Coordinates 4 specialist sub-agents using A2A protocol:
    (1) Problem Clarifier, (2) Assumption Hunter,
    (3) Customer Researcher, (4) Experiment Designer.
    Uses proven frameworks from Truth Questions, Lean Startup, and YC.`,

  instruction: orchestratorInstruction,

  // NOTE: Sub-agents temporarily disabled due to ADK compatibility issue
  // The agent works without sub-agents and tools still function properly
  // Investigation needed: ADK returns empty responses when subAgents are included
  // subAgents: [
  //   problemClarifierAgent,
  //   assumptionHunterAgent,
  //   customerResearcherAgent,
  //   experimentDesignerAgent,
  // ],

  // Orchestration tools
  tools: [
    // A2A Protocol tools
    discoverAgentsTool,
    delegateToAgentTool,
    getValidationProgressTool,
    synthesizeOutputsTool,

    // NOTE: GOOGLE_SEARCH disabled - causes "Multiple tools" error on Vertex AI
    // GOOGLE_SEARCH,

    // Persistence tools
    saveVentureTool,
    saveAssumptionsTool,
    saveInterviewNotesTool,
    saveMVPScopeTool,
    saveValidationPlanTool,
    logBlockerTool,
  ],
});

export default rootAgent;

// Export sub-agents for direct access if needed
export {
  problemClarifierAgent,
  assumptionHunterAgent,
  customerResearcherAgent,
  experimentDesignerAgent,
  agentRegistry,
  agentCards,
};
