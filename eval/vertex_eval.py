"""
Vertex AI Agent Platform Evaluation Integration

Full integration with Google Cloud's Gemini Enterprise Agent Platform for:
- User Simulation (synthetic multi-turn conversations)
- AutoRaters (Task Success, Tool Use Quality, Safety)
- Loss Cluster Analysis (identify failure patterns)
- Agent Optimization (automatic prompt improvement)
- Online Monitoring (production quality tracking)
- Observability (traces, topology)

Prerequisites:
    1. Google Cloud Project with Vertex AI enabled
    2. pip install google-cloud-aiplatform[adk,evaluation]
    3. gcloud auth application-default login
    4. Set environment variables:
       - GOOGLE_CLOUD_PROJECT
       - GOOGLE_CLOUD_LOCATION (e.g., us-central1)

Usage:
    python eval/vertex_eval.py --mode [generate|evaluate|analyze|optimize|monitor]
"""

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional

# Check for required packages
try:
    import vertexai
    from vertexai import Client
    from vertexai.evaluation import EvalTask
    VERTEX_AVAILABLE = True
except ImportError:
    VERTEX_AVAILABLE = False
    print("Warning: google-cloud-aiplatform not installed")
    print("Install with: pip install google-cloud-aiplatform[adk,evaluation]")

from dotenv import load_dotenv

load_dotenv()

# Configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_NAME = "founder_validation_agent"

# Paths
EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
TRACES_DIR = EVAL_DIR / "traces"


# Agent Info for User Simulation
AGENT_INFO = {
    "name": "founder_validation_system",
    "root_agent_id": "founder_validation_orchestrator",
    "agents": {
        "founder_validation_orchestrator": {
            "agent_id": "founder_validation_orchestrator",
            "agent_type": "LlmAgent",
            "description": """A multi-agent orchestrator for startup validation.
            Coordinates specialist sub-agents: Problem Clarifier, Assumption Hunter,
            Customer Researcher, and Experiment Designer. Helps founders validate
            startup ideas using proven frameworks from The Mom Test, Lean Startup, and YC.""",
            "instruction": "You are the SoeMind Foundry Orchestrator helping founders validate startup ideas. You route to specialist agents for: problem clarification, assumption hunting, customer research, and experiment design.",
            "sub_agents": ["problem_clarifier", "assumption_hunter", "customer_researcher", "experiment_designer"]
        },
        "problem_clarifier": {
            "agent_id": "problem_clarifier",
            "agent_type": "LlmAgent",
            "description": "Extracts specific problem, customer segment, and identifies angry users",
            "instruction": "Help founders clarify their startup idea into a specific problem and customer segment."
        },
        "assumption_hunter": {
            "agent_id": "assumption_hunter",
            "agent_type": "LlmAgent",
            "description": "Identifies risky assumptions using Komisar framework",
            "instruction": "Help founders identify and prioritize risky assumptions to test."
        },
        "customer_researcher": {
            "agent_id": "customer_researcher",
            "agent_type": "LlmAgent",
            "description": "Designs interviews and analyzes customer feedback using Mom Test methodology",
            "instruction": "Help founders design interview questions and analyze customer feedback."
        },
        "experiment_designer": {
            "agent_id": "experiment_designer",
            "agent_type": "LlmAgent",
            "description": "Scopes MVPs and creates validation experiments",
            "instruction": "Help founders scope minimal MVPs and create 7-day validation plans."
        }
    }
}


