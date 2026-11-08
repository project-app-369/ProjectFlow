import { z } from 'zod';
import { ACCOUNT_STATES, ROLES, forbidden, requireAdmin, requireConfigure, requireMember, userRow, type Actor } from './auth';
import { COLUMNS, PROJECT_SHEETS, SHEET, type SheetKey } from './datasets';
import { HttpError, notFound, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

export const LIFECYCLES = ['Draft', 'Setup', 'Active', 'On hold', 'Closing', 'Archived'] as const;
type Lifecycle = (typeof LIFECYCLES)[number];

/** Project lifecycle (spec PRJ-03). Leaving Archived is a restore and needs a reason. */
const LIFECYCLE_NEXT: Record<Lifecycle, Lifecycle[]> = {
  Draft: ['Setup', 'Active'],
  Setup: ['Active', 'Draft'],
  Active: ['On hold', 'Closing'],
  'On hold': ['Active', 'Closing'],
  Closing: ['Archived', 'Active'],
  Archived: ['Active'],
};

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const optText = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const projectFields = {
  name: z.string().trim().min(1).max(160),
  shortName: optText(40), client: optText(120), contract: optText(160), location: optText(120),
  cutoff: iso,
};
const projectCreate = z.object({ code: z.string().trim().min(2).max(30), ...projectFields, cutoff: iso.optional() });
const projectPatch = z.object({ code: z.string().trim().min(2).max(30), ...projectFields }).partial();
const lifecycleBody = z.object({ to: z.enum(LIFECYCLES), reason: z.string().trim().max(300).optional() });

const email = z.string().trim().toLowerCase().email().max(160);
const userCreate = z.object({ name: z.string().trim().min(1).max(120), email, isAdmin: z.boolean().default(false), status: z.enum(ACCOUNT_STATES).default('Active') });
const userPatch = z.object({ name: z.string().trim().min(1).max(120), email, isAdmin: z.boolean(), status: z.enum(ACCOUNT_STATES) }).partial();
const memberBody = z.object({ role: z.enum(ROLES), title: z.string().trim().max(120).nullish().transform(v => v ?? null) });

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class AdminService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }

  /* ---------- directory and identity ---------- */
  /** Who can be picked at the demo sign-in: active accounts, names only. */
  directory() {
    return this.store.readRows(SHEET.users, COLUMNS.users).filter(u => u.status === 'Active').map(u => ({ id: u.id, name: u.name }));
  }

  me(actor: Actor) {
    return {
      id: actor.id, name: actor.name, email: actor.email, isAdmin: actor.isAdmin,
      memberships: Object.entries(actor.roles).map(([projectId, role]) => ({ projectId, role })),
    };
  }

  /* ---------- projects ---------- */
  private shape(p: Row, actor: Actor): Record<string, unknown> & { code: unknown } {
    const members = this.store.readRows(SHEET.memberships, COLUMNS.memberships).filter(m => m.projectId === p.id);
    return { ...p, code: p.code, myRole: actor.roles[String(p.id)] ?? null, memberCount: members.length };
  }

  listProjects(actor: Actor, raw: Record<string, string> = {}) {
    const includeArchived = raw.includeArchived === 'true';
    return this.svc.projectRows()
      .filter(p => actor.isAdmin || actor.roles[String(p.id)])
      .filter(p => includeArchived || p.lifecycle !== 'Archived')
      .map(p => this.shape(p, actor))
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  getProject(id: string, actor: Actor) {
    const p = this.svc.project(id);
    if (!actor.isAdmin && !actor.roles[id]) throw forbidden('NOT_A_MEMBER', 'You are not a member of this project.');
    return this.shape(p, actor);
  }

  createProject(body: unknown, actor: Actor) {
    requireAdmin(actor);
    const v = parse(projectCreate, body);
    return this.store.withLock(() => {
      const all = this.svc.projectRows();
      if (all.some(p => String(p.code).toLowerCase() === v.code.toLowerCase())) throw new HttpError(409, { code: 'CODE_TAKEN', message: `Project code "${v.code}" is already used.` });
      let id = slug(v.code) || 'project';
      for (let n = 2; all.some(p => p.id === id); n++) id = `${slug(v.code)}-${n}`;
      const now = this.now();
      const row: Row = {
        id, code: v.code, name: v.name, shortName: v.shortName, client: v.client, contract: v.contract, location: v.location,
        lifecycle: 'Setup', cutoff: v.cutoff ?? now.slice(0, 10), createdAt: now, updatedAt: now,
      };
      this.store.appendRows(SHEET.projects, COLUMNS.projects, [row]);
      this.store.appendRows(SHEET.memberships, COLUMNS.memberships, [{ projectId: id, userId: actor.id, role: 'Project Manager', title: 'Project creator' }]);
      return this.shape(row, { ...actor, roles: { ...actor.roles, [id]: 'Project Manager' } });
    });
  }

  updateProject(id: string, body: unknown, actor: Actor) {
    this.svc.project(id);
    requireConfigure(actor, id);
    const patch = parse(projectPatch, body);
    if (patch.code !== undefined && !actor.isAdmin) throw forbidden('ADMIN_REQUIRED', 'Only an administrator can change a project code.');
    return this.store.withLock(() => {
      if (patch.code !== undefined) {
        const taken = this.svc.projectRows().some(p => p.id !== id && String(p.code).toLowerCase() === patch.code!.toLowerCase());
        if (taken) throw new HttpError(409, { code: 'CODE_TAKEN', message: `Project code "${patch.code}" is already used.` });
      }
      this.store.updateRow(SHEET.projects, COLUMNS.projects, 'id', id, { ...(patch as Row), updatedAt: this.now() });
      return this.shape(this.svc.project(id), actor);
    });
  }

  changeLifecycle(id: string, body: unknown, actor: Actor) {
    const p = this.svc.project(id);
    requireConfigure(actor, id);
    const { to, reason } = parse(lifecycleBody, body);
    const from = String(p.lifecycle) as Lifecycle;
    if (!LIFECYCLE_NEXT[from]?.includes(to)) {
      throw new HttpError(409, { code: 'INVALID_TRANSITION', message: `A ${from} project cannot move to ${to}. Allowed: ${LIFECYCLE_NEXT[from]?.join(', ') || 'none'}.` });
    }
    if (from === 'Archived' && !reason) throw new HttpError(400, { code: 'REASON_REQUIRED', message: 'Restoring an archived project needs a reason.' });
    return this.store.withLock(() => {
      this.store.updateRow(SHEET.projects, COLUMNS.projects, 'id', id, { lifecycle: to, updatedAt: this.now() });
      return this.shape(this.svc.project(id), actor);
    });
  }

  /** Controlled records are never hard-deleted (spec PRJ-03): only an empty Draft project can be removed. */
  deleteProject(id: string, actor: Actor) {
    requireAdmin(actor);
    const p = this.svc.project(id);
    if (p.lifecycle !== 'Draft') throw new HttpError(409, { code: 'ARCHIVE_INSTEAD', message: 'Only a Draft project can be deleted. Archive this one instead.' });
    return this.store.withLock(() => {
      const dataSheets: SheetKey[] = PROJECT_SHEETS.filter(k => !['modules', 'moduleChanges', 'memberships'].includes(k));
      const withRecords = dataSheets.find(k => this.store.readRows(SHEET[k], COLUMNS[k]).some(r => r.projectId === id));
      if (withRecords) throw new HttpError(409, { code: 'PROJECT_HAS_RECORDS', message: `The project still has records in "${SHEET[withRecords]}". Archive it instead.` });
      for (const k of PROJECT_SHEETS) this.store.deleteRows(SHEET[k], COLUMNS[k], { projectId: id });
      this.store.deleteRow(SHEET.projects, COLUMNS.projects, 'id', id);
    });
  }

  /* ---------- users (administrators) ---------- */
  private memberships(userId?: string) {
    return this.store.readRows(SHEET.memberships, COLUMNS.memberships).filter(m => !userId || m.userId === userId);
  }

  listUsers(actor: Actor) {
    requireAdmin(actor);
    const projects = new Map(this.svc.projectRows().map(p => [p.id, p]));
    return this.store.readRows(SHEET.users, COLUMNS.users).map(u => ({
      ...userRow(u),
      memberships: this.memberships(String(u.id)).map(m => ({ projectId: m.projectId, projectCode: projects.get(m.projectId)?.code ?? m.projectId, role: m.role, title: m.title })),
    }));
  }

  createUser(body: unknown, actor: Actor) {
    requireAdmin(actor);
    const v = parse(userCreate, body);
    return this.store.withLock(() => {
      if (this.store.readRows(SHEET.users, COLUMNS.users).some(u => String(u.email).toLowerCase() === v.email)) throw new HttpError(409, { code: 'EMAIL_TAKEN', message: `${v.email} already has an account.` });
      const row: Row = { id: `u-${this.store.newId().slice(0, 8)}`, name: v.name, email: v.email, isAdmin: v.isAdmin ? 'Yes' : 'No', status: v.status, createdAt: this.now() };
      this.store.appendRows(SHEET.users, COLUMNS.users, [row]);
      return { ...userRow(row), memberships: [] };
    });
  }

  updateUser(id: string, body: unknown, actor: Actor) {
    requireAdmin(actor);
    const patch = parse(userPatch, body);
    return this.store.withLock(() => {
      const users = this.store.readRows(SHEET.users, COLUMNS.users);
      const user = users.find(u => u.id === id);
      if (!user) throw notFound('NOT_FOUND', 'User not found.');
      if (patch.email && users.some(u => u.id !== id && String(u.email).toLowerCase() === patch.email)) throw new HttpError(409, { code: 'EMAIL_TAKEN', message: `${patch.email} already has an account.` });
      const staysAdmin = (patch.isAdmin ?? user.isAdmin === 'Yes') && (patch.status ?? user.status) === 'Active';
      const otherAdmins = users.filter(u => u.id !== id && u.isAdmin === 'Yes' && u.status === 'Active').length;
      if (!staysAdmin && user.isAdmin === 'Yes' && user.status === 'Active' && otherAdmins === 0) {
        throw new HttpError(409, { code: 'LAST_ADMIN', message: 'This is the last active administrator. Make someone else an administrator first.' });
      }
      const row: Row = { ...(patch.name !== undefined && { name: patch.name }), ...(patch.email !== undefined && { email: patch.email }), ...(patch.status !== undefined && { status: patch.status }), ...(patch.isAdmin !== undefined && { isAdmin: patch.isAdmin ? 'Yes' : 'No' }) };
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', id, row);
      const updated = this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === id)!;
      return { ...userRow(updated), memberships: this.memberships(id) };
    });
  }

  /* ---------- project members ---------- */
  listMembers(projectId: string, actor: Actor) {
    this.svc.project(projectId);
    if (!actor.isAdmin) requireMember(actor, projectId);
    const users = new Map(this.store.readRows(SHEET.users, COLUMNS.users).map(u => [u.id, u]));
    return this.memberships().filter(m => m.projectId === projectId).map(m => ({
      userId: m.userId, name: users.get(m.userId)?.name ?? m.userId, email: users.get(m.userId)?.email ?? null, status: users.get(m.userId)?.status ?? 'Deactivated', role: m.role, title: m.title,
    }));
  }

  setMember(projectId: string, userId: string, body: unknown, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    const v = parse(memberBody, body);
    return this.store.withLock(() => {
      if (!this.store.readRows(SHEET.users, COLUMNS.users).some(u => u.id === userId)) throw notFound('NOT_FOUND', 'User not found.');
      const patch: Row = { role: v.role, title: v.title };
      if (!this.store.updateRow(SHEET.memberships, COLUMNS.memberships, 'userId', userId, patch, { projectId })) {
        this.store.appendRows(SHEET.memberships, COLUMNS.memberships, [{ projectId, userId, ...patch }]);
      }
      return { projectId, userId, ...patch };
    });
  }

  removeMember(projectId: string, userId: string, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    this.store.withLock(() => {
      const pms = this.memberships().filter(m => m.projectId === projectId && m.role === 'Project Manager');
      if (pms.length === 1 && pms[0].userId === userId) throw new HttpError(409, { code: 'LAST_PROJECT_MANAGER', message: 'A project needs at least one Project Manager. Assign another first.' });
      if (!this.store.deleteRow(SHEET.memberships, COLUMNS.memberships, 'userId', userId, { projectId })) throw notFound('NOT_FOUND', 'That user is not a member of this project.');
    });
  }
}
