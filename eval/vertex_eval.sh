#!/bin/bash
# Vertex AI Agent Evaluation - Official Format
# Implements trajectory tracking and official metrics

set -e

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Source metrics functions
source "$SCRIPT_DIR/metrics.sh"

# Configuration
AGENT_URL="${AGENT_URL:-http://localhost:8101}"
RESULTS_DIR="$SCRIPT_DIR/results"
DATASET_FILE="$SCRIPT_DIR/eval_dataset.json"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$RESULTS_DIR/eval_$TIMESTAMP.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  Vertex AI Agent Evaluation - Official Format${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Agent URL: ${GREEN}$AGENT_URL${NC}"
echo -e "Dataset:   ${GREEN}$DATASET_FILE${NC}"
echo ""

# Check prerequisites
if [ ! -f "$DATASET_FILE" ]; then
    echo -e "${RED}Error: Dataset file not found: $DATASET_FILE${NC}"
    exit 1
fi

# Load dataset
EVAL_CASES=$(jq -c '.eval_cases[]' "$DATASET_FILE")
TOTAL_CASES=$(echo "$EVAL_CASES" | wc -l | tr -d ' ')

echo -e "${GREEN}Running $TOTAL_CASES evaluation cases...${NC}"
echo ""

# Initialize results
echo "{" > "$RESULTS_FILE"
echo "  \"eval_set_id\": \"$(jq -r '.eval_set_id' "$DATASET_FILE")\"," >> "$RESULTS_FILE"
echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$RESULTS_FILE"
echo "  \"agent_url\": \"$AGENT_URL\"," >> "$RESULTS_FILE"
echo "  \"results\": [" >> "$RESULTS_FILE"

# Counters for summary
PASSED=0
FAILED=0
TOTAL_EXACT_MATCH=0
TOTAL_PRECISION=0
TOTAL_LATENCY=0
FIRST_RESULT=true

# Function to call agent and capture trajectory
call_agent_with_trajectory() {
    local prompt="$1"
    local session_id="eval_${TIMESTAMP}_${RANDOM}"

    # Create session
    curl -s -X POST "$AGENT_URL/apps/src/users/eval/sessions/$session_id" \
        -H "Content-Type: application/json" \
        -d '{}' > /dev/null 2>&1

    sleep 1

    # Record start time
    local start_time=$(python3 -c "import time; print(time.time())")

    # Send message and capture full response
    local raw_response=$(curl -s -X POST "$AGENT_URL/run_sse" \
        -H "Content-Type: application/json" \
        -d "{
            \"appName\": \"src\",
            \"userId\": \"eval\",
            \"sessionId\": \"$session_id\",
            \"newMessage\": {
                \"role\": \"user\",
                \"parts\": [{\"text\": $(echo "$prompt" | jq -Rs .)}]
            },
            \"streaming\": false
        }" 2>/dev/null)

    # Record end time
    local end_time=$(python3 -c "import time; print(time.time())")
    local latency=$(python3 -c "print(round($end_time - $start_time, 2))")

    # Save raw response to temp file for parsing
    local tmp_file="/tmp/eval_response_$$"
    echo "$raw_response" > "$tmp_file"

    # Extract all text parts - use grep and sed to get JSON data lines
    local response_text=$(grep -o 'data: {[^}]*"text":"[^"]*"[^}]*}' "$tmp_file" 2>/dev/null | \
        sed 's/data: //' | \
        jq -r '.content.parts[]?.text // empty' 2>/dev/null | \
        tr '\n' ' ' | sed 's/  */ /g')

    # If that didn't work, try a simpler extraction
    if [ -z "$response_text" ]; then
        response_text=$(grep -o '"text":"[^"]*"' "$tmp_file" 2>/dev/null | \
            head -5 | \
            sed 's/"text":"//g; s/"//g' | \
            tr '\n' ' ')
    fi

    # Extract tool calls - look for functionCall
    local tool_calls="[]"
    local tools_found=$(grep -o '"functionCall":{[^}]*"name":"[^"]*"' "$tmp_file" 2>/dev/null | \
        grep -o '"name":"[^"]*"' | \
        sed 's/"name":"//g; s/"//g' | \
        sort -u)

    if [ -n "$tools_found" ]; then
        while IFS= read -r tool_name; do
            if [ -n "$tool_name" ]; then
                tool_calls=$(echo "$tool_calls" | jq --arg name "$tool_name" '. + [{tool_name: $name, tool_input: {}}]')
            fi
        done <<< "$tools_found"
    fi

    local failure="false"
    rm -f "$tmp_file"

    # Check for failure
    if [ -z "$response_text" ]; then
        failure="true"
    fi

    # Output as JSON
    jq -n \
        --arg response "$response_text" \
        --argjson trajectory "$tool_calls" \
        --arg latency "$latency" \
        --arg failure "$failure" \
        '{response: $response, predicted_trajectory: $trajectory, latency_in_seconds: ($latency | tonumber), failure: ($failure == "true")}'
}

