import { z } from 'zod';

// Founder and Venture schemas
export const FounderSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  background: z.string().optional(),
});

export const VentureSchema = z.object({
  id: z.string(),
  founderId: z.string(),
  name: z.string(),
  ideaDescription: z.string(),
  targetCustomer: z.string().optional(),
  problemStatement: z.string().optional(),
  currentStage: z.enum(['IDEA', 'VALIDATION', 'MVP', 'LAUNCHED']).default('IDEA'),
  createdAt: z.date(),
});

export const AssumptionSchema = z.object({
  id: z.string(),
  ventureId: z.string(),
  statement: z.string(),
  category: z.enum(['CUSTOMER', 'PROBLEM', 'SOLUTION', 'BUSINESS_MODEL']),
  riskLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  validated: z.boolean().default(false),
  evidence: z.string().optional(),
});

export const InterviewQuestionSchema = z.object({
  id: z.string(),
  ventureId: z.string(),
  question: z.string(),
  category: z.enum(['PROBLEM_DISCOVERY', 'SOLUTION_FIT', 'WILLINGNESS_TO_PAY', 'ALTERNATIVES']),
  priority: z.number().min(1).max(5),
});

export const MVPScopeSchema = z.object({
  id: z.string(),
  ventureId: z.string(),
  coreFeature: z.string(),
  outOfScope: z.array(z.string()),
  successMetric: z.string(),
  timeboxDays: z.number().default(7),
});

export const ValidationPlanSchema = z.object({
  id: z.string(),
  ventureId: z.string(),
  weekNumber: z.number().default(1),
  primaryGoal: z.string(),
  tasks: z.array(z.object({
    day: z.number().min(1).max(7),
    task: z.string(),
    deliverable: z.string(),
  })),
  successCriteria: z.string(),
});

export const EvidenceSchema = z.object({
  id: z.string(),
  assumptionId: z.string(),
  type: z.enum(['INTERVIEW', 'SURVEY', 'OBSERVATION', 'DATA', 'EXPERIMENT']),
  description: z.string(),
  supports: z.boolean(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  source: z.string(),
  collectedAt: z.date(),
});

// Input/Output types for tools
export const ClarifyIdeaInputSchema = z.object({
  ideaDescription: z.string().describe('Raw startup idea from founder'),
  targetCustomer: z.string().optional().describe('Who the founder thinks the customer is'),
  founderBackground: z.string().optional().describe('Founder background for context'),
});

export const ClarifyIdeaOutputSchema = z.object({
  clarifiedIdea: z.string(),
  targetCustomerSegment: z.string(),
  coreProblem: z.string(),
  proposedSolution: z.string(),
  uniqueValue: z.string(),
  clarifyingQuestions: z.array(z.string()),
});

export const IdentifyAssumptionsInputSchema = z.object({
  clarifiedIdea: z.string().describe('The clarified idea from previous step'),
  targetCustomer: z.string().describe('Target customer segment'),
  coreProblem: z.string().describe('The core problem being solved'),
});

export const IdentifyAssumptionsOutputSchema = z.object({
  assumptions: z.array(z.object({
    statement: z.string(),
    category: z.enum(['CUSTOMER', 'PROBLEM', 'SOLUTION', 'BUSINESS_MODEL']),
    riskLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    whyRisky: z.string(),
    howToTest: z.string(),
  })),
  riskiestAssumption: z.string(),
  recommendedTestOrder: z.array(z.string()),
});

export const GenerateInterviewQuestionsInputSchema = z.object({
  targetCustomer: z.string().describe('Who to interview'),
  coreProblem: z.string().describe('Problem to explore'),
  assumptions: z.array(z.string()).describe('Assumptions to validate'),
});

export const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    category: z.enum(['PROBLEM_DISCOVERY', 'SOLUTION_FIT', 'WILLINGNESS_TO_PAY', 'ALTERNATIVES']),
    priority: z.number().min(1).max(5),
    whatItValidates: z.string(),
    followUpPrompts: z.array(z.string()),
  })),
  interviewTips: z.array(z.string()),
  redFlags: z.array(z.string()),
});

export const DefineMVPInputSchema = z.object({
  clarifiedIdea: z.string(),
  validatedAssumptions: z.array(z.string()).optional(),
  targetCustomer: z.string(),
  coreProblem: z.string(),
});

export const DefineMVPOutputSchema = z.object({
  coreFeature: z.string(),
  whyThisFeature: z.string(),
  outOfScope: z.array(z.object({
    feature: z.string(),
    whyDeferred: z.string(),
  })),
  successMetric: z.string(),
  mvpType: z.enum(['LANDING_PAGE', 'PROTOTYPE', 'CONCIERGE', 'WIZARD_OF_OZ', 'SMOKE_TEST']),
  buildEstimate: z.string(),
});

export const Create7DayPlanInputSchema = z.object({
  ventureId: z.string(),
  primaryGoal: z.string().describe('Main validation goal for the week'),
  riskiestAssumption: z.string(),
  interviewQuestions: z.array(z.string()),
  mvpScope: z.string().optional(),
});

export const Create7DayPlanOutputSchema = z.object({
  weeklyGoal: z.string(),
  dailyTasks: z.array(z.object({
    day: z.number(),
    dayName: z.string(),
    task: z.string(),
    timeEstimate: z.string(),
    deliverable: z.string(),
    tips: z.string(),
  })),
  successCriteria: z.string(),
  potentialBlockers: z.array(z.string()),
  weekEndReview: z.array(z.string()),
});

// Type exports
export type Founder = z.infer<typeof FounderSchema>;
export type Venture = z.infer<typeof VentureSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
export type MVPScope = z.infer<typeof MVPScopeSchema>;
export type ValidationPlan = z.infer<typeof ValidationPlanSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

export type ClarifyIdeaInput = z.infer<typeof ClarifyIdeaInputSchema>;
export type ClarifyIdeaOutput = z.infer<typeof ClarifyIdeaOutputSchema>;
export type IdentifyAssumptionsInput = z.infer<typeof IdentifyAssumptionsInputSchema>;
export type IdentifyAssumptionsOutput = z.infer<typeof IdentifyAssumptionsOutputSchema>;
export type GenerateInterviewQuestionsInput = z.infer<typeof GenerateInterviewQuestionsInputSchema>;
export type GenerateInterviewQuestionsOutput = z.infer<typeof GenerateInterviewQuestionsOutputSchema>;
export type DefineMVPInput = z.infer<typeof DefineMVPInputSchema>;
export type DefineMVPOutput = z.infer<typeof DefineMVPOutputSchema>;
export type Create7DayPlanInput = z.infer<typeof Create7DayPlanInputSchema>;
export type Create7DayPlanOutput = z.infer<typeof Create7DayPlanOutputSchema>;
