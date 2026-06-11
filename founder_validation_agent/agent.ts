/**
 * ADK Entry Point for founder_validation_agent
 *
 * This file re-exports the root agent from src/agent.ts
 * to match ADK's expected folder structure.
 */

export { rootAgent as default, rootAgent } from '../src/agent.js';
