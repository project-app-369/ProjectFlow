import { beforeEach, describe, expect, it } from 'vitest';
import { analysisPrompt, cleanAnalysis, cleanCandidates, extractionPrompt, handleAi, aiContext, type AiConfig } from '../src/ai';
import { Api } from '../src/api';
import { MemoryStore } from '../src/memory-store';
import { handle, type ApiRequest, type Envelope } from '../src/router';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const P = 'sttp2b';
const CFG: AiConfig = { apiKey: 'sk-test-key-0123456789', model: 'test-model' };
let api: Api;
const run = (r: ApiRequest): Promise<Envelope> => Promise.resolve(handle(api, r));
const as = (user: string, body: unknown, path: string) => ({ method: 'POST', path: `/projects/${P}/ai/${path}`, body, user });
const answering = (content: unknown, sent: { body?: any }[] = [], status = 200) => (async (_url: string | URL | Request, init?: RequestInit) => {
  sent.push({ body: JSON.parse(String(init?.body)) });
  return new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }) : JSON.stringify({ error: { message: 'You have no credits remaining. sk-test-key-0123456789' } }), { status });
}) as unknown as typeof fetch;
const data = (e: Envelope | null) => { expect(e && e.ok, JSON.stringify(e)).toBe(true); return (e as Extract<Envelope, { ok: true }>).data as any; };

beforeEach(() => {
  const store = new MemoryStore();
  seedStore(store, seedData);
  api = new Api(store, () => new Date('2026-11-08T10:00:00Z'));
});

