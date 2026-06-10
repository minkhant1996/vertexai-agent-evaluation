/**
 * Model Benchmark & Stress Testing
 * =================================
 *
 * Compare Gemini models for:
 * - Latency (response time)
 * - Cost (per request and projected monthly)
 * - Quality (optional evaluation scoring)
 * - Tool call accuracy
 *
 * Usage:
 *   npx ts-node src/gemini/model-benchmark.ts
 */

import {
  GeminiModel,
  TokenUsage,
  BenchmarkResult,
  ModelBenchmarkStats,
  ModelComparisonReport,
} from './types.js';
import {
  calculateTextCost,
  getTextModels,
  formatCost,
  projectMonthlyCost,
  compareModelCosts,
} from './cost-calculator.js';

// =============================================================================
// BENCHMARK RUNNER
// =============================================================================

class ModelBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Record a benchmark result
   */
  record(result: BenchmarkResult): void {
    this.results.push(result);
  }

  /**
   * Get stats for a specific model
   */
  getModelStats(model: GeminiModel): ModelBenchmarkStats {
    const modelResults = this.results.filter((r) => r.model === model);

    if (modelResults.length === 0) {
      return {
        model,
        totalRuns: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        avgInputTokens: 0,
        avgOutputTokens: 0,
        totalCost: 0,
        avgCostPerRequest: 0,
        errorRate: 0,
      };
    }

    const latencies = modelResults.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);

    const totalCost = modelResults.reduce((sum, r) => sum + r.cost.totalCost, 0);
    const avgInputTokens =
      modelResults.reduce((sum, r) => sum + r.usage.inputTokens, 0) /
      modelResults.length;
    const avgOutputTokens =
      modelResults.reduce((sum, r) => sum + r.usage.outputTokens, 0) /
      modelResults.length;

    const qualityScores = modelResults
      .filter((r) => r.responseQuality !== undefined)
      .map((r) => r.responseQuality!);
    const toolAccuracyScores = modelResults
      .filter((r) => r.toolCallAccuracy !== undefined)
      .map((r) => r.toolCallAccuracy!);

    return {
      model,
      totalRuns: modelResults.length,
      avgLatencyMs:
        modelResults.reduce((sum, r) => sum + r.latencyMs, 0) /
        modelResults.length,
      p50LatencyMs: latencies[p50Index] || 0,
      p95LatencyMs: latencies[p95Index] || 0,
      avgInputTokens,
      avgOutputTokens,
      totalCost,
      avgCostPerRequest: totalCost / modelResults.length,
      avgResponseQuality:
        qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : undefined,
      avgToolCallAccuracy:
        toolAccuracyScores.length > 0
          ? toolAccuracyScores.reduce((a, b) => a + b, 0) /
            toolAccuracyScores.length
          : undefined,
      errorRate: 0, // Would need error tracking
    };
  }

  /**
   * Generate comparison report across all tested models
   */
  generateReport(testSuite: string): ModelComparisonReport {
    const testedModels = [...new Set(this.results.map((r) => r.model))];
    const modelStats = testedModels.map((m) => this.getModelStats(m));

    // Find best in each category
    const bestSpeed = modelStats.reduce((best, current) =>
      current.avgLatencyMs < best.avgLatencyMs ? current : best
    );

    const bestValue = modelStats.reduce((best, current) => {
      const currentValue =
        (current.avgResponseQuality || 0.5) / (current.avgCostPerRequest || 1);
      const bestValue =
        (best.avgResponseQuality || 0.5) / (best.avgCostPerRequest || 1);
      return currentValue > bestValue ? current : best;
    });

    const bestQuality = modelStats.reduce((best, current) =>
      (current.avgResponseQuality || 0) > (best.avgResponseQuality || 0)
        ? current
        : best
    );

    return {
      timestamp: new Date(),
      testSuite,
      models: modelStats,
      recommendation: {
        bestQuality: bestQuality.model,
        bestValue: bestValue.model,
        bestSpeed: bestSpeed.model,
      },
    };
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }
}

// =============================================================================
// STRESS TEST UTILITIES
// =============================================================================

/**
 * Simulate token usage for different request sizes
 */
export function simulateUsage(
  size: 'small' | 'medium' | 'large' | 'xlarge'
): TokenUsage {
  const sizes = {
    small: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
    medium: { inputTokens: 1500, outputTokens: 800, totalTokens: 2300 },
    large: { inputTokens: 4000, outputTokens: 2000, totalTokens: 6000 },
    xlarge: { inputTokens: 10000, outputTokens: 4000, totalTokens: 14000 },
  };
  return sizes[size];
}

/**
 * Print cost comparison table
 */
export function printCostComparison(): void {
  console.log('\n========================================');
  console.log('GEMINI MODEL COST COMPARISON');
  console.log('========================================\n');

  const testUsage = simulateUsage('medium');
  console.log(`Test scenario: ${testUsage.inputTokens} input + ${testUsage.outputTokens} output tokens\n`);

  const comparison = compareModelCosts(testUsage);

  console.log('| Model                    | Input Cost | Output Cost | Total Cost |');
  console.log('|--------------------------|------------|-------------|------------|');

  for (const { model, cost } of comparison) {
    const inputCost = `$${cost.inputCost.toFixed(6)}`.padEnd(10);
    const outputCost = `$${cost.outputCost.toFixed(6)}`.padEnd(11);
    const totalCost = `$${cost.totalCost.toFixed(6)}`.padEnd(10);
    console.log(`| ${model.padEnd(24)} | ${inputCost} | ${outputCost} | ${totalCost} |`);
  }

  console.log('\n');
}

/**
 * Print monthly cost projections
 */
export function printMonthlyProjections(requestsPerDay: number): void {
  console.log('\n========================================');
  console.log(`MONTHLY COST PROJECTIONS (${requestsPerDay} requests/day)`);
  console.log('========================================\n');

  const models = getTextModels();
  const avgUsage = simulateUsage('medium');

  console.log('| Model                    | Daily     | Weekly    | Monthly   |');
  console.log('|--------------------------|-----------|-----------|-----------|');

  for (const model of models) {
    const projection = projectMonthlyCost(
      model as GeminiModel,
      avgUsage.inputTokens,
      avgUsage.outputTokens,
      requestsPerDay
    );

    const daily = `$${projection.dailyCost.toFixed(2)}`.padEnd(9);
    const weekly = `$${projection.weeklyCost.toFixed(2)}`.padEnd(9);
    const monthly = `$${projection.monthlyCost.toFixed(2)}`.padEnd(9);

    console.log(`| ${model.padEnd(24)} | ${daily} | ${weekly} | ${monthly} |`);
  }

  console.log('\n');
}

// =============================================================================
// MAIN
// =============================================================================

export const benchmark = new ModelBenchmark();

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Gemini Model Benchmark & Cost Analysis\n');

  printCostComparison();
  printMonthlyProjections(100); // 100 requests per day
  printMonthlyProjections(1000); // 1000 requests per day
}
