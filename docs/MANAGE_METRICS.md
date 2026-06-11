# Manage Evaluation Metrics

> **Preview** — Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms", the Generative AI Service Specific Terms, and the "Agentic AI
> Services" Service Specific Terms. Pre-GA products are provided "as is" and might have limited
> support.

The **Metric Registry** lets you define, store, and manage reusable configurations for how your
agents are evaluated. Instead of configuring criteria for every test run, save standardized
metrics — such as a custom LLM-based safety rubric or a Python function for execution accuracy —
and apply them consistently to both **offline assessments** and **continuous online monitors**.

Related: [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md) ·
[ONLINE_MONITORS.md](./ONLINE_MONITORS.md) · [ANALYZE_RESULTS.md](./ANALYZE_RESULTS.md)

## Before you begin

- A Google Cloud project with the **Agent Platform API** enabled.
- *(Optional)* Initialize the Agent Platform SDK (see *Evaluate your agents*).

## Metric types

| Type | Description |
|---|---|
| **Predefined metrics** | Managed metrics provided by Google, including multi-turn raters for task success, tool use quality, and trajectory compliance. |
| **Custom LLM metrics** | Natural-language rubrics where a "Judge LLM" evaluates a response based on your criteria and rating scales. |
| **Custom code metrics** | Python functions that programmatically validate agent behavior (e.g., checking output format or verifying a tool response). |

## Predefined metrics

Access predefined metrics in the SDK via `types.RubricMetric.METRIC_NAME`. For full input
requirements and output formats, see *Details for managed rubric-based metrics*.

### Single-turn agent metrics

Evaluate a single interaction (one prompt and one response, possibly with intermediate tool
calls):

| Metric | Type | SDK accessor | Description |
|---|---|---|---|
| Agent Final Response Quality | Adaptive rubric | `types.RubricMetric.FINAL_RESPONSE_QUALITY` | Comprehensive evaluation that auto-generates rubric criteria from the agent's configuration (system instructions, tool declarations) and the user's prompt. |
| Agent Hallucination | Static rubric | `types.RubricMetric.HALLUCINATION` | Checks factuality by segmenting the response into atomic claims and verifying each is grounded in tool usage from intermediate events. |
| Agent Tool Use Quality | Adaptive rubric | `types.RubricMetric.TOOL_USE_QUALITY` | Evaluates appropriate tool selection, correct parameter usage, and adherence to the specified sequence of operations. |
| Safety | Static rubric | `types.RubricMetric.SAFETY` | Assesses safety-policy violations (PII/demographic data, hate speech, dangerous content, harassment, sexually explicit content). Returns **1** for safe, **0** for unsafe. |

### Multi-turn agent metrics

Analyze the full conversation context across multiple turns:

| Metric | Type | SDK accessor | Description |
|---|---|---|---|
| Agent Multi-turn Task Success | Adaptive rubric | `types.RubricMetric.MULTI_TURN_TASK_SUCCESS` | Evaluates whether the agent achieved the conversation goal(s). Reference-free; focuses on **whether** the goal was achieved, not how. |
| Agent Multi-turn Tool Use Quality | Adaptive rubric | `types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY` | Evaluates function-call quality across turns — whether the agent called the right tools with correct arguments at the right time. |
| Agent Multi-turn Trajectory Quality | Adaptive rubric | `types.RubricMetric.MULTI_TURN_TRAJECTORY_QUALITY` | Evaluates the overall path — **how** the agent achieved the goal, whether the reasoning path was logical and efficient. |

### Use predefined metrics in the SDK

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
result.show()  # visualize in Colab
```

## Manage metrics in the console

1. Navigate to **Agent Platform > Agents > Evaluation**.
2. Click the **Metrics** tab to view the registry.
3. **Create a metric** — click **New metric** and select **Custom LLM metric** or
   **Custom code metric**.
4. **Define rubrics** — for LLM metrics, use the **Sample** buttons to quickly populate
   instructions, criteria (e.g., *Clarity*, *Excitement*), and rating scores.
5. **View and edit** — click any metric name to view its definition (read-only), or use More
   options (⋮) to **Duplicate** or **Delete** the resource.

## Manage metrics with the SDK

### Register a custom LLM metric

```python
from vertexai import evals, types

tone_check_metric = types.LLMMetric(
    name="tone_check",
    prompt_template="Analyze the tone of the response ...",
    result_parsing_function="""
      import json, re
      def parse_results(responses):
          response = json.loads(responses[0])
          return {"score": response.get("score", 0.0),
                  "explanation": response.get("explanation", "default explanation")}
      """,
)

tone_check_metric_path = client.evals.create_evaluation_metric(metric=tone_check_metric)
```

### Register a custom code metric

```python
from vertexai import evals, types

accuracy_metric_code = """
def evaluate(instance: dict) -> float:
    agent_data = instance.get('agent_eval_data', {})
    turns = agent_data.get('turns', [])
    for turn in turns:
        ...
"""

accuracy_metric = types.CodeExecutionMetric(
    name="multi_turn_accuracy",
    custom_function=accuracy_metric_code,
)

accuracy_metric_path = client.evals.create_evaluation_metric(metric=accuracy_metric)
```

> For fuller, runnable examples of custom computation-based and LLM-based metrics (including a
> multi-turn efficiency metric and a tone judge with a result-parsing function), see
> [AGENT_EVALUATION_NOTEBOOK.md](./AGENT_EVALUATION_NOTEBOOK.md).
