# ADK TypeScript Optimization Implementation Plan

## Overview

This document outlines the implementation plan to port Python ADK's advanced optimization and evaluation features to TypeScript ADK. These features are critical for **Track 2: Optimize** of the hackathon.

## Feature Comparison: Python vs TypeScript ADK

| Feature | Python ADK | TypeScript ADK | Priority |
|---------|-----------|----------------|----------|
| SimplePromptOptimizer | ✅ Full | ❌ Missing | HIGH |
| GEPARootAgentPromptOptimizer | ✅ Full (uses GEPA lib) | ❌ Missing | MEDIUM |
| LocalEvalSampler | ✅ Full | ❌ Missing | HIGH |
| Prebuilt Eval Metrics | ✅ 14 metrics | ❌ Missing | HIGH |
| EvalSet Management | ✅ Full | ✅ Just Added | DONE |
| LLM-as-Judge | ✅ Full | ❌ Missing | HIGH |
| Rubric-based Eval | ✅ Full | ❌ Missing | MEDIUM |
| Multi-turn Eval | ✅ Full | ❌ Missing | MEDIUM |
| User Simulator | ✅ Full | ❌ Missing | LOW |

---

## Phase 1: Core Types & Interfaces (Foundation)

### 1.1 Eval Metrics Types
**File:** `adk-js/dev/src/evaluation/eval_metrics.ts`

- [ ] `EvalStatus` enum (PASSED, FAILED, NOT_EVALUATED)
- [ ] `PrebuiltMetrics` enum (all 14 metrics from Python)
- [ ] `JudgeModelOptions` interface
- [ ] `BaseCriterion` interface
- [ ] `LlmAsAJudgeCriterion` interface
- [ ] `RubricsBasedCriterion` interface
- [ ] `HallucinationsCriterion` interface
- [ ] `ToolTrajectoryCriterion` interface (with MatchType enum)
- [ ] `EvalMetric` interface
- [ ] `EvalMetricResult` interface
- [ ] `EvalMetricResultPerInvocation` interface

**Python Reference:** `adk-python/src/google/adk/evaluation/eval_metrics.py`

### 1.2 Eval Rubrics Types
**File:** `adk-js/dev/src/evaluation/eval_rubrics.ts`

- [ ] `Rubric` interface
- [ ] `RubricScore` interface
- [ ] `RubricLevel` interface

**Python Reference:** `adk-python/src/google/adk/evaluation/eval_rubrics.py`

### 1.3 Eval Result Types
**File:** `adk-js/dev/src/evaluation/eval_result.ts`

- [ ] `EvalCaseResult` interface
- [ ] `OverallEvalResult` interface

**Python Reference:** `adk-python/src/google/adk/evaluation/eval_result.py`

---

## Phase 2: Evaluator Infrastructure

### 2.1 Base Evaluator
**File:** `adk-js/dev/src/evaluation/evaluator.ts`

- [ ] `Evaluator` abstract class
- [ ] `evaluate()` method signature
- [ ] `getMetricInfo()` method

**Python Reference:** `adk-python/src/google/adk/evaluation/evaluator.py`

### 2.2 Metric Evaluator Registry
**File:** `adk-js/dev/src/evaluation/metric_evaluator_registry.ts`

- [ ] `MetricEvaluatorRegistry` class
- [ ] `register()` method
- [ ] `getEvaluator()` method
- [ ] Auto-register all prebuilt metrics

**Python Reference:** `adk-python/src/google/adk/evaluation/metric_evaluator_registry.py`

### 2.3 Response Evaluator (LLM-as-Judge)
**File:** `adk-js/dev/src/evaluation/response_evaluator.ts`

- [ ] `ResponseEvaluator` class
- [ ] LLM prompt templates for judging
- [ ] Score extraction from LLM response
- [ ] Multi-sample aggregation (default: 5 samples)

**Python Reference:** `adk-python/src/google/adk/evaluation/response_evaluator.py`

### 2.4 Trajectory Evaluator
**File:** `adk-js/dev/src/evaluation/trajectory_evaluator.ts`

