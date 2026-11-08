import { apiMode, type ModuleInfo, type ModulesResponse, type WorkspaceId } from './api';

/** Module keys that have a real page in this build; the rest render a "not yet connected" placeholder. */
export const WIRED_KEYS = [
  'dashboard',
  'task-management.board',
  'planning.overall-progress',
  'planning.work-packages',
  'procurement.procurement-plan',
  'procurement.expediting.vendor-overview',
] as const;
/** Screens that only the sheets backend serves so far (NestJS parity is on the implementation plan). */
export const SHEETS_KEYS = ['task-management.calendar', 'task-management.workload', 'planning.milestones', 'management.risks', 'interface.register', 'interface.matrix', 'interface.points'] as const;
const wired = new Set<string>(apiMode === 'sheets' ? [...WIRED_KEYS, ...SHEETS_KEYS] : WIRED_KEYS);

export const kidsOf = (mods: ModuleInfo[], key: string) => mods.filter(m => m.parent === key && m.effective);

export function isWired(mods: ModuleInfo[], m: ModuleInfo): boolean {
  return wired.has(m.key) || kidsOf(mods, m.key).some(k => isWired(mods, k));
}

/** First effective descendant, preferring branches that have a real page. */
export function landing(mods: ModuleInfo[], key: string): string {
  const kids = kidsOf(mods, key);
  if (!kids.length) return key;
  return landing(mods, (kids.find(k => isWired(mods, k)) ?? kids[0]).key);
}

export function defaultKey(mods: ModuleInfo[], ws: WorkspaceId): string | null {
  const top = mods.filter(m => m.workspace === ws && !m.parent && m.effective);
  const first = top.find(m => isWired(mods, m)) ?? top[0];
  return first ? landing(mods, first.key) : null;
}

export function within(mods: ModuleInfo[], currentKey: string | undefined, m: ModuleInfo): boolean {
  const by = new Map(mods.map(x => [x.key, x]));
  for (let x = currentKey ? by.get(currentKey) : undefined; x; x = x.parent ? by.get(x.parent) : undefined) if (x.key === m.key) return true;
  return false;
}

/** Breadcrumb path: workspace / group / module / submodule. */
export function pathOf(data: ModulesResponse, key: string): string[] {
  const by = new Map(data.modules.map(m => [m.key, m]));
  const chain: ModuleInfo[] = [];
  for (let m = by.get(key); m; m = m.parent ? by.get(m.parent) : undefined) chain.unshift(m);
  if (!chain.length) return [];
  const ws = data.workspaces.find(w => w.id === chain[0].workspace)?.label ?? '';
  return [ws, ...(chain[0].group ? [chain[0].group] : []), ...chain.map(m => m.label)];
}

export function topModules(mods: ModuleInfo[], ws: WorkspaceId) {
  return mods.filter(m => m.workspace === ws && !m.parent);
}
