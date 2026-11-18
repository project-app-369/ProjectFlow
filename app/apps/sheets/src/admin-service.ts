import { z } from 'zod';
import type { AccessService } from './access-service';
import { ACCOUNT_STATES, PARTIES, ROLES, forbidden, requireAdmin, requireConfigure, requireMember, resolveActor, signSession, userRow, type Actor, type AuthOptions } from './auth';
import { COLUMNS, PROJECT_SHEETS, SHEET, type SheetKey } from './datasets';
import { MANIFESTS } from '../../api/src/registry/catalog';
import { hashPassword, verifyPassword } from './hash';
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
const person = { title: optText(120), company: optText(120), party: z.enum(PARTIES).nullish().transform(v => v ?? null) };
const userCreate = z.object({ name: z.string().trim().min(1).max(120), email, isAdmin: z.boolean().default(false), status: z.enum(ACCOUNT_STATES).default('Active'), ...person, password: z.string().min(8).max(100).optional() });
const userPatch = z.object({ name: z.string().trim().min(1).max(120), email, isAdmin: z.boolean(), status: z.enum(ACCOUNT_STATES), ...person }).partial();
/** What a person may change about themselves. Account state, party and administrator rights stay with administrators. */
const profilePatch = z.object({ name: z.string().trim().min(1).max(120), email, title: optText(120), company: optText(120) }).partial();
const passwordBody = z.object({ current: z.string().max(100).optional(), password: z.string().min(8, 'Use at least 8 characters.').max(100) });
const accessBody = z.object({ cells: z.array(z.object({ moduleKey: z.string().max(80), party: z.enum(PARTIES), visible: z.boolean() })).max(2000) });
const memberBody = z.object({ role: z.enum(ROLES), title: z.string().trim().max(120).nullish().transform(v => v ?? null) });