- [ ] `TrajectoryEvaluator` class
- [ ] Tool call trajectory comparison
- [ ] Support for EXACT, IN_ORDER, ANY_ORDER matching

**Python Reference:** `adk-python/src/google/adk/evaluation/trajectory_evaluator.py`

### 2.5 Rubric-based Evaluator
**File:** `adk-js/dev/src/evaluation/rubric_based_evaluator.ts`

- [ ] `RubricBasedEvaluator` class
- [ ] Apply rubrics to agent responses
- [ ] Generate rubric scores

**Python Reference:** `adk-python/src/google/adk/evaluation/rubric_based_evaluator.py`

---

## Phase 3: Multi-turn Evaluators

### 3.1 Multi-turn Task Success Evaluator
**File:** `adk-js/dev/src/evaluation/multi_turn_task_success_evaluator.ts`

- [ ] `MultiTurnTaskSuccessEvaluator` class
- [ ] Evaluate entire conversation success
- [ ] Handle multi-invocation scenarios

**Python Reference:** `adk-python/src/google/adk/evaluation/multi_turn_task_success_evaluator.py`

### 3.2 Multi-turn Tool Use Quality Evaluator
**File:** `adk-js/dev/src/evaluation/multi_turn_tool_use_quality_evaluator.ts`

- [ ] `MultiTurnToolUseQualityEvaluator` class
- [ ] Evaluate tool usage across turns

**Python Reference:** `adk-python/src/google/adk/evaluation/multi_turn_tool_use_quality_evaluator.py`

### 3.3 Multi-turn Trajectory Quality Evaluator
**File:** `adk-js/dev/src/evaluation/multi_turn_trajectory_quality_evaluator.ts`

- [ ] `MultiTurnTrajectoryQualityEvaluator` class
- [ ] Overall trajectory quality assessment

**Python Reference:** `adk-python/src/google/adk/evaluation/multi_turn_trajectory_quality_evaluator.py`

---

## Phase 4: Local Eval Service

### 4.1 Local Eval Service
**File:** `adk-js/dev/src/evaluation/local_eval_service.ts`

- [ ] `LocalEvalService` class
- [ ] `performInference()` method - run agent on eval cases
- [ ] `evaluate()` method - apply metrics to results
- [ ] Integration with EvalSetsManager

**Python Reference:** `adk-python/src/google/adk/evaluation/local_eval_service.py`

### 4.2 Inference Request/Response Types
**File:** `adk-js/dev/src/evaluation/base_eval_service.ts`

- [ ] `InferenceRequest` interface
- [ ] `InferenceConfig` interface
- [ ] `InferenceResult` interface
- [ ] `EvaluateRequest` interface
- [ ] `EvaluateConfig` interface

**Python Reference:** `adk-python/src/google/adk/evaluation/base_eval_service.py`

---

## Phase 5: Sampler & Optimization Core

### 5.1 Sampler Interface
**File:** `adk-js/dev/src/optimization/sampler.ts`

- [ ] `Sampler<T>` abstract class
- [ ] `getTrainExampleIds()` method
- [ ] `getValidationExampleIds()` method
- [ ] `sampleAndScore()` method

**Python Reference:** `adk-python/src/google/adk/optimization/sampler.py`

### 5.2 Local Eval Sampler
**File:** `adk-js/dev/src/optimization/local_eval_sampler.ts`

- [ ] `LocalEvalSamplerConfig` interface
- [ ] `LocalEvalSampler` class implementing Sampler
- [ ] Integration with LocalEvalService
- [ ] Train/validation split support
- [ ] Batch evaluation
- [ ] Score aggregation

**Python Reference:** `adk-python/src/google/adk/optimization/local_eval_sampler.py`

### 5.3 Optimization Data Types
**File:** `adk-js/dev/src/optimization/data_types.ts`

- [ ] `AgentWithScores` interface
- [ ] `OptimizerResult<T>` interface
- [ ] `UnstructuredSamplingResult` interface

