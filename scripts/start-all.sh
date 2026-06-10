#!/bin/bash
# Start all servers for Track 2 development
# - ADK Agent Server (port 8000)
# - Track 2 API Server (port 3001)
# - Frontend Dev Server (port 8100)

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           TRACK 2: STARTING ALL SERVERS                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "Starting servers..."
echo "  - ADK Agent:  http://localhost:8000"
echo "  - Track 2 API: http://localhost:3001"
echo "  - Frontend:    http://localhost:8100"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start all servers with concurrently
npx concurrently \
    --names "ADK,API,WEB" \
    --prefix-colors "blue,yellow,green" \
    "npm run dev" \
    "npm run api" \
    "cd frontend && npm run dev"
