/**
 * AI help for the Issues, Risks and Procurement-concerns registers, through the OpenAI API (the key stays on the server: the browser only sees the answers).
 *
 *   GET  /ai/status                          is the AI configured here?
 *   POST /projects/:pid/ai/analyse  {kind}   analysis of the register: themes, what to do first, gaps
 *   POST /projects/:pid/ai/extract  {kind, text, filename?}   items found in a minute, register or note, to be reviewed and then created through the register's own create route
 *
 * Nothing is written here. The register is read through the router (so a person only gets what they may open, and extraction needs write
 * access), then the model is called, then the answer is cleaned up against the register's own values before it is returned.
 * The hosts that can make an outgoing call (the local simulator and the Supabase function) mount `handleAi`; Apps Script does not.
 */
import type { Api } from './api';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, normPriority, normStatus } from './issues-service';
import { CONCERN_AREAS, CONCERN_STATUSES, CONCERN_TYPES, SEVERITIES } from './procurement-ops';
import { RISK_STATUSES, RISK_STRATEGIES, normRiskStatus, normStrategy } from './risk-matrix';
import type { ApiRequest, Envelope } from './router';

export type AiKind = 'issues' | 'risks' | 'concerns';
export const AI_KINDS: readonly AiKind[] = ['issues', 'risks', 'concerns'];
export interface AiConfig { apiKey?: string; model?: string; baseUrl?: string }
/** The text sent to the model is cut here (about 15 pages); the person is told when that happens. */
export const MAX_TEXT = 60_000;
const MAX_ITEMS = 200;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;
const clip = (v: unknown, n = 220) => (v == null || v === '' ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n));

/** What the model is shown of a register: the open and recent items in short form, plus the values a new item may take. */
export function aiContext(api: Api, projectId: string, kind: AiKind): Any {
  const project = api.svc.project(projectId);
  const base = { kind, project: { id: project.id, name: project.name, cutoff: project.cutoff }, today: api.svc.clock().toISOString().slice(0, 10) };
  const q = { pageSize: MAX_ITEMS };
  if (kind === 'issues') {
    const page = api.issues.list(projectId, q);
    return {
      ...base, total: page.total,
      items: page.items.map((r: Any) => ({ id: r.id, title: clip(r.title), priority: r.priority, status: r.status, discipline: r.discipline, pics: r.pics, due: r.dueDate, overdue: !!r.overdue, next: clip(r.nextAction, 160), remarks: clip(r.remarks, 160) })),
      options: { statuses: [...ISSUE_STATUSES], priorities: [...ISSUE_PRIORITIES], disciplines: page.facets.disciplines },
    };
  }
  if (kind === 'risks') {
    const page = api.risks.list(projectId, { ...q, status: 'Not closed' });
    const options = api.risks.options(projectId);
    return {
      ...base, total: page.total,
      items: page.items.map((r: Any) => ({ id: r.id, no: r.no, title: clip(r.title), status: r.status, rbs: r.rbs, category: r.category, owner: r.owner, level: r.currentLevel, score: r.currentScore, planDate: r.planDate, responseOverdue: !!r.responseOverdue, reviewOverdue: !!r.reviewOverdue, strategy: r.strategy, cause: clip(r.cause, 160), mitigation: clip(r.mitigationCause, 160) })),
      options: { statuses: [...RISK_STATUSES], strategies: [...RISK_STRATEGIES], rbs: options.breakdown.map((b: Any) => ({ code: b.code, category: b.categoryName ?? b.category, discipline: b.disciplineName ?? b.discipline })), owners: options.owners },
    };
  }
  const page = api.proc.concerns.list(projectId, q);
  return {
    ...base, total: page.total,
    items: page.items.map((r: Any) => ({ id: r.id, packageCode: r.packageCode, type: r.type, title: clip(r.title), severity: r.severity, area: r.area, owner: r.owner, due: r.dueDate, status: r.status, overdue: !!r.overdue, action: clip(r.action, 160) })),
    options: { types: [...CONCERN_TYPES], severities: [...SEVERITIES], areas: [...CONCERN_AREAS], statuses: [...CONCERN_STATUSES] },
  };
}

const KIND_NAME: Record<AiKind, string> = { issues: 'issues', risks: 'risks', concerns: 'procurement concerns (a concern may be typed Risk, Concern or Issue)' };

