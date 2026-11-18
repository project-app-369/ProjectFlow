import { z } from 'zod';
import { MANIFEST_BY_KEY, MANIFESTS } from '../../api/src/registry/catalog';
import { ROLES, forbidden, requireConfigure, type Actor, type Role } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, notFound, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

/** What a person may do in a module: nothing (it is hidden and refused), read, or read and change. */
export const LEVELS = ['none', 'read', 'write'] as const;
export type Level = (typeof LEVELS)[number];
const RANK: Record<Level, number> = { none: 0, read: 1, write: 2 };
const lowest = (a: Level, b: Level): Level => (RANK[a] <= RANK[b] ? a : b);

/** The most a project role can ever do: a Client reads, everyone else may change records. */
export const roleCap = (role: Role): Level => (role === 'Client' ? 'read' : 'write');

const cell = z.object({ moduleKey: z.string().max(80), level: z.enum(LEVELS).nullable() });
const roleBody = z.object({ cells: z.array(cell.extend({ role: z.enum(ROLES) })).max(1000) });
const personBody = z.object({ cells: z.array(cell).max(500) });

/**
 * Who may open or change which module (spec §2.6), on top of the project role and the module's own state:
 *   1. a party that is not shown a screen never reaches it (Settings → Party access);
 *   2. the project role sets the ceiling (Client: read) and a per-project role matrix can lower it;
 *   3. a person's own setting replaces their role's, up to that ceiling.
 * A setting on a screen applies to the screens under it until they have a setting of their own.
 */
export class AccessService {
  constructor(private readonly svc: Service, private readonly hiddenForParty: (actor: Actor) => string[]) {}

  private get store() { return this.svc.store; }
  private ancestry(key: string): string[] {
    const out: string[] = [];
    for (let m = MANIFEST_BY_KEY.get(key); m; m = m.parent ? MANIFEST_BY_KEY.get(m.parent) : undefined) out.push(m.key);
    return out;
  }

  private roleRows(projectId: string) { return this.store.readRows(SHEET.roleAccess, COLUMNS.roleAccess).filter(r => r.projectId === projectId); }
  private personRows(projectId: string) { return this.store.readRows(SHEET.personAccess, COLUMNS.personAccess).filter(r => r.projectId === projectId); }

  private nearest(rows: Row[], key: string): Level | null {
    for (const k of this.ancestry(key)) {
      const found = rows.find(r => r.moduleKey === k && (LEVELS as readonly string[]).includes(String(r.level)));
      if (found) return found.level as Level;
    }
    return null;
  }

  /** The level one person has in one module of a project. Read the sheets once and pass them in when asking for many modules. */
  level(actor: Actor, projectId: string, key: string, cache?: { role: Row[]; person: Row[]; hidden: string[] }): Level {
    const role = actor.roles[projectId];
    if (!role) return 'none';
    const hidden = cache?.hidden ?? this.hiddenForParty(actor);
    if (hidden.includes(key)) return 'none';
    const cap = roleCap(role);
    const roleRows = (cache?.role ?? this.roleRows(projectId)).filter(r => r.role === role);
    const personRows = (cache?.person ?? this.personRows(projectId)).filter(r => r.userId === actor.id);
    const own = this.nearest(personRows, key) ?? this.nearest(roleRows, key) ?? cap;
    return lowest(own, cap);
  }

  /** Throws unless the person has the level the request needs. Reads need `read`, anything else `write`. */
  assert(actor: Actor, projectId: string, key: string, write: boolean) {
    const level = this.level(actor, projectId, key);
    if (level === 'none') throw forbidden('NO_ACCESS', 'You do not have access to this screen in this project.');
    if (write && level !== 'write') {
      const role = actor.roles[projectId];
      if (role && roleCap(role) === 'read') throw forbidden('READ_ONLY_ROLE', `${role} access is read-only.`);
      throw forbidden('READ_ONLY_FOR_YOU', 'You can read this screen but not change it.');
    }
  }

  /** For the web client: the screens this person cannot open, and those they can only read. */
  summary(actor: Actor, projectId: string) {
    const cache = { role: this.roleRows(projectId), person: this.personRows(projectId), hidden: this.hiddenForParty(actor) };
    const hidden: string[] = [], readOnly: string[] = [];
    for (const m of MANIFESTS) {
      const l = this.level(actor, projectId, m.key, cache);
      if (l === 'none') hidden.push(m.key); else if (l === 'read') readOnly.push(m.key);
    }
    return { hidden, readOnly };
  }

  /* ---------- audit trail ---------- */
  log(actor: { id: string; name: string } | null, action: string, target: string, detail: string, projectId: string | null = null) {
    this.store.appendRows(SHEET.accessLog, COLUMNS.accessLog, [{
      id: this.store.newId(), at: this.svc.clock().toISOString(), actor: actor?.id ?? null, actorName: actor?.name ?? null, action, target, detail, projectId,
    }]);
  }

