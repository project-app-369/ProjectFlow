import { z } from 'zod';
import type { Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, notFound, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

/** Stored statuses. "Overdue" is derived (deadline passed, not Completed) and never stored. */
export const TASK_STATUSES = ['Backlog', 'Planned', 'Ongoing', 'Completed'] as const;
export const URGENCIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
/** Workload key for tasks that are linked to no project. */
export const PERSONAL_KEY = '_personal';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));

const subtaskIn = z.object({ id: z.string().max(60).optional(), title: z.string().trim().min(1).max(160), done: z.boolean().default(false) });
const fields = {
  title: z.string().trim().min(1).max(160),
  description: txt(2000),
  urgency: z.enum(URGENCIES),
  assigner: txt(120),
  projects: z.array(z.string().min(1).max(60)).max(20),
  planStart: isoOpt, planFinish: isoOpt, due: isoOpt,
  status: z.enum(TASK_STATUSES),
  effort: z.number().min(0).max(10_000).nullish().transform(v => v ?? null),
  remarks: txt(2000),
  subtasks: z.array(subtaskIn).max(50),
};
const taskCreate = z.object({
  ...fields, urgency: fields.urgency.default('Normal'), status: fields.status.default('Backlog'), projects: fields.projects.default([]), subtasks: fields.subtasks.default([]),
});
const taskPatch = z.object(fields).partial();
const workloadQuery = z.object({ by: z.enum(['week', 'month']).default('week'), from: iso.optional(), to: iso.optional(), today: iso.optional() });