export function analysisPrompt(ctx: Any): { system: string; user: string } {
  const system = [
    'You are a project-controls analyst for an EPCIC offshore oil-and-gas project. You are given one register of the project as JSON and you analyse it for the project manager.',
    'Be specific and brief. Use only facts in the register; never invent items, ids, dates or numbers. Refer to items by their id.',
    'Reply with one JSON object and nothing else, in this shape:',
    '{"summary": string (at most 120 words: the state of the register and what matters most),',
    ' "themes": [{"title": string, "detail": string (at most 40 words), "ids": [string]}] (3 to 6 recurring subjects, such as one discipline, one vendor or one kind of delay),',
    ' "priorities": [{"id": string, "reason": string, "action": string}] (the 5 to 8 items that need attention first and what to do),',
    ' "gaps": [string] (missing owner, missing due date, overdue, no mitigation, duplicates, unclear wording),',
    ' "recommendations": [string] (3 to 6 management actions)}',
  ].join('\n');
  const user = `Register: ${KIND_NAME[ctx.kind as AiKind]}. Project: ${ctx.project?.name}. Reporting cut-off: ${ctx.project?.cutoff}. Today: ${ctx.today}. Items shown: ${ctx.items.length} of ${ctx.total}.\n${JSON.stringify({ items: ctx.items, options: ctx.options })}`;
  return { system, user };
}

const FIELDS: Record<AiKind, string> = {
  issues: [
    '"title" (short, at most 120 characters), "description", "priority" (one of Critical, High, Medium, Low), "discipline" (the team named, if any),',
    '"status" (one of Not started, In progress, Pending, Completed), "startDate" and "dueDate" (YYYY-MM-DD), "nextAction", "remarks", "pics" (e-mail addresses, only if they are written in the text)',
  ].join(' '),
  risks: [
    '"title" (short), "description", "cause", "effect", "owner" (the person or team named, as written), "status" (one of New, Firmed, Under assessment, Under resolving, Monitor, Closed),',
    '"rbs" (the code from the list of risk breakdown codes below that fits best, or null), "strategy" (one of Avoid, Mitigate, Transfer, Accept, Escalate, or null), "mitigationCause" (actions against the cause),',
    '"mitigationEffect" (actions against the effect), "planDate" (YYYY-MM-DD when the response is due), "remark"',
  ].join(' '),
  concerns: [
    '"title" (short), "description", "type" (one of Risk, Concern, Issue), "severity" (one of Low, Medium, High, Critical), "area" (one of Schedule, Cost, Quality, Delivery, Documentation, Contractual, Other),',
    '"packageCode" (the procurement package code if one is named), "owner", "raisedDate" and "dueDate" (YYYY-MM-DD), "status" (one of Open, Mitigating, Resolved, Closed), "action"',
  ].join(' '),
};

export function extractionPrompt(ctx: Any, text: string, filename?: string): { system: string; user: string } {
  const known = (ctx.items as Any[]).map(i => `${i.id}: ${i.title}`).join('\n');
  const system = [
    `You read project documents (meeting minutes, registers, e-mails, notes) of an EPCIC offshore project and pick out the ${KIND_NAME[ctx.kind as AiKind]} they record, so that a person can review them and add them to the project's register.`,
    'Rules: one entry per distinct item; split a list of items into separate entries; take only what the document says, never invent; leave a value null when the document does not give it; keep the document\'s wording for titles and descriptions (shortened, not rephrased into something new);',
    'dates as YYYY-MM-DD (a date without a year is the nearest to today); do not list the same item twice; ignore decisions, information and chatter that are not items for this register.',
    `Each entry has the fields ${FIELDS[ctx.kind as AiKind]}, plus "source" (the sentence or line of the document it came from, at most 200 characters), "confidence" (0 to 1: how sure you are that this is an item of this register and that the fields are right) and "duplicateOf" (the id of an item already in the register that says the same thing, else null).`,
    'Reply with one JSON object and nothing else: {"items": [entry, ...], "notes": string (anything the reviewer should know, such as parts that could not be read or unclear items; at most 80 words)}.',
  ].join('\n');
  const rbs = ctx.kind === 'risks' ? `\nRisk breakdown codes: ${JSON.stringify(ctx.options.rbs)}` : '';
  const user = `Project: ${ctx.project?.name}. Today: ${ctx.today}.${rbs}\nItems already in the register (to spot duplicates):\n${known || '(none)'}\n\nDocument${filename ? ` "${filename}"` : ''}:\n"""\n${text}\n"""`;
  return { system, user };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v.trim()) && !Number.isNaN(Date.parse(v.trim())) ? v.trim() : null);
