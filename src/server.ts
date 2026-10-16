import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAttendanceTools } from './tools/attendance.js';
import { registerPeopleHubTools } from './tools/time-report.js';

const APP_VERSION = process.env.MCP_PEOPLEHUB_APP_VERSION ?? '1.0.0';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'peoplehub',
    version: APP_VERSION,
  });

  registerPeopleHubTools(server);
  registerAttendanceTools(server);
  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
