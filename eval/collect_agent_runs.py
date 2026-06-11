"""
Phase 2A — Collect real agent runs from a LOCAL ADK agent (no cloud hosting).

This drives the founder-validation ADK agent through the local ADK api_server
(`adk api_server`, served by @google/adk-devtools) over HTTP — the same protocol
the app's simulator uses — and records each (prompt, response, tool trajectory).

The output `eval/output/agent_runs.jsonl` is the input to `eval/real_eval.py`,
which scores it with the real Vertex Gen AI Evaluation Service.

NO Cloud Run / Agent Engine deployment is required: the agent runs locally and is
reachable on AGENT_BASE_URL. The model can be served via a GEMINI_API_KEY (AI
Studio) or Vertex — that is configured where you launch the agent, not here.

Prereqs:
    1. Start the agent locally, e.g. `npm run dev` / `./start.sh`, or `adk api_server`,
       so the ADK endpoints are reachable (default http://localhost:8101).
    2. pip install httpx

Usage:
    python eval/collect_agent_runs.py
    AGENT_BASE_URL=http://localhost:8101 python eval/collect_agent_runs.py
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()  # load <repo-root>/.env when run from the project root
except ImportError:
    pass

EVAL_DIR = Path(__file__).parent
DATASET_PATH = EVAL_DIR / "eval_dataset.json"
OUTPUT_DIR = EVAL_DIR / "output"
OUTPUT_PATH = OUTPUT_DIR / "agent_runs.jsonl"

# Honor the project's existing AGENT_URL convention; AGENT_BASE_URL also accepted.
BASE_URL = os.getenv("AGENT_BASE_URL") or os.getenv("AGENT_URL", "http://localhost:8101")
APP_NAME = os.getenv("ADK_APP_NAME", "src")  # ADK uses the source dir as app name
USER_ID = "eval_runner"


class LocalAdkClient:
    """Minimal HTTP client for the local ADK api_server (same protocol as simulator.ts)."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=120.0)
        self.session_id = None

    async def create_session(self) -> str:
        self.session_id = f"eval_session_{int(datetime.now().timestamp() * 1000)}"
        await self.client.post(
            f"{self.base_url}/apps/{APP_NAME}/users/{USER_ID}/sessions/{self.session_id}",
            json={},
        )
        await asyncio.sleep(0.3)  # let the session settle
        return self.session_id

    async def send(self, message: str) -> dict:
        resp = await self.client.post(
            f"{self.base_url}/run_sse",
            json={
                "appName": APP_NAME,
                "userId": USER_ID,
                "sessionId": self.session_id,
                "newMessage": {"role": "user", "parts": [{"text": message}]},
                "streaming": False,
            },
            timeout=120.0,
        )
        response_text, tools = "", []
        for line in resp.text.split("\n"):
            if not line.startswith("data: "):
                continue
            try:
                data = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            if data.get("author") == "user" or "content" not in data:
                continue
            for part in data["content"].get("parts", []):
                if "text" in part:
                    response_text += part["text"]
                if "functionCall" in part:
                    tools.append(part["functionCall"].get("name", ""))
        return {"response": response_text.strip(), "tools_called": tools}

    async def close(self):
        await self.client.aclose()


async def main():
    dataset = json.loads(DATASET_PATH.read_text())
    cases = dataset.get("eval_cases", [])
    OUTPUT_DIR.mkdir(exist_ok=True)

    print(f"Collecting {len(cases)} agent runs from {BASE_URL} (app='{APP_NAME}')...")
    client = LocalAdkClient(BASE_URL)
    written = 0

    with open(OUTPUT_PATH, "w") as out:
        for i, case in enumerate(cases, 1):
            prompt = case.get("prompt", "")
            if not prompt:
                continue
            await client.create_session()
            try:
                result = await client.send(prompt)
            except Exception as e:  # noqa: BLE001 - record failures, keep going
                result = {"response": f"ERROR: {e}", "tools_called": []}

            record = {
                "eval_id": case.get("eval_id", f"case_{i}"),
                "name": case.get("name", ""),
                "prompt": prompt,
                "response": result["response"],
                "tools_called": result["tools_called"],
                "reference_trajectory": [
                    t.get("tool_name") for t in case.get("reference_trajectory", [])
                ],
                "expected_response_contains": case.get("expected_response_contains", []),
            }
            out.write(json.dumps(record) + "\n")
            written += 1
            status = "OK " if not result["response"].startswith("ERROR") else "ERR"
            print(f"  [{status}] {i}/{len(cases)} {record['eval_id']} "
                  f"({len(result['response'])} chars, tools={result['tools_called']})")

    await client.close()
    print(f"\nWrote {written} runs to {OUTPUT_PATH}")
    if written == 0:
        print("WARNING: 0 runs. Is the agent running and reachable at AGENT_BASE_URL?")


if __name__ == "__main__":
    asyncio.run(main())
