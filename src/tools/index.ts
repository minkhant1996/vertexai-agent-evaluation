// Export all tools for the Founder Validation Agent

export { clarifyIdeaTool, saveVentureTool } from './clarify-idea.tool.js';
export { identifyAssumptionsTool, saveAssumptionsTool } from './identify-assumptions.tool.js';
export { generateInterviewQuestionsTool, saveInterviewNotesTool } from './interview-questions.tool.js';
export { defineMVPTool, saveMVPScopeTool } from './mvp-scope.tool.js';
export { create7DayPlanTool, saveValidationPlanTool, logBlockerTool } from './validation-plan.tool.js';

// Tool groups for different validation phases
export const ideaClarificationTools = ['clarifyIdeaTool', 'saveVentureTool'];
export const assumptionTools = ['identifyAssumptionsTool', 'saveAssumptionsTool'];
export const interviewTools = ['generateInterviewQuestionsTool', 'saveInterviewNotesTool'];
export const mvpTools = ['defineMVPTool', 'saveMVPScopeTool'];
export const planningTools = ['create7DayPlanTool', 'saveValidationPlanTool', 'logBlockerTool'];
