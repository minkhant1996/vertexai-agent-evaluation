# Agent Optimizer System Documentation

## Overview

The Agent Optimizer System (Track 2) provides automated evaluation and optimization of AI agent instructions using Google's Quality Flywheel methodology. It analyzes agent performance, identifies failure patterns, and generates improved instructions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  OptimizerDashboard.jsx  │  AgentTemplateEditor.jsx             │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API
┌─────────────────────────────▼───────────────────────────────────┐
│                     Backend (TypeScript)                         │
│  track2-api.ts  │  optimizer.ts  │  storage.ts                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ subprocess
┌─────────────────────────────▼───────────────────────────────────┐
│                    Python Scripts                                │
│  vertex_evaluation.py  │  adk_optimizer.py                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                  Google Cloud Services                           │
│  Vertex AI  │  Gemini API  │  Cloud Storage                     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Backend API (`/src/api/track2-api.ts`)

Handles all Track 2 optimizer API endpoints.

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/optimizer/status` | Get current optimization status |
| POST | `/api/optimizer/analyze` | Analyze patterns in test results |
| POST | `/api/optimizer/generate-fix` | Generate fix for a pattern |
| POST | `/api/optimizer/ab-test` | Run A/B test between versions |
| GET | `/api/optimizer/versions` | Get all instruction versions |
| POST | `/api/optimizer/versions/:id/apply` | Apply a version to agent |
| GET | `/api/agent-templates` | Get all agent templates |
| POST | `/api/agent-templates/:id/reset` | Reset template to default |

#### Key Functions

```typescript
// Analyze patterns with optional Quality Flywheel
POST /api/optimizer/analyze
Body: {
  testResults: TestResult[],
  useQualityFlywheel?: boolean,  // Use full Google workflow
  useADK?: boolean,              // Use Google ADK
  agentId?: string               // Target agent ID
}

// Generate fix for specific pattern
POST /api/optimizer/generate-fix
Body: {
  pattern: FailurePattern,
  currentInstruction: string,
  useQualityFlywheel?: boolean,
  useADK?: boolean
}

// A/B test two versions
POST /api/optimizer/ab-test
Body: {
  versionA: number,
  versionB: number,
  scenarios?: string[]
}
```

### 2. Optimizer Core (`/src/optimizer/optimizer.ts`)

The main optimization engine with multiple methods.

#### Class: `AgentOptimizer`

```typescript
class AgentOptimizer {
  // Analyze test results for failure patterns
  async analyzePatterns(testResults: TestResult[]): Promise<FailurePattern[]>

  // Generate optimized instruction (built-in method)
  async optimizeInstruction(
    currentInstruction: string,
    patterns: FailurePattern[]
  ): Promise<OptimizationResult>

  // Run A/B test between two instructions
  async runABTest(
    instructionA: string,
    instructionB: string,
    scenarios: string[]
  ): Promise<ABTestResult>

  // Full Quality Flywheel workflow
  async runQualityFlywheel(
    currentInstruction: string,
    failurePatterns: FailurePattern[],
    scenarioCount?: number
  ): Promise<OptimizationResult & { evaluation?: any }>

  // Google ADK optimization
  async optimizeWithADK(
    currentInstruction: string,
    failurePatterns: FailurePattern[],
    iterations?: number
  ): Promise<OptimizationResult>
}
```

#### Optimization Methods

| Method | Speed | Quality | Description |
|--------|-------|---------|-------------|
| Built-in | Fast | Good | Pattern matching + Gemini rewrite |
| ADK | Medium | Better | ADK `SimplePromptOptimizer` scaffold (Gemini rewrite today) |
| Quality Flywheel | Slow | Best | Full 5-step Google workflow |

### 3. Python Scripts

#### `vertex_evaluation.py` - Quality Flywheel

Implements Google's complete evaluation workflow:

```python
class VertexAgentEvaluator:
    def generate_eval_scenarios(
        self,
        agent_instruction: str,
        agent_name: str = "validation_agent",
        count: int = 5,
        generation_instruction: str = None
    ) -> dict:
        """
        Step 1: Generate synthetic test scenarios using User Simulation.
        Uses client.evals.generate_conversation_scenarios()
        """

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

    def generate_loss_clusters(
        self,
        eval_result: any,
        metric: str = "MULTI_TURN_TOOL_USE_QUALITY"
    ) -> dict:
        """
        Step 4: Identify failure patterns using Auto-Loss Analysis.
        Groups failures into semantic clusters:
        - Hallucination patterns
        - Instruction following issues
        - Tool calling errors
        - Tool output handling problems
        """

    def optimize_agent(
        self,
        eval_result: any,
        eval_dataset: any,
        targets: list = None
    ) -> dict:
        """
        Step 5: Optimize via LLM-assisted instruction rewriting (GEPA scaffold).
        Programmatically refines system instructions.
        """
