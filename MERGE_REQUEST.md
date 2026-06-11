# Merge Request: Quality Flywheel & A/B Testing Integration

## Related Issue
**Issue #XX**: Implement Google Quality Flywheel for Agent Optimization

## Summary
Integrates Google's official Quality Flywheel methodology for agent evaluation and optimization. Adds real A/B testing with Gemini-based evaluation, side-by-side comparison UI, and comprehensive documentation.

---

## What Has Been Done

### 1. Quality Flywheel Integration
Implemented Google's 5-step agent optimization workflow:

| Step | Implementation | File |
|------|----------------|------|
| Generate Scenarios | User Simulation via Vertex AI | `scripts/vertex_evaluation.py` |
| Run Inference | Agent execution with traces | `scripts/vertex_evaluation.py` |
| Compute Metrics | Multi-turn AutoRaters | `scripts/vertex_evaluation.py` |
| Loss Clusters | Auto-Loss Analysis | `scripts/vertex_evaluation.py` |
| Optimize (GEPA) | Genetic Evolution Prompt Algorithm | `scripts/vertex_evaluation.py` |

### 2. Real A/B Testing
Replaced mock A/B testing with actual Gemini-based evaluation:

| Before | After |
|--------|-------|
| Instant results (fake) | 20-30 second real evaluation |
| Random pass rates | Actual scenario testing |
| No comparison data | Side-by-side response comparison |

### 3. UI Improvements
- Optimizer method selector (Built-in / ADK / Quality Flywheel)
- Side-by-side A/B test results with per-scenario breakdown
- Version details popup modal
- A/B test version selector modal
- Agent selector dropdown

### 4. Documentation
Created comprehensive documentation in `/docs/`:
- `README.md` - Index
- `QUICKSTART.md` - Getting started
- `OPTIMIZER_SYSTEM.md` - Full architecture
- `API_REFERENCE.md` - API endpoints

---

## New Features Integration

### Feature 1: Quality Flywheel Method
**Location:** `src/optimizer/optimizer.ts:375-450`

```typescript
async runQualityFlywheel(
  currentInstruction: string,
  failurePatterns: FailurePattern[],
  scenarioCount: number = 5
): Promise<OptimizationResult & { evaluation?: any }>
```

**Logic:**
1. Calls Python script `scripts/vertex_evaluation.py`
2. Script generates eval scenarios using Vertex AI
3. Runs inference with user simulation
4. Computes metrics (MULTI_TURN_TASK_SUCCESS, etc.)
5. Generates loss clusters for failure analysis
6. Applies GEPA optimization
7. Returns optimized instruction + evaluation data

**Input:**
- `currentInstruction`: Current agent system prompt (string)
- `failurePatterns`: Array of detected failure patterns
- `scenarioCount`: Number of scenarios to generate (default: 5)

**Output:**
```typescript
{
  originalInstruction: string,
  optimizedInstruction: string,
  changes: InstructionChange[],
  patternsAddressed: string[],
  expectedImprovementPercent: number,
  evaluation: {
    metrics: { task_success_rate, tool_use_quality, trajectory_quality },
    lossClusters: LossCluster[],
    scenariosGenerated: number
  }
}
```

**Things to Consider:**
- Requires Python 3.10+ with `google-cloud-aiplatform[adk,evaluation]`
- Takes 2-5 minutes to complete
- Falls back to ADK optimizer if Vertex AI fails
- Subprocess timeout: 5 minutes

---

### Feature 2: Real A/B Testing
**Location:** `src/optimizer/optimizer.ts:565-650`

```typescript
async runABTest(
  instructionA: string,
  instructionB: string,
  scenarios: EdgeCaseScenario[],
  agentEndpoint?: string
): Promise<ABTestResult>
```

**Logic:**
1. For each test scenario (5 scenarios):
   a. Generate simulated response using Instruction A via Gemini
   b. Evaluate response against pass criteria → Score A
   c. Generate simulated response using Instruction B via Gemini
   d. Evaluate response against pass criteria → Score B
   e. Record per-scenario results
2. Calculate average scores
3. Determine winner (min 5% difference required)
4. Return detailed comparison

**Input:**
- `instructionA`: First instruction version to test
- `instructionB`: Second instruction version to test
- `scenarios`: Array of edge case scenarios to test against

**Output:**
```typescript
{
  instructionA: { version, passRate, avgLatency },
  instructionB: { version, passRate, avgLatency },
  winner: 'A' | 'B' | 'tie',
  improvement: number,
  scenarios: [
    {
      id: string,
      name: string,
      scoreA: number,
      scoreB: number,
      responseA: string,  // First 300 chars
      responseB: string,  // First 300 chars
      winner: 'A' | 'B' | 'tie'
    }
  ]
}
```

