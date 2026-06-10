#!/usr/bin/env node
/**
 * Track 2: Simulation Runner CLI
 *
 * Usage:
 *   npm run simulate              # Run all simulations
 *   npm run simulate -- --easy    # Run easy scenarios only
 *   npm run simulate -- --hard    # Run hard scenarios only
 */

import { AgentSimulator, runSimulationCLI } from '../simulation/simulator.js';
import { EDGE_CASE_SCENARIOS, getScenariosByDifficulty } from '../simulation/edge-cases.js';

async function main() {
  const args = process.argv.slice(2);
  const endpoint = process.env.AGENT_ENDPOINT || 'http://localhost:8101';

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        TRACK 2: AGENT SIMULATION RUNNER                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse arguments
  const difficulty = args.find(a => ['--easy', '--medium', '--hard'].includes(a))?.replace('--', '') as 'easy' | 'medium' | 'hard' | undefined;
  const scenarioId = args.find(a => a.startsWith('--scenario='))?.replace('--scenario=', '');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const simulator = new AgentSimulator(endpoint);

  console.log(`Agent Endpoint: ${endpoint}`);
  console.log('');

  let results;

  if (scenarioId) {
    // Run single scenario
    const scenario = EDGE_CASE_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario not found: ${scenarioId}`);
      process.exit(1);
    }

    console.log(`Running single scenario: ${scenario.name}`);
    console.log('-'.repeat(60));

    const result = await simulator.runScenario(scenario);
    printScenarioResult(result, verbose);
    process.exit(result.passed ? 0 : 1);
  } else if (difficulty) {
    // Run by difficulty
    const scenarios = getScenariosByDifficulty(difficulty);
    console.log(`Running ${scenarios.length} ${difficulty} scenarios...`);
    console.log('-'.repeat(60));

    results = await simulator.runByDifficulty(difficulty);
  } else {
    // Run all
    console.log(`Running all ${EDGE_CASE_SCENARIOS.length} scenarios...`);
    console.log('-'.repeat(60));

    results = await simulator.runAllScenarios();
  }

  // Print results
  if (results) {
    printBatchResults(results, verbose);
  }
}

function printScenarioResult(result: any, verbose: boolean) {
  console.log('');
  console.log(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Score: ${(result.score * 100).toFixed(0)}%`);
  console.log(`Latency: ${result.metrics.totalLatencyMs}ms`);
  console.log(`Tools Called: ${result.metrics.toolsCalledCount}`);

  if (!result.passed && result.failureReasons.length > 0) {
    console.log('');
    console.log('Failure Reasons:');
    result.failureReasons.forEach((r: string) => console.log(`  - ${r}`));
  }

  if (verbose && result.turns.length > 0) {
    console.log('');
    console.log('Conversation:');
    result.turns.forEach((turn: any) => {
      console.log(`  [User]: ${turn.userMessage.substring(0, 100)}...`);
      console.log(`  [Agent]: ${turn.agentResponse.substring(0, 200)}...`);
      console.log(`  Tools: ${turn.toolsCalled.join(', ') || 'none'}`);
      console.log('');
    });
  }
}

function printBatchResults(results: any, verbose: boolean) {
  console.log('');
  console.log('═'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log('');

  // Overall stats
  const passRate = (results.passRate * 100).toFixed(1);
  // Pass threshold is 80% per project rules
  const passColor = results.passRate >= 0.9 ? '\x1b[32m' : results.passRate >= 0.8 ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`Pass Rate: ${passColor}${passRate}%${reset} (${results.passed}/${results.totalScenarios})`);
  console.log('');

  // By difficulty
  console.log('By Difficulty:');
  for (const [diff, stats] of Object.entries(results.summary.byDifficulty) as any) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const emoji = stats.passed === stats.total ? '✓' : stats.passed > 0 ? '◐' : '✗';
    console.log(`  ${emoji} ${diff}: ${rate}% (${stats.passed}/${stats.total})`);
  }
  console.log('');

  // Failed scenarios
  const failed = results.results.filter((r: any) => !r.passed);
  if (failed.length > 0) {
    console.log('Failed Scenarios:');
    failed.forEach((r: any) => {
      console.log(`  ✗ ${r.scenarioName}`);
      if (verbose) {
        r.failureReasons.forEach((reason: string) => {
          console.log(`    - ${reason}`);
        });
      }
    });
    console.log('');
  }

  // Common failures
  if (results.summary.commonFailures.length > 0) {
    console.log('Most Common Failures:');
    results.summary.commonFailures.slice(0, 5).forEach((f: string) => {
      console.log(`  • ${f}`);
    });
    console.log('');
  }

  // Final verdict (80% threshold per project rules)
  console.log('═'.repeat(60));
  if (results.passRate >= 0.9) {
    console.log('🎉 EXCELLENT! Agent exceeds production standards.');
  } else if (results.passRate >= 0.8) {
    console.log('✅ TARGET ACHIEVED! Agent meets production standards.');
  } else if (results.passRate >= 0.7) {
    console.log('⚠️  Close to target (80%), needs improvement.');
  } else {
    console.log('❌ Below target (80%), significant optimization required.');
  }
  console.log('═'.repeat(60));

  // Exit with appropriate code (pass = 80%+)
  process.exit(results.passRate >= 0.8 ? 0 : 1);
}

// Run
main().catch(err => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