```

#### `adk_optimizer.py` - ADK Integration

```python
async def optimize_with_adk(
    current_instruction: str,
    failure_patterns: list,
    eval_scenarios: list = None,
    num_iterations: int = 3,
    batch_size: int = 5
) -> dict:
    """
    Use Google ADK's SimplePromptOptimizer.

    Returns:
        {
            "success": True,
            "optimized_instruction": "...",
            "original_length": 1000,
            "optimized_length": 1200,
            "patterns_addressed": ["pattern1", "pattern2"],
            "method": "adk_gemini_optimizer"
        }
    """
```

### 4. Frontend Components

#### `OptimizerDashboard.jsx`

Main dashboard for the optimization system.

**State Variables:**
```javascript
const [patterns, setPatterns] = useState([])           // Detected failure patterns
const [versions, setVersions] = useState([])           // Instruction versions
const [selectedAgent, setSelectedAgent] = useState('') // Current agent
const [useQualityFlywheel, setUseQualityFlywheel] = useState(false)
const [useADK, setUseADK] = useState(false)
const [abTestResults, setAbTestResults] = useState(null)
```

**Key Functions:**
```javascript
// Analyze patterns in test results
const analyzePatterns = async () => {
  const response = await fetch(`${BACKEND_URL}/api/optimizer/analyze`, {
    method: 'POST',
    body: JSON.stringify({
      testResults,
      useQualityFlywheel,
      useADK,
      agentId: selectedAgent
    })
  })
}

// Generate fix for a pattern
const generateFix = async (pattern) => {
  const response = await fetch(`${BACKEND_URL}/api/optimizer/generate-fix`, {
    method: 'POST',
    body: JSON.stringify({
      pattern,
      currentInstruction,
      useQualityFlywheel,
      useADK
    })
  })
}

// Run A/B test
const runABTest = async (versionA, versionB) => {
  const response = await fetch(`${BACKEND_URL}/api/optimizer/ab-test`, {
    method: 'POST',
    body: JSON.stringify({ versionA, versionB })
  })
}

