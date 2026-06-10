# Founder Validation Agent - Documentation

## Overview

The Founder Validation Agent is an AI-powered system that helps founders validate their startup ideas through structured conversations, research tools, and automated optimization.

## Documentation Index

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Get up and running quickly |
| [OPTIMIZER_SYSTEM.md](./OPTIMIZER_SYSTEM.md) | Full architecture and implementation details |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoint documentation |

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
