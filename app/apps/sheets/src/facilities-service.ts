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
    case 'CGF Jacket': return 'cgf-jacket';
    case 'Pile': case 'Conductor': return 'pile-conductor';
    case 'Bridge': return 'bridge';
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

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface TimelineFacility {
  id: string; label: string; later: boolean; start: string | null; finish: string | null; workStart: string | null; workFinish: string | null;
  actual: number | null; plan: number | null; variance: number | null; basis: string | null;
  milestones: { id: string; description: string; baseline: string | null; working: string | null; forecast: string | null; actual: string | null; status: string; major: boolean }[];
  first: string | null; last: string | null;
}

/** The order scopes are listed in, in every selector and list: overall, then the phases, then the rest. */
const SCOPE_ORDER = ['overall', 'engineering', 'procurement', 'construction', 'precom'];
const scopeRank = (scope: string) => { const i = SCOPE_ORDER.indexOf(scope); return i < 0 ? SCOPE_ORDER.length : i; };

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
    return out.sort((a, b) => scopeRank(a.scope) - scopeRank(b.scope));
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
    return this.reg.milestoneViews(projectId).filter(m => m.kind !== 'Equipment' && facilityOfMilestone(m) === id);
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
      wbs, milestones: this.milestones(projectId, f.id), scheduleCheck: this.scheduleCheck(projectId, f.id, scopes, String(project.cutoff)),
    };
  }

  schedule(projectId: string, id: string) {
    const f = this.known(id);
    const project = this.svc.project(projectId);
    const wbs = this.rows('facilityWbs', projectId).filter(r => r.facilityId === f.id).map(w => this.wbsView(w));
    return { facility: this.facilityHead(projectId, f.id), cutoff: String(project.cutoff), wbs, milestones: this.milestones(projectId, f.id) };
  }

  /* ---------- working schedule ---------- */
  /** Activities of the working schedule (CGF Topsides): the leaf rows with their baseline and working-schedule dates. */
  private activities(projectId: string) {
    const all = this.svc.rows(SHEET.workingSchedule, COLUMNS.workingSchedule, projectId).filter(r => !r.facilityId || r.facilityId === 'cgf-topsides');
    const byId = new Map(all.map(r => [String(r.id), r]));
    const top = (r: Row): string => { let cur = r; for (let i = 0; i < 12 && cur.parent && byId.has(String(cur.parent)); i++) cur = byId.get(String(cur.parent))!; return String(cur.name ?? ''); };
    return all.filter(r => r.leaf === 'Yes').map(r => ({
      id: String(r.activityId ?? r.id), name: String(r.name), top: top(r), duration: asNum(r.duration) ?? 0, discipline: (r.discipline as string | null) ?? null,
      baseStart: (r.baseStart as string | null) ?? null, baseFinish: (r.baseFinish as string | null) ?? null,
      workStart: (r.workStart as string | null) ?? null, workFinish: (r.workFinish as string | null) ?? null,
      reStart: (r.reStart as string | null) ?? null, reFinish: (r.reFinish as string | null) ?? null,
    }));
  }

  /**
   * The progress the working schedule implies: each activity advances in a straight line between its start and finish, weighted by its
   * duration. Shown beside the S-curve plan to check that the plan agrees with the dates the subcontractor works to.
   */
  private scheduleCurves(projectId: string, dates: string[]) {
    // the construction curve stops at the end of onshore construction: load-out, transport, installation and HUC have their own phases
    const acts = this.activities(projectId).filter(a => a.duration > 0 && a.baseStart && a.baseFinish && !/^ST-CGF/i.test(a.top));
    if (!acts.length) return null;
    const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
    const total = acts.reduce((t, a) => t + a.duration, 0);
    const at = (d: number, pick: (a: (typeof acts)[number]) => [string, string]) => {
      let sum = 0;
      for (const a of acts) {
        const [s0, f0] = pick(a);
        const s1 = day(s0), f1 = day(f0);
        sum += a.duration * (d <= s1 ? 0 : d >= f1 || f1 <= s1 ? 1 : (d - s1) / (f1 - s1));
      }
      return round((sum / total) * 100, 2) as number;
    };
    return dates.map(date => {
      const d = day(date);
      return { date, baseline: at(d, a => [a.baseStart!, a.baseFinish!]), working: at(d, a => [a.workStart ?? a.baseStart!, a.workFinish ?? a.baseFinish!]) };
    });
  }

  /** Progress of a facility's S-curve points checked against the working schedule (only CGF Topsides has one). */
  private scheduleCheck(projectId: string, id: FacilityId, scopes: ReturnType<FacilitiesService['scopes']>, cutoff: string) {
    if (id !== 'cgf-topsides') return null;
    const scope = scopes.find(s => s.scope === 'construction') ?? scopes[0];
    if (!scope) return null;
    const curve = this.scheduleCurves(projectId, scope.points.map(p => p.date));
    if (!curve) return null;
    const upTo = [...curve].filter(p => p.date <= cutoff).pop() ?? null;
    const plan = [...scope.points].filter(p => p.date <= cutoff && p.plan !== null).pop() ?? null;
    return { scope: scope.scope, label: scope.label, asOf: upTo?.date ?? null, baseline: upTo?.baseline ?? null, working: upTo?.working ?? null, plan: round(plan?.plan ?? null), curve };
  }

  /** One timeline for every facility: planned start and finish, the working-schedule span where there is one, progress and the key milestones. */
  timeline(projectId: string) {
    const project = this.svc.project(projectId);
    const cutoff = String(project.cutoff);
    const acts = this.activities(projectId);
    const span = (pick: (a: (typeof acts)[number]) => string | null) => { const v = acts.map(pick).filter(Boolean).sort() as string[]; return { first: v[0] ?? null, last: v[v.length - 1] ?? null }; };
    const work = { start: span(a => a.workStart).first, finish: span(a => a.workFinish).last };
    // a facility whose own schedule is the subcontractor's (CGF Jacket) takes its span from the top row of that schedule
    const own = (id: string) => {
      const top = this.svc.rows(SHEET.workingSchedule, COLUMNS.workingSchedule, projectId).find(r => r.facilityId === id && !r.parent);
      return top ? { start: (top.workStart as string | null) ?? null, finish: (top.workFinish as string | null) ?? null } : null;
    };
    const view = (m: Loose) => ({
      id: String(m.id), description: String(m.description), baseline: (m.planBaseline as string | null) ?? null, working: ((m.planSub ?? m.planBaseline) as string | null) ?? null,
      forecast: (m.forecast as string | null) ?? null, actual: (m.actual as string | null) ?? null, status: m.status as string, major: Boolean(m.major),
    });
    const byDate = (a: ReturnType<typeof view>, b: ReturnType<typeof view>) => String(a.actual ?? a.forecast ?? a.baseline).localeCompare(String(b.actual ?? b.forecast ?? b.baseline));
    const extent = (ms: ReturnType<typeof view>[], ...own: (string | null)[]) => { const d = ([...own, ...ms.flatMap(m => [m.baseline, m.working, m.forecast, m.actual])].filter(Boolean) as string[]).sort(); return { first: d[0] ?? null, last: d[d.length - 1] ?? null }; };
    const facilities: TimelineFacility[] = FACILITIES.map(f => {
      const head = this.facilityHead(projectId, f.id);
      const ms = this.milestones(projectId, f.id).map(view).sort(byDate);
      const sched = own(f.id);
      const { first, last } = extent(ms, sched?.start ?? head.start, sched?.finish ?? head.finish);
      // the bar is the facility's overall progress; Pile & Conductor has no overall curve, so it shows its construction curve and says so
      const overall = this.scopes(projectId, f.id).find(s => s.scope === 'overall');
      const std = overall ? this.standing(overall.points) : head.headline;
      const basis = overall ? 'Overall' : head.headline ? head.headline.label : null;
      return {
        id: f.id, label: f.label, later: f.later, start: sched?.start ?? head.start, finish: sched?.finish ?? head.finish,
        workStart: f.id === 'cgf-topsides' ? work.start : null, workFinish: f.id === 'cgf-topsides' ? work.finish : null,
        actual: std?.actual ?? null, plan: std?.plan ?? null, variance: std && std.actual != null && std.plan != null ? round(std.actual - std.plan) : null, basis,
        milestones: ms, first, last,
      };
    });
    // key dates of a facility that is not on the facility list (the pipeline) still belong on the timeline, so the milestone totals add up
    const listed = new Set(FACILITIES.map(f => f.id));
    const loose = new Map<string, Loose[]>();
    for (const m of this.reg.milestoneViews(projectId)) {
      if (m.kind === 'Equipment') continue;
      const id = facilityOfMilestone(m);
      if (id && listed.has(id)) continue;
      const label = String(m.facility ?? '') || 'Project';
      loose.set(label, [...(loose.get(label) ?? []), m]);
    }
    for (const [label, list] of loose) {
      const ms = list.map(view).sort(byDate);
      const { first, last } = extent(ms);
      facilities.push({ id: `other-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, later: false, start: null, finish: null, workStart: null, workFinish: null, actual: null, plan: null, variance: null, basis: null, milestones: ms, first, last });
    }
    const all = (facilities.flatMap(f => [f.first, f.last, f.workStart, f.workFinish]).filter(Boolean) as string[]).sort();
    return { cutoff, start: all[0] ?? null, finish: all[all.length - 1] ?? null, facilities };
  }

  /**
   * The critical path network: progress of the CPN plan by work package beside the baseline plan, its weekly curve, and the activities of
   * the working schedule with the least float against the baseline finish (the working finish, or the re-schedule where there is one).
   */
  cpn(projectId: string) {
    const project = this.svc.project(projectId);
    const cutoff = String(project.cutoff);
    const items = this.svc.rows(SHEET.cpnItems, COLUMNS.cpnItems, projectId);
    const view = (r: Row) => {
      const plan = asNum(r.plan), actual = asNum(r.actual), basePlan = asNum(r.basePlan), baseActual = asNum(r.baseActual);
      return {
        code: String(r.code), name: String(r.name), weight: round(asNum(r.weight)), baseWeight: round(asNum(r.baseWeight)), plan: round(plan), actual: round(actual),
        variance: plan !== null && actual !== null ? round(actual - plan) : null, basePlan: round(basePlan), baseActual: round(baseActual),
        baseVariance: basePlan !== null && baseActual !== null ? round(baseActual - basePlan) : null,
        lastPlan: round(asNum(r.lastPlan)), lastActual: round(asNum(r.lastActual)),
      };
    };
    const packages = items.filter(r => r.kind === 'Work package').map(view);
    const overall = items.find(r => r.kind === 'Overall');
    const curve = this.svc.rows(SHEET.facilityCurves, COLUMNS.facilityCurves, projectId).filter(r => r.facilityId === 'cpn')
      .map(c => ({ date: String(c.date), plan: asNum(c.plan), forecast: null, actual: asNum(c.actual) })).sort((a, b) => a.date.localeCompare(b.date));
    const day = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
    const activities = this.activities(projectId).filter(a => a.baseFinish && (a.reFinish ?? a.workFinish)).map(a => {
      const finish = (a.reFinish ?? a.workFinish) as string;
      return { ...a, finish, float: day(a.baseFinish as string) - day(finish) };
    });
    const critical = activities.filter(a => a.float <= 7 && a.finish >= cutoff).sort((a, b) => a.float - b.float || a.finish.localeCompare(b.finish));
    const key = this.reg.milestoneViews(projectId).filter(m => m.kind !== 'Equipment').map(m => ({
      id: String(m.id), description: String(m.description), facility: String(m.facility ?? ''), baseline: (m.planBaseline as string | null) ?? null, working: ((m.planSub ?? m.planBaseline) as string | null) ?? null,
      forecast: (m.forecast as string | null) ?? null, actual: (m.actual as string | null) ?? null, status: m.status as string, major: Boolean(m.major),
    })).sort((a, b) => String(a.actual ?? a.forecast ?? a.working ?? a.baseline).localeCompare(String(b.actual ?? b.forecast ?? b.working ?? b.baseline)));
    return {
      cutoff, asOf: [...curve].reverse().find(p => p.actual !== null)?.date ?? null, overall: overall ? view(overall) : null, packages, curve,
      critical: { total: activities.length, threshold: 7, count: critical.length, items: critical.slice(0, 60) }, milestones: key,
    };
  }

  private wbsView(w: Row) {
    const plan = asNum(w.plan), actual = asNum(w.actual);
    return {
      code: String(w.code), name: String(w.name), level: Number(w.level), father: (w.father as string | null) ?? null, start: (w.start as string | null) ?? null, finish: (w.finish as string | null) ?? null,
      weight: round(asNum(w.weight)), plan: round(plan), actual: round(actual), variance: plan !== null && actual !== null ? round(actual - plan) : null, shared: w.shared === 'Yes',
    };
  }
}
