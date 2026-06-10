/**
 * Gemini Cost Calculator
 * ======================
 *
 * Calculates costs based on token usage and model pricing.
 * Supports both flat-rate and tiered pricing models.
 */

import pricingData from './pricing.json' with { type: 'json' };
import {
  GeminiModel,
  TokenUsage,
  CostCalculation,
  PricingData,
} from './types.js';

const pricing = pricingData as PricingData;

// =============================================================================
// COST CALCULATION
// =============================================================================

/**
 * Calculate cost for text generation
 *
 * @param model - The Gemini model ID
 * @param usage - Token usage from API response
 * @returns Cost breakdown in USD
 *
 * @example
 * const cost = calculateTextCost('gemini-2.0-flash', {
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   totalTokens: 1500
 * });
 */
export function calculateTextCost(
  model: GeminiModel,
  usage: TokenUsage
): CostCalculation {
  const modelInfo = pricing.models[model];

  if (!modelInfo) {
    console.warn(`[CostCalculator] Model '${model}' not found in pricing data`);
    return { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' };
  }

  const modelPricing = modelInfo.pricing;
  let inputRate: number;
  let outputRate: number;

  // Handle tiered pricing (over/under 200K tokens)
  if (modelPricing.input_under_200k !== undefined) {
    if (usage.inputTokens <= 200000) {
      inputRate = modelPricing.input_under_200k;
      outputRate = modelPricing.output_under_200k || 0;
    } else {
      inputRate = modelPricing.input_over_200k || modelPricing.input_under_200k;
      outputRate =
        modelPricing.output_over_200k || modelPricing.output_under_200k || 0;
    }
  } else {
    // Flat rate pricing
    inputRate = modelPricing.input || 0;
    outputRate = modelPricing.output || 0;
  }

  // Cost formula: (tokens / 1,000,000) × rate_per_million
  const inputCost = (usage.inputTokens / 1_000_000) * inputRate;
  const outputCost = (usage.outputTokens / 1_000_000) * outputRate;

  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
    currency: modelInfo.currency,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get pricing information for a model
 */
export function getModelPricing(model: GeminiModel) {
  return pricing.models[model];
}

/**
 * Get all available models
 */
export function getAvailableModels(): string[] {
  return Object.keys(pricing.models);
}

/**
 * Get text generation models only
 */
export function getTextModels(): string[] {
  return Object.entries(pricing.models)
    .filter(([, info]) => info.type === 'text')
    .map(([model]) => model);
}

/**
 * Estimate cost before making API call
 */
export function estimateCost(
  model: GeminiModel,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): CostCalculation {
  return calculateTextCost(model, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    totalTokens: estimatedInputTokens + estimatedOutputTokens,
  });
}

/**
 * Format cost for human-readable display
 */
export function formatCost(cost: CostCalculation): string {
  if (cost.totalCost < 0.01) {
    return `${(cost.totalCost * 100).toFixed(4)} cents`;
  }
  return `$${cost.totalCost.toFixed(6)} ${cost.currency}`;
}

/**
 * Get cost breakdown as percentages
 */
export function getCostBreakdown(cost: CostCalculation): {
  inputPercent: number;
  outputPercent: number;
} {
  if (cost.totalCost === 0) {
    return { inputPercent: 0, outputPercent: 0 };
  }
  return {
    inputPercent: Math.round((cost.inputCost / cost.totalCost) * 10000) / 100,
    outputPercent: Math.round((cost.outputCost / cost.totalCost) * 10000) / 100,
  };
}

/**
 * Get model recommendation based on use case
 */
export function getRecommendedModel(
  useCase: 'budget' | 'balanced' | 'quality' | 'premium'
): { model: string; costPer1kRequests: number; useCase: string } {
  return pricing.modelComparison[useCase];
}

/**
 * Compare costs across all models for given token usage
 */
export function compareModelCosts(usage: TokenUsage): Array<{
  model: string;
  name: string;
  cost: CostCalculation;
  formattedCost: string;
}> {
  return getTextModels()
    .map((model) => {
      const modelInfo = pricing.models[model];
      const cost = calculateTextCost(model as GeminiModel, usage);
      return {
        model,
        name: modelInfo.name,
        cost,
        formattedCost: formatCost(cost),
      };
    })
    .sort((a, b) => a.cost.totalCost - b.cost.totalCost);
}

/**
 * Calculate monthly cost projection
 */
export function projectMonthlyCost(
  model: GeminiModel,
  avgInputTokens: number,
  avgOutputTokens: number,
  requestsPerDay: number
): {
  dailyCost: number;
  weeklyCost: number;
  monthlyCost: number;
  formattedMonthly: string;
} {
  const costPerRequest = calculateTextCost(model, {
    inputTokens: avgInputTokens,
    outputTokens: avgOutputTokens,
    totalTokens: avgInputTokens + avgOutputTokens,
  });

  const dailyCost = costPerRequest.totalCost * requestsPerDay;

  return {
    dailyCost: Math.round(dailyCost * 100) / 100,
    weeklyCost: Math.round(dailyCost * 7 * 100) / 100,
    monthlyCost: Math.round(dailyCost * 30 * 100) / 100,
    formattedMonthly: `$${(dailyCost * 30).toFixed(2)} USD`,
  };
}
