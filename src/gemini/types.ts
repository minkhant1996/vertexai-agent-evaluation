/**
 * Gemini Model Types & Pricing
 * ============================
 *
 * Type definitions for Gemini model comparison and cost tracking.
 * Used for stress testing and model benchmarking.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Thinking levels for Gemini 3.x models
 */
export enum ThinkingLevel {
  MINIMAL = 'MINIMAL',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// =============================================================================
// MODEL TYPES
// =============================================================================

/**
 * Available text generation models
 *
 * Model Selection Guide:
 * ----------------------
 * | Model                    | Best For                | Cost/1M tokens |
 * |--------------------------|-------------------------|----------------|
 * | gemini-2.0-flash         | Current default (ADK)   | $0.10/$0.40    |
 * | gemini-2.5-flash-lite    | Simple tasks, budget    | $0.10/$0.40    |
 * | gemini-2.5-flash         | General use + thinking  | $0.30/$2.50    |
 * | gemini-3.1-flash-lite    | Budget with thinking    | $0.25/$1.50    |
 * | gemini-3-flash-preview   | Balanced with thinking  | $0.50/$3.00    |
 * | gemini-3.5-flash         | Latest fast model       | $1.50/$9.00    |
 * | gemini-2.5-pro           | Complex reasoning       | $1.25-2.50/$10-15 |
 * | gemini-3.1-pro-preview   | Highest quality         | $2.00-4.00/$12-18 |
 */
export type GeminiTextModel =
  | 'gemini-2.0-flash' // Current ADK default
  | 'gemini-3.5-flash' // Latest fast model with thinking
  | 'gemini-3.1-flash-lite' // Budget option
  | 'gemini-3-flash-preview' // Preview with thinking
  | 'gemini-3.1-pro-preview' // Highest quality
  | 'gemini-2.5-flash' // Stable, cost-effective
  | 'gemini-2.5-flash-lite' // Cheapest option
  | 'gemini-2.5-pro'; // Premium quality

export type GeminiModel = GeminiTextModel;

// =============================================================================
// TOKEN & COST INTERFACES
// =============================================================================

/**
 * Token usage statistics from API response
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Cost calculation result in USD
 */
export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

// =============================================================================
// PRICING DATA TYPES
// =============================================================================

export interface ModelPricing {
  input?: number;
  output?: number;
  cached_input?: number;
  audio_input?: number;
  input_under_200k?: number;
  input_over_200k?: number;
  output_under_200k?: number;
  output_over_200k?: number;
  cached_input_under_200k?: number;
  cached_input_over_200k?: number;
}

export interface ModelInfo {
  name: string;
  type: string;
  pricing: ModelPricing;
  currency: string;
  unit: string;
  thinkingLevels?: string[];
  thinkingBudget?: boolean;
  maxOutputTokens?: number;
  contextWindow?: number;
}

export interface PricingData {
  models: Record<string, ModelInfo>;
  thinkingLevels: Record<string, { description: string; multiplier: number }>;
  modelComparison: Record<
    string,
    { model: string; costPer1kRequests: number; useCase: string }
  >;
}

// =============================================================================
// BENCHMARK INTERFACES
// =============================================================================

/**
 * Result from a single model benchmark run
 */
export interface BenchmarkResult {
  model: GeminiModel;
  testCase: string;
  latencyMs: number;
  usage: TokenUsage;
  cost: CostCalculation;
  responseQuality?: number; // 0-1 score if evaluated
  toolCallAccuracy?: number; // 0-1 score
  timestamp: Date;
}

/**
 * Aggregated benchmark stats for a model
 */
export interface ModelBenchmarkStats {
  model: GeminiModel;
  totalRuns: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCost: number;
  avgCostPerRequest: number;
  avgResponseQuality?: number;
  avgToolCallAccuracy?: number;
  errorRate: number;
}

/**
 * Comparison report between models
 */
export interface ModelComparisonReport {
  timestamp: Date;
  testSuite: string;
  models: ModelBenchmarkStats[];
  recommendation: {
    bestQuality: GeminiModel;
    bestValue: GeminiModel;
    bestSpeed: GeminiModel;
  };
}
