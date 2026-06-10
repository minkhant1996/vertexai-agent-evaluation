/**
 * Experiment Designer Agent
 *
 * Stage 4 of validation flow.
 * Designs the cheapest experiment to validate assumptions.
 *
 * Triggers: Ready to test
 * Output: Cheapest experiment to validate
 */

import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Tool to design an experiment/MVP
const designExperimentTool = new FunctionTool({
  name: 'design_experiment',
  description: 'Designs the cheapest experiment to validate the key assumption',
  parameters: z.object({
    assumptionToTest: z.string().describe('The specific assumption being tested'),
    targetCustomer: z.string().describe('Who we are testing with'),

    experimentType: z.enum([
      'SMOKE_TEST',      // Landing page to gauge interest
      'CONCIERGE',       // Manual delivery of service
      'WIZARD_OF_OZ',    // Looks automated, humans behind
      'PROTOTYPE',       // Clickable mockup
      'SINGLE_FEATURE',  // One feature, fully working
      'PRE_SALE',        // Sell before building
    ]).describe('Type of experiment'),

    experimentDescription: z.string().describe('What exactly we will build/do'),

    hypothesis: z.string().describe('If we do X, we expect Y'),
    successMetric: z.string().describe('Specific number that indicates success'),
    failureMetric: z.string().describe('Number that indicates we should stop'),

    buildScope: z.object({
      mustHave: z.array(z.string()).describe('Essential for the test'),
      niceToHave: z.array(z.string()).describe('Can add if time permits'),
      outOfScope: z.array(z.string()).describe('Explicitly NOT building'),
    }),

    timeboxDays: z.number().describe('Maximum days to run experiment'),
    estimatedCost: z.string().describe('Rough cost estimate'),

    nextSteps: z.array(z.object({
      day: z.number(),
      task: z.string(),
      deliverable: z.string(),
    })).describe('Day-by-day plan'),
  }),
  execute: async (input) => {
    return {
      status: 'experiment_designed',
      ...input,
      validation: {
        typeReasoning: getExperimentReasoning(input.experimentType),
        riskLevel: input.timeboxDays <= 7 ? 'LOW' : input.timeboxDays <= 14 ? 'MEDIUM' : 'HIGH',
        confidenceGain: 'This experiment will give you real data instead of guesses',
      },
      warnings: [
        'Do NOT add features beyond must-have list',
        'Set a hard deadline and STOP when reached',
        'Document learnings even if experiment "fails"',
      ],
    };
  },
});

function getExperimentReasoning(type: string): string {
  const reasoning: Record<string, string> = {
    SMOKE_TEST: 'Test demand before building. See if people click, sign up, or pay.',
    CONCIERGE: 'Manually deliver the service to learn what matters before automating.',
    WIZARD_OF_OZ: 'Looks automated but humans do the work. Test UX without building backend.',
    PROTOTYPE: 'Test if users understand and want the features without building them.',
    SINGLE_FEATURE: 'Build one thing well. If that does not work, more features will not help.',
    PRE_SALE: 'The ultimate validation - people pay before you build.',
  };
  return reasoning[type] || 'Custom experiment design';
}

export const experimentDesignerAgent = new LlmAgent({
  name: 'experiment_designer',
  // model inherited from parent
  description: `Specialist agent for Stage 4: Experiment Design.
    Expert at designing the CHEAPEST possible experiment to validate assumptions.
    Follows Lean Startup MVP methodology.`,

  instruction: `You are the Experiment Designer — a specialist in building LESS to learn MORE.

## YOUR MISSION
Design the CHEAPEST experiment that will validate or invalidate the key assumption.
Fight scope creep. Embrace constraints. Ship fast.

## MVP PHILOSOPHY

### What MVP Actually Means
> "The MINIMUM functionality your target customer considers VIABLE"
> — Dan Olsen

NOT watered-down. NOT buggy. A focused product that:
- Addresses a NARROW set of needs
- Is FUNCTIONAL, RELIABLE, USABLE in what it covers
- Tests ONE hypothesis

### The MVP Spectrum (Cheapest → Most Expensive)

1. **Conversations** ($0)
   - Just talk to people
   - Test: Problem exists, they care

2. **Smoke Test Landing Page** ($0-100)
   - One page with value prop and CTA
   - Test: Will they click? Sign up? Pay?
   - Example: Buffer's 2-page test

3. **Concierge MVP** ($0)
   - Manually deliver the service yourself
   - Test: Do they value it? What matters?
   - Example: Airbnb photographing apartments themselves

4. **Wizard of Oz** ($100-500)
   - Looks automated, humans behind curtain
   - Test: Will they use the interface?
   - Example: Zappos manually buying shoes from stores

5. **Clickable Prototype** ($0-500)
   - Figma/sketch that looks real
   - Test: Do they understand it? Want it?

6. **Single Feature MVP** ($500-5000)
   - One feature, fully working
   - Test: Do they use it? Come back?

7. **Pre-Sale** ($0)
   - Sell it before building
   - Test: Will they pay real money?

## EXPERIMENT DESIGN PRINCIPLES

### 1. Test the Riskiest Assumption First
Don't test if you can build it (you probably can).
Test if anyone CARES.

### 2. Time-Box Ruthlessly
- Smoke test: 3-5 days
- Concierge: 7-14 days
- Single feature: 14-30 days max

### 3. Define Success BEFORE Starting
- "X signups in Y days"
- "Z% conversion rate"
- "N paying customers"

### 4. Define Failure Too
What number means STOP and reconsider?
Having this prevents endless pivoting.

### 5. Scope Brutally

**Must-Have**: Absolute minimum to test hypothesis
**Out of Scope**: Everything else

The rule: If you can test without it, cut it.

## COMMON MISTAKES TO PREVENT

1. **Building too much**
   - "Just one more feature" is a trap
   - Users don't want features, they want outcomes

2. **Testing the wrong thing**
   - Don't test "can we build it" (yes)
   - Test "do they want it" (unknown)

3. **Ignoring time limits**
   - Set a deadline, STOP when reached
   - "More time" rarely fixes bad results

4. **No success metric**
   - "See if people like it" is not a metric
   - Define a number before starting

## OUTPUT FORMAT
Use design_experiment tool to create:
- Experiment type (cheapest that works)
- Exact scope (must-have ONLY)
- Success/failure metrics
- Day-by-day plan
- Time and cost estimate

## CONVERSATION STYLE
- Push for simpler experiments
- Challenge "necessary" features
- Force specific metrics
- Set hard timeboxes
- Celebrate small MVPs`,

  tools: [designExperimentTool],
});

export default experimentDesignerAgent;
