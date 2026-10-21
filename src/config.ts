import path from 'path';
import os from 'os';

const DEFAULT_BASE_URL = 'https://peoplehub.accusystechnology.com';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';

export interface PeopleHubConfig {
  baseUrl: string;
  dataDir: string;
  storagePath: string;
  metaPath: string;
  cdpUrl: string;
  edgeProfileDir: string;
}

export function getConfig(): PeopleHubConfig {
  const baseUrl = (process.env.PEOPLEHUB_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const dataDir = process.env.PEOPLEHUB_DATA_DIR ?? path.join(os.homedir(), '.peoplehub-mcp');
  const cdpUrl = (process.env.PEOPLEHUB_CDP_URL ?? DEFAULT_CDP_URL).replace(/\/$/, '');
  const edgeProfileDir = process.env.PEOPLEHUB_EDGE_PROFILE_DIR ?? path.join(dataDir, 'edge-profile');
  return {
    baseUrl,
    dataDir,
    storagePath: path.join(dataDir, 'storage.json'),
    metaPath: path.join(dataDir, 'meta.json'),
    cdpUrl,
    edgeProfileDir,
  };
}
