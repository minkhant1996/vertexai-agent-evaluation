# Founder Validation Agent - Documentation

## Overview

The Founder Validation Agent is an AI-powered system that helps founders validate their startup ideas through structured conversations, research tools, and automated optimization.

## Documentation Index

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Get up and running quickly |
| [OPTIMIZER_SYSTEM.md](./OPTIMIZER_SYSTEM.md) | Full architecture and implementation details |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoint documentation |
| [CHALLENGE_RESOURCE_GUIDE.md](./CHALLENGE_RESOURCE_GUIDE.md) | Google for Startups AI Agents Challenge — tracks, resources, prizes, judging criteria |

### Vertex AI / Gemini Enterprise Agent Platform — Evaluation reference

| Document | Description |
|----------|-------------|
| [GENAI_EVALUATION_SERVICE.md](./GENAI_EVALUATION_SERVICE.md) | Gen AI evaluation service overview — adaptive rubrics, metrics, SDK interfaces |
| [AGENT_EVALUATION.md](./AGENT_EVALUATION.md) | Agent evaluation methodology — eval cases, traces, user simulation, optimization |
| [OFFLINE_EVALUATION.md](./OFFLINE_EVALUATION.md) | Run offline evaluations on historical traces and sessions (telemetry + console steps) |
| [ONLINE_MONITORS.md](./ONLINE_MONITORS.md) | Continuous evaluation with online monitors — production quality drift detection |
| [MANAGE_METRICS.md](./MANAGE_METRICS.md) | Metric Registry — predefined, custom LLM, and custom code metrics |
| [ANALYZE_RESULTS.md](./ANALYZE_RESULTS.md) | Analyze results & failure clusters — loss-pattern taxonomies, triage workflow |
| [QUALITY_ALERTS.md](./QUALITY_ALERTS.md) | Configure quality alerts — Cloud Monitoring thresholds, gcloud/SDK policies |
| [OPTIMIZE_AGENT_PROMPTS.md](./OPTIMIZE_AGENT_PROMPTS.md) | Optimize agent prompts — the Quality Flywheel and ADK `adk optimize` (GEPA) |
| [AGENT_EVALUATION_NOTEBOOK.md](./AGENT_EVALUATION_NOTEBOOK.md) | Multi-turn agent eval notebook walkthrough — user simulation, custom metrics, loss analysis |

## System Components

### Track 1: Validation Agent
The main conversational agent that guides founders through idea validation.

**Key Features:**
- Multi-turn conversation management
- Research tool integration (web search, market analysis)
- Validation plan generation
- MVP scope definition

### Track 2: Agent Optimizer
Automated system for improving agent instructions based on test results.

**Key Features:**
- Failure pattern detection
- Google Quality Flywheel integration
- A/B testing between versions
- Instruction version management

## Quick Links

### For Users
- Access the optimizer: `/track2`
- View agent templates: `/track2` > Agent Prompts tab

### For Developers
- Main API: `/src/api/track2-api.ts`
- Optimizer core: `/src/optimizer/optimizer.ts`
- Python scripts: `/scripts/`
- Frontend: `/frontend/src/components/track2/`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│   Track 1: Chat UI    │    Track 2: Optimizer Dashboard     │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
             ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (TypeScript/Express)               │
│   Agent Handler  │  Optimizer API  │  Storage Manager       │
└────────────┬──────────────┬─────────────────────────────────┘
             │              │
             ▼              ▼
┌────────────────────┐  ┌─────────────────────────────────────┐
│   Gemini 2.0 API   │  │         Python Scripts              │
│  (Conversations)   │  │  vertex_evaluation.py (Flywheel)    │
└────────────────────┘  │  adk_optimizer.py (ADK)             │
                        └─────────────────────────────────────┘
                                        │
                                        ▼
                        ┌─────────────────────────────────────┐
                        │          Vertex AI                   │
                        │  Evaluation Service  │  Optimizer    │
                        └─────────────────────────────────────┘
```

> **Implementation status (read before judging/demoing):** The Vertex AI box above is the
> *intended* path and is scaffolded in code (`scripts/vertex_evaluation.py`,
> `scripts/adk_optimizer.py` wrap the real `client.evals.*`, `client.optimizer.optimize`, and
> ADK `SimplePromptOptimizer` SDKs). The **live demo path currently bypasses these**: evaluation
> metrics, loss clusters, and instruction optimization are produced by a `gemini-2.0-flash-001`
> prompt, not by the Gen AI Evaluation Service or the GEPA algorithm. See
> [GENAI_EVALUATION_SERVICE.md § Implementation status](./GENAI_EVALUATION_SERVICE.md#implementation-status-in-this-project)
> and [OPTIMIZE_AGENT_PROMPTS.md § Implementation status](./OPTIMIZE_AGENT_PROMPTS.md#implementation-status-in-this-project)
> for exactly which steps are real vs. emulated, and how to wire the real path.

## Environment Setup

```bash
# Required environment variables
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Optional
VERTEX_AI_LOCATION=us-central1
PORT=8080
```

## Deployment

```bash
# Build
npm run build

# Deploy to Cloud Run
gcloud run deploy founder-validation-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial release with Track 1 |
| 2.0.0 | 2024-01 | Added Track 2 (Optimizer) |
| 2.1.0 | 2024-01 | Quality Flywheel integration |
| 2.2.0 | 2024-01 | A/B testing, version management |
