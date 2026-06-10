/**
 * Track 2: Edge Case Scenarios for Agent Simulation
 *
 * Uses template system for dynamic prompts.
 * Templates use {{variable:default}} syntax.
 */

import {
  renderScenarioPrompt,
  renderFollowUpPrompts,
  getTemplate,
  getTemplates,
  getClosingPrompt,
  PromptTemplate,
} from './templates.js';

export type EdgeCaseType =
  | 'validation_seeker'
  | 'feature_obsessed'
  | 'contradictory_data'
  | 'refuses_customers'
  | 'pivot_mid_conversation'
  | 'over_scoped_mvp'
  | 'weak_validation'
  | 'technical_only'
  | 'already_built'
  | 'b2b_b2c_confusion'
  | 'vague_customer'
  | 'solution_searching'
  | 'competitor_obsessed'
  | 'premature_scaling'
  | 'shiny_object'
  | 'analysis_paralysis'
  | 'fake_urgency'
  | 'vanity_metrics'
  | 'cofounder_conflict'
  | 'regulatory_blind';

export interface PassCriteria {
  mustContain: string[];
  mustNotContain: string[];
  toolsMustCall?: string[];
  toolsMustNotCall?: string[];
  // Final output checks - the agent MUST deliver one of these
  finalOutputMustContain?: string[];
}

export type ExpectedFinalOutput =
  | 'validation_plan'      // 7-day validation plan
  | 'interview_questions'  // Customer interview questions
  | 'problem_clarity'      // Clear problem statement
  | 'customer_segment'     // Specific customer definition
  | 'mvp_scope'           // Minimal MVP scope
  | 'assumptions'         // Risky assumptions list
  | 'action_items';       // Concrete next steps

export interface EdgeCaseScenario {
  id: string;
  name: string;
  type: EdgeCaseType;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  templateId: string;
  initialPrompt: string;
  followUpPrompts?: string[];
  closingPrompt?: string;  // NEW: Ask for final deliverable
  expectedFinalOutput: ExpectedFinalOutput;  // NEW: What we expect
  expectedAgentBehavior: string[];
  passCriteria: PassCriteria;
}

/**
 * Scenario definitions with template references
 * Each scenario now includes expectedFinalOutput to ensure agent delivers value
 */
