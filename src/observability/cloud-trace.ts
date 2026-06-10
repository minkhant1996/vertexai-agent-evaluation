/**
 * Track 2: Cloud Trace Integration
 *
 * Integrates with Google Cloud Trace for production observability.
 * Provides visual tracing of agent reasoning and tool selection.
 */

import { randomUUID } from 'crypto';

// Cloud Trace span structure
export interface CloudTraceSpan {
  name: string;
  spanId: string;
  parentSpanId?: string;
  displayName: { value: string };
  startTime: string;
  endTime?: string;
  attributes: {
    attributeMap: Record<string, { stringValue?: { value: string }; intValue?: string }>;
  };
  status?: { code: 'OK' | 'ERROR'; message?: string };
}

export interface AgentTraceData {
  traceId: string;
  sessionId: string;
  userMessage: string;
  detectedIntent: string;
  expectedTool: string;
  actualToolsCalled: string[];
  response: string;
  latencyMs: number;
  success: boolean;
  failureReason?: string;
  spans: TraceSpan[];
}

export interface TraceSpan {
  name: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  events: TraceEvent[];
}

export interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number>;
}

/**
 * Cloud Trace client for agent tracing
 */
export class CloudTraceClient {
  private projectId: string;
  private enabled: boolean;
  private activeSpans: Map<string, TraceSpan> = new Map();
  private traces: Map<string, AgentTraceData> = new Map();

  constructor(projectId?: string) {
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.enabled = process.env.ENABLE_TRACING === 'true';
  }

  /**
   * Start a new agent trace
   */
  startTrace(sessionId: string, userMessage: string): string {
    const traceId = randomUUID().replace(/-/g, '');

    const trace: AgentTraceData = {
      traceId,
      sessionId,
      userMessage,
      detectedIntent: '',
      expectedTool: '',
      actualToolsCalled: [],
      response: '',
      latencyMs: 0,
      success: true,
      spans: [],
    };

    this.traces.set(traceId, trace);

    // Start root span
    this.startSpan(traceId, 'agent.request', {
      'user.message': userMessage.substring(0, 500),
      'session.id': sessionId,
    });

    return traceId;
  }

  /**
   * Start a span within a trace
   */
  startSpan(
    traceId: string,
    name: string,
    attributes: Record<string, string | number | boolean> = {},
    parentSpanId?: string
  ): string {
    const spanId = randomUUID().replace(/-/g, '').substring(0, 16);

    const span: TraceSpan = {
      name,
      spanId,
      parentSpanId,
      startTime: Date.now(),
      attributes,
      events: [],
    };

    this.activeSpans.set(spanId, span);

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    this.log('DEBUG', `Span started: ${name}`, { traceId, spanId });

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.attributes['status'] = status;

    this.activeSpans.delete(spanId);
    this.log('DEBUG', `Span ended: ${span.name}`, {
      spanId,
      duration: span.endTime - span.startTime,
    });
  }

