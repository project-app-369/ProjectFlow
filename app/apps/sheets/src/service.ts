import { z } from 'zod';
import {
  MANIFESTS, MANIFEST_BY_KEY, WORKSPACES, allowsWrites, defaultState, isEffective, validateStateChange,
  type ModuleManifest, type OperationState, type StateMap,
} from '../../api/src/registry/catalog';
import { overallProgress } from '../../api/src/schedule/progress';
import type { Actor } from './auth';
import { COLUMNS, SHEET, moduleSheet, pathOf, tabColorOf } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import type { Row, SheetInfo, Store } from './store';

const procurementQuery = listQuery(['code', 'discipline', 'vendor', 'status', 'poDate', 'loaDate'] as const);
const expeditingQuery = listQuery(['code', 'discipline', 'vendor', 'status', 'actualPct', 'variance'] as const);

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const moduleChange = z.object({ state: z.string(), reason: z.string().max(500).optional() });

/** Same fields the NestJS API returns for a module, plus where its data lives in the spreadsheet. */
export interface ModuleView extends ModuleManifest {
  state: OperationState;
  effective: boolean;
  /** Link to the module's sheet once generated. */
  sheet: SheetInfo | null;
  /** True when the module has (or can be given) a sheet of its own. */
  sheetCapable: boolean;
}

const drop = (row: Row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));

export class Service {
  constructor(readonly store: Store, readonly clock: () => Date = () => new Date()) {}

  /** Rows of a project-scoped sheet for one project. */
  rows(sheet: string, columns: Parameters<Store['readRows']>[1], projectId: string): Row[] {
    return this.store.readRows(sheet, columns).filter(r => r.projectId === projectId);
  }

  /* ---------- projects (read) ---------- */
  projectRows() {
    return this.store.readRows(SHEET.projects, COLUMNS.projects);
  }

  project(id: string) {
    const p = this.projectRows().find(x => x.id === id);
    if (!p) throw notFound('PROJECT_NOT_FOUND', `Project "${id}" was not found.`);
    return p;
  }

  /* ---------- module registry ---------- */
  states(projectId: string): StateMap {
    this.project(projectId);
    const stored = new Map(this.rows(SHEET.modules, COLUMNS.modules, projectId).map(r => [String(r.moduleKey), String(r.state) as OperationState]));
    return Object.fromEntries(MANIFESTS.map(m => [m.key, stored.get(m.key) ?? defaultState(m)]));
  }

  modules(projectId: string): ModuleView[] {
    const states = this.states(projectId);
    return MANIFESTS.map(m => {
      const target = moduleSheet(m.key, MANIFESTS);
      return { ...m, state: states[m.key], effective: isEffective(m.key, states), sheet: target ? this.store.sheetInfo(target.sheet) : null, sheetCapable: !!target };
    });
  }

  catalog() {
    return { workspaces: WORKSPACES, modules: MANIFESTS };
  }

  /** Creates the sheet behind a module when it has none yet. */
  generateSheet(key: string): { sheet: SheetInfo; created: boolean } {
    const target = moduleSheet(key, MANIFESTS);
    if (!target) throw new HttpError(409, { code: 'NO_SHEET', message: 'This module does not keep a register of its own.' });
    const existed = !!this.store.sheetInfo(target.sheet);
    return { sheet: this.store.ensureSheet(target.sheet, target.columns, tabColorOf(target.sheet)), created: !existed };
  }

