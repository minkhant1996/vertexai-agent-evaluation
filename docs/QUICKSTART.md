# Quick Start Guide

## Getting Started with the Agent Optimizer

### Prerequisites

1. **Google Cloud Project** with Vertex AI enabled
2. **Service Account** with Vertex AI permissions
3. **API Keys**: Gemini API key

### Setup

```bash
# Clone and install
cd Founder-Validate-Agent
npm install

# Install Python dependencies (for Quality Flywheel)
pip install google-cloud-aiplatform[adk,evaluation] google-genai

# Set environment variables
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_API_KEY="your-gemini-api-key"

# Build and run
npm run build
npm start
```

### Access Track 2 Dashboard

Navigate to: `http://localhost:8080/track2`

---

## Basic Workflow

### 1. Select an Agent

Use the dropdown to select which agent to optimize:
- Main Validation Agent
- Research Sub-Agent
- Validation Tool

### 2. Analyze Patterns

Click **"Analyze Patterns"** to detect issues in recent test results.

The system will identify:
- Hallucination patterns
- Instruction following issues
- Tool calling errors
- Response quality problems

### 3. Generate Fixes

For each detected pattern, click **"Generate Fix"** to create an optimized instruction.

### 4. Review Versions

View all generated versions in the **Versions** panel:
- Click **"View"** to see full instruction
- Click **"Apply"** to use a version
- Compare using **"A/B Test"**

### 5. A/B Test

Compare two versions:
1. Click **"Run A/B Test"**
2. Select versions to compare
3. Review results showing pass rates and winner

---

## Optimization Methods

### Built-in (Recommended for Quick Fixes)

```
Method: Built-in (Fast)
Speed: ~5 seconds
Quality: Good
```

Best for:
- Quick iterations
- Simple pattern fixes
- Development/testing

### Google ADK

```
Method: Google ADK
Speed: ~30 seconds
Quality: Better
```

Best for:
- Production-ready fixes
- Complex patterns
- Multi-pattern optimization

### Quality Flywheel (Recommended for Production)

```
Method: Quality Flywheel (Full)
Speed: ~2-5 minutes
Quality: Best
```

Best for:
- Major instruction overhauls
- New agent deployments
- Comprehensive evaluation

---

## Code Examples

### Analyze Patterns (JavaScript)

```javascript
const response = await fetch('/api/optimizer/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testResults: myTestResults,
    useQualityFlywheel: true,
    agentId: 'main_agent'
  })
})

const { patterns, evaluation } = await response.json()
console.log('Found patterns:', patterns.length)
console.log('Task success rate:', evaluation.metrics.task_success_rate)
```

### Generate Fix (JavaScript)

```javascript
const response = await fetch('/api/optimizer/generate-fix', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pattern: patterns[0],
    currentInstruction: currentInstruction
  })
})

const { version } = await response.json()
console.log('New version:', version.version)
console.log('Changes:', version.changes)
```

### Run Quality Flywheel (Python)

```python
from scripts.vertex_evaluation import run_quality_flywheel

result = await run_quality_flywheel(
    agent_instruction="You are a founder validation assistant...",
    scenario_count=10,
    max_turns=5
)

print(f"Optimized instruction length: {len(result['optimized_instruction'])}")
print(f"Loss clusters found: {len(result['steps']['loss_clusters']['clusters'])}")
```

---

## CLI Usage

### Vertex Evaluation Script

```bash
# Full Quality Flywheel
python scripts/vertex_evaluation.py \
  --instruction "Your current instruction here" \
  --scenarios 10 \
  --max-turns 5 \
  --mode full

# Evaluate only
python scripts/vertex_evaluation.py \
  --instruction "Your instruction" \
  --mode evaluate

# Optimize only (with patterns)
python scripts/vertex_evaluation.py \
  --instruction "Your instruction" \
  --patterns '[{"pattern":"hallucination","type":"hallucination"}]' \
  --mode optimize
```

### ADK Optimizer Script

```bash
python scripts/adk_optimizer.py \
  --instruction "Your current instruction" \
  --patterns '[{"pattern":"...", "type":"...", "frequency":5}]' \
  --iterations 3 \
  --batch-size 5
```

---

## Troubleshooting

### "Vertex AI not available"

```bash
pip install google-cloud-aiplatform[adk,evaluation]
gcloud auth application-default login
```

### "Pattern analysis returns empty"

Ensure test results have enough failures:
```javascript
const testResults = [
  { passed: false, error: "Agent hallucinated..." },
  { passed: false, error: "Agent ignored instruction..." }
]
```

### "Version shows as corrupted"

Versions under 500 characters are flagged as corrupted. This prevents applying partial instructions.

### "A/B test takes too long"

Switch to Built-in method for faster (but less accurate) comparisons:
```javascript
{ useQualityFlywheel: false, useADK: false }
```

---

## Best Practices

1. **Start with Built-in** for rapid iteration
2. **Use Quality Flywheel** before deploying to production
3. **Always A/B test** before applying major changes
4. **Keep version history** - don't delete old versions
5. **Monitor metrics** after applying new versions

---

## Next Steps

- Read [OPTIMIZER_SYSTEM.md](./OPTIMIZER_SYSTEM.md) for full architecture
- Read [API_REFERENCE.md](./API_REFERENCE.md) for complete API docs
- Check `/scripts/` for Python integration examples
