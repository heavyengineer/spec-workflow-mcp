# Spec-Workflow MCP Server Container

This directory contains Docker configuration files to run the Spec-Workflow MCP server in a containerized environment. This setup allows you to run the MCP server and dashboard in Docker containers, providing isolation and easy deployment.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, for dashboard deployment)
- A project directory where you want to use spec-workflow

## Quick Start

### Building the Container

From the containers directory, build the Docker image with your user ID to avoid permission issues:

```bash
docker build --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) -t spec-workflow-mcp .
```

For systems where `id` command is not available:

```bash
docker build --build-arg USER_ID=1000 --build-arg GROUP_ID=1000 -t spec-workflow-mcp .
```

## MCP Server Configuration

### Automated Setup (Recommended)

The easiest way to configure the MCP server is to use the provided setup script:

```bash
# From your project directory (where you want to use spec-workflow)
/path/to/spec-workflow-mcp/containers/setup-mcp.sh
```

This script will:
- Detect your user ID and group ID automatically
- Create or update `.mcp.json` with the correct configuration
- Handle existing MCP configurations safely
- Provide clear next steps

### Manual Configuration

If you prefer to configure manually, create or update the `.mcp.json` file in your project root:

```json
{
    "mcpServers": {
      "spec-workflow": {
        "command": "docker",
        "args": [
          "run", "--rm", "-i",
          "--user", "1000:1000",
          "-v", "/full/path/to/project/.spec-workflow:/full/path/to/project/.spec-workflow:rw",
          "--entrypoint=node",
          "spec-workflow-mcp:latest",
          "/app/dist/index.js", "/full/path/to/project"
        ]
      }
    }
  }

```

**Important**: Replace `1000:1000` with your actual user ID and group ID (get them with `id -u` and `id -g`).

## Important Configuration Notes

### Path Mapping Requirements

The container requires the `.spec-workflow` directory to be mounted at the **exact same path** inside the container as it exists on your host system. This is critical for the MCP server to function correctly.

**Example:** If your project is at `/home/steev/tabletopsentinel.com`, your configuration would be:

```json
{
    "mcpServers": {
      "spec-workflow": {
        "command": "docker",
        "args": [
          "run", "--rm", "-i",
          "-v", "./.spec-workflow:/home/steev/tabletopsentinel.com/.spec-workflow:rw",
          "--entrypoint=node",
          "spec-workflow-mcp:latest",
          "/app/dist/index.js", "./"
        ]
      }
    }
}
```

### Key Configuration Points

- **Path Consistency**: The container path must match your host path exactly
- **Volume Mount**: Only the `.spec-workflow` directory needs to be mounted
- **Auto-creation**: The `.spec-workflow` directory will be created if it doesn't exist
- **SELinux Note**: If you're using SELinux, you may need to add `:z` to the volume mount (e.g., `:rw,z`)

## Dashboard Deployment

The dashboard can be run separately from the MCP server using Docker Compose. This is useful if you're not using the VSCode extension.

### Important Environment Variables

- `SPEC_WORKFLOW_PATH`: Must match the project path used in the MCP server configuration
- `DASHBOARD_PORT`: The port to expose the dashboard on (default: 3000)

### Using Docker Compose

Start the dashboard with default settings:

```bash
# Replace with your actual project path
SPEC_WORKFLOW_PATH=/home/username/project docker-compose up -d
```

Start the dashboard on a custom port:

```bash
DASHBOARD_PORT=3456 SPEC_WORKFLOW_PATH=/home/username/project docker-compose up -d
```

Access the dashboard at:
- Default: `http://localhost:3000`
- Custom port: `http://localhost:YOUR_PORT`

### Stopping the Dashboard

```bash
docker-compose down
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure the container was built with your user ID using the `--build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g)` flags
2. **Port Already in Use**: Choose a different port using the `DASHBOARD_PORT` variable
3. **Path Not Found**: Verify that your `SPEC_WORKFLOW_PATH` matches your actual project location
4. **SELinux Issues**: On SELinux-enabled systems, add `:z` to volume mounts
5. **File Ownership Issues**: Rebuild the container with the correct user/group IDs if `.spec-workflow` files are created with wrong ownership

### Logs and Debugging

View container logs:
```bash
docker-compose logs -f
```

Check container status:
```bash
docker ps
```
