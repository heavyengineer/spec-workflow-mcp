#!/bin/bash

# Spec-Workflow MCP Setup Script
# This script configures .mcp.json for use with spec-workflow-mcp container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current directory and user info
PROJECT_DIR=$(pwd)
USER_ID=$(id -u)
GROUP_ID=$(id -g)
MCP_FILE=".mcp.json"

echo -e "${BLUE}Spec-Workflow MCP Container Setup${NC}"
echo "=================================="
echo "Project directory: $PROJECT_DIR"
echo "User ID: $USER_ID"
echo "Group ID: $GROUP_ID"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if the spec-workflow-mcp image exists
if ! docker image inspect spec-workflow-mcp:latest &> /dev/null; then
    echo -e "${YELLOW}Warning: spec-workflow-mcp:latest image not found${NC}"
    echo "Please build the image first:"
    echo "  cd containers/"
    echo "  docker build --build-arg USER_ID=$USER_ID --build-arg GROUP_ID=$GROUP_ID -t spec-workflow-mcp ."
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create MCP configuration
MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "spec-workflow": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--user", "$USER_ID:$GROUP_ID",
        "-v", "$PROJECT_DIR/.spec-workflow:$PROJECT_DIR/.spec-workflow:rw",
        "--entrypoint=node",
        "spec-workflow-mcp:latest",
        "/app/dist/index.js", "$PROJECT_DIR"
      ]
    }
  }
}
EOF
)

# Handle existing .mcp.json file
if [ -f "$MCP_FILE" ]; then
    echo -e "${YELLOW}Found existing $MCP_FILE${NC}"
    
    # Check if spec-workflow is already configured
    if grep -q '"spec-workflow"' "$MCP_FILE"; then
        echo -e "${YELLOW}spec-workflow configuration already exists${NC}"
        read -p "Overwrite existing spec-workflow configuration? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
        
        # Remove existing spec-workflow config and add new one
        # This is a simple approach - for complex cases, users should edit manually
        echo -e "${BLUE}Creating backup: $MCP_FILE.backup${NC}"
        cp "$MCP_FILE" "$MCP_FILE.backup"
        
        # Use jq if available, otherwise warn user
        if command -v jq &> /dev/null; then
            NEW_CONFIG=$(echo "$MCP_CONFIG" | jq '.mcpServers."spec-workflow"')
            jq --argjson newconfig "$NEW_CONFIG" '.mcpServers."spec-workflow" = $newconfig' "$MCP_FILE" > "$MCP_FILE.tmp" && \
            mv "$MCP_FILE.tmp" "$MCP_FILE"
            echo -e "${GREEN}Updated existing $MCP_FILE${NC}"
        else
            echo -e "${YELLOW}jq not found. Please manually merge the following configuration:${NC}"
            echo ""
            echo "$MCP_CONFIG"
            exit 1
        fi
    else
        # Add to existing file
        if command -v jq &> /dev/null; then
            echo -e "${BLUE}Adding spec-workflow to existing $MCP_FILE${NC}"
            NEW_CONFIG=$(echo "$MCP_CONFIG" | jq '.mcpServers."spec-workflow"')
            jq --argjson newconfig "$NEW_CONFIG" '.mcpServers."spec-workflow" = $newconfig' "$MCP_FILE" > "$MCP_FILE.tmp" && \
            mv "$MCP_FILE.tmp" "$MCP_FILE"
            echo -e "${GREEN}Added spec-workflow to existing $MCP_FILE${NC}"
        else
            echo -e "${YELLOW}jq not found. Please manually add the spec-workflow section to your existing $MCP_FILE:${NC}"
            echo ""
            echo "$MCP_CONFIG" | jq '.mcpServers."spec-workflow"'
            exit 1
        fi
    fi
else
    # Create new file
    echo -e "${BLUE}Creating new $MCP_FILE${NC}"
    echo "$MCP_CONFIG" > "$MCP_FILE"
    echo -e "${GREEN}Created $MCP_FILE${NC}"
fi

# Create .spec-workflow directory if it doesn't exist
SPEC_WORKFLOW_DIR="$PROJECT_DIR/.spec-workflow"
if [ ! -d "$SPEC_WORKFLOW_DIR" ]; then
    echo -e "${BLUE}Creating .spec-workflow directory${NC}"
    mkdir -p "$SPEC_WORKFLOW_DIR"
    echo -e "${GREEN}Created $SPEC_WORKFLOW_DIR${NC}"
else
    echo -e "${BLUE}.spec-workflow directory already exists${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Make sure the Docker image is built:"
echo "   cd containers/"
echo "   docker build --build-arg USER_ID=$USER_ID --build-arg GROUP_ID=$GROUP_ID -t spec-workflow-mcp ."
echo ""
echo "2. Restart Claude Desktop to pick up the new MCP configuration"
echo ""
echo "3. Test the connection by asking Claude to use spec-workflow tools"