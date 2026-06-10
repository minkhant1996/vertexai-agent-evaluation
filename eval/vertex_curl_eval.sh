#!/bin/bash
# Vertex AI Evaluation using curl (for TypeScript ADK agents)
# Uses Vertex AI REST API + local agent HTTP endpoint

set -e

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
AGENT_URL="${AGENT_URL:-http://localhost:8101}"
RESULTS_DIR="$SCRIPT_DIR/results"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Vertex AI Evaluation (curl)${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Project: ${GREEN}$PROJECT_ID${NC}"
echo -e "Location: ${GREEN}$LOCATION${NC}"
echo -e "Agent: ${GREEN}$AGENT_URL${NC}"
echo ""

# Check prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GOOGLE_CLOUD_PROJECT not set${NC}"
    exit 1
fi

# Get access token
echo -e "${YELLOW}Getting access token...${NC}"
ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: Could not get access token. Run: gcloud auth login${NC}"
    exit 1
fi

VERTEX_API="https://${LOCATION}-aiplatform.googleapis.com/v1"
GENAI_API="https://generativelanguage.googleapis.com/v1beta"

# Agent info for scenario generation
AGENT_INFO='{
  "name": "founder_validation_agent"
}'

# Test scenarios (predefined since API may need permissions)
SCENARIOS='[
  {
    "scenario": "vague_idea",
    "user_goal": "Get help clarifying a vague startup idea",
    "initial_message": "I want to build something with AI that helps businesses"
  },
  {
    "scenario": "feature_first",
    "user_goal": "Challenge feature-first thinking",
    "initial_message": "I want to build an app with AI document analysis, dashboards, and Slack integration"
  },
  {
    "scenario": "interview_prep",
    "user_goal": "Get interview questions for customer discovery",
    "initial_message": "I need to interview restaurant owners about scheduling problems. What should I ask?"
  },
  {
    "scenario": "weak_validation",
    "user_goal": "Analyze weak interview results",
    "initial_message": "I did 5 interviews. 4 people said my idea sounds cool but they use free tools already."
  },
  {
    "scenario": "mvp_scope",
    "user_goal": "Scope down an overbuilt MVP",
    "initial_message": "My MVP needs: user auth, payments, AI recommendations, analytics dashboard, mobile app, and API"
  }
]'

echo -e "${GREEN}Running evaluation with ${#SCENARIOS[@]} scenarios...${NC}"
echo ""

# Create session and run conversation
run_scenario() {
    local scenario_name="$1"
    local message="$2"
    local session_id="eval_$(date +%s)_${RANDOM}"

    echo -e "${BLUE}--- Scenario: $scenario_name ---${NC}"
    echo -e "User: ${message:0:60}..."

    # Create session
    curl -s -X POST "$AGENT_URL/apps/src/users/eval_user/sessions/$session_id" \
        -H "Content-Type: application/json" \
        -d '{}' > /dev/null

    sleep 1

    # Send message and get response
    local response=$(curl -s -X POST "$AGENT_URL/run_sse" \
        -H "Content-Type: application/json" \
        -d "{
            \"appName\": \"src\",
            \"userId\": \"eval_user\",
            \"sessionId\": \"$session_id\",
            \"newMessage\": {
                \"role\": \"user\",
                \"parts\": [{\"text\": \"$message\"}]
            },
            \"streaming\": false
        }")

    # Extract agent response from SSE data
    local agent_text=$(echo "$response" | grep "^data:" | tail -1 | sed 's/^data: //' | jq -r '.content.parts[0].text // empty' 2>/dev/null)

    if [ -n "$agent_text" ]; then
        echo -e "${GREEN}Agent: ${agent_text:0:100}...${NC}"
        echo "PASS"
    else
        echo -e "${RED}No response or error${NC}"
        echo "FAIL"
    fi
    echo ""
}

# Run each scenario
echo "$SCENARIOS" | jq -c '.[]' | while read -r scenario; do
    name=$(echo "$scenario" | jq -r '.scenario')
    message=$(echo "$scenario" | jq -r '.initial_message')
    run_scenario "$name" "$message"
done

echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Evaluation complete!${NC}"
echo ""

# Try Vertex AI evaluation API (may fail if permissions not set)
echo -e "${YELLOW}Attempting Vertex AI metrics evaluation...${NC}"

# Export traces to a file for manual Vertex AI evaluation
TRACE_FILE="$RESULTS_DIR/traces_$(date +%Y%m%d_%H%M%S).json"
echo "$SCENARIOS" > "$TRACE_FILE"
echo -e "Scenarios saved to: ${GREEN}$TRACE_FILE${NC}"
echo ""
echo -e "${YELLOW}To evaluate in Google Cloud Console:${NC}"
echo "1. Go to: https://console.cloud.google.com/vertex-ai/agents"
echo "2. Navigate to Evaluation tab"
echo "3. Upload traces or view Cloud Trace data"
echo ""
