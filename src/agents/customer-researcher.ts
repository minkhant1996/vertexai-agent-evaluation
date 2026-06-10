/**
 * Customer Researcher Agent
 *
 * Stage 3 of validation flow.
 * Generates interview questions and analyzes customer feedback.
 *
 * Triggers: Needs to talk to users
 * Output: Interview script + analysis framework
 */

import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Tool to generate interview script
const generateInterviewScriptTool = new FunctionTool({
  name: 'generate_interview_script',
  description: 'Creates a structured interview script following Truth Questions methodology',
  parameters: z.object({
    targetCustomer: z.string().describe('Who we are interviewing'),
    assumptionToTest: z.string().describe('The main assumption we want to validate'),
    contextQuestions: z.array(z.string()).describe('Background questions to understand their world'),
    problemQuestions: z.array(z.string()).describe('Questions about the problem and current solutions'),
    commitmentQuestions: z.array(z.string()).describe('Questions to gauge real interest'),
    questionsToAvoid: z.array(z.string()).describe('Bad questions that would give false positives'),
    interviewTips: z.array(z.string()).describe('Tips for conducting the interview'),
  }),
  execute: async (input) => {
    return {
      status: 'script_generated',
      ...input,
      totalQuestions: input.contextQuestions.length + input.problemQuestions.length + input.commitmentQuestions.length,
      estimatedDuration: '20-30 minutes',
      successCriteria: [
        'Learn something that surprises you',
        'Hear specific stories, not opinions',
        'Identify if they have budget and authority',
        'Get a commitment (meeting, intro, or payment)',
      ],
    };
  },
});

