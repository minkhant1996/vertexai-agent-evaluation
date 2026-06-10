import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const generateInterviewQuestionsTool = new FunctionTool({
  name: 'generate_interview_questions',
  description: `Creates customer interview questions using Truth Questions rules and YC's
    6 core questions. Questions focus on past behavior, not hypotheticals. Includes
    guidance on what NOT to ask and how to dig into feature requests.`,
  parameters: z.object({
    targetCustomer: z.string().describe('Who to interview'),
    coreProblem: z.string().describe('The problem to explore'),
    assumptions: z.array(z.string()).describe('Key assumptions to validate through interviews'),
    interviewType: z.enum(['PROBLEM_DISCOVERY', 'SOLUTION_VALIDATION', 'PRICING_RESEARCH']).optional()
      .describe('Focus of the interview'),
  }),
  execute: async ({ targetCustomer, coreProblem, assumptions, interviewType }) => {
    return {
      status: 'ready_for_question_generation',
      input: {
        customer: targetCustomer,
        problem: coreProblem,
        assumptionsToValidate: assumptions,
        focusArea: interviewType || 'PROBLEM_DISCOVERY',
      },

      // Truth Questions - 3 Rules
      truthQuestionRules: {
        rule1: 'Talk about THEIR LIFE, not your idea. Their world is fact. Your idea is fiction.',
        rule2: 'Ask about SPECIFICS IN THE PAST, not generics or opinions about the future.',
        rule3: 'Talk less, listen more.',
        enforcement: 'If a question doesn\'t pass all three, rewrite or skip it.',
      },

      // YC's 6 Core Questions
      sixCoreQuestions: [
        { q: 'Tell me how you do X today.', purpose: 'Understand current behavior' },
        { q: 'What is the hardest thing about X?', purpose: 'Find the pain' },
        { q: 'Why is it hard?', purpose: 'Understand root cause' },
        { q: 'How often do you do X?', purpose: 'Assess frequency' },
        { q: 'Why is X important to your company?', purpose: 'Understand stakes' },
        { q: 'What do you do to solve X today?', purpose: 'Find current solutions/workarounds' },
      ],

      // Good Questions (Truth Questions)
      goodQuestions: {
        underlyingMotivation: {
          question: '"Why do you bother?"',
          purpose: 'Cuts to the real problem behind the perceived one',
          example: 'Finance guys asked for messaging but really wanted everyone on latest spreadsheet version. Right product was Dropbox, not chat.',
        },
        implications: {
          question: '"What are the implications of that?"',
          purpose: 'Separates "I\'d-pay-to-solve" from "kind-of-annoying-but-fine"',
        },
        pastStory: {
          question: '"Talk me through the last time that happened."',
          purpose: 'Replaces opinions with stories. Show, don\'t tell.',
          rule: 'Watching someone do a task shows where problems REALLY are.',
        },
        workflow: {
          question: '"Talk me through your workflow."',
          purpose: 'One question, ten answers: tools, constraints, where your product fits.',
        },
        priorAttempts: {
          question: '"What else have you tried?"',
          purpose: 'Reveals competitors, willingness to pay, how serious the pain is.',
          rule: 'If they haven\'t looked for a solution already, they won\'t buy yours.',
        },
        currentSolution: {
          question: '"How are you dealing with it now?"',
          purpose: 'Gives price anchor. Shows magnitude of pain.',
        },
        budget: {
          question: '"Where does the money come from?" (B2B)',
          purpose: 'Reveals budget owner, decision process, hidden stakeholders.',
        },
        referral: {
          question: '"Who else should I talk to?"',
          purpose: 'End every conversation with this. Warm intros multiply leads.',
          rule: 'If they refuse, treat their compliments with extra skepticism.',
        },
      },

      // BAD Questions to AVOID
      badQuestions: {
        opinion: {
          bad: '"Do you think it\'s a good idea?"',
          why: 'Only the market can tell you. Everything else is opinion.',
          fix: 'Ask how they currently solve the problem. What they\'ve tried. Where they\'re losing money.',
        },
        hypotheticalBuy: {
          bad: '"Would you buy a product that did X?"',
          why: 'People are wildly optimistic about hypothetical futures. Answer is almost always "yes".',
          fix: 'Ask how they solve X today. How much it costs. When it last came up.',
        },
        hypotheticalPrice: {
          bad: '"How much would you pay for X?"',
          why: 'Still hypothetical. Numbers feel rigorous but it\'s a guess.',
          fix: 'Ask what problem currently costs them. What they pay now. Or literally ask for money.',
        },
        dreamProduct: {
          bad: '"What would your dream product do?"',
          why: 'Sort-of-okay only with great follow-ups. Otherwise it\'s a feature wishlist.',
          fix: 'For each feature, ask WHY they want it, what it lets them do, how they cope without it.',
        },
      },

      // Digging into Feature Requests
      featureRequestDig: {
        trigger: 'When someone says "you should add X"',
        questions: [
          '"Why do you want that?"',
          '"What would that let you do?"',
          '"How are you coping without it?"',
          '"Should we push back launch to add that, or add it later?"',
          '"How would that fit into your day?"',
        ],
        rule: 'Don\'t add it to your to-do list. Add it to your UNDERSTANDING.',
      },

      // Emotional Signals
      emotionalSignals: {
        trigger: 'Any strong emotion (anger, embarrassment, excitement) is worth exploring',
        questions: [
          '"Tell me more about that."',
          '"That seems to really bug you — I bet there\'s a story here."',
          '"What makes it so awful?"',
          '"Why haven\'t you been able to fix this already?"',
          '"You seem excited — it\'s a big deal?"',
        ],
      },

      // Anchoring Fluff to Specifics
      anchoringFluff: {
        trigger: 'When you hear "I usually…", "I would…", "I might…"',
        questions: [
          '"When was the last time that happened?"',
          '"Can you talk me through that?"',
          '"What did you actually do?"',
        ],
        rule: 'Keep asking until you hit a concrete past event with real details.',
      },

      // The List of 3
      listOfThree: {
        instruction: 'Before any conversation, write down the 3 most important things to learn from this TYPE of person.',
        benefits: [
          'Forces scary, important questions instead of comfortable ones',
          'Lets you make use of bumping into a dream customer',
          'Means you don\'t have to ask everyone everything',
        ],
        rule: 'If you don\'t know what you\'re trying to learn, don\'t have the conversation.',
      },

      // Interview Red Flags (Symptoms of Wrong Questions)
      redFlags: [
        'They\'re complimenting you ("That\'s so cool")',
        'They\'re agreeing too easily',
        'You\'re getting "I would definitely…" / "I always…" answers',
        'They\'re suggesting features',
        'You leave the meeting feeling great',
        'You weren\'t scared to ask any of the questions',
        'You got an unexpected answer and it didn\'t change your idea',
      ],
      criticalRule: 'You should be TERRIFIED of at least one question in every conversation.',

      outputFormat: {
        listOfThree: 'The 3 most important things to learn',
        questions: 'Array of {question, category, purpose, whatItValidates, followUpPrompts}',
        questionsToAvoid: 'Bad questions specific to this idea',
        redFlagsToWatch: 'Specific warning signs for this customer segment',
        interviewTips: 'Practical tips for running the interview',
      },
    };
  },
});

