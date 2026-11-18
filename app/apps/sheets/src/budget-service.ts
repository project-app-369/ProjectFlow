import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, notFound, parse, toCsv } from './http';
import type { Service } from './service';
import type { Row } from './store';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const wbsCode = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, digits, dot, dash or underscore');
const parentCode = z.string().trim().max(40).nullish().transform(v => (v ? v : null)).pipe(wbsCode.nullable());

const fields = {
  name: z.string().trim().min(1).max(160),
  parentWbs: parentCode,
  discipline: txt(60),
  manhours: z.number().min(0).max(100_000_000).nullish().transform(v => v ?? null),
  actualHours: z.number().min(0).max(100_000_000).nullish().transform(v => v ?? null),
  earnedHours: z.number().min(0).max(100_000_000).nullish().transform(v => v ?? null),
  planStart: isoOpt, planFinish: isoOpt,
  notes: txt(500),
};
const rowIn = z.object({ wbs: wbsCode, ...fields });
const patchIn = z.object(fields).partial();
const importIn = z.object({ mode: z.enum(['append', 'replace']).default('append'), rows: z.array(rowIn).min(1).max(2000) });
const histogramQuery = z.object({ by: z.enum(['week', 'month']).default('week'), group: z.enum(['wbs', 'discipline']).default('wbs'), from: iso.optional(), to: iso.optional() });

const MAX_PERIODS = { week: 260, month: 120 } as const;
const UNASSIGNED = 'Unassigned';

