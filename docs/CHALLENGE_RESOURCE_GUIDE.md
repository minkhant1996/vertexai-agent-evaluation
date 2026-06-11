# Google for Startups AI Agents Challenge — Resource Guide (2026)

> Reference summary of the official Google for Startups AI Agents Challenge resource guide.
> This file is documentation of the **challenge program**, not a claim about this project.
> For what this repository actually implements, see
> [GENAI_EVALUATION_SERVICE.md](./GENAI_EVALUATION_SERVICE.md) and
> [OPTIMIZE_AGENT_PROMPTS.md](./OPTIMIZE_AGENT_PROMPTS.md).

## Overview

The challenge gives startup teams support, credits, and technical resources to build
production-ready agents on the **Gemini Enterprise Agent Platform** (Agent Platform).

- All eligible startups who create a project receive **$500 in Google Cloud credits**.
- Total prize pool: **over $90,000**.

## Getting set up on Google Cloud

Existing users: visit `cloud.google.com` and create a new project.

New users:

1. **Sign in** — go to `cloud.google.com`, click *Get started for free*, log in with a Gmail account.
2. **Initial setup** — select country, agree to Terms of Service, click *Continue*.
3. **Verify identity** — choose *Individual* account type; enter name, address, and a payment
   method (bot-prevention only; no auto-charge), then click *Start My Free Trial*.
4. **Initiate project** — in the Cloud Console, open the project drop-down and select *New Project*.
5. **Create project** — name it (e.g., `Startup-AI-Challenge-app`), leave Organization as
   *No organization*, click *Create*.

## The three tracks

### Track 1 — Build (Net-new agents)

Start from a blank canvas and a complex business problem. Use the **Agent Development Kit (ADK)**
— or a preferred framework like LangChain or CrewAI — to architect autonomous agents that use
the **Model Context Protocol (MCP)** to securely connect to external tools.

**Bootstrapping agent tools on GCP:**

- **Understand the core ADK framework** — how Agents, Sessions, and Runners work together.
- **Bootstrap via the Agents CLI** — fastest path; scaffold/clone production-ready templates
  (ReAct, RAG, Multi-Agent) from the terminal.
- **Agent Starter Pack repository** — manual alternative to the CLI for the same patterns.
- **Awesome ADK Agents** — curated community list of 80+ pre-configured / hackathon-winning agents.
- **Cloud Shell quick setup** — `git clone` a template, configure API keys, test in the browser
  before deploying; no local environment needed.

**Key repositories & docs:**

- Official Python ADK repo (`google/adk-python`) — 5-layer architecture, agent logic, pre-built
  tools (MCP, OpenAPI), `AgentEngineSandboxCodeExecutor`.
- Official Agent Platform documentation — quickstarts bridging local code to cloud deployment.
- ADK Agents community collection — 80+ production-ready templates.
- Agent Search and grounding notebooks — Jupyter snippets for grounding with Datastores and
  Google Search (relevant to RAG / Optimization tracks).

**Deploying & integrating:**

- **Deploy to Agent Runtime** — managed runtime, scaling, IAM, custom container images.
- **Grounding & custom RAG (Agent Search)** — ground responses on enterprise data in Cloud
  Storage or BigQuery to reduce hallucinations.
- **Managing state (Sessions & Memory Bank)** — contextual memory via the `AdkApp` class.
- **Public grounding (Google Search)** — real-time public data with compliant search suggestions.

**Example — Smart Facility Energy Agent:** a multi-agent system that optimizes a building's
energy use based on occupancy, weather, and grid pricing. ADK builds the orchestration engine;
MCP connects to IoT HVAC sensors and weather APIs; the agent autonomously lowers heating in
unoccupied rooms based on calendar data.

### Track 2 — Optimize (Existing agents)

For teams moving an existing agent from sandbox to real-world reliability: stress-test multi-step
reasoning, debug stalled logic, refine system instructions for production-grade scale.

**Testing & refining:**