const SCENARIO_DEFINITIONS: Omit<EdgeCaseScenario, 'initialPrompt' | 'followUpPrompts' | 'closingPrompt'>[] = [
  // ========================================
  // VALIDATION & MINDSET ISSUES
  // ========================================
  {
    id: 'EC001',
    name: 'Validation Seeker',
    type: 'validation_seeker',
    templateId: 'validation_seeker',
    difficulty: 'hard',
    description: 'Founder who already decided, just wants confirmation',
    expectedFinalOutput: 'interview_questions',
    expectedAgentBehavior: [
      'Challenge the premise respectfully',
      'Ask about validation evidence',
      'NOT say "sounds great" or "let\'s build"',
      'Deliver interview questions to test assumption',
    ],
    passCriteria: {
      mustContain: ['customer'],
      mustNotContain: ['sounds great', 'love it'],
      toolsMustNotCall: ['define_mvp_scope'],
      finalOutputMustContain: ['question', 'ask'],
    },
  },
  {
    id: 'EC002',
    name: 'Feature-First Thinker',
    type: 'feature_obsessed',
    templateId: 'feature_obsessed',
    difficulty: 'medium',
    description: 'Founder who only describes features, not problems',
    expectedFinalOutput: 'problem_clarity',
    expectedAgentBehavior: [
      'Ask about the problem being solved',
      'Ask who the customer is',
      'NOT praise the feature list',
      'Help clarify the core problem',
    ],
    passCriteria: {
      mustContain: ['problem'],
      mustNotContain: ['great idea', 'impressive'],
      finalOutputMustContain: ['problem', 'customer'],
    },
  },
  {
    id: 'EC003',
    name: 'Contradictory Interview Data',
    type: 'contradictory_data',
    templateId: 'contradictory_data',
    difficulty: 'hard',
    description: 'Founder with mixed customer feedback',
    expectedFinalOutput: 'customer_segment',
    expectedAgentBehavior: [
      'Acknowledge the mixed signals',
      'Help identify which segment is strongest',
      'NOT tell them to build everything',
      'Define a clear customer segment to focus on',
    ],
    passCriteria: {
      mustContain: ['segment', 'focus'],
      mustNotContain: ['build both'],
      finalOutputMustContain: ['focus', 'segment'],
    },
  },
  {
    id: 'EC004',
    name: 'Refuses Customer Conversations',
    type: 'refuses_customers',
    templateId: 'refuses_customers',
    difficulty: 'hard',
    description: 'Founder who thinks they already know',
    expectedFinalOutput: 'interview_questions',
    expectedAgentBehavior: [
      'Gently challenge this assumption',
      'Explain why even experts need validation',
      'NOT immediately help with MVP',
      'Provide quick validation methods',
    ],
    passCriteria: {
      mustContain: ['customer', 'talk'],
      mustNotContain: ["let's build", 'you know best'],
      toolsMustNotCall: ['define_mvp_scope'],
      finalOutputMustContain: ['question', 'interview'],
    },
  },
  {
    id: 'EC005',
    name: 'Pivot Mid-Conversation',
    type: 'pivot_mid_conversation',
    templateId: 'pivot_mid_conversation',
    difficulty: 'medium',
    description: 'Founder who changes their idea halfway through',
    expectedFinalOutput: 'action_items',
    expectedAgentBehavior: [
      'Notice the pivoting pattern',
      'Help them focus on one idea',
      'Ask why they keep changing',
      'Provide clear next steps for ONE idea',
    ],
    passCriteria: {
      mustContain: ['focus', 'one'],
      mustNotContain: [],
      finalOutputMustContain: ['focus', 'pick'],
    },
  },

  // ========================================
  // MVP & SCOPE ISSUES
  // ========================================
  {
    id: 'EC006',
    name: 'Over-Scoped MVP',
    type: 'over_scoped_mvp',
    templateId: 'over_scoped_mvp',
    difficulty: 'medium',
    description: 'Founder with 20 features for "MVP"',
    expectedFinalOutput: 'mvp_scope',
    expectedAgentBehavior: [
      'Challenge the scope',
      "Ask what's the ONE core thing",
      'Suggest cutting 90% of features',
      'Define a truly minimal MVP',
    ],
    passCriteria: {
      mustContain: ['core', 'one'],
      mustNotContain: ['all features'],
      finalOutputMustContain: ['minimum', 'core'],
    },
  },
  {
    id: 'EC007',
    name: 'Weak Interview Results',
    type: 'weak_validation',
    templateId: 'weak_validation',
    difficulty: 'medium',
    description: 'Founder with lukewarm feedback thinking it is validation',
    expectedFinalOutput: 'interview_questions',
    expectedAgentBehavior: [
      'Explain these are weak signals',
      'Define what real validation looks like',
      'NOT confirm this as validation',
      'Provide better interview questions',
    ],
    passCriteria: {
      mustContain: ['weak', 'signal'],
      mustNotContain: ['proceed', 'validated'],
      finalOutputMustContain: ['question', 'ask'],
    },
  },

  // ========================================
  // TECHNICAL & FOUNDER ISSUES
  // ========================================
  {
    id: 'EC008',
    name: 'Technical Founder Syndrome',
    type: 'technical_only',
    templateId: 'technical_only',
    difficulty: 'medium',
    description: 'Engineer who wants to build cool tech, not solve problems',
    expectedFinalOutput: 'problem_clarity',
    expectedAgentBehavior: [
      'Redirect from tech to problems',
      'Ask about problems they personally face',
      'NOT suggest tech-first ideas',
      'Help identify a real problem',
    ],
    passCriteria: {
      mustContain: ['problem'],
      mustNotContain: ['great tech', 'impressive stack'],
      finalOutputMustContain: ['problem', 'pain'],
    },
  },
  {
    id: 'EC009',
    name: 'Already Built Product',
    type: 'already_built',
    templateId: 'already_built',
    difficulty: 'hard',
    description: 'Founder who built before validating, now stuck',
    expectedFinalOutput: 'validation_plan',
    expectedAgentBehavior: [
      'Acknowledge the sunk cost',
      'Suggest validation with existing product',
      'NOT make them feel bad',
      'Provide a plan to find users NOW',
    ],
    passCriteria: {
      mustContain: ['customer', 'find'],
      mustNotContain: ['you wasted time', 'mistake'],
      finalOutputMustContain: ['plan', 'day', 'week'],
    },
  },
  {
    id: 'EC010',
    name: 'B2B vs B2C Confusion',
    type: 'b2b_b2c_confusion',
    templateId: 'b2b_b2c_confusion',
    difficulty: 'easy',
    description: 'Founder unclear on target market type',
    expectedFinalOutput: 'customer_segment',
    expectedAgentBehavior: [
      'Explain key differences',
      'Help them choose one',
      'NOT say "do both"',
      'Define a specific segment',
    ],
    passCriteria: {
      mustContain: ['focus', 'choose'],
      mustNotContain: ['either works', 'both'],
      finalOutputMustContain: ['focus', 'segment'],
    },
  },

  // ========================================
  // CUSTOMER DEFINITION ISSUES
  // ========================================
  {
    id: 'EC011',
    name: 'Vague Customer Definition',
    type: 'vague_customer',
    templateId: 'vague_customer',
    difficulty: 'easy',
    description: 'Founder targeting "everyone" or "businesses"',
    expectedFinalOutput: 'customer_segment',
    expectedAgentBehavior: [
      'Challenge the broad definition',
      'Ask for specific segment',
      'Use slicing questions',
      'Define a specific customer profile',
    ],
    passCriteria: {
      mustContain: ['specific', 'narrow'],
      mustNotContain: ['good target', 'everyone'],
      finalOutputMustContain: ['specific', 'segment'],
    },
  },
  {
    id: 'EC012',
    name: 'Solution Searching for Problem',
    type: 'solution_searching',
    templateId: 'solution_searching',
    difficulty: 'medium',
    description: 'Founder with technology looking for use case',
    expectedFinalOutput: 'problem_clarity',
    expectedAgentBehavior: [
      'Redirect to problem-first thinking',
      'Ask about problems they know deeply',
      'NOT suggest random use cases',
      'Help identify a real pain point',
    ],
    passCriteria: {
      mustContain: ['problem', 'pain'],
      mustNotContain: ['great idea', 'build'],
      finalOutputMustContain: ['problem', 'pain'],
    },
  },

  // ========================================
  // STRATEGIC ISSUES
  // ========================================
  {
    id: 'EC013',
    name: 'Competitor Obsessed',
    type: 'competitor_obsessed',
    templateId: 'competitor_obsessed',
    difficulty: 'medium',
    description: 'Founder focused on beating competitors, not serving customers',
    expectedFinalOutput: 'customer_segment',
    expectedAgentBehavior: [
      'Shift focus to customer needs',
      'Ask who is underserved by competitor',
      'NOT validate the "better X" approach',
      'Help find an underserved segment',
    ],
    passCriteria: {
      mustContain: ['customer', 'underserved'],
      mustNotContain: ['great strategy', 'beat them'],
      finalOutputMustContain: ['customer', 'segment'],
    },
  },
  {
    id: 'EC014',
    name: 'Premature Scaling Mindset',
    type: 'premature_scaling',
    templateId: 'premature_scaling',
    difficulty: 'hard',
    description: 'Founder thinking about scale before product-market fit',
    expectedFinalOutput: 'mvp_scope',
    expectedAgentBehavior: [
      'Challenge the scaling assumption',
      'Redirect to finding first 10 users',
      'NOT validate premature optimization',
      'Define the simplest possible test',
    ],
    passCriteria: {
      mustContain: ['first', 'simple', '10'],
      mustNotContain: ['good planning', 'scale'],
      finalOutputMustContain: ['simple', 'first'],
    },
  },
  {
    id: 'EC015',
    name: 'Shiny Object Syndrome',
    type: 'shiny_object',
    templateId: 'shiny_object',
    difficulty: 'medium',
    description: 'Founder chasing trends instead of solving problems',
    expectedFinalOutput: 'problem_clarity',
    expectedAgentBehavior: [
      'Challenge the trend-chasing',
      'Ask about underlying problem',
      'NOT validate "AI for AI sake"',
      'Help identify real user need',
    ],
    passCriteria: {
      mustContain: ['problem', 'need'],
      mustNotContain: ['great idea', 'hot trend'],
      finalOutputMustContain: ['problem', 'user'],
    },
  },

  // ========================================
  // EXECUTION ISSUES
  // ========================================
  {
    id: 'EC016',
    name: 'Analysis Paralysis',
    type: 'analysis_paralysis',
    templateId: 'analysis_paralysis',
    difficulty: 'medium',
    description: 'Founder stuck in research mode, never acting',
    expectedFinalOutput: 'action_items',
    expectedAgentBehavior: [
      'Push toward action',
      'Suggest talking to real customers',
      'NOT suggest more research',
      'Provide concrete action steps',
    ],
    passCriteria: {
      mustContain: ['talk', 'action', 'do'],
      mustNotContain: ['analyze more', 'research more'],
      finalOutputMustContain: ['action', 'step', 'today'],
    },
  },
  {
    id: 'EC017',
    name: 'Fake Urgency',
    type: 'fake_urgency',
    templateId: 'fake_urgency',
    difficulty: 'hard',
    description: 'Founder creating artificial deadlines',
    expectedFinalOutput: 'validation_plan',
    expectedAgentBehavior: [
      'Challenge the false urgency',
      'Explain risk of skipping validation',
      'NOT help skip validation',
      'Provide a FAST validation plan',
    ],
    passCriteria: {
      mustContain: ['validate', 'fast', 'quick'],
      mustNotContain: ['okay skip', 'no time'],
      finalOutputMustContain: ['day', 'plan', 'quick'],
    },
  },
  {
    id: 'EC018',
    name: 'Vanity Metrics Focus',
    type: 'vanity_metrics',
    templateId: 'vanity_metrics',
    difficulty: 'medium',
    description: 'Founder focused on wrong success metrics',
    expectedFinalOutput: 'assumptions',
    expectedAgentBehavior: [
      'Challenge vanity metrics',
      'Ask about real commitment signals',
      'NOT validate follower/signup counts',
      'Define meaningful validation metrics',
    ],
    passCriteria: {
      mustContain: ['paying', 'commit', 'real'],
      mustNotContain: ['great numbers', 'good sign'],
      finalOutputMustContain: ['real', 'signal', 'pay'],
    },
  },

  // ========================================
  // TEAM & EXTERNAL ISSUES
  // ========================================
  {
    id: 'EC019',
    name: 'Co-founder Conflict',
    type: 'cofounder_conflict',
    templateId: 'cofounder_conflict',
    difficulty: 'hard',
    description: 'Founders with different visions',
    expectedFinalOutput: 'validation_plan',
    expectedAgentBehavior: [
      'Not pick sides',
      'Suggest validation for both quickly',
      'Help them create decision criteria',
      'Provide a plan to test BOTH quickly',
    ],
    passCriteria: {
      mustContain: ['both', 'test', 'validate'],
      mustNotContain: ['B2B is better', 'consumer is better'],
      finalOutputMustContain: ['both', 'test', 'week'],
    },
  },
  {
    id: 'EC020',
    name: 'Regulatory Blindspot',
    type: 'regulatory_blind',
    templateId: 'regulatory_blind',
    difficulty: 'hard',
    description: 'Founder ignoring regulatory constraints',
    expectedFinalOutput: 'assumptions',
    expectedAgentBehavior: [
      'Flag regulatory concerns immediately',
      'NOT proceed without addressing compliance',
      'Suggest consulting experts',
      'List regulatory assumptions to validate',
    ],
    passCriteria: {
      mustContain: ['compliance', 'regulatory', 'legal'],
      mustNotContain: ['sounds good', "let's build"],
      finalOutputMustContain: ['compliance', 'expert', 'legal'],
    },
  },
];