/* ---------------- dates ---------------- */
const at = (d: string) => new Date(`${d}T12:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fmt(new Date(at(d).getTime() + n * 86_400_000));
const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);
const weekStart = (d: string) => addDays(d, -((at(d).getUTCDay() + 6) % 7));
const monthStart = (d: string) => `${d.slice(0, 8)}01`;
const nextMonth = (d: string) => fmt(new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 1, 12)));
const round = (n: number) => Math.round(n * 100) / 100;
const byCode = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const issue = (path: string, message: string) => new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path, message }] });

export interface WbsNode {
  wbs: string; name: string; parentWbs: string | null; discipline: string | null; planStart: string | null; planFinish: string | null; notes: string | null;
  level: number; children: number; leaf: boolean;
  /** Hours typed on this row. Ignored when the row has children. */
  ownHours: number;
  /** Leaf: its own hours. Parent: the sum of everything below it. */
  hours: number;
  /** Manhours spent and value earned, typed on a leaf and summed up the tree; null where nothing was reported. */
  actualHours: number | null; earnedHours: number | null;
  ownActual: number | null; ownEarned: number | null;
  /** Earliest start and latest finish of the dates at or below this row. */
  start: string | null; finish: string | null;
  top: string;
}

/**
 * Construction budget: manhours per WBS activity, rolled up the WBS, and a histogram that spreads each activity's
 * hours evenly over its planned start–finish and adds them up per week or month.
 */
export class BudgetService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private rows(projectId: string): Row[] { return this.svc.rows(SHEET.budget, COLUMNS.budget, projectId); }

  /** The WBS as a depth-first list with levels and rolled-up hours. Rows whose parent is missing are treated as roots. */
  tree(projectId: string): WbsNode[] {
    const rows = this.rows(projectId);
    const known = new Set(rows.map(r => String(r.wbs)));
    const kids = new Map<string, Row[]>();
    for (const r of rows) {
      const parent = r.parentWbs && known.has(String(r.parentWbs)) && r.parentWbs !== r.wbs ? String(r.parentWbs) : '';
      kids.set(parent, [...(kids.get(parent) ?? []), r]);
    }
    for (const list of kids.values()) list.sort((a, b) => byCode(String(a.wbs), String(b.wbs)));
    const out: WbsNode[] = [];
    const seen = new Set<string>();
    const walk = (r: Row, level: number, top: string): WbsNode => {
      const code = String(r.wbs);
      seen.add(code);
      const idx = out.length;
      const node: WbsNode = {
        wbs: code, name: String(r.name ?? ''), parentWbs: (r.parentWbs as string | null) ?? null, discipline: (r.discipline as string | null) ?? null,
        planStart: (r.planStart as string | null) ?? null, planFinish: (r.planFinish as string | null) ?? null, notes: (r.notes as string | null) ?? null,
        level, children: 0, leaf: true, ownHours: Number(r.manhours ?? 0) || 0, hours: 0, start: null, finish: null, top: level === 1 ? code : top,
        actualHours: null, earnedHours: null, ownActual: r.actualHours == null ? null : Number(r.actualHours), ownEarned: r.earnedHours == null ? null : Number(r.earnedHours),
      };
      out.push(node);
      const children = (kids.get(code) ?? []).filter(c => !seen.has(String(c.wbs)));
      node.children = children.length;
      node.leaf = children.length === 0;
      let sum = 0; let start = node.planStart; let finish = node.planFinish;
      let actual: number | null = null; let earned: number | null = null;
      for (const c of children) {
        const n = walk(c, level + 1, node.top);
        sum += n.hours;
        if (n.actualHours !== null) actual = (actual ?? 0) + n.actualHours;
        if (n.earnedHours !== null) earned = (earned ?? 0) + n.earnedHours;
        if (n.start && (!start || n.start < start)) start = n.start;
        if (n.finish && (!finish || n.finish > finish)) finish = n.finish;
      }
      node.hours = node.leaf ? node.ownHours : round(sum);
      node.actualHours = node.leaf ? node.ownActual : actual === null ? null : round(actual);
      node.earnedHours = node.leaf ? node.ownEarned : earned === null ? null : round(earned);
      node.start = start; node.finish = finish;
      out[idx] = node;
      return node;
    };
    for (const r of kids.get('') ?? []) walk(r, 1, String(r.wbs));
    return out;
  }

  list(projectId: string) {
    const items = this.tree(projectId);
    const leaves = items.filter(n => n.leaf);
    const scheduled = leaves.filter(n => n.planStart && n.planFinish);
    const total = leaves.reduce((s, n) => s + n.ownHours, 0);
    const byDiscipline: Record<string, number> = {};
    for (const n of leaves) byDiscipline[n.discipline ?? UNASSIGNED] = round((byDiscipline[n.discipline ?? UNASSIGNED] ?? 0) + n.ownHours);
    const dates = scheduled.flatMap(n => [n.planStart!, n.planFinish!]).sort();
    const reported = leaves.filter(n => n.ownActual !== null);
    const actual = round(reported.reduce((s, n) => s + (n.ownActual ?? 0), 0));
    const earned = round(reported.reduce((s, n) => s + (n.ownEarned ?? 0), 0));
    const budgetOfReported = reported.reduce((s, n) => s + n.ownHours, 0);
    return {
      items,
      summary: {
        totalHours: round(total), activities: leaves.length, nodes: items.length,
        /** Manhours spent and earned, over the activities that report them; the cost performance index is earned / spent (1 or more is on budget). */
        actualHours: reported.length ? actual : null, earnedHours: reported.length ? earned : null, cpi: actual > 0 ? Math.round((earned / actual) * 1000) / 1000 : null,
        progressPct: total > 0 && reported.length ? Math.round((earned / total) * 1000) / 10 : null, reportedActivities: reported.length, budgetOfReported: round(budgetOfReported),
        scheduledHours: round(scheduled.reduce((s, n) => s + n.ownHours, 0)), unscheduledHours: round(total - scheduled.reduce((s, n) => s + n.ownHours, 0)),
        byDiscipline, start: dates[0] ?? null, finish: dates[dates.length - 1] ?? null,
        topLevel: items.filter(n => n.level === 1).map(n => ({ wbs: n.wbs, name: n.name, hours: n.hours })),
      },
    };
  }

  csv(projectId: string) {
    return {
      filename: 'construction-budget.csv',
      csv: toCsv([['WBS', 'Activity', 'Parent', 'Level', 'Discipline', 'Budget manhours', 'Own manhours', 'Actual manhours', 'Earned manhours', 'Plan start', 'Plan finish', 'Notes'],
        ...this.tree(projectId).map(n => [n.wbs, n.name, n.parentWbs, n.level, n.discipline, n.hours, n.leaf ? n.ownHours : null, n.actualHours, n.earnedHours, n.planStart, n.planFinish, n.notes])]),
    };
  }

  histogram(projectId: string, raw: unknown) {
    const q = parse(histogramQuery, raw);
    const nodes = this.tree(projectId);
    const label = new Map(nodes.filter(n => n.level === 1).map(n => [n.wbs, n.wbs.replace(/[^a-z0-9]/gi, '').toLowerCase() === n.name.replace(/[^a-z0-9]/gi, '').toLowerCase() ? n.name : `${n.wbs} ${n.name}`]));
    const leaves = nodes.filter(n => n.leaf && n.ownHours > 0);
    const dated = leaves.filter(n => n.planStart && n.planFinish && n.planFinish >= n.planStart);
    const unscheduledHours = round(leaves.filter(n => !dated.includes(n)).reduce((s, n) => s + n.ownHours, 0));
    const scheduledHours = round(dated.reduce((s, n) => s + n.ownHours, 0));
    const empty = { by: q.by, group: q.group, from: null as string | null, to: null as string | null, groups: [] as { key: string; label: string }[], periods: [] as unknown[], cumulative: [] as number[], peak: null as { start: string; hours: number } | null, totalHours: round(scheduledHours + unscheduledHours), scheduledHours, unscheduledHours, outsideHours: 0, truncated: false };
    if (!dated.length) return empty;

    const start = (d: string) => (q.by === 'week' ? weekStart(d) : monthStart(d));
    const step = (d: string) => (q.by === 'week' ? addDays(d, 7) : nextMonth(d));
    const first = start(q.from ?? dated.reduce((m, n) => (n.planStart! < m ? n.planStart! : m), dated[0].planStart!));
    const last = start(q.to ?? dated.reduce((m, n) => (n.planFinish! > m ? n.planFinish! : m), dated[0].planFinish!));
    if (last < first) throw issue('to', 'End of range is before its start.');

    const periods: { start: string; end: string; total: number; byGroup: Record<string, number> }[] = [];
    for (let s = first; s <= last && periods.length < MAX_PERIODS[q.by]; s = step(s)) periods.push({ start: s, end: addDays(step(s), -1), total: 0, byGroup: {} });
    const truncated = periods.length > 0 && step(periods[periods.length - 1].start) <= last;

    const groupOf = (n: WbsNode) => (q.group === 'wbs' ? n.top : n.discipline ?? UNASSIGNED);
    const used = new Set<string>();
    let inside = 0;
    for (const n of dated) {
      const days = daysBetween(n.planStart!, n.planFinish!) + 1;
      const key = groupOf(n);
      for (const p of periods) {
        if (p.end < n.planStart! || p.start > n.planFinish!) continue;
        const from = p.start > n.planStart! ? p.start : n.planStart!;
        const to = p.end < n.planFinish! ? p.end : n.planFinish!;
        const h = (n.ownHours * (daysBetween(from, to) + 1)) / days;
        p.total += h; p.byGroup[key] = (p.byGroup[key] ?? 0) + h; inside += h; used.add(key);
      }
    }
    const groups = [...used].sort(byCode).map(key => ({ key, label: q.group === 'wbs' ? label.get(key) ?? key : key }));
    let run = 0;
    const cumulative = periods.map(p => (run += p.total, round(run)));
    const out = periods.map(p => ({ start: p.start, end: p.end, total: round(p.total), byGroup: Object.fromEntries(Object.entries(p.byGroup).map(([k, v]) => [k, round(v)])) }));
    const peak = out.reduce<{ start: string; hours: number } | null>((m, p) => (!m || p.total > m.hours ? { start: p.start, hours: p.total } : m), null);
    return { by: q.by, group: q.group, from: first, to: periods[periods.length - 1]?.end ?? first, groups, periods: out, cumulative, peak, totalHours: round(scheduledHours + unscheduledHours), scheduledHours, unscheduledHours, outsideHours: round(scheduledHours - inside), truncated };
  }

  /* ---------------- writes ---------------- */
  private isDescendant(rows: Row[], code: string, ancestor: string): boolean {
    const parent = new Map(rows.map(r => [String(r.wbs), r.parentWbs ? String(r.parentWbs) : null]));
    for (let c: string | null = code, n = 0; c && n < 1000; c = parent.get(c) ?? null, n++) if (c === ancestor) return true;
    return false;
  }

  private checkDates(start: unknown, finish: unknown, path = 'planFinish') {
    if (start && finish && String(finish) < String(start)) throw issue(path, 'Plan finish cannot be before plan start.');
  }

  create(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(rowIn, body);
    this.checkDates(v.planStart, v.planFinish);
    return this.store.withLock(() => {
      const rows = this.rows(projectId);
      if (rows.some(r => r.wbs === v.wbs)) throw new HttpError(409, { code: 'WBS_EXISTS', message: `WBS ${v.wbs} already exists in this project.` });
      if (v.parentWbs && !rows.some(r => r.wbs === v.parentWbs)) throw issue('parentWbs', `Parent WBS ${v.parentWbs} does not exist.`);
      this.store.appendRows(SHEET.budget, COLUMNS.budget, [{ projectId, ...v, updatedAt: this.svc.clock().toISOString() }]);
      return this.node(projectId, v.wbs);
    });
  }

  private node(projectId: string, wbs: string): WbsNode {
    const n = this.tree(projectId).find(x => x.wbs === wbs);
    if (!n) throw notFound('NOT_FOUND', `WBS ${wbs} was not found.`);
    return n;
  }

  update(projectId: string, wbs: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(patchIn, body);
    return this.store.withLock(() => {
      const rows = this.rows(projectId);
      const current = rows.find(r => r.wbs === wbs);
      if (!current) throw notFound('NOT_FOUND', `WBS ${wbs} was not found.`);
      this.checkDates(patch.planStart !== undefined ? patch.planStart : current.planStart, patch.planFinish !== undefined ? patch.planFinish : current.planFinish);
      if (patch.parentWbs) {
        if (patch.parentWbs === wbs || this.isDescendant(rows, patch.parentWbs, wbs)) throw issue('parentWbs', 'A WBS cannot be placed under itself or one of its own children.');
        if (!rows.some(r => r.wbs === patch.parentWbs)) throw issue('parentWbs', `Parent WBS ${patch.parentWbs} does not exist.`);
      }
      this.store.updateRow(SHEET.budget, COLUMNS.budget, 'wbs', wbs, { ...(patch as Row), updatedAt: this.svc.clock().toISOString() }, { projectId });
      return this.node(projectId, wbs);
    });
  }

  remove(projectId: string, wbs: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      const rows = this.rows(projectId);
      if (!rows.some(r => r.wbs === wbs)) throw notFound('NOT_FOUND', `WBS ${wbs} was not found.`);
      if (rows.some(r => r.parentWbs === wbs)) throw new HttpError(409, { code: 'HAS_CHILDREN', message: 'Remove or move the activities below this WBS first.' });
      this.store.deleteRow(SHEET.budget, COLUMNS.budget, 'wbs', wbs, { projectId });
    });
  }

  /** Loads a whole WBS at once (for example pasted from a spreadsheet). Everything is checked before anything is written. */
  import(projectId: string, body: unknown, actor: Actor) {
    const v = parse(importIn, body);
    if (v.mode === 'replace') requireManage(actor, projectId); else requireWrite(actor, projectId);
    const codes = new Set<string>();
    v.rows.forEach((r, i) => {
      if (codes.has(r.wbs)) throw issue(`rows.${i}.wbs`, `WBS ${r.wbs} appears twice in the import.`);
      codes.add(r.wbs);
      this.checkDates(r.planStart, r.planFinish, `rows.${i}.planFinish`);
    });
    return this.store.withLock(() => {
      const existing = v.mode === 'replace' ? [] : this.rows(projectId);
      v.rows.forEach((r, i) => { if (existing.some(e => e.wbs === r.wbs)) throw issue(`rows.${i}.wbs`, `WBS ${r.wbs} already exists. Use replace to overwrite the whole budget.`); });
      const all = [...existing.map(e => ({ wbs: String(e.wbs), parentWbs: e.parentWbs ? String(e.parentWbs) : null })), ...v.rows.map(r => ({ wbs: r.wbs, parentWbs: r.parentWbs }))];
      const known = new Set(all.map(a => a.wbs));
      v.rows.forEach((r, i) => { if (r.parentWbs && !known.has(r.parentWbs)) throw issue(`rows.${i}.parentWbs`, `Parent WBS ${r.parentWbs} is not in the budget or the import.`); });
      const parent = new Map(all.map(a => [a.wbs, a.parentWbs]));
      for (const a of all) for (let c: string | null = a.parentWbs, n = 0; c; c = parent.get(c) ?? null, n++) {
        if (c === a.wbs || n > all.length) throw issue('rows', `WBS ${a.wbs} is its own ancestor.`);
      }
      if (v.mode === 'replace') this.store.deleteRows(SHEET.budget, COLUMNS.budget, { projectId });
      const now = this.svc.clock().toISOString();
      this.store.appendRows(SHEET.budget, COLUMNS.budget, v.rows.map(r => ({ projectId, ...r, updatedAt: now })));
      return { mode: v.mode, imported: v.rows.length, ...this.list(projectId).summary };
    });
  }
}