describe('AI helpers', () => {
  it('reports whether the service is configured, and answers nothing for other routes', async () => {
    expect(data(await handleAi({ method: 'GET', path: '/ai/status' }, run, CFG))).toEqual({ enabled: true, model: 'test-model' });
    expect(data(await handleAi({ method: 'GET', path: '/ai/status' }, run, {}))).toEqual({ enabled: false, model: null });
    expect(await handleAi({ method: 'GET', path: `/projects/${P}/issues` }, run, CFG)).toBeNull();
  });

  it('reads each register in short form with the values a new item may take', () => {
    const issues = aiContext(api, P, 'issues');
    expect(issues.items.length).toBeGreaterThan(0);
    expect(issues.options.priorities).toContain('Critical');
    const risks = aiContext(api, P, 'risks');
    expect(risks.options.strategies).toContain('Mitigate');
    expect(risks.options.rbs.length).toBeGreaterThan(0);
    const concerns = aiContext(api, P, 'concerns');
    expect(concerns.options.types).toEqual(['Risk', 'Concern', 'Issue']);
  });

  it('analyses a register, keeping only ids that exist and sending the register with the question', async () => {
    const sent: { body?: any }[] = [];
    const id = aiContext(api, P, 'issues').items[0].id;
    const out = data(await handleAi(as('u-admin', { kind: 'issues' }, 'analyse'), run, CFG, answering({
      summary: 'Two things matter.', themes: [{ title: 'Delays', detail: 'Late items', ids: [id, 'ISS-9999'] }],
      priorities: [{ id, reason: 'Overdue', action: 'Call the vendor' }, { id: 'ISS-9999', reason: 'invented', action: 'x' }], gaps: ['No owner'], recommendations: ['Meet weekly'],
    }, sent)));
    expect(out.analysis.themes[0].ids).toEqual([id]);
    expect(out.analysis.priorities.map((p: any) => p.id)).toEqual([id]);
    expect(sent[0].body.model).toBe('test-model');
    expect(sent[0].body.messages[1].content).toContain(id);
    expect(JSON.stringify(out)).not.toContain('sk-test');
  });

  it('extracts items from a document, normalising values and flagging a duplicate of an existing item', async () => {
    const existing = aiContext(api, P, 'issues').items[0];
    const out = data(await handleAi(as('u-admin', { kind: 'issues', text: 'MOM 12 Nov. Item 1: vendor drawings late, HIGH, due 20 Nov 2026 (jane@example.com). '.repeat(2), filename: 'mom.txt' }, 'extract'), run, CFG, answering({
      items: [
        { title: 'Vendor drawings are late', priority: 'HIGH', status: 'in progess', dueDate: '2026-11-20', pics: ['Jane@Example.com', 'not-an-email'], source: 'Item 1', confidence: 0.9, duplicateOf: null },
        { title: existing.title, priority: 'urgent??', dueDate: '20/11/2026', duplicateOf: existing.id, confidence: 3 },
        { description: 'no title, dropped' },
      ],
      notes: 'ok',
    })));
    expect(data({ ok: true, status: 200, data: out }).items).toHaveLength(2);
    expect(out.items[0]).toMatchObject({ priority: 'High', status: 'In progress', dueDate: '2026-11-20', pics: ['jane@example.com'], duplicateOf: null });
    expect(out.items[1]).toMatchObject({ priority: 'Medium', dueDate: null, duplicateOf: existing.id, confidence: 1 });
  });

  it('cleans risk and concern entries against the register values', () => {
    const risks = aiContext(api, P, 'risks');
    const code = risks.options.rbs[0].code;
    const [risk] = cleanCandidates('risks', { items: [{ title: 'Late steel', status: 'under resolving', rbs: code, strategy: 'mitigate', planDate: '2026-12-01', owner: 'TD Luu' }, { title: 'Other', rbs: 'ZZ.99', strategy: 'wish' }] }, risks);
    expect(risk).toMatchObject({ status: 'Under resolving', rbs: code, strategy: 'Mitigate', owner: 'TD Luu' });
    expect(cleanCandidates('risks', { items: [{ title: 'Other', rbs: 'ZZ.99', strategy: 'wish' }] }, risks)[0]).toMatchObject({ rbs: null, strategy: null });
    const concerns = aiContext(api, P, 'concerns');
    expect(cleanCandidates('concerns', { items: [{ title: 'Late', type: 'issue', severity: 'critical', area: 'logistics' }] }, concerns)[0]).toMatchObject({ type: 'Issue', severity: 'Critical', area: 'Other', status: 'Open' });
  });

  it('refuses before calling the model: a read-only user may analyse but not extract, and a short or missing document is refused', async () => {
    const sent: { body?: any }[] = [];
    const model = answering({ items: [], summary: 's' }, sent);
    const refused = await handleAi(as('u-client', { kind: 'issues', text: 'x'.repeat(100) }, 'extract'), run, CFG, model);
    expect(refused && !refused.ok && refused.status).toBe(403);
    expect(sent).toHaveLength(0);
    expect((await handleAi(as('u-admin', { kind: 'issues', text: 'short' }, 'extract'), run, CFG, model) as any).status).toBe(400);
    expect((await handleAi(as('u-admin', { kind: 'nope' }, 'analyse'), run, CFG, model) as any).status).toBe(400);
    expect((await handleAi(as('u-admin', { kind: 'issues' }, 'analyse'), run, {}, model) as any).error.code).toBe('AI_NOT_CONFIGURED');
    expect(data(await handleAi(as('u-client', { kind: 'issues' }, 'analyse'), run, CFG, model)).analysis).toBeDefined();
  });

  it('reports the service\'s refusal without the key', async () => {
    const e = await handleAi(as('u-admin', { kind: 'issues' }, 'analyse'), run, CFG, answering({}, [], 429));
    expect(e && !e.ok && e.error.code).toBe('AI_QUOTA');
    expect(JSON.stringify(e)).not.toContain('sk-test-key');
  });

  it('builds prompts that name the allowed values and the document', () => {
    const ctx = aiContext(api, P, 'risks');
    expect(extractionPrompt(ctx, 'Some minutes of the meeting', 'mom.txt').user).toContain('mom.txt');
    expect(extractionPrompt(ctx, 'x', undefined).system).toContain('Under assessment');
    expect(analysisPrompt(ctx).system).toContain('priorities');
    expect(cleanAnalysis(null, ctx).themes).toEqual([]);
  });
});
