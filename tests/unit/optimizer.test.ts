/**
 * Unit Tests for Agent Optimizer
 *
 * Tests the core optimization functions:
 * - Pattern analysis
 * - Instruction optimization
 * - A/B test evaluation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock classes
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    candidates: [{
      content: {
        parts: [{ text: '{"score": 0.85, "reason": "Good response"}' }]
      }
    }]
  }
});

const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent
});

// Mock the module before importing
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: class {
    constructor() {}
    getGenerativeModel = mockGetGenerativeModel;
  }
}));

// Import after mocking
const { AgentOptimizer } = await import('../../src/optimizer/optimizer.js');

describe('AgentOptimizer', () => {
  let optimizer: InstanceType<typeof AgentOptimizer>;

  beforeEach(() => {
    vi.clearAllMocks();
    optimizer = new AgentOptimizer('test-project', 'us-central1');
  });

  describe('analyzeFailures', () => {
    it('should return empty array for all passing results', async () => {
      const results = [
        { scenarioId: 'EC001', passed: true, score: 1.0 },
        { scenarioId: 'EC002', passed: true, score: 1.0 },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns).toEqual([]);
    });

    it('should detect failure patterns from failed results', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          scenarioName: 'Validation Seeker',
          passed: false,
          failureReasons: ['Missing required term "customer"'],
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('pattern');
      expect(patterns[0]).toHaveProperty('frequency');
    });

    it('should include low-scoring passed results', async () => {
      const results = [
        { scenarioId: 'EC001', passed: true, score: 0.7 },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should categorize missing problem focus correctly', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          passed: false,
          failureReasons: ['Missing required term "problem"'],
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      const problemPattern = patterns.find((p: any) => p.pattern === 'missing_problem_focus');
      expect(problemPattern).toBeDefined();
    });

    it('should categorize inappropriate validation correctly', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          passed: false,
          failureReasons: ['Contains forbidden term "sounds great"'],
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      const validationPattern = patterns.find((p: any) => p.pattern === 'inappropriate_validation');
      expect(validationPattern).toBeDefined();
    });
  });

  describe('optimizeInstruction', () => {
    const sampleInstruction = `
## CONVERSATION GUIDELINES
You are a validation assistant.

## Red flags to address immediately
Watch for premature validation.

## Customer Segmentation
Help founders identify their target customers.

## Tone
Be professional and helpful.
`;

    it('should return optimized instruction with changes', async () => {
      const patterns = [
        {
          pattern: 'missing_problem_focus',
          type: 'feature_obsessed',
          frequency: 5,
          examples: ['Example 1'],
          suggestedFix: 'Add problem-first rule',
        },
      ];

      const result = await optimizer.optimizeInstruction(sampleInstruction, patterns);

      expect(result.originalInstruction).toBe(sampleInstruction);
      expect(result.optimizedInstruction.length).toBeGreaterThan(sampleInstruction.length);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.patternsAddressed).toContain('missing_problem_focus');
    });

    it('should apply multiple pattern fixes', async () => {
      const patterns = [
        {
          pattern: 'missing_problem_focus',
          type: 'feature_obsessed',
          frequency: 5,
          examples: [],
          suggestedFix: '',
        },
        {
          pattern: 'inappropriate_validation',
          type: 'validation_seeker',
          frequency: 3,
          examples: [],
          suggestedFix: '',
        },
      ];

      const result = await optimizer.optimizeInstruction(sampleInstruction, patterns);

      expect(result.changes.length).toBe(2);
      expect(result.patternsAddressed).toHaveLength(2);
    });

    it('should not modify instruction with no patterns', async () => {
      const result = await optimizer.optimizeInstruction(sampleInstruction, []);

      expect(result.optimizedInstruction).toBe(sampleInstruction);
      expect(result.changes).toHaveLength(0);
    });
  });
});

describe('Interface Structures', () => {
  it('ABTestResult should have correct structure', () => {
    const result = {
      instructionA: { version: 1, passRate: 0.7, avgLatency: 1000 },
      instructionB: { version: 2, passRate: 0.85, avgLatency: 1200 },
      winner: 'B' as const,
      improvement: 15,
      scenarios: [
        {
          id: 'EC001',
          name: 'Test Scenario',
          scoreA: 0.7,
          scoreB: 0.85,
          responseA: 'Response A',
          responseB: 'Response B',
          winner: 'B' as const,
        },
      ],
    };

    expect(result.winner).toBe('B');
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].scoreB).toBeGreaterThan(result.scenarios[0].scoreA);
  });

  it('FailurePattern should have correct structure', () => {
    const pattern = {
      pattern: 'missing_problem_focus',
      type: 'feature_obsessed',
      frequency: 5,
      examples: ['Example 1', 'Example 2'],
      suggestedFix: 'Add problem-first instruction',
    };

    expect(pattern.pattern).toBe('missing_problem_focus');
    expect(pattern.examples).toHaveLength(2);
  });
});