export const saveInterviewNotesTool = new FunctionTool({
  name: 'save_interview_notes',
  description: 'Saves notes and insights from a customer interview with commitment signals',
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    intervieweeDescription: z.string().describe('Brief description of who was interviewed'),
    keyInsights: z.array(z.string()).describe('Main insights from the interview'),
    quotesAndEvidence: z.array(z.object({
      quote: z.string(),
      context: z.string(),
      emotionalSignal: z.enum(['EXCITED', 'ANGRY', 'EMBARRASSED', 'NEUTRAL']).optional(),
      relatedAssumption: z.string().optional(),
    })).describe('Notable quotes with context'),
    validationSignals: z.object({
      problemConfirmed: z.boolean(),
      haveTried: z.boolean().describe('Have they tried to solve this before?'),
      currentlySpending: z.boolean().describe('Are they spending money/time on workarounds?'),
      willingnessToPay: z.enum(['STRONG', 'MODERATE', 'WEAK', 'NONE']),
      urgency: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    }).describe('Key validation signals from the interview'),
    commitmentGiven: z.object({
      time: z.string().optional().describe('Time commitment: next meeting, trial usage, etc.'),
      reputation: z.string().optional().describe('Reputation commitment: intros, testimonial, etc.'),
      money: z.string().optional().describe('Money commitment: LOI, pre-order, deposit, etc.'),
    }).optional().describe('Real commitments (not just compliments)'),
  }),
  execute: async ({ ventureId, intervieweeDescription, keyInsights, quotesAndEvidence, validationSignals, commitmentGiven }) => {
    const interviewId = `interview_${Date.now()}`;

    // Assess signal strength based on Truth Questions criteria
    const strongSignals = [
      validationSignals.problemConfirmed,
      validationSignals.haveTried,
      validationSignals.currentlySpending,
      validationSignals.willingnessToPay !== 'NONE',
    ].filter(Boolean).length;

    const hasRealCommitment = commitmentGiven &&
      (commitmentGiven.time || commitmentGiven.reputation || commitmentGiven.money);

    let signalAssessment: string;
    if (strongSignals >= 3 && hasRealCommitment) {
      signalAssessment = 'STRONG_VALIDATION';
    } else if (strongSignals >= 2) {
      signalAssessment = 'MODERATE_SIGNAL';
    } else {
      signalAssessment = 'WEAK_OR_POLITE';
    }

    return {
      status: 'success',
      interviewId,
      message: 'Interview notes saved successfully',
      data: {
        id: interviewId,
        ventureId,
        interviewee: intervieweeDescription,
        insights: keyInsights,
        quotes: quotesAndEvidence,
        signals: validationSignals,
        commitment: commitmentGiven || { time: null, reputation: null, money: null },
        conductedAt: new Date().toISOString(),
      },
      analysis: {
        signalStrength: signalAssessment,
        strongSignalCount: strongSignals,
        hasRealCommitment,
        interpretation: signalAssessment === 'STRONG_VALIDATION'
          ? 'This looks like a real signal. Look for patterns across more interviews.'
          : signalAssessment === 'MODERATE_SIGNAL'
            ? 'Some positive signs, but need more evidence. Dig deeper on what\'s missing.'
            : 'Be careful — this might be politeness, not validation. Did they give up anything of value?',
      },
      nextStep: signalAssessment === 'WEAK_OR_POLITE'
        ? 'Review the questions asked. Were they Truth Questions compliant? Try pushing for commitment next time.'
        : 'Conduct more interviews to see if this pattern repeats.',
    };
  },
});
