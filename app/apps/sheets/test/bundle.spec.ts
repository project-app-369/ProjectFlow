import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { FakeSpreadsheet } from './fake-gas';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Runs the built dist/Code.js in a context that has only Apps Script style globals (no Node, no URL, no TextEncoder),
 * so a dependency that assumes a browser or Node API fails here instead of after deployment.
 */
function loadBundle() {
  const ss = new FakeSpreadsheet();
  const props = new Map<string, string>();
  const alerts: string[] = [];
  let uuid = 0;
  const output = (text: string) => ({ text, mime: '', setMimeType(m: string) { this.mime = m; return this; } });
  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => Object.assign(ss, { getSpreadsheetTimeZone: () => 'Asia/Ho_Chi_Minh', deleteSheet: ss.deleteSheet.bind(ss) }),
      getUi: () => ({ alert: (t: string, m?: string) => alerts.push(`${t}|${m ?? ''}`), ButtonSet: { OK: 'OK' }, createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`, formatDate: (d: Date) => d.toISOString().slice(0, 10) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => void props.set(k, v) }) },
    ContentService: { createTextOutput: output, MimeType: { JSON: 'json' } },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
  };
  vm.runInNewContext(readFileSync(join(root, 'dist', 'Code.js'), 'utf8'), sandbox, { filename: 'Code.js' });
  const call = (fn: string, arg?: unknown) => (sandbox[fn] as (a?: unknown) => { text: string })(arg);
  const get = (path: string, token?: string, user = 'u-admin') => JSON.parse(call('doGet', { parameter: { path, token, user } }).text);
  const post = (body: unknown) => JSON.parse(call('doPost', { postData: { contents: JSON.stringify(body) } }).text);
  return { ss, props, alerts, call, get, post, sandbox };
}

describe('built Apps Script bundle', () => {
  beforeAll(() => { execFileSync(process.execPath, [join(root, 'scripts', 'build.mjs')], { cwd: root }); }, 60_000);

  it('exposes the entry points as global functions', () => {
    const { sandbox } = loadBundle();
    for (const fn of ['doGet', 'doPost', 'onOpen', 'setup', 'showToken']) expect(typeof sandbox[fn]).toBe('function');
  });

  it('asks for setup before the sheets exist, then serves data after setup', () => {
    const b = loadBundle();
    expect(b.get('/health')).toMatchObject({ ok: false, status: 503, error: { code: 'NOT_SET_UP' } });
    b.call('setup');
    expect(b.ss.getSheets().map(s => s.getName())).toEqual(['Settings - Projects', 'Settings - Users', 'Settings - Memberships', 'Settings - Modules', 'Settings - Module changes', 'Personal - Tasks', 'Personal - Subtasks', 'EPCIC - S-curve', 'EPCIC - Work packages', 'EPCIC - Milestones', 'EPCIC - Procurement packages', 'EPCIC - Expediting packages', 'Governance - Risks', 'Governance - Interfaces', 'Governance - Interface points', 'Reports - Cut-off snapshots', 'Reports - Snapshot data']);
    expect(b.alerts[0]).toContain('Sheets created');
    const health = b.get('/health', b.props.get('API_TOKEN'));
    expect(health).toMatchObject({ ok: true, data: { status: 'ok', database: 'sheets' } });
    expect(b.get('/projects/sttp2b/procurement/packages?pageSize=2', b.props.get('API_TOKEN')).data.total).toBe(137);
  });

  it('requires the API token once setup has created one', () => {
    const b = loadBundle();
    b.call('setup');
    expect(b.props.get('API_TOKEN')).toMatch(/^[0-9a-f]{64}$/);
    expect(b.get('/health')).toMatchObject({ ok: false, status: 401 });
    expect(b.get('/health', 'wrong')).toMatchObject({ ok: false, status: 401 });
    expect(b.post({ method: 'GET', path: '/health' })).toMatchObject({ ok: false, status: 401 });
  });

  it('handles writes through doPost and re-running setup changes nothing', () => {
    const b = loadBundle();
    b.call('setup');
    const token = b.props.get('API_TOKEN');
    const created = b.post({ method: 'POST', path: '/tasks', body: { title: 'from bundle', due: '2026-11-09', note: null }, token, user: 'u-admin' });
    expect(created).toMatchObject({ ok: true, status: 201 });
    const enabled = b.post({ method: 'PUT', path: '/projects/sttp2b/modules/hse', body: { state: 'Enabled' }, token, user: 'u-admin' });
    expect(enabled.data.sheet.name).toBe('EPCIC - HSE');
    b.call('setup');
    expect(b.alerts.at(-1)).toContain('Already set up');
    expect(b.get('/tasks', token).data.items.filter((t: any) => t.title === 'from bundle')).toHaveLength(1);
    expect(b.props.get('API_TOKEN')).toBe(token);
  });

  it('rejects malformed requests', () => {
    const b = loadBundle();
    b.call('setup');
    expect(JSON.parse(b.call('doPost', { postData: { contents: 'not json' } }).text)).toMatchObject({ ok: false, status: 400 });
    expect(b.get('', b.props.get('API_TOKEN'))).toMatchObject({ ok: true, data: { name: 'Project Flow sheets API' } });
  });
});
