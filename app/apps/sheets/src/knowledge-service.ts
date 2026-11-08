import { z } from 'zod';
import { isEffective } from '../../api/src/registry/catalog';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, notFound, paginate, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

/**
 * The knowledge areas and their topics. Each area is a submodule of General Knowledge (`knowledge.<key>`),
 * so a project can switch whole areas on or off in Settings → Modules. "Other" keeps a topic filed
 * somewhere when no listed one fits.
 */
export const KNOWLEDGE_DOMAINS = [
  { key: 'engineering', label: 'Detailed Engineering', categories: ['Process', 'Safety', 'Structure', 'Piping', 'Mechanical', 'Electrical', 'Instrument', 'Telecom', 'Materials', 'Pipeline', 'Other'] },
  { key: 'procurement', label: 'Procurement', categories: ['Workflow', 'Policy', 'Other'] },
  { key: 'services', label: 'Services', categories: ['Facility', 'External yards', 'Services', 'Other'] },
  { key: 'quality', label: 'Quality', categories: ['Standard', 'Special requirement', 'Other'] },
  { key: 'hse', label: 'HSE', categories: ['Campaign', 'Event', 'Other'] },
  { key: 'construction', label: 'Construction', categories: ['Sequence', 'Plan', 'Layout', 'Methods', 'Other'] },
  { key: 'precom', label: 'Pre-com / Commissioning', categories: ['Sequence', 'System description', 'Other'] },
  { key: 'ti', label: 'T&I', categories: ['Sequence', 'Simulation', 'Other'] },
  { key: 'huc', label: 'HUC', categories: ['Campaign', 'Simulation', 'Other'] },
] as const;
export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number]['key'];
const DOMAIN_KEYS = KNOWLEDGE_DOMAINS.map(d => d.key) as [KnowledgeDomain, ...KnowledgeDomain[]];
export const KNOWLEDGE_STATUSES = ['Draft', 'Published'] as const;
const moduleOf = (domain: string) => `knowledge.${domain}`;

const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const source = z.object({
  title: z.string().trim().min(1).max(200),
  ref: txt(80),
  url: z.string().trim().max(500).regex(/^https?:\/\//i, 'Use a link that starts with http:// or https://').nullish().transform(v => v ?? null),
});
const fields = {
  domain: z.enum(DOMAIN_KEYS),
  category: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  body: z.string().max(30_000).transform(v => v.trim()),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).transform(v => [...new Set(v)]),
  sources: z.array(source).max(20),
  status: z.enum(KNOWLEDGE_STATUSES),
};
const knowledgeCreate = z.object({ ...fields, body: fields.body.default(''), tags: fields.tags.default([]), sources: fields.sources.default([]), status: fields.status.default('Published') });
const knowledgePatch = z.object(fields).partial();
const listQuery = z.object({
  domain: z.enum(DOMAIN_KEYS).optional(), category: z.string().max(60).optional(), status: z.enum(KNOWLEDGE_STATUSES).optional(),
  q: z.string().max(100).optional(), tag: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const issue = (path: string, message: string) => new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path, message }] });
const parseSources = (v: unknown): { title: string; ref: string | null; url: string | null }[] => {
  try { const x = JSON.parse(String(v ?? '[]')); return Array.isArray(x) ? x : []; } catch { return []; }
};

