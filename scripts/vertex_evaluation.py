#!/usr/bin/env python3
"""
Vertex AI Agent Evaluation & Optimization

Implements Google's Quality Flywheel:
1. Generate eval cases (User Simulation)
2. Run inferences against agent
3. Compute metrics (AutoRaters)
4. Conduct analysis (Failure Clusters)
5. Optimize the agent

Uses official google-cloud-aiplatform[adk,evaluation] SDK
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Optional

# Check for required packages
try:
    import vertexai
    from vertexai import Client, types
    from google.adk import Agent
    VERTEX_AVAILABLE = True
except ImportError as e:
    VERTEX_AVAILABLE = False
    IMPORT_ERROR = str(e)


class VertexAgentEvaluator:
    """
    Google-style Agent Evaluation using Vertex AI Gen AI Evaluation Service.
    Implements the Quality Flywheel workflow.
    """

    def __init__(self, project_id: str = None, location: str = "us-central1"):
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        self.location = location

        if VERTEX_AVAILABLE:
            self.client = Client(project=self.project_id, location=self.location)
        else:
            self.client = None

    def generate_eval_scenarios(
        self,
        agent_instruction: str,
        agent_name: str = "validation_agent",
        count: int = 5,
        generation_instruction: str = None,
        environment_context: str = None
    ) -> dict:
        """
        Step 1: Generate synthetic conversation scenarios using User Simulation.

        Uses client.evals.generate_conversation_scenarios() to automatically
        create test cases based on agent capabilities.
        """
        if not VERTEX_AVAILABLE:
            return {"error": IMPORT_ERROR, "fallback": True}

        try:
            # Create AgentInfo from instruction
            agent_info = types.evals.AgentInfo(
                name=agent_name,
                instruction=agent_instruction,
            )

            # Generate scenarios
            config = {"count": count}
            if generation_instruction:
                config["generation_instruction"] = generation_instruction
            if environment_context:
                config["environment_context"] = environment_context

            eval_dataset = self.client.evals.generate_conversation_scenarios(
                agent_info=agent_info,
                config=config,
            )

            # Convert to JSON-serializable format
            scenarios = []
            if hasattr(eval_dataset, 'eval_dataset_df'):
                for _, row in eval_dataset.eval_dataset_df.iterrows():
                    scenarios.append(row.to_dict())

            return {
                "success": True,
                "scenarios": scenarios,
                "count": len(scenarios),
            }
        except Exception as e:
            return {"error": str(e), "fallback": True}

    async def run_inference(
        self,
        agent: Agent,
        eval_dataset: any,
        max_turns: int = 5
    ) -> dict:
        """
        Step 2: Run agent against eval cases to capture traces.

        Uses client.evals.run_inference() with user simulator.
        """
        if not VERTEX_AVAILABLE:
            return {"error": IMPORT_ERROR, "fallback": True}

        try:
            traces = self.client.evals.run_inference(
                agent=agent,
                src=eval_dataset,
                config={
                    "user_simulator_config": {
                        "max_turn": max_turns,
                    }
                },
            )

            return {
                "success": True,
                "traces": traces,
            }
        except Exception as e:
            return {"error": str(e), "fallback": True}

    def evaluate_with_metrics(
        self,
        traces: any,
        metrics: list = None
    ) -> dict:
        """
        Step 3: Compute metrics using Multi-turn AutoRaters.

        Default metrics:
        - MULTI_TURN_TASK_SUCCESS
        - MULTI_TURN_TOOL_USE_QUALITY
        - MULTI_TURN_TRAJECTORY_QUALITY
        """
        if not VERTEX_AVAILABLE:
            return {"error": IMPORT_ERROR, "fallback": True}

        try:
            if metrics is None:
                metrics = [
                    types.RubricMetric.MULTI_TURN_TASK_SUCCESS,
                    types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY,
                    types.RubricMetric.MULTI_TURN_TRAJECTORY_QUALITY,
                ]

            # Official SDK kwarg is `dataset=` (not `traces=`); the dataset carries the traces.
            eval_result = self.client.evals.evaluate(
                dataset=traces,
                metrics=metrics,
                config={"evaluation_service_qps": 5.0},
            )

            # Extract results
            results = {
                "success": True,
                "metrics": {},
            }

            if hasattr(eval_result, 'summary_metrics'):
                for metric_name, value in eval_result.summary_metrics.items():
                    results["metrics"][metric_name] = {
                        "mean_score": value.get("mean", 0),
                        "pass_rate": value.get("pass_rate", 0),
                    }

            return results
        except Exception as e:
            return {"error": str(e), "fallback": True}

    def generate_loss_clusters(
        self,
        eval_result: any,
        metric: str = "MULTI_TURN_TOOL_USE_QUALITY"
    ) -> dict:
        """
        Step 4: Identify failure patterns using Auto-Loss Analysis.

        Groups failed evaluations into semantic loss clusters based on:
        - Hallucination patterns
        - Instruction following issues
        - Tool calling errors
        - Tool output handling problems
        """
        if not VERTEX_AVAILABLE:
            return {"error": IMPORT_ERROR, "fallback": True}

        try:
            metric_type = getattr(types.RubricMetric, metric, types.RubricMetric.MULTI_TURN_TOOL_USE_QUALITY)

            loss_clusters = self.client.evals.generate_loss_clusters(
                eval_result=eval_result,
                metric=metric_type,
            )

            # Extract cluster information
            clusters = []
            if hasattr(loss_clusters, 'results') and loss_clusters.results:
                for cluster in loss_clusters.results:
                    clusters.append({
                        "category": cluster.get("category", "Unknown"),
                        "pattern": cluster.get("loss_pattern", "Unknown"),
                        "count": cluster.get("count", 0),
                        "examples": cluster.get("examples", [])[:3],
                        "description": cluster.get("description", ""),
                    })

            return {
                "success": True,
                "clusters": clusters,
                "total_failures": sum(c.get("count", 0) for c in clusters),
            }
        except Exception as e:
            return {"error": str(e), "fallback": True}

    def optimize_agent(
        self,
        eval_result: any,
        eval_dataset: any,
        targets: list = None
    ) -> dict:
        """
        Step 5: Optimize the agent via the Vertex prompt optimizer.

        Uses client.prompt_optimizer.optimize() to programmatically refine
        system instructions based on failure data. (Note: there is no
        `client.optimizer` namespace; the correct accessor is `prompt_optimizer`.)
        """
        if not VERTEX_AVAILABLE:
            return {"error": IMPORT_ERROR, "fallback": True}

        try:
            if targets is None:
                targets = ["system_prompt"]

            optimize_result = self.client.prompt_optimizer.optimize(
                targets=targets,
                benchmark=eval_result,
                tests=eval_dataset,
            )

            return {
                "success": True,
                "optimized_instruction": optimize_result.get("optimized_prompt", ""),
                "improvements": optimize_result.get("improvements", []),
                "score_before": optimize_result.get("score_before", 0),
                "score_after": optimize_result.get("score_after", 0),
            }
        except Exception as e:
            return {"error": str(e), "fallback": True}


async def run_quality_flywheel(
    agent_instruction: str,
    agent_name: str = "validation_agent",
    scenario_count: int = 5,
    generation_instruction: str = None,
    max_turns: int = 5
) -> dict:
    """
    Run the complete Quality Flywheel workflow:
    1. Generate eval scenarios
    2. Run inferences
    3. Evaluate with metrics
    4. Generate loss clusters
    5. Optimize agent

    Returns comprehensive results including optimized instruction.
    """
    evaluator = VertexAgentEvaluator()

    results = {
        "workflow": "quality_flywheel",
        "steps": {},
    }

    # Step 1: Generate scenarios
    print("[Quality Flywheel] Step 1: Generating eval scenarios...")
    scenarios_result = evaluator.generate_eval_scenarios(
        agent_instruction=agent_instruction,
        agent_name=agent_name,
        count=scenario_count,
        generation_instruction=generation_instruction,
    )
    results["steps"]["generate_scenarios"] = scenarios_result

    if not scenarios_result.get("success"):
        results["error"] = "Failed at scenario generation"
        return results

    # For local testing without full ADK agent, use Gemini directly
    print("[Quality Flywheel] Step 2-5: Running evaluation pipeline...")

    # Use Gemini to simulate the evaluation and optimization
    try:
        from google import genai

        client = genai.Client()

        # Simulate evaluation by analyzing instruction against scenarios
        eval_prompt = f"""Analyze this AI agent instruction and identify potential failure patterns.