**Python Reference:** `adk-python/src/google/adk/optimization/data_types.py`

---

## Phase 6: Prompt Optimizers

### 6.1 Agent Optimizer Interface
**File:** `adk-js/dev/src/optimization/agent_optimizer.ts`

- [ ] `AgentOptimizer<S, R>` abstract class
- [ ] `optimize()` method signature

**Python Reference:** `adk-python/src/google/adk/optimization/agent_optimizer.py`

### 6.2 Simple Prompt Optimizer
**File:** `adk-js/dev/src/optimization/simple_prompt_optimizer.ts`

- [ ] `SimplePromptOptimizerConfig` interface
  - [ ] `optimizerModel` (default: "gemini-2.5-flash")
  - [ ] `modelConfiguration` with thinking config
  - [ ] `numIterations` (default: 10)
  - [ ] `batchSize` (default: 5)
- [ ] `SimplePromptOptimizer` class
- [ ] `_generateCandidatePrompt()` - LLM generates improved prompt
- [ ] `_scoreAgentOnBatch()` - evaluate on random batch
- [ ] `_runOptimizationIterations()` - main loop
- [ ] `_runFinalValidation()` - validate best prompt
- [ ] Optimizer prompt template (from Python)

**Python Reference:** `adk-python/src/google/adk/optimization/simple_prompt_optimizer.py`

### 6.3 GEPA Root Agent Prompt Optimizer (Advanced)
**File:** `adk-js/dev/src/optimization/gepa_prompt_optimizer.ts`

- [ ] `GEPARootAgentPromptOptimizerConfig` interface
  - [ ] `maxMetricCalls` (default: 100)
  - [ ] `reflectionMinibatchSize` (default: 3)
  - [ ] `runDir` for saving results
- [ ] `GEPARootAgentPromptOptimizer` class
- [ ] GEPA adapter implementation (or alternative reflection-based approach)
- [ ] Reflection-based prompt improvement

**Python Reference:** `adk-python/src/google/adk/optimization/gepa_root_agent_prompt_optimizer.py`

**Note:** GEPA is Google's internal library. For TypeScript, we can implement a similar reflection-based approach without the GEPA dependency.

---

## Phase 7: API Server Endpoints

### 7.1 Optimization Endpoints
**File:** `adk-js/dev/src/server/adk_api_server.ts`

- [ ] `POST /apps/:appName/optimize` - Run optimization
- [ ] `GET /apps/:appName/optimization_results` - Get results
- [ ] `POST /apps/:appName/eval_sets/:evalSetId/optimize` - Optimize using eval set

### 7.2 Enhanced Eval Endpoints (Update existing)

- [ ] `POST /apps/:appName/eval_sets/:evalSetId/run_eval` - Add metric support
- [ ] `GET /apps/:appName/eval_metrics` - Return all prebuilt metrics info

---

## Phase 8: Integration & Testing

### 8.1 Integration Tests
**File:** `adk-js/dev/test/optimization/*.test.ts`

- [ ] SimplePromptOptimizer tests
- [ ] LocalEvalSampler tests
- [ ] Evaluator tests
- [ ] End-to-end optimization flow test

### 8.2 Example Usage
**File:** `adk-js/examples/optimization/`

- [ ] Basic prompt optimization example
- [ ] Multi-turn evaluation example
- [ ] Custom metric example

---

## Implementation Priority Order

### Week 1: Foundation (HIGH PRIORITY)
1. Phase 1: Core Types (1 day)
2. Phase 5.3: Optimization Data Types (0.5 day)
3. Phase 5.1: Sampler Interface (0.5 day)
4. Phase 6.1: Agent Optimizer Interface (0.5 day)
5. Phase 6.2: Simple Prompt Optimizer (2 days)

### Week 2: Evaluation (HIGH PRIORITY)
6. Phase 2.1-2.2: Base Evaluator & Registry (1 day)
7. Phase 2.3: Response Evaluator (LLM-as-Judge) (1 day)
8. Phase 2.4: Trajectory Evaluator (1 day)
9. Phase 4: Local Eval Service (2 days)

