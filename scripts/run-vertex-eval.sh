#!/bin/bash
# Run Vertex AI Evaluation
# Usage: ./scripts/run-vertex-eval.sh [local|deployed]

set -e

MODE=${1:-"local"}

if [ "$MODE" == "deployed" ]; then
  AGENT_URL=$(cat .deployed_url 2>/dev/null || echo "https://founder-validation-agent-356663565224.us-central1.run.app")
  echo "=== Running evaluation against DEPLOYED agent ==="
else
  AGENT_URL="http://localhost:8000"
  echo "=== Running evaluation against LOCAL agent ==="
fi

echo "Agent URL: $AGENT_URL"
echo ""

# Run Vertex AI evaluation
AGENT_URL=$AGENT_URL bash eval/vertex_eval.sh

echo ""
echo "=== Evaluation Complete ==="
echo "Results saved to: eval/results/"
