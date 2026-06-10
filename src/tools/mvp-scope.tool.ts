import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const defineMVPTool = new FunctionTool({
  name: 'define_mvp_scope',
  description: `Defines the smallest possible MVP using Lean Product Playbook methodology.
    Includes INVEST framework for user stories, Kano model for feature classification,
    and MVP type selection (landing page, concierge, wizard of oz, etc.).`,
  parameters: z.object({
    clarifiedIdea: z.string().describe('The clarified startup idea'),
    riskiestAssumption: z.string().describe('The main assumption to test'),
    targetCustomer: z.string().describe('Target customer segment'),
    coreProblem: z.string().describe('Core problem being solved'),
    validatedInsights: z.array(z.string()).optional().describe('Any insights already validated'),
  }),
  execute: async ({ clarifiedIdea, riskiestAssumption, targetCustomer, coreProblem, validatedInsights }) => {
    return {
      status: 'ready_for_mvp_definition',
      input: {
        idea: clarifiedIdea,
        mainAssumption: riskiestAssumption,
        customer: targetCustomer,
        problem: coreProblem,
        priorLearnings: validatedInsights || [],
      },

      // What an MVP Actually Is (Lean Product Playbook)
      mvpDefinition: {
        definition: 'The MINIMUM functionality your target customer considers VIABLE. Enough to be valuable.',
        notMvp: [
          'A watered-down version of the real thing',
          'A buggy preview',
          'A feature-incomplete prototype',
        ],
        actualMvp: 'A FOCUSED product that addresses a narrow set of needs but is FUNCTIONAL, RELIABLE, USABLE in what it covers.',
        pyramid: {
          top: 'Delightful ← ideally',
          middle1: 'Usable ← required',
          middle2: 'Reliable ← required',
          bottom: 'Functional ← narrowed (this is what "minimum" means)',
        },
        rule: 'Trying to launch buggy/partial just teaches you customers don\'t like buggy products.',
      },

      // INVEST Framework for User Stories
      investFramework: {
        description: 'Good user stories are INVEST',
        criteria: {
          I: 'Independent — minimal overlap, implementable in any order',
          N: 'Negotiable — open for discussion on details',
          V: 'Valuable — to the customer',
          E: 'Estimable — scope can be reasonably guessed',
          S: 'Small — break large stories down',
          T: 'Testable — clear acceptance criteria',
        },
        template: 'As a [type of user], I want to [do something], so that I can [desired benefit].',
      },

      // Kano Model for Feature Classification
      kanoModel: {
        mustHave: {
          description: 'Basic expectations. Absence causes dissatisfaction. Presence doesn\'t delight.',
          rule: 'ALL must-haves must be in v1. You can\'t compete without them.',
          examples: ['Basic functionality works', 'Doesn\'t crash', 'Data doesn\'t get lost'],
        },
        performanceBenefit: {
          description: 'More is better. Directly correlated to satisfaction.',
          rule: 'Cover the TOP performance differentiator — enough that customers see how you\'re better.',
          examples: ['Speed', 'Accuracy', 'Capacity', 'Price'],
        },
        delighter: {
          description: 'Unexpected features that create outsized satisfaction.',
          rule: 'Include at least ONE delighter in v1, unless performance lead is enormous.',
          examples: ['Surprisingly easy onboarding', 'Unexpected helpful feature', 'Beautiful design touch'],
        },
      },

      // MVP Scoping Process
      scopingProcess: {
        step1: {
          name: 'Brainstorm broadly',
          action: 'For each benefit in value prop, brainstorm 3-5 feature ideas. No judging.',
        },
        step2: {
          name: 'Write as user stories',
          action: 'Use INVEST format. Make them small enough to estimate.',
        },
        step3: {
          name: 'Chunk features down',
          action: 'Break into smaller "feature chunks". Don\'t operate on whole features.',
          example: 'Photo-share → Facebook share, Twitter share, email share, copy link. Probably don\'t need all in v1.',
        },
        step4: {
          name: 'Estimate value vs effort',
          action: 'Score customer value (1-10) and dev effort. ROI = value / effort.',
        },
        step5: {
          name: 'Prioritize by ROI',
          action: 'High value + low effort = top priority. Low value + high effort = kill or shelve.',
        },
        step6: {
          name: 'Decide MVP candidate',
          action: 'Must-haves + top differentiator + one delighter. Cut everything else.',
        },
      },

      // MVP Test Types
      mvpTypes: {
        LANDING_PAGE: {
          description: 'A page explaining value prop with signup/waitlist',
          bestFor: 'Testing demand and messaging BEFORE building anything',
          timeToLaunch: '1-2 days',
          successMetrics: ['Signup conversion rate', 'Email open rates', 'Waitlist size'],
          example: 'Buffer\'s two-page test validated demand before any code',
        },
        SMOKE_TEST: {
          description: 'Advertise a product that doesn\'t exist yet, measure interest',
          bestFor: 'Testing willingness to pay BEFORE building',
          timeToLaunch: '1-3 days',
          successMetrics: ['Click-through rate', 'Add to cart rate', 'Payment attempts'],
        },
        CONCIERGE: {
          description: 'Manually deliver the service to a few customers',
          bestFor: 'Understanding full customer journey deeply',
          timeToLaunch: '1-3 days to start',
          successMetrics: ['Customer satisfaction', 'Repeat usage', 'Referrals'],
          example: 'Airbnb manually scheduled photographers. Bookings doubled/tripled.',
        },
        WIZARD_OF_OZ: {
          description: 'Looks automated to user, but human-powered behind scenes',
          bestFor: 'Testing complex solutions without building them',
          timeToLaunch: '3-7 days',
          successMetrics: ['Task completion rate', 'User retention', 'Time savings'],
        },
        PROTOTYPE: {
          description: 'Functional but minimal version of core feature',
          bestFor: 'When you MUST prove technical feasibility',
          timeToLaunch: '5-14 days',
          successMetrics: ['Feature usage', 'Task completion', 'User feedback'],
        },
      },

      // What to Include vs Exclude
      scopingGuidelines: {
        include: [
          'The ONE feature that directly tests the riskiest assumption',
          'Minimum needed for user to experience core value',
          'Basic onboarding to reduce friction',
          'Way to collect feedback (even just email)',
        ],
        exclude: [
          'User accounts/authentication (use magic links or none)',
          'Payment processing (validate value before charging)',
          'Multiple features (one feature only)',
          'Polish/design perfection (ugly but functional is fine)',
          'Scale considerations (serve 10 users, not 10,000)',
          'Features that don\'t map to a value-prop benefit',
        ],
      },

      // Stage 2 Pitfalls
      pitfalls: [
        'Letting "minimum" mean "shoddy" — reliability/usability are NOT optional',
        'Trying to build full value prop in v1 — Swiss-Army-knife syndrome',
        'Big batch sizes — long stretches of building without testing',
        'Skipping MVP test type decision — coding when smoke test would teach same thing for 1/10th effort',
        'Including features that don\'t map to a value-prop benefit',
        'Planning more than 1-2 versions ahead — you\'ll throw it out after first wave of testing',
      ],

      // Earlyvangelist Selection
      earlyvangelists: {
        description: 'The customers who should get your MVP first',
        characteristics: [
          'Have the problem',
          'Know they have it',
          'Have budget to solve it',
          'Have already cobbled together a makeshift solution',
          'B2B: recognize "THIS IS THE WORST PART OF MY LIFE" intensity',
        ],
        rule: 'If someone doesn\'t meet all 5, they\'re not an earlyvangelist.',
      },

      outputFormat: {
        coreFeature: 'The ONE thing this MVP does',
        whyThisFeature: 'How it tests the riskiest assumption',
        userStory: 'INVEST-compliant user story',
        kanoClassification: 'Must-have + differentiator + delighter identified',
        outOfScope: 'Array of features explicitly NOT included and why',
        successMetric: 'Single metric that defines success (with target number)',
        mvpType: 'Recommended MVP approach',
        buildEstimate: 'Realistic time to launch',
        earlyvangelistCriteria: 'How to identify first users',
      },
    };
  },
});