**Things to Consider:**
- Makes 2 Gemini API calls per scenario (generate + evaluate)
- 5 scenarios × 2 versions × 2 calls = 20 API calls
- Takes ~20-30 seconds total
- Scores are 0.0-1.0 based on pass criteria matching
- Response preview truncated to 300 chars

---

### Feature 3: Scenario-Level Evaluation
**Location:** `src/optimizer/optimizer.ts:656-760`

```typescript
private async evaluateInstructionOnScenarioDetailed(
  model: any,
  instruction: string,
  scenario: EdgeCaseScenario
): Promise<{ score: number; response: string }>
```

**Logic:**
1. **Generate Response:**
   - Prompt Gemini with the instruction as system prompt
   - Include scenario's `initialPrompt` as user message
   - Get simulated agent response

2. **Evaluate Response:**
   - Check against `passCriteria.mustContain`
   - Check against `passCriteria.mustNotContain`
   - Evaluate skepticism and probing questions
   - Return score 0.0-1.0

**Input:**
- `model`: Vertex AI Gemini model instance
- `instruction`: Agent system instruction to test
- `scenario`: Edge case scenario with criteria

**Output:**
```typescript
{
  score: number,    // 0.0 to 1.0
  response: string  // Generated agent response
}
```

**Things to Consider:**
- Temperature 0.3 for response generation (some variability)
- Temperature 0.1 for evaluation (consistency)
- Default score 0.5 if parsing fails
- Instruction truncated to 3000 chars to fit context

---

## Test Cases

### Unit Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `test_ab_test_different_instructions` | A/B test with clearly different instructions | Different scores, clear winner |
| `test_ab_test_same_instruction` | A/B test with identical instructions | Tie result, similar scores |
| `test_ab_test_empty_instruction` | A/B test with empty instruction | Low scores, error handling |
| `test_flywheel_valid_instruction` | Quality Flywheel with valid instruction | Returns optimized instruction |
| `test_flywheel_fallback` | Quality Flywheel when Python fails | Falls back to ADK |
| `test_scenario_evaluation` | Single scenario evaluation | Score between 0-1 |

### Integration Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `test_api_ab_test_endpoint` | POST /api/optimizer/ab-test | Returns comparison with scenarios |
| `test_api_generate_fix_flywheel` | POST /api/optimizer/generate-fix with flywheel | Returns optimized version |
| `test_api_apply_version` | POST /api/optimizer/versions/:id/apply | Updates agent template |
| `test_frontend_ab_test_ui` | Run A/B test via UI | Shows side-by-side results |

### Edge Case Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `test_corrupted_version` | Apply version with <500 chars | Rejected with error |
| `test_missing_version` | A/B test with non-existent version | 404 error |
| `test_timeout_handling` | Python script timeout | Graceful fallback |
| `test_api_rate_limit` | Many concurrent A/B tests | Queue or rate limit |

### Manual Test Scenarios

```bash
# Test 1: Run A/B test from UI
1. Go to /track2
2. Click "Run A/B Test"
3. Select Version 1 and Version 2
4. Click "Run A/B Test"
5. Verify: Shows loading for 20-30 seconds
6. Verify: Shows side-by-side comparison
7. Verify: Each scenario shows scores and response previews

# Test 2: Quality Flywheel optimization
1. Go to /track2
2. Select "Quality Flywheel (Full)" from method dropdown
3. Click "Generate Fix" on any pattern
4. Verify: Shows loading for 2-5 minutes
5. Verify: New version created with evaluation data

# Test 3: Version corruption protection
1. Create a version with short instruction
2. Try to apply it
3. Verify: Error message about corruption
```

---

## Code Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `scripts/vertex_evaluation.py` | Quality Flywheel implementation |
| `scripts/adk_optimizer.py` | Google ADK optimizer |
| `docs/README.md` | Documentation index |
| `docs/QUICKSTART.md` | Getting started guide |
| `docs/OPTIMIZER_SYSTEM.md` | Architecture documentation |
| `docs/API_REFERENCE.md` | API endpoint reference |

### Modified Files
| File | Changes |
|------|---------|
| `src/optimizer/optimizer.ts` | Added `runQualityFlywheel()`, fixed `runABTest()`, added `evaluateInstructionOnScenarioDetailed()` |
| `src/api/track2-api.ts` | Added flywheel support, scenario details in AB test response |
| `frontend/src/components/track2/OptimizerDashboard.jsx` | Side-by-side UI, method selector, version modals |
| `.gitignore` | Added storage, credentials, build outputs |
| `README.md` | Updated with new features |

---

## AI Code Explanation