const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => list.find(x => x.toLowerCase() === String(v ?? '').trim().toLowerCase()) ?? fallback;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The model's entries cut to what the register accepts (values it does not know are normalised, text is limited), each with the id it may duplicate. */
export function cleanCandidates(kind: AiKind, raw: unknown, ctx: Any): Any[] {
  const list = Array.isArray((raw as Any)?.items) ? ((raw as Any).items as Any[]) : [];
  const ids = new Set((ctx.items as Any[]).map(i => String(i.id)));
  const rbs = new Set<string>((ctx.options?.rbs ?? []).map((b: Any) => String(b.code)));
  const out: Any[] = [];
  for (const e of list.slice(0, 100)) {
    if (!e || typeof e !== 'object') continue;
    const title = text(e.title, 200);
    if (!title) continue;
    const extra = {
      source: text(e.source, 300), confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, Math.round(e.confidence * 100) / 100)) : null,
      duplicateOf: typeof e.duplicateOf === 'string' && ids.has(e.duplicateOf) ? e.duplicateOf : null,
    };
    if (kind === 'issues') {
      out.push({
        title, description: text(e.description, 2000), priority: normPriority(e.priority), discipline: text(e.discipline, 60), status: normStatus(e.status),
        startDate: date(e.startDate), dueDate: date(e.dueDate), nextAction: text(e.nextAction, 1500), remarks: text(e.remarks, 1500),
        pics: [...new Set((Array.isArray(e.pics) ? e.pics : []).map((p: unknown) => String(p).trim().toLowerCase()).filter((p: string) => EMAIL.test(p)))].slice(0, 10), ...extra,
      });
    } else if (kind === 'risks') {
      const code = typeof e.rbs === 'string' && rbs.has(e.rbs.trim()) ? e.rbs.trim() : null;
      out.push({
        title, description: text(e.description, 3000), cause: text(e.cause, 3000), effect: text(e.effect, 3000), owner: text(e.owner, 120), status: normRiskStatus(e.status), rbs: code,
        strategy: normStrategy(e.strategy), mitigationCause: text(e.mitigationCause, 3000), mitigationEffect: text(e.mitigationEffect, 3000), planDate: date(e.planDate), remark: text(e.remark, 2000), ...extra,
      });
    } else {
      out.push({
        title, description: text(e.description, 1500), type: oneOf(e.type, CONCERN_TYPES, 'Concern'), severity: oneOf(e.severity, SEVERITIES, 'Medium'), area: oneOf(e.area, CONCERN_AREAS, 'Other'),
        packageCode: text(e.packageCode, 60), owner: text(e.owner, 80), raisedDate: date(e.raisedDate), dueDate: date(e.dueDate), status: oneOf(e.status, CONCERN_STATUSES, 'Open'), action: text(e.action, 1500), ...extra,
      });
    }
  }
  return out;
}

/** The analysis cleaned up: only ids that are in the register, strings only, lists of sensible length. */
export function cleanAnalysis(raw: unknown, ctx: Any): Any {
  const a = (raw ?? {}) as Any;
  const ids = new Set((ctx.items as Any[]).map(i => String(i.id)));
  const idList = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(i => ids.has(i)) : []);
  const strings = (v: unknown, n: number) => (Array.isArray(v) ? v.map(x => text(x, 400)).filter((x): x is string => !!x).slice(0, n) : []);
  const rows = (v: unknown) => (Array.isArray(v) ? (v as Any[]) : []);
  return {
    summary: text(a.summary, 1200) ?? '',
    themes: rows(a.themes).map(t => ({ title: text(t?.title, 120), detail: text(t?.detail, 400), ids: idList(t?.ids) })).filter(t => t.title).slice(0, 8),
    priorities: rows(a.priorities).map(p => ({ id: String(p?.id ?? ''), reason: text(p?.reason, 300), action: text(p?.action, 300) })).filter(p => ids.has(p.id)).slice(0, 10),
    gaps: strings(a.gaps, 10), recommendations: strings(a.recommendations, 8),
  };
}

