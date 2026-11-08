import { ilike, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

/** Shared list contract: pagination, text search, sort/order with allow-listed fields (spec API-01). */
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

export function searchClause(q: string | undefined, columns: PgColumn[]): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
  return or(...columns.map(c => ilike(c, pattern)));
}
