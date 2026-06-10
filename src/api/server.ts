/**
 * Track 2 API Server
 *
 * Express server for Simulation, Observability, and Optimizer endpoints.
 * Runs alongside the ADK dev server.
 */

import express from 'express';
import cors from 'cors';
import { handleTrack2Request } from './track2-api.js';
import { runStreamingSimulation, runStreamingAllScenarios } from './streaming-simulation.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Track 2 API Server running on http://localhost:${PORT}`);
  console.log(`   - Simulation: http://localhost:${PORT}/api/simulation/*`);
  console.log(`   - Observability: http://localhost:${PORT}/api/observability/*`);
  console.log(`   - Optimizer: http://localhost:${PORT}/api/optimizer/*\n`);
});

export default app;