class VertexEvaluator:
    """Vertex AI Agent Platform evaluation integration."""

    def __init__(self):
        if not VERTEX_AVAILABLE:
            raise RuntimeError("google-cloud-aiplatform not installed")

        if not PROJECT_ID:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT environment variable not set")

        # Initialize Vertex AI
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        self.client = Client(project=PROJECT_ID, location=LOCATION)

        RESULTS_DIR.mkdir(exist_ok=True)
        TRACES_DIR.mkdir(exist_ok=True)

    async def generate_scenarios(
        self,
        count: int = 10,
        scenario_type: str = "general",
        instruction: str = ""
    ) -> dict:
        """
        Generate synthetic test scenarios using User Simulation.

        Args:
            count: Number of scenarios to generate
            scenario_type: Type of scenarios (general, edge_cases, adversarial)
            instruction: Custom instruction for scenario generation
        """
        print(f"Generating {count} {scenario_type} scenarios...")

        generation_instruction = instruction or self._get_generation_instruction(scenario_type)

        eval_dataset = self.client.evals.generate_conversation_scenarios(
            agent_info=AGENT_INFO,
            config={
                "count": count,
                "generation_instruction": generation_instruction,
            },
            allow_cross_region_model=True,
        )

        # Save generated scenarios
        output_file = RESULTS_DIR / f"scenarios_{scenario_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump(eval_dataset, f, indent=2, default=str)

        print(f"Generated scenarios saved to: {output_file}")
        return eval_dataset

    def _get_generation_instruction(self, scenario_type: str) -> str:
        """Get generation instruction based on scenario type."""
        instructions = {
            "general": """Generate diverse scenarios where founders:
                - Share vague startup ideas needing clarification
                - Have clear problems but need help identifying assumptions
                - Need interview questions for customer discovery
                - Want to scope an MVP
                - Need a 7-day validation plan""",

            "edge_cases": """Generate challenging scenarios:
                - Founders who are feature-first (talk about tech, not problems)
                - Founders seeking validation, not truth
                - Founders who already built without validation
                - Founders with 'everyone' as target customer
                - Founders with weak interview results""",

            "adversarial": """Generate adversarial scenarios:
                - Founders who resist advice and want confirmation
                - Founders asking agent to validate bad ideas
                - Founders with contradictory information
                - Multi-turn conversations with pivots
                - Edge cases that might confuse the agent"""
        }
        return instructions.get(scenario_type, instructions["general"])

    async def run_inference(
        self,
        eval_dataset: dict,
        max_turns: int = 5
    ) -> list:
        """
        Run inference with user simulation to generate traces.

        Args:
            eval_dataset: Scenarios from generate_scenarios()
            max_turns: Maximum conversation turns
        """
        print(f"Running inference with max {max_turns} turns per scenario...")

        traces = self.client.evals.run_inference(
            agent=AGENT_NAME,  # Your deployed agent or local runner
            src=eval_dataset,
            config={
                "user_simulator_config": {
                    "max_turn": max_turns
                }
            }
        )

        # Save traces
        output_file = TRACES_DIR / f"traces_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump(traces, f, indent=2, default=str)

        print(f"Traces saved to: {output_file}")
        return traces

    async def evaluate(
        self,
        traces: list,
        metrics: Optional[list] = None
    ) -> dict:
        """
        Evaluate traces using AutoRaters.

        Args:
            traces: Traces from run_inference()
            metrics: List of metrics to compute
        """
        if metrics is None:
            metrics = [
                # Multi-turn metrics
                "MULTI_TURN_TASK_SUCCESS",
                "MULTI_TURN_TOOL_USE_QUALITY",
                # Response quality
                "RESPONSE_QUALITY",
                "INSTRUCTION_ADHERENCE",
                # Safety
                "SAFETY",
            ]

        print(f"Evaluating with metrics: {metrics}")

        eval_result = self.client.evals.evaluate(
            traces=traces,
            metrics=metrics
        )

        # Save results
        output_file = RESULTS_DIR / f"eval_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump(eval_result, f, indent=2, default=str)

        print(f"Evaluation results saved to: {output_file}")
        self._print_summary(eval_result)

        return eval_result

    def _print_summary(self, eval_result: dict):
        """Print evaluation summary."""
        print("\n" + "=" * 60)
        print("EVALUATION SUMMARY")
        print("=" * 60)

        if "metrics" in eval_result:
            for metric, value in eval_result["metrics"].items():
                status = "PASS" if value >= 0.7 else "FAIL"
                print(f"  {metric}: {value:.3f} [{status}]")

    async def analyze_failures(self, eval_result: dict) -> dict:
        """
        Generate loss clusters to identify failure patterns.

        This groups similar failures to help identify systematic issues.
        """
        print("Analyzing failure patterns...")

        loss_clusters = self.client.evals.generate_loss_clusters(
            eval_result=eval_result
        )

        # Save analysis
        output_file = RESULTS_DIR / f"loss_clusters_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump(loss_clusters, f, indent=2, default=str)

        print(f"Loss cluster analysis saved to: {output_file}")
        self._print_clusters(loss_clusters)

        return loss_clusters

    def _print_clusters(self, clusters: dict):
        """Print loss cluster summary."""
        print("\n" + "=" * 60)
        print("FAILURE PATTERN ANALYSIS")
        print("=" * 60)

        if "clusters" in clusters:
            for i, cluster in enumerate(clusters["clusters"], 1):
                print(f"\nCluster {i}: {cluster.get('name', 'Unnamed')}")
                print(f"  Count: {cluster.get('count', 'N/A')}")
                print(f"  Pattern: {cluster.get('pattern', 'N/A')}")

    async def optimize_agent(
        self,
        eval_result: dict,
        eval_dataset: dict,
        targets: Optional[list] = None
    ) -> dict:
        """
        Use the Optimizer to automatically improve agent prompts.

        Args:
            eval_result: Results from evaluate()
            eval_dataset: Test cases used
            targets: What to optimize (system_prompt, tool_descriptions)
        """
        if targets is None:
            targets = ["system_prompt"]

        print(f"Optimizing: {targets}")

        optimize_result = self.client.optimizer.optimize(
            targets=targets,
            benchmark=eval_result,
            tests=eval_dataset
        )

        # Save optimization suggestions
        output_file = RESULTS_DIR / f"optimization_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump(optimize_result, f, indent=2, default=str)

        print(f"Optimization suggestions saved to: {output_file}")
        return optimize_result

    async def setup_online_monitoring(self, agent_endpoint: str):
        """
        Set up continuous quality monitoring for production agent.

        This enables:
        - Real-time quality alerts
        - Automatic trace collection
        - Dashboard metrics
        """
        print(f"Setting up online monitoring for: {agent_endpoint}")

        # This would configure monitoring in Google Cloud
        # Actual implementation depends on your deployment setup
        config = {
            "agent_endpoint": agent_endpoint,
            "metrics": [
                "MULTI_TURN_TASK_SUCCESS",
                "MULTI_TURN_TOOL_USE_QUALITY",
                "SAFETY",
            ],
            "alert_thresholds": {
                "MULTI_TURN_TASK_SUCCESS": 0.7,
                "SAFETY": 0.95,
            },
            "sampling_rate": 0.1,  # Sample 10% of production traffic
        }

        print("Online monitoring configuration:")
        print(json.dumps(config, indent=2))
        return config


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Vertex AI Agent Evaluation")
    parser.add_argument(
        "--mode",
        choices=["generate", "evaluate", "analyze", "optimize", "full", "monitor"],
        default="full",
        help="Evaluation mode"
    )
    parser.add_argument("--count", type=int, default=10, help="Number of scenarios")
    parser.add_argument("--scenario-type", default="general", help="Scenario type")
    parser.add_argument("--traces-file", help="Path to existing traces file")

    args = parser.parse_args()

    if not VERTEX_AVAILABLE:
        print("\nTo use Vertex AI evaluation, install dependencies:")
        print("  pip install google-cloud-aiplatform[adk,evaluation]")
        print("\nThen set up authentication:")
        print("  gcloud auth application-default login")
        print("  export GOOGLE_CLOUD_PROJECT=your-project-id")
        return

    evaluator = VertexEvaluator()

    if args.mode == "generate":
        await evaluator.generate_scenarios(
            count=args.count,
            scenario_type=args.scenario_type
        )

    elif args.mode == "evaluate":
        if args.traces_file:
            with open(args.traces_file) as f:
                traces = json.load(f)
        else:
            print("Error: --traces-file required for evaluate mode")
            return
        await evaluator.evaluate(traces)

    elif args.mode == "analyze":
        # Load most recent eval results
        result_files = sorted(RESULTS_DIR.glob("eval_results_*.json"))
        if not result_files:
            print("No evaluation results found. Run 'evaluate' first.")
            return
        with open(result_files[-1]) as f:
            eval_result = json.load(f)
        await evaluator.analyze_failures(eval_result)

    elif args.mode == "optimize":
        # Load most recent eval results and dataset
        result_files = sorted(RESULTS_DIR.glob("eval_results_*.json"))
        scenario_files = sorted(RESULTS_DIR.glob("scenarios_*.json"))
        if not result_files or not scenario_files:
            print("Need both eval results and scenarios. Run full evaluation first.")
            return
        with open(result_files[-1]) as f:
            eval_result = json.load(f)
        with open(scenario_files[-1]) as f:
            eval_dataset = json.load(f)
        await evaluator.optimize_agent(eval_result, eval_dataset)

    elif args.mode == "full":
        # Full evaluation pipeline
        print("Running full evaluation pipeline...")

        # 1. Generate scenarios
        scenarios = await evaluator.generate_scenarios(
            count=args.count,
            scenario_type=args.scenario_type
        )

        # 2. Run inference
        traces = await evaluator.run_inference(scenarios)

        # 3. Evaluate
        eval_result = await evaluator.evaluate(traces)

        # 4. Analyze failures
        clusters = await evaluator.analyze_failures(eval_result)

        # 5. Get optimization suggestions
        optimization = await evaluator.optimize_agent(eval_result, scenarios)

        print("\n" + "=" * 60)
        print("FULL EVALUATION COMPLETE")
        print("=" * 60)

    elif args.mode == "monitor":
        # Set up production monitoring
        agent_endpoint = os.getenv("AGENT_ENDPOINT", "http://localhost:8101")
        await evaluator.setup_online_monitoring(agent_endpoint)


if __name__ == "__main__":
    asyncio.run(main())