### How A/B Test Evaluation Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    A/B TEST FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT: instructionA, instructionB, scenarios[]                 │
│                                                                 │
│  FOR each scenario in scenarios:                                │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 1: Generate Response A                             │  │
│    │                                                         │  │
│    │ Prompt to Gemini:                                       │  │
│    │ "You are an AI agent with this instruction:             │  │
│    │  {instructionA}                                         │  │
│    │  A founder says: {scenario.initialPrompt}               │  │
│    │  How would you respond?"                                │  │
│    │                                                         │  │
│    │ → responseA = Gemini output                             │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 2: Evaluate Response A                             │  │
│    │                                                         │  │
│    │ Prompt to Gemini:                                       │  │
│    │ "Evaluate this response for scenario: {scenario.name}   │  │
│    │  Expected: {scenario.expectedAgentBehavior}             │  │
│    │  Pass criteria: {scenario.passCriteria}                 │  │
│    │  Response: {responseA}                                  │  │
│    │  Score 0.0-1.0 as JSON"                                 │  │
│    │                                                         │  │
│    │ → scoreA = parsed score (0.0-1.0)                       │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ STEP 3-4: Repeat for Instruction B                      │  │
│    │ → responseB, scoreB                                     │  │
│    └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│    scenarioResults.push({                                       │
│      name: scenario.name,                                       │
│      scoreA, scoreB,                                            │
│      responseA, responseB,                                      │
│      winner: scoreA > scoreB ? 'A' : 'B'                        │
│    })                                                           │
│                                                                 │
│  END FOR                                                        │
│                                                                 │
│  OUTPUT: {                                                      │
│    instructionA: { passRate: avg(scoresA) },                    │
│    instructionB: { passRate: avg(scoresB) },                    │
│    winner: avgB - avgA >= 0.05 ? 'B' : 'A',                     │
│    scenarios: scenarioResults[]                                 │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Pass Criteria Evaluation Logic

```typescript
// Example scenario pass criteria
passCriteria: {
  mustContain: ['customer', 'problem'],      // Response MUST include these
  mustNotContain: ['sounds great', 'love it'], // Response must NOT include these
  toolsMustCall: ['clarify_idea'],            // Tools that should be called
  toolsMustNotCall: ['define_mvp_scope']      // Tools that should NOT be called
}

// Scoring logic (simplified)
let score = 1.0;

// Check mustContain
for (const term of passCriteria.mustContain) {
  if (!response.toLowerCase().includes(term.toLowerCase())) {
    score -= 0.2;  // Penalty for missing required term
  }
}

// Check mustNotContain
for (const term of passCriteria.mustNotContain) {
  if (response.toLowerCase().includes(term.toLowerCase())) {
    score -= 0.3;  // Higher penalty for forbidden terms
  }
}

// Bonus for probing questions
if (response.includes('?')) {
  score += 0.1;  // Reward for asking questions
}

return Math.max(0, Math.min(1, score));
```

---

## Things to Consider

### Performance
- A/B test takes 20-30 seconds (5 scenarios × 4 API calls)
- Quality Flywheel takes 2-5 minutes
- Consider adding progress indicators for long operations

### Error Handling
- Python script failures fall back to TypeScript ADK
- API rate limits may affect parallel testing
- Timeout set to 5 minutes for Quality Flywheel

### Security
- Instruction content is escaped before shell execution
- Python subprocess uses explicit paths
- No user input directly executed

### Limitations
- Response comparison truncated to 300 chars
- Maximum 5 scenarios per A/B test
- Instruction truncated to 3000 chars for evaluation
- Quality Flywheel requires Python environment

### Future Improvements
- [ ] Add progress streaming for long operations
- [ ] Support more than 2 versions in comparison
- [ ] Save A/B test history for trend analysis
- [ ] Add statistical significance calculation
- [ ] Integrate with CI/CD for automated testing

---

## Deployment Checklist

- [x] TypeScript builds without errors
- [x] Frontend builds without errors
- [x] Python scripts included in Docker image
- [x] Environment variables documented
- [x] Cloud Run deployment tested
- [x] Documentation updated
- [x] .gitignore updated

---

## Screenshots

### A/B Test Results (Side-by-Side)
```
┌─────────────────────────────────────────────────────────────┐
│  A/B Test Results                                           │
│  Tested 5 scenarios using Gemini evaluation                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ Version 1    │   VS    │ Version 2    │                  │
│  │    72%       │         │    85%       │ ← Winner         │
│  └──────────────┘         └──────────────┘                  │
│                                                             │
│  Scenario: Validation Seeker                                │
│  ┌─────────────────────┬─────────────────────┐              │
│  │ V1: 65%             │ V2: 80%  ✓          │              │
│  │ "That's interesting │ "Before we proceed, │              │
│  │  let me help you... │  what evidence..."  │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                             │
│  Scenario: Feature Obsessed                                 │
│  ┌─────────────────────┬─────────────────────┐              │
│  │ V1: 70%             │ V2: 90%  ✓          │              │
│  │ "Those features..." │ "What problem does  │              │
│  │                     │  this solve for..." │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                             │
│  [Apply Winner (Version 2)]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Reviewers
- @backend-reviewer - API and optimizer logic
- @frontend-reviewer - UI components
- @devops-reviewer - Deployment and Docker