  changeModule(projectId: string, key: string, body: unknown, actor: Actor) {
    const { state, reason } = parse(moduleChange, body);
    return this.store.withLock(() => {
      const states = this.states(projectId);
      const error = validateStateChange(key, state, states);
      if (error) throw new HttpError(409, error);
      const from = states[key];
      const now = this.clock().toISOString();
      if (from !== state) {
        const patch: Row = { state, updatedAt: now };
        if (!this.store.updateRow(SHEET.modules, COLUMNS.modules, 'moduleKey', key, patch, { projectId })) {
          this.store.appendRows(SHEET.modules, COLUMNS.modules, [{ projectId, moduleKey: key, path: pathOf(key).join(' / '), ...patch }]);
        }
        this.store.appendRows(SHEET.moduleChanges, COLUMNS.moduleChanges, [{ projectId, id: this.store.newId(), at: now, moduleKey: key, fromState: from, toState: state, reason: reason ?? null, actor: actor.id }]);
      }
      // Establishing a module generates the sheet(s) behind it, so each enabled leaf has a link.
      const created: SheetInfo[] = [];
      const after = this.states(projectId);
      for (const m of MANIFESTS) {
        const inSubtree = m.key === key || this.isDescendant(m.key, key);
        if (!inSubtree || !isEffective(m.key, after)) continue;
        const target = moduleSheet(m.key, MANIFESTS);
        if (target && !this.store.sheetInfo(target.sheet)) created.push(this.store.ensureSheet(target.sheet, target.columns, tabColorOf(target.sheet)));
      }
      const module = this.modules(projectId).find(m => m.key === key)!;
      return { ...module, sheetsCreated: created };
    });
  }

  private isDescendant(key: string, ancestor: string) {
    for (let m = MANIFEST_BY_KEY.get(key)?.parent; m; m = MANIFEST_BY_KEY.get(m)?.parent) if (m === ancestor) return true;
    return false;
  }

  moduleChanges(projectId: string) {
    this.project(projectId);
    return this.rows(SHEET.moduleChanges, COLUMNS.moduleChanges, projectId).reverse().slice(0, 100);
  }

  /** Disabled modules reject access; locked or read-only modules reject writes (spec MOD-04, MOD-08). */
  assertAccess(projectId: string, key: string, write: boolean) {
    const states = this.states(projectId);
    if (!isEffective(key, states)) throw new HttpError(403, { code: 'MODULE_DISABLED', message: `Module "${key}" is not enabled for this project.` });
    if (write && !allowsWrites(states[key])) throw new HttpError(403, { code: 'MODULE_READ_ONLY', message: `Module "${key}" is ${states[key]} and does not accept changes.` });
  }

  /** Rows of the module's sheet for one project, for modules without a dedicated screen yet. */
  records(projectId: string, key: string) {
    const target = moduleSheet(key, MANIFESTS);
    if (!target) throw new HttpError(409, { code: 'NO_SHEET', message: 'This module does not keep a register of its own.' });
    const scoped = target.columns.some(c => c.key === 'projectId');
    const items = this.store.readRows(target.sheet, target.columns).filter(r => !scoped || r.projectId === projectId);
    return { sheet: this.store.sheetInfo(target.sheet), columns: target.columns.map(c => c.key).filter(k => k !== 'projectId'), items };
  }

  /* ---------- schedule ---------- */
  workPackages(projectId: string) {
    const items = this.rows(SHEET.workPackages, COLUMNS.workPackages, projectId).sort((a, b) => String(a.code).localeCompare(String(b.code))).map(({ projectId: _p, ...w }) => w);
    const nums = items.map(w => ({
      weight: w.weight as number | null, lastWeekPlan: w.lastWeekPlan as number | null, lastWeekActual: w.lastWeekActual as number | null,
      thisWeekPlan: w.thisWeekPlan as number | null, thisWeekActual: w.thisWeekActual as number | null,
    }));
    return { items, overall: overallProgress(nums) };
  }

  overall(projectId: string) {
    const scurve = this.rows(SHEET.scurve, COLUMNS.scurve, projectId).map(({ projectId: _p, ...p }) => p).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const latest = [...scurve].reverse().find(p => p.actual !== null) ?? null;
    const wps = this.workPackages(projectId);
    return { scurve, latest, thisWeek: { plan: wps.overall.thisWeekPlan, actual: wps.overall.thisWeekActual }, workPackageCount: wps.items.length };
  }

  /* ---------- procurement ---------- */
  private procurementRows(projectId: string) {
    return this.rows(SHEET.procurement, COLUMNS.procurement, projectId);
  }

