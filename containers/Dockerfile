# Build stage
FROM node:24-alpine AS builder
RUN apk add --no-cache git

WORKDIR /app

# Clone the MCP server during build
RUN git clone --depth 1 https://github.com/Pimzino/spec-workflow-mcp.git .

# Install dependencies and build
RUN npm ci && npm run build

# Runtime stage
FROM node:24-alpine
WORKDIR /app

# Copy only production files
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/dashboard/public ./src/dashboard/public

RUN mkdir -p /workspace

WORKDIR /workspace

# Use ENTRYPOINT for flexibility
ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["/workspace", "--dashboard", "--port", "3000"]
