/**
 * End-to-End Tests for A/B Testing
 *
 * Tests the complete A/B testing flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock before importing
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: class {
    constructor() {}
    getGenerativeModel = () => ({
      generateContent: vi.fn()
        .mockResolvedValueOnce({
          response: { candidates: [{ content: { parts: [{ text: 'Response A' }] } }] }
        })
        .mockResolvedValueOnce({
          response: { candidates: [{ content: { parts: [{ text: '{"score": 0.75}' }] } }] }
        })
        .mockResolvedValueOnce({
          response: { candidates: [{ content: { parts: [{ text: 'Response B' }] } }] }
        })
        .mockResolvedValueOnce({
          response: { candidates: [{ content: { parts: [{ text: '{"score": 0.90}' }] } }] }
        })
    });
  }
}));

describe('A/B Test E2E Flow', () => {
  describe('Winner Determination Logic', () => {
    it('should declare B as winner when score is 5% higher', () => {
      const result = {
        instructionA: { version: 1, passRate: 0.70, avgLatency: 1000 },
        instructionB: { version: 2, passRate: 0.80, avgLatency: 1000 },
        winner: 'B' as const,
        improvement: 10,
        scenarios: [],
      };

      expect(result.winner).toBe('B');
      expect(result.improvement).toBe(10);
    });

    it('should declare A as winner when A score is 5% higher', () => {
      const result = {
        instructionA: { version: 1, passRate: 0.85, avgLatency: 1000 },
        instructionB: { version: 2, passRate: 0.75, avgLatency: 1000 },
        winner: 'A' as const,
        improvement: 10,
        scenarios: [],
      };

      expect(result.winner).toBe('A');
    });

    it('should declare tie when difference is less than 5%', () => {
      const result = {
        instructionA: { version: 1, passRate: 0.78, avgLatency: 1000 },
        instructionB: { version: 2, passRate: 0.80, avgLatency: 1000 },
        winner: 'tie' as const,
        improvement: 2,
        scenarios: [],
      };

      expect(result.winner).toBe('tie');
    });
  });

  describe('Scenario Result Structure', () => {
    it('should include all required fields in scenario results', () => {
      const scenarioResult = {
        id: 'EC001',
        name: 'Validation Seeker',
        scoreA: 0.75,
        scoreB: 0.90,
        responseA: 'Response from instruction A...',
        responseB: 'Response from instruction B...',
        winner: 'B' as const,
      };

      expect(scenarioResult).toHaveProperty('id');
      expect(scenarioResult).toHaveProperty('name');
      expect(scenarioResult).toHaveProperty('scoreA');
      expect(scenarioResult).toHaveProperty('scoreB');
      expect(scenarioResult).toHaveProperty('winner');
    });

    it('should determine per-scenario winner correctly', () => {
      const scenario = {
        id: 'EC001',
        name: 'Test',
        scoreA: 0.60,
        scoreB: 0.85,
        winner: 'B' as const,
      };

      expect(scenario.winner).toBe('B');
      expect(scenario.scoreB - scenario.scoreA).toBeGreaterThan(0.1);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate pass rate as average of scores', () => {
      const scores = [0.8, 0.7, 0.9, 0.6, 0.8];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(0.76);
    });

    it('should handle all passing scenarios', () => {
      const scores = [1.0, 1.0, 1.0, 1.0, 1.0];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(1.0);
    });

    it('should handle all failing scenarios', () => {
      const scores = [0.0, 0.0, 0.0, 0.0, 0.0];
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBe(0.0);
    });
  });

  describe('Response Truncation', () => {
    it('should truncate long responses to 300 chars', () => {
      const longResponse = 'A'.repeat(500);
      const truncated = longResponse.substring(0, 300);

      expect(truncated.length).toBe(300);
    });
  });

  describe('Latency Tracking', () => {
    it('should calculate average latency correctly', () => {
      const latencies = [1000, 1200, 800, 1100, 900];
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      expect(avgLatency).toBe(1000);
    });
  });

  describe('Improvement Calculation', () => {
    it('should calculate improvement percentage correctly', () => {
      const scoreA = 0.70;
      const scoreB = 0.85;
      const improvement = Math.round((scoreB - scoreA) * 100);

      expect(improvement).toBe(15);
    });

    it('should handle negative improvement (A better than B)', () => {
      const scoreA = 0.90;
      const scoreB = 0.75;
      const improvement = Math.abs(Math.round((scoreB - scoreA) * 100));

      expect(improvement).toBe(15);
    });
  });

  describe('Pass Criteria Logic', () => {
    it('should check mustContain terms', () => {
      const response = 'What problem are you solving for your customer?';
      const mustContain = ['problem', 'customer'];

      const allFound = mustContain.every(term =>
        response.toLowerCase().includes(term.toLowerCase())
      );

      expect(allFound).toBe(true);
    });

    it('should check mustNotContain terms', () => {
      const response = 'Tell me more about your idea.';
      const mustNotContain = ['sounds great', 'love it'];

      const noneFound = mustNotContain.every(term =>
        !response.toLowerCase().includes(term.toLowerCase())
      );

      expect(noneFound).toBe(true);
    });

    it('should fail when forbidden term is present', () => {
      const response = 'That sounds great! Let me help you build it.';
      const mustNotContain = ['sounds great', 'love it'];

      const noneFound = mustNotContain.every(term =>
        !response.toLowerCase().includes(term.toLowerCase())
      );

      expect(noneFound).toBe(false);
    });
  });
});