  procurementList(projectId: string, raw: unknown) {
    const f: ListParams = parse(procurementQuery, raw);
    const all = this.procurementRows(projectId);
    const rows = filterAndSort(all, f, ['code', 'description', 'vendor', 'buyer'], 'code');
    return {
      items: paginate(rows, f).map(({ projectId: _p, ...r }) => r), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(all.map(r => r.discipline)), statuses: unique(all.map(r => r.status)) },
    };
  }

  procurementCsv(projectId: string, raw: unknown) {
    const rows = filterAndSort(this.procurementRows(projectId), parse(procurementQuery, raw), ['code', 'description', 'vendor', 'buyer'], 'code');
    return {
      filename: 'procurement-packages.csv',
      csv: toCsv([
        ['Code', 'Discipline', 'Description', 'Vendor', 'LOA No', 'LOA Date', 'PO No', 'PO Date', 'Buyer', 'Expeditor', 'Status'],
        ...rows.map(p => [p.code, p.discipline, p.description, p.vendor, p.loaNo, p.loaDate, p.poNo, p.poDate, p.buyer, p.expeditor, p.status]),
      ]),
    };
  }

  procurementGet(projectId: string, id: string) {
    const row = this.procurementRows(projectId).find(r => r.id === id);
    if (!row) throw notFound('NOT_FOUND', `Procurement package "${id}" was not found.`);
    const { projectId: _p, ...rest } = row;
    return rest;
  }

  procurementSummary(projectId: string) {
    const rows = this.procurementRows(projectId);
    const count = (key: 'discipline' | 'status') => rows.reduce<Record<string, number>>((a, r) => { const k = String(r[key] ?? 'Unassigned'); a[k] = (a[k] ?? 0) + 1; return a; }, {});
    return { total: rows.length, byStatus: count('status'), byDiscipline: count('discipline') };
  }

  /* ---------- expediting ---------- */
  private expeditingRows(projectId: string) {
    return this.rows(SHEET.expediting, COLUMNS.expediting, projectId);
  }

  expeditingList(projectId: string, raw: unknown) {
    const f: ListParams = parse(expeditingQuery, raw);
    const all = this.expeditingRows(projectId);
    const rows = filterAndSort(all, f, ['code', 'name', 'vendor'], 'code');
    return {
      items: paginate(rows, f).map(({ projectId: _p, ...r }) => drop(r)), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(all.map(r => r.discipline)), statuses: unique(all.map(r => r.status)) },
    };
  }

  expeditingCsv(projectId: string, raw: unknown) {
    const rows = filterAndSort(this.expeditingRows(projectId), parse(expeditingQuery, raw), ['code', 'name', 'vendor'], 'code');
    return {
      filename: 'expediting-packages.csv',
      csv: toCsv([['Code', 'Discipline', 'Name', 'Vendor', 'Plan %', 'Actual %', 'Variance', 'Status'], ...rows.map(x => [x.code, x.discipline, x.name, x.vendor, x.planPct, x.actualPct, x.variance, x.status])]),
    };
  }

  expeditingGet(projectId: string, id: string) {
    const row = this.expeditingRows(projectId).find(r => r.id === id);
    if (!row) throw notFound('NOT_FOUND', `Expediting package "${id}" was not found.`);
    const { projectId: _p, ...rest } = row;
    return drop(rest);
  }

  expeditingSummary(projectId: string) {
    const rows = this.expeditingRows(projectId);
    const flags = rows
      .filter(r => /Delay|At Risk/i.test(String(r.status)) && r.highlight && r.highlight !== 'No')
      .map(r => ({ id: r.id, code: r.code, name: r.name, vendor: r.vendor, status: r.status, discipline: r.discipline }));
    return {
      total: rows.length, delayed: rows.filter(r => r.status === 'Delay').length, atRisk: rows.filter(r => /At Risk/i.test(String(r.status))).length,
      normal: rows.filter(r => r.status === 'Normal').length, flags,
    };
  }

  health() {
    return { status: 'ok', database: 'sheets', spreadsheet: this.store.spreadsheetUrl() };
  }
}
