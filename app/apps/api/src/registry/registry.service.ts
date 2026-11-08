import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { moduleStateChanges, projectModules } from '../db/schema';
import { ProjectsService } from '../projects/projects.service';
import { MANIFESTS, allowsWrites, defaultState, isEffective, validateStateChange, type OperationState, type StateMap } from './catalog';

@Injectable()
export class RegistryService {
  constructor(private readonly dbs: DbService, private readonly projects: ProjectsService) {}

  async states(projectId: string): Promise<StateMap> {
    await this.projects.require(projectId);
    const rows = await this.dbs.db.select().from(projectModules).where(eq(projectModules.projectId, projectId));
    const stored = new Map(rows.map(r => [r.moduleKey, r.state as OperationState]));
    return Object.fromEntries(MANIFESTS.map(m => [m.key, stored.get(m.key) ?? defaultState(m)]));
  }

  async list(projectId: string) {
    const states = await this.states(projectId);
    return MANIFESTS.map(m => ({ ...m, state: states[m.key], effective: isEffective(m.key, states) }));
  }

  async change(projectId: string, key: string, to: string, reason: string | undefined, actor: string) {
    const states = await this.states(projectId);
    const error = validateStateChange(key, to, states);
    if (error) throw new ConflictException(error);
    const from = states[key];
    if (from !== to) {
      await this.dbs.db.transaction(async tx => {
        await tx
          .insert(projectModules)
          .values({ projectId, moduleKey: key, state: to })
          .onConflictDoUpdate({ target: [projectModules.projectId, projectModules.moduleKey], set: { state: to, updatedAt: new Date() } });
        await tx.insert(moduleStateChanges).values({ id: randomUUID(), projectId, moduleKey: key, fromState: from, toState: to, reason: reason ?? null, actor });
      });
    }
    return (await this.list(projectId)).find(m => m.key === key)!;
  }

  history(projectId: string) {
    return this.dbs.db.select().from(moduleStateChanges).where(eq(moduleStateChanges.projectId, projectId)).orderBy(desc(moduleStateChanges.at)).limit(100);
  }

  /** Runtime check for data endpoints: disabled modules reject access; locked/read-only modules reject writes (MOD-04, MOD-08). */
  async assertAccess(projectId: string, key: string, write: boolean) {
    const states = await this.states(projectId);
    if (!isEffective(key, states)) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: `Module "${key}" is not enabled for this project.` });
    }
    if (write && !allowsWrites(states[key])) {
      throw new ForbiddenException({ code: 'MODULE_READ_ONLY', message: `Module "${key}" is ${states[key]} and does not accept changes.` });
    }
  }
}
