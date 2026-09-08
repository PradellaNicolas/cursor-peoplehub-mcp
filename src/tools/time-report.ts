import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  hasStorageState,
  runInteractiveLogin,
} from '../auth.js';
import {
  client,
  type ActivityRow,
  type ConceptoRow,
  type CreateTimeReportResponse,
  type GroupRow,
  type ListWeekResponse,
} from '../client.js';
import {
  isFutureDate,
  minutesFromHoursAndMinutes,
  parseActivity,
  parseIsoDate,
  weekRangeForDate,
} from '../utils/dates.js';
import { AuthRequiredError, formatErrorForMcp } from '../utils/errors.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function jsonResult(obj: unknown) {
  return textResult(JSON.stringify(obj, null, 2));
}

const MAX_MINUTES_PER_DAY = 24 * 60;

async function resolveDefaultGrupoId(): Promise<string | undefined> {
  const res = await client.get<{ data: GroupRow[] }>('/api/time-report/groups');
  if (!res.ok || !res.data?.data?.length) {
    return undefined;
  }
  if (res.data.data.length === 1) {
    return res.data.data[0].sql_server_id;
  }
  return undefined;
}

async function resolveDefaultConceptoId(): Promise<number | undefined> {
  const res = await client.get<{ data: ConceptoRow[] }>('/api/time-report/conceptos');
  if (!res.ok || !res.data?.data) {
    return undefined;
  }
  const horasCal = res.data.data.find(
    (c) => c.asociado && c.descripcion.toLowerCase().includes('horas calendario'),
  );
  return horasCal?.sql_server_id ?? res.data.data.find((c) => c.asociado)?.sql_server_id;
}

async function minutesAlreadyLoggedOnDate(workDate: string): Promise<number> {
  const range = weekRangeForDate(parseIsoDate(workDate));
  const qs = new URLSearchParams({
    date_from: range.dateFrom,
    date_to: range.dateTo,
    limit: '200',
  });
  const res = await client.get<ListWeekResponse>(`/api/time-report?${qs}`);
  if (!res.ok || !res.data?.data) {
    return 0;
  }
  return res.data.data
    .filter((r) => r.work_date === workDate)
    .reduce((sum, r) => sum + (typeof r.minutos === 'number' ? r.minutos : 0), 0);
}

