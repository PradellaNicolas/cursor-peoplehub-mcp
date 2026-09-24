import {
  getCookieHeader,
  hasStorageState,
  loadStorageState,
  refreshSupabaseSession,
  type StorageState,
} from './auth.js';
import { getConfig } from './config.js';
import { AuthRequiredError } from './utils/errors.js';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  duplicateId?: string;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorMessage(body: Record<string, unknown>, status: number): string {
  const err = body.error;
  if (typeof err === 'string' && err.trim()) {
    return err.trim();
  }
  return `Error HTTP ${status}`;
}

export class PeopleHubClient {
  private state: StorageState | null = null;

  private loadState(): StorageState {
    if (!this.state) {
      if (!hasStorageState()) {
        throw new AuthRequiredError();
      }
      this.state = loadStorageState();
    }
    return this.state;
  }

  private async request<T>(
    method: string,
    apiPath: string,
    body?: unknown,
    retried = false,
  ): Promise<ApiResult<T>> {
    const { baseUrl } = getConfig();
    const state = this.loadState();
    const url = apiPath.startsWith('http') ? apiPath : `${baseUrl}${apiPath}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Cookie: getCookieHeader(state, baseUrl),
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !retried) {
      const refreshed = await refreshSupabaseSession(state);
      if (refreshed) {
        this.state = refreshed;
        return this.request<T>(method, apiPath, body, true);
      }
      throw new AuthRequiredError();
    }

    const json = await parseJsonSafe(res);

    if (!res.ok) {
      const duplicateId =
        res.status === 409 && typeof json.id === 'string' ? json.id : undefined;
      return {
        ok: false,
        status: res.status,
        error: errorMessage(json, res.status),
        duplicateId,
      };
    }

    return { ok: true, status: res.status, data: json as T };
  }

  async get<T>(apiPath: string): Promise<ApiResult<T>> {
    return this.request<T>('GET', apiPath);
  }

  async post<T>(apiPath: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>('POST', apiPath, body);
  }

  async patch<T>(apiPath: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>('PATCH', apiPath, body);
  }

  async delete<T>(apiPath: string): Promise<ApiResult<T>> {
    return this.request<T>('DELETE', apiPath);
  }

  reloadStorage(): void {
    this.state = hasStorageState() ? loadStorageState() : null;
  }
}

export const client = new PeopleHubClient();

export interface TimeReportRow {
  id: string;
  work_date: string;
  minutos: number;
  horas?: string;
  actividad_id?: number | null;
  subactividad_id?: number | null;
  codigo?: number | null;
  cat_otros_conceptos_id?: number;
  cat_clientes_id?: number | null;
  descripcion?: string | null;
  grupo_id?: string | null;
  ticket_cau?: string | null;
  rework_id?: number | null;
  estado_sync?: string;
  has_pending_sync?: boolean;
}

export interface ListWeekResponse {
  data: TimeReportRow[];
  offset?: number;
  limit?: number;
}

export interface ActivityRow {
  ast: string;
  titulo: string;
  actividad_id: number;
}

export interface ConceptoRow {
  sql_server_id: number;
  descripcion: string;
  asociado: boolean;
  tipo_concepto_id: number;
  vigente: boolean;
  orden?: number;
  detalle?: string;
  ticket_cau?: boolean;
}

export interface GroupRow {
  sql_server_id: string;
  requiere_cau: boolean;
}

export interface LogHoursPayload {
  work_date: string;
  total_horas: number;
  actividad_id: number;
  subactividad_id: number;
  codigo: number;
  cat_otros_conceptos_id: number;
  grupo_id: string;
  rework_id: number;
  ticket_cau?: string;
}

export interface CreateTimeReportResponse {
  id: string;
}

export interface UpdateTimeReportResponse {
  id?: string;
}
