#!/bin/bash
# Run Track 2 Demo: Simulation, Observability, Optimizer
# Usage: ./scripts/run-track2-demo.sh

set -e

AGENT_URL=${AGENT_URL:-"http://localhost:8000"}
API_URL="http://localhost:3001"

echo "=============================================="
echo "  TRACK 2: OPTIMIZE - Full Demo"
echo "=============================================="
echo "Agent: $AGENT_URL"
echo ""

# 1. Agent Simulation
echo "=== 1. AGENT SIMULATION ==="
echo "Running 5 edge-case scenarios..."
for id in EC001 EC002 EC003 EC008 EC015; do
  result=$(curl -s -X POST "$API_URL/api/simulation/run" \
    -H "Content-Type: application/json" \
    -d "{\"scenarioId\":\"$id\"}" | jq -r '[.scenarioName, if .passed then "✓ PASS" else "✗ FAIL" end] | join(": ")')
  echo "  $result"
done
echo ""

# 2. Agent Observability
echo "=== 2. AGENT OBSERVABILITY ==="
sim_count=$(curl -s "$API_URL/api/simulation/history" | jq 'length')
echo "  Simulations recorded: $sim_count"
echo "  Traces available at: $API_URL/api/observability/traces/all"
echo ""

# 3. Agent Optimizer
echo "=== 3. AGENT OPTIMIZER ==="
patterns=$(curl -s "$API_URL/api/optimizer/analyze-failures" | jq 'length')
echo "  Failure patterns detected: $patterns"

if [ "$patterns" -gt 0 ]; then
  echo "  Generating optimized prompt..."
  improvement=$(curl -s -X POST "$API_URL/api/optimizer/optimize" \
    -H "Content-Type: application/json" -d '{}' | jq '.optimization.expectedImprovementPercent')
  echo "  Expected improvement: ${improvement}%"
fi
echo ""

echo "=============================================="
echo "  Demo Complete!"
echo "=============================================="
echo ""
echo "View live simulations: http://localhost:8100"
echo "View deployed agent: https://founder-validation-agent-356663565224.us-central1.run.app/dev-ui"