  /** Newest first. An administrator sees everything; a Project Manager sees their project's entries. */
  entries(actor: Actor, raw: Record<string, string> = {}) {
    const projectId = raw.projectId || null;
    if (projectId) { this.svc.project(projectId); requireConfigure(actor, projectId); } else if (!actor.isAdmin) throw forbidden('ADMIN_REQUIRED', 'Only an administrator can read the whole access log.');
    const limit = Math.min(500, Math.max(1, Number(raw.limit) || 200));
    return this.store.readRows(SHEET.accessLog, COLUMNS.accessLog)
      .filter(r => !projectId || r.projectId === projectId)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, limit)
      .map(({ id, at, actor: a, actorName, action, target, detail, projectId: p }) => ({ id, at, actor: a, actorName, action, target, detail, projectId: p }));
  }

  /* ---------- role matrix ---------- */
  private moduleList() {
    return MANIFESTS.map(m => ({ key: m.key, label: m.label, workspace: m.workspace, parent: m.parent ?? null, depth: m.depth, availability: m.availability }));
  }

  /** Every module and, per project role, the level set for it (null: the role's default). */
  roleMatrix(projectId: string, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    const rows = this.roleRows(projectId);
    return {
      roles: [...ROLES], caps: Object.fromEntries(ROLES.map(r => [r, roleCap(r)])),
      modules: this.moduleList().map(m => ({ ...m, levels: Object.fromEntries(ROLES.map(r => [r, (rows.find(x => x.role === r && x.moduleKey === m.key)?.level as Level | undefined) ?? null])) })),
    };
  }

  setRoleAccess(projectId: string, body: unknown, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    const { cells } = parse(roleBody, body);
    this.assertKnown(cells);
    const clientWrite = cells.find(c => c.role === 'Client' && c.level === 'write');
    if (clientWrite) throw new HttpError(400, { code: 'CLIENT_READ_ONLY', message: 'The Client role is read-only and cannot be given write access.' });
    this.store.withLock(() => {
      for (const c of cells) {
        const was = this.roleRows(projectId).find(r => r.role === c.role && r.moduleKey === c.moduleKey)?.level ?? 'default';
        if (c.level === null) this.store.deleteRows(SHEET.roleAccess, COLUMNS.roleAccess, { projectId, role: c.role, moduleKey: c.moduleKey });
        else if (!this.store.updateRow(SHEET.roleAccess, COLUMNS.roleAccess, 'moduleKey', c.moduleKey, { level: c.level }, { projectId, role: c.role })) {
          this.store.appendRows(SHEET.roleAccess, COLUMNS.roleAccess, [{ projectId, role: c.role, moduleKey: c.moduleKey, level: c.level }]);
        }
        if ((c.level ?? 'default') !== was) this.log(actor, 'role-access', c.role, `${this.label(c.moduleKey)}: ${was} → ${c.level ?? 'default'}`, projectId);
      }
    });
    return this.roleMatrix(projectId, actor);
  }

  /* ---------- person overrides ---------- */
  private member(projectId: string, userId: string) {
    const m = this.store.readRows(SHEET.memberships, COLUMNS.memberships).find(x => x.projectId === projectId && x.userId === userId);
    if (!m) throw notFound('NOT_A_MEMBER', 'That person is not a member of this project.');
    return m;
  }

  /** One member's view: the level their role gives, their own setting if any, and what results. */
  personMatrix(projectId: string, userId: string, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    const member = this.member(projectId, userId);
    const user = this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === userId);
    const role = member.role as Role;
    const roleRows = this.roleRows(projectId).filter(r => r.role === role);
    const personRows = this.personRows(projectId).filter(r => r.userId === userId);
    const cap = roleCap(role);
    return {
      userId, name: user?.name ?? userId, role, cap, party: user?.party ?? null,
      modules: this.moduleList().map(m => {
        const byRole = lowest(this.nearest(roleRows, m.key) ?? cap, cap);
        const override = (personRows.find(r => r.moduleKey === m.key)?.level as Level | undefined) ?? null;
        const effective = lowest(this.nearest(personRows, m.key) ?? byRole, cap);
        return { ...m, byRole, override, effective };
      }),
    };
  }

  setPersonAccess(projectId: string, userId: string, body: unknown, actor: Actor) {
    this.svc.project(projectId);
    requireConfigure(actor, projectId);
    const { cells } = parse(personBody, body);
    this.assertKnown(cells);
    const member = this.member(projectId, userId);
    if (member.role === 'Client' && cells.some(c => c.level === 'write')) throw new HttpError(400, { code: 'CLIENT_READ_ONLY', message: 'A Client is read-only and cannot be given write access.' });
    const name = String(this.store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === userId)?.name ?? userId);
    this.store.withLock(() => {
      for (const c of cells) {
        const was = this.personRows(projectId).find(r => r.userId === userId && r.moduleKey === c.moduleKey)?.level ?? 'inherit';
        if (c.level === null) this.store.deleteRows(SHEET.personAccess, COLUMNS.personAccess, { projectId, userId, moduleKey: c.moduleKey });
        else if (!this.store.updateRow(SHEET.personAccess, COLUMNS.personAccess, 'moduleKey', c.moduleKey, { level: c.level }, { projectId, userId })) {
          this.store.appendRows(SHEET.personAccess, COLUMNS.personAccess, [{ projectId, userId, moduleKey: c.moduleKey, level: c.level }]);
        }
        if ((c.level ?? 'inherit') !== was) this.log(actor, 'person-access', name, `${this.label(c.moduleKey)}: ${was} → ${c.level ?? 'inherit'}`, projectId);
      }
    });
    return this.personMatrix(projectId, userId, actor);
  }

  /** A person who leaves a project takes their overrides with them. */
  dropPerson(projectId: string, userId: string) {
    this.store.deleteRows(SHEET.personAccess, COLUMNS.personAccess, { projectId, userId });
  }

  private label(key: string) { return MANIFEST_BY_KEY.get(key)?.label ?? key; }
  private assertKnown(cells: { moduleKey: string }[]) {
    const bad = cells.find(c => !MANIFEST_BY_KEY.has(c.moduleKey));
    if (bad) throw new HttpError(400, { code: 'UNKNOWN_MODULE', message: `Unknown module ${bad.moduleKey}.` });
  }
}
