#!/bin/bash
# Vertex AI Agent Evaluation Metrics
# Official metrics following Google's guidelines

# Calculate trajectory_exact_match
# Returns 1 if predicted matches reference exactly (same tools, same order)
# Returns 0 otherwise
calculate_exact_match() {
    local predicted="$1"  # JSON array of tool calls
    local reference="$2"  # JSON array of tool calls

    # If reference is empty, return 1 (no trajectory expected)
    local ref_len=$(echo "$reference" | jq 'length')
    if [ "$ref_len" -eq 0 ]; then
        echo "1"
        return
    fi

    # Get lengths
    local pred_len=$(echo "$predicted" | jq 'length')

    # Different lengths = no match
    if [ "$pred_len" -ne "$ref_len" ]; then
        echo "0"
        return
    fi

    # Compare each tool name in order
    for ((i=0; i<ref_len; i++)); do
        local pred_tool=$(echo "$predicted" | jq -r ".[$i].tool_name // empty")
        local ref_tool=$(echo "$reference" | jq -r ".[$i].tool_name // empty")

        if [ "$pred_tool" != "$ref_tool" ]; then
            echo "0"
            return
        fi
    done

    echo "1"
}

# Calculate trajectory_precision (in-order match)
# Returns ratio of matched tools / reference tools
calculate_precision() {
    local predicted="$1"
    local reference="$2"

    local ref_len=$(echo "$reference" | jq 'length')

    # If reference is empty, return 1
    if [ "$ref_len" -eq 0 ]; then
        echo "1.0"
        return
    fi

    local pred_len=$(echo "$predicted" | jq 'length')

    # If no predictions, return 0
    if [ "$pred_len" -eq 0 ]; then
        echo "0.0"
        return
    fi

    local matched=0
    local ref_index=0

    # Check if predicted tools appear in order
    for ((i=0; i<pred_len; i++)); do
        local pred_tool=$(echo "$predicted" | jq -r ".[$i].tool_name // empty")

        if [ "$ref_index" -lt "$ref_len" ]; then
            local ref_tool=$(echo "$reference" | jq -r ".[$ref_index].tool_name // empty")
            if [ "$pred_tool" = "$ref_tool" ]; then
                ((matched++))
                ((ref_index++))
            fi
        fi
    done

    # Calculate precision
    echo "scale=2; $matched / $ref_len" | bc
}

# Calculate trajectory_any_order_match
# Returns ratio of reference tools found in predicted (any order)
calculate_any_order_match() {
    local predicted="$1"
    local reference="$2"

    local ref_len=$(echo "$reference" | jq 'length')

    # If reference is empty, return 1
    if [ "$ref_len" -eq 0 ]; then
        echo "1.0"
        return
    fi

    local matched=0

    # Get all predicted tool names
    local pred_tools=$(echo "$predicted" | jq -r '.[].tool_name // empty' | tr '\n' ' ')

    # Check each reference tool
    for ((i=0; i<ref_len; i++)); do
        local ref_tool=$(echo "$reference" | jq -r ".[$i].tool_name // empty")

        if echo "$pred_tools" | grep -q "$ref_tool"; then
            ((matched++))
        fi
    done

    echo "scale=2; $matched / $ref_len" | bc
}

# Calculate response_contains score
# Returns ratio of expected keywords found in response
calculate_response_contains() {
    local response="$1"
    local expected="$2"  # JSON array of keywords

    local expected_len=$(echo "$expected" | jq 'length')

    if [ "$expected_len" -eq 0 ]; then
        echo "1.0"
        return
    fi

    local response_lower=$(echo "$response" | tr '[:upper:]' '[:lower:]')
    local matched=0

    for ((i=0; i<expected_len; i++)); do
        local keyword=$(echo "$expected" | jq -r ".[$i]" | tr '[:upper:]' '[:lower:]')
        if echo "$response_lower" | grep -q "$keyword"; then
            ((matched++))
        fi
    done

    echo "scale=2; $matched / $expected_len" | bc
}

# Calculate response_not_contains score
# Returns 1 if none of the forbidden keywords are found, penalized otherwise
calculate_response_not_contains() {
    local response="$1"
    local forbidden="$2"  # JSON array of keywords

    local forbidden_len=$(echo "$forbidden" | jq 'length')

    if [ "$forbidden_len" -eq 0 ]; then
        echo "1.0"
        return
    fi

    local response_lower=$(echo "$response" | tr '[:upper:]' '[:lower:]')
    local violations=0

    for ((i=0; i<forbidden_len; i++)); do
        local keyword=$(echo "$forbidden" | jq -r ".[$i]" | tr '[:upper:]' '[:lower:]')
        if echo "$response_lower" | grep -q "$keyword"; then
            ((violations++))
        fi
    done

    echo "scale=2; 1 - ($violations / $forbidden_len)" | bc
}

# Export functions for use in main script
export -f calculate_exact_match
export -f calculate_precision
export -f calculate_any_order_match
export -f calculate_response_contains
export -f calculate_response_not_contains
