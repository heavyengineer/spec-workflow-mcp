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

# Copy built application and necessary resources
COPY --from=builder /app/dist ./dist

RUN mkdir -p /workspace

# Create a user with matching UID/GID (can be overridden at runtime)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Use existing node user/group if UID/GID is 1000, otherwise create new user
RUN if [ "$USER_ID" = "1000" ] && [ "$GROUP_ID" = "1000" ]; then \
        echo "Using existing node user"; \
    else \
        addgroup -g $GROUP_ID appgroup && \
        adduser -D -u $USER_ID -G appgroup appuser; \
    fi

# Switch to the appropriate user (node for 1000:1000, appuser otherwise)
USER ${USER_ID}

WORKDIR /workspace

EXPOSE 3000

CMD ["sh", "-c", "node /app/dist/index.js ${SPEC_WORKFLOW_PATH:-/workspace} --dashboard --port ${DASHBOARD_PORT:-3000}"]
