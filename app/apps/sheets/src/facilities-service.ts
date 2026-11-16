import { COLUMNS, SHEET } from './datasets';
import { HttpError } from './http';
import type { RegistersService } from './registers-service';
import type { Service } from './service';
import type { Row } from './store';

/**
 * The facilities of the project, in the order the planning screens list them. Their progress curves and WBS come from the
 * progress-monitoring workbooks (apps/api/scripts/extract_facility_progress.py); DSF has no data yet and is listed as "later".
 */
export const FACILITIES = [
  { id: 'cgf-topsides', label: 'CGF Topside', later: false },
  { id: 'cgf-jacket', label: 'CGF Jacket', later: false },
  { id: 'pile-conductor', label: 'Pile & Conductor', later: false },
  { id: 'bridge', label: 'Bridge', later: false },
  { id: 'lqm2', label: 'LQM#2', later: false },
  { id: 'dsf', label: 'DSF', later: true },
] as const;
export type FacilityId = (typeof FACILITIES)[number]['id'];

/** Which facility a key milestone belongs to: its sheet facility, then, for the jacket and bridge group, its wording. */
export function facilityOfMilestone(m: { description?: unknown; facility?: unknown }): FacilityId | null {
  const text = String(m.description ?? '');
  switch (String(m.facility ?? '')) {
    case 'CGF Topsides': return 'cgf-topsides';
    case 'LQ Module #2': return 'lqm2';
    case 'CGF Jacket & Bridge':
      if (/jacket/i.test(text)) return 'cgf-jacket';
      if (/pile|conductor/i.test(text)) return 'pile-conductor';
      if (/bridge/i.test(text)) return 'bridge';
      return 'cgf-jacket';
    default: return null;
  }
}

interface Point { date: string; plan: number | null; forecast: number | null; actual: number | null }
const round = (n: number | null, d = 2) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
const asNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Weighted blend of several curves (Pile and Conductor become one construction curve), carrying each value forward between its own dates. */
function blend(curves: { weight: number; points: Point[] }[]): Point[] {
  const total = curves.reduce((s, c) => s + c.weight, 0) || 1;
  const dates = [...new Set(curves.flatMap(c => c.points.map(p => p.date)))].sort();
  const lastActual = curves.reduce((d, c) => c.points.reduce((m, p) => (p.actual !== null && p.date > m ? p.date : m), d), '');
  return dates.map(date => {
    const at = (key: 'plan' | 'forecast' | 'actual') => {
      let sum = 0;
      for (const c of curves) {
        const upTo = c.points.filter(p => p.date <= date && p[key] !== null);
        sum += c.weight * (upTo.length ? (upTo[upTo.length - 1][key] as number) : 0);
      }
      return round(sum / total, 3);
    };
    return { date, plan: at('plan'), forecast: at('forecast'), actual: date <= lastActual ? at('actual') : null };
  });
}

export class FacilitiesService {
  constructor(private readonly svc: Service, private readonly reg: RegistersService) {}

  private rows<K extends 'facilityCurves' | 'facilityScopes' | 'facilityWbs'>(key: K, projectId: string): Row[] {
    return this.svc.rows(SHEET[key], COLUMNS[key], projectId);
  }

  private known(id: string) {
    const f = FACILITIES.find(x => x.id === id);
    if (!f) throw new HttpError(404, { code: 'NOT_FOUND', message: `There is no facility "${id}".` });
    return f;
  }

  /** The curves of one facility, one entry per scope; Pile & Conductor gets a blended construction curve from its two parts. */
  private scopes(projectId: string, id: FacilityId) {
    const curves = this.rows('facilityCurves', projectId).filter(r => r.facilityId === id);
    const meta = this.rows('facilityScopes', projectId).filter(r => r.facilityId === id);
    const wbs = this.rows('facilityWbs', projectId).filter(r => r.facilityId === id);
    const out = meta.map(s => {
      const points: Point[] = curves.filter(c => c.scope === s.scope).map(c => ({ date: String(c.date), plan: asNum(c.plan), forecast: asNum(c.forecast), actual: asNum(c.actual) })).sort((a, b) => a.date.localeCompare(b.date));
      return { scope: String(s.scope), label: String(s.label), weight: asNum(s.weight), points };
    }).filter(s => s.points.length);
    if (id === 'pile-conductor' && out.length) {
      const weightOf = (name: string) => asNum(wbs.find(w => String(w.name).toUpperCase() === name)?.weight) ?? 1;
      out.unshift({ scope: 'construction', label: 'Construction', weight: null, points: blend(out.map(s => ({ weight: weightOf(s.label.toUpperCase()), points: s.points }))) });
    }
    return out;
  }

