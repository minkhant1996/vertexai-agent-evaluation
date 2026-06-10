/**
 * Validation Sub-Agents
 *
 * Multi-agent system for founder idea validation.
 * Uses A2A (Agent-to-Agent) protocol for inter-agent communication.
 *
 * Flow:
 * 1. Problem Clarifier → Extract specific problem & customer
 * 2. Assumption Hunter → Find risky assumptions
 * 3. Customer Researcher → Design interviews, analyze feedback
 * 4. Experiment Designer → Scope cheapest validation experiment
 */

export { problemClarifierAgent } from './problem-clarifier.js';
export { assumptionHunterAgent } from './assumption-hunter.js';
export { customerResearcherAgent } from './customer-researcher.js';
export { experimentDesignerAgent } from './experiment-designer.js';

// Agent metadata for A2A discovery
export const agentRegistry = {
  problem_clarifier: {
    name: 'Problem Clarifier',
    stage: 1,
    description: 'Extracts specific problem, customer segment, and identifies angry users',
    triggers: ['vague idea', 'everyone as customer', 'unclear problem'],
    outputs: ['specific segment', 'problem statement', 'anger assessment'],
  },
  assumption_hunter: {
    name: 'Assumption Hunter',
    stage: 2,
    description: 'Identifies risky assumptions and prioritizes what to test first',
    triggers: ['clarified idea ready', 'need to identify risks'],
    outputs: ['assumption list', 'top 3 to test', 'test methods'],
  },
  customer_researcher: {
    name: 'Customer Researcher',
    stage: 3,
    description: 'Generates interview questions and analyzes customer feedback',
    triggers: ['need interview questions', 'have interview data'],
    outputs: ['interview script', 'analysis results', 'validation strength'],
  },
  experiment_designer: {
    name: 'Experiment Designer',
    stage: 4,
    description: 'Designs the cheapest experiment to validate assumptions',
    triggers: ['ready to build', 'need MVP scope', 'validated assumptions'],
    outputs: ['experiment design', 'scope', 'timeline', 'success metrics'],
  },
};

// A2A-style agent card (for discovery)
export const agentCards = Object.entries(agentRegistry).map(([id, meta]) => ({
  agentId: id,
  ...meta,
  capabilities: {
    canDelegate: true,
    canReceive: true,
    protocol: 'a2a',
  },
}));
