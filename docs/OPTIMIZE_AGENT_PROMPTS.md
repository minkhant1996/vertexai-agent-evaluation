# Optimize Agent Prompts

> **Preview** — Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms", the Generative AI Service Specific Terms, and the "Agentic AI
> Services" Service Specific Terms. Pre-GA products are provided "as is" and might have limited
> support.

The **Quality Flywheel** is a continuous cycle of evaluation, analysis, and optimization. You
evaluate your agent's performance, analyze the results to identify clusters of failures, then
optimize to address those specific issues. Each iteration improves agent quality.

This page closes the loop from [ANALYZE_RESULTS.md](./ANALYZE_RESULTS.md) — once you've
identified loss patterns, optimization applies targeted fixes to your system instructions.

## Automated optimization with ADK

The Agent Development Kit (ADK) provides an extensible framework for automated agent
optimization via the built-in **`adk optimize`** command. This command applies the **GEPA
algorithm** to iteratively refine root system instructions by evaluating them against your test
suite.

The framework is extensible:

- Implement **custom optimization strategies**.
- Develop **custom samplers** that integrate with your own evaluation pipelines.

> For details on getting started, see *Optimize agents* in the ADK documentation.

## How it fits the flywheel

| Stage | Doc |
|---|---|
| Evaluate | [AGENT_EVALUATION.md](./AGENT_EVALUATION.md) · [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md) · [ONLINE_MONITORS.md](./ONLINE_MONITORS.md) |
| Analyze | [ANALYZE_RESULTS.md](./ANALYZE_RESULTS.md) (failure clusters & loss taxonomies) |
| Optimize | **This page** — `adk optimize` (GEPA) refines instructions against the test suite |

After optimization, **re-run the evaluation** and compare scores to verify the improvement, then
repeat the cycle.

## Implementation status in this project

> This section describes what the code in this repository **actually runs today**, as distinct
> from the Google product capabilities described above. It is here so that the architecture
> claims in the README and the live demo are not mistaken for a full GEPA/ADK integration.

| Capability | Real SDK path (scaffolded) | What the running demo does today |
|---|---|---|
| `adk optimize` / GEPA | `scripts/adk_optimizer.py` imports `google.adk.optimization.SimplePromptOptimizer` and builds a `SimplePromptOptimizerConfig` (`adk_optimizer.py:24-33`, `110-115`). | The optimizer object is **constructed but never invoked**. The live path calls `gemini-2.0-flash-001` with a hand-written rewrite prompt (`adk_optimizer.py:117-150`) and returns `"method": "adk_gemini_optimizer"`. The code comments say so directly: *"Full ADK integration requires setting up proper Agent and Sampler."* |
| GEPA algorithm | `VertexAgentEvaluator.optimize_agent()` wraps `client.optimizer.optimize(...)` (`vertex_evaluation.py:222-255`). | The flywheel runner does **not** call `optimize_agent()`. It sends a Gemini prompt that merely contains the string "GEPA (Genetic Evolution Prompt Algorithm)" (`vertex_evaluation.py:360-385`). This is a Gemini rewrite, not the GEPA algorithm. |

**To make the GEPA claim true**, wire `run_quality_flywheel` to call `evaluator.optimize_agent(...)`
(which already exists) and invoke `SimplePromptOptimizer.optimize(...)` instead of the inline
Gemini prompt. Until then, describe this step as **"LLM-assisted instruction rewriting,"** not GEPA.
