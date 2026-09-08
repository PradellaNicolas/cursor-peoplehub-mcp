import fs from 'fs';
import { chromium, type BrowserContext } from 'playwright';
import { getConfig } from './config.js';

export interface StorageMeta {
  supabaseProjectRef?: string;
  supabaseAnonKey?: string;
  savedAt?: string;
}

export interface StorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

function ensureDataDir(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function hasStorageState(): boolean {
  const { storagePath } = getConfig();
  return fs.existsSync(storagePath);
}

export function loadStorageState(): StorageState {
  const { storagePath } = getConfig();
  if (!fs.existsSync(storagePath)) {
    throw new Error('No hay sesión guardada. Ejecutá peoplehub_login primero.');
  }
  return JSON.parse(fs.readFileSync(storagePath, 'utf8')) as StorageState;
}

export function saveStorageState(state: StorageState, meta?: Partial<StorageMeta>): void {
  const { storagePath, metaPath, dataDir } = getConfig();
  ensureDataDir(dataDir);
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2), 'utf8');

  const existing: StorageMeta = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as StorageMeta)
    : {};
  const merged: StorageMeta = {
    ...existing,
    ...meta,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(merged, null, 2), 'utf8');
}

export function loadMeta(): StorageMeta {
  const { metaPath } = getConfig();
  if (!fs.existsSync(metaPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as StorageMeta;
}

function cookiesForDomain(state: StorageState, baseUrl: string): string {
  const host = new URL(baseUrl).hostname;
  const relevant = state.cookies.filter(
    (c) => c.domain === host || c.domain === `.${host}` || host.endsWith(c.domain.replace(/^\./, '')),
  );
  return relevant.map((c) => `${c.name}=${c.value}`).join('; ');
}

export function getCookieHeader(state: StorageState, baseUrl: string): string {
  return cookiesForDomain(state, baseUrl);
}

function findSupabaseProjectRef(state: StorageState): string | undefined {
  for (const c of state.cookies) {
    const m = /^sb-([a-z0-9]+)-auth-token(?:\.\d+)?$/.exec(c.name);
    if (m) {
      return m[1];
    }
  }
  return undefined;
}

function decodeSupabaseSessionCookieValue(raw: string): string {
  if (raw.startsWith('base64-')) {
    return Buffer.from(raw.slice('base64-'.length), 'base64').toString('utf8');
  }
  return raw;
}

function parseSupabaseSessionFromCookies(state: StorageState, projectRef: string): Record<string, unknown> | null {
  const prefix = `sb-${projectRef}-auth-token`;
  const chunks = state.cookies
    .filter((c) => c.name === prefix || c.name.startsWith(`${prefix}.`))
    .sort((a, b) => {
      const ai = a.name === prefix ? 0 : Number.parseInt(a.name.split('.').pop() ?? '0', 10);
      const bi = b.name === prefix ? 0 : Number.parseInt(b.name.split('.').pop() ?? '0', 10);
      return ai - bi;
    })
    .map((c) => decodeSupabaseSessionCookieValue(c.value))
    .join('');

  if (!chunks) {
    return null;
  }
  try {
    return JSON.parse(chunks) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function extractAnonKeyFromPage(page: import('playwright').Page): Promise<string | undefined> {
  const html = await page.content();
  const patterns = [
    /NEXT_PUBLIC_SUPABASE_ANON_KEY['"]\s*:\s*['"]([^'"]+)['"]/,
    /supabaseAnonKey['"]\s*:\s*['"]([^'"]+)['"]/,
    /"anonKey"\s*:\s*"([^"]+)"/,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      return m[1];
    }
    if (m?.[0] && m[0].startsWith('eyJ')) {
      return m[0];
    }
  }
  return undefined;
}

export async function runInteractiveLogin(timeoutMs = 300_000): Promise<{ ok: boolean; message: string }> {
  const { baseUrl, storagePath, dataDir } = getConfig();
  ensureDataDir(dataDir);

  const browser = await chromium.launch({ headless: false });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/time-report`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes('/time-report') && !url.includes('/login')) {
        await page.waitForTimeout(1500);
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!page.url().includes('/time-report') || page.url().includes('/login')) {
      return {
        ok: false,
        message:
          'No se completó el login a tiempo. Abrí el navegador, iniciá sesión con Microsoft y volvé a ejecutar peoplehub_login.',
      };
    }

    const state = await context.storageState();
    const projectRef = findSupabaseProjectRef(state as StorageState);
    const anonKey = await extractAnonKeyFromPage(page);

    saveStorageState(state as StorageState, {
      supabaseProjectRef: projectRef,
      supabaseAnonKey: anonKey,
    });

    return {
      ok: true,
      message: `Sesión guardada en ${storagePath}. Ya podés usar peoplehub_list_week y peoplehub_log_hours.`,
    };
  } finally {
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export async function refreshSupabaseSession(state: StorageState): Promise<StorageState | null> {
  const meta = loadMeta();
  const projectRef = meta.supabaseProjectRef ?? findSupabaseProjectRef(state);
  if (!projectRef) {
    return null;
  }

  const session = parseSupabaseSessionFromCookies(state, projectRef);
  const refreshToken = session?.refresh_token;
  const anonKey = meta.supabaseAnonKey;
  if (typeof refreshToken !== 'string' || !refreshToken || typeof anonKey !== 'string' || !anonKey) {
    return null;
  }

  const tokenUrl = `https://${projectRef}.supabase.co/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: unknown;
  };

  if (!body.access_token) {
    return null;
  }

  const newSession = {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? refreshToken,
    expires_in: body.expires_in,
    expires_at: body.expires_at,
    token_type: body.token_type ?? 'bearer',
    user: body.user ?? session?.user,
  };

  const encoded = `base64-${Buffer.from(JSON.stringify(newSession), 'utf8').toString('base64')}`;
  const chunkSize = 3180;
  const host = new URL(getConfig().baseUrl).hostname;
  const prefix = `sb-${projectRef}-auth-token`;
  const otherCookies = state.cookies.filter(
    (c) => c.name !== prefix && !c.name.startsWith(`${prefix}.`),
  );

  const newAuthCookies: StorageState['cookies'] = [];
  if (encoded.length <= chunkSize) {
    const template = state.cookies.find((c) => c.name === prefix) ?? state.cookies.find((c) => c.name.startsWith(prefix));
    newAuthCookies.push({
      name: prefix,
      value: encoded,
      domain: template?.domain ?? host,
      path: template?.path ?? '/',
      expires: template?.expires ?? Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
      httpOnly: template?.httpOnly ?? false,
      secure: template?.secure ?? true,
      sameSite: template?.sameSite ?? 'Lax',
    });
  } else {
    let offset = 0;
    let idx = 0;
    while (offset < encoded.length) {
      const template =
        state.cookies.find((c) => c.name === `${prefix}.${idx}`) ??
        state.cookies.find((c) => c.name.startsWith(prefix));
      const chunk = encoded.slice(offset, offset + chunkSize);
      newAuthCookies.push({
        name: idx === 0 ? `${prefix}.0` : `${prefix}.${idx}`,
        value: chunk,
        domain: template?.domain ?? host,
        path: template?.path ?? '/',
        expires: template?.expires ?? Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
        httpOnly: template?.httpOnly ?? false,
        secure: template?.secure ?? true,
        sameSite: template?.sameSite ?? 'Lax',
      });
      offset += chunkSize;
      idx += 1;
    }
  }

  const updated: StorageState = {
    ...state,
    cookies: [...otherCookies, ...newAuthCookies],
  };
  saveStorageState(updated, { supabaseProjectRef: projectRef, supabaseAnonKey: anonKey });
  return updated;
}