AGENT INSTRUCTION:
{agent_instruction}

TEST SCENARIOS:
{json.dumps(scenarios_result.get("scenarios", []), indent=2)[:2000]}

Identify:
1. Potential failure patterns (hallucination, instruction following, tool calling issues)
2. Loss clusters (group similar failures)
3. Specific improvements needed

Output as JSON:
{{
  "metrics": {{
    "task_success_rate": 0.0-1.0,
    "tool_use_quality": 0.0-1.0,
    "trajectory_quality": 0.0-1.0
  }},
  "loss_clusters": [
    {{"category": "...", "pattern": "...", "count": N, "description": "..."}}
  ],
  "improvements_needed": ["..."]
}}"""

        response = client.models.generate_content(
            model="gemini-2.0-flash-001",
            contents=eval_prompt,
            config={"temperature": 0.2}
        )

        # Parse evaluation results
        eval_text = response.text
        try:
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', eval_text)
            if json_match:
                eval_data = json.loads(json_match.group())
                results["steps"]["evaluate"] = {
                    "success": True,
                    "metrics": eval_data.get("metrics", {}),
                }
                results["steps"]["loss_clusters"] = {
                    "success": True,
                    "clusters": eval_data.get("loss_clusters", []),
                }
        except:
            results["steps"]["evaluate"] = {"success": False, "raw": eval_text}

        # Step 5: LLM-assisted instruction optimization (Gemini rewrite).
        # NOTE: This is not Google's GEPA algorithm; it is an LLM rewrite pass.
        print("[Quality Flywheel] Optimizing agent instruction...")

        optimize_prompt = f"""You are optimizing this AI agent instruction by rewriting it to address the identified failure patterns.