// Tool to analyze interview results
const analyzeInterviewResultsTool = new FunctionTool({
  name: 'analyze_interview_results',
  description: 'Analyzes interview data to assess validation strength',
  parameters: z.object({
    interviewCount: z.number().describe('How many interviews conducted'),
    targetCustomer: z.string().describe('Who was interviewed'),

    findings: z.object({
      problemConfirmed: z.number().describe('How many confirmed the problem exists'),
      activelySearching: z.number().describe('How many are actively looking for solutions'),
      willingToPay: z.number().describe('How many indicated willingness to pay'),
      currentSpending: z.string().optional().describe('What they currently spend on solutions'),
    }),

    commitments: z.object({
      followUpMeetings: z.number().describe('Agreed to meet again'),
      introsProvided: z.number().describe('Offered intros to others'),
      preOrders: z.number().describe('Put down money or signed LOI'),
      trialSignups: z.number().describe('Signed up for early access'),
    }),

    quotes: z.array(z.object({
      quote: z.string(),
      sentiment: z.enum(['STRONG_POSITIVE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'STRONG_NEGATIVE']),
      isVanity: z.boolean().describe('Is this just a polite compliment?'),
    })).describe('Key quotes from interviews'),

    patterns: z.array(z.string()).describe('Recurring themes or patterns observed'),
  }),
  execute: async (input) => {
    const { findings, commitments, interviewCount } = input;

    // Calculate validation strength
    const problemRate = findings.problemConfirmed / interviewCount;
    const searchRate = findings.activelySearching / interviewCount;
    const payRate = findings.willingToPay / interviewCount;
    const commitmentRate = (commitments.followUpMeetings + commitments.introsProvided + commitments.preOrders) / interviewCount;

    // Real quotes vs vanity
    const realQuotes = input.quotes.filter(q => !q.isVanity);
    const strongSignals = input.quotes.filter(q => q.sentiment === 'STRONG_POSITIVE' && !q.isVanity);

    let validationStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
    let recommendation: string;

    if (commitments.preOrders > 0 || (problemRate > 0.8 && payRate > 0.5)) {
      validationStrength = 'STRONG';
      recommendation = 'Strong validation. Consider moving to MVP/experiment phase.';
    } else if (problemRate > 0.6 && commitmentRate > 0.3) {
      validationStrength = 'MODERATE';
      recommendation = 'Promising signals. Do 5 more interviews to confirm patterns.';
    } else if (problemRate > 0.4) {
      validationStrength = 'WEAK';
      recommendation = 'Mixed signals. Consider narrowing customer segment or pivoting problem.';
    } else {
      validationStrength = 'NONE';
      recommendation = 'Weak validation. Reconsider the problem or customer segment.';
    }

    return {
      status: 'analysis_complete',
      validationStrength,
      metrics: {
        problemConfirmationRate: `${(problemRate * 100).toFixed(0)}%`,
        activeSearchRate: `${(searchRate * 100).toFixed(0)}%`,
        willingnessToPayRate: `${(payRate * 100).toFixed(0)}%`,
        commitmentRate: `${(commitmentRate * 100).toFixed(0)}%`,
      },
      realQuotesCount: realQuotes.length,
      strongSignalsCount: strongSignals.length,
      patterns: input.patterns,
      recommendation,
      readyForExperiment: validationStrength === 'STRONG' || validationStrength === 'MODERATE',
    };
  },
});

export const customerResearcherAgent = new LlmAgent({
  name: 'customer_researcher',
  // model inherited from parent
  description: `Specialist agent for Stage 3: Customer Research.
    Expert at designing interview scripts and analyzing customer feedback.
    Follows Truth Questions methodology to avoid false positives.`,

  instruction: `You are the Customer Researcher — a specialist in talking to customers the RIGHT way.

## YOUR MISSION
Help founders learn from customers WITHOUT getting false positives.
Generate questions that reveal TRUTH, not just validation.

## TRUTH QUESTIONS - 3 RULES

### Rule 1: Talk about THEIR life, not YOUR idea
- Their world is FACT. Your idea is FICTION.
- Bad: "Would you use an app that does X?"
- Good: "Tell me about the last time you dealt with X."

### Rule 2: Ask about PAST specifics, not FUTURE generics
- Past behavior predicts future behavior. Opinions don't.
- Bad: "How often would you use this?"
- Good: "How often did you do this last month?"

### Rule 3: Talk LESS, listen MORE
- You're there to learn, not to pitch.
- Let awkward silences happen.
- Follow the energy in their responses.

## GOOD QUESTIONS

**Context Questions:**
- "Walk me through your day when you deal with X"
- "Tell me about the last time this happened"
- "What does your current process look like?"

**Problem Questions:**
- "What's the hardest part about X?"
- "Why is that hard?"
- "What happens when it goes wrong?"

**Solution Questions:**
- "What have you tried to solve this?"
- "Why did/didn't that work?"
- "What would have to be true for a solution to work?"

**Commitment Questions:**
- "Who else should I talk to about this?"
- "Can I follow up in 2 weeks with what I learn?"
- "Would you pay $X for something that solved this?"

## BAD QUESTIONS (NEVER ASK)

- "Do you think this is a good idea?" → Opinion, worthless
- "Would you buy this?" → Hypothetical, always yes
- "How much would you pay?" → They don't know
- "What features would you want?" → Feature soup

## READING RESPONSES

| They Said | What It Means |
|-----------|---------------|
| "That's so cool!" | BAD - Compliment, no signal |
| "Keep me posted" | BAD - Polite rejection |
| "I would definitely buy" | BAD - Hypothetical lie |
| "What are next steps?" | GOOD - Real interest |
| "Can you talk to my team?" | GOOD - Internal champion |
| "Can I pay now?" | GREAT - Strongest signal |

## CURRENCIES OF COMMITMENT

Real commitment uses real currency:
1. **TIME**: Scheduled follow-up, trial period
2. **REPUTATION**: Intro to peers, public testimonial
3. **MONEY**: Pre-order, deposit, LOI

## OUTPUT
Use tools to either:
1. generate_interview_script - Create questions
2. analyze_interview_results - Evaluate feedback

## CONVERSATION STYLE
- Be specific about question phrasing
- Explain WHY each question matters
- Warn about common traps
- Help interpret ambiguous responses`,

  tools: [generateInterviewScriptTool, analyzeInterviewResultsTool],
});

export default customerResearcherAgent;
