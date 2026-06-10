/**
 * Observability & Tracing for Founder Validation Agent
 *
 * Integrates with Google Cloud Trace and provides structured logging
 * for debugging, monitoring, and evaluation purposes.
 */

import { randomUUID } from 'crypto';

// Trace levels
export type TraceLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Trace event types
export type TraceEventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'USER_MESSAGE'
  | 'AGENT_RESPONSE'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_END'
  | 'TOOL_CALL_ERROR'
  | 'GUARDRAIL_CHECK'
  | 'GUARDRAIL_BLOCK'
  | 'LLM_REQUEST'
  | 'LLM_RESPONSE'
  | 'ERROR';

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, unknown>;
  events: TraceEvent[];
  status: 'OK' | 'ERROR' | 'IN_PROGRESS';
}

export interface TraceEvent {
  timestamp: number;
  type: TraceEventType;
  level: TraceLevel;
  message: string;
  attributes?: Record<string, unknown>;
}

export interface TracingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  toolCallCounts: Record<string, number>;
  guardrailBlocks: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  costUsage: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
  modelUsage: Record<string, number>;
}

class TracingService {
  private spans: Map<string, TraceSpan> = new Map();
  private metrics: TracingMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    toolCallCounts: {},
    guardrailBlocks: 0,
    tokenUsage: { input: 0, output: 0, total: 0 },
    costUsage: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
    modelUsage: {},
  };
  private responseTimes: number[] = [];

  /**
   * Start a new trace span
   */
  startSpan(name: string, traceId?: string, parentSpanId?: string): TraceSpan {
    const span: TraceSpan = {
      spanId: randomUUID(),
      traceId: traceId || randomUUID(),
      parentSpanId,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: 'IN_PROGRESS',
    };

    this.spans.set(span.spanId, span);
    this.log('INFO', `Span started: ${name}`, { spanId: span.spanId, traceId: span.traceId });

    return span;
  }

  /**
   * End a trace span
   */
  endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK'): TraceSpan | undefined {
    const span = this.spans.get(spanId);
    if (!span) return undefined;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    // Update metrics
    if (span.name === 'agent_request') {
      this.metrics.totalRequests++;
      if (status === 'OK') {
        this.metrics.successfulRequests++;
      } else {
        this.metrics.failedRequests++;
      }
      this.responseTimes.push(span.duration);
      this.metrics.avgResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    this.log('INFO', `Span ended: ${span.name}`, {
      spanId,
      duration: span.duration,
      status,
    });

    return span;
  }

  /**
   * Add an event to a span
   */
  addEvent(
    spanId: string,
    type: TraceEventType,
    message: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    const event: TraceEvent = {
      timestamp: Date.now(),
      type,
      level: type.includes('ERROR') ? 'ERROR' : 'INFO',
      message,
      attributes,
    };

    span.events.push(event);

    // Track tool calls
    if (type === 'TOOL_CALL_START' && attributes?.toolName) {
      const toolName = attributes.toolName as string;
      this.metrics.toolCallCounts[toolName] =
        (this.metrics.toolCallCounts[toolName] || 0) + 1;
    }

    // Track guardrail blocks
    if (type === 'GUARDRAIL_BLOCK') {
      this.metrics.guardrailBlocks++;
    }
  }

  /**
   * Set span attributes
   */
  setAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.attributes = { ...span.attributes, ...attributes };
  }

  /**
   * Track token usage
   */
  trackTokens(input: number, output: number): void {
    this.metrics.tokenUsage.input += input;
    this.metrics.tokenUsage.output += output;
    this.metrics.tokenUsage.total += input + output;
  }

  /**
   * Track cost usage
   */
  trackCost(inputCost: number, outputCost: number): void {
    this.metrics.costUsage.inputCost += inputCost;
    this.metrics.costUsage.outputCost += outputCost;
    this.metrics.costUsage.totalCost += inputCost + outputCost;
  }

  /**
   * Track model usage
   */
  trackModel(model: string): void {
    this.metrics.modelUsage[model] = (this.metrics.modelUsage[model] || 0) + 1;
  }

  /**
   * Track full request with tokens, cost, and model
   */
  trackRequest(
    model: string,
    inputTokens: number,
    outputTokens: number,
    inputCost: number,
    outputCost: number
  ): void {
    this.trackTokens(inputTokens, outputTokens);
    this.trackCost(inputCost, outputCost);
    this.trackModel(model);
  }

  /**
   * Get cost summary
   */
  getCostSummary(): {
    totalCost: number;
    formattedCost: string;
    costByModel: Record<string, number>;
    avgCostPerRequest: number;
  } {
    const avgCost =
      this.metrics.totalRequests > 0
        ? this.metrics.costUsage.totalCost / this.metrics.totalRequests
        : 0;

    return {
      totalCost: this.metrics.costUsage.totalCost,
      formattedCost:
        this.metrics.costUsage.totalCost < 0.01
          ? `${(this.metrics.costUsage.totalCost * 100).toFixed(4)} cents`
          : `$${this.metrics.costUsage.totalCost.toFixed(6)} USD`,
      costByModel: {}, // Would need per-model tracking
      avgCostPerRequest: avgCost,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): TracingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
  }

  /**
   * Export traces for analysis
   */
  exportTraces(): TraceSpan[] {
    return Array.from(this.spans.values());
  }

  /**
   * Structured logging
   */
  log(level: TraceLevel, message: string, data?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'founder-validation-agent',
      ...data,
    };

    // Format for Google Cloud Logging compatibility
    const severity = level === 'DEBUG' ? 'DEBUG' : level === 'INFO' ? 'INFO' : level === 'WARN' ? 'WARNING' : 'ERROR';

    console.log(JSON.stringify({ severity, ...logEntry }));
  }

  /**
   * Clear old spans (memory management)
   */
  clearOldSpans(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [spanId, span] of this.spans) {
      if (span.endTime && now - span.endTime > maxAgeMs) {
        this.spans.delete(spanId);
      }
    }
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      toolCallCounts: {},
      guardrailBlocks: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      costUsage: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
      modelUsage: {},
    };
    this.responseTimes = [];
  }
}

// Singleton instance
export const tracer = new TracingService();

// Convenience functions
export const startSpan = tracer.startSpan.bind(tracer);
export const endSpan = tracer.endSpan.bind(tracer);
export const addEvent = tracer.addEvent.bind(tracer);
export const log = tracer.log.bind(tracer);
export const getMetrics = tracer.getMetrics.bind(tracer);
