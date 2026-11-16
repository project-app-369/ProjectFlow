import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import { risksInsights, withinPredicate } from './insights';
import {
  IMPACT_DIMENSIONS, MATRIX_V1, RISK_STATUSES, RISK_STRATEGIES, isActiveRisk, levelRank, matrixFromRows, normRating, normRiskStatus, normStrategy, rate,
  type RiskMatrix,
} from './risk-matrix';
import type { Service } from './service';
import type { Row } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const score = z.number().int().min(1).max(10).nullish().transform(v => v ?? null);
const ratingFields = Object.fromEntries((['pre', 'post'] as const).flatMap(p => [[`${p}Probability`, score], ...IMPACT_DIMENSIONS.map(([k]) => [`${p}${k}`, score])])) as Record<string, typeof score>;

const riskFields = {
  title: z.string().trim().min(1).max(200), status: z.enum(RISK_STATUSES), rbs: z.string().trim().min(1).max(20),
  description: txt(3000), cause: txt(3000), effect: txt(3000), owner: z.string().trim().min(1).max(120), recordDate: isoOpt,
  strategy: z.enum(RISK_STRATEGIES).nullish().transform(v => v ?? null), mitigationCause: txt(3000), mitigationEffect: txt(3000),
  planDate: isoOpt, actualActions: txt(3000), actualDate: isoOpt, remark: txt(2000), external: z.boolean(), reviewDate: isoOpt, milestoneId: txt(40),
  ...ratingFields,
};
const riskCreate = z.object({ ...riskFields, status: riskFields.status.default('New'), external: riskFields.external.default(false) });
const riskPatch = z.object(riskFields).partial();
const actionFields = { action: z.string().trim().min(1).max(1000), owner: txt(120), dueDate: isoOpt, done: z.boolean() };
const actionCreate = z.object({ ...actionFields, done: actionFields.done.default(false) });
const actionPatch = z.object(actionFields).partial();
const riskQuery = listQuery(['id', 'no', 'title', 'currentScore', 'currentRank', 'preScore', 'status', 'planDate', 'recordDate', 'owner', 'discipline', 'category'] as const).extend({
  category: z.string().max(60).optional(), level: z.string().max(20).optional(), owner: z.string().max(120).optional(), strategy: z.string().max(20).optional(),
  flag: z.enum(['response-overdue', 'review-overdue', 'unrated', 'awaiting-post', 'external', 'active']).optional(), within: z.string().max(10).optional(),
  cell: z.string().regex(/^\d{1,2}-\d{1,2}$/).optional(), basis: z.enum(['pre', 'current']).optional(),
});

/** "TD Luu/ PT Son", "CV Phong & DH Tien": a risk may name several owners. */
export const ownersOf = (v: unknown) => [...new Set(String(v ?? '').split(/\s*(?:\/|;|,|&|\band\b)\s*/).map(s => s.trim()).filter(Boolean))];
const responseWithin = withinPredicate(r => (r.planDate ? String(r.planDate) : null), r => !!r.active && !r.actualDate);

/** Mitigation text of the workbook ("1. Expedite vendor\n2. Evaluate air freight") as separate actions; sub-bullets stay with their item. */
export function splitActions(text: string | null | undefined): string[] {
  if (!text) return [];
  const items: string[] = [];
  for (const line of String(text).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const start = /^(\d+[.)]|-|•)\s+/.exec(t);
    if (start || !items.length) items.push(t.replace(/^(\d+[.)]|-|•)\s+/, ''));
    else items[items.length - 1] += `\n${t}`;
  }
  return items;
}

/**
 * Risk management (spec MGT-01, MGT-06): the project's register with its own matrix and RBS, ratings per impact dimension
 * before and after mitigation, tracked mitigation actions, and dates judged against the reporting cut-off.
 */
