import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const listeners = new Map<string, () => void>();

beforeEach(() => {
  vi.useFakeTimers();
  store.clear();
  listeners.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  vi.stubGlobal('window', { addEventListener: (e: string, fn: () => void) => listeners.set(e, fn) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

const fresh = () => new QueryClient({ defaultOptions: { queries: { gcTime: 60_000 } } });

describe('query cache persistence', () => {
  it('saves what was fetched and restores it into a new client', async () => {
    const { persistQueryCache, restoreQueryCache } = await import('./persistCache');
    const a = fresh();
    persistQueryCache(a);
    await a.fetchQuery({ queryKey: ['dashboard', 'p1'], queryFn: async () => ({ progress: 27.1 }) });
    vi.advanceTimersByTime(2_000);
    expect(store.get('projectflow.query-cache.v1')).toContain('27.1');

    const b = fresh();
    restoreQueryCache(b);
    expect(b.getQueryData(['dashboard', 'p1'])).toEqual({ progress: 27.1 });
  });

  it('drops a cache that is older than a day or belongs to another backend', async () => {
    const { persistQueryCache, restoreQueryCache } = await import('./persistCache');
    const a = fresh();
    persistQueryCache(a);
    await a.fetchQuery({ queryKey: ['x'], queryFn: async () => 1 });
    vi.advanceTimersByTime(2_000);
    const saved = JSON.parse(store.get('projectflow.query-cache.v1')!);

    store.set('projectflow.query-cache.v1', JSON.stringify({ ...saved, savedAt: Date.now() - 25 * 3600_000 }));
    const old = fresh(); restoreQueryCache(old);
    expect(old.getQueryData(['x'])).toBeUndefined();
    expect(store.has('projectflow.query-cache.v1')).toBe(false);

    store.set('projectflow.query-cache.v1', JSON.stringify({ ...saved, scope: 'other' }));
    const other = fresh(); restoreQueryCache(other);
    expect(other.getQueryData(['x'])).toBeUndefined();
  });

  it('ignores a damaged cache and clears it on sign-out', async () => {
    const { persistQueryCache, restoreQueryCache } = await import('./persistCache');
    store.set('projectflow.query-cache.v1', '{not json');
    expect(() => restoreQueryCache(fresh())).not.toThrow();
    expect(store.has('projectflow.query-cache.v1')).toBe(false);
    persistQueryCache(fresh());
    store.set('projectflow.query-cache.v1', '{}');
    listeners.get('projectflow:signed-out')!();
    expect(store.has('projectflow.query-cache.v1')).toBe(false);
  });
});
