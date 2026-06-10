# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Port 8100)                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         React + Vite + Tailwind                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │    Chat     │  │    Tool     │  │   Metrics   │  │  Validation │  │  │
│  │  │  Interface  │  │   Activity  │  │  Dashboard  │  │   Progress  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP/SSE
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Port 8101)                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Security Layer                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │    Auth     │  │    CORS     │  │    Rate     │  │   Secret    │  │  │
│  │  │  Middleware │  │   Config    │  │   Limiter   │  │   Manager   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                     │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Guardrails Layer                               │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────┐  │  │
│  │  │   Input Validation  │  │  Output Validation  │  │  Tool Call    │  │  │
│  │  │  • Prompt injection │  │  • PII redaction    │  │  Validation   │  │  │
│  │  │  • Content filter   │  │  • Safety check     │  │  • Schema     │  │  │
│  │  │  • Length limits    │  │  • Length limits    │  │  • Params     │  │  │
│  │  └─────────────────────┘  └─────────────────────┘  └───────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                     │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ADK Agent Orchestrator                              │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                  founder_validation_agent                        │  │  │
│  │  │    Model: gemini-2.0-flash  │  Framework: Google ADK             │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                 │                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      MCP-Style Tools                             │  │  │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │  │  │
│  │  │  │ clarify_  │ │ identify_ │ │ generate_ │ │  define_  │       │  │  │
│  │  │  │   idea    │ │ risky_    │ │ interview │ │   mvp_    │       │  │  │
│  │  │  │           │ │assumptions│ │ questions │ │   scope   │       │  │  │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │  │  │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │  │  │
│  │  │  │ create_   │ │   save_   │ │   save_   │ │   log_    │       │  │  │
│  │  │  │ 7day_plan │ │  venture  │ │ interview │ │  blocker  │       │  │  │
│  │  │  │           │ │           │ │   notes   │ │           │       │  │  │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                     │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Observability Layer                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │     Tracing     │  │    Logging      │  │    Metrics      │       │  │
│  │  │  • Span tracking│  │  • Structured   │  │  • Request rate │       │  │
│  │  │  • Tool calls   │  │  • GCP format   │  │  • Token usage  │       │  │
│  │  │  • Latency      │  │  • Error logs   │  │  • Tool counts  │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
┌─────────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│      Gemini API         │ │   PostgreSQL    │ │   Google Cloud          │
│  (Vertex AI)            │ │   (Optional)    │ │   Services              │
│  ┌───────────────────┐  │ │  ┌───────────┐  │ │  ┌───────────────────┐  │
│  │ gemini-2.0-flash  │  │ │  │  Users    │  │ │  │  Cloud Run        │  │
│  │                   │  │ │  │  Ventures │  │ │  │  Secret Manager   │  │
│  │ • Reasoning       │  │ │  │  Sessions │  │ │  │  Cloud Logging    │  │
│  │ • Tool calling    │  │ │  │  Evidence │  │ │  │  Cloud Trace      │  │
│  └───────────────────┘  │ │  └───────────┘  │ │  │  Cloud Monitoring │  │
└─────────────────────────┘ └─────────────────┘ │  └───────────────────┘  │
                                                └─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVALUATION (Port 8102)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Python Evaluation Suite                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Simple    │  │  Vertex AI  │  │    Loss     │  │   Agent     │  │  │
│  │  │    Eval     │  │  AutoRaters │  │  Clusters   │  │ Optimizer   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Input Guardrail │──── Block if: prompt injection, harmful content
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rate Limiter   │──── Block if: > 100 req/min
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ADK Agent     │
│   (Gemini)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│ Tool  │ │ LLM   │
│ Call  │ │ Resp  │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌─────────────────┐
│ Tool Guardrail  │──── Validate parameters with Zod schema
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Output Guardrail │──── Redact PII, block harmful output
└────────┬────────┘
         │
         ▼
    Response
```

## Coaching Framework Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VALIDATION JOURNEY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Stage 1: CLARIFY IDEA                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: clarify_idea, save_venture                                    │   │
│  │ Frameworks: Opportunity Assessment, Customer Segmentation            │   │
│  │ Output: Clarified idea, target customer, problem statement           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Stage 2: IDENTIFY ASSUMPTIONS                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: identify_risky_assumptions, save_assumptions                  │   │
│  │ Frameworks: Leap-of-Faith, Analogs/Antilogs/Leaps                    │   │
│  │ Output: Ranked assumptions, riskiest assumption to test first        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Stage 3: PREPARE INTERVIEWS                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: generate_interview_questions, save_interview_notes            │   │
│  │ Frameworks: The Mom Test (3 Rules), YC 6 Core Questions              │   │
│  │ Output: Interview script, validation signals, commitment tracking    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Stage 4: SCOPE MVP                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: define_mvp_scope, save_mvp_scope                              │   │
│  │ Frameworks: INVEST, Kano Model, MVP Types                            │   │
│  │ Output: Core feature, out-of-scope list, success metric              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  Stage 5: CREATE PLAN                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tools: create_7day_validation_plan, save_validation_plan, log_blocker│   │
│  │ Frameworks: Stage Completion Criteria, Commitment Currencies          │   │
│  │ Output: 7-day plan with daily deliverables, go/no-go decision         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + Vite + Tailwind | User interface |
| Backend | TypeScript + ADK | Agent orchestration |
| AI Model | Gemini 2.0 Flash | Reasoning & tool calling |
| Tools | MCP-style FunctionTools | Domain-specific actions |
| Database | PostgreSQL + Prisma | Data persistence |
| Observability | Custom tracing | Monitoring & debugging |
| Security | Guardrails + Rate limiting | Production safety |
| Deployment | Cloud Run | Serverless hosting |
| Evaluation | Vertex AI Agent Platform | Quality assurance |

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Network                                                │
│  • HTTPS only (Cloud Run enforced)                               │
│  • CORS whitelist                                                │
│  • Security headers (HSTS, CSP, X-Frame-Options)                 │
│                                                                  │
│  Layer 2: Authentication                                         │
│  • API key validation                                            │
│  • Session management                                            │
│  • User ID tracking                                              │
│                                                                  │
│  Layer 3: Authorization                                          │
│  • Rate limiting (100 req/min)                                   │
│  • Token budgeting (4096 tokens/request)                         │
│                                                                  │
│  Layer 4: Input Validation                                       │
│  • Prompt injection detection                                    │
│  • Content filtering                                             │
│  • Length limits                                                 │
│                                                                  │
│  Layer 5: Output Validation                                      │
│  • PII/secret redaction                                          │
│  • Safety checks                                                 │
│  • Response sanitization                                         │
│                                                                  │
│  Layer 6: Secrets Management                                     │
│  • Google Cloud Secret Manager                                   │
│  • Environment variable encryption                               │
│  • No hardcoded credentials                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
