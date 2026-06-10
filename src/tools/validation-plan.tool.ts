import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const create7DayPlanTool = new FunctionTool({
  name: 'create_7day_validation_plan',
  description: `Creates a focused 7-day validation plan with specific daily tasks and deliverables.
    Includes stage completion criteria from Truth Questions and commitment checkpoints.`,
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    primaryGoal: z.string().describe('Main validation goal for the week'),
    riskiestAssumption: z.string().describe('The assumption being tested'),
    mvpType: z.enum(['LANDING_PAGE', 'SMOKE_TEST', 'CONCIERGE', 'WIZARD_OF_OZ', 'PROTOTYPE', 'INTERVIEWS_ONLY'])
      .optional().describe('MVP approach if applicable'),
    targetInterviews: z.number().optional().describe('Number of customer interviews planned'),
  }),
  execute: async ({ ventureId, primaryGoal, riskiestAssumption, mvpType, targetInterviews }) => {
    return {
      status: 'ready_for_plan_creation',
      input: {
        ventureId,
        goal: primaryGoal,
        assumption: riskiestAssumption,
        approach: mvpType || 'INTERVIEWS_ONLY',
        targetInterviews: targetInterviews || 5,
      },

      // Stage Completion Criteria (Truth Questions)
      stageCompletionCriteria: {
        problemValidation: {
          description: 'When to stop doing customer discovery and move to MVP',
          signals: [
            'You\'ve stopped hearing new things (often 3-10 conversations with focused segment)',
            'You\'ve found earlyvangelists — people emotionally invested who\'d pay to fix it',
            'You can articulate: who, where, problem, current cost, why solutions fall short',
            'You\'ve answered enough "if this fails, why" questions to feel safe building',
          ],
          rule: 'Don\'t spend months on conversations. A week or two is usually enough.',
        },
        earlyvangelistCharacteristics: [
          'Have the problem',
          'Know they have it',
          'Have budget to solve it',
          'Have already cobbled together a makeshift solution',
          'B2B: recognize "THIS IS THE WORST PART OF MY LIFE" intensity',
        ],
      },

      // Plan Templates by Type
      planTemplates: {
        INTERVIEWS_ONLY: {
          focus: 'Pure customer discovery through interviews',
          days: [
            { day: 1, name: 'Monday', focus: 'Outreach & Scheduling', tasks: ['Draft outreach message', 'Identify 20 potential interviewees', 'Send first batch'], deliverable: '10+ outreach messages sent' },
            { day: 2, name: 'Tuesday', focus: 'Interview Prep', tasks: ['Finalize interview script (List of 3)', 'Set up note-taking', 'Conduct 1-2 warm-up interviews'], deliverable: 'Interview script + first notes' },
            { day: 3, name: 'Wednesday', focus: 'Interview Day 1', tasks: ['Conduct 2-3 interviews', 'Write notes immediately after', 'Send thank yous + ask for referrals'], deliverable: '2-3 completed interviews with notes' },
            { day: 4, name: 'Thursday', focus: 'Interview Day 2', tasks: ['Conduct 2-3 more interviews', 'Start pattern recognition', 'Follow up on no-responses'], deliverable: '5+ total interviews, pattern notes' },
            { day: 5, name: 'Friday', focus: 'Interview Day 3', tasks: ['Conduct final 2-3 interviews', 'Complete note consolidation', 'Identify key quotes'], deliverable: '7+ total interviews, quote library' },
            { day: 6, name: 'Saturday', focus: 'Synthesis', tasks: ['Analyze all interviews', 'Document patterns/surprises', 'Update assumption confidence'], deliverable: 'Synthesis document with signal strength' },
            { day: 7, name: 'Sunday', focus: 'Decision', tasks: ['Review against completion criteria', 'Make go/no-go decision', 'Plan next week based on findings'], deliverable: 'Written decision + next week plan' },
          ],
        },
        LANDING_PAGE: {
          focus: 'Test demand with a landing page',
          days: [
            { day: 1, name: 'Monday', focus: 'Copy & Positioning', tasks: ['Write 3 headline variations', 'Define value proposition', 'Draft page copy'], deliverable: 'Landing page copy doc' },
            { day: 2, name: 'Tuesday', focus: 'Build Page', tasks: ['Create landing page', 'Set up email capture', 'Add basic analytics'], deliverable: 'Live landing page' },
            { day: 3, name: 'Wednesday', focus: 'Launch & Initial Traffic', tasks: ['Launch page', 'Share with 5 relevant communities', 'Post on social channels'], deliverable: 'Page live + first 100 visitors' },
            { day: 4, name: 'Thursday', focus: 'Optimize & Outreach', tasks: ['Review initial metrics', 'A/B test headline if possible', 'Direct outreach to 20 targets'], deliverable: 'First conversion data + outreach sent' },
            { day: 5, name: 'Friday', focus: 'Traffic Push', tasks: ['Double down on working channels', 'Email signups with 1-question survey', 'Gather qualitative feedback'], deliverable: 'Survey responses from signups' },
            { day: 6, name: 'Saturday', focus: 'Analysis', tasks: ['Analyze conversion data', 'Review survey responses', 'Talk to 2-3 signups (Truth Questions!)'], deliverable: 'Conversion analysis + user insights' },
            { day: 7, name: 'Sunday', focus: 'Decision', tasks: ['Calculate final conversion rate vs target', 'Document learnings', 'Decide: build more, pivot, or stop'], deliverable: 'Go/no-go decision with evidence' },
          ],
        },
        CONCIERGE: {
          focus: 'Manually deliver service to validate value',
          days: [
            { day: 1, name: 'Monday', focus: 'Service Design', tasks: ['Define exact service workflow', 'Create customer intake form', 'Set up communication channel'], deliverable: 'Service playbook document' },
            { day: 2, name: 'Tuesday', focus: 'Find First Customer', tasks: ['Reach out to warm network', 'Offer free trial of service', 'Onboard first customer'], deliverable: 'First customer onboarded' },
            { day: 3, name: 'Wednesday', focus: 'Deliver Service #1', tasks: ['Manually deliver full service', 'Document every step taken', 'Collect immediate feedback'], deliverable: 'First delivery complete + feedback' },
            { day: 4, name: 'Thursday', focus: 'Iterate & Customer #2', tasks: ['Improve based on feedback', 'Find and serve second customer', 'Track time spent per customer'], deliverable: 'Second customer served + time log' },
            { day: 5, name: 'Friday', focus: 'Scale Test', tasks: ['Serve customers 3-4', 'Identify bottlenecks', 'Calculate unit economics'], deliverable: '4 customers served + economics draft' },
            { day: 6, name: 'Saturday', focus: 'Pricing Test', tasks: ['Ask customers about willingness to pay', 'Test actual payment if possible', 'Gather testimonials'], deliverable: 'Pricing feedback + testimonials' },
            { day: 7, name: 'Sunday', focus: 'Decision', tasks: ['Review all customer feedback', 'Calculate if sustainable', 'Decide: continue, pivot, or stop'], deliverable: 'Go/no-go with unit economics' },
          ],
        },
      },

      // Commitment Checkpoints
      commitmentCheckpoints: {
        description: 'At each stage, look for real commitment (not just compliments)',
        currencies: {
          time: ['Clear next meeting scheduled', 'Using trial for 1+ week', 'Giving feedback on prototype'],
          reputation: ['Intro to peers or team', 'Intro to decision maker', 'Agreeing to testimonial'],
          money: ['Letter of intent', 'Pre-order', 'Deposit', 'Actual payment'],
        },
        rule: 'The more they give up, the more seriously you can take their kind words.',
      },

      // Decision Framework
      decisionFramework: {
        day7Questions: [
          'Did we find earlyvangelists (people who desperately want this)?',
          'Is the problem painful enough that people actively seek solutions?',
          'Did anyone give us real commitment (time, reputation, or money)?',
          'Do we understand WHY the ones who showed interest did so?',
          'Can we articulate: who, where, problem, cost, why current solutions fail?',
        ],
        outcomes: {
          GO: 'Multiple earlyvangelists found, commitment received, clear pattern emerged',
          ITERATE: 'Mixed signals — need to refine segment, problem statement, or approach',
          PIVOT: 'Problem not validated, but learned something that points to different direction',
          STOP: 'No evidence of real demand after honest effort — time to try something else',
        },
        rule: 'A clear "no" is better than a fuzzy "maybe". Push for the decision.',
      },

      // Blocker Handling
      blockerHandling: {
        commonBlockers: [
          'Can\'t find people to interview',
          'People say nice things but no commitment',
          'Mixed signals — some love it, some don\'t care',
          'Technical challenges with MVP build',
          'Running out of time / energy',
        ],
        unblockerQuestions: [
          'Can you break this into a smaller first step?',
          'Is there a workaround that gets 80% of the value?',
          'Who in your network has faced this before?',
          'What would you do if you HAD to solve this in 24 hours?',
        ],
      },

      outputFormat: {
        weeklyGoal: 'Clear statement of what success looks like',
        dailyTasks: 'Array of {day, dayName, focus, tasks[], timeEstimate, deliverable}',
        commitmentTargets: 'What commitment to seek by end of week',
        successCriteria: 'Quantified success metric with target number',
        decisionCriteria: 'Specific criteria for go/iterate/pivot/stop',
        potentialBlockers: 'Anticipated obstacles and mitigations',
        weekEndReview: 'Questions to answer at end of week',
      },
    };
  },
});