  /** Where a curve stands in the reporting week: the last week with an actual, with the plan and forecast of that same week. */
  private standing(points: Point[]) {
    const last = [...points].reverse().find(p => p.actual !== null);
    if (!last) return { asOf: null, plan: null, forecast: null, actual: null, variance: null };
    return { asOf: last.date, plan: round(last.plan), forecast: round(last.forecast), actual: round(last.actual), variance: last.plan !== null && last.actual !== null ? round(last.actual - last.plan) : null };
  }

  private headlineOf(scopes: ReturnType<FacilitiesService['scopes']>) {
    return scopes.find(s => s.scope === 'overall') ?? scopes.find(s => s.scope === 'construction') ?? scopes[0] ?? null;
  }

  private milestones(projectId: string, id: FacilityId) {
    return this.reg.milestoneViews(projectId).filter(m => facilityOfMilestone(m) === id);
  }

  private facilityHead(projectId: string, id: FacilityId) {
    const f = this.known(id);
    const scopes = this.scopes(projectId, id);
    const headline = this.headlineOf(scopes);
    const ms = this.milestones(projectId, id);
    const wbs = this.rows('facilityWbs', projectId).filter(r => r.facilityId === id);
    const starts = wbs.map(w => String(w.start)).filter(Boolean).sort();
    const finishes = wbs.map(w => String(w.finish)).filter(Boolean).sort();
    return {
      id: f.id, label: f.label, later: f.later,
      headline: headline ? { scope: headline.scope, label: headline.label, ...this.standing(headline.points) } : null,
      milestones: { total: ms.length, done: ms.filter(m => m.status === 'Done').length, overdue: ms.filter(m => m.status === 'Overdue').length },
      start: starts[0] ?? null, finish: finishes[finishes.length - 1] ?? null, scopeCount: scopes.length,
    };
  }

  list(projectId: string) {
    const project = this.svc.project(projectId);
    return { cutoff: String(project.cutoff), facilities: FACILITIES.map(f => this.facilityHead(projectId, f.id)) };
  }

  progress(projectId: string, id: string) {
    const f = this.known(id);
    const project = this.svc.project(projectId);
    const scopes = this.scopes(projectId, f.id);
    const headline = this.headlineOf(scopes);
    const wbs = this.rows('facilityWbs', projectId).filter(r => r.facilityId === f.id).map(w => this.wbsView(w));
    return {
      facility: this.facilityHead(projectId, f.id), cutoff: String(project.cutoff),
      scopes: scopes.map(s => ({ ...s, headline: s.scope === headline?.scope, ...this.standing(s.points) })),
      wbs, milestones: this.milestones(projectId, f.id),
    };
  }

  schedule(projectId: string, id: string) {
    const f = this.known(id);
    const project = this.svc.project(projectId);
    const wbs = this.rows('facilityWbs', projectId).filter(r => r.facilityId === f.id).map(w => this.wbsView(w));
    return { facility: this.facilityHead(projectId, f.id), cutoff: String(project.cutoff), wbs, milestones: this.milestones(projectId, f.id) };
  }

  private wbsView(w: Row) {
    const plan = asNum(w.plan), actual = asNum(w.actual);
    return {
      code: String(w.code), name: String(w.name), level: Number(w.level), father: (w.father as string | null) ?? null, start: (w.start as string | null) ?? null, finish: (w.finish as string | null) ?? null,
      weight: round(asNum(w.weight)), plan: round(plan), actual: round(actual), variance: plan !== null && actual !== null ? round(actual - plan) : null, shared: w.shared === 'Yes',
    };
  }
}