const loginBody = z.object({ email: z.string().trim().toLowerCase().max(160), password: z.string().min(1).max(100) });
const resetBody = z.object({ password: z.string().min(8, 'Use at least 8 characters.').max(100) });
/** Five wrong passwords lock the account for a quarter of an hour; an administrator can unlock it at once by resetting the password. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class AdminService {
  /** Set by Api once the access service exists (it needs this service's party rules, and this one writes to its log). */
  access!: AccessService;

  constructor(private readonly svc: Service, readonly auth?: AuthOptions) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }

  /* ---------- directory and identity ---------- */
  /** Who can be picked at the demo sign-in: active accounts, names only. */
  directory() {
    if (this.auth) throw new HttpError(404, { code: 'ROUTE_NOT_FOUND', message: 'The sign-in list is not offered when passwords are required.' });
    return this.store.readRows(SHEET.users, COLUMNS.users).filter(u => u.status === 'Active').map(u => ({ id: u.id, name: u.name, party: u.party ?? null, title: u.title ?? null }));
  }

  me(actor: Actor) {
    const row = this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === actor.id);
    return {
      id: actor.id, name: actor.name, email: actor.email, isAdmin: actor.isAdmin, status: actor.status, party: actor.party,
      title: row?.title ?? null, company: row?.company ?? null, hasPassword: !!row?.passwordHash, passwordChangedAt: row?.passwordChangedAt ?? null,
      /** Modules that the party of this person does not see (descendants included); administrators see everything. */
      hiddenModules: this.hiddenFor(actor),
      /** Per project: screens this person cannot open (party, role and personal settings together) and screens they can only read. */
      moduleAccess: Object.fromEntries(Object.keys(actor.roles).map(pid => [pid, this.access.summary(actor, pid)])),
      memberships: Object.entries(actor.roles).map(([projectId, role]) => ({ projectId, role })),
    };
  }

  /** Profile of the person acting: name, e-mail, title and company. */
  updateProfile(body: unknown, actor: Actor) {
    const patch = parse(profilePatch, body);
    return this.store.withLock(() => {
      const users = this.store.readRows(SHEET.users, COLUMNS.users);
      if (patch.email && users.some(u => u.id !== actor.id && String(u.email).toLowerCase() === patch.email)) throw new HttpError(409, { code: 'EMAIL_TAKEN', message: `${patch.email} already has an account.` });
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', actor.id, patch as Row);
      return this.me({ ...actor, name: patch.name ?? actor.name, email: patch.email ?? actor.email });
    });
  }

  /** Changing an existing password needs the current one; setting the first password does not. */
  changePassword(body: unknown, actor: Actor) {
    const v = parse(passwordBody, body);
    return this.store.withLock(() => {
      const user = this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === actor.id)!;
      if (user.passwordHash && !(v.current && verifyPassword(v.current, String(user.passwordHash)))) {
        throw new HttpError(400, { code: 'WRONG_PASSWORD', message: 'The current password is not correct.' });
      }
      const changedAt = this.now();
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', actor.id, { passwordHash: hashPassword(v.password, this.store.newId().slice(0, 12)), passwordChangedAt: changedAt });
      this.access.log(actor, 'password-change', actor.name, 'Changed their own password');
      return { changedAt };
    });
  }

  /* ---------- sign-in ---------- */
  /** Tells the web app whether to show the password form (a signing secret is configured) or the demo user picker. */
  authConfig() {
    return { mode: this.auth ? 'password' : 'demo', passwordMinLength: 8, lockAfter: MAX_FAILED_LOGINS, lockMinutes: LOCK_MINUTES };
  }

  /**
   * E-mail and password for a session token. Every failure that could reveal whether an account exists (unknown e-mail, no password,
   * wrong password, suspended account) is the same answer; only a lock says so, because it ends by itself.
   */
  login(body: unknown) {
    if (!this.auth) throw new HttpError(409, { code: 'AUTH_NOT_ENABLED', message: 'This deployment has no signing secret, so it runs in demo mode.' });
    const v = parse(loginBody, body);
    const invalid = new HttpError(401, { code: 'INVALID_LOGIN', message: 'The e-mail or password is not correct.' });
    return this.store.withLock(() => {
      const now = this.svc.clock();
      const user = this.store.readRows(SHEET.users, COLUMNS.users).find(u => String(u.email).toLowerCase() === v.email);
      if (!user || !user.passwordHash) { hashPassword(v.password, 'unknown-account'); throw invalid; } // spend the same time as a real check
      const lockedUntil = user.lockedUntil ? new Date(String(user.lockedUntil)).getTime() : 0;
      if (lockedUntil > now.getTime()) {
        const minutes = Math.ceil((lockedUntil - now.getTime()) / 60_000);
        throw new HttpError(429, { code: 'TOO_MANY_ATTEMPTS', message: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to reset the password.` });
      }
      if (!verifyPassword(v.password, String(user.passwordHash))) {
        const failed = Number(user.failedLogins ?? 0) + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        this.store.updateRow(SHEET.users, COLUMNS.users, 'id', String(user.id), { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null });
        this.access.log({ id: String(user.id), name: String(user.name) }, lock ? 'login-locked' : 'login-failed', String(user.name), lock ? `Locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} wrong passwords` : `Wrong password (${failed} of ${MAX_FAILED_LOGINS})`);
        throw invalid;
      }
      if (user.status !== 'Active') throw invalid;
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', String(user.id), { failedLogins: 0, lockedUntil: null, lastLoginAt: now.toISOString() });
      this.access.log({ id: String(user.id), name: String(user.name) }, 'login', String(user.name), 'Signed in');
      const actor = resolveActor(this.store, String(user.id));
      return { ...signSession(this.auth!, user, now), user: this.me(actor) };
    });
  }

  /** An administrator sets a person's password (the first one, or a reset): it also ends the lock and every session they had. */
  resetPassword(id: string, body: unknown, actor: Actor) {
    requireAdmin(actor);
    const v = parse(resetBody, body);
    return this.store.withLock(() => {
      const user = this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === id);
      if (!user) throw notFound('NOT_FOUND', 'User not found.');
      const changedAt = this.now();
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', id, { passwordHash: hashPassword(v.password, this.store.newId().slice(0, 12)), passwordChangedAt: changedAt, failedLogins: 0, lockedUntil: null });
      this.access.log(actor, 'password-reset', String(user.name), user.passwordHash ? 'Password reset by an administrator' : 'First password set by an administrator');
      return { changedAt };
    });
  }

  /* ---------- party access: which screens each party sees ---------- */
  private hiddenCells() {
    return this.store.readRows(SHEET.partyAccess, COLUMNS.partyAccess).filter(r => r.visible === 'No');
  }

  /** A hidden module hides everything under it. */
  hiddenFor(actor: Actor): string[] {
    if (actor.isAdmin || !actor.party) return [];
    const off = new Set(this.hiddenCells().filter(r => r.party === actor.party).map(r => String(r.moduleKey)));
    if (!off.size) return [];
    const parent = new Map<string, string | undefined>(MANIFESTS.map(m => [m.key, m.parent]));
    const hidden = (k: string): boolean => off.has(k) || (parent.get(k) ? hidden(parent.get(k)!) : false);
    return MANIFESTS.map(m => m.key).filter(hidden);
  }

  assertParty(actor: Actor, moduleKey: string) {
    if (this.hiddenFor(actor).includes(moduleKey)) throw forbidden('NOT_FOR_YOUR_PARTY', `This screen is not shared with ${actor.party}.`);
  }

  /** The matrix: every module and, per party, whether it is shown. */
  partyAccess(actor: Actor) {
    requireAdmin(actor);
    const off = new Set(this.hiddenCells().map(r => `${r.moduleKey}|${r.party}`));
    return {
      parties: [...PARTIES],
      modules: MANIFESTS.map(m => ({ key: m.key, label: m.label, workspace: m.workspace, parent: m.parent ?? null, depth: m.depth, availability: m.availability, visible: Object.fromEntries(PARTIES.map(p => [p, !off.has(`${m.key}|${p}`)])) })),
    };
  }

  setPartyAccess(body: unknown, actor: Actor) {
    requireAdmin(actor);
    const { cells } = parse(accessBody, body);
    const known = new Set(MANIFESTS.map(m => m.key));
    const bad = cells.find(c => !known.has(c.moduleKey));
    if (bad) throw new HttpError(400, { code: 'UNKNOWN_MODULE', message: `Unknown module ${bad.moduleKey}.` });
    this.store.withLock(() => {
      for (const c of cells) {
        const patch: Row = { visible: c.visible ? 'Yes' : 'No' };
        const was = this.store.readRows(SHEET.partyAccess, COLUMNS.partyAccess).find(r => r.moduleKey === c.moduleKey && r.party === c.party)?.visible !== 'No';
        if (!this.store.updateRow(SHEET.partyAccess, COLUMNS.partyAccess, 'moduleKey', c.moduleKey, patch, { party: c.party })) {
          this.store.appendRows(SHEET.partyAccess, COLUMNS.partyAccess, [{ moduleKey: c.moduleKey, party: c.party, ...patch }]);
        }
        if (was !== c.visible) this.access.log(actor, 'party-access', c.party, `${MANIFESTS.find(m => m.key === c.moduleKey)?.label ?? c.moduleKey}: ${c.visible ? 'shown' : 'hidden'}`);
      }
    });
    return this.partyAccess(actor);
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
      const dataSheets: SheetKey[] = PROJECT_SHEETS.filter(k => !['modules', 'moduleChanges', 'memberships', 'roleAccess', 'personAccess'].includes(k));
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
      const row: Row = { id: `u-${this.store.newId().slice(0, 8)}`, name: v.name, email: v.email, isAdmin: v.isAdmin ? 'Yes' : 'No', status: v.status, createdAt: this.now(), title: v.title, company: v.company, party: v.party, ...(v.password ? { passwordHash: hashPassword(v.password, this.store.newId().slice(0, 12)), passwordChangedAt: this.now() } : {}) };
      this.store.appendRows(SHEET.users, COLUMNS.users, [row]);
      this.access.log(actor, 'user-create', v.name, `${v.email}${v.isAdmin ? ', administrator' : ''}, ${v.status}${v.party ? `, ${v.party}` : ''}`);
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
      const leaves = patch.status !== undefined && patch.status !== 'Active' && user.status === 'Active';
      if (leaves) {
        const soleOf = this.svc.projectRows().find(p => {
          const pms = this.memberships().filter(m => m.projectId === p.id && m.role === 'Project Manager' && users.find(u => u.id === m.userId)?.status === 'Active');
          return pms.length === 1 && pms[0].userId === id;
        });
        if (soleOf) throw new HttpError(409, { code: 'LAST_PROJECT_MANAGER', message: `${user.name} is the only active Project Manager of ${soleOf.code}. Assign another first.` });
      }
      const was = (k: 'name' | 'email' | 'status' | 'isAdmin' | 'title' | 'company' | 'party') => (k === 'isAdmin' ? user.isAdmin === 'Yes' : user[k] ?? null);
      const changes = (['name', 'email', 'status', 'isAdmin', 'title', 'company', 'party'] as const).filter(k => patch[k] !== undefined && String(patch[k] ?? '') !== String(was(k) ?? '')).map(k => `${k}: ${was(k) ?? '—'} → ${patch[k] ?? '—'}`);
      const row: Row = { ...(patch.name !== undefined && { name: patch.name }), ...(patch.email !== undefined && { email: patch.email }), ...(patch.status !== undefined && { status: patch.status }), ...(patch.isAdmin !== undefined && { isAdmin: patch.isAdmin ? 'Yes' : 'No' }), ...(patch.title !== undefined && { title: patch.title }), ...(patch.company !== undefined && { company: patch.company }), ...(patch.party !== undefined && { party: patch.party }) };
      this.store.updateRow(SHEET.users, COLUMNS.users, 'id', id, row);
      if (changes.length) this.access.log(actor, 'user-update', String(user.name), changes.join('; '));
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
      const current = this.memberships().find(m => m.projectId === projectId && m.userId === userId);
      if (current?.role === 'Project Manager' && v.role !== 'Project Manager' && this.memberships().filter(m => m.projectId === projectId && m.role === 'Project Manager').length === 1) {
        throw new HttpError(409, { code: 'LAST_PROJECT_MANAGER', message: 'A project needs at least one Project Manager. Assign another first.' });
      }
      const patch: Row = { role: v.role, title: v.title };
      const who = String(this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === userId)?.name ?? userId);
      this.access.log(actor, current ? 'member-update' : 'member-add', who, current ? `${current.role} → ${v.role}` : v.role, projectId);
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
      this.access.dropPerson(projectId, userId);
      this.access.log(actor, 'member-remove', String(this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === userId)?.name ?? userId), 'Removed from the project', projectId);
    });
  }
}
