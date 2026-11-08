import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { searchClause } from '../common/list-query';
import { DbService } from '../db/db.service';
import { expeditingPackages as t } from '../db/schema';

export interface ExpeditingFilter {
  q?: string;
  discipline?: string;
  status?: string;
  sort?: 'code' | 'discipline' | 'vendor' | 'status' | 'actualPct' | 'variance';
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const sortColumns = { code: t.code, discipline: t.discipline, vendor: t.vendor, status: t.status, actualPct: t.actualPct, variance: t.variance };

/** Flattens the discipline-specific details into the package so clients get one shape. */
type ExpeditingPackage = Omit<typeof t.$inferSelect, 'projectId' | 'details'> & Record<string, unknown>;
const flatten = ({ projectId: _p, details, ...rest }: typeof t.$inferSelect): ExpeditingPackage => ({ ...(details as Record<string, unknown>), ...rest });

@Injectable()
export class ExpeditingService {
  constructor(private readonly dbs: DbService) {}

  private where(projectId: string, f: Pick<ExpeditingFilter, 'q' | 'discipline' | 'status'>) {
    return and(
      eq(t.projectId, projectId),
      f.discipline ? eq(t.discipline, f.discipline) : undefined,
      f.status ? eq(t.status, f.status) : undefined,
      searchClause(f.q, [t.code, t.name, t.vendor]),
    );
  }

  private orderBy(f: ExpeditingFilter) {
    const col = sortColumns[f.sort ?? 'code'];
    return [f.order === 'desc' ? desc(col) : asc(col), asc(t.id)];
  }

  async list(projectId: string, f: ExpeditingFilter) {
    const where = this.where(projectId, f);
    const [{ total }] = await this.dbs.db.select({ total: sql<number>`count(*)::int` }).from(t).where(where);
    const rows = await this.dbs.db.select().from(t).where(where).orderBy(...this.orderBy(f)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
    return { items: rows.map(flatten), total, page: f.page, pageSize: f.pageSize, facets: await this.facets(projectId) };
  }

  async all(projectId: string, f: ExpeditingFilter) {
    const rows = await this.dbs.db.select().from(t).where(this.where(projectId, f)).orderBy(...this.orderBy(f));
    return rows.map(flatten);
  }

  async get(projectId: string, id: string) {
    const [row] = await this.dbs.db.select().from(t).where(and(eq(t.projectId, projectId), eq(t.id, id)));
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: `Expediting package "${id}" was not found.` });
    return flatten(row);
  }

  private async facets(projectId: string) {
    const rows = await this.dbs.db.select({ discipline: t.discipline, status: t.status }).from(t).where(eq(t.projectId, projectId));
    const uniq = (xs: string[]) => [...new Set(xs)].sort();
    return { disciplines: uniq(rows.map(r => r.discipline)), statuses: uniq(rows.map(r => r.status)) };
  }

  async summary(projectId: string) {
    const rows = await this.dbs.db.select().from(t).where(eq(t.projectId, projectId));
    const delayed = rows.filter(r => r.status === 'Delay').length;
    const atRisk = rows.filter(r => /At Risk/i.test(r.status)).length;
    const flags = rows
      .filter(r => /Delay|At Risk/i.test(r.status))
      .map(flatten)
      .filter(r => r.highlight && r.highlight !== 'No')
      .map(r => ({ id: r.id, code: r.code, name: r.name, vendor: r.vendor, status: r.status, discipline: r.discipline }));
    return { total: rows.length, delayed, atRisk, normal: rows.filter(r => r.status === 'Normal').length, flags };
  }
}
