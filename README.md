# SoeMind Foundry: Founder Validation Agent

> **Google for Startups AI Agents Challenge - Track 2: Optimize**

An AI-powered multi-agent system that helps startup founders validate their ideas before building. Built with Google's Agent Development Kit (ADK) and deployed on Google Cloud.

**Live Demo:** https://founder-validation-agent-356663565224.us-central1.run.app

---

## Problem

**90% of startups fail.** The #1 reason? Building something nobody wants.

Founders often:
- Skip customer validation ("I know what they need")
- Build features before finding problems
- Target "everyone" instead of specific segments
- Confuse interest with commitment

## Solution

A multi-agent orchestration system that guides founders through rigorous idea validation using proven frameworks (Mom Test, Lean Startup, Design Thinking).

### What It Does

| Capability | Description |
|------------|-------------|
| **Clarify Ideas** | Transform vague ideas into structured problem/solution statements |
| **Hunt Assumptions** | Identify risky assumptions that need testing first |
| **Generate Questions** | Create customer interview questions (Mom Test style) |
| **Scope MVPs** | Define the smallest testable product |
| **Create Plans** | Build 7-day validation plans with concrete actions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│                      Cloud Run / localhost:8080                     │
├─────────────────────────────────────────────────────────────────────┤
│  Chat UI  │  Simulation  │  Templates  │  Traces  │  Optimizer     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (TypeScript/Express)                      │
├─────────────────────────────────────────────────────────────────────┤
│  ADK Agent Runtime  │  Track 2 API  │  Optimizer Engine             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────┐  ┌────────────────────────────┐│
│  │        ORCHESTRATOR             │  │   Quality Flywheel         ││
│  │        (Root Agent)             │  │   (Python Scripts)         ││
│  └───────────────┬─────────────────┘  │                            ││
│                  │                    │  • Scenario Generation     ││
│         A2A Protocol                  │  • Vertex AI Evaluation    ││
│                  │                    │  • Loss Cluster Analysis   ││
│    ┌─────────────┼─────────────┐      │  • GEPA Optimization       ││
│    │             │             │      └────────────────────────────┘│
│    ▼             ▼             ▼                                    │
│ ┌────────┐ ┌──────────┐ ┌──────────┐                               │
│ │Problem │ │Assumption│ │Customer  │                               │
│ │Clarifier│ │ Hunter   │ │Researcher│                               │
│ └────────┘ └──────────┘ └──────────┘                               │
│                  │                                                  │
│                  ▼                                                  │
│           ┌──────────┐                                              │
│           │Experiment│                                              │
│           │ Designer │                                              │
│           └──────────┘                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────┐
                    │  Gemini 2.0   │
                    │    Flash      │
                    │  (Vertex AI)  │
                    └───────────────┘
```

### Multi-Agent System

| Agent | Role | Tools |
|-------|------|-------|
| **Orchestrator** | Routes requests, synthesizes outputs | `detect_validation_stage`, `delegate_to_agent`, `synthesize_outputs` |
| **Problem Clarifier** | Structures vague ideas | `clarify_idea` |
| **Assumption Hunter** | Finds risky assumptions | `identify_risky_assumptions` |
| **Customer Researcher** | Generates interview questions | `generate_interview_questions` |
| **Experiment Designer** | Scopes MVPs & validation plans | `define_mvp_scope`, `create_7day_validation_plan` |

---

## Track 2: Optimize Features

### 1. Agent Simulation

Test the agent against **20 edge-case scenarios** representing difficult founder personas:

| Scenario Type | Example | Difficulty |
|---------------|---------|------------|
| Validation Seeker | "I already decided, just help me build" | Hard |
| Feature Obsessed | "I want AI + dashboards + integrations..." | Medium |
| Vague Customer | "My target is everyone who works" | Easy |
| Analysis Paralysis | "I've researched for 8 months..." | Medium |
| Regulatory Blind | "I'll deal with HIPAA later" | Hard |

**Live Simulation Dashboard:**
- Real-time conversation view (simulated user ↔ agent)
- Turn-by-turn streaming responses
- Live scoring and pass/fail evaluation
- Tool call tracking

### 2. Agent Observability

Full tracing of agent behavior:

- **Trace Viewer**: See every agent decision, tool call, and response
- **Latency Metrics**: Track response times per turn
- **Tool Analytics**: Which tools are called most frequently
- **Session Replay**: Review complete conversation flows

### 3. Agent Optimizer (Quality Flywheel)

**Google-style Quality Flywheel integration** for continuous agent improvement:

```
┌─────────────────────────────────────────────────────────────┐
│                    QUALITY FLYWHEEL                          │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Step 1    │───▶│   Step 2    │───▶│   Step 3    │      │
│  │  Generate   │    │    Run      │    │  Compute    │      │
│  │  Scenarios  │    │ Inference   │    │  Metrics    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                               │              │
│                                               ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Step 5    │◀───│   Step 4    │◀───│   Loss      │      │
│  │  Optimize   │    │   Analyze   │    │  Clusters   │      │
│  │   (GEPA)    │    │  Failures   │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Three Optimization Methods:**