// Apply version to agent
const applyVersion = async (versionId) => {
  await fetch(`${BACKEND_URL}/api/optimizer/versions/${versionId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ agentId: selectedAgent })
  })
}
```

#### `AgentTemplateEditor.jsx`

Editor for agent system prompts/templates.

**Features:**
- Edit agent instructions directly
- Preview changes before saving
- Reset individual agents to defaults
- View optimization history

## Data Models

### FailurePattern

```typescript
interface FailurePattern {
  id: string
  pattern: string           // Pattern name
  type: string              // 'hallucination' | 'instruction_following' | 'tool_calling' | 'tool_output'
  description: string       // Human-readable description
  frequency: number         // How often this occurs
  severity: 'low' | 'medium' | 'high' | 'critical'
  examples: string[]        // Example failures
  suggestedFix?: string     // AI-generated fix suggestion
}
```

### InstructionVersion

```typescript
interface InstructionVersion {
  id: string
  version: number
  instruction: string
  timestamp: string
  changes: InstructionChange[]
  source: 'manual' | 'optimization' | 'ab_test'
  metrics?: {
    passRate?: number
    taskSuccess?: number
    toolUseQuality?: number
  }
}
```

### OptimizationResult

```typescript
interface OptimizationResult {
  success: boolean
  optimizedInstruction: string
  changes: InstructionChange[]
  method: 'built_in' | 'adk' | 'quality_flywheel'
  evaluation?: {
    metrics: {
      task_success_rate: number
      tool_use_quality: number
      trajectory_quality: number
    }
    loss_clusters: LossCluster[]
  }
}
```

### ABTestResult

```typescript
interface ABTestResult {
  versionA: {
    version: number
    passRate: number
    metrics: object
  }
  versionB: {
    version: number
    passRate: number
    metrics: object
  }
  winner: 'A' | 'B' | 'tie'
  confidence: number
  scenarios: ScenarioResult[]
}
```

## Quality Flywheel Workflow

The Quality Flywheel is Google's recommended approach for continuous agent improvement:

```
┌──────────────────────────────────────────────────────────────┐
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
│  │   (LLM)     │    │  Failures   │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                                                    │
│         └────────────────────────────────────────────────────┤
│                        Continuous Loop                       │
└──────────────────────────────────────────────────────────────┘
```

### Step 1: Generate Eval Scenarios
- Uses User Simulation to create realistic test cases
- Based on agent instruction and capabilities
- Configurable scenario count

### Step 2: Run Inference
- Executes agent against each scenario
- Captures full conversation traces
- Simulates user responses

### Step 3: Compute Metrics
- **MULTI_TURN_TASK_SUCCESS**: Did agent complete the task?
- **MULTI_TURN_TOOL_USE_QUALITY**: Were tools used correctly?
- **MULTI_TURN_TRAJECTORY_QUALITY**: Was the conversation path optimal?

### Step 4: Loss Cluster Analysis
Groups failures by category:
- **Hallucination**: Agent made up information
- **Instruction Following**: Agent ignored instructions
- **Tool Calling**: Wrong tool or parameters
- **Tool Output Handling**: Misinterpreted tool results

### Step 5: Instruction Optimization
- LLM-assisted instruction rewriting (GEPA scaffold; Gemini rewrite today)
- Iteratively refines instructions
- Addresses specific failure patterns

## Configuration

### Environment Variables

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Vertex AI
VERTEX_AI_LOCATION=us-central1

# API Keys
GOOGLE_API_KEY=your-gemini-api-key
```

### Dependencies

**Python (for Vertex AI scripts):**
```bash
pip install google-cloud-aiplatform[adk,evaluation]
pip install google-genai
```

**TypeScript:**
```bash
npm install @google/generative-ai
```

## Usage Examples

### Analyze and Optimize (Built-in)

```javascript
// 1. Get test results
const testResults = await fetch('/api/test-results').then(r => r.json())

// 2. Analyze patterns
const patterns = await fetch('/api/optimizer/analyze', {
  method: 'POST',
  body: JSON.stringify({ testResults })
}).then(r => r.json())

// 3. Generate fix for each pattern
for (const pattern of patterns) {
  const fix = await fetch('/api/optimizer/generate-fix', {
    method: 'POST',
    body: JSON.stringify({ pattern, currentInstruction })
  }).then(r => r.json())
}
```

### Full Quality Flywheel

```javascript
const result = await fetch('/api/optimizer/analyze', {
  method: 'POST',
  body: JSON.stringify({
    testResults,
    useQualityFlywheel: true,  // Enable full workflow
    agentId: 'main_agent'
  })
}).then(r => r.json())

// Result includes:
// - patterns: detected failure patterns
// - evaluation: { metrics, loss_clusters }
// - optimizedInstruction: LLM-optimized instruction
```

### A/B Testing

```javascript
// Compare version 2 vs version 4
const result = await fetch('/api/optimizer/ab-test', {
  method: 'POST',
  body: JSON.stringify({
    versionA: 2,
    versionB: 4
  })
}).then(r => r.json())

// Apply winner
if (result.winner === 'A') {
  await fetch('/api/optimizer/versions/2/apply', { method: 'POST' })
}
```

## Error Handling

### Corruption Protection

The system prevents applying corrupted versions:

```typescript
const MIN_INSTRUCTION_LENGTH = 500

if (version.instruction.length < MIN_INSTRUCTION_LENGTH) {
  return {
    status: 400,
    data: {
      error: 'This version appears corrupted (instruction too short)',
      corrupted: true
    }
  }
}
```

### Fallback Behavior

If Vertex AI is unavailable, the system falls back to built-in optimization:

```python
if not VERTEX_AVAILABLE:
    return {"error": IMPORT_ERROR, "fallback": True}
```

## Troubleshooting

### Common Issues

1. **"google-adk not available"**
   - Install: `pip install google-cloud-aiplatform[adk,evaluation]`

2. **"Authentication failed"**
   - Set `GOOGLE_APPLICATION_CREDENTIALS`
   - Run `gcloud auth application-default login`

3. **"Version skipped numbers"**
   - Fixed: Now uses `Math.max()` across existing versions

4. **"Applied version replaced entire instruction"**
   - Fixed: `applyPatternFix()` now returns full instruction

## File Structure

```
/src
  /api
    track2-api.ts        # API endpoints
  /optimizer
    optimizer.ts         # Core optimization logic
  /storage
    storage.ts           # Persistence layer

/scripts
  vertex_evaluation.py   # Quality Flywheel implementation
  adk_optimizer.py       # ADK integration

/frontend/src/components/track2
  OptimizerDashboard.jsx # Main dashboard
  AgentTemplateEditor.jsx # Template editor

/docs
  OPTIMIZER_SYSTEM.md    # This documentation
```
