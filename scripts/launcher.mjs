#!/usr/bin/env node
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const installDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(installDir, '.env') });

const indexPath = path.join(installDir, 'dist', 'index.js');
const child = spawn(process.execPath, [indexPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: installDir,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  process.stderr.write(`[mcp-peoplehub:launcher] Failed to start: ${err.message}\n`);
  process.exit(1);
});