| Method | Speed | Quality | Description |
|--------|-------|---------|-------------|
| **Built-in** | Fast (~5s) | Good | Pattern matching + Gemini rewrite |
| **Google ADK** | Medium (~30s) | Better | ADK optimizer with GEPA algorithm |
| **Quality Flywheel** | Slow (~2-5min) | Best | Full 5-step Google workflow |

**Features:**
- **Failure Pattern Detection**: Automatically identifies issues (hallucination, instruction following, tool calling)
- **A/B Testing**: Side-by-side comparison of instruction versions with per-scenario scores
- **Version History**: Track all prompt changes with rollback capability
- **Loss Cluster Analysis**: Groups failures by semantic category

### 4. A/B Testing

Compare instruction versions with real Gemini evaluation:

- Select any two versions to compare
- Tests against 5 edge-case scenarios
- Shows side-by-side scores per scenario
- Displays generated responses for comparison
- One-click to apply the winner

### 5. Dynamic Prompt Templates

Template system with `{{variable:default}}` syntax:

```
// Scenario Template
I've already decided to build {{product:a social network}}.
{{extra_context}}Don't try to change my mind.

// Agent Instruction Template
You are the {{agent_name:SoeMind Foundry Orchestrator}}.
Your validation_depth is {{depth:thorough}}.
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Agent Framework** | Google Agent Development Kit (ADK) |
| **LLM** | Gemini 2.0 Flash (Vertex AI) |
| **Runtime** | Node.js 22 + TypeScript |
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Backend** | Express.js |
| **Optimizer** | Python + google-cloud-aiplatform[adk,evaluation] |
| **Deployment** | Google Cloud Run |
| **Protocol** | A2A (Agent-to-Agent) |

---

## Quick Start

### Prerequisites

- Node.js 22+
- Python 3.10+ (for Quality Flywheel)
- Google Cloud account with Vertex AI enabled
- API key configured

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd founder-validate-agent

# Install Node.js dependencies
npm install
cd frontend && npm install && cd ..

# Install Python dependencies (for Quality Flywheel)
pip install google-cloud-aiplatform[adk,evaluation] google-genai

# Set environment variables
export GOOGLE_API_KEY="your-api-key"
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

### Running Locally

```bash
# Build and run
npm run build
npm start

# Or run in development mode
npm run dev
```

### Access

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main UI (Chat, Simulation, Templates, Optimizer) |
| http://localhost:8080/track2 | Track 2 Optimizer Dashboard |

---

## Deployment

### Deploy to Cloud Run

```bash
# Build
npm run build
cd frontend && npm run build && cd ..