### Week 3: Advanced (MEDIUM PRIORITY)
10. Phase 5.2: Local Eval Sampler (1 day)
11. Phase 3: Multi-turn Evaluators (2 days)
12. Phase 2.5: Rubric-based Evaluator (1 day)
13. Phase 6.3: GEPA-style Optimizer (2 days)

### Week 4: Polish
14. Phase 7: API Endpoints (1 day)
15. Phase 8: Testing & Examples (2 days)

---

## Key Design Decisions

### 1. GEPA Alternative
Since GEPA is Google's internal library, we'll implement a similar **reflection-based optimization** approach:
- Analyze failed eval cases
- Generate reflection prompts
- Use LLM to suggest improvements
- Iterate until convergence

### 2. LLM-as-Judge Implementation
Use Vertex AI Gemini for evaluation with:
- Multi-sample voting (5 samples default)
- Structured output parsing
- Configurable judge models

### 3. TypeScript-specific Patterns
- Use Zod for runtime validation (instead of Pydantic)
- Async generators for streaming results
- Type-safe metric registry

---

## Files Created

```
adk-js/dev/src/
├── evaluation/
│   ├── types.ts                    ✅ DONE
│   ├── local_eval_sets_manager.ts  ✅ DONE
│   ├── index.ts                    ✅ DONE (updated)
│   ├── eval_metrics.ts             ✅ DONE
│   ├── eval_result.ts              ✅ DONE
│   ├── evaluator.ts                ✅ DONE
│   ├── metric_evaluator_registry.ts ✅ DONE
│   ├── response_evaluator.ts       ✅ DONE (includes MultiTurnTaskSuccess)
│   ├── trajectory_evaluator.ts     ✅ DONE (includes MultiTurnToolUse)
│   └── local_eval_service.ts       ✅ DONE
├── optimization/
│   ├── index.ts                    ✅ DONE
│   ├── data_types.ts               ✅ DONE
│   ├── sampler.ts                  ✅ DONE
│   ├── local_eval_sampler.ts       ✅ DONE
│   ├── agent_optimizer.ts          ✅ DONE
│   ├── simple_prompt_optimizer.ts  ✅ DONE
│   └── reflection_prompt_optimizer.ts ✅ DONE (GEPA alternative)
```

---

## Prebuilt Metrics to Implement

| Metric Name | Description | Priority |
|------------|-------------|----------|
| `tool_trajectory_avg_score` | Compare tool calls with expected | HIGH |
| `response_evaluation_score` | LLM judges response quality | HIGH |
| `response_match_score` | Semantic similarity | MEDIUM |
| `safety_v1` | Safety check | MEDIUM |
| `final_response_match_v2` | Final response matching | MEDIUM |
| `rubric_based_final_response_quality_v1` | Rubric scoring | MEDIUM |
| `hallucinations_v1` | Detect hallucinations | MEDIUM |
| `rubric_based_tool_use_quality_v1` | Tool use rubrics | LOW |
| `per_turn_user_simulator_quality_v1` | User sim quality | LOW |
| `multi_turn_task_success_v1` | Task completion | HIGH |
| `multi_turn_trajectory_quality_v1` | Overall trajectory | MEDIUM |
| `multi_turn_tool_use_quality_v1` | Tool use quality | MEDIUM |
| `rubric_based_multi_turn_trajectory_quality_v1` | Rubric trajectory | LOW |

---

## Success Criteria

- [x] SimplePromptOptimizer can improve agent instructions
- [x] At least 5 prebuilt metrics working (9 implemented)
- [x] LocalEvalSampler integrates with EvalSets
- [x] ADK web UI can trigger optimization (via API)
- [x] Optimization results saved and retrievable
- [ ] 10%+ improvement demonstrated on test cases (ready to test)

---

## Resources

- Python ADK Source: `adk-python/src/google/adk/`
- TypeScript ADK Source: `adk-js/`
- Existing Optimizer: `src/optimizer/optimizer.ts`
- Eval Cases: `eval/eval_cases.json`
