import { createServer } from 'net';

// Dashboard constants
export const DASHBOARD_TEST_MESSAGE = 'MCP Workflow Dashboard Online!';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, '0.0.0.0', () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

export async function findAvailablePort(): Promise<number> {
  // Use industry standard ephemeral port range (49152-65535)
  const ephemeralStart = 49152;
  const ephemeralEnd = 65535;
  
  // Generate a random starting point to avoid always using the same ports
  const randomStart = ephemeralStart + Math.floor(Math.random() * 1000);
  
  for (let port = randomStart; port <= ephemeralEnd; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  // If we didn't find one from random start to end, try from beginning to random start
  for (let port = ephemeralStart; port < randomStart; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error(`No available ephemeral port found in range ${ephemeralStart}-${ephemeralEnd}`);
}

/**
 * Check if a specific port is available for use
 * @param port The port number to check
 * @returns Promise<boolean> true if port is available, false otherwise
 */
export async function isSpecificPortAvailable(port: number): Promise<boolean> {
  return isPortAvailable(port);
}

/**
 * Check if an existing dashboard is running on the specified port
 * @param port The port number to check
 * @returns Promise<boolean> true if a dashboard is running, false otherwise
 */
export async function checkExistingDashboard(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/api/test`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000) // 1 second timeout
    });
    
    if (response.ok) {
      const data = await response.json() as { message?: string };
      // Check if it's actually our dashboard
      return data.message === DASHBOARD_TEST_MESSAGE;
    }
    return false;
  } catch {
    // Connection failed or timeout - no dashboard running
    return false;
  }
}

/**
 * Validate a port number and check if it's available
 * @param port The port number to validate and check
 * @param skipDashboardCheck Optional flag to skip checking for existing dashboard
 * @returns Promise<void> throws error if invalid or unavailable
 */
export async function validateAndCheckPort(port: number, skipDashboardCheck: boolean = false): Promise<void> {
  // Validate port range first
  if (port < 1024 || port > 65535) {
    throw new Error(`Port ${port} is out of range. Port must be between 1024 and 65535.`);
  }
  
  // Check if it's our dashboard first (more efficient when dashboard exists)
  if (!skipDashboardCheck) {
    const isDashboard = await checkExistingDashboard(port);
    if (isDashboard) {
      // Let caller handle existing dashboard scenario
      throw new Error(`Port ${port} is already in use by an existing dashboard instance.`);
    }
  }
  
  // Only check general port availability if it's not our dashboard
  const available = await isSpecificPortAvailable(port);
  if (!available) {
    throw new Error(`Port ${port} is already in use. Please choose a different port or omit --port to use an ephemeral port.`);
  }
}