"""
Phase 2B — REAL evaluation via the Vertex Gen AI Evaluation Service.

This is the genuine `client.evals.evaluate(...)` path (NOT a custom Gemini judge).
It scores the locally-collected agent runs from `eval/collect_agent_runs.py` using
predefined adaptive-rubric metrics, and writes a summary + an interactive report.

The eval *service* is cloud-side, but you DEPLOY/HOST NOTHING — this is a plain API
call from your machine against your existing GCP project.

Faithful to: docs/notebooks/quick_start_gen_ai_eval.ipynb
    eval_dataset = client.evals.run_inference(model=..., src=df)   # (we supply responses)
    eval_result  = client.evals.evaluate(dataset=df, metrics=[RubricMetric.GENERAL_QUALITY])
    eval_result.show()

Prereqs:
    1. python eval/collect_agent_runs.py   (produces eval/output/agent_runs.jsonl)
    2. pip install "google-cloud-aiplatform[evaluation]>=1.148.1" pandas
    3. gcloud auth application-default login
    4. export GOOGLE_CLOUD_PROJECT=<your-project>   (and optionally GOOGLE_CLOUD_LOCATION)

Usage:
    python eval/real_eval.py
    python eval/real_eval.py --runs eval/output/agent_runs.jsonl
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()  # load <repo-root>/.env when run from the project root
except ImportError:
    pass

EVAL_DIR = Path(__file__).parent
DEFAULT_RUNS = EVAL_DIR / "output" / "agent_runs.jsonl"
RESULTS_DIR = EVAL_DIR / "results"

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")


def load_runs(path: Path):
    """Load agent_runs.jsonl into a DataFrame with `prompt` and `response` columns."""
    import pandas as pd

    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(
                {
                    "prompt": r["prompt"],
                    "response": r.get("response", ""),
                    # carried for reference / debugging (ignored by the rater)
                    "eval_id": r.get("eval_id", ""),
                }
            )
    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description="Real Vertex Gen AI evaluation")
    parser.add_argument("--runs", default=str(DEFAULT_RUNS), help="agent_runs.jsonl path")
    parser.add_argument(
        "--metrics",
        nargs="*",
        default=["GENERAL_QUALITY", "SAFETY"],
        help="RubricMetric names (e.g. GENERAL_QUALITY SAFETY FINAL_RESPONSE_QUALITY)",
    )
    args = parser.parse_args()

    if not PROJECT_ID:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT (and run `gcloud auth application-default login`).")

    runs_path = Path(args.runs)
    if not runs_path.exists():
        raise SystemExit(
            f"{runs_path} not found. Run `python eval/collect_agent_runs.py` first."
        )

    # Imports here so the file is readable without the SDK installed.
    from vertexai import Client, types

    df = load_runs(runs_path)
    if df.empty:
        raise SystemExit(f"No rows in {runs_path}. Did the agent return responses?")
    print(f"Loaded {len(df)} (prompt, response) pairs from {runs_path.name}")

    client = Client(project=PROJECT_ID, location=LOCATION)

    # Resolve metric names → real RubricMetric enum objects.
    metrics = []
    for name in args.metrics:
        metric = getattr(types.RubricMetric, name, None)
        if metric is None:
            print(f"  ! Skipping unknown metric: {name}")
            continue
        metrics.append(metric)
    if not metrics:
        metrics = [types.RubricMetric.GENERAL_QUALITY]

    print(f"Evaluating with: {[m.__class__.__name__ for m in metrics] or args.metrics}")
    print(f"Project={PROJECT_ID} Location={LOCATION}")

    # THE REAL CALL — adaptive-rubric evaluation by the Gen AI Evaluation Service.
    eval_result = client.evals.evaluate(dataset=df, metrics=metrics)

    RESULTS_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = RESULTS_DIR / f"real_eval_{stamp}.json"
    with open(out_path, "w") as f:
        json.dump(
            {
                "project": PROJECT_ID,
                "location": LOCATION,
                "metrics": args.metrics,
                "summary_metrics": getattr(eval_result, "summary_metrics", None),
            },
            f,
            indent=2,
            default=str,
        )
    print(f"\nSaved summary to {out_path}")

    # Renders the interactive report in Colab/Jupyter; capture this for the demo screenshot.
    try:
        eval_result.show()
    except Exception as e:  # noqa: BLE001 - .show() needs a notebook frontend
        print(f"(eval_result.show() needs a notebook UI: {e})")
        print("Summary metrics:")
        print(json.dumps(getattr(eval_result, "summary_metrics", {}), indent=2, default=str))


if __name__ == "__main__":
    main()