/** General Knowledge: short articles that generalize what the project documents say, filed by area and topic. */
export class KnowledgeService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private rows(projectId: string): Row[] { return this.svc.rows(SHEET.knowledge, COLUMNS.knowledge, projectId); }

  private users() { return new Map(this.store.readRows(SHEET.users, COLUMNS.users).map(u => [String(u.id), String(u.name)])); }

  private view(r: Row, users: Map<string, string>, withBody: boolean) {
    const domain = KNOWLEDGE_DOMAINS.find(d => d.key === r.domain);
    return {
      id: r.id, domain: r.domain, domainLabel: domain?.label ?? String(r.domain), category: r.category, title: r.title, summary: r.summary,
      ...(withBody && { body: r.body ?? '' }),
      tags: String(r.tags ?? '').split(',').map(t => t.trim()).filter(Boolean), sources: parseSources(r.sources), status: r.status,
      createdAt: r.createdAt, updatedAt: r.updatedAt, createdBy: users.get(String(r.createdBy)) ?? r.createdBy, updatedBy: users.get(String(r.updatedBy)) ?? r.updatedBy,
    };
  }

  /** Articles in areas whose submodule is switched on for the project. */
  private visible(projectId: string): Row[] {
    const states = this.svc.states(projectId);
    return this.rows(projectId).filter(r => isEffective(moduleOf(String(r.domain)), states));
  }

  private taxonomy(projectId: string) {
    const states = this.svc.states(projectId);
    return KNOWLEDGE_DOMAINS.map(d => ({ domain: d.key, label: d.label, moduleKey: moduleOf(d.key), categories: [...d.categories], enabled: isEffective(moduleOf(d.key), states) }));
  }

  list(projectId: string, raw: unknown) {
    const f = parse(listQuery, raw);
    const users = this.users();
    const q = f.q?.toLowerCase();
    const all = this.visible(projectId);
    const rows = all
      .filter(r => (!f.domain || r.domain === f.domain) && (!f.category || r.category === f.category) && (!f.status || r.status === f.status))
      .filter(r => !f.tag || String(r.tags ?? '').split(',').map(t => t.trim().toLowerCase()).includes(f.tag.toLowerCase()))
      .filter(r => !q || [r.id, r.title, r.summary, r.body, r.tags, r.category].some(x => String(x ?? '').toLowerCase().includes(q)))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.id).localeCompare(String(b.id)));
    const scope = f.domain ? all.filter(r => r.domain === f.domain) : all;
    const categories: Record<string, number> = {};
    for (const r of scope) categories[String(r.category)] = (categories[String(r.category)] ?? 0) + 1;
    return {
      items: paginate(rows, f).map(r => this.view(r, users, false)), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { categories, tags: [...new Set(scope.flatMap(r => String(r.tags ?? '').split(',').map(t => t.trim()).filter(Boolean)))].sort() },
    };
  }

  summary(projectId: string) {
    const users = this.users();
    const all = this.visible(projectId);
    const byDomain: Record<string, { total: number; byCategory: Record<string, number> }> = {};
    for (const r of all) {
      const d = (byDomain[String(r.domain)] ??= { total: 0, byCategory: {} });
      d.total++;
      d.byCategory[String(r.category)] = (d.byCategory[String(r.category)] ?? 0) + 1;
    }
    const recent = [...all].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6).map(r => this.view(r, users, false));
    return { total: all.length, drafts: all.filter(r => r.status === 'Draft').length, byDomain, recent, taxonomy: this.taxonomy(projectId) };
  }

  get(projectId: string, id: string) {
    const r = this.visible(projectId).find(x => x.id === id);
    if (!r) throw notFound('NOT_FOUND', `Article "${id}" was not found.`);
    return this.view(r, this.users(), true);
  }

  private checkCategory(domain: string, category: string) {
    const d = KNOWLEDGE_DOMAINS.find(x => x.key === domain);
    if (!d || !(d.categories as readonly string[]).includes(category)) throw issue('category', `Choose one of: ${d?.categories.join(', ') ?? 'n/a'}.`);
  }

  create(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(knowledgeCreate, body);
    this.svc.assertAccess(projectId, moduleOf(v.domain), true);
    this.checkCategory(v.domain, v.category);
    return this.store.withLock(() => {
      const max = this.rows(projectId).reduce((m, r) => Math.max(m, Number(String(r.id).replace(/^\D+/, '')) || 0), 0);
      const now = this.svc.clock().toISOString();
      const { tags, sources, ...rest } = v;
      const row: Row = { projectId, id: `KB-${String(max + 1).padStart(3, '0')}`, ...rest, tags: tags.join(','), sources: JSON.stringify(sources), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
      this.store.appendRows(SHEET.knowledge, COLUMNS.knowledge, [row]);
      return this.get(projectId, String(row.id));
    });
  }

  update(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(knowledgePatch, body);
    return this.store.withLock(() => {
      const current = this.rows(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Article "${id}" was not found.`);
      const domain = patch.domain ?? String(current.domain);
      const category = patch.category ?? String(current.category);
      this.svc.assertAccess(projectId, moduleOf(domain), true);
      if (patch.domain !== undefined || patch.category !== undefined) this.checkCategory(domain, category);
      const { tags, sources, ...rest } = patch;
      const row: Row = { ...(rest as Row), ...(tags !== undefined && { tags: tags.join(',') }), ...(sources !== undefined && { sources: JSON.stringify(sources) }), updatedAt: this.svc.clock().toISOString(), updatedBy: actor.id };
      this.store.updateRow(SHEET.knowledge, COLUMNS.knowledge, 'id', id, row, { projectId });
      return this.get(projectId, id);
    });
  }

  remove(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.knowledge, COLUMNS.knowledge, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Article "${id}" was not found.`);
    });
  }
}