# Process each eval case
while IFS= read -r eval_case; do
    eval_id=$(echo "$eval_case" | jq -r '.eval_id')
    name=$(echo "$eval_case" | jq -r '.name')
    prompt=$(echo "$eval_case" | jq -r '.prompt')
    reference_trajectory=$(echo "$eval_case" | jq -c '.reference_trajectory // []')
    expected_contains=$(echo "$eval_case" | jq -c '.expected_response_contains // []')
    expected_not_contains=$(echo "$eval_case" | jq -c '.expected_response_not_contains // []')

    echo -e "${CYAN}--- $name ($eval_id) ---${NC}"
    echo -e "Prompt: ${prompt:0:60}..."

    # Call agent
    agent_result=$(call_agent_with_trajectory "$prompt")

    response=$(echo "$agent_result" | jq -r '.response')
    predicted_trajectory=$(echo "$agent_result" | jq -c '.predicted_trajectory')
    latency=$(echo "$agent_result" | jq -r '.latency_in_seconds')
    failure=$(echo "$agent_result" | jq -r '.failure')

    echo -e "Response: ${response:0:80}..."
    echo -e "Tools called: $(echo "$predicted_trajectory" | jq -r '[.[].tool_name] | join(", ") // "none"')"

    # Calculate metrics
    if [ "$failure" = "true" ]; then
        exact_match="0"
        precision="0"
        any_order="0"
        contains_score="0"
        not_contains_score="0"
        echo -e "${RED}  FAILURE - No response${NC}"
        ((FAILED++))
    else
        exact_match=$(calculate_exact_match "$predicted_trajectory" "$reference_trajectory")
        precision=$(calculate_precision "$predicted_trajectory" "$reference_trajectory")
        any_order=$(calculate_any_order_match "$predicted_trajectory" "$reference_trajectory")
        contains_score=$(calculate_response_contains "$response" "$expected_contains")
        not_contains_score=$(calculate_response_not_contains "$response" "$expected_not_contains")

        # Calculate overall score
        overall=$(echo "scale=2; ($exact_match + $precision + $contains_score + $not_contains_score) / 4" | bc)

        echo -e "  trajectory_exact_match: $exact_match"
        echo -e "  trajectory_precision: $precision"
        echo -e "  response_contains: $contains_score"
        echo -e "  latency: ${latency}s"

        # Determine pass/fail (threshold: 0.7)
        pass_check=$(echo "$overall >= 0.7" | bc)
        if [ "$pass_check" -eq 1 ]; then
            echo -e "${GREEN}  PASS (score: $overall)${NC}"
            ((PASSED++))
        else
            echo -e "${RED}  FAIL (score: $overall)${NC}"
            ((FAILED++))
        fi

        # Accumulate for averages
        TOTAL_EXACT_MATCH=$(echo "$TOTAL_EXACT_MATCH + $exact_match" | bc)
        TOTAL_PRECISION=$(echo "$TOTAL_PRECISION + $precision" | bc)
    fi

    TOTAL_LATENCY=$(echo "$TOTAL_LATENCY + $latency" | bc)

    # Write result to file
    if [ "$FIRST_RESULT" = "true" ]; then
        FIRST_RESULT=false
    else
        echo "," >> "$RESULTS_FILE"
    fi

    cat >> "$RESULTS_FILE" << EOF
    {
      "eval_id": "$eval_id",
      "name": "$name",
      "prompt": $(echo "$prompt" | jq -Rs .),
      "response": $(echo "$response" | jq -Rs .),
      "predicted_trajectory": $predicted_trajectory,
      "reference_trajectory": $reference_trajectory,
      "metrics": {
        "trajectory_exact_match": $exact_match,
        "trajectory_precision": $precision,
        "trajectory_any_order_match": $any_order,
        "response_contains_score": $contains_score,
        "response_not_contains_score": $not_contains_score,
        "latency_in_seconds": $latency,
        "failure": $failure
      }
    }
EOF

    echo ""
done <<< "$EVAL_CASES"

# Calculate aggregates
if [ "$TOTAL_CASES" -gt 0 ]; then
    AVG_EXACT_MATCH=$(echo "scale=2; $TOTAL_EXACT_MATCH / $TOTAL_CASES" | bc)
    AVG_PRECISION=$(echo "scale=2; $TOTAL_PRECISION / $TOTAL_CASES" | bc)
    AVG_LATENCY=$(echo "scale=2; $TOTAL_LATENCY / $TOTAL_CASES" | bc)
    PASS_RATE=$(echo "scale=2; $PASSED / $TOTAL_CASES * 100" | bc)
else
    AVG_EXACT_MATCH="0"
    AVG_PRECISION="0"
    AVG_LATENCY="0"
    PASS_RATE="0"
fi

# Close results array and add aggregates
cat >> "$RESULTS_FILE" << EOF
  ],
  "aggregate_metrics": {
    "total_cases": $TOTAL_CASES,
    "passed": $PASSED,
    "failed": $FAILED,
    "pass_rate": $PASS_RATE,
    "mean_trajectory_exact_match": $AVG_EXACT_MATCH,
    "mean_trajectory_precision": $AVG_PRECISION,
    "mean_latency_in_seconds": $AVG_LATENCY
  }
}
EOF

# Print summary
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  EVALUATION SUMMARY${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "Total Cases:              $TOTAL_CASES"
echo -e "Passed:                   ${GREEN}$PASSED${NC}"
echo -e "Failed:                   ${RED}$FAILED${NC}"
echo -e "Pass Rate:                ${CYAN}${PASS_RATE}%${NC}"
echo ""
echo -e "${BLUE}Aggregate Metrics:${NC}"
echo -e "  Mean Exact Match:       $AVG_EXACT_MATCH"
echo -e "  Mean Precision:         $AVG_PRECISION"
echo -e "  Mean Latency:           ${AVG_LATENCY}s"
echo ""
echo -e "Results saved to: ${GREEN}$RESULTS_FILE${NC}"
echo ""
