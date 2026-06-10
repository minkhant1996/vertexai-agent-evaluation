#!/bin/bash
# Track 2: Agent Simulation Runner
# Usage:
#   ./scripts/run-eval.sh                    # Run against local
#   ./scripts/run-eval.sh --deployed         # Run against Cloud Run
#   ./scripts/run-eval.sh --verbose          # Verbose output

set -e

# Parse arguments
DEPLOYED=false
for arg in "$@"; do
    case $arg in
        --deployed)
            DEPLOYED=true
            shift
            ;;
    esac
done

if [ "$DEPLOYED" = true ]; then
    AGENT_ENDPOINT="https://founder-validation-agent-356663565224.us-central1.run.app"
    AUTH_HEADER="Authorization: Basic $(echo -n 'judge:hackathon2024' | base64)"
else
    AGENT_ENDPOINT="${AGENT_ENDPOINT:-http://localhost:8000}"
    AUTH_HEADER=""
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   TRACK 2: AGENT SIMULATION & EVALUATION                   ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║   Requirements (per hackathon rules):                      ║"
echo "║   1. Agent Simulation - synthetic user testing             ║"
echo "║   2. Agent Observability - Cloud Trace debugging           ║"
echo "║   3. Agent Optimizer - instruction refinement              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Agent Endpoint: $AGENT_ENDPOINT"
echo "Mode: $([ "$DEPLOYED" = true ] && echo "DEPLOYED (Cloud Run)" || echo "LOCAL")"
echo ""

# Check if agent is running
if [ "$DEPLOYED" = true ]; then
    HEALTH_CHECK=$(curl -s -u "judge:hackathon2024" "$AGENT_ENDPOINT/health" 2>/dev/null || echo "failed")
else
    HEALTH_CHECK=$(curl -s "$AGENT_ENDPOINT/list-apps" 2>/dev/null || echo "failed")
fi

if [ "$HEALTH_CHECK" = "failed" ]; then
    echo "❌ Agent not responding at $AGENT_ENDPOINT"
    echo ""
    if [ "$DEPLOYED" = true ]; then
        echo "Check that Cloud Run service is running"
    else
        echo "Start the agent first with: npm run dev"
    fi
    echo ""
    exit 1
fi

echo "✓ Agent is running"
echo ""

# Run simulation
cd "$(dirname "$0")/.."

if [ "$DEPLOYED" = true ]; then
    # For deployed agent, include auth in endpoint
    AGENT_ENDPOINT="https://judge:hackathon2024@founder-validation-agent-356663565224.us-central1.run.app" \
    npx tsx src/scripts/run-simulation.ts "$@"
else
    AGENT_ENDPOINT="$AGENT_ENDPOINT" npx tsx src/scripts/run-simulation.ts "$@"
fi