export const saveMVPScopeTool = new FunctionTool({
  name: 'save_mvp_scope',
  description: 'Saves the defined MVP scope for the venture',
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    coreFeature: z.string().describe('The single core feature'),
    userStory: z.string().describe('INVEST-compliant user story'),
    outOfScope: z.array(z.string()).describe('Features explicitly excluded'),
    successMetric: z.string().describe('Primary success metric with target'),
    mvpType: z.enum(['LANDING_PAGE', 'SMOKE_TEST', 'CONCIERGE', 'WIZARD_OF_OZ', 'PROTOTYPE'])
      .describe('Type of MVP'),
    buildEstimate: z.string().describe('Time estimate to build'),
  }),
  execute: async ({ ventureId, coreFeature, userStory, outOfScope, successMetric, mvpType, buildEstimate }) => {
    const mvpId = `mvp_${Date.now()}`;

    return {
      status: 'success',
      mvpId,
      message: 'MVP scope saved successfully',
      data: {
        id: mvpId,
        ventureId,
        coreFeature,
        userStory,
        outOfScope,
        successMetric,
        mvpType,
        buildEstimate,
        timeboxDays: 7,
        createdAt: new Date().toISOString(),
      },
      nextStep: 'Create a 7-day validation plan to build and test this MVP.',
      warnings: outOfScope.length < 3
        ? ['Consider if there are more features to explicitly exclude. Scope creep is the enemy.']
        : [],
    };
  },
});
