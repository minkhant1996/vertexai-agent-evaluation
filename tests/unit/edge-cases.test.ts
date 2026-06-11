/**
 * Edge Case Tests for Optimizer
 *
 * Tests error handling, boundary conditions, and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock before importing
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: class {
    constructor() {}
    getGenerativeModel = () => ({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{ text: 'Generated fix suggestion' }]
            }
          }]
        }
      })
    });
  }
}));

const { AgentOptimizer } = await import('../../src/optimizer/optimizer.js');

describe('Edge Cases', () => {
  let optimizer: InstanceType<typeof AgentOptimizer>;

  beforeEach(() => {
    optimizer = new AgentOptimizer('test-project', 'us-central1');
  });

  describe('Empty Input Handling', () => {
    it('should handle empty instruction gracefully', async () => {
      const patterns = [
        { pattern: 'unknown_pattern', type: 'test', frequency: 1, examples: [], suggestedFix: '' },
      ];

      const result = await optimizer.optimizeInstruction('', patterns);

      // Unknown patterns don't have fixes, so no changes
      expect(result.originalInstruction).toBe('');
    });

    it('should handle empty patterns array', async () => {
      const result = await optimizer.optimizeInstruction('Test instruction', []);

      expect(result.changes).toHaveLength(0);
      expect(result.optimizedInstruction).toBe('Test instruction');
    });

    it('should handle empty failure results', async () => {
      const patterns = await optimizer.analyzeFailures([]);

      expect(patterns).toEqual([]);
    });
  });

  describe('Long Input Handling', () => {
    it('should handle very long instructions', async () => {
      const longInstruction = '## CONVERSATION GUIDELINES\n' + 'A'.repeat(10000);
      const patterns = [
        { pattern: 'missing_problem_focus', type: 'test', frequency: 1, examples: [], suggestedFix: '' },
      ];

      const result = await optimizer.optimizeInstruction(longInstruction, patterns);

      expect(result.optimizedInstruction.length).toBeGreaterThan(10000);
    });
  });

  describe('Special Character Handling', () => {
    it('should handle instructions with special characters', async () => {
      const specialInstruction = `
## Test "Section"
Use 'quotes' and <tags> and {braces}
Also handle: $special & characters % @
Unicode: 日本語 中文 한국어
      `;

      const result = await optimizer.optimizeInstruction(specialInstruction, []);

      expect(result.originalInstruction).toBe(specialInstruction);
    });
  });

  describe('Score Boundary Conditions', () => {
    it('should handle perfect scores', async () => {
      const results = [
        { scenarioId: 'EC001', passed: true, score: 1.0 },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns).toHaveLength(0);
    });

    it('should handle zero scores', async () => {
      const results = [
        { scenarioId: 'EC001', passed: false, score: 0.0, failureReasons: ['Total failure'] },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle scores just below threshold', async () => {
      const results = [
        { scenarioId: 'EC001', passed: true, score: 0.99 },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Type Classification', () => {
    it('should classify "room for improvement" patterns', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          passed: true,
          score: 0.95,
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      const nearPerfect = patterns.find((p: any) => p.pattern === 'near_perfect');
      expect(nearPerfect).toBeDefined();
    });

    it('should classify good but improvable patterns', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          passed: true,
          score: 0.85,
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      const goodPattern = patterns.find((p: any) => p.pattern === 'good_but_improvable');
      expect(goodPattern).toBeDefined();
    });

    it('should classify needs improvement patterns', async () => {
      const results = [
        {
          scenarioId: 'EC001',
          passed: true,
          score: 0.75,
        },
      ];

      const patterns = await optimizer.analyzeFailures(results);
      const needsWork = patterns.find((p: any) => p.pattern === 'needs_improvement');
      expect(needsWork).toBeDefined();
    });
  });

  describe('Instruction Change Types', () => {
    it('should correctly identify section modifications', async () => {
      const instruction = `
## CONVERSATION GUIDELINES
Be helpful.

## Tone
Be professional.
`;

      const patterns = [
        { pattern: 'missing_problem_focus', type: 'test', frequency: 1, examples: [], suggestedFix: '' },
      ];

      const result = await optimizer.optimizeInstruction(instruction, patterns);

      expect(result.changes[0].section).toBe('CONVERSATION GUIDELINES');
    });

    it('should add new sections when needed', async () => {
      const instruction = 'You are an assistant.';
      const patterns = [
        { pattern: 'inappropriate_validation', type: 'test', frequency: 1, examples: [], suggestedFix: '' },
      ];

      const result = await optimizer.optimizeInstruction(instruction, patterns);

      expect(result.changes[0].section).toContain('(Added)');
    });
  });
});
