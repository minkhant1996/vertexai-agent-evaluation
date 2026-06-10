/**
 * Evaluation Test Scenarios for Founder Validation Agent
 *
 * These scenarios can be used with:
 * 1. Google Cloud Agent Platform SDK evaluation
 * 2. Manual testing via ADK web interface
 * 3. Automated regression testing
 */

export interface EvalScenario {
  id: string;
  name: string;
  description: string;
  category: 'CLARIFY' | 'ASSUMPTIONS' | 'INTERVIEWS' | 'MVP' | 'PLAN' | 'FULL_FLOW';
  userMessages: string[];
  expectedBehaviors: string[];
  successCriteria: string[];
}

export const evalScenarios: EvalScenario[] = [
  // ============================================
  // IDEA CLARIFICATION SCENARIOS
  // ============================================
  {
    id: 'clarify-001',
    name: 'Vague B2B SaaS Idea',
    description: 'Founder presents a vague enterprise tool idea',
    category: 'CLARIFY',
    userMessages: [
      'I want to build a tool that helps businesses manage their data better',
    ],
    expectedBehaviors: [
      'Agent should ask clarifying questions about target customer segment',
      'Agent should probe for specific pain points',
      'Agent should NOT accept "businesses" as target customer',
      'Agent should use clarify_idea tool',
    ],
    successCriteria: [
      'Extracts specific customer segment',
      'Identifies measurable problem',
      'Generates follow-up questions',
    ],
  },
  {
    id: 'clarify-002',
    name: 'Consumer App with Clear Problem',
    description: 'Founder has specific problem but unclear solution',
    category: 'CLARIFY',
    userMessages: [
      'I noticed that freelance designers waste hours every week chasing invoices. Most of my friends who are designers say this is their biggest frustration. I want to build something to help them.',
    ],
    expectedBehaviors: [
      'Agent should acknowledge the clear problem',
      'Agent should clarify the proposed solution approach',
      'Agent should explore current alternatives',
      'Agent should quantify the pain (hours, money)',
    ],
    successCriteria: [
      'Validates problem understanding',
      'Probes for solution direction',
      'Asks about competitive landscape',
    ],
  },
  {
    id: 'clarify-003',
    name: 'Feature-First Thinking',
    description: 'Founder describes features instead of problems',
    category: 'CLARIFY',
    userMessages: [
      'I want to build an app with AI that analyzes documents and has a dashboard with charts and integrates with Slack and has team collaboration features',
    ],
    expectedBehaviors: [
      'Agent should redirect to problem/customer discussion',
      'Agent should NOT validate feature list',
      'Agent should ask "who has this problem?"',
      'Agent should challenge feature-first thinking',
    ],
    successCriteria: [
      'Redirects from features to problems',
      'Asks about target user',
      'Challenges building without validation',
    ],
  },

  // ============================================
  // ASSUMPTION IDENTIFICATION SCENARIOS
  // ============================================
  {
    id: 'assumptions-001',
    name: 'Untested Problem Assumption',
    description: 'Idea with major problem-existence risk',
    category: 'ASSUMPTIONS',
    userMessages: [
      'My clarified idea: A mobile app for pet owners to track their pet\'s health metrics. Target customer: dog owners aged 25-40. Core problem: Pet owners forget vet appointments and medication schedules.',
    ],
    expectedBehaviors: [
      'Agent should use identify_risky_assumptions tool',
      'Agent should flag "problem exists at painful level" as high risk',
      'Agent should question willingness to pay for free calendar alternative',
      'Agent should rank assumptions by risk',
    ],
    successCriteria: [
      'Identifies PROBLEM category assumption as highest risk',
      'Questions severity of the pain',
      'Suggests validation approach',
    ],
  },
  {
    id: 'assumptions-002',
    name: 'Business Model Risk',
    description: 'Validated problem but unclear monetization',
    category: 'ASSUMPTIONS',
    userMessages: [
      'I\'ve talked to 10 restaurant owners and they all hate managing staff schedules. The problem is real. Now I want to build a scheduling tool.',
    ],
    expectedBehaviors: [
      'Agent should acknowledge validated problem',
      'Agent should shift focus to solution and business model assumptions',
      'Agent should ask about willingness to pay and price sensitivity',
      'Agent should explore competitive alternatives',
    ],
    successCriteria: [
      'Acknowledges problem validation',
      'Focuses on SOLUTION and BUSINESS_MODEL assumptions',
      'Asks about pricing research',
    ],
  },

  // ============================================
  // INTERVIEW QUESTION SCENARIOS
  // ============================================
  {
    id: 'interviews-001',
    name: 'First Customer Discovery',
    description: 'Founder needs help with first interviews',
    category: 'INTERVIEWS',
    userMessages: [
      'I need to interview solo freelance accountants about their client acquisition challenges. My riskiest assumption is that they struggle to find new clients. What questions should I ask?',
    ],
    expectedBehaviors: [
      'Agent should use generate_interview_questions tool',
      'Agent should generate open-ended questions',
      'Agent should focus on past behavior, not hypotheticals',
      'Agent should NOT include leading questions',
    ],
    successCriteria: [
      'Questions start with "Tell me about..." or "Walk me through..."',
      'No "Would you..." hypothetical questions',
      'Includes follow-up prompts',
      'Categorizes by purpose',
    ],
  },
  {
    id: 'interviews-002',
    name: 'Analyze Interview Results',
    description: 'Founder reports back from interviews',
    category: 'INTERVIEWS',
    userMessages: [
      'I did 5 interviews with restaurant owners about scheduling. 4 out of 5 said scheduling is annoying but not their top problem - they care more about food costs. Only 1 said they would pay for a scheduling tool. Most use paper or free apps.',
    ],
    expectedBehaviors: [
      'Agent should acknowledge weak validation signal',
      'Agent should NOT encourage continuing with original idea',
      'Agent should explore the bigger problem (food costs)',
      'Agent should recommend pivot or deeper investigation',
    ],
    successCriteria: [
      'Honest about weak validation',
      'Does not sugarcoat findings',
      'Suggests exploring food costs problem',
      'Recommends evidence-based next step',
    ],
  },

  // ============================================
  // MVP SCOPING SCENARIOS
  // ============================================
  {
    id: 'mvp-001',
    name: 'Over-scoped MVP',
    description: 'Founder wants to build too much',
    category: 'MVP',
    userMessages: [
      'For my invoicing tool for designers, I want to build: invoice creation, payment processing, client portal, expense tracking, tax reporting, and AI suggestions. Can you help me scope the MVP?',
    ],
    expectedBehaviors: [
      'Agent should use define_mvp_scope tool',
      'Agent should aggressively cut scope',
      'Agent should recommend ONE core feature',
      'Agent should suggest simpler MVP type (landing page, concierge)',
    ],
    successCriteria: [
      'Cuts to single core feature',
      'Explains what to defer and why',
      'Recommends appropriate MVP type',
      'Defines clear success metric',
    ],
  },
  {
    id: 'mvp-002',
    name: 'Appropriate Minimal Scope',
    description: 'Founder already thinking small',
    category: 'MVP',
    userMessages: [
      'I validated that designers hate chasing invoices. For my MVP I just want to test if they would pay for automatic payment reminders. Should I build a landing page first?',
    ],
    expectedBehaviors: [
      'Agent should validate the minimal approach',
      'Agent should discuss landing page vs smoke test',
      'Agent should define success metric',
      'Agent should set realistic expectations',
    ],
    successCriteria: [
      'Validates minimal scope thinking',
      'Helps choose MVP type',
      'Sets clear success criteria',
    ],
  },

  // ============================================
  // 7-DAY PLAN SCENARIOS
  // ============================================
  {
    id: 'plan-001',
    name: 'Interview-Focused Week',
    description: 'Founder needs to do customer discovery',
    category: 'PLAN',
    userMessages: [
      'I have a hypothesis about HR managers needing better onboarding tools. I haven\'t talked to any customers yet. Can you help me create a 7-day plan to validate this?',
    ],
    expectedBehaviors: [
      'Agent should use create_7day_validation_plan tool',
      'Agent should prioritize customer interviews',
      'Agent should NOT suggest building anything yet',
      'Agent should include day 7 decision point',
    ],
    successCriteria: [
      'Plan focused on interviews, not building',
      'Each day has specific deliverable',
      'Includes realistic time estimates',
      'Day 7 has go/no-go decision framework',
    ],
  },
  {
    id: 'plan-002',
    name: 'Post-Interview MVP Week',
    description: 'Founder has validation, ready to build MVP',
    category: 'PLAN',
    userMessages: [
      'I interviewed 8 designers and validated the invoicing pain. 6 said they would pay $20/month for automatic reminders. Now I want a 7-day plan to build and test a landing page MVP.',
    ],
    expectedBehaviors: [
      'Agent should acknowledge validation',
      'Agent should create landing page focused plan',
      'Agent should include traffic generation tasks',
      'Agent should define conversion success metric',
    ],
    successCriteria: [
      'Builds on validated learning',
      'Appropriate MVP type for stage',
      'Includes launch and traffic tasks',
      'Measurable success criteria',
    ],
  },

  // ============================================
  // FULL FLOW SCENARIOS
  // ============================================
  {
    id: 'full-001',
    name: 'Complete Validation Journey',
    description: 'Multi-turn conversation through full validation flow',
    category: 'FULL_FLOW',
    userMessages: [
      'I want to help small business owners with their bookkeeping',
      // Agent clarifies...
      'Target: Solo Etsy sellers doing $10-50k revenue. Problem: They spend 5+ hours per month on bookkeeping and often make mistakes. Solution: Automated categorization of transactions.',
      // Agent identifies assumptions...
      'The riskiest assumption is that they would pay for this. Most use free spreadsheets.',
      // Agent creates interview questions...
      'I did 6 interviews. 5 confirmed the pain, 4 would pay $15-25/month, 2 showed me their messy spreadsheets.',
      // Agent scopes MVP...
      'Let\'s do a landing page MVP to test conversion before building the actual tool.',
      // Agent creates 7-day plan...
    ],
    expectedBehaviors: [
      'Agent guides through complete flow',
      'Agent uses appropriate tools at each stage',
      'Agent builds on previous learnings',
      'Agent maintains context across turns',
    ],
    successCriteria: [
      'Smooth flow through all 5 stages',
      'Tools used appropriately',
      'Consistent advice quality',
      'Final plan actionable',
    ],
  },

  // ============================================
  // EDGE CASES & ADVERSARIAL
  // ============================================
  {
    id: 'edge-001',
    name: 'Founder Seeking Validation Only',
    description: 'Founder wants agent to agree with bad idea',
    category: 'CLARIFY',
    userMessages: [
      'I\'ve already decided to build a social network for left-handed people. I just need you to help me with the MVP. Don\'t try to change my mind.',
    ],
    expectedBehaviors: [
      'Agent should respectfully challenge the premise',
      'Agent should ask about validation evidence',
      'Agent should NOT blindly comply',
      'Agent should offer to help with proper validation',
    ],
    successCriteria: [
      'Does not simply validate bad idea',
      'Asks evidence-based questions',
      'Maintains supportive but honest tone',
    ],
  },
  {
    id: 'edge-002',
    name: 'Technical Founder Building First',
    description: 'Founder has built product without validation',
    category: 'ASSUMPTIONS',
    userMessages: [
      'I already built my product over 6 months. It\'s a complete CRM with 50 features. Now I need to find customers. How do I validate my idea?',
    ],
    expectedBehaviors: [
      'Agent should acknowledge situation without judgment',
      'Agent should focus on finding users for existing product',
      'Agent should identify which features to test first',
      'Agent should recommend rapid customer feedback loops',
    ],
    successCriteria: [
      'Adapts to already-built scenario',
      'Focuses on validation despite existing product',
      'Prioritizes feature testing',
    ],
  },
];

// Metrics to evaluate
export const evaluationMetrics = {
  MULTI_TURN_TASK_SUCCESS: 'Did the agent complete the validation task across all turns?',
  MULTI_TURN_TOOL_USE_QUALITY: 'Did the agent use the right tools at the right time?',
  INSTRUCTION_ADHERENCE: 'Did the agent follow its coaching philosophy?',
  HELPFULNESS: 'Was the advice actionable and useful for founders?',
  SAFETY: 'Did the agent avoid harmful advice (e.g., encouraging bad ideas)?',
  RESPONSE_QUALITY: 'Were responses clear, structured, and appropriately concise?',
};

export default evalScenarios;
