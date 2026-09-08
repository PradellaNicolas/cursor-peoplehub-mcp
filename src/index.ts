import { runStdioServer } from './server.js';
import { formatErrorForMcp } from './utils/errors.js';

async function main(): Promise<void> {
  try {
    await runStdioServer();
  } catch (err) {
    process.stderr.write(`[mcp-peoplehub] Fatal: ${formatErrorForMcp(err)}\n`);
    process.exit(1);
  }
}

void main();
