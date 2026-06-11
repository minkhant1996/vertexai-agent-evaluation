# Agent Evaluation

> **Preview** — Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms" in the General Service Terms of the Service Specific Terms, the
> Generative AI Service Specific Terms, and the "Agentic AI Services" Service Specific Terms.
> Pre-GA products are provided "as is" and might have limited support.

Agent evaluation measures and improves the **performance, safety, and quality** of your agents.
For model (non-agent) evaluation, see [GENAI_EVALUATION_SERVICE.md](./GENAI_EVALUATION_SERVICE.md).
To evaluate historical traces and sessions, see [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md).

> **End-to-end example:** the *"Multi-Turn Agent Evaluation with User Simulation, Metric
> Registration, and Auto Loss Analysis"* notebook walks through the full flow. A condensed
> walkthrough of that notebook is in
> [AGENT_EVALUATION_NOTEBOOK.md](./AGENT_EVALUATION_NOTEBOOK.md).

## Procedure summary

| Phase | Activity | Goal |
|---|---|---|
| **Design** | Define eval cases | Specify agent tasks and expected outcomes. |
| **Execution** | Run inferences | Generate real-world or simulated conversation traces. |
| **Scoring** | Compute metrics | Grade traces using automated raters (Task Success, Safety). |
| **Refinement** | Optimize agent | Propose and verify improvements to instructions or tools. |

## Evaluation process

Evaluation follows a structured, iterative workflow:

1. **Define eval cases** — an eval case specifies an agent's task. It can include one or
   multiple conversation steps, the conversation context (the agent's state), and a
   specification for simulating user responses during inference.
2. **Run inferences** — inference is the execution of an eval case. If the eval case contains a
   conversation plan, user responses are simulated during inference.
3. **Generate traces** — each inference run captures the agent's behavior in a **trace**: a
   factual, immutable record of model inputs, responses, and tool calls.
4. **Compute metrics** — metrics are scores computed for each trace using prebuilt or custom
   raters. *Reference-based* metrics (e.g., Exact Match) require an eval case with a reference
   answer; *reference-free* metrics (e.g., Helpfulness) evaluate a trace on its own. This lets
   you score traces from production traffic or external logs, independent of a managed test
   environment.
5. **Conduct analysis** — analyze metrics, rubrics, and verdicts to identify key agent issues,
   link them back to test cases, and generate insights for improvement.
6. **Optimize the agent** — optimization manages the entire cycle: it analyzes results,
   proposes improvements, and iteratively re-runs the process to verify performance gains.

## Evaluation workflow stages

You can integrate evaluation into two main stages of your workflow:

- **Local development iteration** — evaluate an Agent Development Kit (ADK)-based agent locally
  to rapidly iterate on prompt engineering and tool configurations.
- **Deployed agent assessment** — measure the quality of deployed agents by analyzing
  historical traces or running synthetic benchmarks against agent endpoints.

## Core capabilities

Agent evaluation helps you build an initial evaluation suite even **without existing test
data**:

- **Scenario generation and user simulation** — automatically generate diverse, multi-turn
  synthetic test scenarios from your agent's instructions and tool definitions, so you can
  start testing immediately without manually authoring initial test cases.
- **Environment simulation** — intercept specific tool calls to inject custom behaviors, mocked
  data, or simulated errors (e.g., HTTP 503, latency spikes) to validate agent resilience
  without impacting production backends.
- **Multi-turn evaluation** — evaluate entire conversation histories with multi-turn
  autoraters that analyze intent extraction, dynamically generate rubrics, and provide
  objective validation verdicts for instruction adherence.
- **Prompt optimization** — programmatically generate and validate refined system instructions.
  The optimization framework identifies points of failure and iteratively proposes targeted
  updates.

## Evaluate with AI coding assistants

If you use Gemini CLI or another AI coding assistant, you can install **Agent skills** that
teach your assistant this evaluation methodology. Each skill provides the eval workflow,
dataset schema, metric-selection guidance, and failure-analysis steps directly in your coding
session.

### Agents CLI eval skill

A CLI-driven workflow to evaluate and optimize ADK agents using the `agents-cli eval`
commands. Covers:

- Preparing eval datasets and synthesizing multi-turn scenarios with user simulation
- Running inference, grading traces, and analyzing failure clusters
- Iterating on prompts and tools with the eval-fix loop

```bash
npx skills add https://github.com/google/agents-cli --skill google-agents-cli-eval
```

### Agent Platform GenAI Evaluation Service flywheel skill

An SDK-driven playbook to evaluate and improve models and agents through the Agent Platform
GenAI Evaluation Service (`client.evals.evaluate()`). Covers:

- Building eval datasets from session traces, DataFrames, or synthetic generation
- Selecting, configuring, and writing custom metrics with LLM-as-judge scoring
- Analyzing rubric verdicts and loss patterns to drive concrete improvements

```bash
npx skills add https://github.com/google/skills --skill agent-platform-eval-flywheel
```