export const saveValidationPlanTool = new FunctionTool({
  name: 'save_validation_plan',
  description: 'Saves the 7-day validation plan for the venture',
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    weekNumber: z.number().describe('Which week of validation (1, 2, etc.)'),
    primaryGoal: z.string().describe('Main goal for the week'),
    dailyTasks: z.array(z.object({
      day: z.number(),
      dayName: z.string(),
      focus: z.string(),
      tasks: z.array(z.string()),
      deliverable: z.string(),
      timeEstimate: z.string().optional(),
    })).describe('Daily task breakdown'),
    successCriteria: z.string().describe('How to measure success'),
    commitmentTarget: z.string().describe('What commitment to seek'),
  }),
  execute: async ({ ventureId, weekNumber, primaryGoal, dailyTasks, successCriteria, commitmentTarget }) => {
    const planId = `plan_${Date.now()}`;

    return {
      status: 'success',
      planId,
      message: `Week ${weekNumber} validation plan saved`,
      data: {
        id: planId,
        ventureId,
        weekNumber,
        primaryGoal,
        tasks: dailyTasks,
        successCriteria,
        commitmentTarget,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      nextSteps: [
        'Block calendar time for Day 1 tasks',
        'Set reminder for Day 7 decision review',
        'Share plan with accountability partner',
        'Prepare your "List of 3" for each conversation type',
      ],
      rule: 'Every day must have a tangible deliverable, not just activities.',
    };
  },
});

