/**
 * Authentication Proxy for ADK Agent + Track 2 Dashboard
 * Combines ADK server, Track 2 API, and Dashboard in one deployment
 */

import { execSync } from 'child_process';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleTrack2Request, recordTrace } from './api/track2-api.js';
import { runStreamingSimulation, runStreamingAllScenarios } from './api/streaming-simulation.js';
import { cloudTrace } from './observability/cloud-trace.js';
import { vertexTrace } from './observability/vertex-trace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Test credentials for hackathon judges
const USERS: Record<string, string> = {
  'judge': 'hackathon2024',
  'admin': process.env.ADMIN_PASSWORD || 'soemindfoundry',
  'demo': 'track2demo',
};

const PORT = process.env.PORT || 8080;

// Basic auth middleware
const basicAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="SoeMind Foundry Agent"');
    return res.status(401).send('Authentication required');
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');

  if (USERS[username] && USERS[username] === password) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="SoeMind Foundry Agent"');
  return res.status(401).send('Invalid credentials');
};

// Health check endpoint (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', auth: 'enabled' });
});

// Apply basic auth to all other routes
app.use(basicAuth);

// Initialize and start server
const main = async () => {
  console.log('Starting SoeMind Foundry Agent...');
  console.log('Working directory:', process.cwd());
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_GENAI_USE_VERTEXAI: process.env.GOOGLE_GENAI_USE_VERTEXAI,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
  });

  try {
    // Check ADK version
    const version = execSync('npx adk --version', { encoding: 'utf-8', timeout: 30000 });
    console.log(`ADK version: ${version.trim()}`);

    // Dynamically import ADK devtools
    console.log('Loading ADK devtools...');
    const { AdkApiServer } = await import('@google/adk-devtools');

    console.log('Creating ADK API server...');
    const adkServer = new AdkApiServer({
      host: '0.0.0.0',
      port: Number(PORT),
      agentsDir: process.cwd(),
      agentFileLoadOptions: {
        compile: true,   // Enable TypeScript compilation
        bundle: true,    // Bundle dependencies
      },
      serveDebugUI: true,
      allowOrigins: '*',
    });

    // Inject our basic auth middleware before ADK routes
    console.log('Injecting auth middleware...');
    const originalApp = adkServer.app;

    // Re-create middleware stack with auth first
    const authApp = express();
    authApp.get('/health', (_req, res) => {
      res.json({ status: 'ok', auth: 'enabled', adk: 'ready', track2: 'enabled' });
    });
    authApp.use(basicAuth);
    authApp.use(cors());
    authApp.use(express.json());

    // ============ TRACK 2 ROUTES ============

    // Serve Track 2 Dashboard static files
    const frontendPath = path.join(process.cwd(), 'frontend', 'dist');
    console.log('Frontend path:', frontendPath);

    // Explicit route for JS assets - MUST come before other routes
    authApp.get('/track2/assets/:filename', (req, res) => {
      const filename = req.params.filename;
      const filePath = path.join(frontendPath, 'assets', filename);
      console.log(`[Track2] Serving asset: ${filePath}`);

      if (filename.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filename.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }

      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`[Track2] Error serving ${filePath}:`, err);
          res.status(404).send('Asset not found');
        }
      });
    });

    // Root track2 route and SPA fallback
    authApp.get('/track2', (_req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });

    authApp.get('/track2/*', (req, res) => {
      // Assets are handled above, this is SPA fallback
      console.log(`[Track2] SPA fallback for: ${req.path}`);
      res.sendFile(path.join(frontendPath, 'index.html'));
    });

    // Track 2 API: Streaming simulation endpoint
    authApp.post('/api/simulation/run-stream', async (req, res) => {
      const { scenarioId } = req.body;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        await runStreamingSimulation(scenarioId, (event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
      }
      res.end();
    });

    // Track 2 API: Run all scenarios with streaming
    authApp.post('/api/simulation/run-all-stream', async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        await runStreamingAllScenarios((event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        res.write(`data: ${JSON.stringify({ type: 'batch_complete' })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
      }
      res.end();
    });

    // Track 2 API: Generic handler
    authApp.all('/api/*', async (req, res) => {
      try {
        const result = await handleTrack2Request(req.path, req.method, req.body);
        res.status(result.status).json(result.data);
      } catch (error) {
        console.error('Track 2 API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    console.log('Track 2 routes added');

    // ============ TRACING MIDDLEWARE ============

    // Add tracing for agent requests (uses both local and Vertex AI Cloud Trace)
    authApp.use('/run_sse', (req, res, next) => {
      const startTime = Date.now();
      const body = req.body || {};
      const sessionId = body.sessionId || body.session_id || 'unknown';
      const userMessage = body.newMessage?.parts?.[0]?.text || body.new_message?.parts?.[0]?.text || '';

      // Start traces in both systems
      const localTraceId = cloudTrace.startTrace(sessionId, userMessage);
      const vertexTraceId = vertexTrace.startTrace(sessionId, userMessage);
      console.log(`[Trace] Started traces - local: ${localTraceId}, vertex: ${vertexTraceId}`);

      // Record trace when response finishes
      res.on('finish', () => {
        const latencyMs = Date.now() - startTime;
        const success = res.statusCode < 400;

        // Complete both traces
        cloudTrace.completeTrace(localTraceId, 'completed', success);
        vertexTrace.completeTrace(vertexTraceId, '', success);

        // Also record to storage for API
        recordTrace({
          traceId: localTraceId,
          vertexTraceId,
          sessionId,
          userMessage: userMessage.substring(0, 200),
          latencyMs,
          success,
          timestamp: new Date().toISOString(),
          cloudTraceUrl: vertexTrace.getCloudTraceUrl(vertexTraceId),
        });

        console.log(`[Trace] Completed traces in ${latencyMs}ms`);
      });

      next();
    });

    // ============ ADK ROUTES ============

    // Initialize ADK server
    console.log('Initializing ADK server...');
    // @ts-ignore - init is needed but marked private
    await adkServer.init();

    // Use ADK's initialized app routes
    authApp.use(originalApp);

    // Start the server
    const server = authApp.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║   SoeMind Foundry Agent - Protected Mode                   ║
╠════════════════════════════════════════════════════════════╣
║   Server: http://0.0.0.0:${PORT}                                ║
╠════════════════════════════════════════════════════════════╣
║   Test Accounts:                                           ║
║   • judge / hackathon2024                                  ║
║   • demo  / track2demo                                     ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Handle shutdown
    process.on('SIGTERM', () => {
      console.log('Shutting down...');
      server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start ADK server:', error);

    // Fallback: start a simple server that shows the error
    app.use((_req, res) => {
      res.status(503).json({
        error: 'ADK server failed to start',
        details: String(error),
      });
    });

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Fallback server started on port ${PORT}`);
    });
  }
};

main();
