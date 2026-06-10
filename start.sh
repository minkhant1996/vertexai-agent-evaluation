#!/bin/bash

# SoeMind Foundry - Founder Validation Agent
# Ports: Frontend=8100, Backend=8101, Eval=8102

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Founder Validation Agent${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Frontend: ${GREEN}http://localhost:8100${NC}"
echo -e "Backend:  ${GREEN}http://localhost:8101${NC}"
echo ""

# Check for .env file
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    echo -e "${YELLOW}Please edit .env with your GEMINI_API_KEY${NC}"
fi

# Load .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Parse arguments
MODE=${1:-"dev"}

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    kill $EVAL_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

case $MODE in
    "dev")
        echo -e "${GREEN}Starting Backend (8101) + Frontend (8100)...${NC}\n"

        # Start backend on port 8101
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!
        echo -e "Backend PID: $BACKEND_PID"

        # Wait for backend to start
        sleep 3

        # Start frontend on port 8100
        cd "$PROJECT_ROOT/frontend"
        npm run dev &
        FRONTEND_PID=$!
        echo -e "Frontend PID: $FRONTEND_PID"

        echo -e "\n${GREEN}Ready!${NC}"
        echo -e "Frontend: ${BLUE}http://localhost:8100${NC}"
        echo -e "Backend:  ${BLUE}http://localhost:8101${NC}"
        echo -e "\nPress Ctrl+C to stop\n"

        # Wait for processes
        wait
        ;;

    "backend")
        echo -e "${GREEN}Starting Backend only (8101)...${NC}\n"
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101
        ;;

    "frontend")
        echo -e "${GREEN}Starting Frontend only (8100)...${NC}\n"
        cd "$PROJECT_ROOT/frontend"
        npm run dev
        ;;

    "eval")
        echo -e "${GREEN}Starting Backend (8101) + Evaluation...${NC}\n"

        # Kill any existing process on port 8101
        lsof -ti:8101 | xargs kill -9 2>/dev/null || true
        sleep 1

        # Install Python dependencies
        echo -e "${YELLOW}Installing Python dependencies...${NC}"
        python3 -m pip install -q -r "$PROJECT_ROOT/eval/requirements.txt"

        # Start backend
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!

        # Wait for backend
        echo "Waiting for backend to start..."
        sleep 5

        # Run evaluation
        echo -e "\n${GREEN}Running evaluation...${NC}"
        cd "$PROJECT_ROOT/eval"
        AGENT_URL=http://localhost:8101 python3 run_eval.py

        # Cleanup
        kill $BACKEND_PID 2>/dev/null
        ;;

    "eval-vertex")
        echo -e "${GREEN}Starting Backend (8101) + Vertex AI Evaluation...${NC}\n"

        # Kill any existing process on port 8101
        lsof -ti:8101 | xargs kill -9 2>/dev/null || true
        sleep 1

        # Start backend
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!

        echo "Waiting for backend to start..."
        sleep 5

        # Run Vertex evaluation (curl-based)
        echo -e "\n${GREEN}Running Vertex AI evaluation (curl-based)...${NC}"
        AGENT_URL=http://localhost:8101 bash "$PROJECT_ROOT/eval/vertex_eval.sh"

        kill $BACKEND_PID 2>/dev/null
        ;;

    "eval-curl")
        echo -e "${GREEN}Starting Backend (8101) + Curl-based Evaluation...${NC}\n"

        # Kill any existing process on port 8101
        lsof -ti:8101 | xargs kill -9 2>/dev/null || true
        sleep 1

        # Start backend
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!

        sleep 5

        # Run curl-based evaluation
        echo -e "\n${GREEN}Running curl-based evaluation...${NC}"
        bash "$PROJECT_ROOT/eval/vertex_curl_eval.sh"

        kill $BACKEND_PID 2>/dev/null
        ;;

    "simulate")
        echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  TRACK 2: Agent Simulation${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"

        # Kill any existing process on port 8101
        lsof -ti:8101 | xargs kill -9 2>/dev/null || true
        sleep 1

        # Start backend
        cd "$PROJECT_ROOT"
        echo -e "${YELLOW}Starting agent on port 8101...${NC}"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!

        echo "Waiting for agent to initialize..."
        sleep 5

        # Run simulation
        echo -e "\n${GREEN}Running 20 edge case simulations...${NC}\n"
        cd "$PROJECT_ROOT"
        AGENT_ENDPOINT=http://localhost:8101 npx tsx src/scripts/run-simulation.ts ${@:2}

        kill $BACKEND_PID 2>/dev/null
        ;;

    "simulate:easy")
        echo -e "${GREEN}Running EASY edge cases only...${NC}\n"
        $0 simulate --easy
        ;;

    "simulate:hard")
        echo -e "${GREEN}Running HARD edge cases only...${NC}\n"
        $0 simulate --hard
        ;;

    "all")
        echo -e "${GREEN}Starting Backend (8101) + Frontend (8100) + Eval Server (8102)...${NC}\n"

        # Start backend
        cd "$PROJECT_ROOT"
        PORT=8101 npx adk web --port 8101 &
        BACKEND_PID=$!

        sleep 3

        # Start frontend
        cd "$PROJECT_ROOT/frontend"
        npm run dev &
        FRONTEND_PID=$!

        echo -e "\n${GREEN}All services running!${NC}"
        echo -e "Frontend: ${BLUE}http://localhost:8100${NC}"
        echo -e "Backend:  ${BLUE}http://localhost:8101${NC}"
        echo -e "\nPress Ctrl+C to stop all\n"

        wait
        ;;

    "install")
        echo -e "${GREEN}Installing all dependencies...${NC}\n"

        # Root dependencies
        cd "$PROJECT_ROOT"
        echo "Installing backend dependencies..."
        npm install

        # Frontend dependencies
        cd "$PROJECT_ROOT/frontend"
        echo "Installing frontend dependencies..."
        npm install

        # Python dependencies
        cd "$PROJECT_ROOT/eval"
        echo "Installing evaluation dependencies..."
        pip3 install -r requirements.txt

        echo -e "\n${GREEN}All dependencies installed!${NC}"
        ;;

    "db")
        echo -e "${GREEN}Setting up database...${NC}\n"
        cd "$PROJECT_ROOT"
        npm run db:generate
        npm run db:push
        npm run db:studio
        ;;

    *)
        echo "Usage: ./start.sh [mode]"
        echo ""
        echo "Development:"
        echo "  dev          Start frontend (8100) + backend (8101)"
        echo "  frontend     Start frontend only (8100)"
        echo "  backend      Start backend only (8101)"
        echo "  all          Start all services"
        echo ""
        echo "Evaluation:"
        echo "  eval         Start backend + run Python evaluation"
        echo "  eval-vertex  Start backend + run Vertex AI evaluation"
        echo "  eval-curl    Start backend + run curl-based evaluation"
        echo ""
        echo "Track 2 - Simulation:"
        echo "  simulate     Run all 20 edge case simulations"
        echo "  simulate --easy   Run only easy scenarios"
        echo "  simulate --hard   Run only hard scenarios"
        echo "  simulate --scenario=EC001   Run specific scenario"
        echo ""
        echo "Setup:"
        echo "  install      Install all dependencies"
        echo "  db           Setup database + open Prisma Studio"
        echo ""
        ;;
esac
