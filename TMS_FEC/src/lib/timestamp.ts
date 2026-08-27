/** Normalize API timestamps (ms) — PostgreSQL BIGINT arrives as numeric strings. */
export function parseTimestamp(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function toDate(value: unknown): Date | null {
  const ts = parseTimestamp(value);
  if (ts == null) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isTaskOverdue(dueAt: unknown, status: string): boolean {
  const ts = parseTimestamp(dueAt);
  return ts != null && ts < Date.now() && !['DONE', 'CANCELLED', 'REJECTED'].includes(status);
}

export function isDueInWindow(dueAt: unknown, startMs: number, endMs: number): boolean {
  const ts = parseTimestamp(dueAt);
  return ts != null && ts >= startMs && ts <= endMs;
}
