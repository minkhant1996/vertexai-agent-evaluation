# Plan: Implement Official Vertex AI Agent Evaluation

## Overview

Align our evaluation system with Google's official Vertex AI Agent Evaluation guidelines.

---

## Current State

- TypeScript ADK agent running locally
- Simple curl-based evaluation with Gemini judge
- No trajectory tracking
- No official metrics

---

## Target State

- Full trajectory tracking (tool calls)
- Reference trajectories for each test case
- Official metrics: `trajectory_exact_match`, `trajectory_precision`, `latency`, `failure`
- Compatible data format with Vertex AI

---

## Implementation Plan

### Phase 1: Update Evaluation Dataset Schema

**File:** `eval/eval_dataset.json`

```json
{
  "eval_set_id": "founder_validation_agent_eval",
  "eval_cases": [
    {
      "eval_id": "clarify_vague_idea",
      "prompt": "I want to build something with AI that helps businesses",
      "reference_trajectory": [
        {
          "tool_name": "clarify_idea",
          "tool_input": {
            "idea": "AI tool for businesses"
          }
        }
      ],
      "expected_response_contains": ["problem", "customer", "specific"]
    },
    {
      "eval_id": "identify_assumptions",
      "prompt": "My idea: Pet health app for dog owners. Problem: they forget vet appointments.",
      "reference_trajectory": [
        {
          "tool_name": "identify_risky_assumptions",
          "tool_input": {}
        }
      ],
      "expected_response_contains": ["assumption", "risk", "validate"]
    }
  ]
}
```

### Phase 2: Capture Predicted Trajectory from Agent

**Task:** Parse SSE response to extract tool calls

The ADK agent returns tool calls in SSE events like:
```json
{
  "content": {
    "parts": [
      {
        "functionCall": {
          "name": "clarify_idea",
          "args": {"idea": "..."}
        }
      }
    ]
  }
}
```

**Implementation:**
1. Parse SSE response for `functionCall` parts
2. Build `predicted_trajectory` array:
```json
[
  {
    "tool_name": "clarify_idea",
    "tool_input": {"idea": "..."}
  }
]
```

### Phase 3: Implement Official Metrics

#### 3.1 Trajectory Exact Match

```bash
# Score = 1 if predicted == reference (same tools, same order)
# Score = 0 otherwise
```

**Logic:**
```
if length(predicted) != length(reference):
    return 0
for i in range(length):
    if predicted[i].tool_name != reference[i].tool_name:
        return 0
return 1
```

#### 3.2 Trajectory Precision (In-Order Match)

```bash
# Score = matched_tools / total_reference_tools
```

**Logic:**
```
matched = 0
ref_index = 0
for pred_tool in predicted:
    if ref_index < len(reference) and pred_tool.name == reference[ref_index].name:
        matched += 1
        ref_index += 1
return matched / len(reference)
```

#### 3.3 Trajectory Any-Order Match

```bash
# Score = tools_found_in_reference / total_reference_tools
```

**Logic:**
```
reference_names = [t.tool_name for t in reference]
matched = 0
for pred_tool in predicted:
    if pred_tool.tool_name in reference_names:
        matched += 1
        reference_names.remove(pred_tool.tool_name)
return matched / len(reference)
```

#### 3.4 Latency

```bash
# Track time from request to response
start_time = now()
response = call_agent(prompt)
latency = now() - start_time
```

#### 3.5 Failure

```bash
# failure = true if no valid response or error
# failure = false if valid response received
```

### Phase 4: Update Evaluation Script

**File:** `eval/vertex_eval.sh`

**Changes:**
1. Load eval dataset with reference trajectories
2. Capture predicted trajectory from agent response
3. Calculate all metrics per test case
4. Output results in official format

**Output Format:**
```json
{
  "eval_id": "clarify_vague_idea",
  "prompt": "I want to build something with AI...",
  "response": "Let me help you clarify...",
  "predicted_trajectory": [
    {"tool_name": "clarify_idea", "tool_input": {...}}
  ],
  "reference_trajectory": [
    {"tool_name": "clarify_idea", "tool_input": {...}}
  ],
  "metrics": {
    "trajectory_exact_match": 1,
    "trajectory_precision": 1.0,
    "trajectory_any_order_match": 1.0,
    "latency_in_seconds": 2.34,
    "failure": false
  }
}
```

### Phase 5: Add Custom Metrics (Optional)

#### 5.1 Essential Tools Present

Check if required tools were called:
```
required_tools = ["clarify_idea"]
called_tools = [t.tool_name for t in predicted_trajectory]
score = count(tool in called_tools for tool in required_tools) / len(required_tools)
```

#### 5.2 Response Follows Trajectory (LLM-based)

Use Gemini to judge if response matches trajectory:
```
prompt = """
Given this trajectory: {predicted_trajectory}
And this response: {response}
Does the response logically follow from the tool calls?
Score: 0 or 1
"""
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `eval/eval_dataset.json` | Update | Add reference_trajectory to each test case |
| `eval/vertex_eval.sh` | Rewrite | Implement trajectory parsing + official metrics |
| `eval/metrics.sh` | Create | Metric calculation functions |
| `eval/results/` | Output | Store evaluation results |

---

## Implementation Order

1. **Step 1:** Create new eval dataset with reference trajectories
2. **Step 2:** Update eval script to parse tool calls from SSE response
3. **Step 3:** Implement metric calculation functions
4. **Step 4:** Update results output format
5. **Step 5:** Test with all scenarios
6. **Step 6:** Add aggregate summary (mean, std dev)

---

## Success Criteria

- [ ] All test cases have reference trajectories defined
- [ ] Predicted trajectories captured from agent responses
- [ ] `trajectory_exact_match` metric working
- [ ] `trajectory_precision` metric working
- [ ] `latency_in_seconds` tracked
- [ ] `failure` status tracked
- [ ] Results output matches Vertex AI format
- [ ] Aggregate metrics (mean, std dev) calculated

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Phase 1: Dataset schema | 15 min |
| Phase 2: Trajectory capture | 30 min |
| Phase 3: Metrics implementation | 45 min |
| Phase 4: Script update | 30 min |
| Phase 5: Custom metrics | 20 min |
| **Total** | **~2.5 hours** |

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (dataset schema)
3. Implement phases sequentially
4. Test after each phase