/* ---------------- dates ---------------- */
const at = (d: string) => new Date(`${d}T12:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fmt(new Date(at(d).getTime() + n * 86_400_000));
const weekStart = (d: string) => addDays(d, -((at(d).getUTCDay() + 6) % 7));
const monthStart = (d: string) => `${d.slice(0, 8)}01`;
const addMonths = (d: string, n: number) => fmt(new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + n, 1, 12)));
const MAX_PERIODS = 60;

const stat = () => ({ tasks: 0, hours: 0, open: 0, openHours: 0 });
type Stat = ReturnType<typeof stat>;
const add = (s: Stat, hours: number, open: boolean) => { s.tasks++; s.hours += hours; if (open) { s.open++; s.openHours += hours; } };
const round = (s: Stat): Stat => ({ ...s, hours: Math.round(s.hours * 100) / 100, openHours: Math.round(s.openHours * 100) / 100 });

/** Personal tasks (Personal workspace → Task Management): owner-scoped, optionally linked to several of the owner's projects. */
export class TasksService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private todayOf(raw?: string) { return raw && iso.safeParse(raw).success ? raw : this.now().slice(0, 10); }

  private subtasksOf(): Map<string, Row[]> {
    const by = new Map<string, Row[]>();
    for (const s of this.store.readRows(SHEET.subtasks, COLUMNS.subtasks)) {
      const k = String(s.taskId);
      by.set(k, [...(by.get(k) ?? []), s]);
    }
    for (const rows of by.values()) rows.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
    return by;
  }

  private view(t: Row, subs: Row[], today: string, known: Set<string>): Record<string, any> {
    const subtasks = subs.map(s => ({ id: String(s.id), title: String(s.title ?? ''), done: s.done === 'Yes' }));
    const { owner: _o, ...rest } = t;
    const projects = String(t.projects ?? '').split(',').map(x => x.trim()).filter(x => x && known.has(x));
    const status = String(t.status);
    return {
      ...rest, projects, subtasks, subtasksDone: subtasks.filter(s => s.done).length, subtasksTotal: subtasks.length,
      overdue: !!t.due && String(t.due) < today && status !== 'Completed',
      ganttReady: !!(t.planStart && t.planFinish && t.due),
    };
  }

  private mine(actor: Actor): Row[] {
    return this.store.readRows(SHEET.tasks, COLUMNS.tasks).filter(t => t.owner === actor.id);
  }

  private knownProjects() { return new Set(this.svc.projectRows().map(p => String(p.id))); }

  private checkProjects(ids: string[] | undefined, actor: Actor) {
    const bad = (ids ?? []).filter(id => !actor.roles[id]);
    if (bad.length) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'projects', message: `You are not a member of: ${bad.join(', ')}.` }] });
  }

  private checkDates(planStart: unknown, planFinish: unknown) {
    if (planStart && planFinish && String(planFinish) < String(planStart)) {
      throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'planFinish', message: 'Plan finish cannot be before plan start.' }] });
    }
  }

  private writeSubtasks(taskId: string, list: { id?: string; title: string; done: boolean }[]) {
    this.store.deleteRows(SHEET.subtasks, COLUMNS.subtasks, { taskId });
    if (!list.length) return;
    this.store.appendRows(SHEET.subtasks, COLUMNS.subtasks, list.map((s, i) => ({ taskId, id: s.id || this.store.newId(), title: s.title, done: s.done ? 'Yes' : 'No', position: i + 1 })));
  }

  private get(id: string, actor: Actor, today: string) {
    const t = this.mine(actor).find(r => r.id === id);
    if (!t) throw notFound('NOT_FOUND', 'Task not found.');
    return this.view(t, this.subtasksOf().get(id) ?? [], today, this.knownProjects());
  }

  list(actor: Actor, raw: Record<string, string> = {}) {
    const today = this.todayOf(raw.today);
    const subs = this.subtasksOf();
    const known = this.knownProjects();
    const items = this.mine(actor).map(t => this.view(t, subs.get(String(t.id)) ?? [], today, known)).sort((a, b) => String(a.taskNo).localeCompare(String(b.taskNo)));
    return { items, today };
  }

  create(body: unknown, actor: Actor, raw: Record<string, string> = {}) {
    const v = parse(taskCreate, body);
    this.checkProjects(v.projects, actor);
    this.checkDates(v.planStart, v.planFinish);
    return this.store.withLock(() => {
      const all = this.store.readRows(SHEET.tasks, COLUMNS.tasks);
      const max = all.reduce((m, r) => Math.max(m, Number(String(r.taskNo ?? '').replace(/^\D+/, '')) || 0), 0);
      const now = this.now();
      const { subtasks, projects, ...rest } = v;
      const row: Row = { id: this.store.newId(), taskNo: `TSK-${String(max + 1).padStart(4, '0')}`, ...rest, projects: projects.join(','), createdAt: now, updatedAt: now, owner: actor.id };
      this.store.appendRows(SHEET.tasks, COLUMNS.tasks, [row]);
      this.writeSubtasks(String(row.id), subtasks);
      return this.get(String(row.id), actor, this.todayOf(raw.today));
    });
  }

  update(id: string, body: unknown, actor: Actor, raw: Record<string, string> = {}) {
    const patch = parse(taskPatch, body);
    this.checkProjects(patch.projects, actor);
    return this.store.withLock(() => {
      const current = this.mine(actor).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', 'Task not found.');
      this.checkDates(patch.planStart !== undefined ? patch.planStart : current.planStart, patch.planFinish !== undefined ? patch.planFinish : current.planFinish);
      const { subtasks, projects, ...rest } = patch;
      const row: Row = { ...(rest as Row), ...(projects !== undefined && { projects: projects.join(',') }), updatedAt: this.now() };
      this.store.updateRow(SHEET.tasks, COLUMNS.tasks, 'id', id, row, { owner: actor.id });
      if (subtasks !== undefined) this.writeSubtasks(id, subtasks);
      return this.get(id, actor, this.todayOf(raw.today));
    });
  }

  remove(id: string, actor: Actor) {
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.tasks, COLUMNS.tasks, 'id', id, { owner: actor.id })) throw notFound('NOT_FOUND', 'Task not found.');
      this.store.deleteRows(SHEET.subtasks, COLUMNS.subtasks, { taskId: id });
    });
  }

  /**
   * Tasks and estimated hours per week or month, by project. A task belongs to the period of its deadline
   * (else plan finish, else plan start). A task linked to several projects counts in each of them, so period
   * totals count each task once. Tasks with no date are reported separately.
   */
  workload(actor: Actor, raw: unknown) {
    const q = parse(workloadQuery, raw);
    const today = this.todayOf(q.today);
    const start = (d: string) => (q.by === 'week' ? weekStart(d) : monthStart(d));
    const step = (d: string) => (q.by === 'week' ? addDays(d, 7) : addMonths(d, 1));
    const first = start(q.from ?? (q.by === 'week' ? addDays(today, -28) : addMonths(monthStart(today), -2)));
    const last = start(q.to ?? (q.by === 'week' ? addDays(today, 56) : addMonths(monthStart(today), 6)));
    if (last < first) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'to', message: 'End of range is before its start.' }] });

    const periods: { start: string; end: string; total: Stat; byProject: Record<string, Stat> }[] = [];
    for (let s = first; s <= last && periods.length < MAX_PERIODS; s = step(s)) periods.push({ start: s, end: addDays(step(s), -1), total: stat(), byProject: {} });
    const index = new Map(periods.map(p => [p.start, p]));

    const known = this.knownProjects();
    const totals = { total: stat(), byProject: {} as Record<string, Stat> };
    const unscheduled = stat();
    const outside = { tasks: 0, hours: 0 };
    for (const t of this.mine(actor)) {
      const hours = Number(t.effort ?? 0) || 0;
      const open = t.status !== 'Completed';
      const ids = String(t.projects ?? '').split(',').map(x => x.trim()).filter(x => x && known.has(x));
      const keys = ids.length ? ids : [PERSONAL_KEY];
      const date = String(t.due ?? t.planFinish ?? t.planStart ?? '');
      if (!date) { add(unscheduled, hours, open); continue; }
      const period = index.get(start(date));
      if (!period) { outside.tasks++; outside.hours += hours; continue; }
      add(period.total, hours, open);
      add(totals.total, hours, open);
      for (const k of keys) {
        add((period.byProject[k] ??= stat()), hours, open);
        add((totals.byProject[k] ??= stat()), hours, open);
      }
    }
    const projects = [...new Set(periods.flatMap(p => Object.keys(p.byProject)))].sort((a, b) => (a === PERSONAL_KEY ? 1 : b === PERSONAL_KEY ? -1 : a.localeCompare(b)));
    const roundMap = (m: Record<string, Stat>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, round(v)]));
    return {
      by: q.by, from: first, to: periods[periods.length - 1]?.end ?? first, today, projects,
      periods: periods.map(p => ({ start: p.start, end: p.end, total: round(p.total), byProject: roundMap(p.byProject) })),
      totals: { total: round(totals.total), byProject: roundMap(totals.byProject) },
      unscheduled: round(unscheduled), outside: { tasks: outside.tasks, hours: Math.round(outside.hours * 100) / 100 },
    };
  }
}
