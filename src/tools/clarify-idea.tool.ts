import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const clarifyIdeaTool = new FunctionTool({
  name: 'clarify_idea',
  description: `Transforms a raw startup idea into a structured, clear format using the
    Opportunity Assessment framework (Marty Cagan). Extracts target customer segment,
    core problem, proposed solution, and unique value. Identifies if founder has found
    "angry users" (Irrationals) vs just "interested users" (Lovers).`,
  parameters: z.object({
    ideaDescription: z.string().describe('The raw startup idea description from the founder'),
    targetCustomer: z.string().optional().describe('Who the founder thinks the customer is'),
    founderBackground: z.string().optional().describe('Relevant founder background/expertise'),
  }),
  execute: async ({ ideaDescription, targetCustomer, founderBackground }) => {
    return {
      status: 'ready_for_clarification',
      input: {
        rawIdea: ideaDescription,
        providedCustomer: targetCustomer || 'Not specified',
        founderContext: founderBackground || 'Not provided',
      },

      // Opportunity Assessment (Inspired - Marty Cagan)
      opportunityAssessment: {
        description: 'Before committing to explore a direction, answer these 10 questions honestly.',
        questions: [
          '1. What problem will this solve? (one sentence value proposition)',
          '2. For whom? (specific target customer, NOT "everyone")',
          '3. How big is the opportunity? (sanity check, not VC pitch)',
          '4. How will we measure success? (specific metric agreed upfront)',
          '5. What competitive alternatives exist? (including "do nothing")',
          '6. Why us — why now? (differentiator and market window)',
          '7. What is the go-to-market plan? (even a sketch)',
          '8. What does success require? (skills, tech, capital, partners, time)',
          '9. What is the recommendation? (pursue / drop / pursue with conditions)',
          '10. Who needs to agree? (co-founders, advisors, stakeholders)',
        ],
        rule: 'If you cannot fill all ten honestly, the direction is not ready yet.',
      },

      // Customer Segmentation (Truth Questions)
      customerSegmentation: {
        problem: 'If customer is "everyone" or "small businesses", you don\'t have a segment yet.',
        slicingQuestions: [
          'Within this group, who wants it MOST?',
          'Why do they want it?',
          'What are they currently doing to solve it?',
          'Where can I find them?',
        ],
        selectionCriteria: [
          'Profitable — Will they pay enough?',
          'Easy to reach — Can I actually find them?',
          'Rewarding — Will I enjoy spending time with them?',
        ],
        rule: 'If you don\'t know where to find your customers, keep slicing.',
      },

      // Well vs Puddle (YC)
      wellVsPuddle: {
        well: 'Narrow but DEEP need — few users, but they desperately need it',
        puddle: 'Broad but shallow — millions vaguely interested, no one urgently',
        killerTest: 'Who wants this so urgently they\'ll use a crappy v1 from a startup they\'ve never heard of?',
        examples: {
          well: 'Microsoft Basic for Altair owners — only thousands existed, but desperately needed it',
          puddle: 'Social network for pet owners — millions interested, no one urgently',
        },
      },

      // Anger vs Love (Inspired - Bonforte)
      angerVsLove: {
        lovers: {
          description: 'Excited about the TECHNOLOGY you\'re considering',
          quote: '"Cool, I\'d love to see what you can do with AI/blockchain"',
          reality: 'Won\'t pay, won\'t switch, won\'t tell colleagues',
        },
        irrationals: {
          description: 'FURIOUS about the current state of things',
          quote: '"This is awful, I hate existing tools, I lose hours a week to this"',
          reality: 'Will drag the whole market across the chasm',
        },
        rule: '"Cool!" is the wrong reaction. "Finally!" is the right one.',
        fresmanTest: 'If you can tap loneliness, insecurity, fear, frustration, or anger — you\'re on track.',
      },

      outputFormat: {
        clarifiedIdea: 'One paragraph summary',
        targetCustomerSegment: 'Specific segment definition (not "businesses")',
        coreProblem: 'Problem statement in customer language',
        proposedSolution: 'Solution outcome (not features)',
        uniqueValue: 'Key differentiator vs alternatives',
        angerSignals: 'Evidence of "Irrationals" vs just "Lovers"',
        clarifyingQuestions: 'Array of follow-up questions if idea needs more detail',
      },
    };
  },
});

export const saveVentureTool = new FunctionTool({
  name: 'save_venture',
  description: 'Saves or updates the venture information after idea clarification',
  parameters: z.object({
    founderId: z.string().describe('The founder ID'),
    ventureName: z.string().describe('Name for this venture/startup'),
    clarifiedIdea: z.string().describe('The clarified idea description'),
    targetCustomer: z.string().describe('Specific target customer segment'),
    problemStatement: z.string().describe('Core problem statement'),
    angerSignals: z.string().optional().describe('Evidence of angry users vs just interested'),
  }),
  execute: async ({ founderId, ventureName, clarifiedIdea, targetCustomer, problemStatement, angerSignals }) => {
    const ventureId = `venture_${Date.now()}`;

    return {
      status: 'success',
      ventureId,
      message: `Venture "${ventureName}" saved successfully`,
      data: {
        id: ventureId,
        founderId,
        name: ventureName,
        ideaDescription: clarifiedIdea,
        targetCustomer,
        problemStatement,
        angerSignals: angerSignals || 'Not yet assessed',
        currentStage: 'IDEA',
        createdAt: new Date().toISOString(),
      },
      nextStep: 'Now identify the risky assumptions that could kill this idea.',
    };
  },
});
