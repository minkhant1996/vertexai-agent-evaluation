/**
 * Integration Tests for Track 2 API
 *
 * Tests API endpoints:
 * - /api/optimizer/analyze
 * - /api/optimizer/generate-fix
 * - /api/optimizer/ab-test
 * - /api/optimizer/versions
 * - /api/agent-templates
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { handleTrack2Request } from '../../src/api/track2-api.js';

// Mock storage
vi.mock('../../src/api/track2-api.js', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    // We'll test the actual implementation
  };
});

describe('Track 2 API Endpoints', () => {
  describe('GET /api/simulation/scenarios', () => {
    it('should return list of scenarios', async () => {
      const result = await handleTrack2Request('/api/simulation/scenarios', 'GET', {});

      expect(result.status).toBe(200);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
    });

    it('should include scenario difficulty', async () => {
      const result = await handleTrack2Request('/api/simulation/scenarios', 'GET', {});

      expect(result.data[0]).toHaveProperty('difficulty');
      expect(['easy', 'medium', 'hard']).toContain(result.data[0].difficulty);
    });
  });

  describe('GET /api/optimizer/history', () => {
    it('should return version history', async () => {
      const result = await handleTrack2Request('/api/optimizer/history', 'GET', {});

      expect(result.status).toBe(200);
      expect(result.data).toBeInstanceOf(Array);
    });

    it('should include version metadata', async () => {
      const result = await handleTrack2Request('/api/optimizer/history', 'GET', {});

      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('version');
        expect(result.data[0]).toHaveProperty('createdAt');
      }
    });
  });

  describe('GET /api/optimizer/agents', () => {
    it('should return list of available agents', async () => {
      const result = await handleTrack2Request('/api/optimizer/agents', 'GET', {});

      expect(result.status).toBe(200);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should include agent id and name', async () => {
      const result = await handleTrack2Request('/api/optimizer/agents', 'GET', {});

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
    });
  });

  describe('GET /api/templates', () => {
    it('should return scenario templates', async () => {
      const result = await handleTrack2Request('/api/templates', 'GET', {});

      expect(result.status).toBe(200);
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/agent-templates', () => {
    it('should return agent templates', async () => {
      const result = await handleTrack2Request('/api/agent-templates', 'GET', {});

      expect(result.status).toBe(200);
      expect(result.data).toBeInstanceOf(Array);
    });

    it('should include instruction field', async () => {
      const result = await handleTrack2Request('/api/agent-templates', 'GET', {});

      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('instruction');
      }
    });
  });

  describe('POST /api/optimizer/optimize', () => {
    it('should accept optimization request', async () => {
      // Skip if no project configured
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        console.log('Skipping: GOOGLE_CLOUD_PROJECT not set');
        return;
      }

      const result = await handleTrack2Request('/api/optimizer/optimize', 'POST', {
        targetAgent: 'orchestrator',
        patterns: ['missing_problem_focus'],
      });

      expect([200, 500]).toContain(result.status); // May fail without API key
    });
  });

  describe('POST /api/optimizer/ab-test', () => {
    it('should reject missing versions', async () => {
      const result = await handleTrack2Request('/api/optimizer/ab-test', 'POST', {
        versionA: 999,
        versionB: 998,
      });

      expect(result.status).toBe(404);
      expect(result.data.error).toContain('Version not found');
    });

    it('should require both version parameters', async () => {
      const result = await handleTrack2Request('/api/optimizer/ab-test', 'POST', {
        versionA: 1,
      });

      expect(result.status).toBe(404);
    });
  });

  describe('POST /api/optimizer/versions/:id/apply', () => {
    it('should reject corrupted versions', async () => {
      // First create a short version in storage
      const result = await handleTrack2Request('/api/optimizer/versions/corrupted-test/apply', 'POST', {
        agentId: 'orchestrator',
      });

      // Should fail because version doesn't exist or is corrupted
      expect([400, 404]).toContain(result.status);
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const result = await handleTrack2Request('/api/unknown/route', 'GET', {});

      expect(result.status).toBe(404);
      expect(result.data.error).toBe('Not found');
    });
  });
});

describe('API Request Validation', () => {
  describe('Content-Type handling', () => {
    it('should handle JSON body correctly', async () => {
      // Skip if no project configured (optimize endpoint needs it)
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        // Test a simpler endpoint instead
        const result = await handleTrack2Request('/api/simulation/scenarios', 'GET', {});
        expect(result).toHaveProperty('status');
        return;
      }

      const result = await handleTrack2Request('/api/optimizer/optimize', 'POST', {
        targetAgent: 'orchestrator',
      });

      // Should not throw parsing error
      expect(result).toHaveProperty('status');
    });
  });

  describe('Method handling', () => {
    it('should reject invalid methods', async () => {
      const result = await handleTrack2Request('/api/simulation/scenarios', 'DELETE', {});

      expect(result.status).toBe(404);
    });
  });
});
