import { afterEach, describe, expect, it, vi } from 'vitest';

const ok = (data: unknown) => ({ ok: true, status: 200, data });
const json = (body: unknown) => Promise.resolve({ status: 200, json: () => Promise.resolve(body) } as Response);

async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_API_MODE', 'sheets');
  vi.stubEnv('VITE_SHEETS_URL', 'https://sheets.test/exec');
  vi.stubEnv('VITE_SHEETS_TOKEN', 't');
  return import('./api');
}

describe('requests made together', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('travel as one BATCH request and each caller gets its own answer', async () => {
    const calls: { url: string; body?: { method: string; requests: { path: string }[] } }[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      return json(body.requests.map((r: { path: string }) => ok({ path: r.path })));
    }));
    const { request } = await load();
    const [a, b, c] = await Promise.all([request<{ path: string }>('/a'), request<{ path: string }>('/b?x=1'), request<{ path: string }>('/c')]);
    expect([a.path, b.path, c.path]).toEqual(['/a', '/b?x=1', '/c']);
    expect(calls).toHaveLength(1);
    expect(calls[0].body?.method).toBe('BATCH');
    expect(calls[0].body?.requests.map(r => r.path)).toEqual(['/a', '/b?x=1', '/c']);
  });

  it('a single request is an ordinary GET, and one failing item rejects only its caller', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      urls.push(url);
      if (!init) return json(ok('alone'));
      const body = JSON.parse(String(init.body));
      return json([ok('fine'), { ok: false, status: 404, error: { code: 'NOT_FOUND', message: 'No such thing.' } }].slice(0, body.requests.length));
    }));
    const { request } = await load();
    expect(await request('/one')).toBe('alone');
    expect(urls[0]).toContain('path=%2Fone');
    const [x, y] = await Promise.allSettled([request('/x'), request('/y')]);
    expect(x).toMatchObject({ status: 'fulfilled', value: 'fine' });
    expect(y).toMatchObject({ status: 'rejected' });
    expect((y as PromiseRejectedResult).reason.message).toBe('No such thing.');
  });

  it('falls back to separate GETs when the backend does not know BATCH, and stops trying', async () => {
    const posts: number[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posts.push(1); return json({ ok: false, status: 400, error: { code: 'BAD_REQUEST', message: 'method and path are required.' } }); }
      return json(ok(new URL(url).searchParams.get('path')));
    }));
    const { request } = await load();
    expect(await Promise.all([request('/a'), request('/b')])).toEqual(['/a', '/b']);
    expect(await Promise.all([request('/c'), request('/d')])).toEqual(['/c', '/d']);
    expect(posts).toHaveLength(1);
  });
});
