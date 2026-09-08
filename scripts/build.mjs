import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version ?? '0.0.0-dev';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['playwright'],
  define: {
    'process.env.MCP_PEOPLEHUB_APP_VERSION': JSON.stringify(version),
  },
});

console.log(`Built mcp-peoplehub v${version}`);
