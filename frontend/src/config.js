// API Configuration
// Everything runs on port 3001 (unified server with agent + Track 2 API)
// In production: uses same origin or Cloud Run URL

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost'

// Base API URL - unified server on port 3001
export const BASE_URL = import.meta.env.VITE_API_URL ||
  (isLocal ? 'http://localhost:3001' : '')

// Agent API (chat, sessions) - same server
export const AGENT_URL = BASE_URL

// Track 2 API (optimizer, simulation, templates) - same server, /api/* routes
export const API_URL = BASE_URL

// Deployed agent URL (Cloud Run)
export const DEPLOYED_AGENT_URL = 'https://founder-validation-agent-356663565224.us-central1.run.app'
