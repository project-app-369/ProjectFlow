import { describe, expect, it } from 'vitest';
import type { ModuleInfo } from './api';
import { defaultKey, landing, pathOf } from './nav';

const mod = (key: string, over: Partial<ModuleInfo> = {}): ModuleInfo => ({
  key, label: key, workspace: 'epcic', order: 0, depth: 0, phase: 'P1', availability: 'Available', description: '', core: false,
  requires: [], state: 'Enabled', effective: true, ...over,
});

const mods: ModuleInfo[] = [
  mod('procurement', { label: 'Procurement' }),
  mod('procurement.plan-x', { parent: 'procurement', depth: 1 }),
  mod('procurement.procurement-plan', { parent: 'procurement', depth: 1, label: 'Procurement Plan' }),
  mod('dashboard', { label: 'Dashboard' }),
];

describe('navigation', () => {
  it('lands on the first effective child that has a real page', () => {
    expect(landing(mods, 'procurement')).toBe('procurement.procurement-plan');
  });

  it('skips children that are not effective', () => {
    const off = mods.map(m => (m.key === 'procurement.procurement-plan' ? { ...m, effective: false } : m));
    expect(landing(off, 'procurement')).toBe('procurement.plan-x');
  });

  it('picks the first wired top-level module as the workspace default', () => {
    expect(defaultKey(mods, 'epcic')).toBe('procurement.procurement-plan');
    expect(defaultKey(mods, 'reports')).toBeNull();
  });

  it('builds a breadcrumb with workspace and group', () => {
    const data = { workspaces: [{ id: 'epcic' as const, label: 'EPCIC' }], modules: [mod('ti', { label: 'T&I', group: 'Installation' }), mod('ti.workpacks', { label: 'Workpacks', parent: 'ti' })] };
    expect(pathOf(data, 'ti.workpacks')).toEqual(['EPCIC', 'Installation', 'T&I', 'Workpacks']);
  });
});
