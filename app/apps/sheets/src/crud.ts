import { z, type ZodType } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import type { Service } from './service';
import type { Column, Row } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyRow = Record<string, any>;
export const issue = (path: string, message: string) => new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path, message }] });

export interface ResourceDef {
  /** Singular noun for messages: "shipment". */
  label: string;
  sheet: string;
  columns: readonly Column[];
  /** The column holding the record's id, and the prefix and width of ids made for new records. */
  idKey: string;
  idPrefix: string;
  idWidth: number;
  create: ZodType<Record<string, unknown>>;
  patch: ZodType<Record<string, unknown>>;
  searchKeys: string[];
  sortKeys: readonly [string, ...string[]];
  defaultSort: string;
  /** Query parameters that filter by equality, beyond `discipline` and `status`, and their facets. */
  filters?: string[];
  /** Query parameters that keep rows by a rule, such as `within=30` (due inside 30 days), run on the viewed row. */
  predicates?: Record<string, (row: AnyRow, value: string, ctx: { cutoff: string }) => boolean>;
  /** Statuses that count as open: `?active=true` keeps only these. */
  activeStatuses?: string[];
  csvHeader: string[];
  csvRow: (r: AnyRow) => unknown[];
  csvName: string;
  /** Derives fields and enforces rules across rows. `existing` is set on update. */
  prepare?: (row: AnyRow, ctx: { existing?: Row; rows: Row[]; svc: Service; projectId: string }) => AnyRow;
  /** Adds computed fields to a record read from the sheet. */
  view?: (row: AnyRow, ctx: { cutoff: string }) => AnyRow;
  /** Extra stamp columns kept up to date on write (default: updatedAt when the sheet has it). */
  stamp?: boolean;
}

/** One project-scoped register with list, read, create, update, delete and CSV, over a sheet. */
export class Resource {
  constructor(private readonly svc: Service, readonly def: ResourceDef) {}

  private get store() { return this.svc.store; }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }
  rows(projectId: string): Row[] { return this.svc.rows(this.def.sheet, this.def.columns as Column[], projectId); }

  private view(r: Row, cutoff: string): AnyRow {
    const { projectId: _p, ...rest } = r;
    return this.def.view ? this.def.view(rest, { cutoff }) : rest;
  }

  /** Filters, searches and sorts every record for a list or an export. */
  private select(projectId: string, raw: unknown) {
    const extra = this.def.filters ?? [];
    const rules = Object.keys(this.def.predicates ?? {});
    const shape = { ...listQuery(this.def.sortKeys).shape, active: z.enum(['true', 'false']).optional(), ...Object.fromEntries([...extra, ...rules].map(k => [k, z.string().max(80).optional()])) };
    const f = parse(z.object(shape), raw ?? {}) as ListParams & Record<string, string | undefined>;
    const cutoff = this.cutoff(projectId);
    const all = this.rows(projectId).map(r => this.view(r, cutoff));
    const kept = all.filter(r => extra.every(k => !f[k] || String(r[k] ?? '') === f[k]) && rules.every(k => !f[k] || this.def.predicates![k](r, f[k]!, { cutoff })) && (f.active !== 'true' || !this.def.activeStatuses || this.def.activeStatuses.includes(String(r.status))));
    return { f, all, extra, rows: filterAndSort(kept, f, this.def.searchKeys, this.def.defaultSort) };
  }

  list(projectId: string, raw: unknown) {
    const { f, all, extra, rows } = this.select(projectId, raw);
    return {
      items: paginate(rows, f), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: {
        disciplines: unique(all.map(r => (r.discipline as string | null) ?? null)), statuses: unique(all.map(r => (r.status as string | null) ?? null)),
        ...Object.fromEntries(extra.map(k => [k, unique(all.map(r => (r[k] as string | null) ?? null))])),
      },
    };
  }

  csv(projectId: string, raw: unknown) {
    const { rows } = this.select(projectId, raw);
    return { filename: this.def.csvName, csv: toCsv([this.def.csvHeader, ...rows.map(this.def.csvRow)]) };
  }

  get(projectId: string, id: string) {
    const r = this.rows(projectId).find(x => x.id === id || x[this.def.idKey] === id);
    if (!r) throw notFound('NOT_FOUND', `${this.def.label[0].toUpperCase()}${this.def.label.slice(1)} "${id}" was not found.`);
    return this.view(r, this.cutoff(projectId));
  }

  private nextId(rows: Row[]) {
    const max = rows.reduce((m, r) => Math.max(m, Number(String(r[this.def.idKey]).replace(/^\D+/, '')) || 0), 0);
    return `${this.def.idPrefix}-${String(max + 1).padStart(this.def.idWidth, '0')}`;
  }

  private stamp(): Row {
    return this.def.columns.some(c => c.key === 'updatedAt') ? { updatedAt: this.svc.clock().toISOString() } : {};
  }

  create(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(this.def.create, body) as Row;
    return this.store.withLock(() => {
      const rows = this.rows(projectId);
      const row = this.def.prepare ? this.def.prepare({ ...v }, { rows, svc: this.svc, projectId }) : { ...v };
      const full: Row = { projectId, [this.def.idKey]: this.nextId(rows), ...row, ...this.stamp(), ...(this.def.columns.some(c => c.key === 'createdBy') && { createdBy: actor.id }), ...(this.def.columns.some(c => c.key === 'createdAt') && { createdAt: this.svc.clock().toISOString() }) };
      this.store.appendRows(this.def.sheet, this.def.columns as Column[], [full]);
      return this.get(projectId, String(full[this.def.idKey]));
    });
  }

  update(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(this.def.patch, body) as Row;
    return this.store.withLock(() => {
      const rows = this.rows(projectId);
      const existing = rows.find(r => r[this.def.idKey] === id);
      if (!existing) throw notFound('NOT_FOUND', `${this.def.label[0].toUpperCase()}${this.def.label.slice(1)} "${id}" was not found.`);
      const merged = this.def.prepare ? this.def.prepare({ ...existing, ...patch }, { existing, rows, svc: this.svc, projectId }) : { ...patch };
      const changes: Row = {};
      for (const c of this.def.columns) if (c.key !== 'projectId' && c.key !== this.def.idKey && c.key in merged && merged[c.key] !== existing[c.key]) changes[c.key] = merged[c.key];
      this.store.updateRow(this.def.sheet, this.def.columns as Column[], this.def.idKey, id, { ...changes, ...this.stamp() }, { projectId });
      return this.get(projectId, id);
    });
  }

  remove(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(this.def.sheet, this.def.columns as Column[], this.def.idKey, id, { projectId })) throw notFound('NOT_FOUND', `${this.def.label[0].toUpperCase()}${this.def.label.slice(1)} "${id}" was not found.`);
    });
  }
}
