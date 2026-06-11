# Gen AI Evaluation Service — Overview

> **Note:** Gemini Enterprise Agent Platform provides evaluation for agents, predictive AI
> models, and generative AI models. This page covers the **generative AI model** evaluation
> service. For agent-specific evaluation, see [AGENT_EVALUATION.md](./AGENT_EVALUATION.md).
> For running evaluations on historical traces and sessions, see
> [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md).

The Gen AI evaluation service provides enterprise-grade tools for objective, data-driven
assessment of generative AI models. It supports development tasks such as model migrations,
prompt editing, and fine-tuning.

## Defining feature: adaptive rubrics

The defining feature of the service is the ability to use **adaptive rubrics** — a set of
tailored pass/fail tests generated for each individual prompt. Rubrics are similar to unit
tests in software development and aim to improve model performance across a variety of tasks.

### Supported evaluation methods

| Method | Description |
|---|---|
| **Adaptive rubrics** (recommended) | Generates a unique set of pass/fail rubrics for each individual prompt in your dataset. |
| **Static rubrics** | Apply a fixed set of scoring criteria across all prompts. |
| **Computation-based metrics** | Deterministic algorithms (e.g., ROUGE, BLEU) when a ground truth is available. |
| **Custom functions** | Define your own evaluation logic in Python for specialized requirements. |

## Evaluation dataset generation

You can create an evaluation dataset through any of the following methods:

- **Upload prompt instances** — upload a file of complete prompts, or provide a prompt
  template alongside a file of variable values to populate the completed prompts.
- **Sample from production logs** — evaluate the real-world usage of your model.
- **Synthetic data generation** — generate a large number of consistent examples for any
  prompt template.

## Supported interfaces

| Interface | Description |
|---|---|
| **Google Cloud console** | Guided, end-to-end web workflow. Manage datasets, run evaluations, and explore interactive reports. |
| **Python SDK** | Programmatically run evaluations and render side-by-side model comparisons in Colab or Jupyter. |

## Use cases

The service shows how a model performs on **your** specific tasks and against **your** unique
criteria — insights that public leaderboards and general benchmarks cannot provide.

- **Model migrations** — compare model versions to understand behavioral differences and
  fine-tune prompts and settings accordingly.
- **Finding the best model** — run head-to-head comparisons of Google and third-party models
  on your data to establish a baseline and identify the best fit.
- **Prompt improvement** — re-running an evaluation creates a tight feedback loop, providing
  immediate, quantifiable feedback on your changes.
- **Model fine-tuning** — apply consistent evaluation criteria to every run of a fine-tuned model.
- **Agent evaluation** — evaluate agents using agent-specific metrics such as agent traces and
  response quality.

## Evaluation workflow

1. **Create an evaluation dataset** — assemble prompt instances that reflect your use case.
   Include reference answers (ground truth) if you plan to use computation-based metrics.
2. **Define evaluation metrics** — choose the metrics that measure model performance.
3. **Generate model responses** — select one or more models. The Agent Platform SDK supports
   any model callable through LiteLLM; the console supports Google Gemini models.
4. **Run the evaluation** — assess each model's responses against your selected metrics.
5. **Interpret the results** — review aggregated scores and individual responses.

## Evaluation metrics

Core concepts:

- **Rubrics** — the criteria for how to rate the response of an LLM model or application.
- **Metrics** — a score that measures the model output against the rating rubrics.

### Metric categories

| Category | What it does | Output | When to use |
|---|---|---|---|
| **Adaptive rubrics** (recommended) | Rubrics dynamically generated per prompt, like unit tests. | Pass/fail per rubric → aggregated pass rate | Fastest way to start; keeps every evaluation relevant to the task. |
| **Static rubrics** | Same explicit rubric applies to all prompts. | A single numerical score (e.g., 1–5) per prompt | When evaluating a specific dimension or when the exact same rubric is required across all prompts. |
| **Computation-based** | Deterministic algorithms, usually against ground truth. | Numerical score (e.g., 0.0–1.0) per prompt | When ground truth is available and matchable deterministically. |
| **Custom function** (SDK only) | Your own metric defined as a Python function. | Defined by your function | Specialized requirements. |

### Adaptive rubrics: how it works

Each prompt uses a two-step system:

1. **Rubric generation** — the service analyzes your prompt and generates a list of specific,
   verifiable tests (the rubrics) that a good response should meet.
2. **Rubric validation** — after the model generates a response, the service assesses it
   against each rubric, delivering a clear **Pass** or **Fail** verdict and a rationale.

The final result is an aggregated **pass rate** plus a detailed breakdown of which rubrics the
model passed.

#### Worked example

**User prompt:** *Write a four-sentence summary of the provided article about renewable energy,
maintaining an optimistic tone.*

**Generated rubrics:**

1. The response is a summary of the provided article.
2. The response contains exactly four sentences.
3. The response maintains an optimistic tone.

**Model response:**

> The article highlights significant growth in solar and wind power. These advancements are
> making clean energy more affordable. The future looks bright for renewables. However, the
> report also notes challenges with grid infrastructure.

**Validation:**

| Rubric | Verdict | Reason |
|---|---|---|
| 1. Is a summary of the article | **Pass** | Accurately summarizes the main points. |
| 2. Contains exactly four sentences | **Pass** | Composed of four distinct sentences. |
| 3. Maintains an optimistic tone | **Fail** | The final sentence introduces a negative point, detracting from the optimistic tone. |

