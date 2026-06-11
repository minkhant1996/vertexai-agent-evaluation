# Founder Validation Agent - Production Dockerfile
# Deploys to Google Cloud Run

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for ADK)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build || echo "No build step needed for ADK"

# Build frontend
RUN cd frontend && npm ci && npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agent -u 1001

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/founder_validation_agent ./founder_validation_agent
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/evals ./evals
COPY --from=builder /app/frontend/dist ./frontend/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the auth proxy (which starts ADK internally)
CMD ["npx", "tsx", "src/auth-proxy.ts"]
