# Analyze Evaluation Results and Failure Clusters

> **Preview** — Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms", the Generative AI Service Specific Terms, and the "Agentic AI
> Services" Service Specific Terms. Pre-GA products are provided "as is" and might have limited
> support.

After running an evaluation, Agent Platform provides diagnostic tools to find root causes of
failure. You can analyze results at **three levels**: aggregate trends in the dashboard,
semantic groups in failure clusters, and granular logic paths in individual traces.

Related: [MANAGE_METRICS.md](./MANAGE_METRICS.md) ·
[ONLINE_MONITORS.md](./ONLINE_MONITORS.md) · [OPTIMIZE_AGENT_PROMPTS.md](./OPTIMIZE_AGENT_PROMPTS.md)

## Before you begin

- Run at least one evaluation (see *Evaluate your agents* or
  [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md)).
- Configure a Cloud Storage bucket for output if running offline evaluations.
- *(Optional)* Authenticate your environment if fetching results via the SDK.

## The evaluation dashboard (online monitors)

For agents with active Online Monitors:

1. Navigate to **Agent Platform > Agents**, then **Deployments**, and select your agent.
2. Click the **Dashboard** tab and select the **Evaluation** subsection.

- **Performance trends** — visualize how scores for metrics like Task Success or Tool Use
  Quality change across agent versions or timeframes.
- **Zero state** — for agents without active Online Monitors, this view identifies coverage gaps
  and provides a call-to-action to begin evaluation.

## View evaluation results with the SDK

The SDK provides built-in interactive visualizations for Colab/Jupyter that display both
aggregate summary metrics and per-case detailed results. Call `.show()` on the result object:

```python
from vertexai import evals, types

result = client.evals.evaluate(
    dataset=eval_dataset,
    metrics=[
        types.RubricMetric.FINAL_RESPONSE_QUALITY,
        types.RubricMetric.TOOL_USE_QUALITY,
        types.RubricMetric.HALLUCINATION,
        types.RubricMetric.SAFETY,
    ],
)
result.show()
```

The visualization includes:

- **Summary metrics** — aggregate scores across all eval cases, including mean score and pass
  rate for each metric.
- **Per-case results** — individual eval case scores that you can expand to inspect per-metric
  scores, rubric verdicts, and rationales.

## Interpret evaluation results

Predefined metrics return results in two formats:

- **Adaptive rubric metrics** — generate rubrics from the agent's configuration and the user's
  prompt. Each rubric gets an individual **Pass/Fail** verdict with a natural-language rationale.
  The overall score is the **passing rate** (proportion of rubrics that passed).
- **Static rubric metrics** — use a fixed set of criteria. For example, Hallucination segments
  the response into atomic claims and checks each against tool-usage evidence; Safety checks for
  PII, hate speech, dangerous content, and other policy violations. These return a single
  numerical score (0–1).

## Identify and triage failures

**Automatic Loss Analysis** analyzes the pass/fail signals from rubric-based metrics, classifies
failures into predefined loss patterns, and groups them into semantic clusters — helping you
understand not just **that** the agent failed, but **why** and **how**.

### Access failure clusters in the console

1. Navigate to **Agent Platform > Agents > Evaluation**.
2. Select the **Evaluations** tab.
3. Click the name of a completed evaluation run to open the report.
4. If clusters were detected, they appear in the **Failure Clusters** section.

### Generate failure clusters with the SDK

```python
loss_clusters = client.evals.generate_loss_clusters(
    eval_result=result,
)
loss_clusters.show()
```

## Loss pattern taxonomies

Automatic loss analysis classifies each failure into one or more predefined, actionable loss
patterns. There are **two taxonomies**, each aligned to a specific metric.

### Agent task success taxonomy

Used with **Agent Multi-turn Task Success** (`multi_turn_task_success_v1`). Covers high-level
behavioral failures across hallucination, instruction following, tool calling, tool output
handling, and tool quality:

