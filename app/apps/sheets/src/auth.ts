import { HttpError } from './http';
import { COLUMNS, SHEET } from './datasets';
import type { Row, Store } from './store';

/** Project roles from the specification's role table (§2.1) that the pre-build distinguishes. */
export const ROLES = ['Project Manager', 'Manager', 'Leader', 'Team Member', 'Client'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may add or change project records. Client is read-only. */
export const WRITE_ROLES: readonly Role[] = ['Project Manager', 'Manager', 'Leader', 'Team Member'];
/** Roles that may delete records and switch modules on or off for their project. */
export const MANAGE_ROLES: readonly Role[] = ['Project Manager', 'Manager'];

export const ACCOUNT_STATES = ['Invited', 'Active', 'Suspended', 'Deactivated'] as const;

/** The organisation a person works for on the project. Decides which screens they are shown (Settings -> Party access). */
export const PARTIES = ['Contractor', 'Client', 'Subcontractor'] as const;
export type Party = (typeof PARTIES)[number];

export interface Actor {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  status: string;
  party: Party | null;
  /** projectId -> role */
  roles: Record<string, Role>;
}

const unauthorized = () => new HttpError(401, { code: 'USER_REQUIRED', message: 'Choose who you are before using the app.' });

/**
 * Resolves the acting user. The pre-build has no sign-in: the client states a user id and the backend trusts it
 * (behind the shared API token). Roles are still enforced so the permission model can be exercised.
 */
export function resolveActor(store: Store, userId: string | undefined): Actor {
  if (!userId) throw unauthorized();
  const user = store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === userId);
  if (!user || user.status !== 'Active') throw unauthorized();
  const roles: Record<string, Role> = {};
  for (const m of store.readRows(SHEET.memberships, COLUMNS.memberships)) {
    if (m.userId === userId && ROLES.includes(m.role as Role)) roles[String(m.projectId)] = m.role as Role;
  }
  return { id: String(user.id), name: String(user.name), email: (user.email as string) ?? null, isAdmin: user.isAdmin === 'Yes', status: String(user.status), party: PARTIES.find(p => p === user.party) ?? null, roles };
}

export const forbidden = (code: string, message: string) => new HttpError(403, { code, message });

export function requireAdmin(actor: Actor) {
  if (!actor.isAdmin) throw forbidden('ADMIN_REQUIRED', 'Only an organization administrator can do this.');
}

/** Business data needs project membership; administrators do not get business data automatically (spec §2.1). */
export function requireMember(actor: Actor, projectId: string): Role {
  const role = actor.roles[projectId];
  if (!role) throw forbidden('NOT_A_MEMBER', 'You are not a member of this project.');
  return role;
}

export function requireWrite(actor: Actor, projectId: string) {
  const role = requireMember(actor, projectId);
  if (!WRITE_ROLES.includes(role)) throw forbidden('READ_ONLY_ROLE', `${role} access is read-only.`);
  return role;
}

export function requireManage(actor: Actor, projectId: string) {
  const role = requireMember(actor, projectId);
  if (!MANAGE_ROLES.includes(role)) throw forbidden('MANAGER_REQUIRED', 'Only a Project Manager or Manager can do this.');
  return role;
}

/** Project configuration (modules, members): an administrator, or the project's Project Manager. */
export function requireConfigure(actor: Actor, projectId: string) {
  if (actor.isAdmin) return;
  if (actor.roles[projectId] !== 'Project Manager') throw forbidden('PROJECT_MANAGER_REQUIRED', 'Only an administrator or the Project Manager can configure this project.');
}

/** A user as the API shows it: never the password hash. */
export const userRow = (u: Row) => ({
  id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin === 'Yes', status: u.status, createdAt: u.createdAt,
  title: u.title ?? null, company: u.company ?? null, party: u.party ?? null, hasPassword: !!u.passwordHash, passwordChangedAt: u.passwordChangedAt ?? null,
});
