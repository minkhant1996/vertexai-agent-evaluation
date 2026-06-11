# Multi-Turn Agent Eval — Notebook Walkthrough

A condensed reference for the *"Gen AI Eval — Multi-turn Agent Eval, User Simulation, Metric
Registration, Auto-Loss Analysis"* notebook. It demonstrates evaluating Generative AI Agents
with the Vertex Gen AI Evaluation SDK — whether the agent runs locally in your notebook or is
deployed as a managed service on Vertex AI Agent Platform (Agent Engine).

Parent docs: [AGENT_EVALUATION.md](./AGENT_EVALUATION.md) ·
[GENAI_EVALUATION_SERVICE.md](./GENAI_EVALUATION_SERVICE.md)

## Scenarios covered

1. **Local agent eval with user simulation** — evaluate a local ADK agent by simulating a user
   over multiple turns.
2. **Predefined metrics & auto-loss analysis** — out-of-the-box multi-turn metrics, followed by
   diagnostic auto-loss analysis that groups failures into semantic loss clusters.
3. **Custom registered metrics** — author computation-based and LLM-based metrics, register them
   in the metric registry, and use them in evaluation.
4. **Cloud agent eval with user simulation** — trigger an evaluation run for an agent deployed on
   Agent Engine, with predefined + custom metrics and loss analysis in the same run.

## Getting started

```bash
%pip install --upgrade --force-reinstall -q "google-cloud-aiplatform[evaluation]>=1.148.1"
```

```python
# Authenticate (Colab only)
import sys
if "google.colab" in sys.modules:
    from google.colab import auth
    auth.authenticate_user()
```

```python
import os
import uuid
import vertexai
from google.adk import Agent
from vertexai import Client, types

PROJECT_ID = "[your-project-id]"
if not PROJECT_ID or PROJECT_ID == "[your-project-id]":
    PROJECT_ID = str(os.environ.get("GOOGLE_CLOUD_PROJECT"))
LOCATION = ""  # e.g. "global" for local scraping with gemini-3 models

AGENT_ENGINE_GCS_BUCKET = ""  # staging bucket for Agent Engine deploy
EVAL_RUN_GCS_BUCKET = ""      # bucket for the evaluation run

client = Client(project=PROJECT_ID, location=LOCATION)

os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1"
os.environ["GOOGLE_CLOUD_PROJECT"] = PROJECT_ID
os.environ["GOOGLE_CLOUD_LOCATION"] = LOCATION
```

> **Region note:** For local agent scraping with gemini-3 models you must use the `global`
> region. However, Agent Engine **cannot** be deployed in `global` — switch to `us-central1`
> when deploying. The notebook's helper functions handle this automatically.

### Helper functions

- **`poll_evaluation_run(evaluation_run, client)`** — monitors a long-running evaluation job,
  polling `client.evals.get_evaluation_run(...)` every 5 seconds until it reaches a terminal
  state (`SUCCEEDED`, `FAILED`, `CANCELLED`), then shows the final result with
  `include_evaluation_items=True`.
- **`deploy_adk_agent(agent, location)`** — packages a local agent into a
  `vertexai.agent_engines.AdkApp` and deploys it via `ae_client.agent_engines.create(...)`
  with `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY: "true"`. Deployment can take up to ~10 min.

## Agent preparation

The example is a **travel agent** built with the ADK. A root orchestrator delegates to two
sub-agents:

```python
flight_agent = Agent(
    model="gemini-2.5-flash",
    name="flight_specialist",
    instruction="You are a flight booking specialist. Use search_flights to find IDs, then "
                "get_flight_details to verify luggage/refund policies, and book_flight when "
                "the user confirms.",
    tools=[search_flights, get_flight_details, book_flight],
)

hotel_agent = Agent(
    model="gemini-2.5-flash",
    name="hotel_specialist",
    instruction="You are a hotel booking specialist. Use search_hotels to find IDs, then "
                "get_hotel_details to compare room types and amenities, and finally book_hotel.",
    tools=[search_hotels, get_hotel_details, book_hotel],
)

travel_agent = Agent(
    model="gemini-2.5-flash",  # stronger reasoning model for orchestration
    name="travel_agent",
    instruction="You are a primary travel concierge. Talk to the user to understand their full "
                "itinerary. Delegate flight-related tasks to the flight_specialist, and hotel-"
                "related tasks to the hotel_specialist. Synthesize their results to the user.",
    sub_agents=[flight_agent, hotel_agent],
)
```

Tools (`search_flights`, `get_flight_details`, `book_flight`, `search_hotels`,
`get_hotel_details`, `book_hotel`) read from in-memory `FLIGHT_DB` / `HOTEL_DB` lists and append
confirmations to `USER_BOOKINGS`. See the notebook for the full mock databases.

*(Optional)* Deploy the agent for the cloud scenario:

```python
agent_engine = deploy_adk_agent(travel_agent, "us-central1")
```

## 1. Local agent eval with user simulation

### Step 1 — Generate synthetic conversation scenarios

```python
agent_info = types.evals.AgentInfo.load_from_agent(agent=travel_agent)

eval_dataset = client.evals.generate_conversation_scenarios(
    agent_info=agent_info,
    config={
        "count": 5,
        "generation_instruction": "Generate scenarios where the user tries to book a flight "
                                  "but changes their mind about the destination.",
        "environment_context": "Today is Monday. I am located in San Francisco. Flights to "
                               "Paris, New York, Tokyo, Chicago, Sydney, etc are available.",
    },
)
display(eval_dataset.eval_dataset_df.head())
```

