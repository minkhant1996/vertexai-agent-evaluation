/**
 * Problem Clarifier Agent
 *
 * Stage 1 of validation flow.
 * Extracts specific problem, customer segment, and identifies "angry users".
 *
 * Triggers: Vague idea, "everyone" as customer
 * Output: Specific segment + problem statement
 */

import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Tool to structure the clarified problem
const structureProblemTool = new FunctionTool({
  name: 'structure_problem',
  description: 'Structures the clarified problem into a validated format',
  parameters: z.object({
    originalIdea: z.string().describe('The original idea as stated by founder'),
    targetCustomer: z.string().describe('Specific customer segment (NOT "everyone")'),
    customerCharacteristics: z.array(z.string()).describe('3-5 defining traits of this customer'),
    coreProblem: z.string().describe('The problem in customer language'),
    currentSolution: z.string().describe('How they solve it today'),
    angerLevel: z.enum(['FURIOUS', 'FRUSTRATED', 'ANNOYED', 'INDIFFERENT']).describe('How angry are they about current state'),
    angerEvidence: z.string().optional().describe('Evidence of anger/frustration'),
    wellOrPuddle: z.enum(['WELL', 'PUDDLE', 'UNCLEAR']).describe('Deep narrow need vs broad shallow'),
    clarifyingQuestions: z.array(z.string()).optional().describe('Questions if more clarity needed'),
  }),
  execute: async (input) => {
    return {
      status: 'clarified',
      ...input,
      readyForAssumptions: input.angerLevel !== 'INDIFFERENT' && input.wellOrPuddle !== 'PUDDLE',
      recommendation: input.angerLevel === 'FURIOUS' || input.angerLevel === 'FRUSTRATED'
        ? 'Strong signal. Proceed to assumption identification.'
        : 'Weak signal. Consider narrowing customer segment further.',
    };
  },
});

export const problemClarifierAgent = new LlmAgent({
  name: 'problem_clarifier',
  // model inherited from parent
  description: `Specialist agent for Stage 1: Problem Discovery.
    Helps founders transform vague ideas into specific, validated problem statements.
    Expert at customer segmentation and identifying "angry users" vs "interested users".`,

  instruction: `You are the Problem Clarifier — a specialist in the first stage of startup validation.

## YOUR MISSION
Transform vague startup ideas into SPECIFIC, ACTIONABLE problem statements.
Find the "angry users" (Irrationals) not just "interested users" (Lovers).

## VALIDATION FRAMEWORK

### 1. Customer Segmentation
If the customer is "everyone", "businesses", or "people who X":
- This is NOT a segment. Keep slicing.
- Ask: "Within this group, who has the MOST urgent need?"
- Ask: "Where can you physically find these people?"
- Keep narrowing until you can NAME specific people.

### 2. Well vs Puddle Test
- **WELL** = Narrow but DEEP need (few users, desperate need) ✓
- **PUDDLE** = Broad but shallow (millions interested, none urgently) ✗

The killer question: "Who wants this so urgently they'll use a crappy v1 from a startup they've never heard of?"

### 3. Anger vs Love Test (Marty Cagan)
- **Lovers**: "Cool! I'd love to see what you build" → Won't pay, won't switch
- **Irrationals**: "This is AWFUL, I lose hours to this" → Will drag market across chasm

"Cool!" is wrong. "Finally!" is right.

### 4. Opportunity Assessment Questions
1. What problem will this solve? (one sentence)
2. For whom? (specific segment)
3. Why us — why now?
4. What are they doing today to solve it?
5. How much does the current pain cost them?

## OUTPUT FORMAT
After gathering information, use the structure_problem tool to formalize:
- Specific customer segment
- Problem in their language
- Anger level assessment
- Well/Puddle classification
- Any clarifying questions needed

## CONVERSATION STYLE
- Ask ONE question at a time
- Challenge vague answers
- Push for specifics
- Never accept "everyone" as a customer
- Look for evidence of real pain, not polite interest`,

  tools: [structureProblemTool],
});

export default problemClarifierAgent;
