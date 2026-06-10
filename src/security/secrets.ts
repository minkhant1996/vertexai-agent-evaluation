/**
 * Security & Secrets Management for Founder Validation Agent
 *
 * Handles secure configuration, API key management, and
 * Google Cloud Secret Manager integration.
 */

import { tracer } from '../observability/tracing.js';

// ============================================
// CONFIGURATION
// ============================================

export interface AgentConfig {
  geminiApiKey: string;
  googleCloudProject?: string;
  googleCloudLocation?: string;
  databaseUrl?: string;
  environment: 'development' | 'staging' | 'production';
  enableTracing: boolean;
  enableGuardrails: boolean;
  maxTokensPerRequest: number;
  rateLimitPerMinute: number;
}

/**
 * Load configuration from environment variables
 * In production, secrets should come from Secret Manager
 */
export function loadConfig(): AgentConfig {
  const env = process.env.NODE_ENV || 'development';

  // Validate required secrets
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here') {
    if (env === 'production') {
      throw new Error('GEMINI_API_KEY is required in production');
    }
    tracer.log('WARN', 'GEMINI_API_KEY not configured - agent will not work');
  }

  const config: AgentConfig = {
    geminiApiKey: geminiApiKey || '',
    googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
    googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    databaseUrl: process.env.DATABASE_URL,
    environment: env as AgentConfig['environment'],
    enableTracing: process.env.ENABLE_TRACING !== 'false',
    enableGuardrails: process.env.ENABLE_GUARDRAILS !== 'false',
    maxTokensPerRequest: parseInt(process.env.MAX_TOKENS_PER_REQUEST || '4096', 10),
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100', 10),
  };

  tracer.log('INFO', 'Configuration loaded', {
    environment: config.environment,
    hasGeminiKey: !!config.geminiApiKey,
    hasGcpProject: !!config.googleCloudProject,
    hasDatabase: !!config.databaseUrl,
    tracingEnabled: config.enableTracing,
    guardrailsEnabled: config.enableGuardrails,
  });

  return config;
}

// ============================================
// SECRET MANAGER INTEGRATION (Google Cloud)
// ============================================

/**
 * Fetch secret from Google Cloud Secret Manager
 * Use this in production for secure secret storage
 */
export async function getSecretFromGCP(
  secretName: string,
  projectId?: string
): Promise<string | null> {
  const project = projectId || process.env.GOOGLE_CLOUD_PROJECT;

  if (!project) {
    tracer.log('WARN', 'Cannot fetch secret: GOOGLE_CLOUD_PROJECT not set');
    return null;
  }

  try {
    // Dynamic import to avoid issues when not on GCP
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();

    const name = `projects/${project}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });

    const secret = version.payload?.data?.toString();

    tracer.log('INFO', 'Secret fetched from Secret Manager', { secretName });
    return secret || null;
  } catch (error) {
    tracer.log('ERROR', 'Failed to fetch secret from Secret Manager', {
      secretName,
      error: String(error),
    });
    return null;
  }
}

// ============================================
// API KEY VALIDATION
// ============================================

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(key: string, type: 'gemini' | 'openai' = 'gemini'): boolean {
  if (!key || key.length < 10) return false;

  // Basic format validation
  if (type === 'gemini') {
    // Gemini API keys typically start with "AIza"
    return key.startsWith('AIza') || key.length >= 39;
  }

  return true;
}

/**
 * Mask API key for logging (show only first/last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// ============================================
// REQUEST AUTHENTICATION
// ============================================

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Authenticate incoming request
 * In production, integrate with your auth provider
 */
export function authenticateRequest(
  headers: Record<string, string | undefined>
): AuthResult {
  // For development, allow unauthenticated requests
  if (process.env.NODE_ENV === 'development') {
    return {
      authenticated: true,
      userId: headers['x-user-id'] || 'dev-user',
      sessionId: headers['x-session-id'] || `session-${Date.now()}`,
    };
  }

  // Check for API key in header
  const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return {
      authenticated: false,
      error: 'Missing authentication',
    };
  }

  // Validate against allowed keys (in production, check against database)
  const allowedKeys = (process.env.ALLOWED_API_KEYS || '').split(',');

  if (!allowedKeys.includes(apiKey)) {
    tracer.log('WARN', 'Invalid API key attempt', { keyPrefix: maskApiKey(apiKey) });
    return {
      authenticated: false,
      error: 'Invalid API key',
    };
  }

  return {
    authenticated: true,
    userId: headers['x-user-id'] || 'authenticated-user',
    sessionId: headers['x-session-id'] || `session-${Date.now()}`,
  };
}

// ============================================
// CORS & SECURITY HEADERS
// ============================================

export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export const CORS_CONFIG = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8100,http://localhost:3000').split(','),
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-ID', 'X-Session-ID'],
  maxAge: 86400,
};

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  return CORS_CONFIG.allowedOrigins.includes(origin);
}

// ============================================
// EXPORTS
// ============================================

export const security = {
  loadConfig,
  getSecretFromGCP,
  validateApiKey,
  maskApiKey,
  authenticateRequest,
  isOriginAllowed,
  SECURITY_HEADERS,
  CORS_CONFIG,
};

export default security;