> If `model_name` is omitted, `generate_conversation_scenarios` defaults to a higher-quality
> "pro" model that may take several minutes. Set `model_name` to a flash model, or use a
> simpler `generation_instruction`, to reduce latency.

### Step 2 — Run the agent locally to simulate multi-turn conversations

```python
eval_dataset_with_trace = client.evals.run_inference(
    agent=travel_agent,
    src=eval_dataset,
    config={"user_simulator_config": {"max_turn": 3}},
)
display(eval_dataset_with_trace.eval_dataset_df.head())
```

> The ADK library uses a flash model for the user simulator by default. The default `max_turn`
> is 5 — increase it if you hit a "limit reached" warning before the agent trace completes.

### Step 3 — Evaluation

#### 3.1.1 — Custom computation-based metric (agent efficiency)

Defines a Python function that parses `agent_eval_data` turns/events, counts tool calls, and
penalizes redundant (looping) calls. Score = `1.0 − 0.02·total_calls − 0.10·redundant_calls`,
clamped to `[0, 1]`.

```python
efficiency_metric = types.CodeExecutionMetric(
    name="multi_turn_efficiency",
    custom_function=efficiency_metric_code,  # the Python source string above
)

efficiency_metric_path = client.evals.create_evaluation_metric(metric=efficiency_metric)
registered_efficiency_metric = types.Metric(
    name="multi_turn_efficiency",
    metric_resource_name=efficiency_metric_path,
)
```

`create_evaluation_metric()` saves the metric definition in the cloud and returns a unique
resource name you can reference in any future run.

#### 3.1.2 — Custom LLM-based metric (tone check)

Uses an `LLMMetric` "judge" to score qualitative dimensions — **Professionalism** and
**Empathy** — returning a JSON list of verdicts, parsed by a custom Python function into a
`{"score", "explanation"}` dict.

```python
tone_check_metric = types.LLMMetric(
    name="tone_check",
    prompt_template="""Analyze the tone of the response based on these two criteria: ...""",
    result_parsing_function="""... def parse_results(responses): ...""",
)

tone_check_metric_path = client.evals.create_evaluation_metric(metric=tone_check_metric)
registered_tone_check_metric = types.Metric(
    name="tone-check",
    metric_resource_name=tone_check_metric_path,
)
```

#### 3.2 — Evaluate predefined + custom metrics

```python
eval_metrics = [
    registered_efficiency_metric,
    registered_tone_check_metric,
    types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY,
    types.RubricMetric.MULTI_TURN_TRAJECTORY_QUALITY,
    types.RubricMetric.MULTI_TURN_TASK_SUCCESS,
]

eval_result = client.evals.evaluate(
    dataset=eval_dataset_with_trace,
    metrics=eval_metrics,
    config={"evaluation_service_qps": 5.0},  # throttle to avoid quota errors
)
eval_result.show()
```

> **Single-turn metrics** (e.g., `GENERAL_QUALITY`, `SAFETY`) do **not** work with simulated
> multi-turn `agent_data`. To use them, keep `max_turn` at `1` in `user_simulator_config`.

### Step 4 — Generate loss clusters

```python
loss_analysis = client.evals.generate_loss_clusters(
    eval_result=eval_result,
    metric=types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY,
)
print(f"Loss analysis completed! {len(loss_analysis.results or [])} result(s).")
loss_analysis.show()
```

> Auto-loss analysis currently supports only two predefined metrics:
> `MULTI_TURN_TASK_SUCCESS` and `MULTI_TURN_TOOL_USE_QUALITY`. Other metrics may yield no
> classification. **"Other NA"** on the dashboard means a result could not be categorized into
> a loss cluster.

## 2. Cloud agent eval with user simulation

Evaluates the agent previously deployed to Agent Engine — closer to a production assessment.

### Step 1 — Generate synthetic user scenarios

Same `generate_conversation_scenarios(...)` call as the local scenario.

### Step 2 — Trigger the evaluation run

`create_evaluation_run` orchestrates the full workflow remotely: **agent execution** (runs the
deployed agent against the simulated user to collect traces), **agent evaluation** (predefined +
custom registered metrics), and **loss analysis** (via `loss_analysis_metrics`).

```python
eval_metrics = [
    registered_efficiency_metric,
    registered_tone_check_metric,
    types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY,
    types.RubricMetric.MULTI_TURN_TRAJECTORY_QUALITY,
    types.RubricMetric.MULTI_TURN_TASK_SUCCESS,
]

loss_analysis_metrics = [
    types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY,
    types.RubricMetric.MULTI_TURN_TASK_SUCCESS,
]

eval_run = client.evals.create_evaluation_run(
    agent=agent_engine.api_resource.name,  # or an existing reasoningEngines resource name
    agent_info=agent_info,
    dataset=eval_dataset,
    metrics=eval_metrics,
    dest=EVAL_RUN_GCS_BUCKET,
    user_simulator_config={"max_turn": 3},
    loss_analysis_metrics=loss_analysis_metrics,
)

poll_evaluation_run(eval_run, client)
```

> You can pass an existing agent resource name to `agent` (e.g.
> `projects/{project_number}/locations/{location}/reasoningEngines/{agent_engine_id}`) if you
> skipped the deploy step. The user simulator defaults to a flash model and `max_turn` of 5.
> The job can take several minutes — reduce metrics, agent complexity, the
> `generation_instruction`, or drop loss analysis for faster results.

## Author credits

Notebook authors: Bo Zheng, Jason Dai, Naveksha Sood.
