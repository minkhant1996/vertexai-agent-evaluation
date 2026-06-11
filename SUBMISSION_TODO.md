# Submission TODO — what's left (tick as you go)

> Only the **remaining** work. Everything already done in code is in
> [TRACK2_IMPLEMENTATION_CHECKLIST.md](./TRACK2_IMPLEMENTATION_CHECKLIST.md) (Phases 1, 2-code,
> 3-labels are `[x]`). This file = the things **you** must do to submit.
>
> `[ ]` todo · `[x]` done. Work top to bottom.

---

## 🔴 BLOCKERS — must clear to run a real evaluation

- [ ] **B1. Install gcloud CLI** (if not already): https://cloud.google.com/sdk/docs/install
  - check: `gcloud --version`
- [ ] **B2. Authenticate ADC** (one command, once):
  ```bash
  gcloud auth application-default login
  ```
  - check: file exists at `~/.config/gcloud/application_default_credentials.json`
  - Why: both the local agent (Vertex Gemini) and `eval/real_eval.py` need it.
- [ ] **B3. Fix `.env` port mismatch** — `AGENT_URL` is `http://localhost:8000` but the agent
  serves on **8101**. Set:
  ```
  AGENT_URL=http://localhost:8101
  ```
  (or pass `AGENT_BASE_URL=http://localhost:8101` when running the collector.)
- [ ] **B4. (If eval call errors)** upgrade the SDK — you have 1.133.0; Preview agent metrics want ≥1.148.1:
  ```bash
  pip install -U "google-cloud-aiplatform[evaluation]>=1.148.1"
  ```

---

## 🟢 RUN THE REAL EVALUATION (produces your proof artifact)

- [ ] **R1. Start the local ADK agent** (terminal 1) — no cloud hosting:
  ```bash
  PORT=8101 npx adk web --port 8101
  ```
- [ ] **R2. Collect real agent runs** (terminal 2):
  ```bash
  AGENT_BASE_URL=http://localhost:8101 python3 eval/collect_agent_runs.py
  ```
  - check: `eval/output/agent_runs.jsonl` exists and is non-empty.
- [ ] **R3. Score with the REAL Vertex eval service:**
  ```bash
  python3 eval/real_eval.py
  ```
  - check: `eval/results/real_eval_<timestamp>.json` written, summary metrics printed.
- [ ] **R4. Save the proof** — screenshot the terminal summary (or run in a notebook for
  `eval_result.show()`) → `docs/assets/real_eval_result.png`.
- [ ] **R5. (Optional, if Preview access)** add agent metrics / loss clusters:
  - `python3 eval/real_eval.py --metrics FINAL_RESPONSE_QUALITY SAFETY`
  - loss clusters: `client.evals.generate_loss_clusters(...)` (Preview — may 403).

---

## 🎬 BEFORE/AFTER DEMO (the Track-2 money shot)

- [ ] **D1. Pick 2–3 edge cases** the baseline agent fails (from `src/simulation/edge-cases.ts`).
- [ ] **D2. Record BEFORE** — agent stalls/fails + low real-eval score + the **trace** showing
  where it breaks (Observability).
- [ ] **D3. Optimize** the instruction (Track 2 Optimizer UI / flywheel — LLM rewrite).
- [ ] **D4. Record AFTER** — same case now handled + **higher real-eval score**.
- [ ] **D5. Show a real trace** in the video (not a mock).
- [ ] **D6. Narrate honestly** — "Gemini-based evaluation modeled on Agent Platform; LLM-assisted
  instruction optimization." Do **not** say GEPA / "Agent Optimizer" unless wired for real.

---

## ✅ SUBMISSION INTEGRITY (final gate before you submit)

- [ ] **S1. Live demo URL works** (`README.md:7`) during the judging window.
- [ ] **S2. Everything shown in the video actually runs** — no screen the code can't reproduce
  ("function as depicted", `CHALLENGE_RESOURCE_GUIDE.md:151`).
- [ ] **S3. Final stale-claim grep returns nothing unexpected:**
  ```bash
  grep -rin "GEPA\|client.optimizer\|evaluate(traces=" --include=*.md --include=*.ts --include=*.py . \
    | grep -vE "node_modules|adk-js/|docs/notebooks|scaffold|not GEPA|not Google's GEPA"
  ```
- [ ] **S4. Deployment present** for Track 2 ("deploy optimized code to Agent Runtime") — confirm
  Cloud Run deploy is live (`deploy.sh` / `scripts/deploy-cloud-run.sh`).
- [ ] **S5. Self-score** against judging weights (`CHALLENGE_RESOURCE_GUIDE.md:144`):
  Technical 30 / Business 30 / Innovation 20 / Demo 20.
- [ ] **S6. Submit** (Devpost / challenge portal) — title, description, video, repo link, live URL.

---

## Status snapshot (from last test)
| Check | State |
|---|---|
| Harness scripts compile + load `.env` | ✅ |
| `real_eval.py` data path (DataFrame) | ✅ tested offline |
| Python deps (vertexai 1.133, pandas, httpx, dotenv) | ✅ installed |
| `GOOGLE_CLOUD_PROJECT` in `.env` | ✅ set |
| gcloud ADC | ❌ missing → **B2** |
| ADK agent running on 8101 | ❌ not running → **R1** |
| `AGENT_URL` points to 8101 | ❌ says 8000 → **B3** |
