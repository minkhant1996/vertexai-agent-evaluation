/**
 * Minimal test agent to debug ADK
 */

import { LlmAgent } from '@google/adk';

export const rootAgent = new LlmAgent({
  name: 'test_agent',
  model: 'gemini-2.5-flash',
  description: 'A simple test agent',
  instruction: 'You are a helpful assistant. Keep responses brief and friendly.'
});

export default rootAgent;
