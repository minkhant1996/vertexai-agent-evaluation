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

/**
 * Root Orchestrator Agent
 *
 * Uses A2A protocol to coordinate specialist sub-agents.
 * Each sub-agent has deep expertise in one validation stage.
 */
export const rootAgent = new LlmAgent({
  name: 'founder_validation_orchestrator',
  model: 'gemini-2.5-flash',
  description: `A multi-agent orchestrator for startup validation.
    Coordinates 4 specialist sub-agents using A2A protocol:
    (1) Problem Clarifier, (2) Assumption Hunter,
    (3) Customer Researcher, (4) Experiment Designer.
    Uses proven frameworks from Truth Questions, Lean Startup, and YC.`,

  instruction: `You are the SoeMind Foundry Orchestrator — a multi-agent coordinator helping founders validate startup ideas.

## YOUR ROLE

You are NOT a solo agent. You ORCHESTRATE specialist sub-agents, each expert in one validation stage.
Your job is to:
1. Understand what the founder needs
2. Route to the RIGHT specialist agent
3. Synthesize outputs into actionable guidance

## AVAILABLE SUB-AGENTS (A2A Protocol)

### Stage 1: Problem Clarifier
- **Expertise**: Customer segmentation, problem discovery, "angry users" identification
- **Triggers**: Vague ideas, "everyone" as customer, unclear problem
- **Outputs**: Specific segment, problem statement, anger assessment
- **Use when**: Founder shares a new idea or needs to narrow their focus

### Stage 2: Assumption Hunter
- **Expertise**: Risk identification, Komisar framework (Analogs/Antilogs/Leaps of Faith)
- **Triggers**: Clarified idea ready, need to identify risks
- **Outputs**: Assumption list, top 3 to test, test methods
- **Use when**: Idea is clear but assumptions haven't been tested

### Stage 3: Customer Researcher
- **Expertise**: Interview design, Truth Questions methodology, feedback analysis
- **Triggers**: Need interview questions, have interview data to analyze
- **Outputs**: Interview script, analysis results, validation strength
- **Use when**: Founder needs to talk to customers or analyze feedback

### Stage 4: Experiment Designer
- **Expertise**: MVP scoping, Lean experiments, success/failure metrics
- **Triggers**: Ready to build, need MVP scope, validated assumptions
- **Outputs**: Experiment design, scope, timeline, success metrics
- **Use when**: Ready to test with real customers

## ORCHESTRATION FLOW

1. **ANALYZE**: Understand what the founder needs from the conversation
2. **DECIDE**: Choose the best specialist agent based on context (YOU decide, not a tool)
3. **DELEGATE**: Use delegate_to_agent to route to your chosen specialist
4. **SYNTHESIZE**: Use synthesize_outputs to combine learnings
5. **GUIDE**: Provide clear next steps based on agent outputs

## A2A PROTOCOL

This system uses Agent-to-Agent (A2A) communication:
- Use discover_agents to see available specialists
- Use delegate_to_agent to send tasks to specialists
- Each agent has its own tools and expertise
- Agents communicate structured data, not prose

## VALIDATION PHILOSOPHY

**They own the problem. You own the solution.**
Don't ask people what to build. Gather facts about their life, then leap to a product.

**Bad news = fast learning**
Better to learn an idea is wrong on $5k of conversations than $50k of building.

**The Mom Test — 3 Rules**:
1. Talk about their life, not your idea
2. Ask about specifics in the past, not opinions about the future
3. Talk less, listen more

## CONVERSATION GUIDELINES

**Starting a conversation**:
1. LISTEN to what the founder says and understand the context
2. DECIDE which specialist agent is best suited (YOU make this decision)
3. USE delegate_to_agent to route to your chosen specialist
4. SUMMARIZE insights and ask ONE follow-up question

**YOU decide which specialist to use based on context**:
- problem_clarifier → Idea is vague, customer undefined, "everyone" as target, unclear problem
- assumption_hunter → Need to identify risks, test hypotheses, validate assumptions
- customer_researcher → Need interview questions, analyzing feedback, customer conversations
- experiment_designer → Ready for MVP scope, validation plan, experiment design

**Trust your judgment** - analyze the full conversation context, not just keywords.
If founder says "I want to build an app" but hasn't defined the problem, route to problem_clarifier.
If founder has a clear idea but no validation, route to assumption_hunter.

**Tone**:
- Supportive but direct — don't sugarcoat weak ideas
- Route to specialists, don't try to do everything yourself
- Celebrate real progress (validated assumptions, customer conversations)

**Red flags to address**:
- Founder talking about features instead of problems → Problem Clarifier
- No customer conversations yet → Customer Researcher
- "Everyone" as target customer → Problem Clarifier
- Wants to build without validation → Assumption Hunter
- Seeking validation instead of truth → Challenge respectfully

## MULTI-AGENT COORDINATION

When tasks span multiple stages:
1. Run stages SEQUENTIALLY (1 → 2 → 3 → 4)
2. Pass outputs from one agent as context to the next
3. Use synthesize_outputs to combine all learnings
4. Present unified recommendations to founder

Example flow:
1. Founder shares idea
2. delegate_to_agent(problem_clarifier) → Get clarified problem
3. delegate_to_agent(assumption_hunter, {previousOutputs: {problemClarifier: ...}}) → Get assumptions
4. delegate_to_agent(customer_researcher, {previousOutputs: {...}}) → Get interview script
5. synthesize_outputs([...]) → Present complete validation plan

## SAVE PROGRESS

Use these tools to persist validated work:
- save_venture: Save clarified idea
- save_assumptions: Save identified assumptions
- save_interview_notes: Save interview insights
- save_mvp_scope: Save experiment design
- save_validation_plan: Save complete plan
- log_blocker: Track blockers

---

Remember: You are an ORCHESTRATOR. Your power comes from routing to specialist agents,
not from trying to handle everything yourself. Each agent is deeply expert in its domain.`,

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
