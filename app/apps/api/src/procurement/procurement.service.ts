import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { searchClause } from '../common/list-query';
import { DbService } from '../db/db.service';
import { procurementPackages as t } from '../db/schema';

export interface ProcurementFilter {
  q?: string;
  discipline?: string;
  status?: string;
  sort?: 'code' | 'discipline' | 'vendor' | 'status' | 'poDate' | 'loaDate';
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const sortColumns = { code: t.code, discipline: t.discipline, vendor: t.vendor, status: t.status, poDate: t.poDate, loaDate: t.loaDate };
const strip = <T extends { projectId: string }>({ projectId: _p, ...rest }: T) => rest;

@Injectable()
export class ProcurementService {
  constructor(private readonly dbs: DbService) {}

  private where(projectId: string, f: Pick<ProcurementFilter, 'q' | 'discipline' | 'status'>) {
    return and(
      eq(t.projectId, projectId),
      f.discipline ? eq(t.discipline, f.discipline) : undefined,
      f.status ? eq(t.status, f.status) : undefined,
      searchClause(f.q, [t.code, t.description, t.vendor, t.buyer]),
    );
  }

  private orderBy(f: ProcurementFilter) {
    const col = sortColumns[f.sort ?? 'code'];
    return [f.order === 'desc' ? desc(col) : asc(col), asc(t.id)];
  }

  async list(projectId: string, f: ProcurementFilter) {
    const where = this.where(projectId, f);
    const [{ total }] = await this.dbs.db.select({ total: sql<number>`count(*)::int` }).from(t).where(where);
    const rows = await this.dbs.db.select().from(t).where(where).orderBy(...this.orderBy(f)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
    return { items: rows.map(strip), total, page: f.page, pageSize: f.pageSize, facets: await this.facets(projectId) };
  }

  async all(projectId: string, f: ProcurementFilter) {
    const rows = await this.dbs.db.select().from(t).where(this.where(projectId, f)).orderBy(...this.orderBy(f));
    return rows.map(strip);
  }

  async get(projectId: string, id: string) {
    const [row] = await this.dbs.db.select().from(t).where(and(eq(t.projectId, projectId), eq(t.id, id)));
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: `Procurement package "${id}" was not found.` });
    return strip(row);
  }

  private async facets(projectId: string) {
    const rows = await this.dbs.db.select({ discipline: t.discipline, status: t.status }).from(t).where(eq(t.projectId, projectId));
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return { disciplines: uniq(rows.map(r => r.discipline)), statuses: uniq(rows.map(r => r.status)) };
  }

  async summary(projectId: string) {
    const rows = await this.dbs.db.select({ discipline: t.discipline, status: t.status }).from(t).where(eq(t.projectId, projectId));
    const count = (key: 'discipline' | 'status') => rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r[key] ?? 'Unassigned']: (a[r[key] ?? 'Unassigned'] ?? 0) + 1 }), {});
    return { total: rows.length, byStatus: count('status'), byDiscipline: count('discipline') };
  }
}