export class RisksService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }
  private rows(projectId: string) { return this.svc.rows(SHEET.risks, COLUMNS.risks, projectId); }
  private actionRows(projectId: string) { return this.svc.rows(SHEET.riskActions, COLUMNS.riskActions, projectId); }

  /** The project's matrix from its sheet, or the 5 x 5 matrix v1 when the project has none. */
  matrixOf(projectId: string): RiskMatrix {
    return matrixFromRows(this.svc.rows(SHEET.riskMatrix, COLUMNS.riskMatrix, projectId)) ?? MATRIX_V1;
  }

  breakdown(projectId: string) {
    return this.svc.rows(SHEET.riskBreakdown, COLUMNS.riskBreakdown, projectId).map(({ projectId: _p, ...r }) => r);
  }

  private actionView(a: Row, cutoff: string): Any {
    const { projectId: _p, ...rest } = a;
    return { ...rest, done: !!a.doneDate, overdue: !a.doneDate && !!a.dueDate && String(a.dueDate) < cutoff };
  }

  private view(r: Row, m: RiskMatrix, cutoff: string, actions: Any[], milestones: Map<string, string>): Any {
    const { projectId: _p, ...rest } = r;
    const status = normRiskStatus(r.status);
    const pre = rate(r, 'pre', m), post = rate(r, 'post', m);
    const current = post.level ? post : pre;
    const active = isActiveRisk(status);
    const ratings = Object.fromEntries(([['pre', pre], ['post', post]] as const).flatMap(([p, x]) => [[`${p}Probability`, x.probability], ...IMPACT_DIMENSIONS.map(([k]) => [`${p}${k}`, x.dimensions[k.toLowerCase()]])]));
    return {
      ...rest, ...ratings, status, strategy: normStrategy(r.strategy), external: String(r.external ?? '').toLowerCase() === 'yes',
      owners: ownersOf(r.owner), active,
      preSeverity: pre.severity, preScore: pre.score, preLevel: pre.level, preWorst: pre.worst,
      postSeverity: post.severity, postScore: post.score, postLevel: post.level, postWorst: post.worst,
      currentScore: current.score, currentLevel: current.level, currentRank: levelRank(m, current.level) || null,
      responseOverdue: active && !r.actualDate && !!r.planDate && String(r.planDate) < cutoff,
      reviewOverdue: active && !!r.reviewDate && String(r.reviewDate) < cutoff,
      actionsTotal: actions.length, actionsDone: actions.filter(a => a.done).length, actionsOverdue: actions.filter(a => a.overdue).length,
      milestone: r.milestoneId ? milestones.get(String(r.milestoneId)) ?? null : null,
    };
  }

  private views(projectId: string) {
    const m = this.matrixOf(projectId);
    const cutoff = this.cutoff(projectId);
    const byRisk = new Map<string, Any[]>();
    for (const a of this.actionRows(projectId)) byRisk.set(String(a.riskId), [...(byRisk.get(String(a.riskId)) ?? []), this.actionView(a, cutoff)]);
    const ms = new Map(this.svc.rows(SHEET.milestones, COLUMNS.milestones, projectId).map(x => [String(x.id), String(x.description)]));
    return { m, cutoff, byRisk, all: this.rows(projectId).map(r => this.view(r, m, cutoff, byRisk.get(String(r.id)) ?? [], ms)) };
  }

  private filter(projectId: string, raw: unknown) {
    const { category, level, owner, strategy, flag, within, cell, basis, status, ...f } = parse(riskQuery, raw);
    const { all, cutoff, m } = this.views(projectId);
    const [cp, cs] = cell ? cell.split('-').map(Number) : [0, 0];
    const kept = all.filter(r =>
      (!status || (status === 'Not closed' ? r.status !== 'Closed' : r.status === status)) && (!category || r.category === category) && (!level || r.currentLevel === level) && (!strategy || r.strategy === strategy) &&
      (!owner || (owner === 'none' ? !r.owners.length : r.owners.includes(owner))) &&
      (!within || responseWithin(r, within, { cutoff })) &&
      (!cell || (r.active && (basis === 'pre' ? r.preProbability === cp && r.preSeverity === cs : (r.postLevel ? r.postProbability === cp && r.postSeverity === cs : r.preProbability === cp && r.preSeverity === cs)))) &&
      (!flag || (flag === 'response-overdue' ? r.responseOverdue : flag === 'review-overdue' ? r.reviewOverdue : flag === 'unrated' ? r.active && !r.preLevel
        : flag === 'awaiting-post' ? r.active && r.preLevel && !r.postLevel : flag === 'external' ? r.external : r.active)));
    const rows = filterAndSort(kept as Row[], f as ListParams, ['id', 'title', 'description', 'cause', 'effect', 'owner', 'rbs', 'discipline', 'mitigationCause', 'mitigationEffect', 'remark'], 'id');
    return { f, all, m, rows: rows as Any[] };
  }

  insights(projectId: string) {
    const { all, cutoff, m } = this.views(projectId);
    return risksInsights(all, cutoff, m.levels);
  }

  /** The matrix and how many active risks sit in each cell, before mitigation and now (spec MGT-01 heatmap). */
  heatmap(projectId: string) {
    const { all, m } = this.views(projectId);
    const grid = (pick: (r: Any) => [number | null, number | null]) => {
      const g = m.cells.map(row => row.map(() => 0));
      for (const r of all) { if (!r.active) continue; const [p, s] = pick(r); if (p && s) g[p - 1][s - 1]++; }
      return g;
    };
    return {
      matrix: m,
      pre: grid(r => [r.preProbability, r.preSeverity]),
      current: grid(r => (r.postLevel ? [r.postProbability, r.postSeverity] : [r.preProbability, r.preSeverity])),
      unrated: all.filter(r => r.active && !r.preLevel).length,
    };
  }

  /** Register options: the matrix, RBS and the values in use, for forms and filters. */
  options(projectId: string) {
    const all = this.rows(projectId);
    return {
      matrix: this.matrixOf(projectId), statuses: RISK_STATUSES, strategies: RISK_STRATEGIES, dimensions: IMPACT_DIMENSIONS.map(([k, label]) => ({ key: k, label })),
      breakdown: this.breakdown(projectId), owners: unique(all.flatMap(r => ownersOf(r.owner))),
    };
  }

  list(projectId: string, raw: unknown) {
    const { f, all, m, rows } = this.filter(projectId, raw);
    return {
      items: paginate(rows, f), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: {
        disciplines: unique(all.map(r => r.discipline)), categories: unique(all.map(r => r.category)), statuses: [...RISK_STATUSES], levels: [...m.levels].reverse(),
        owners: unique(all.flatMap(r => r.owners)), strategies: [...RISK_STRATEGIES],
      },
    };
  }

  csv(projectId: string, raw: unknown) {
    const { m, rows } = this.filter(projectId, raw);
    const label = (labels: string[], n: number | null) => (n ? labels[n - 1] : '');
    const dims = (r: Any, p: string) => IMPACT_DIMENSIONS.map(([k]) => label(m.severityLabels, r[`${p}${k}`]));
    return {
      filename: 'risk-register.csv',
      csv: toCsv([
        ['Risk ID', 'Status', 'RBS', 'Category', 'Discipline', 'Title', 'Description', 'Cause', 'Effect', 'Owner', 'Record date',
          'Pre probability', ...IMPACT_DIMENSIONS.map(([, l]) => `Pre ${l.toLowerCase()}`), 'Pre score', 'Pre level', 'Strategy', 'Mitigation of cause', 'Mitigation of effect',
          'Plan action date', 'Actual actions', 'Actual action date', 'Post probability', ...IMPACT_DIMENSIONS.map(([, l]) => `Post ${l.toLowerCase()}`), 'Post score', 'Post level',
          'Current level', 'Response overdue', 'Actions done', 'Remark'],
        ...rows.map(r => [r.id, r.status, r.rbs, r.category, r.discipline, r.title, r.description, r.cause, r.effect, r.owner, r.recordDate,
          label(m.probabilityLabels, r.preProbability), ...dims(r, 'pre'), r.preScore, r.preLevel, r.strategy, r.mitigationCause, r.mitigationEffect,
          r.planDate, r.actualActions, r.actualDate, label(m.probabilityLabels, r.postProbability), ...dims(r, 'post'), r.postScore, r.postLevel,
          r.currentLevel, r.responseOverdue ? 'Yes' : 'No', `${r.actionsDone}/${r.actionsTotal}`, r.remark]),
      ]),
    };
  }

  get(projectId: string, id: string) {
    const { all, byRisk } = this.views(projectId);
    const r = all.find(x => x.id === id);
    if (!r) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
    return { ...r, actions: byRisk.get(id) ?? [] };
  }

  /** Dashboard figures. */
  summary(projectId: string) {
    const { all, m } = this.views(projectId);
    const active = all.filter(r => r.active);
    const byLevel = Object.fromEntries([...m.levels].reverse().map(l => [l, active.filter(r => r.currentLevel === l).length]));
    return {
      total: all.length, active: active.length, levels: [...m.levels].reverse(), byLevel, top: m.levels[m.levels.length - 1],
      responseOverdue: active.filter(r => r.responseOverdue).length, reviewOverdue: active.filter(r => r.reviewOverdue).length,
    };
  }

  private check(projectId: string, v: Any, m: RiskMatrix) {
    const issues: { path: string; message: string }[] = [];
    if (v.rbs) {
      const rbs = this.breakdown(projectId);
      if (rbs.length && !rbs.some(b => b.code === v.rbs)) issues.push({ path: 'rbs', message: `"${v.rbs}" is not in the project's risk breakdown structure.` });
    }
    for (const p of ['pre', 'post']) {
      if (v[`${p}Probability`] != null && v[`${p}Probability`] > m.probabilityLabels.length) issues.push({ path: `${p}Probability`, message: `Use 1 to ${m.probabilityLabels.length}.` });
      for (const [k] of IMPACT_DIMENSIONS) if (v[`${p}${k}`] != null && v[`${p}${k}`] > m.severityLabels.length) issues.push({ path: `${p}${k}`, message: `Use 1 to ${m.severityLabels.length}.` });
      const hasP = v[`${p}Probability`] != null, hasS = IMPACT_DIMENSIONS.some(([k]) => v[`${p}${k}`] != null);
      if (hasP !== hasS) issues.push({ path: `${p}Probability`, message: `Rate the ${p === 'pre' ? 'pre' : 'post'}-mitigation probability and at least one impact, or neither.` });
    }
    const status = v.status as string;
    const rated = v.preProbability != null && IMPACT_DIMENSIONS.some(([k]) => v[`pre${k}`] != null);
    if (!['New', 'Firmed'].includes(status) && !rated) issues.push({ path: 'preProbability', message: 'Rate the risk before mitigation before it moves beyond Firmed.' });
    if (status === 'Closed' && !v.remark && !v.actualActions) issues.push({ path: 'remark', message: 'Say why the risk is closed: record the actual actions or a remark.' });
    if (v.milestoneId && !this.svc.rows(SHEET.milestones, COLUMNS.milestones, projectId).some(x => x.id === v.milestoneId)) issues.push({ path: 'milestoneId', message: `Milestone "${v.milestoneId}" does not exist in this project.` });
    if (issues.length) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues });
  }

  private toRow(projectId: string, v: Any): Row {
    const b = v.rbs ? this.breakdown(projectId).find(x => x.code === v.rbs) : null;
    const { external, ...rest } = v;
    return { ...rest, ...(external === undefined ? {} : { external: external ? 'Yes' : 'No' }), ...(b ? { category: b.categoryName, discipline: b.disciplineName } : {}) } as Row;
  }

  create(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(riskCreate, body);
    const m = this.matrixOf(projectId);
    this.check(projectId, v, m);
    return this.store.withLock(() => {
      const rows = this.rows(projectId);
      // Like the workbook, the number runs across the whole register and the ID is the RBS code plus that number.
      const no = rows.reduce((n, r) => Math.max(n, Number(r.no) || Number(String(r.id).replace(/^.*-/, '')) || 0), 0) + 1;
      const id = `${v.rbs}-${String(no).padStart(4, '0')}`;
      const now = this.now();
      this.store.appendRows(SHEET.risks, COLUMNS.risks, [{ projectId, id, no, recordDate: now.slice(0, 10), ...this.toRow(projectId, v), createdAt: now, updatedAt: now, createdBy: actor.id }]);
      return this.get(projectId, id);
    });
  }

  update(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(riskPatch, body);
    return this.store.withLock(() => {
      const current = this.rows(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
      const m = this.matrixOf(projectId);
      const clean = Object.fromEntries(Object.entries(current).map(([k, val]) => [k, k.startsWith('pre') || k.startsWith('post') ? normRating(val, k.endsWith('Probability') ? m.probabilityLabels : m.severityLabels) : val]));
      this.check(projectId, { ...clean, status: normRiskStatus(current.status), ...patch }, m);
      this.store.updateRow(SHEET.risks, COLUMNS.risks, 'id', id, { ...this.toRow(projectId, patch), updatedAt: this.now() }, { projectId });
      return this.get(projectId, id);
    });
  }

  delete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.risks, COLUMNS.risks, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
      this.store.deleteRows(SHEET.riskActions, COLUMNS.riskActions, { projectId, riskId: id });
    });
  }

  /* ---------------- mitigation actions ---------------- */
  addAction(projectId: string, riskId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { done, ...v } = parse(actionCreate, body);
    return this.store.withLock(() => {
      if (!this.rows(projectId).some(r => r.id === riskId)) throw notFound('NOT_FOUND', `Risk "${riskId}" was not found.`);
      const rows = this.actionRows(projectId);
      const id = `RA-${String(rows.reduce((n, r) => Math.max(n, Number(String(r.id).replace(/^\D+/, '')) || 0), 0) + 1).padStart(4, '0')}`;
      const now = this.now();
      this.store.appendRows(SHEET.riskActions, COLUMNS.riskActions, [{ projectId, id, riskId, ...v, doneDate: done ? now.slice(0, 10) : null, createdAt: now, updatedAt: now }]);
      this.store.updateRow(SHEET.risks, COLUMNS.risks, 'id', riskId, { updatedAt: now }, { projectId });
      return this.get(projectId, riskId);
    });
  }

  updateAction(projectId: string, riskId: string, actionId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { done, ...v } = parse(actionPatch, body);
    return this.store.withLock(() => {
      const a = this.actionRows(projectId).find(x => x.id === actionId && x.riskId === riskId);
      if (!a) throw notFound('NOT_FOUND', `Action "${actionId}" was not found on risk ${riskId}.`);
      const now = this.now();
      const patch: Row = { ...(v as Row), updatedAt: now };
      if (done !== undefined) patch.doneDate = done ? (a.doneDate ?? now.slice(0, 10)) : null;
      this.store.updateRow(SHEET.riskActions, COLUMNS.riskActions, 'id', actionId, patch, { projectId });
      return this.get(projectId, riskId);
    });
  }

  deleteAction(projectId: string, riskId: string, actionId: string, actor: Actor) {
    requireWrite(actor, projectId);
    return this.store.withLock(() => {
      if (!this.actionRows(projectId).some(x => x.id === actionId && x.riskId === riskId)) throw notFound('NOT_FOUND', `Action "${actionId}" was not found on risk ${riskId}.`);
      this.store.deleteRow(SHEET.riskActions, COLUMNS.riskActions, 'id', actionId, { projectId });
      return this.get(projectId, riskId);
    });
  }
}