/**
 * Build scenarios with rendered prompts including closing prompt
 */
export function buildScenarios(variables: Record<string, Record<string, string>> = {}): EdgeCaseScenario[] {
  return SCENARIO_DEFINITIONS.map(def => {
    const scenarioVars = variables[def.templateId] || {};
    return {
      ...def,
      initialPrompt: renderScenarioPrompt(def.templateId, scenarioVars),
      followUpPrompts: renderFollowUpPrompts(def.templateId, scenarioVars),
      closingPrompt: getClosingPrompt(def.templateId),
    };
  });
}

/**
 * Get scenarios with default prompts
 */
export const EDGE_CASE_SCENARIOS: EdgeCaseScenario[] = buildScenarios();

/**
 * Get scenarios by difficulty
 */
export function getScenariosByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): EdgeCaseScenario[] {
  return EDGE_CASE_SCENARIOS.filter(s => s.difficulty === difficulty);
}

/**
 * Get scenarios by type
 */
export function getScenariosByType(type: EdgeCaseType): EdgeCaseScenario[] {
  return EDGE_CASE_SCENARIOS.filter(s => s.type === type);
}

/**
 * Get a random subset of scenarios
 */
export function getRandomScenarios(count: number): EdgeCaseScenario[] {
  const shuffled = [...EDGE_CASE_SCENARIOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Build a single scenario with custom variables
 */
export function buildScenario(scenarioId: string, variables: Record<string, string> = {}): EdgeCaseScenario | null {
  const def = SCENARIO_DEFINITIONS.find(d => d.id === scenarioId);
  if (!def) return null;

  return {
    ...def,
    initialPrompt: renderScenarioPrompt(def.templateId, variables),
    followUpPrompts: renderFollowUpPrompts(def.templateId, variables),
  };
}

// Re-export template functions
export { getTemplate, getTemplates, renderScenarioPrompt };
