import { describe, expect, it } from 'vitest';
import { MANIFESTS, MANIFEST_BY_KEY, defaultState, isEffective, validateStateChange, type StateMap } from './catalog';
import { overallProgress } from '../schedule/progress';

const defaults = (): StateMap => Object.fromEntries(MANIFESTS.map(m => [m.key, defaultState(m)]));

describe('module catalog', () => {
  it('has unique keys and resolvable parents', () => {
    expect(new Set(MANIFESTS.map(m => m.key)).size).toBe(MANIFESTS.length);
    for (const m of MANIFESTS) if (m.parent) expect(MANIFEST_BY_KEY.has(m.parent)).toBe(true);
  });

  it('keeps T&I apart from HUC and groups HUC with Onshore Precom-Commissioning', () => {
    expect(MANIFEST_BY_KEY.get('ti')!.group).toBe('Installation');
    expect(MANIFEST_BY_KEY.get('huc')!.group).toBe('Commissioning');
    expect(MANIFEST_BY_KEY.get('precom')!.group).toBe('Commissioning');
  });

  it('marks implemented modules and their ancestors Available', () => {
    expect(MANIFEST_BY_KEY.get('procurement.expediting.vendor-overview')!.availability).toBe('Available');
    expect(MANIFEST_BY_KEY.get('procurement.expediting')!.availability).toBe('Available');
    expect(MANIFEST_BY_KEY.get('procurement')!.availability).toBe('Available');
    expect(MANIFEST_BY_KEY.get('procurement.logistics')!.availability).toBe('Planned');
  });

  it('starts P1 modules enabled and later phases disabled', () => {
    const s = defaults();
    expect(s['procurement.procurement-plan']).toBe('Enabled');
    expect(s['management.risks']).toBe('Enabled');
    expect(s['ti']).toBe('Disabled');
  });
});

describe('state changes', () => {
  it('hides children of a disabled parent without changing their stored state', () => {
    const s: StateMap = { ...defaults(), procurement: 'Disabled' };
    expect(isEffective('procurement.expediting.vendor-overview', s)).toBe(false);
    expect(s['procurement.expediting.vendor-overview']).toBe('Enabled');
  });

  it('refuses to disable a core module', () => {
    expect(validateStateChange('dashboard', 'Disabled', defaults())?.code).toBe('CORE_MODULE');
  });

  it('refuses to disable a module another enabled module requires', () => {
    expect(validateStateChange('document-control', 'Disabled', defaults())?.code).toBe('REQUIRED_BY');
  });

  it('refuses to enable a module whose requirement is off', () => {
    const s: StateMap = { ...defaults(), engineering: 'Disabled', 'document-control': 'Disabled' };
    expect(validateStateChange('engineering', 'Enabled', s)?.code).toBe('REQUIRES');
  });

  it('rejects unknown modules and invalid states', () => {
    expect(validateStateChange('nope', 'Enabled', defaults())?.code).toBe('UNKNOWN_MODULE');
    expect(validateStateChange('hse', 'Maybe', defaults())?.code).toBe('INVALID_STATE');
  });

  it('allows a plain toggle', () => {
    expect(validateStateChange('hse', 'Enabled', defaults())).toBeNull();
    expect(validateStateChange('planning.milestones', 'Disabled', defaults())).toBeNull();
  });
});

describe('overall progress', () => {
  it('weights work packages and handles an empty set', () => {
    const wp = (weight: number, thisWeekActual: number) => ({ weight, lastWeekPlan: 0, lastWeekActual: 0, thisWeekPlan: 0, thisWeekActual });
    expect(overallProgress([wp(75, 40), wp(25, 80)]).thisWeekActual).toBe(50);
    expect(overallProgress([]).thisWeekActual).toBe(0);
  });
});