const fail = (status: number, code: string, message: string): Envelope => ({ ok: false, status, error: { code, message } });

/** One chat completion that must answer with a JSON object. */
export async function askModel(cfg: AiConfig, system: string, user: string, fetchImpl: typeof fetch = fetch): Promise<Any> {
  const res = await fetchImpl(`${(cfg.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(110_000),
  });
  const body = await res.text();
  if (!res.ok) {
    let message = `The AI service answered ${res.status}.`;
    try { message = String(JSON.parse(body)?.error?.message ?? message); } catch { /* not JSON */ }
    throw Object.assign(new Error(message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-…')), { upstream: res.status });
  }
  const content = JSON.parse(body)?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('The AI service returned no answer.');
  return JSON.parse(content);
}

const PATH = /^\/projects\/([^/?]+)\/ai\/(analyse|extract)$/;

/**
 * Answers the AI routes, or returns null for any other request. `run` sends a request through the router (and its access rules) of the host.
 * The register is read first, so a refusal (no access, no write right, unknown project) comes back before anything is sent to the model.
 */
export async function handleAi(payload: Partial<ApiRequest>, run: (r: ApiRequest) => Promise<Envelope>, cfg: AiConfig, fetchImpl: typeof fetch = fetch): Promise<Envelope | null> {
  const path = String(payload.path ?? '').split('?')[0];
  if (path === '/ai/status') return { ok: true, status: 200, data: { enabled: !!cfg.apiKey, model: cfg.apiKey ? cfg.model ?? null : null } };
  const m = PATH.exec(path);
  if (!m) return null;
  if ((payload.method ?? 'GET') !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  const body = (payload.body ?? {}) as Any;
  const kind = body.kind as AiKind;
  if (!AI_KINDS.includes(kind)) return fail(400, 'BAD_REQUEST', 'kind must be issues, risks or concerns.');
  const extract = m[2] === 'extract';
  const doc = typeof body.text === 'string' ? body.text.trim() : '';
  if (extract && doc.length < 20) return fail(400, 'BAD_REQUEST', 'The document has no text to read.');
  const context = await run({ method: extract ? 'POST' : 'GET', path: `/projects/${m[1]}/ai/context/${kind}`, body: extract ? {} : undefined, user: payload.user, session: payload.session });
  if (!context.ok) return context;
  if (!cfg.apiKey || !cfg.model) return fail(503, 'AI_NOT_CONFIGURED', 'The AI service is not set up on this server (OPENAI_API_KEY and OPENAI_MODEL).');
  const ctx = context.data as Any;
  try {
    if (!extract) {
      if (!ctx.items.length) return fail(422, 'NOTHING_TO_ANALYSE', 'The register has no items to analyse.');
      const p = analysisPrompt(ctx);
      return { ok: true, status: 200, data: { kind, model: cfg.model, analysis: cleanAnalysis(await askModel(cfg, p.system, p.user, fetchImpl), ctx), itemsRead: ctx.items.length, itemsTotal: ctx.total } };
    }
    const cut = doc.length > MAX_TEXT;
    const p = extractionPrompt(ctx, cut ? doc.slice(0, MAX_TEXT) : doc, typeof body.filename === 'string' ? body.filename.slice(0, 120) : undefined);
    const answer = await askModel(cfg, p.system, p.user, fetchImpl);
    const notes = [text(answer.notes, 600), cut ? `The document is longer than ${MAX_TEXT.toLocaleString('en-US')} characters: only the beginning was read.` : null].filter(Boolean).join(' ');
    return { ok: true, status: 200, data: { kind, model: cfg.model, items: cleanCandidates(kind, answer, ctx), notes: notes || null, truncated: cut } };
  } catch (e) {
    const upstream = (e as { upstream?: number }).upstream;
    const msg = e instanceof Error ? e.message : 'The AI service failed.';
    if (upstream === 429) return fail(502, 'AI_QUOTA', `The AI service refused the request (quota or rate limit): ${msg}`);
    return fail(502, 'AI_ERROR', upstream ? `The AI service refused the request: ${msg}` : msg);
  }
}