| Category | Loss pattern | Description |
|---|---|---|
| Hallucination | Hallucination of Action | Claims to have completed an action without executing the necessary tool call. |
| Hallucination | Hallucination of Missing Information | Invents a detail (value, fact, date) not present in the user query or tool output. |
| Hallucination | Hallucination of Tool or Capability | Claims to have a tool or capability it does not possess. |
| Instruction Following | Constraint Violation | Performs the task but violates explicit user constraints (formatting rules, negative constraints). |
| Instruction Following | Futile Action (Under-Punting) | Takes an irrelevant action instead of stating the task is impossible with available tools. |
| Instruction Following | Incomplete Execution | Partially completes a task but stops prematurely or asks unnecessary permission for requested steps. |
| Instruction Following | Over-Punting | Declines a task, claiming it lacks a tool/capability it actually possesses. |
| Tool Calling | Incorrect Tool Selection | Selects the wrong tool from available options. |
| Tool Calling | Semantically Incorrect Tool Parameters | Call is syntactically valid but contains a logical/semantic error in parameter values. |
| Tool Calling | Syntactically Incorrect Tool Call | Has syntactical errors, missing mandatory parameters, or invalid argument values. |
| Tool Output Handling | Incorrect Tool Output Processing | Receives valid tool output but inaccurately extracts/processes/interprets it. |
| Tool Quality | Insufficient Tool Output | Tool executes successfully but returns insufficient/missing data needed to proceed. |
| Tool Quality | Tool Failure | Tool fails due to infrastructure issues (auth failures, timeouts, internal errors). |

### Tool use quality taxonomy

Used with **Agent Multi-turn Tool Use Quality** (`multi_turn_tool_use_quality_v1`). Focuses on
tool-calling correctness and tool-response handling:

| Category | Loss pattern | Description |
|---|---|---|
| Hallucination | Hallucination of Parameter Value | Invents a parameter value not provided by the user or derivable from context. |
| Hallucination | Hallucination of Tool | Attempts to call a function not in its defined toolset. |
| Tool Calling | Failure to Set Parameter | Omits a parameter needed to fulfill the user's constraints, defaulting to an unintended value. |
| Tool Calling | Incorrect Parameter Data Type | Provides a value of the wrong data type (e.g., string where an integer is required). |
| Tool Calling | Incorrect Parameter Mapping | Assigns a value to the wrong parameter (e.g., swapping start/end dates). |
| Tool Calling | Incorrect Parameter Value | Provides a logically/factually incorrect value, or fails to apply necessary data transformations. |
| Tool Calling | Incorrect Tool Selection | Selects the wrong function from its toolset. |
| Tool Calling | Invalid Tool Call Syntax | Generates a call with a syntax error preventing parsing/execution. |
| Tool Calling | Non-Existent Parameter | Includes a parameter argument not defined in the tool's signature. |
| Tool Calling | Omission of Required Tool Call | Fails to execute a necessary function (answering directly, skipping part of a compound request, or skipping a prerequisite). |
| Tool Calling | Under-Punting | Forces a tool call when it should respond with natural language (clarification, declining out-of-scope). |
| Tool Response | Irrelevant Tool Response | Tool succeeds but returns data not relevant to the user's query. |
| Tool Response | Tool Error | Tool returns an explicit error/failure status due to an external issue (API outage, invalid permissions). |

## Recommended triage workflow

1. **Start with summary metrics** to identify the lowest-scoring metrics across the dataset.
2. **Drill into per-case results** to find specific eval cases that failed.
3. **Generate failure clusters** to identify systemic loss patterns across failures.
4. **Drill into traces** to find the exact turn or tool call where the failure occurred
   (**Agent Platform > Agents > Deployments > [agent] > Traces** tab — select a trace to see the
   full conversation history and exact sequence of model inputs, tool calls, and responses).
5. **Identify the root cause** — use the loss pattern category to determine whether it's a prompt
   problem, a tool configuration problem, or a data problem.
6. **Apply a targeted fix** to system instructions, tool definitions, or few-shot examples.
7. **Re-run the evaluation** and compare scores to verify the improvement.

> Step 6 can be automated — see [OPTIMIZE_AGENT_PROMPTS.md](./OPTIMIZE_AGENT_PROMPTS.md).
