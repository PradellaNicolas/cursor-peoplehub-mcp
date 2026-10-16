import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { monthRangeForDate, parseIsoDate } from '../utils/dates.js';
import { AuthRequiredError, formatErrorForMcp } from '../utils/errors.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function jsonResult(obj: unknown) {
  return textResult(JSON.stringify(obj, null, 2));
}

interface AttendanceDayRaw {
  date: string;
  weekday: number;
  booking_id?: string | null;
  floor_name?: string | null;
  site_name?: string | null;
  parking?: { vehicle_type?: string | null } | null;
  blocked_reason?: string | null;
  available_spots?: number | null;
  state?: string | null;
}

interface AttendanceMeResponse {
  quota?: {
    min_days_per_week?: number;
    max_days_per_week?: number;
    parking_days_per_week?: number | null;
    booking_window_days?: number;
    allow_weekend?: boolean;
  };
  pattern?: Array<{
    weekday: number;
    wants_parking?: boolean;
    vehicle_type?: string | null;
  }>;
  pattern_missing?: boolean;
  exemption?: unknown;
  range?: {
    from: string;
    to: string;
    days?: AttendanceDayRaw[];
  };
}

function sanitizeDay(d: AttendanceDayRaw) {
  const parking = d.parking
    ? { booked: true, vehicle_type: d.parking.vehicle_type ?? null }
    : null;
  return {
    date: d.date,
    weekday: d.weekday,
    state: d.state ?? null,
    office: Boolean(d.booking_id),
    site_name: d.site_name ?? null,
    floor_name: d.floor_name ?? null,
    parking,
    blocked_reason: d.blocked_reason ?? null,
    available_spots: d.available_spots ?? null,
  };
}

export function registerAttendanceTools(server: McpServer): void {
  server.tool(
    'peoplehub_list_calendar',
    'Lista “Mi calendario” de asistencia (GET /api/attendance/me). No es Time Report / declaración de horas.',
    {
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Inicio YYYY-MM-DD (inclusive). Si se omite junto con to, se usa el mes de reference_date o el mes actual.'),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Fin YYYY-MM-DD (inclusive). Requiere from.'),
      reference_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Si no hay from/to, mes calendario que contiene esta fecha (default: hoy).'),
    },
    async ({ from, to, reference_date }) => {
      try {
        let dateFrom: string;
        let dateTo: string;
        if (from || to) {
          if (!from || !to) {
            return textResult('Indicá from y to juntos (YYYY-MM-DD), o solo reference_date para el mes.');
          }
          dateFrom = from;
          dateTo = to;
        } else {
          const ref = reference_date ? parseIsoDate(reference_date) : new Date();
          const range = monthRangeForDate(ref);
          dateFrom = range.dateFrom;
          dateTo = range.dateTo;
        }

        const qs = new URLSearchParams({ from: dateFrom, to: dateTo });
        const res = await client.get<AttendanceMeResponse>(`/api/attendance/me?${qs}`);
        if (!res.ok) {
          return textResult(`Error: ${res.error}`);
        }

        const data = res.data;
        const days = (data?.range?.days ?? []).map(sanitizeDay);
        const office_days = days.filter((d) => d.office).length;

        return jsonResult({
          source: 'GET /api/attendance/me',
          from: data?.range?.from ?? dateFrom,
          to: data?.range?.to ?? dateTo,
          quota: data?.quota
            ? {
                min_days_per_week: data.quota.min_days_per_week,
                max_days_per_week: data.quota.max_days_per_week,
                parking_days_per_week: data.quota.parking_days_per_week ?? null,
                booking_window_days: data.quota.booking_window_days,
                allow_weekend: data.quota.allow_weekend,
              }
            : null,
          pattern: (data?.pattern ?? []).map((p) => ({
            weekday: p.weekday,
            wants_parking: p.wants_parking ?? false,
            vehicle_type: p.vehicle_type ?? null,
          })),
          pattern_missing: data?.pattern_missing ?? false,
          exemption: data?.exemption ?? null,
          office_days,
          days,
        });
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          return jsonResult({ authenticated: false, message: err.message });
        }
        return textResult(formatErrorForMcp(err));
      }
    },
  );
}
