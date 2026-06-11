# API Reference

## Track 2 - Agent Optimizer API

Base URL: `https://founder-validation-agent-356663565224.us-central1.run.app`

All endpoints require authentication via session cookie.

---

## Optimizer Endpoints

### GET /api/optimizer/status

Get current optimization status and statistics.

**Response:**
```json
{
  "status": "idle" | "analyzing" | "optimizing",
  "lastRun": "2024-01-15T10:30:00Z",
  "versionsCount": 5,
  "patternsDetected": 3
}
```

---

### POST /api/optimizer/analyze

Analyze test results to detect failure patterns.

**Request Body:**
```json
{
  "testResults": [
    {
      "id": "test-001",
      "scenario": "User asks about pricing",
      "passed": false,
      "error": "Agent hallucinated competitor pricing",
      "agentResponse": "..."
    }
  ],
  "useQualityFlywheel": false,
  "useADK": false,
  "agentId": "main_agent"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| testResults | array | Yes | Array of test result objects |
| useQualityFlywheel | boolean | No | Use full Google Quality Flywheel |
| useADK | boolean | No | Use Google ADK optimizer |
| agentId | string | No | Target agent ID |

**Response:**
```json
{
  "patterns": [
    {
      "id": "pattern-001",
      "pattern": "Hallucination in pricing responses",
      "type": "hallucination",
      "description": "Agent invents pricing information",
      "frequency": 5,
      "severity": "high",
      "examples": ["Example 1", "Example 2"]
    }
  ],
  "evaluation": {
    "metrics": {
      "task_success_rate": 0.75,
      "tool_use_quality": 0.82,
      "trajectory_quality": 0.68
    },
    "loss_clusters": [
      {
        "category": "Hallucination",
        "pattern": "Made up pricing data",
        "count": 5,
        "description": "Agent generated fictional pricing"
      }
    ]
  }
}
```

---

### POST /api/optimizer/generate-fix

Generate an optimized instruction fix for a specific pattern.

**Request Body:**
```json
{
  "pattern": {
    "id": "pattern-001",
    "pattern": "Hallucination in pricing",
    "type": "hallucination",
    "frequency": 5,
    "examples": ["..."]
  },
  "currentInstruction": "You are a helpful assistant...",
  "useQualityFlywheel": false,
  "useADK": false
}
```

**Response:**
```json
{
  "success": true,
  "version": {
    "id": "v-003",
    "version": 3,
    "instruction": "You are a helpful assistant... [OPTIMIZED]",
    "timestamp": "2024-01-15T10:35:00Z",
    "changes": [
      {
        "type": "addition",
        "section": "Pricing Guidelines",
        "original": "",
        "updated": "Never invent pricing. Always say 'I don't have current pricing'."
      }
    ],
    "source": "optimization"
  },
  "method": "built_in" | "adk" | "quality_flywheel"
}
```

---

### POST /api/optimizer/ab-test

Run A/B test comparing two instruction versions.

**Request Body:**
```json
{
  "versionA": 2,
  "versionB": 4,
  "scenarios": ["scenario1", "scenario2"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| versionA | number | Yes | First version number |
| versionB | number | Yes | Second version number |
| scenarios | array | No | Custom test scenarios |

**Response:**
```json
{
  "versionA": {
    "version": 2,
    "passRate": 0.72,
    "metrics": {
      "task_success": 0.70,
      "tool_quality": 0.75
    }
  },
  "versionB": {
    "version": 4,
    "passRate": 0.85,
    "metrics": {
      "task_success": 0.88,
      "tool_quality": 0.82
    }
  },
  "winner": "B",
  "confidence": 0.92,
  "scenarios": [
    {
      "name": "Pricing inquiry",
      "versionA_passed": false,
      "versionB_passed": true
    }
  ]
}
```

---

### GET /api/optimizer/versions

Get all instruction versions.

**Response:**
```json
{
  "versions": [
    {
      "id": "v-001",
      "version": 1,
      "instruction": "You are a helpful assistant...",
      "timestamp": "2024-01-10T08:00:00Z",
      "source": "manual",
      "changes": [],
      "metrics": {
        "passRate": 0.65
      }
    },
    {
      "id": "v-002",
      "version": 2,
      "instruction": "You are a helpful assistant... [v2]",
      "timestamp": "2024-01-12T14:30:00Z",
      "source": "optimization",
      "changes": [
        {
          "type": "modification",
          "section": "Error Handling",
          "original": "...",
          "updated": "..."
        }
      ]
    }
  ],
  "currentVersion": 2
}
```

---

### POST /api/optimizer/versions/:id/apply

Apply a specific version to an agent.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Version ID to apply |

**Request Body:**
```json
{
  "agentId": "main_agent"
}
```

**Response (Success):**
```json
{
  "success": true,
  "appliedVersion": 2,
  "agentId": "main_agent",
  "previousVersion": 1
}
```

**Response (Corrupted Version):**
```json
{
  "error": "This version appears corrupted (instruction too short)",
  "corrupted": true
}
```

---

## Agent Template Endpoints

### GET /api/agent-templates

Get all agent templates/prompts.

**Response:**
```json
{
  "templates": [
    {
      "id": "main_agent",
      "name": "Main Validation Agent",
      "instruction": "You are a founder validation assistant...",
      "lastModified": "2024-01-15T10:00:00Z",
      "version": 2
    },
    {
      "id": "research_agent",
      "name": "Research Sub-Agent",
      "instruction": "You are a research specialist...",
      "lastModified": "2024-01-14T08:00:00Z",
      "version": 1
    }
  ]
}
```

---

### GET /api/agent-templates/:id

Get a specific agent template.

**Response:**
```json
{
  "id": "main_agent",
  "name": "Main Validation Agent",
  "instruction": "You are a founder validation assistant...",
  "lastModified": "2024-01-15T10:00:00Z",
  "version": 2,
  "history": [
    {
      "version": 1,
      "timestamp": "2024-01-10T08:00:00Z",
      "source": "manual"
    },
    {
      "version": 2,
      "timestamp": "2024-01-15T10:00:00Z",
      "source": "optimization"
    }
  ]
}
```

---

### PUT /api/agent-templates/:id

Update an agent template.

**Request Body:**
```json
{
  "instruction": "Updated instruction...",
  "source": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "id": "main_agent",
  "newVersion": 3
}
```

---

### POST /api/agent-templates/:id/reset

Reset an agent template to its default.

**Response:**
```json
{
  "success": true,
  "id": "main_agent",
  "resetTo": "default",
  "newVersion": 4
}
```

---

## Error Responses

All endpoints may return these error formats:

**400 Bad Request:**
```json
{
  "error": "Missing required field: testResults",
  "field": "testResults"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**404 Not Found:**
```json
{
  "error": "Version not found",
  "versionId": "v-999"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Optimization failed",
  "details": "Vertex AI connection timeout"
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/optimizer/analyze | 10/min |
| /api/optimizer/generate-fix | 20/min |
| /api/optimizer/ab-test | 5/min |
| Other endpoints | 60/min |

---

## Optimization Methods

### Built-in (Default)
- Fast pattern matching
- Gemini-based rewriting
- No external dependencies

### Google ADK
```json
{ "useADK": true }
```
- Uses `google-cloud-aiplatform[adk]`
- LLM-assisted instruction rewriting (ADK `SimplePromptOptimizer` scaffold; Gemini today)
- Better quality, slower

### Quality Flywheel
```json
{ "useQualityFlywheel": true }
```
- Full 5-step Google workflow
- Scenario generation
- Multi-turn AutoRaters
- Loss cluster analysis
- LLM-assisted instruction optimization
- Highest quality, slowest

---

## Webhook Events (Future)

```json
{
  "event": "optimization.completed",
  "data": {
    "versionId": "v-003",
    "method": "quality_flywheel",
    "improvements": ["Added pricing guidelines", "Enhanced error handling"]
  }
}
```
