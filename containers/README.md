# Spec-Workflow MCP Server Container

This directory contains a Dockerfile and docker-compose file to build a containerised version of the Spec-Workflow MCP server. This setup allows you to run the MCP server and the dashboard in separate containers.

The MCP server runs as a normal MCP server in your configs, whilst the dashboard requires you to run a second container if you're not using the vscode extension.

## Building the Container

To build the Docker image change to the 'containers' directory and run:

```bash
docker build -t spec-workflow-mcp .
```

## Docker for MCP Server

Add the following to the .mcp.json file in the root of your your project directory and ClaudeCode will pick it up. You can use the same style to add to other tools as per the main README file.

```json
{
    "mcpServers": {
      "spec-workflow": {
        "command": "docker",
        "args": [
          "run", "--rm", "-i",
          "-v", "/home/username/project/.spec-workflow:/home/username/project/.spec-workflow:Z",
           "--security-opt", "no-new-privileges",
          "--cap-drop", "ALL",
          "--entrypoint=node",
          "spec-workflow-mcp:latest",
          "/app/dist/index.js", "/home/username/project"
        ]
      }
    }
  }

```

## Configuration

This mounts your project directory into the container at `/home/username/project` you must change `username` and `project` to your actual username and project directory name.

For example, if my username is `steev` and i'm working on the greatest tabletop gaming news site in the world, my path might look likes this: `/home/steev/tabletopsentinel.com`. The key is to make sure that the docker container has the same internal path as your host system so that any file paths referenced within the MCP server configuration will be valid.  The software will expect to find the `.spec-workflow` directory in the root of your project directory. You may need to create it if it doesn't already exist.

### Security considerations

- The container runs with `--security-opt no-new-privileges` to prevent privilege escalation.
- All capabilities are dropped with `--cap-drop ALL` to minimize the attack surface.
- The `.spec-workflow` directory is mounted with read and write permissions for configuration and state management. This same configuration is used for the MCP server and the Dashboard.

## Dashboard

If you're not using the vscode extension, you can run the dashboard in a separate container using docker-compose or direct from the command line or podman.

The settings are the same as the MCP server container, but also have the http interface exposed on port 3000 unless you have changed the DASHBOARD_PORT environment variable.

The `SPEC_WORKFLOW_PATH` environment variable must be set to the same path as used in the MCP server container as the will use the .spec-workflow configuration directory  to share state.

### docker-compose

To start the dashboard using docker-compose, run:

```zsh
SPEC_WORKFLOW_PATH=/home/username/project docker-compose up -d
```

To start the dashboard on a different port, run:

```zsh
DASHBOARD_PORT=3456 SPEC_WORKFLOW_PATH=/home/username/project docker-compose up -d
```

The dashboard should now be available at `http://localhost:3000` or `http://localhost:3456` if you changed the port.


### why all the ports?

I wanted the message when the server starts, to show the actual port the server is running on, so you can change it with the environment variable and see the result in the logs. It makes it more verbose to look at but the alternative is a misleading 'Listening on port 3000' message when you have changed the port.