export function registerPeopleHubTools(server: McpServer): void {
  server.tool(
    'peoplehub_login',
    'Abre Chromium para iniciar sesión con Microsoft SSO en PeopleHub y guarda la sesión localmente (~/.peoplehub-mcp/storage.json). Ejecutar una vez por usuario o cuando expire la sesión.',
    {
      timeout_seconds: z
        .number()
        .int()
        .positive()
        .max(600)
        .optional()
        .default(300)
        .describe('Segundos máximos para completar el login en el navegador'),
    },
    async ({ timeout_seconds }) => {
      try {
        const result = await runInteractiveLogin(timeout_seconds * 1000);
        client.reloadStorage();
        return textResult(result.message);
      } catch (err) {
        return textResult(`Error en login: ${formatErrorForMcp(err)}`);
      }
    },
  );

  server.tool(
    'peoplehub_session',
    'Verifica si hay sesión guardada y consulta /api/auth/session-check y /api/auth/user (sin datos sensibles).',
    {},
    async () => {
      try {
        if (!hasStorageState()) {
          return jsonResult({
            authenticated: false,
            message: 'No hay storage.json. Ejecutá peoplehub_login.',
          });
        }

        const session = await client.get<Record<string, unknown>>('/api/auth/session-check');
        const user = await client.get<Record<string, unknown>>('/api/auth/user');

        const safeUser: Record<string, unknown> = {};
        if (user.ok && user.data) {
          for (const [k, v] of Object.entries(user.data)) {
            if (/email|token|phone|password|avatar|picture|oid|sub/i.test(k)) {
              safeUser[k] = typeof v === 'string' ? '[redacted]' : '[redacted]';
            } else {
              safeUser[k] = v;
            }
          }
        }

        return jsonResult({
          authenticated: session.ok,
          session_status: session.status,
          session: session.data,
          user: safeUser,
        });
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          return jsonResult({ authenticated: false, message: err.message });
        }
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_list_week',
    'Lista cargas de horas de una semana (lunes a domingo). Por defecto la semana de reference_date o hoy.',
    {
      reference_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Fecha de referencia YYYY-MM-DD (default: hoy)'),
    },
    async ({ reference_date }) => {
      try {
        const ref = reference_date ? parseIsoDate(reference_date) : new Date();
        const { dateFrom, dateTo } = weekRangeForDate(ref);
        const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: '200' });
        const res = await client.get<ListWeekResponse>(`/api/time-report?${qs}`);
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }
        const rows = res.data?.data ?? [];
        const totalMinutes = rows.reduce((s, r) => s + (r.minutos ?? 0), 0);
        return jsonResult({
          date_from: dateFrom,
          date_to: dateTo,
          count: rows.length,
          total_minutes: totalMinutes,
          total_hours_label: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
          data: rows,
        });
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_list_activities',
    'Catálogo de actividades imputables para el rango de semana.',
    {
      reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    async ({ reference_date }) => {
      try {
        const ref = reference_date ? parseIsoDate(reference_date) : new Date();
        const { dateFrom, dateTo } = weekRangeForDate(ref);
        const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
        const res = await client.get<{ data: ActivityRow[]; date_from: string; date_to: string }>(
          `/api/time-report/activities?${qs}`,
        );
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }
        return jsonResult(res.data);
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_list_conceptos',
    'Lista conceptos asociados (pestaña Actividades).',
    {},
    async () => {
      try {
        const res = await client.get<{ data: ConceptoRow[] }>('/api/time-report/conceptos');
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }
        return jsonResult(res.data);
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_list_groups',
    'Lista grupos disponibles para el usuario.',
    {},
    async () => {
      try {
        const res = await client.get<{ data: GroupRow[] }>('/api/time-report/groups');
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }
        return jsonResult(res.data);
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_list_reworks',
    'Lista reworks/bugs para una actividad (actividad_id = primer segmento del AST).',
    {
      actividad_id: z.number().int().positive().describe('ID de actividad (ej. 123027)'),
    },
    async ({ actividad_id }) => {
      try {
        const qs = new URLSearchParams({ actividad_id: String(actividad_id) });
        const res = await client.get<{ items?: unknown[] }>(`/api/time-report/reworks?${qs}`);
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }
        return jsonResult(res.data);
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );

  server.tool(
    'peoplehub_log_hours',
    'Registra horas en PeopleHub (POST /api/time-report). Requiere confirm=true. total_horas en API = minutos.',
    {
      work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Fecha YYYY-MM-DD (hoy o pasado)'),
      hours: z.number().int().min(0).describe('Horas enteras'),
      minutes: z
        .number()
        .int()
        .refine((m) => [0, 15, 30, 45].includes(m), 'minutes debe ser 0, 15, 30 o 45'),
      activity: z
        .string()
        .optional()
        .describe('AST actividad-proyecto-código, ej. 123027-1-1'),
      actividad_id: z.number().int().positive().optional(),
      subactividad_id: z.number().int().positive().optional(),
      codigo: z.number().int().positive().optional(),
      concepto_id: z.number().int().positive().optional().describe('cat_otros_conceptos_id'),
      grupo_id: z.string().min(1).optional(),
      rework_id: z.number().int().min(0).optional().default(0),
      ticket_cau: z.string().optional(),
      confirm: z
        .boolean()
        .describe('Debe ser true para ejecutar el POST (dato laboral)'),
    },
    async (args) => {
      try {
        if (!args.confirm) {
          return textResult(
            'Operación cancelada: confirm debe ser true para registrar horas en PeopleHub.',
          );
        }

        if (isFutureDate(args.work_date)) {
          return textResult('No se pueden cargar horas en fechas futuras.');
        }

        const totalMinutes = minutesFromHoursAndMinutes(args.hours, args.minutes);
        const parsed = parseActivity(
          args.activity,
          args.actividad_id,
          args.subactividad_id,
          args.codigo,
        );

        const conceptoId = args.concepto_id ?? (await resolveDefaultConceptoId());
        if (!conceptoId) {
          return textResult('concepto_id requerido (no se pudo inferir Horas Calendario).');
        }

        const grupoId = args.grupo_id ?? (await resolveDefaultGrupoId());
        if (!grupoId?.trim()) {
          return textResult('grupo_id requerido (tenés más de un grupo o ninguno en catálogo).');
        }

        const already = await minutesAlreadyLoggedOnDate(args.work_date);
        if (already + totalMinutes > MAX_MINUTES_PER_DAY) {
          return textResult(
            `Supera el tope de 24h/día: ya hay ${already} min en ${args.work_date}; intentás agregar ${totalMinutes} min.`,
          );
        }

        const payload = {
          work_date: args.work_date,
          total_horas: totalMinutes,
          actividad_id: parsed.actividad_id,
          subactividad_id: parsed.subactividad_id,
          codigo: parsed.codigo,
          cat_otros_conceptos_id: conceptoId,
          grupo_id: grupoId.trim(),
          rework_id: args.rework_id ?? 0,
          ...(args.ticket_cau?.trim() ? { ticket_cau: args.ticket_cau.trim() } : {}),
        };

        const res = await client.post<CreateTimeReportResponse>('/api/time-report', payload);
        if (!res.ok) {
          const dup = res.duplicateId ? ` (id existente: ${res.duplicateId})` : '';
          return textResult(`No se guardó: ${res.error}${dup}`);
        }

        return jsonResult({
          ok: true,
          status: res.status,
          id: res.data?.id,
          payload,
        });
      } catch (err) {
        return textResult(formatErrorForMcp(err));
      }
    },
  );
}
