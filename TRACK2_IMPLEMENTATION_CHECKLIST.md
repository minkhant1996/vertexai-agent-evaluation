# Track 2 — Eligibility + Alignment Implementation Checklist

> Goal: make the submission **eligible** ("function as depicted", no deception) and
> **Track-2 aligned** (real Simulation + Evaluation + Observability + before/after), with the
> smallest honest change set. Source of truth for requirements:
> [docs/CHALLENGE_RESOURCE_GUIDE.md](./docs/CHALLENGE_RESOURCE_GUIDE.md).
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` skipped (with reason) ·
> `[U]` needs YOU (interactive GCP auth, running against cloud, or recording)
>
> **The core principle:** *Real eval → LLM rewrite (honestly labeled) → real eval shows the
> score went up.* Fix the **measurement**, not the rewriter.

---

## ✅ Done in code this session (no cloud needed)
- All of **Phase 1** relabeling (README diagram, CHANGELOG, MERGE_REQUEST, OPTIMIZER_SYSTEM,
  API_REFERENCE, optimizer.ts) — "GEPA"→"LLM-assisted optimization", "Vertex AI Evaluation"
  diagram box→"Gemini-based Evaluation", model 2.0→2.5.
- All of **Phase 1B** broken-API fixes (`evaluate(traces=)`→`dataset=`, string metrics→
  `RubricMetric` enums, dropped `INSTRUCTION_ADHERENCE`/`allow_cross_region_model`,
  `client.optimizer`→`client.prompt_optimizer`, result parsing→`summary_metrics`). All Python
  files compile.
- **Phase 2 harness written**: `eval/collect_agent_runs.py` (drives the LOCAL ADK agent over
  HTTP — no cloud hosting) + `eval/real_eval.py` (genuine `client.evals.evaluate`).
- **Phase 3 honesty**: `adk_optimizer.py` returns `method:"llm_instruction_rewrite"` +
  `adk_optimizer_invoked:false`; GEPA prompt text relabeled.

## ⏭️ What needs YOU (`[U]` items below)
Run `gcloud auth application-default login`, start the local agent, then:
1. `python eval/collect_agent_runs.py`  → `eval/output/agent_runs.jsonl`
2. `GOOGLE_CLOUD_PROJECT=<proj> python eval/real_eval.py`  → real scores + screenshot
3. Record the before/after demo.

---

## Phase 0 — Prerequisites & access verification

- [U] **0.1** Confirm GCP project + billing active (`gcloud config get-value project`).
- [U] **0.2** Enable APIs: `aiplatform.googleapis.com` (`gcloud services enable aiplatform.googleapis.com`).
- [U] **0.3** Auth for local SDK calls: `gcloud auth application-default login`.
- [U] **0.4** Install eval SDK: `pip install "google-cloud-aiplatform[adk,evaluation]>=1.148.1"`.
- [U] **0.5** Have a `GEMINI_API_KEY` (AI Studio) for local ADK-JS runs **without** Vertex.
- [U] **0.6** **Probe Preview access** — run a tiny `client.evals.evaluate(dataset=df, metrics=[types.RubricMetric.GENERAL_QUALITY])` on 1 dummy row.
  - [ ] If it works → single-turn eval is available (GA path, safe).
  - [ ] Separately probe `generate_conversation_scenarios` / `MULTI_TURN_*` / `generate_loss_clusters` (Preview — may 403/404). Record which are usable.
- [U] **0.7** Write findings to `eval/ACCESS_NOTES.md` (which metrics/APIs are reachable on this project).

---

## Phase 1 — Eligibility (integrity) — **MUST**

> Without these you risk the "function as depicted / deception" disqualification clause
> (`CHALLENGE_RESOURCE_GUIDE.md:151`). Do these even if Phase 2 isn't finished.

### 1A. Relabel overclaims
- [x] **1.1** README architecture diagram (`README.md:60-61`): change box **"Vertex AI Evaluation"** → keep only if Phase 2 done; otherwise **"Gemini-powered Evaluation (modeled on Agent Platform)"**.
- [x] **1.2** README diagram: **"GEPA Optimization"** → **"LLM-assisted Instruction Optimization (Gemini)"**.
- [x] **1.3** `docs/README.md` architecture box "Evaluation Service │ Optimizer" → same honest wording.
- [x] **1.4** Frontend/UI labels (`frontend/src/components/track2/`): any "GEPA" / "Vertex AI Evaluation" strings → honest labels.
- [ ] **1.5** Grep the whole repo for stragglers: `grep -rin "GEPA\|Vertex AI Evaluation" --include=*.md --include=*.ts --include=*.tsx --include=*.jsx` and fix each.

### 1B. Remove dead-wrong API calls (a code-reviewing judge will spot these)
- [x] **1.6** `eval/vertex_eval.py:236` — `client.evals.evaluate(traces=...)` → `evaluate(dataset=...)` (or delete file if superseded by Phase 2).
- [x] **1.7** `eval/vertex_eval.py:223-232` — metrics passed as **strings** incl. `"INSTRUCTION_ADHERENCE"`/`"RESPONSE_QUALITY"` → real `types.RubricMetric.*` enums (`FINAL_RESPONSE_QUALITY`, `SAFETY`, `MULTI_TURN_*`). Drop `INSTRUCTION_ADHERENCE` (not a real metric).
- [x] **1.8** `eval/vertex_eval.py:315` & `scripts/vertex_evaluation.py:241` — `client.optimizer.optimize(...)` → `client.prompt_optimizer.optimize(...)` **or** remove if not wired.
- [x] **1.9** `eval/vertex_eval.py:141` — drop unsupported `allow_cross_region_model=True` (0 official notebooks use it).
- [x] **1.10** `scripts/vertex_evaluation.py:154` — `evaluate(traces=...)` → `evaluate(dataset=...)`.
- [x] **1.11** `eval/vertex_eval.py:257` — result parsing `eval_result["metrics"]` → `eval_result.summary_metrics` (matches SDK shape).

### 1C. "Functions as depicted"
- [U] **1.12** Verify live demo URL (`README.md:7`) is up and works during the judging window.
- [U] **1.13** Confirm every feature shown in the demo video actually runs (no mocked screen the code can't reproduce).
- [U] **1.14** Confirm submission is original work / dependencies properly licensed (ADK is Apache-2.0 ✓).

---

## Phase 2 — Make evaluation REAL (Route A) — **HIGH VALUE**

> Run the ADK agent **locally** (no Cloud Run / Agent Engine), score with the real Gen AI Eval
> Service. Converts the "Vertex Eval" box from emulated → true.

### 2A. Local ADK-JS runner (produces real prompt/response/trajectory)
- [x] **2.1** Read `eval/eval_cases.json` + `eval/eval_dataset.json` to map existing case shape.
- [x] **2.2** Write `eval/collect_agent_runs.py` — drives the agent over the **local ADK
  api_server** (same HTTP protocol as `simulator.ts`; `@google/adk` isn't installed so the
  InMemoryRunner route needs a build — HTTP is the proven local path).
  - [x] Model via `GEMINI_API_KEY` **or** Vertex — configured where you launch the agent.
  - [x] Iterate eval cases → capture `{prompt, response, tools_called, reference_trajectory}`.
  - [x] Write `eval/output/agent_runs.jsonl`.
- [U] **2.3** Verify offline: start agent locally, then `python eval/collect_agent_runs.py`
  produces non-empty `agent_runs.jsonl`, no cloud deploy. (Alt: build adk-js + InMemoryRunner.)

### 2B. Real evaluation script (faithful to official notebooks)
- [x] **2.4** Write `eval/real_eval.py` (copy pattern from `docs/notebooks/quick_start_gen_ai_eval.ipynb`):
  - [x] Load `agent_runs.jsonl` into a `pandas.DataFrame` with `prompt`,`response`.
  - [x] `client = Client(project, location)`.
  - [x] `eval_result = client.evals.evaluate(dataset=df, metrics=[types.RubricMetric.GENERAL_QUALITY, types.RubricMetric.SAFETY])`.
  - [x] Persist `eval_result` summary to `eval/results/real_eval_<timestamp>.json`.
  - [x] `eval_result.show()` (or fallback summary print) for a **screenshot artifact**.
- [U] **2.5** (If Preview available per 0.6) add agent-native metrics: `FINAL_RESPONSE_QUALITY`, `TOOL_USE_QUALITY`; for multi-turn use `MULTI_TURN_*` with proper trace shape.
- [U] **2.6** (If Preview available) `client.evals.generate_loss_clusters(eval_result=..., metric=types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY)` → real failure clusters.
- [U] **2.7** Capture **one real `eval_result.show()` screenshot** → `docs/assets/real_eval_result.png` (proof for judges).

### 2C. Wire into the app (optional but strong)
- [ ] **2.8** `src/optimizer/optimizer.ts:522` — point the eval subprocess at `eval/real_eval.py` instead of the emulated flywheel, OR add a feature flag `USE_REAL_EVAL`.
- [ ] **2.9** Surface real `summary_metrics` in the Track 2 dashboard (replace mocked numbers).

---

## Phase 3 — Honest optimization loop

> Keep the LLM rewriter, but make the **before/after numbers** come from Phase 2's real eval.

- [U] **3.1** Define loop: run real eval (baseline) → LLM rewrite instruction → re-run real eval → compare `summary_metrics`.
- [x] **3.2** `scripts/vertex_evaluation.py:300-395` — relabel the "GEPA (Genetic Evolution Prompt Algorithm)" prompt text (`:360`) to "LLM-assisted instruction optimization". No fake algorithm name.
- [x] **3.3** `scripts/adk_optimizer.py` — either:
  - [ ] (Honest, fast) keep Gemini rewrite, label it accurately, return `"method": "llm_instruction_rewrite"` (not `adk_gemini_optimizer`); **or**
  - [ ] (Real, if time) actually invoke `SimplePromptOptimizer.optimize(...)` (`adk_optimizer.py:24-33,110-115`) instead of constructing-and-ignoring it.
- [U] **3.4** Store before/after instruction + before/after real scores in version history (existing storage).
- [U] **3.5** Acceptance: a recorded run shows metric ↑ from baseline to optimized, **both measured by the real eval service**.

---

## Phase 4 — Track-2 demo narrative (before/after + observability)

> Track 2 explicitly wants a **before-vs-after** demo (`CHALLENGE_RESOURCE_GUIDE.md:92`).

- [U] **4.1** Pick 2-3 edge cases the baseline agent fails (from `src/simulation/edge-cases.ts`).
- [U] **4.2** Record **before**: agent stalls/fails + low real-eval score + the trace showing where it breaks (Observability).
- [U] **4.3** Run Phase 3 optimization.
- [U] **4.4** Record **after**: same edge case now handled + higher real-eval score.
- [U] **4.5** Show a **real trace** (Observability) in the demo — not a mock.
- [U] **4.6** Script the video narration to match exactly what runs (ties back to 1.13).

---

## Phase 5 — Submission integrity checklist

- [ ] **5.1** Re-read all 4 judging criteria and self-score: Technical 30 / Business 30 / Innovation 20 / Demo 20 (`CHALLENGE_RESOURCE_GUIDE.md:144-149`).
- [ ] **5.2** Every architecture-diagram box maps to code that runs (no orphan claims).
- [ ] **5.3** Implementation-status notes in docs still accurate after Phase 1-3 edits (update `GENAI_EVALUATION_SERVICE.md` + `OPTIMIZE_AGENT_PROMPTS.md` "Implementation status" sections).
- [U] **5.4** Demo video = "function as depicted" verified end-to-end once on a clean environment.
- [U] **5.5** Deployment present for Track 2 ("deploy optimized code to Agent Runtime") — confirm Cloud Run deploy is live (`deploy.sh` / `scripts/deploy-cloud-run.sh`).
- [x] **5.6** Final grep for "GEPA" / "Vertex AI Evaluation" / `client.optimizer` / `evaluate(traces=` returns nothing stale.

---

## Quick reference — file → change map

| File | Lines | Change |
|---|---|---|
| `README.md` | 60-61 | Relabel arch boxes (1.1, 1.2) |
| `docs/README.md` | arch block | Relabel (1.3) |
| `eval/vertex_eval.py` | 141, 223-232, 236, 257, 315 | Fix/remove bad API calls (1.6-1.9, 1.11) |
| `scripts/vertex_evaluation.py` | 154, 241, 360 | Fix kwargs + relabel (1.8, 1.10, 3.2) |
| `scripts/adk_optimizer.py` | 24-33, 110-150 | Honest label or wire real optimizer (3.3) |
| `src/optimizer/optimizer.ts` | 522 | Point to real eval (2.8) |
| `eval/run_agent_local.ts` | new | ADK-JS local runner (2.2) |
| `eval/real_eval.py` | new | Real `client.evals.evaluate` (2.4) |

---

## Minimal path if time-boxed (do in this order)
1. Phase 1 (1.1-1.11) — eligibility, ~45 min, zero infra.
2. Phase 2A+2B (2.1-2.7) — one real eval + screenshot, ~2 hrs.
3. Phase 3 (3.1-3.5) — honest before/after loop, ~1-2 hrs.
4. Phase 4 — record the demo.
