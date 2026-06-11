# Gen AI Evaluation Notebooks

Mirror of the `.ipynb` files from
[`GoogleCloudPlatform/generative-ai/gemini/evaluation`](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/evaluation),
downloaded for local reference. 41 notebooks total.

## Top-level (`gen_ai` Client / `client.evals` SDK)

| Notebook | Topic |
|---|---|
| `quick_start_gen_ai_eval.ipynb` | Getting started: quick Gen AI evaluation |
| `evaluate_models_in_vertex_ai_studio_and_model_garden.ipynb` | Evaluate models from Vertex AI Studio & Model Garden |
| `evaluating_third_party_llms_vertex_ai_gen_ai_eval_sdk.ipynb` | Evaluate third-party LLMs (OpenAI, Anthropic, MaaS, BYOM) |
| `model_migration_with_gen_ai_eval.ipynb` | Model migration (e.g., Gemini 2.0 → 2.5) |
| `evaluate_with_your_python_code.ipynb` | Custom-function (Python) metrics |
| `evaluate_gemini_structured_output.ipynb` | Evaluate structured (JSON) output |
| `evaluate_images_with_predefined_gecko.ipynb` | Text-to-image quality with predefined Gecko metric |
| `evaluate_videos_with_predefined_gecko.ipynb` | Text-to-video quality with predefined Gecko metric |
| `evaluating_observability_datasets.ipynb` | Evaluate observability (trace/log) datasets |
| `create_agent_and_run_evaluation.ipynb` | Create an agent and run evaluation |
| `create_genai_agent_evaluation.ipynb` | Create a GenAI agent evaluation |
| `view_genai_agent_evaluation_run.ipynb` | View a GenAI agent evaluation run |
| `evaluating_adk_agent.ipynb` | Evaluate an ADK agent |
| `multi_agent_evals_with_arize_and_crewai.ipynb` | Multi-agent evals with Arize & CrewAI |
| `multi_turn_agent_evaluation_with_user_simulation_metric_registration_auto_loss_analysis.ipynb` | Multi-turn agent eval, user simulation, metric registration, auto-loss analysis (see [../AGENT_EVALUATION_NOTEBOOK.md](../AGENT_EVALUATION_NOTEBOOK.md)) |

## `evaltask_approach/` (older `EvalTask` SDK interface)

| Notebook | Topic |
|---|---|
| `intro_to_gen_ai_evaluation_service_sdk.ipynb` | Intro to the Gen AI Evaluation Service SDK |
| `migration_guide_preview_to_GA_sdk.ipynb` | Migration guide: Preview → GA SDK |
| `compare_generative_ai_models.ipynb` | Compare generative AI models |
| `compare_and_migrate_from_palm_to_gemini.ipynb` | Compare & migrate from PaLM to Gemini |
| `customize_model_based_metrics.ipynb` | Customize model-based metrics |
| `bring_your_own_autorater_with_custom_metric.ipynb` | Bring your own autorater with a custom metric |
| `bring_your_own_computation_based_metric.ipynb` | Bring your own computation-based metric |
| `evaluate_autorater.ipynb` | Evaluate the autorater |
| `rubric_based_eval.ipynb` | Rubric-based evaluation |
| `multimodal_text_quality_rubric_evaluation.ipynb` | Multimodal text-quality rubric evaluation |
| `enhancing_quality_and_explainability_with_eval.ipynb` | Enhancing quality & explainability with eval |
| `prompt_engineering_gen_ai_evaluation_service_sdk.ipynb` | Prompt engineering with the eval SDK |
| `intro_batch_evaluation.ipynb` | Intro to batch evaluation |
| `evaluating_prompts_at_scale_with_gemini_batch_prediction_api.ipynb` | Evaluate prompts at scale (Batch Prediction API) |
| `evaluate_gemini_tool_use.ipynb` | Evaluate Gemini tool use |
| `evaluate_agent_final_answer_with_custom_parsing.ipynb` | Evaluate agent final answer with custom parsing |
| `evaluate_groundedness_with_custom_parsing.ipynb` | Evaluate groundedness with custom parsing |
| `evaluate_translation.ipynb` | Evaluate translation |
| `evaluate_multimodal_task_image.ipynb` | Evaluate a multimodal (image) task |
| `evaluate_images_with_gecko.ipynb` | Evaluate images with Gecko |
| `evaluate_videos_with_gecko.ipynb` | Evaluate videos with Gecko |
| `evaluate_rag_gen_ai_evaluation_service_sdk.ipynb` | Evaluate RAG with the eval SDK |
| `evaluate_rag_batch_pipeline.ipynb` | Evaluate RAG in a batch pipeline |
| `evaluate_langchain_chains.ipynb` | Evaluate LangChain chains |
| `evaluating_langgraph_agent.ipynb` | Evaluate a LangGraph agent |
| `evaluating_crewai_agent.ipynb` | Evaluate a CrewAI agent |

---

*Source revision: `main` branch. Re-download with the `curl` loop in the project history, or
fetch individually from `https://raw.githubusercontent.com/GoogleCloudPlatform/generative-ai/main/gemini/evaluation/<path>`.*