export const logBlockerTool = new FunctionTool({
  name: 'log_blocker',
  description: 'Logs a blocker or obstacle encountered during validation',
  parameters: z.object({
    ventureId: z.string().describe('The venture ID'),
    planId: z.string().describe('Current plan ID'),
    blockerDescription: z.string().describe('What is blocking progress'),
    attemptedSolutions: z.array(z.string()).describe('What has been tried'),
    helpNeeded: z.string().describe('What kind of help would unblock this'),
  }),
  execute: async ({ ventureId, planId, blockerDescription, attemptedSolutions, helpNeeded }) => {
    const blockerId = `blocker_${Date.now()}`;

    // Identify blocker type for targeted advice
    const blockerTypes = {
      findingPeople: blockerDescription.toLowerCase().includes('find') || blockerDescription.toLowerCase().includes('reach'),
      gettingCommitment: blockerDescription.toLowerCase().includes('commitment') || blockerDescription.toLowerCase().includes('say yes'),
      mixedSignals: blockerDescription.toLowerCase().includes('mixed') || blockerDescription.toLowerCase().includes('confused'),
      technical: blockerDescription.toLowerCase().includes('build') || blockerDescription.toLowerCase().includes('technical'),
      timeEnergy: blockerDescription.toLowerCase().includes('time') || blockerDescription.toLowerCase().includes('busy'),
    };

    let specificAdvice: string[];
    if (blockerTypes.findingPeople) {
      specificAdvice = [
        'Try: friends/network in the space first (easiest)',
        'Organize your own meetup — host an "X professionals happy hour"',
        'LinkedIn search for titles tied to the problem',
        'Cold outreach last resort — but convert each to 2-3 warm intros',
        'Ask every person you DO talk to: "Who else should I talk to?"',
      ];
    } else if (blockerTypes.gettingCommitment) {
      specificAdvice = [
        'Are you asking for commitment? Many founders forget to ask.',
        'Pre-decide your ask before every meeting',
        'Push for a clear yes or no — wishy-washy middle is the only loss',
        'Try asking for smaller commitment first (intro, not purchase)',
        'Check: are these real earlyvangelists or just polite people?',
      ];
    } else if (blockerTypes.mixedSignals) {
      specificAdvice = [
        'This is normal! Look for patterns, not unanimity.',
        'Are you talking to a focused segment, or "everyone"?',
        'The excited ones — what do they have in common?',
        'The unexcited ones — are they actually your target?',
        'Focus on the angry ones (Irrationals), not the interested ones (Lovers)',
      ];
    } else {
      specificAdvice = [
        'Can you break this into a smaller first step?',
        'Is there a workaround that gets 80% of the value?',
        'Who in your network has faced this before?',
        'What would you do if you HAD to solve this in 24 hours?',
      ];
    }

    return {
      status: 'logged',
      blockerId,
      message: 'Blocker logged — let\'s work through this',
      data: {
        id: blockerId,
        ventureId,
        planId,
        blocker: blockerDescription,
        attempted: attemptedSolutions,
        needsHelp: helpNeeded,
        loggedAt: new Date().toISOString(),
      },
      advice: specificAdvice,
      reminder: 'Bad news = fast learning. Better to learn the idea is wrong on $5k of conversations than $50k of building.',
    };
  },
});