  /**
   * Add event to a span
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, string | number>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Record intent detection
   */
  recordIntentDetection(traceId: string, spanId: string, intent: string, expectedTool: string): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.detectedIntent = intent;
      trace.expectedTool = expectedTool;
    }

    this.addSpanEvent(spanId, 'intent.detected', {
      intent,
      expectedTool,
    });
  }

  /**
   * Record tool call
   */
  recordToolCall(traceId: string, parentSpanId: string, toolName: string, input: Record<string, unknown>): string {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.actualToolsCalled.push(toolName);
    }

    const spanId = this.startSpan(traceId, `tool.${toolName}`, {
      'tool.name': toolName,
      'tool.input': JSON.stringify(input).substring(0, 500),
    }, parentSpanId);

    return spanId;
  }

  /**
   * Complete a trace
   */
  completeTrace(traceId: string, response: string, success: boolean = true, failureReason?: string): AgentTraceData | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.response = response;
    trace.success = success;
    trace.failureReason = failureReason;

    // Calculate total latency
    const rootSpan = trace.spans.find(s => s.name === 'agent.request');
    if (rootSpan && rootSpan.endTime) {
      trace.latencyMs = rootSpan.endTime - rootSpan.startTime;
    }

    // End any remaining active spans
    for (const span of trace.spans) {
      if (!span.endTime) {
        span.endTime = Date.now();
      }
    }

    this.log('INFO', 'Trace completed', {
      traceId,
      success,
      latencyMs: trace.latencyMs,
      toolsCalled: trace.actualToolsCalled.join(','),
    });

    return trace;
  }

  /**
   * Get trace data
   */
  getTrace(traceId: string): AgentTraceData | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get Cloud Trace URL for a trace
   */
  getCloudTraceUrl(traceId: string): string {
    return `https://console.cloud.google.com/traces/list?project=${this.projectId}&tid=${traceId}`;
  }

  /**
   * Export trace for Cloud Trace API
   */
  exportForCloudTrace(traceId: string): CloudTraceSpan[] {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    return trace.spans.map(span => ({
      name: `projects/${this.projectId}/traces/${traceId}/spans/${span.spanId}`,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      displayName: { value: span.name },
      startTime: new Date(span.startTime).toISOString(),
      endTime: span.endTime ? new Date(span.endTime).toISOString() : undefined,
      attributes: {
        attributeMap: Object.fromEntries(
          Object.entries(span.attributes).map(([k, v]) => [
            k,
            typeof v === 'number' ? { intValue: String(v) } : { stringValue: { value: String(v) } },
          ])
        ),
      },
      status: span.attributes['status'] === 'ERROR' ? { code: 'ERROR' } : { code: 'OK' },
    }));
  }

  /**
   * Get trace analytics
   */
  getAnalytics(): {
    totalTraces: number;
    successRate: number;
    avgLatency: number;
    intentAccuracy: number;
    toolUsage: Record<string, number>;
  } {
    const allTraces = Array.from(this.traces.values());

    if (allTraces.length === 0) {
      // Return zeros when no traces exist
      return {
        totalTraces: 0,
        successRate: 0,
        avgLatency: 0,
        intentAccuracy: 0,
        toolUsage: {},
      };
    }

    const successCount = allTraces.filter(t => t.success).length;
    const totalLatency = allTraces.reduce((sum, t) => sum + t.latencyMs, 0);

    // Calculate intent accuracy (did we call the expected tool?)
    const intentMatches = allTraces.filter(
      t => t.expectedTool && t.actualToolsCalled.includes(t.expectedTool)
    ).length;

    // Aggregate tool usage
    const toolUsage: Record<string, number> = {};
    for (const trace of allTraces) {
      for (const tool of trace.actualToolsCalled) {
        toolUsage[tool] = (toolUsage[tool] || 0) + 1;
      }
    }

    return {
      totalTraces: allTraces.length,
      successRate: successCount / allTraces.length,
      avgLatency: totalLatency / allTraces.length,
      intentAccuracy: intentMatches / allTraces.length,
      toolUsage,
    };
  }

  /**
   * Structured logging for Cloud Logging compatibility
   */
  private log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.enabled && level === 'DEBUG') return;

    const logEntry = {
      severity: level === 'WARN' ? 'WARNING' : level,
      message,
      timestamp: new Date().toISOString(),
      'logging.googleapis.com/trace': data?.traceId
        ? `projects/${this.projectId}/traces/${data.traceId}`
        : undefined,
      ...data,
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Clear old traces (memory management)
   */
  clearOldTraces(maxAgeMs: number = 3600000): void {
    const now = Date.now();

    for (const [traceId, trace] of this.traces) {
      const rootSpan = trace.spans.find(s => s.name === 'agent.request');
      if (rootSpan && now - rootSpan.startTime > maxAgeMs) {
        this.traces.delete(traceId);
      }
    }
  }
}

// Singleton instance
export const cloudTrace = new CloudTraceClient();

// Convenience exports
export const startTrace = cloudTrace.startTrace.bind(cloudTrace);
export const startSpan = cloudTrace.startSpan.bind(cloudTrace);
export const endSpan = cloudTrace.endSpan.bind(cloudTrace);
export const completeTrace = cloudTrace.completeTrace.bind(cloudTrace);
export const getTrace = cloudTrace.getTrace.bind(cloudTrace);
export const getAnalytics = cloudTrace.getAnalytics.bind(cloudTrace);
