/**
 * Track 2: Observability Module
 *
 * Exports for tracing and Cloud Trace integration.
 */

// Export from tracing (primary interface)
export * from './tracing.js';

// Export cloud-trace items that don't conflict
export {
  CloudTraceSpan,
  AgentTraceData,
  CloudTraceClient,
  cloudTrace,
  startTrace,
  completeTrace,
  getTrace,
  getAnalytics,
} from './cloud-trace.js';

// Re-export with aliases for items that conflict
export {
  startSpan as cloudStartSpan,
  endSpan as cloudEndSpan,
} from './cloud-trace.js';