# Deploy
gcloud run deploy founder-validation-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 300
```

---

## Project Structure

```
founder-validate-agent/
├── src/
│   ├── agent.ts                  # Root orchestrator agent
│   ├── agents/
│   │   ├── problem-clarifier.ts
│   │   ├── assumption-hunter.ts
│   │   ├── customer-researcher.ts
│   │   ├── experiment-designer.ts
│   │   └── agent-templates.ts    # Agent instruction templates
│   ├── tools/
│   │   └── validation-tools.ts   # Tool definitions
│   ├── simulation/
│   │   ├── simulator.ts          # Simulation engine
│   │   ├── edge-cases.ts         # 20 test scenarios
│   │   └── templates.ts          # Prompt templates
│   ├── optimizer/
│   │   └── optimizer.ts          # Optimization engine (Built-in, ADK, Flywheel)
│   ├── api/
│   │   ├── server.ts             # Express API server
│   │   ├── track2-api.ts         # Track 2 endpoints
│   │   └── streaming-simulation.ts
│   └── observability/
│       └── cloud-trace.ts        # Tracing integration
├── scripts/
│   ├── vertex_evaluation.py      # Quality Flywheel implementation
│   └── adk_optimizer.py          # Google ADK optimizer
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/track2/
│           ├── SimulationDashboard.jsx
│           ├── TemplateEditor.jsx
│           ├── AgentTemplateEditor.jsx
│           ├── TraceViewer.jsx
│           └── OptimizerDashboard.jsx
├── docs/
│   ├── README.md                 # Documentation index
│   ├── QUICKSTART.md             # Getting started guide
│   ├── OPTIMIZER_SYSTEM.md       # Full architecture docs
│   └── API_REFERENCE.md          # API endpoint reference
└── package.json
```

---

## API Endpoints

### Simulation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simulation/scenarios` | GET | List all test scenarios |
| `/api/simulation/run` | POST | Run single scenario |
| `/api/simulation/run-stream` | POST | Run with SSE streaming |
| `/api/simulation/run-all-stream` | POST | Run all with streaming |

### Optimizer

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/optimizer/analyze` | POST | Analyze failure patterns |
| `/api/optimizer/generate-fix` | POST | Generate optimized instruction |
| `/api/optimizer/ab-test` | POST | Run A/B test between versions |
| `/api/optimizer/versions` | GET | List instruction versions |
| `/api/optimizer/versions/:id/apply` | POST | Apply version to agent |

### Templates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET | List scenario templates |
| `/api/templates/:id` | PUT | Update template |
| `/api/agent-templates` | GET | List agent instruction templates |
| `/api/agent-templates/:id` | PUT | Update agent instruction |
| `/api/agent-templates/:id/reset` | POST | Reset to default |

### Observability

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/observability/traces/:sessionId` | GET | Get session traces |
| `/api/observability/analytics` | GET | Get analytics summary |

---

## Documentation

See the `/docs` folder for detailed documentation:

- [Quick Start Guide](docs/QUICKSTART.md)
- [Optimizer System Architecture](docs/OPTIMIZER_SYSTEM.md)
- [API Reference](docs/API_REFERENCE.md)

---

## Frameworks Used

Built on proven methodologies:

- **The Mom Test** (Rob Fitzpatrick) - Customer conversation rules
- **Lean Startup** (Eric Ries) - Leap-of-faith hypotheses
- **Inspired** (Marty Cagan) - Opportunity assessment
- **Lean Product Playbook** (Dan Olsen) - MVP scoping
- **YC Startup Library** - The 6 core questions
- **Google Quality Flywheel** - Agent evaluation & optimization

---

## Key Design Decisions

1. **Multi-Agent Architecture** - Specialized agents for each validation phase
2. **A2A Protocol** - Standard communication between agents
3. **Evidence-Based** - Push founders toward real user evidence
4. **Minimal MVPs** - Aggressively scope down to ONE feature
5. **Time-Boxed** - 7-day validation cycles with clear decision points
6. **Honest Feedback** - Challenge weak ideas respectfully
7. **Continuous Optimization** - Quality Flywheel for ongoing improvement

---

## Team

**SoeMind Foundry**

---

## License

Copyright 2024 SoeMind Foundry. All rights reserved.

This code is submitted for Google for Startups AI Agents Challenge evaluation purposes only.
No license is granted for commercial use, modification, or distribution without explicit permission.