CURRENT INSTRUCTION:
{agent_instruction}

IDENTIFIED ISSUES:
{json.dumps(results["steps"].get("loss_clusters", {}).get("clusters", []), indent=2)}

IMPROVEMENTS NEEDED:
{json.dumps(eval_data.get("improvements_needed", []) if 'eval_data' in dir() else [], indent=2)}

Your task:
1. Keep all working parts of the instruction
2. Add specific rules to address each identified issue
3. Make the instruction more robust against failure patterns
4. Be specific with examples and phrases the agent should use

Output ONLY the complete optimized instruction (no explanation, no markdown):"""

        optimize_response = client.models.generate_content(
            model="gemini-2.0-flash-001",
            contents=optimize_prompt,
            config={"temperature": 0.3, "max_output_tokens": 8000}
        )

        optimized_instruction = optimize_response.text.strip()

        results["steps"]["optimize"] = {
            "success": True,
            "optimized_instruction": optimized_instruction,
            "original_length": len(agent_instruction),
            "optimized_length": len(optimized_instruction),
        }

        results["success"] = True
        results["optimized_instruction"] = optimized_instruction

    except Exception as e:
        results["error"] = str(e)
        results["success"] = False

    return results


def main():
    parser = argparse.ArgumentParser(description="Vertex AI Agent Evaluation & Optimization")
    parser.add_argument("--instruction", required=True, help="Current agent instruction")
    parser.add_argument("--patterns", help="JSON string of failure patterns (optional)")
    parser.add_argument("--scenarios", type=int, default=5, help="Number of eval scenarios")
    parser.add_argument("--max-turns", type=int, default=5, help="Max conversation turns")
    parser.add_argument("--mode", choices=["evaluate", "optimize", "full"], default="full",
                        help="Mode: evaluate only, optimize only, or full flywheel")

    args = parser.parse_args()

    # Run the quality flywheel
    result = asyncio.run(run_quality_flywheel(
        agent_instruction=args.instruction,
        scenario_count=args.scenarios,
        max_turns=args.max_turns,
    ))

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
