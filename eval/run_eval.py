"""
Evaluation runner for Founder Validation Agent (TypeScript)

This Python script evaluates the TypeScript ADK agent using Google's
Agent Platform evaluation framework.

Usage:
    1. Start the TypeScript agent: ./start.sh backend (runs on http://localhost:8101)
    2. Run evaluation: python eval/run_eval.py

Requirements:
    pip install -r eval/requirements.txt
"""

import asyncio
import json
import os
from pathlib import Path
from datetime import datetime

import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8101")
EVAL_CASES_PATH = Path(__file__).parent / "eval_cases.json"
EVAL_CONFIG_PATH = Path(__file__).parent / "eval_config.json"
RESULTS_DIR = Path(__file__).parent / "results"


class AgentClient:
    """HTTP client for the TypeScript ADK agent."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=120.0)
        self.session_id = None
        self.user_id = "eval_user"
        self.app_name = "src"  # ADK uses "src" as app name

    async def create_session(self) -> str:
        """Create a new agent session."""
        import asyncio
        self.session_id = f"eval_session_{int(datetime.now().timestamp() * 1000)}"
        response = await self.client.post(
            f"{self.base_url}/apps/{self.app_name}/users/{self.user_id}/sessions/{self.session_id}",
            json={}
        )
        # Wait a bit for session to be fully created
        await asyncio.sleep(0.5)
        return self.session_id

    async def send_message(self, message: str) -> dict:
        """Send a message to the agent and get response via SSE."""
        import json as json_module

        # Use the run_sse endpoint with correct field names
        response = await self.client.post(
            f"{self.base_url}/run_sse",
            json={
                "appName": self.app_name,
                "userId": self.user_id,
                "sessionId": self.session_id,
                "newMessage": {
                    "role": "user",
                    "parts": [{"text": message}]
                },
                "streaming": False
            },
            timeout=120.0
        )

        # Parse SSE response
        text = response.text
        agent_response = ""
        tool_calls = []

        for line in text.split("\n"):
            if line.startswith("data: "):
                try:
                    data = json_module.loads(line[6:])
                    # Extract agent response from content
                    if "content" in data and data.get("author") != "user":
                        parts = data["content"].get("parts", [])
                        for part in parts:
                            if "text" in part:
                                agent_response += part["text"]
                            if "functionCall" in part:
                                tool_calls.append({"name": part["functionCall"].get("name", "")})
                except json_module.JSONDecodeError:
                    continue

        return {
            "response": agent_response,
            "text": agent_response,
            "tool_calls": tool_calls
        }

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


class SimpleEvaluator:
    """
    Simple evaluation framework for testing the agent.

    Checks:
    - Tool calls match expected tools
    - Response contains expected keywords
    - Response does not contain forbidden keywords
    """

    def __init__(self, config: dict):
        self.config = config
        self.results = []

    def evaluate_tool_calls(
        self,
        actual_tools: list[str],
        expected_tools: list[dict],
        match_type: str = "IN_ORDER"
    ) -> float:
        """Evaluate tool trajectory against expected tools."""
        if not expected_tools:
            return 1.0  # No expected tools = pass

        expected_names = [t["name"] for t in expected_tools]

        if match_type == "EXACT":
            return 1.0 if actual_tools == expected_names else 0.0
        elif match_type == "IN_ORDER":
            # Check if expected tools appear in order (with possible gaps)
            idx = 0
            for tool in actual_tools:
                if idx < len(expected_names) and tool == expected_names[idx]:
                    idx += 1
            return idx / len(expected_names) if expected_names else 1.0
        else:  # ANY_ORDER
            matches = sum(1 for t in expected_names if t in actual_tools)
            return matches / len(expected_names) if expected_names else 1.0

    def evaluate_response_contains(
        self,
        response: str,
        expected_contains: list[str]
    ) -> float:
        """Check if response contains expected keywords."""
        if not expected_contains:
            return 1.0

        response_lower = response.lower()
        matches = sum(1 for kw in expected_contains if kw.lower() in response_lower)
        return matches / len(expected_contains)

    def evaluate_response_not_contains(
        self,
        response: str,
        forbidden: list[str]
    ) -> float:
        """Check if response avoids forbidden keywords."""
        if not forbidden:
            return 1.0

        response_lower = response.lower()
        violations = sum(1 for kw in forbidden if kw.lower() in response_lower)
        return 1.0 - (violations / len(forbidden))

    def evaluate_turn(
        self,
        turn: dict,
        response: dict
    ) -> dict:
        """Evaluate a single conversation turn."""
        actual_response = response.get("response", response.get("text", ""))
        actual_tools = response.get("tool_calls", [])

        # Extract tool names if they're objects
        if actual_tools and isinstance(actual_tools[0], dict):
            actual_tools = [t.get("name", "") for t in actual_tools]

        results = {
            "invocation_id": turn.get("invocation_id"),
            "scores": {}
        }

        # Tool trajectory evaluation
        if "expected_tool_use" in turn:
            match_type = self.config.get("criteria", {}).get(
                "tool_trajectory_avg_score", {}
            ).get("match_type", "IN_ORDER")

            results["scores"]["tool_trajectory"] = self.evaluate_tool_calls(
                actual_tools,
                turn["expected_tool_use"],
                match_type
            )

        # Response contains evaluation
        if "expected_response_contains" in turn:
            results["scores"]["response_contains"] = self.evaluate_response_contains(
                actual_response,
                turn["expected_response_contains"]
            )

        # Response not contains evaluation
        if "expected_response_not_contains" in turn:
            results["scores"]["response_not_contains"] = self.evaluate_response_not_contains(
                actual_response,
                turn["expected_response_not_contains"]
            )

        # Calculate overall score
        scores = list(results["scores"].values())
        results["overall_score"] = sum(scores) / len(scores) if scores else 1.0
        results["passed"] = results["overall_score"] >= 0.7

        return results


async def run_evaluation():
    """Run the full evaluation suite."""
    print("=" * 60)
    print("Founder Validation Agent - Evaluation Suite")
    print("=" * 60)

    # Load test cases and config
    with open(EVAL_CASES_PATH) as f:
        eval_data = json.load(f)

    with open(EVAL_CONFIG_PATH) as f:
        config = json.load(f)

    evaluator = SimpleEvaluator(config)
    client = AgentClient(AGENT_URL)

    all_results = {
        "eval_set_id": eval_data["eval_set_id"],
        "timestamp": datetime.now().isoformat(),
        "agent_url": AGENT_URL,
        "cases": []
    }

    total_passed = 0
    total_cases = len(eval_data["eval_cases"])

    for case in eval_data["eval_cases"]:
        print(f"\n--- Running: {case['name']} ({case['eval_id']}) ---")

        case_result = {
            "eval_id": case["eval_id"],
            "name": case.get("name", case["eval_id"]),
            "turns": []
        }

        try:
            # Create new session for each test case
            await client.create_session()

            case_scores = []

            for turn in case["conversation"]:
                user_message = turn["user_content"]["parts"][0]["text"]
                print(f"  User: {user_message[:80]}...")

                # Send message to agent
                response = await client.send_message(user_message)

                # Evaluate the turn
                turn_result = evaluator.evaluate_turn(turn, response)
                case_result["turns"].append(turn_result)
                case_scores.append(turn_result["overall_score"])

                print(f"  Score: {turn_result['overall_score']:.2f} | Passed: {turn_result['passed']}")

            # Calculate case-level score
            case_result["overall_score"] = sum(case_scores) / len(case_scores)
            case_result["passed"] = case_result["overall_score"] >= 0.7

            if case_result["passed"]:
                total_passed += 1
                print(f"  CASE PASSED ({case_result['overall_score']:.2f})")
            else:
                print(f"  CASE FAILED ({case_result['overall_score']:.2f})")

        except httpx.ConnectError:
            print(f"  ERROR: Could not connect to agent at {AGENT_URL}")
            print(f"  Make sure the agent is running with: npm run dev")
            case_result["error"] = "Connection failed"
            case_result["passed"] = False
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            case_result["error"] = str(e)
            case_result["passed"] = False

        all_results["cases"].append(case_result)

    await client.close()

    # Summary
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print(f"Total Cases: {total_cases}")
    print(f"Passed: {total_passed}")
    print(f"Failed: {total_cases - total_passed}")
    print(f"Pass Rate: {total_passed / total_cases * 100:.1f}%")

    # Save results
    RESULTS_DIR.mkdir(exist_ok=True)
    results_file = RESULTS_DIR / f"eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nResults saved to: {results_file}")

    return all_results


async def run_single_test(eval_id: str):
    """Run a single test case by ID."""
    with open(EVAL_CASES_PATH) as f:
        eval_data = json.load(f)

    case = next((c for c in eval_data["eval_cases"] if c["eval_id"] == eval_id), None)
    if not case:
        print(f"Test case '{eval_id}' not found")
        return

    print(f"Running single test: {case['name']}")
    # ... (similar logic to run_evaluation but for single case)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Run single test
        asyncio.run(run_single_test(sys.argv[1]))
    else:
        # Run full suite
        asyncio.run(run_evaluation())
