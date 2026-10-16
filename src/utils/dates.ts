/** Monday (ISO week) for a given date in local calendar. */
export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new Error(`Fecha inválida: ${s}. Usá formato YYYY-MM-DD.`);
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function weekRangeForDate(d: Date): { dateFrom: string; dateTo: string } {
  const start = startOfWeekMonday(d);
  const end = addDays(start, 6);
  return { dateFrom: formatIsoDate(start), dateTo: formatIsoDate(end) };
}

export function monthRangeForDate(d: Date): { dateFrom: string; dateTo: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { dateFrom: formatIsoDate(start), dateTo: formatIsoDate(end) };
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}

export function isFutureDate(iso: string): boolean {
  const target = parseIsoDate(iso);
  const today = parseIsoDate(todayIso());
  return target.getTime() > today.getTime();
}

export interface ParsedActivity {
  actividad_id: number;
  subactividad_id: number;
  codigo: number;
}

/** Parse AST like "123027-1-1" or separate ids. */
export function parseActivity(
  activity?: string,
  actividad_id?: number,
  subactividad_id?: number,
  codigo?: number,
): ParsedActivity {
  if (activity?.trim()) {
    const parts = activity.trim().split('-').map((p) => p.trim());
    if (parts.length !== 3) {
      throw new Error(`Actividad inválida "${activity}". Usá formato AST: 123027-1-1`);
    }
    const [a, s, c] = parts.map((p) => Number.parseInt(p, 10));
    if (![a, s, c].every((n) => Number.isInteger(n))) {
      throw new Error(`Actividad inválida "${activity}". Los tres segmentos deben ser enteros.`);
    }
    return { actividad_id: a, subactividad_id: s, codigo: c };
  }
  if (
    actividad_id !== undefined &&
    subactividad_id !== undefined &&
    codigo !== undefined
  ) {
    if (![actividad_id, subactividad_id, codigo].every((n) => Number.isInteger(n))) {
      throw new Error('actividad_id, subactividad_id y codigo deben ser enteros.');
    }
    return { actividad_id, subactividad_id, codigo };
  }
  throw new Error('Indicá activity (ej. "123027-1-1") o actividad_id + subactividad_id + codigo.');
}

export function minutesFromHoursAndMinutes(hours: number, minutes: number): number {
  if (!Number.isInteger(hours) || hours < 0) {
    throw new Error('hours debe ser un entero >= 0.');
  }
  if (![0, 15, 30, 45].includes(minutes)) {
    throw new Error('minutes debe ser 0, 15, 30 o 45.');
  }
  const total = hours * 60 + minutes;
  if (total <= 0) {
    throw new Error('El tiempo total debe ser mayor a cero.');
  }
  return total;
}
