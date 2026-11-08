import { z, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(readonly status: number, readonly body: { code: string; message: string; issues?: { path: string; message: string }[] }) {
    super(body.message);
  }
}

export const notFound = (code: string, message: string) => new HttpError(404, { code, message });

/** Parses input with zod and raises a structured 400, matching the NestJS API (spec API-01). */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** CSV with spreadsheet formula neutralisation (spec REP-03). */
export function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/** Shared list contract: pagination, text search, sort/order over allow-listed fields (spec API-01). */
export const listQuery = <S extends readonly [string, ...string[]]>(sortFields: S) =>
  z.object({
    q: z.string().trim().max(100).optional(),
    discipline: z.string().max(60).optional(),
    status: z.string().max(60).optional(),
    sort: z.enum(sortFields).optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  });

export interface ListParams {
  q?: string; discipline?: string; status?: string; sort?: string; order: 'asc' | 'desc'; page: number; pageSize: number;
}

type AnyRow = Record<string, string | number | null>;

/** Filters, searches and sorts rows the way the SQL implementation does. */
export function filterAndSort<T extends AnyRow>(rows: T[], f: ListParams, searchKeys: string[], defaultSort: string): T[] {
  const needle = f.q?.toLowerCase();
  const out = rows.filter(r =>
    (!f.discipline || r.discipline === f.discipline) &&
    (!f.status || r.status === f.status) &&
    (!needle || searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(needle))));
  const key = f.sort ?? defaultSort;
  const dir = f.order === 'desc' ? -1 : 1;
  return out.sort((a, b) => {
    const x = a[key], y = b[key];
    if (x === null && y === null) return String(a.id).localeCompare(String(b.id));
    if (x === null) return 1; // blank cells always sort last
    if (y === null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { sensitivity: 'base' });
    return c !== 0 ? c * dir : String(a.id).localeCompare(String(b.id));
  });
}

export const paginate = <T>(rows: T[], f: Pick<ListParams, 'page' | 'pageSize'>) => rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize);

export const unique = (xs: (string | number | null)[]) => [...new Set(xs.filter((x): x is string => typeof x === 'string' && x !== ''))].sort();
