import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import { issuesInsights, withinPredicate } from './insights';
import type { Mailer } from './mailer';
import type { Service } from './service';
import type { Row } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;

export const ISSUE_STATUSES = ['Not started', 'In progress', 'Pending', 'Completed'] as const;
export const ISSUE_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const PRIORITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
/** An item is reminded about when it is overdue or due within this many days. */
export const REMIND_WITHIN_DAYS = 3;
const MAX_PICS = 10;

const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(120);
const pics = z.array(email).max(MAX_PICS, `At most ${MAX_PICS} people can be responsible for one issue.`).transform(list => [...new Set(list)]);

const issueFields = {
  title: z.string().trim().min(1).max(200), description: txt(2000), priority: z.enum(ISSUE_PRIORITIES), discipline: txt(60), status: z.enum(ISSUE_STATUSES),
  startDate: isoOpt, dueDate: isoOpt, nextAction: txt(1500), remarks: txt(1500), pics,
};
const issueCreate = z.object({ ...issueFields, priority: issueFields.priority.default('Medium'), status: issueFields.status.default('Not started'), pics: pics.default([]) });
const issuePatch = z.object(issueFields).partial();
const subtaskFields = { title: z.string().trim().min(1).max(200), pic: email.nullish().transform(v => v ?? null), dueDate: isoOpt, done: z.boolean() };
const subtaskCreate = z.object({ ...subtaskFields, done: subtaskFields.done.default(false) });
const subtaskPatch = z.object(subtaskFields).partial();
const commentBody = z.object({ note: z.string().trim().min(1).max(1500) });
const issueQuery = listQuery(['id', 'title', 'priorityRank', 'status', 'dueDate', 'updatedAt', 'discipline'] as const).extend({
  priority: z.string().max(20).optional(), pic: z.string().max(120).optional(), within: z.string().max(10).optional(),
});

const LOGGED: [keyof typeof issueFields, string][] = [['title', 'Title'], ['description', 'Description'], ['priority', 'Priority'], ['discipline', 'Team'], ['status', 'Status'], ['startDate', 'Start date'], ['dueDate', 'Due date'], ['nextAction', 'Next action'], ['remarks', 'Remarks']];

const picsOf = (r: Row): string[] => String(r.pics ?? '').split(',').map(s => s.trim()).filter(Boolean);
const isOpen = (r: Row) => r.status !== 'Completed';
const clip = (v: unknown) => (v == null || v === '' ? '' : String(v).replace(/\s+/g, ' ').slice(0, 160));
const nextNo = (prefix: string, rows: Row[], width: number) => `${prefix}-${String(rows.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/^\D+/, '')) || 0), 0) + 1).padStart(width, '0')}`;
const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);

export const issueDue = (r: Any) => (r.dueDate ? String(r.dueDate) : null);
export const issueIsOpen = (r: Any) => r.status !== 'Completed';

/**
 * Issue management: monitor issues, break them into sub-tasks, keep a log of every change, assign several people by
 * email and remind them of due dates. Overdue is judged against the project's reporting cut-off, like the other registers;
 * reminders use today's date, because they are about what to do now.
 */
