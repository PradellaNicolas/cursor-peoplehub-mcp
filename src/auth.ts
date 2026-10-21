import fs from 'fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
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

function cdpPort(cdpUrl: string): string {
  try {
    return new URL(cdpUrl).port || '9222';
  } catch {
    return '9222';
  }
}

function profileLockedMessage(detail: string): string {
  return (
    'El perfil Edge de PeopleHub está en uso (otra ventana sidecar abierta). ' +
    'Cerrá esa ventana de PeopleHub y volvé a ejecutar peoplehub_login. ' +
    `Detalle: ${detail}`
  );
}

function isPeopleHubTimeReport(url: string): boolean {
  return url.includes('/time-report') && !url.includes('/login');
}

async function waitForTimeReport(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isPeopleHubTimeReport(page.url())) {
      await page.waitForTimeout(1500);
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return isPeopleHubTimeReport(page.url());
}

export async function runInteractiveLogin(timeoutMs = 300_000): Promise<{ ok: boolean; message: string }> {
  const { baseUrl, storagePath, dataDir, cdpUrl, edgeProfileDir } = getConfig();
  ensureDataDir(dataDir);
  fs.mkdirSync(edgeProfileDir, { recursive: true });

  let browser: Browser | null = null;
  let persistent: BrowserContext | null = null;
  let mode: 'cdp' | 'persistent' = 'cdp';
  let closePersistent = false;

  try {
    try {
      browser = await chromium.connectOverCDP(cdpUrl);
      mode = 'cdp';
    } catch {
      try {
        persistent = await chromium.launchPersistentContext(edgeProfileDir, {
          channel: 'msedge',
          headless: false,
          args: [`--remote-debugging-port=${cdpPort(cdpUrl)}`],
        });
        mode = 'persistent';
      } catch (launchErr) {
        const detail = launchErr instanceof Error ? launchErr.message : String(launchErr);
        if (/lock|user data dir|already in use|Singleton/i.test(detail)) {
          return { ok: false, message: profileLockedMessage(detail) };
        }
        return {
          ok: false,
          message:
            'No se pudo abrir el Edge de PeopleHub (perfil aparte; no toca tu Edge cotidiano). ' +
            detail,
        };
      }
    }

    const context: BrowserContext | undefined =
      mode === 'cdp' ? browser?.contexts()[0] : (persistent ?? undefined);
    if (!context) {
      return {
        ok: false,
        message:
          'No hay contexto de Edge para PeopleHub. Volvé a ejecutar peoplehub_login (se abre una ventana de perfil aparte).',
      };
    }

    const pages = context.pages();
    const host = new URL(baseUrl).hostname;
    let page =
      pages.find((p) => p.url().includes(host)) ??
      pages.find((p) => isPeopleHubTimeReport(p.url())) ??
      pages[0] ??
      (await context.newPage());

    if (!isPeopleHubTimeReport(page.url())) {
      await page.goto(`${baseUrl}/time-report`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }

    const loggedIn = await waitForTimeReport(page, timeoutMs);
    if (!loggedIn) {
      return {
        ok: false,
        message:
          'La ventana Edge de PeopleHub está abierta. Completá Continuar con Microsoft (MFA si pide) hasta Time Report y volvé a ejecutar peoplehub_login. No hace falta cerrar tu Edge cotidiano.',
      };
    }

    const state = await context.storageState();
    const projectRef = findSupabaseProjectRef(state as StorageState);
    const anonKey = await extractAnonKeyFromPage(page);

    saveStorageState(state as StorageState, {
      supabaseProjectRef: projectRef,
      supabaseAnonKey: anonKey,
    });

    closePersistent = mode === 'persistent';
    const origin =
      mode === 'cdp'
        ? `Edge vía CDP (${cdpUrl})`
        : 'Edge de PeopleHub (perfil aparte)';
    return {
      ok: true,
      message: `Sesión copiada desde ${origin} a ${storagePath}.`,
    };
  } finally {
    if (mode === 'cdp') {
      browser?.disconnect();
    } else if (closePersistent) {
      await persistent?.close().catch(() => undefined);
    }
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
