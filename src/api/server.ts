/**
 * Unified API Server
 *
 * Express server combining:
 * - Agent chat (using ADK as library)
 * - Simulation, Observability, and Optimizer endpoints
 *
 * Replaces both ADK dev server (8000) and Track 2 API (3001)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Runner, InMemorySessionService } from '@google/adk';
import rootAgent from '../agent.js';
import { handleTrack2Request } from './track2-api.js';
import { runStreamingSimulation, runStreamingAllScenarios } from './streaming-simulation.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Trust proxy for Cloud Run (needed for rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Auth configuration
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';
const AUTH_SECRET = process.env.AUTH_SECRET || 'default-secret-change-me';
const TOKEN_EXPIRY = '24h';

// Session service for agent conversations
const sessionService = new InMemorySessionService();

// App name must match what frontend sends ('src')
const APP_NAME = 'src';

// Create runner with the agent
const runner = new Runner({
  agent: rootAgent,
  appName: APP_NAME,
  sessionService,
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per minute
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// ========================================
// STATIC FILES (served before auth in production)
// ========================================
if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  const frontendPath = path.join(process.cwd(), 'frontend', 'dist');

  // Serve static files without auth
  app.use(express.static(frontendPath));
}

// ========================================
// AUTHENTICATION
// ========================================

// Login endpoint - returns JWT token
app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    const token = jwt.sign({ username }, AUTH_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token, expiresIn: TOKEN_EXPIRY });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Verify token endpoint
app.get('/auth/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, AUTH_SECRET);
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Auth middleware - protects all routes except /auth/* and /health
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for login, health check, and OPTIONS (CORS preflight)
  if (req.path.startsWith('/auth/') || req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    jwt.verify(token, AUTH_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Apply auth middleware
app.use(authMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================================
// AGENT CHAT ENDPOINT (replaces ADK dev server)
// ========================================

// SSE streaming chat endpoint - compatible with ADK /run_sse
app.post('/run_sse', async (req, res) => {
  const { appName, userId, sessionId, newMessage } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Get session - must be created first via /apps/:appName/users/:userId/sessions/:sessionId
    const app = appName || 'src';
    const uid = userId || 'user';
    const sid = sessionId;

    if (!sid) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'sessionId is required' })}\n\n`);
      res.end();
      return;
    }

    const session = await sessionService.getSession({ appName: app, userId: uid, sessionId: sid });
    if (!session) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: `Session not found: ${sid}. Create session first.` })}\n\n`);
      res.end();
      return;
    }

    console.log(`[Agent Chat] Running agent for session: ${session.id}`);

    // Run agent with streaming using runAsync
    const events = runner.runAsync({
      userId: uid,
      sessionId: session.id,
      newMessage: newMessage,
    });

    // Stream events to client
    for await (const event of events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    console.error('[Agent Chat] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
  }
  res.end();
});

// Create session endpoint - matches ADK API format
// POST /apps/:appName/users/:userId/sessions/:sessionId
app.post('/apps/:appName/users/:userId/sessions/:sessionId', async (req, res) => {
  const { appName, userId, sessionId } = req.params;
  const { state } = req.body;

  try {
    const session = await sessionService.createSession({
      appName,
      userId,
      sessionId,
      state,
    });
    console.log(`[Session] Created: ${session.id} for ${appName}/${userId}`);
    res.json(session);
  } catch (error) {
    console.error('[Session] Create error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get session endpoint
app.get('/apps/:appName/users/:userId/sessions/:sessionId', async (req, res) => {
  const { appName, userId, sessionId } = req.params;

  try {
    const session = await sessionService.getSession({ appName, userId, sessionId });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('[Session] Get error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// SSE Streaming endpoint for live simulation
app.post('/api/simulation/run-stream', async (req, res) => {
  const { scenarioId } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await runStreamingSimulation(scenarioId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
  }
  res.end();
});

// SSE Streaming endpoint for running ALL scenarios with live view
app.post('/api/simulation/run-all-stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await runStreamingAllScenarios((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'batch_complete' })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
  }
  res.end();
});

// SSE Streaming endpoint for LIVE A/B testing
app.post('/api/optimizer/ab-test-stream', async (req, res) => {
  const { versionA, versionB } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { runStreamingABTest } = await import('./streaming-ab-test.js');
    await runStreamingABTest(versionA, versionB, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  } catch (error) {
    console.error('[A/B Test Stream] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
  }
  res.end();
});

// Track 2 API routes
app.all('/api/*', async (req, res) => {
  try {
    const result = await handleTrack2Request(req.path, req.method, req.body);
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA fallback - serve index.html for all non-API routes (production only)
if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  const frontendPath = path.join(process.cwd(), 'frontend', 'dist');

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Unified API Server running on http://localhost:${PORT}`);
  console.log(`   - Agent Chat: http://localhost:${PORT}/run_sse`);
  console.log(`   - Sessions: http://localhost:${PORT}/apps/:appName/users/:userId/sessions`);
  console.log(`   - Simulation: http://localhost:${PORT}/api/simulation/*`);
  console.log(`   - Observability: http://localhost:${PORT}/api/observability/*`);
  console.log(`   - Optimizer: http://localhost:${PORT}/api/optimizer/*`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`   - Frontend: Serving static files from /frontend/dist`);
  }
  console.log(`\n   ✅ No need to run ADK dev server (port 8000)\n`);
});

export default app;
