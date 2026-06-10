import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const identifyAssumptionsTool = new FunctionTool({
  name: 'identify_risky_assumptions',
  description: `Analyzes a clarified startup idea to identify risky assumptions using
    the Leap-of-Faith framework (Lean Startup) and Analogs/Antilogs/Leaps framework
    (Randy Komisar). Separates what's proven from what needs testing.`,
  parameters: z.object({
    clarifiedIdea: z.string().describe('The clarified idea from previous step'),
    targetCustomer: z.string().describe('Target customer segment'),
    coreProblem: z.string().describe('The core problem being solved'),
    proposedSolution: z.string().optional().describe('The proposed solution'),
  }),
  execute: async ({ clarifiedIdea, targetCustomer, coreProblem, proposedSolution }) => {
    return {
      status: 'ready_for_assumption_analysis',
      input: {
        idea: clarifiedIdea,
        customer: targetCustomer,
        problem: coreProblem,
        solution: proposedSolution || 'Not yet defined',
      },

      // Leap-of-Faith Hypotheses (The Lean Startup)
      leapOfFaithHypotheses: {
        valueHypothesis: {
          question: 'Does this actually help anyone once they use it?',
          format: 'Write as falsifiable prediction with a number',
          example: 'Users who complete onboarding will return 3+ times in the first week',
        },
        growthHypothesis: {
          question: 'How will new customers find this, and will that scale?',
          format: 'Write as falsifiable prediction with a number',
          example: '20% of active users will refer at least 1 new user per month',
        },
        commonHiddenAssumptions: [
          '"Customers will obviously want this once they try it"',
          '"Word of mouth will drive growth"',
          '"The market is huge, so even a small slice is enough"',
          '"Once we onboard them, retention will be high"',
        ],
        rule: 'Underline any sentence that sounds like fact but is really a guess.',
      },

      // Analogs vs Antilogs vs Leaps of Faith (Randy Komisar)
      analogsAntilogsLeaps: {
        analogs: {
          definition: 'Things already proven elsewhere that you can borrow WITHOUT re-testing',
          example: 'Music-on-the-go was proven by Walkman before iPod existed',
          instruction: 'List what\'s already proven by other products/markets',
        },
        antilogs: {
          definition: 'Things proven FALSE that you have to actively work around',
          example: 'People won\'t pay for music downloads — Napster proved this',
          instruction: 'List what\'s been disproven that affects your idea',
        },
        leapsOfFaith: {
          definition: 'What\'s LEFT after subtracting analogs and antilogs — TEST THESE',
          instruction: 'These are your actual assumptions to validate',
          warning: 'Most plans hide leaps of faith inside arguments-by-analogy. Expose them.',
        },
      },

      // The Two Risks (Truth Questions)
      twoRisks: {
        marketRisk: {
          questions: ['Do they want it?', 'Will they pay?', 'Are there enough?'],
          validation: 'Conversations help A LOT',
        },
        productRisk: {
          questions: ['Can you build it?', 'Can you grow it?', 'Will they keep using it?'],
          validation: 'Conversations don\'t help much — you have to build',
        },
        rule: 'Most ideas have both, but in different ratios. Be honest about which dominates.',
      },

      // Multiple Failure Points
      multipleFailurePoints: {
        warning: 'Even if you validate user need, idea can still die from:',
        points: [
          'Budget constraints (customer can\'t pay enough)',
          'Distribution (can\'t reach customers efficiently)',
          'Partner dependencies (need others to cooperate)',
          'Technical feasibility (can\'t actually build it)',
          'Regulatory/legal barriers',
          'Timing (market not ready)',
        ],
        rule: 'Don\'t fixate on one failure point and ignore the others.',
      },

      // Assumption Categories
      assumptionCategories: {
        CUSTOMER: {
          description: 'Assumptions about who the customer is and how to reach them',
          examples: [
            'This specific segment actually exists in meaningful numbers',
            'We can identify and reach these customers',
            'They have budget and authority to purchase',
          ],
        },
        PROBLEM: {
          description: 'Assumptions about problem severity and frequency',
          examples: [
            'This problem is painful enough to seek a solution',
            'The problem occurs frequently enough to matter',
            'Current workarounds are inadequate',
          ],
        },
        SOLUTION: {
          description: 'Assumptions about whether solution solves the problem',
          examples: [
            'Our solution actually solves the core problem',
            'Users can and will adopt this solution',
            'The solution is better than alternatives',
          ],
        },
        BUSINESS_MODEL: {
          description: 'Assumptions about revenue, pricing, sustainability',
          examples: [
            'Customers will pay the proposed price',
            'Unit economics can work at scale',
            'Customer acquisition cost is viable',
          ],
        },
      },

      riskAssessmentCriteria: {
        HIGH: 'If wrong, the entire idea fails. Must test FIRST.',
        MEDIUM: 'If wrong, significant pivot needed. Test after high-risk items.',
        LOW: 'If wrong, minor adjustment needed. Can test later.',
      },

      outputFormat: {
        valueHypothesis: 'Falsifiable prediction with number',
        growthHypothesis: 'Falsifiable prediction with number',
        analogs: 'What\'s already proven (don\'t re-test)',
        antilogs: 'What\'s been disproven (must work around)',
        assumptions: 'Array of {statement, category, riskLevel, whyRisky, howToTest}',
        riskiestAssumption: 'The single most dangerous assumption to test FIRST',
        dominantRisk: 'Market risk or Product risk?',
        otherFailurePoints: 'Non-assumption risks to monitor',
      },
    };
  },
});

export const saveAssumptionsTool = new FunctionTool({
  name: 'save_assumptions',
  description: 'Saves identified assumptions to the database for tracking',
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    valueHypothesis: z.string().describe('The value hypothesis with predicted number'),
    growthHypothesis: z.string().describe('The growth hypothesis with predicted number'),
    assumptions: z.array(z.object({
      statement: z.string(),
      category: z.enum(['CUSTOMER', 'PROBLEM', 'SOLUTION', 'BUSINESS_MODEL']),
      riskLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      howToTest: z.string(),
    })).describe('Array of assumptions to save'),
  }),
  execute: async ({ ventureId, valueHypothesis, growthHypothesis, assumptions }) => {
    const savedAssumptions = assumptions.map((a, index) => ({
      id: `assumption_${Date.now()}_${index}`,
      ventureId,
      ...a,
      validated: false,
      createdAt: new Date().toISOString(),
    }));

    const highRiskCount = assumptions.filter(a => a.riskLevel === 'HIGH').length;

    return {
      status: 'success',
      message: `Saved ${assumptions.length} assumptions (${highRiskCount} high-risk)`,
      data: {
        valueHypothesis,
        growthHypothesis,
        assumptions: savedAssumptions,
      },
      nextStep: highRiskCount > 0
        ? 'Generate interview questions to test the highest-risk assumption first.'
        : 'Assumptions look manageable. Consider scoping an MVP to test them.',
    };
  },
});