**Final pass rate: 66.7%.** To compare two models, evaluate their responses against the same
generated tests and compare overall pass rates.

By moving from high-level subjective scores to granular objective test results, you can adopt
an **evaluation-driven development cycle** and bring software-engineering best practices to
building generative AI applications.

## Getting started (SDK)

```python
from vertexai import Client
from vertexai import types
import pandas as pd

client = Client(project=PROJECT_ID, location=LOCATION)

# Create an evaluation dataset
prompts_df = pd.DataFrame({
    "prompt": [
        "Write a simple story about a dinosaur",
        "Generate a poem about Agent Platform",
    ],
})

# Get responses from one or multiple models
eval_dataset = client.evals.run_inference(model="gemini-2.5-flash", src=prompts_df)

# Define the evaluation metrics and run the evaluation job
eval_result = client.evals.evaluate(
    dataset=eval_dataset,
    metrics=[types.RubricMetric.GENERAL_QUALITY],
)

# View the evaluation results
eval_result.show()
```

### Two SDK interfaces

| Interface | Import | Status | Notes |
|---|---|---|---|
| **GenAI Client in Agent Platform SDK** (recommended) | `from vertexai import Client` | Preview | Newer unified `Client` class. Supports all evaluation methods, model comparison, in-notebook visualization, and customization insights. |
| **Evaluation module in Agent Platform SDK** | `from vertexai.evaluation import EvalTask` | GA | Older `EvalTask` interface, maintained for backward compatibility. Supports standard LLM-as-a-judge and computation-based metrics, but **not** adaptive rubrics. |

## Implementation status in this project

> This section documents what the code in this repository **actually runs today** for the
> founder-validation agent, versus the Google product capabilities described above. It exists
> so the README architecture diagram is not read as a claim that the live demo calls the
> Gen AI Evaluation Service end-to-end.

`scripts/vertex_evaluation.py` contains a `VertexAgentEvaluator` class whose methods wrap the
genuine SDK surface — `client.evals.generate_conversation_scenarios`, `run_inference`,
`evaluate`, and `generate_loss_clusters` (`vertex_evaluation.py:48-220`). These are the
intended production path and are gated behind a `VERTEX_AVAILABLE` import check.

However, the workflow that the demo actually executes — `run_quality_flywheel`
(`vertex_evaluation.py:258-401`) — only calls the real SDK for **scenario generation** (step 1).
For steps 2–5 (inference, metrics, loss clusters, optimization) it instead sends a single
`gemini-2.0-flash-001` prompt asking the model to **return invented** `task_success_rate`,
`tool_use_quality`, `trajectory_quality`, and loss-cluster JSON (`vertex_evaluation.py:300-356`).

| Flywheel step | Real eval-service path | Live demo today |
|---|---|---|
| 1. Generate scenarios | `client.evals.generate_conversation_scenarios` | Real SDK call (falls back if SDK absent) |
| 2. Run inference | `client.evals.run_inference` | Not called |
| 3. Compute metrics (AutoRaters) | `client.evals.evaluate` | Gemini prompt produces estimated scores |
| 4. Loss clusters | `client.evals.generate_loss_clusters` | Gemini prompt produces clusters |
| 5. Optimize | `client.optimizer.optimize` | Gemini rewrite prompt (see [OPTIMIZE_AGENT_PROMPTS.md](./OPTIMIZE_AGENT_PROMPTS.md)) |

**Honest framing for the submission:** describe steps 3–5 of the demo as *"LLM-estimated metrics
and clusters,"* not as scores produced by the Vertex Gen AI Evaluation Service. To make the
claim literally true, replace the inline Gemini block with calls to the existing
`evaluate_with_metrics` / `generate_loss_clusters` / `optimize_agent` methods, which already
target the real service.

## Supported regions

`us-central1` (Iowa), `us-east1` (South Carolina), `us-east4` (Northern Virginia),
`us-east5` (Columbus), `us-south1` (Dallas), `us-west1` (Oregon), `us-west4` (Las Vegas),
`europe-central2` (Warsaw), `europe-north1` (Finland), `europe-southwest1` (Madrid),
`europe-west1` (Belgium), `europe-west4` (Netherlands), `europe-west8` (Milan),
`europe-west9` (Paris), and `global`.

## Available notebooks

| Notebook | Description |
|---|---|
| Getting Started: Quick Gen AI Evaluation | Introduction to the Gen AI evaluation service. |
| Evaluating third-party models | Evaluate API-based models (OpenAI, Anthropic), Model-as-a-Service from Vertex Model Garden, and Bring-Your-Own-Model endpoints. |
| Model migration | Compare two first-party models (e.g., Gemini 2.0 Flash vs. 2.5 Flash) using adaptive rubrics; covers multi-candidate evaluation, in-notebook visualization, and async batch evaluation. |
| Evaluating text-to-image quality | Evaluate generated images against text prompts using the adaptive rubric-based Gecko metric. |
| Evaluating text-to-video quality | Evaluate generated videos against text prompts using the Gecko metric. |

---

> **Preview notice:** Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms" in the General Service Terms of the Service Specific Terms, as well
> as the Generative AI Service Specific Terms. Pre-GA products are provided "as is" and might
> have limited support.