export class IssuesService {
  constructor(private readonly svc: Service, private readonly mailer: Mailer) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private today() { return this.now().slice(0, 10); }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }
  private rows(projectId: string) { return this.svc.rows(SHEET.issues, COLUMNS.issues, projectId); }
  private subtaskRows(projectId: string) { return this.svc.rows(SHEET.issueSubtasks, COLUMNS.issueSubtasks, projectId); }
  private logRows(projectId: string) { return this.svc.rows(SHEET.issueLog, COLUMNS.issueLog, projectId); }

  private subtaskView(s: Row): Any { const { projectId: _p, ...rest } = s; return { ...rest, done: s.done === 'Yes' }; }

  private view(r: Row, cutoff: string, subs: Row[]): Any {
    const { projectId: _p, ...rest } = r;
    const mine = subs.filter(s => s.issueId === r.id);
    const due = r.dueDate ? String(r.dueDate) : null;
    return {
      ...rest, pics: picsOf(r), priorityRank: PRIORITY_RANK[String(r.priority)] ?? 0,
      overdue: isOpen(r) && !!due && due < cutoff, daysToDue: isOpen(r) && due ? daysBetween(cutoff, due) : null,
      subtasksTotal: mine.length, subtasksDone: mine.filter(s => s.done === 'Yes').length,
    };
  }

  private views(projectId: string): Any[] {
    const cutoff = this.cutoff(projectId), subs = this.subtaskRows(projectId);
    return this.rows(projectId).map(r => this.view(r, cutoff, subs));
  }

  private log(projectId: string, issueId: string, actor: string, action: string, detail: { field?: string; from?: unknown; to?: unknown; note?: string } = {}) {
    const rows = this.logRows(projectId);
    this.store.appendRows(SHEET.issueLog, COLUMNS.issueLog, [{
      projectId, id: nextNo('LG', rows, 5), issueId, at: this.now(), actor, action,
      field: detail.field ?? null, fromValue: clip(detail.from) || null, toValue: clip(detail.to) || null, note: detail.note ?? null,
    }]);
  }

  private mail(to: string[], subject: string, body: string) {
    const list = [...new Set(to)].filter(Boolean);
    if (!list.length) return;
    try { this.mailer.send(list, subject, body); } catch { /* a mail failure must not undo the change that was saved */ }
  }

  private requireIssue(projectId: string, id: string): Row {
    const r = this.rows(projectId).find(x => x.id === id);
    if (!r) throw notFound('NOT_FOUND', `Issue "${id}" was not found.`);
    return r;
  }

  /* ================= read ================= */
  private select(projectId: string, raw: unknown) {
    const { priority, pic, within, ...f } = parse(issueQuery, raw ?? {});
    const cutoff = this.cutoff(projectId);
    const all = this.views(projectId);
    const inWindow = within ? withinPredicate(issueDue, issueIsOpen) : null;
    const kept = all.filter(r => (!priority || r.priority === priority) && (!pic || (pic === 'none' ? r.pics.length === 0 : r.pics.includes(pic.toLowerCase()))) && (!inWindow || inWindow(r, within!, { cutoff })));
    return { f, all, rows: filterAndSort(kept as unknown as Row[], f as ListParams, ['id', 'title', 'description', 'discipline', 'nextAction', 'remarks', 'pics'], 'dueDate') as unknown as Any[] };
  }

  list(projectId: string, raw: unknown) {
    const { f, all, rows } = this.select(projectId, raw);
    return {
      items: paginate(rows as unknown as Row[], f), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: {
        disciplines: unique(all.map(r => r.discipline as string | null)), statuses: [...ISSUE_STATUSES], priorities: [...ISSUE_PRIORITIES],
        pics: unique(all.flatMap(r => r.pics as string[])),
      },
    };
  }

  csv(projectId: string, raw: unknown) {
    const { rows } = this.select(projectId, raw);
    return {
      filename: 'issues.csv',
      csv: toCsv([['ID', 'Title', 'Priority', 'Team', 'Status', 'PIC', 'Start', 'Due', 'Overdue', 'Sub-tasks done', 'Sub-tasks', 'Next action', 'Remarks'],
        ...rows.map(r => [r.id, r.title, r.priority, r.discipline, r.status, r.pics.join('; '), r.startDate, r.dueDate, r.overdue ? 'Yes' : 'No', r.subtasksDone, r.subtasksTotal, r.nextAction, r.remarks])]),
    };
  }

  get(projectId: string, id: string) {
    const r = this.requireIssue(projectId, id);
    const subs = this.subtaskRows(projectId);
    return {
      ...this.view(r, this.cutoff(projectId), subs),
      subtasks: subs.filter(s => s.issueId === id).sort((a, b) => Number(a.position) - Number(b.position)).map(s => this.subtaskView(s)),
      log: this.logRows(projectId).filter(l => l.issueId === id).sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id))).map(({ projectId: _p, ...l }) => l),
    };
  }

  insights(projectId: string) {
    const cutoff = this.cutoff(projectId);
    return issuesInsights(this.views(projectId), this.subtaskRows(projectId), cutoff);
  }

  /* ================= write ================= */
  create(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(issueCreate, body);
    return this.store.withLock(() => {
      const id = nextNo('ISS', this.rows(projectId), 3), now = this.now();
      const row: Row = { projectId, id, ...v, pics: v.pics.join(','), source: 'App', completedDate: v.status === 'Completed' ? this.today() : null, lastRemindedOn: null, createdAt: now, updatedAt: now, createdBy: actor.id };
      this.store.appendRows(SHEET.issues, COLUMNS.issues, [row]);
      this.log(projectId, id, actor.name, 'Created', { note: `Priority ${v.priority}${v.dueDate ? `, due ${v.dueDate}` : ''}` });
      for (const p of v.pics) this.log(projectId, id, actor.name, 'PIC added', { to: p });
      this.notifyAssigned(v.pics, String(v.title), id, actor, v.dueDate);
      return this.get(projectId, id);
    });
  }

  private notifyAssigned(to: string[], title: string, id: string, actor: Actor, due: string | null) {
    const people = to.filter(e => e !== (actor.email ?? '').toLowerCase());
    this.mail(people, `[Project Flow] You are responsible for ${id}: ${title}`, `${actor.name} made you a person in charge of issue ${id}.\n\n${title}\n${due ? `Due: ${due}\n` : ''}\nOpen Project Flow → Issues to see the detail and the sub-tasks.`);
  }

  update(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(issuePatch, body);
    return this.store.withLock(() => {
      const cur = this.requireIssue(projectId, id);
      const changes: Row = {};
      for (const [k, label] of LOGGED) {
        if (!(k in patch)) continue;
        const to = (patch as Any)[k] ?? null, from = cur[k] ?? null;
        if (to === from) continue;
        changes[k] = to;
        this.log(projectId, id, actor.name, k === 'status' ? 'Status changed' : 'Updated', { field: label, from, to });
      }
      if ('status' in changes) changes.completedDate = changes.status === 'Completed' ? this.today() : null;
      if ('dueDate' in changes) changes.lastRemindedOn = null;
      if (patch.pics) {
        const before = picsOf(cur), after = patch.pics as string[];
        const added = after.filter(e => !before.includes(e)), removed = before.filter(e => !after.includes(e));
        for (const e of added) this.log(projectId, id, actor.name, 'PIC added', { to: e });
        for (const e of removed) this.log(projectId, id, actor.name, 'PIC removed', { from: e });
        if (added.length || removed.length) changes.pics = after.join(',');
        this.notifyAssigned(added, String(patch.title ?? cur.title), id, actor, (changes.dueDate ?? cur.dueDate) as string | null);
      }
      if (Object.keys(changes).length) this.store.updateRow(SHEET.issues, COLUMNS.issues, 'id', id, { ...changes, updatedAt: this.now() }, { projectId });
      return this.get(projectId, id);
    });
  }

  delete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      this.requireIssue(projectId, id);
      this.store.deleteRows(SHEET.issueSubtasks, COLUMNS.issueSubtasks, { projectId, issueId: id });
      this.store.deleteRows(SHEET.issueLog, COLUMNS.issueLog, { projectId, issueId: id });
      this.store.deleteRow(SHEET.issues, COLUMNS.issues, 'id', id, { projectId });
    });
  }

  comment(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { note } = parse(commentBody, body);
    return this.store.withLock(() => {
      this.requireIssue(projectId, id);
      this.log(projectId, id, actor.name, 'Note', { note });
      this.store.updateRow(SHEET.issues, COLUMNS.issues, 'id', id, { updatedAt: this.now() }, { projectId });
      return this.get(projectId, id);
    });
  }

  /* ================= sub-tasks ================= */
  addSubtask(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(subtaskCreate, body);
    return this.store.withLock(() => {
      const issue = this.requireIssue(projectId, id);
      const all = this.subtaskRows(projectId), mine = all.filter(s => s.issueId === id);
      const sid = nextNo('ST', all, 4);
      this.store.appendRows(SHEET.issueSubtasks, COLUMNS.issueSubtasks, [{ projectId, id: sid, issueId: id, title: v.title, pic: v.pic, dueDate: v.dueDate, done: v.done ? 'Yes' : 'No', position: mine.length + 1, lastRemindedOn: null, updatedAt: this.now() }]);
      this.log(projectId, id, actor.name, 'Sub-task added', { note: `${sid}: ${v.title}${v.pic ? ` (${v.pic})` : ''}` });
      if (v.pic && v.pic !== (actor.email ?? '').toLowerCase()) this.mail([v.pic], `[Project Flow] Sub-task for ${id}: ${v.title}`, `${actor.name} gave you a sub-task on issue ${id} (${issue.title}).\n\n${v.title}\n${v.dueDate ? `Due: ${v.dueDate}\n` : ''}`);
      this.store.updateRow(SHEET.issues, COLUMNS.issues, 'id', id, { updatedAt: this.now() }, { projectId });
      return this.get(projectId, id);
    });
  }

  updateSubtask(projectId: string, id: string, sid: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(subtaskPatch, body);
    return this.store.withLock(() => {
      const issue = this.requireIssue(projectId, id);
      const cur = this.subtaskRows(projectId).find(s => s.id === sid && s.issueId === id);
      if (!cur) throw notFound('NOT_FOUND', `Sub-task "${sid}" was not found on ${id}.`);
      const changes: Row = {};
      if (patch.title !== undefined && patch.title !== cur.title) { changes.title = patch.title; this.log(projectId, id, actor.name, 'Sub-task updated', { field: 'Title', from: cur.title, to: patch.title, note: sid }); }
      if (patch.dueDate !== undefined && patch.dueDate !== (cur.dueDate ?? null)) { changes.dueDate = patch.dueDate; changes.lastRemindedOn = null; this.log(projectId, id, actor.name, 'Sub-task updated', { field: 'Due date', from: cur.dueDate, to: patch.dueDate, note: sid }); }
      if (patch.pic !== undefined && patch.pic !== (cur.pic ?? null)) {
        changes.pic = patch.pic;
        this.log(projectId, id, actor.name, 'Sub-task updated', { field: 'PIC', from: cur.pic, to: patch.pic, note: sid });
        if (patch.pic && patch.pic !== (actor.email ?? '').toLowerCase()) this.mail([patch.pic], `[Project Flow] Sub-task for ${id}: ${cur.title}`, `${actor.name} gave you a sub-task on issue ${id} (${issue.title}).\n\n${patch.title ?? cur.title}\n${(changes.dueDate ?? cur.dueDate) ? `Due: ${changes.dueDate ?? cur.dueDate}\n` : ''}`);
      }
      if (patch.done !== undefined && (patch.done ? 'Yes' : 'No') !== cur.done) { changes.done = patch.done ? 'Yes' : 'No'; this.log(projectId, id, actor.name, patch.done ? 'Sub-task done' : 'Sub-task reopened', { note: `${sid}: ${cur.title}` }); }
      if (Object.keys(changes).length) {
        this.store.updateRow(SHEET.issueSubtasks, COLUMNS.issueSubtasks, 'id', sid, { ...changes, updatedAt: this.now() }, { projectId, issueId: id });
        this.store.updateRow(SHEET.issues, COLUMNS.issues, 'id', id, { updatedAt: this.now() }, { projectId });
      }
      return this.get(projectId, id);
    });
  }

  deleteSubtask(projectId: string, id: string, sid: string, actor: Actor) {
    requireWrite(actor, projectId);
    return this.store.withLock(() => {
      this.requireIssue(projectId, id);
      const cur = this.subtaskRows(projectId).find(s => s.id === sid && s.issueId === id);
      if (!cur) throw notFound('NOT_FOUND', `Sub-task "${sid}" was not found on ${id}.`);
      this.store.deleteRow(SHEET.issueSubtasks, COLUMNS.issueSubtasks, 'id', sid, { projectId, issueId: id });
      this.log(projectId, id, actor.name, 'Sub-task removed', { note: `${sid}: ${cur.title}` });
      return this.get(projectId, id);
    });
  }

  /* ================= reminders ================= */
  /** Sends one reminder now to everyone responsible for the issue (and for its open sub-tasks). */
  remind(projectId: string, id: string, actor: Actor) {
    requireWrite(actor, projectId);
    return this.store.withLock(() => {
      const issue = this.requireIssue(projectId, id);
      const subs = this.subtaskRows(projectId).filter(s => s.issueId === id && s.done !== 'Yes');
      const to = [...new Set([...picsOf(issue), ...subs.map(s => String(s.pic ?? '')).filter(Boolean)])];
      if (!to.length) throw new HttpError(409, { code: 'NO_PIC', message: 'Nobody is assigned to this issue yet. Add a person in charge by email first.' });
      const due = issue.dueDate ? String(issue.dueDate) : null;
      this.mail(to, `[Project Flow] Reminder: ${id} ${issue.title}`, [
        `${actor.name} is reminding you about issue ${id}.`, '', String(issue.title), `Status: ${issue.status}`, due ? `Due: ${due}` : 'No due date set',
        issue.nextAction ? `Next action: ${clip(issue.nextAction)}` : '',
        subs.length ? `\nOpen sub-tasks:\n${subs.map(s => `- ${s.title}${s.pic ? ` (${s.pic})` : ''}${s.dueDate ? `, due ${s.dueDate}` : ''}`).join('\n')}` : '',
      ].filter(x => x !== '').join('\n'));
      this.log(projectId, id, actor.name, 'Reminder sent', { note: `To ${to.join(', ')}` });
      return this.get(projectId, id);
    });
  }

  /**
   * The daily job: every open issue or sub-task that is overdue or due within REMIND_WITHIN_DAYS gets one email to each
   * person responsible, as one message per person. Items already reminded today are skipped, so running it twice is safe.
   */
  remindDue(projectId: string, today = this.today()) {
    return this.store.withLock(() => {
      const horizon = addDays(today, REMIND_WITHIN_DAYS);
      const due = (d: unknown) => !!d && String(d) <= horizon;
      const subs = this.subtaskRows(projectId);
      const digest = new Map<string, string[]>();
      const touched: { id: string; to: string[] }[] = [];
      const add = (e: string, line: string) => digest.set(e, [...(digest.get(e) ?? []), line]);
      const when = (d: unknown) => (String(d) < today ? `overdue since ${d}` : `due ${d}`);

      for (const r of this.rows(projectId)) {
        if (!isOpen(r)) continue;
        const recipients = new Set<string>();
        if (due(r.dueDate) && r.lastRemindedOn !== today) {
          for (const e of picsOf(r)) { add(e, `${r.id} ${r.title} (${when(r.dueDate)})`); recipients.add(e); }
          if (recipients.size) this.store.updateRow(SHEET.issues, COLUMNS.issues, 'id', String(r.id), { lastRemindedOn: today }, { projectId });
        }
        for (const s of subs.filter(x => x.issueId === r.id && x.done !== 'Yes' && x.pic && due(x.dueDate) && x.lastRemindedOn !== today)) {
          add(String(s.pic), `${r.id} sub-task: ${s.title} (${when(s.dueDate)})`); recipients.add(String(s.pic));
          this.store.updateRow(SHEET.issueSubtasks, COLUMNS.issueSubtasks, 'id', String(s.id), { lastRemindedOn: today }, { projectId, issueId: String(r.id) });
        }
        if (recipients.size) touched.push({ id: String(r.id), to: [...recipients] });
      }
      for (const [to, lines] of digest) this.mail([to], `[Project Flow] ${lines.length} item${lines.length === 1 ? '' : 's'} due or overdue`, `These are due within ${REMIND_WITHIN_DAYS} days or overdue:\n\n${lines.map(l => `- ${l}`).join('\n')}\n\nOpen Project Flow → Issues to update them.`);
      for (const t of touched) this.log(projectId, t.id, 'Reminder (automatic)', 'Reminder sent', { note: `To ${t.to.join(', ')}` });
      return { date: today, emails: digest.size, items: [...digest.values()].reduce((n, l) => n + l.length, 0), issues: touched.length };
    });
  }

  /** The daily job for every project; used by the Apps Script time trigger. */
  remindAll() {
    return this.svc.projectRows().map(p => ({ projectId: String(p.id), ...this.remindDue(String(p.id)) }));
  }
}
