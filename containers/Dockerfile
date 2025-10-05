# Build stage
FROM node:24-alpine AS builder
RUN apk add --no-cache git

WORKDIR /app

# Clone the MCP server during build
RUN git clone --depth 1 https://github.com/Pimzino/spec-workflow-mcp.git .

# Install dependencies and build
RUN npm install && npm run build

# Runtime stage
FROM node:24-alpine
WORKDIR /app

# Copy only production files
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy built application and necessary resources
COPY --from=builder /app/dist ./dist

RUN mkdir -p /workspace

# Ensure application files are readable by any UID
# This is necessary because we run the container with --user flag at runtime
RUN chmod -R a+rX /app

WORKDIR /workspace

EXPOSE 3000

CMD ["sh", "-c", "node /app/dist/index.js ${SPEC_WORKFLOW_PATH:-/workspace} --dashboard --port ${DASHBOARD_PORT:-3000}"]
