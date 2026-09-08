import path from 'path';
import os from 'os';

const DEFAULT_BASE_URL = 'https://peoplehub.accusystechnology.com';

export interface PeopleHubConfig {
  baseUrl: string;
  dataDir: string;
  storagePath: string;
  metaPath: string;
}

export function getConfig(): PeopleHubConfig {
  const baseUrl = (process.env.PEOPLEHUB_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const dataDir = process.env.PEOPLEHUB_DATA_DIR ?? path.join(os.homedir(), '.peoplehub-mcp');
  return {
    baseUrl,
    dataDir,
    storagePath: path.join(dataDir, 'storage.json'),
    metaPath: path.join(dataDir, 'meta.json'),
  };
}
