/**
 * Assumption Hunter Agent
 *
 * Stage 2 of validation flow.
 * Identifies risky assumptions and prioritizes what to test first.
 *
 * Triggers: Clarified idea ready
 * Output: Top 3 risky assumptions to test
 */

import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Tool to structure identified assumptions
const identifyAssumptionsTool = new FunctionTool({
  name: 'identify_assumptions',
  description: 'Structures the risky assumptions into a prioritized list',
  parameters: z.object({
    clarifiedIdea: z.string().describe('The clarified idea from Problem Clarifier'),
    targetCustomer: z.string().describe('The specific customer segment'),

    assumptions: z.array(z.object({
      statement: z.string().describe('The assumption stated clearly'),
      category: z.enum(['CUSTOMER', 'PROBLEM', 'SOLUTION', 'BUSINESS_MODEL', 'DISTRIBUTION']),
      riskLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      confidence: z.enum(['GUESS', 'HUNCH', 'BELIEF', 'EVIDENCE']),
      testMethod: z.string().describe('How to test this assumption cheaply'),
      deathIfWrong: z.boolean().describe('Would being wrong here kill the startup?'),
    })).describe('List of identified assumptions'),

    leapsOfFaith: z.array(z.string()).describe('The 1-3 assumptions that MUST be true'),
    analogsUsed: z.array(z.string()).optional().describe('What has been proven elsewhere'),
    antilogsAvoided: z.array(z.string()).optional().describe('What has been proven FALSE elsewhere'),
  }),
  execute: async (input) => {
    // Sort by risk and death-if-wrong
    const prioritized = input.assumptions
      .sort((a, b) => {
        const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        if (a.deathIfWrong !== b.deathIfWrong) return a.deathIfWrong ? -1 : 1;
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });

    return {
      status: 'assumptions_identified',
      totalAssumptions: input.assumptions.length,
      criticalCount: input.assumptions.filter(a => a.riskLevel === 'CRITICAL').length,
      topThreeToTest: prioritized.slice(0, 3),
      leapsOfFaith: input.leapsOfFaith,
      recommendation: prioritized[0]
        ? `Start by testing: "${prioritized[0].statement}" using ${prioritized[0].testMethod}`
        : 'No critical assumptions identified',
      readyForResearch: prioritized.length > 0,
    };
  },
});

export const assumptionHunterAgent = new LlmAgent({
  name: 'assumption_hunter',
  // model inherited from parent
  description: `Specialist agent for Stage 2: Assumption Identification.
    Expert at finding hidden assumptions and prioritizing what to test first.
    Uses Lean Startup methodology and Randy Komisar's Analog/Antilog framework.`,

  instruction: `You are the Assumption Hunter — a specialist in uncovering what could kill a startup.

## YOUR MISSION
Find the RISKY ASSUMPTIONS hiding in every startup idea.
Prioritize which ones to test FIRST (before spending money building).

## ASSUMPTION CATEGORIES

### 1. Customer Assumptions
- Do these people actually exist in sufficient numbers?
- Can we actually reach them?
- Are they who we think they are?

### 2. Problem Assumptions
- Is this actually a problem for them?
- Is it painful enough to pay to solve?
- Is it frequent enough to matter?

### 3. Solution Assumptions
- Will our solution actually solve the problem?
- Will they use it correctly?
- Will it fit their workflow?

### 4. Business Model Assumptions
- Will they pay what we need to charge?
- Can we deliver at that cost?
- Can we acquire customers profitably?

### 5. Distribution Assumptions
- Can we reach them through this channel?
- Will our marketing message resonate?
- Is there a viral/referral mechanic?

## KOMISAR FRAMEWORK

### Analogs (Don't Re-Test)
Things PROVEN TRUE elsewhere:
- "People buy software subscriptions" (Salesforce proved this)
- "Founders seek advice" (YC proved this)

### Antilogs (Work Around)
Things PROVEN FALSE elsewhere:
- "People will pay for social networks" (Facebook had to use ads)
- "Users read instructions" (Almost never)

### Leaps of Faith (TEST THESE)
What's LEFT after subtracting analogs and antilogs.
These are YOUR unique risks.

## RISK ASSESSMENT

For each assumption, evaluate:

1. **Confidence Level**
   - GUESS: No data, just hoping
   - HUNCH: Some indirect signals
   - BELIEF: Logical but untested
   - EVIDENCE: Actual data supports it

2. **Death-if-Wrong**
   - TRUE: Startup dies if this is wrong
   - FALSE: Painful but recoverable

3. **Test Cost**
   - How cheaply can we validate this?
   - Conversations < Surveys < Prototypes < Code

## OUTPUT FORMAT
Use identify_assumptions tool to structure:
- All assumptions found
- Risk levels and categories
- Top 3 to test first
- Recommended test methods

## CONVERSATION STYLE
- Be thorough but focused
- Challenge "obvious" assumptions
- Ask: "What would have to be true for this to work?"
- Prioritize ruthlessly
- Always recommend cheapest test first`,

  tools: [identifyAssumptionsTool],
});

export default assumptionHunterAgent;
