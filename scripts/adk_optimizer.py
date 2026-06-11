#!/usr/bin/env python3
"""
ADK Optimizer Integration Script

Uses Google's official Agent Development Kit (ADK) to optimize agent instructions.
Can be called from TypeScript backend via subprocess.

Usage:
  python scripts/adk_optimizer.py --instruction "current instruction" --eval-set eval_cases.json

Output:
  JSON with optimized instruction and metrics
"""

import argparse
import asyncio
import json
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from google.adk.optimization import (
        SimplePromptOptimizer,
        SimplePromptOptimizerConfig,
    )
    from google.adk.agents import Agent
    ADK_AVAILABLE = True
except ImportError as e:
    ADK_AVAILABLE = False
    IMPORT_ERROR = str(e)


def create_eval_set_from_scenarios(scenarios: list) -> dict:
    """Convert our edge case scenarios to ADK eval set format."""
    eval_cases = []

    for scenario in scenarios:
        eval_case = {
            "eval_id": scenario.get("id", f"case_{len(eval_cases)}"),
            "conversation": [
                {
                    "invocation_id": "inv1",
                    "user_content": {
                        "parts": [{"text": scenario.get("initialPrompt", "")}],
                        "role": "user"
                    },
                    "final_response": {
                        "parts": [{"text": scenario.get("expectedAgentBehavior", "")}],
                        "role": "model"
                    }
                }
            ],
            "session_input": {
                "app_name": "founder_validation_agent",
                "user_id": "eval_user"
            }
        }
        eval_cases.append(eval_case)

    return {
        "eval_set_id": "optimization_eval_set",
        "name": "optimization_eval_set",
        "eval_cases": eval_cases
    }


async def optimize_with_adk(
    current_instruction: str,
    failure_patterns: list,
    eval_scenarios: list = None,
    num_iterations: int = 3,
    batch_size: int = 5
) -> dict:
    """
    Improve agent instructions via LLM-assisted rewriting.

    NOTE: This scaffolds ADK's SimplePromptOptimizer but does not yet invoke it;
    the rewrite is performed by Gemini. Returned `method` is "llm_instruction_rewrite"
    and `adk_optimizer_invoked` is False. To make this a true ADK optimization, call
    `SimplePromptOptimizer.optimize(...)` with a proper Agent + Sampler.

    Args:
        current_instruction: The current agent system instruction
        failure_patterns: List of detected failure patterns with examples
        eval_scenarios: Optional list of evaluation scenarios
        num_iterations: Number of optimization iterations
        batch_size: Batch size for each iteration

    Returns:
        Dictionary with optimized instruction and metrics
    """
    if not ADK_AVAILABLE:
        return {
            "success": False,
            "error": f"google-adk not available: {IMPORT_ERROR}",
            "fallback": True
        }

    try:
        # Build context from failure patterns
        failure_context = "\n".join([
            f"- Pattern: {p.get('pattern', 'unknown')}\n"
            f"  Type: {p.get('type', 'unknown')}\n"
            f"  Frequency: {p.get('frequency', 0)}\n"
            f"  Examples: {', '.join(p.get('examples', [])[:2])}"
            for p in failure_patterns
        ])

        # Create a simple agent with current instruction
        # Note: This is a simplified version - full implementation would use proper ADK Agent

        config = SimplePromptOptimizerConfig(
            num_iterations=num_iterations,
            batch_size=batch_size
        )

        optimizer = SimplePromptOptimizer(config=config)

        # For now, use Gemini directly to optimize based on patterns
        # Full ADK integration requires setting up proper Agent and Sampler
        from google import genai

        client = genai.Client()

        optimization_prompt = f"""You are an expert at optimizing AI agent system instructions.

CURRENT INSTRUCTION:
{current_instruction}

DETECTED FAILURE PATTERNS:
{failure_context}

Your task is to improve the instruction to address these failure patterns.

Rules:
1. Keep all existing content that works well
2. Add new sections or rules to address each failure pattern
3. Be specific with examples and phrases the agent should use
4. Output ONLY the complete optimized instruction, no explanation

OPTIMIZED INSTRUCTION:"""

        response = client.models.generate_content(
            model="gemini-2.0-flash-001",
            contents=optimization_prompt,
            config={
                "temperature": 0.3,
                "max_output_tokens": 8000,
            }
        )

        optimized_instruction = response.text.strip()

        return {
            "success": True,
            "optimized_instruction": optimized_instruction,
            "original_length": len(current_instruction),
            "optimized_length": len(optimized_instruction),
            "patterns_addressed": [p.get("pattern") for p in failure_patterns],
            # Honest labeling: the SimplePromptOptimizer above is constructed as a
            # scaffold but NOT invoked. The actual rewrite below is done by Gemini.
            # This is LLM-assisted instruction rewriting, not Google's GEPA algorithm.
            "method": "llm_instruction_rewrite",
            "adk_optimizer_invoked": False,
            "iterations": num_iterations
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "fallback": True
        }


def main():
    parser = argparse.ArgumentParser(description="ADK Agent Optimizer")
    parser.add_argument("--instruction", required=True, help="Current agent instruction")
    parser.add_argument("--patterns", required=True, help="JSON string of failure patterns")
    parser.add_argument("--iterations", type=int, default=3, help="Number of optimization iterations")
    parser.add_argument("--batch-size", type=int, default=5, help="Batch size per iteration")

    args = parser.parse_args()

    try:
        patterns = json.loads(args.patterns)
    except json.JSONDecodeError:
        patterns = []

    result = asyncio.run(optimize_with_adk(
        current_instruction=args.instruction,
        failure_patterns=patterns,
        num_iterations=args.iterations,
        batch_size=args.batch_size
    ))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