- **Framework flexibility** — Agent Platform services (Simulation, Observability, Runtime) work
  with any framework; integrate most seamlessly with ADK, but mixing with LangChain/CrewAI is fine.
- **The Agents CLI** — next-generation tool for build/evaluate/iterate workflows (replaces the
  previous agents-starter-pack).
- **Agent Simulation & Evaluation** — generate synthetic user interactions and multivariable edge
  cases; measure against baselines in a controlled environment.
- **Agent Observability** — trace complex reasoning, debug decision bottlenecks.
- **Managing state** — Runtime Sessions and Memory Bank for context across long multi-turn evals.

**Deploying & submitting:**

- Deploy optimized code to Agent Runtime (scaling + IAM).
- Grounding / custom RAG via Agent Search Data Stores (real or mock data).
- Public grounding (Google Search) for real-time data needs.
- Capture a demo emphasizing **before vs. after** — show the agent now handling edge cases that
  previously caused it to stall or fail.

**Example:** the Smart Facility Energy Agent works on a normal day but struggles when a sudden
extreme weather event coincides with a peak-demand pricing surge. The team uses Agent Simulation
to generate the rare multivariable event, Agent Observability to trace the stalled
comfort-vs-cost decision, and Agent Optimizer to programmatically refine the instructions.

> **Note for this repository:** This project targets Track 2 (Optimize). The optimization and
> evaluation steps it ships today are partly emulated with a Gemini prompt rather than the real
> Agent Optimizer / Gen AI Evaluation Service — see the implementation-status sections linked at
> the top of this file before presenting it as a full Agent Platform integration.

### Track 3 — Refactor for Google Cloud Marketplace & Gemini Enterprise

Transform a functional MVP into a scalable, monetizable enterprise asset. Migrate runtimes to
Google Cloud and refactor to use the **Agent-to-Agent (A2A)** protocol for discovery and
coordination in the Google Cloud Agent Marketplace.

> *Completing Track 3 meets the foundational technical criteria for Gemini Enterprise, but
> submission does not guarantee a Marketplace listing. Final publication requires further
> business and security evaluations and formal partnership agreements with Google Cloud.*

**Steps:**

- **Validate the B2B use case** — design explicitly for business workflows.
- **Migrate to a Google Cloud runtime** — Cloud Run (stateless containers) or GKE (complex /
  stateful orchestration).
- **Route LLMs through Model Garden** — Gemini or a third-party/open-source LLM deployed via
  Model Garden for strict data security.
- **Implement the A2A protocol** — A2A-native architecture for secure agent-to-agent data exchange.
- **Multi-agent orchestration (Agent Builder)** — connect to enterprise ecosystems via A2A and
  Agent Garden tools.
- **Finalize documentation** — map the GKE/Cloud Run architecture, model usage, data processing,
  and the A2A intents the agent exposes and consumes.

**Build examples:** an Energy Agent deployed on Cloud Run/GKE, powered exclusively by Gemini,
with Agent Identity (cryptographic ID) and A2A to coordinate with an internal HR agent; or a
marketing agent doing multi-modal video assembly that uses A2A to retrieve approved brand assets
from a Digital Asset Manager agent.

## Why participate

| Benefit | Detail |
|---|---|
| Cloud credits | $500 in credits per eligible startup |
| Prize pool | Share of over $90,000 in total prizes |
| Technical support | Google experts, technical webinars, resource guides |
| Global recognition | Exposure to expert judges and the Google Cloud ecosystem |

## Judging criteria (from the Official Rules)

| Criterion | Weight |
|---|---|
| Technical Implementation | 30% |
| Business Case | 30% |
| Innovation and Creativity | 20% |
| Demo and Presentation | 20% |

> Submissions must "function as depicted" in the description/video, be original work, and the
> Sponsor may disqualify for "cheating, deception, or other unfair playing practices." This is
> why the implementation-status notes in this repo's docs distinguish real SDK paths from
> emulated ones.
