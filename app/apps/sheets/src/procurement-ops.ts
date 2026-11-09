import { z } from 'zod';
import { isEffective } from '../../api/src/registry/catalog';
import { Resource, issue, type AnyRow, type ResourceDef } from './crud';
import { COLUMNS, SHEET } from './datasets';
import { HttpError } from './http';
import { concernDue, concernsInsights, expeditingDone, expeditingDue, expeditingInsights, logisticsInsights, materialsInsights, planInsights, shipmentDue, shipmentOpen, withinPredicate, type Insights } from './insights';
import type { Service } from './service';
import type { Row } from './store';

const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const pct = z.number().min(0).max(100).nullish().transform(v => v ?? null);
const qty = z.number().min(0).max(1e12).nullish().transform(v => v ?? null);
const withPartial = <T extends z.ZodRawShape>(shape: T) => ({ create: z.object(shape) as never, patch: z.object(shape).partial() as never });

const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
const round1 = (n: number) => Math.round(n * 10) / 10;
const conflict = (code: string, message: string) => new HttpError(409, { code, message });

/* ============================ resource definitions ============================ */
export const PACKAGE_STATUSES = ['Planned', 'In tendering', 'LOA issued', 'PO placed'] as const;
export const CONCERN_TYPES = ['Risk', 'Concern', 'Issue'] as const;
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const CONCERN_AREAS = ['Schedule', 'Cost', 'Quality', 'Delivery', 'Documentation', 'Contractual', 'Other'] as const;
export const CONCERN_STATUSES = ['Open', 'Mitigating', 'Resolved', 'Closed'] as const;
const ACTIVE = new Set(['Open', 'Mitigating']);
const SEVERITY_WEIGHT: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const packageShape = {
  code: z.string().trim().min(3).max(60), discipline: txt(40), description: txt(300), vendorCode: txt(40), vendor: txt(160), origins: txt(200),
  loaNo: txt(80), loaDate: isoOpt, poNo: txt(80), poDate: isoOpt, buyer: txt(80), expeditor: txt(80), pe: txt(80), vqc: txt(80),
  workPackage: txt(40), packageType: z.enum(['LS', 'PS', 'Free issue']).nullish().transform(v => v ?? null), weightPct: z.number().min(0).max(100).nullish().transform(v => v ?? null),
  status: z.enum(['Planned', 'In tendering']).optional(),
};
const expeditingShape = {
  code: z.string().trim().min(3).max(60), discipline: txt(40), name: txt(300), vendor: txt(160), status: z.string().trim().min(1).max(40),
  planPct: pct, actualPct: pct, rosDate: isoOpt, etaSite: txt(40), dateDiff: txt(40),
  engPlan: pct, engActual: pct, procPlan: pct, procActual: pct, fabPlan: pct, fabActual: pct, testPlan: pct, testActual: pct, delPlan: pct, delActual: pct,
  highlight: txt(1000), actionPlan: txt(1000), remark: txt(1000), lsps: txt(40), poNo: txt(80), deliveryDate: txt(40), currentStatusText: txt(500),
  planExw: pct, actExw: pct, planArrival: pct, actArrival: pct,
};
const logisticsShape = {
  source: z.enum(['PTSC', 'Client']), packageNo: z.string().trim().min(1).max(80), packageDescription: txt(200), poNo: txt(80), shipmentNo: txt(60), shipmentDescription: txt(200),
  etdPol: isoOpt, etaPod: isoOpt, forecastOnSite: isoOpt, actualOnSite: isoOpt, status: z.string().trim().min(1).max(40), grossWeightKg: qty, qty: txt(80), packingList: txt(80),
  vessel: txt(80), blNo: txt(80), portLoading: txt(80), portDischarge: txt(80), transport: txt(60), deliveryYard: txt(60), issue: txt(500),
};
const balanceShape = {
  facility: txt(60), supply: txt(40), discipline: txt(40), serialNo: txt(40), category: txt(40), materialCode: txt(60), description: z.string().trim().min(1).max(300), grade: txt(60),
  poNo: txt(80), shipmentNo: txt(40), supplier: txt(100), mrirNo: txt(60), heatNo: txt(60), unit: txt(20), balance: qty, yard: txt(40), location: txt(80), status: txt(40), remark: txt(200),
};
const summaryShape = { supply: z.enum(['PTSC MC', 'Client']), facility: z.string().trim().min(1).max(80), mtoKg: qty, arrivedKg: qty, vspYardKg: qty, mcYardKg: qty };
const concernShape = {
  packageCode: txt(60), type: z.enum(CONCERN_TYPES), title: z.string().trim().min(1).max(200), description: txt(1500), severity: z.enum(SEVERITIES), area: z.enum(CONCERN_AREAS),
  owner: txt(80), raisedDate: isoOpt, dueDate: isoOpt, status: z.enum(CONCERN_STATUSES), action: txt(1500), source: z.enum(['Manual', 'Expediting', 'Logistics']), sourceRef: txt(60),
};
const concernCreate = z.object({ ...concernShape, type: concernShape.type.default('Risk'), severity: concernShape.severity.default('Medium'), area: concernShape.area.default('Delivery'), status: concernShape.status.default('Open'), source: concernShape.source.default('Manual') });

const STAGES = ['engPlan', 'engActual', 'procPlan', 'procActual', 'fabPlan', 'fabActual', 'testPlan', 'testActual', 'delPlan', 'delActual'];

const defs: Record<'packages' | 'expediting' | 'logistics' | 'balance' | 'summary' | 'concerns', ResourceDef> = {
  packages: {
    label: 'procurement package', sheet: SHEET.procurement, columns: COLUMNS.procurement, idKey: 'id', idPrefix: 'PR', idWidth: 3,
    ...withPartial(packageShape), searchKeys: ['code', 'description', 'vendor', 'buyer'], sortKeys: ['code', 'discipline', 'vendor', 'status', 'poDate', 'loaDate'], defaultSort: 'code', filters: ['workPackage', 'packageType', 'buyer'],
    csvName: 'procurement-packages.csv', csvHeader: ['Code', 'Discipline', 'Description', 'Vendor', 'LOA No', 'LOA Date', 'PO No', 'PO Date', 'Buyer', 'Expeditor', 'Status'],
    csvRow: p => [p.code, p.discipline, p.description, p.vendor, p.loaNo, p.loaDate, p.poNo, p.poDate, p.buyer, p.expeditor, p.status],
    prepare(row, { existing, rows }) {
      if (rows.some(r => r.code === row.code && r.id !== existing?.id)) throw conflict('CODE_TAKEN', `A package with the code ${row.code} already exists.`);
      row.status = row.poNo ? 'PO placed' : row.loaNo ? 'LOA issued' : row.status === 'In tendering' || row.vendor ? 'In tendering' : 'Planned';
      return row;
    },
  },
  expediting: {
    label: 'expediting package', sheet: SHEET.expediting, columns: COLUMNS.expediting, idKey: 'id', idPrefix: 'EX', idWidth: 3,
    ...withPartial(expeditingShape), searchKeys: ['code', 'name', 'vendor'], sortKeys: ['code', 'discipline', 'vendor', 'status', 'actualPct', 'variance'], defaultSort: 'code',
    predicates: { within: withinPredicate(expeditingDue, r => !expeditingDone(r)) },
    csvName: 'expediting-packages.csv', csvHeader: ['Code', 'Discipline', 'Name', 'Vendor', 'Plan %', 'Actual %', 'Variance', 'Status'],
    csvRow: x => [x.code, x.discipline, x.name, x.vendor, x.planPct, x.actualPct, x.variance, x.status],
    prepare(row, { existing, rows }) {
      if (rows.some(r => r.code === row.code && r.id !== existing?.id)) throw conflict('CODE_TAKEN', `An expediting package with the code ${row.code} already exists.`);
      for (const k of STAGES) if (row[k] === undefined) row[k] = null;
      const plan = row.planPct as number | null, actual = row.actualPct as number | null;
      row.variance = plan != null && actual != null ? round1(actual - plan) : null;
      return row;
    },
  },
  logistics: {
    label: 'shipment', sheet: SHEET.logistics, columns: COLUMNS.logistics, idKey: 'id', idPrefix: 'LG', idWidth: 4,
    ...withPartial(logisticsShape), searchKeys: ['packageNo', 'packageDescription', 'poNo', 'shipmentNo', 'shipmentDescription', 'vessel', 'issue'],
    sortKeys: ['packageNo', 'shipmentNo', 'status', 'forecastOnSite', 'actualOnSite', 'etaPod', 'grossWeightKg'], defaultSort: 'forecastOnSite', filters: ['source', 'deliveryYard', 'month', 'yard'],
    predicates: { within: withinPredicate(shipmentDue, shipmentOpen), late: (r, v) => v !== 'true' || !!r.overdue || (!!r.issue && r.status !== 'Received') },
    csvName: 'logistics-shipments.csv',
    csvHeader: ['ID', 'Source', 'Package', 'Description', 'PO', 'Shipment', 'ETD POL', 'ETA POD', 'Forecast on site', 'Actual on site', 'Status', 'Overdue', 'Gross weight (kg)', 'Qty', 'Yard', 'Issue'],
    csvRow: r => [r.id, r.source, r.packageNo, r.packageDescription, r.poNo, r.shipmentNo, r.etdPol, r.etaPod, r.forecastOnSite, r.actualOnSite, r.status, r.overdue ? 'Yes' : 'No', r.grossWeightKg, r.qty, r.deliveryYard, r.issue],
    prepare(row) {
      if (row.actualOnSite && row.status !== 'Received') row.status = 'Received';
      return row;
    },
    view(r, { cutoff }) {
      const late = !r.actualOnSite && r.status !== 'Received' && !!r.forecastOnSite && String(r.forecastOnSite) < cutoff;
      const when = r.actualOnSite ?? r.forecastOnSite;
      return { ...r, overdue: late, daysLate: late ? daysBetween(String(r.forecastOnSite), cutoff) : null, month: when ? String(when).slice(0, 7) : null, yard: r.deliveryYard ? String(r.deliveryYard) : 'Not stated' };
    },
  },
  balance: {
    label: 'stock line', sheet: SHEET.materialBalance, columns: COLUMNS.materialBalance, idKey: 'id', idPrefix: 'MB', idWidth: 3,
    ...withPartial(balanceShape), searchKeys: ['materialCode', 'description', 'poNo', 'supplier', 'mrirNo', 'heatNo', 'serialNo', 'location'],
    sortKeys: ['facility', 'discipline', 'category', 'materialCode', 'balance', 'yard', 'status'], defaultSort: 'facility', filters: ['facility', 'supply', 'category', 'yard'],
    csvName: 'material-balance.csv',
    csvHeader: ['ID', 'Facility', 'Supply', 'Discipline', 'Serial no', 'Category', 'Material code', 'Description', 'Grade', 'PO', 'Supplier', 'MRIR', 'Heat no', 'Unit', 'Balance', 'Yard', 'Location', 'Status'],
    csvRow: r => [r.id, r.facility, r.supply, r.discipline, r.serialNo, r.category, r.materialCode, r.description, r.grade, r.poNo, r.supplier, r.mrirNo, r.heatNo, r.unit, r.balance, r.yard, r.location, r.status],
  },
  summary: {
    label: 'material weight line', sheet: SHEET.materialSummary, columns: COLUMNS.materialSummary, idKey: 'id', idPrefix: 'MS', idWidth: 2,
    ...withPartial(summaryShape), searchKeys: ['facility', 'supply'], sortKeys: ['supply', 'facility', 'mtoKg', 'arrivedKg'], defaultSort: 'supply', filters: ['supply'],
    csvName: 'material-weights.csv', csvHeader: ['ID', 'Supply', 'Facility', 'Needed for purchase (kg)', 'Arrived (kg)', 'Arrived %', 'On VSP yard (kg)', 'On MC yard (kg)'],
    csvRow: r => [r.id, r.supply, r.facility, r.mtoKg, r.arrivedKg, r.arrivedPct, r.vspYardKg, r.mcYardKg],
    view(r) {
      const mto = r.mtoKg as number | null, got = r.arrivedKg as number | null;
      return { ...r, arrivedPct: mto && got != null ? Math.round((got / mto) * 1000) / 10 : null };
    },
  },
  concerns: {
    label: 'concern', sheet: SHEET.procConcerns, columns: COLUMNS.procConcerns, idKey: 'id', idPrefix: 'PC', idWidth: 3,
    create: concernCreate as never, patch: z.object(concernShape).partial() as never, searchKeys: ['id', 'packageCode', 'title', 'description', 'owner', 'action'],
    sortKeys: ['id', 'packageCode', 'severity', 'status', 'dueDate', 'raisedDate', 'owner'], defaultSort: 'id', filters: ['type', 'severity', 'area', 'source', 'packageCode', 'owner'], activeStatuses: ['Open', 'Mitigating'],
    predicates: { within: withinPredicate(concernDue, r => ACTIVE.has(String(r.status))) },
    csvName: 'procurement-concerns.csv',
    csvHeader: ['ID', 'Package', 'Type', 'Title', 'Severity', 'Area', 'Owner', 'Raised', 'Due', 'Status', 'Overdue', 'Action', 'Source'],
    csvRow: r => [r.id, r.packageCode, r.type, r.title, r.severity, r.area, r.owner, r.raisedDate, r.dueDate, r.status, r.overdue ? 'Yes' : 'No', r.action, r.source],
    prepare(row, { existing, svc, projectId }) {
      const code = row.packageCode as string | null;
      if (code) {
        const known = svc.rows(SHEET.procurement, COLUMNS.procurement, projectId).some(r => r.code === code) || svc.rows(SHEET.expediting, COLUMNS.expediting, projectId).some(r => r.code === code);
        if (!known) throw issue('packageCode', `Package "${code}" is not in the procurement or expediting register.`);
      }
      if (!existing && !row.raisedDate) row.raisedDate = String(svc.project(projectId).cutoff);
      return row;
    },
    view(r, { cutoff }) {
      const active = ACTIVE.has(String(r.status));
      return { ...r, overdue: active && !!r.dueDate && String(r.dueDate) < cutoff, ageDays: r.raisedDate ? Math.max(0, daysBetween(String(r.raisedDate), cutoff)) : null };
    },
  },
};

/* ============================ the service ============================ */
const baseCode = (code: string) => code.replace(/(?<=\d)[A-Z]$/, '');
const RISK_RANK: Record<string, number> = { Delay: 5, 'At High Risk': 4, 'At Risk': 3 };
const count = (rows: AnyRow[], key: string) => rows.reduce<Record<string, number>>((a, r) => { const k = String(r[key] ?? 'Unassigned'); a[k] = (a[k] ?? 0) + 1; return a; }, {});

/** Procurement registers with create, update and delete, and the dashboard that reads across all of them. */
export class ProcurementOps {
  readonly packages: Resource;
  readonly expediting: Resource;
  readonly logistics: Resource;
  readonly balance: Resource;
  readonly summary: Resource;
  readonly concerns: Resource;

  constructor(private readonly svc: Service) {
    this.packages = new Resource(svc, defs.packages as unknown as ResourceDef);
    this.expediting = new Resource(svc, defs.expediting as unknown as ResourceDef);
    this.logistics = new Resource(svc, defs.logistics as unknown as ResourceDef);
    this.balance = new Resource(svc, defs.balance as unknown as ResourceDef);
    this.summary = new Resource(svc, defs.summary as unknown as ResourceDef);
    this.concerns = new Resource(svc, defs.concerns as unknown as ResourceDef);
  }

  /** Open concerns by severity and type, the worst first, and the packages carrying the most. */
  concernSummary(projectId: string) {
    const cutoff = String(this.svc.project(projectId).cutoff);
    const all = this.concerns.rows(projectId).map(r => this.viewConcern(r, cutoff));
    const open = all.filter(r => ACTIVE.has(String(r.status)));
    const bySeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
    for (const r of open) bySeverity[String(r.severity)] = (bySeverity[String(r.severity)] ?? 0) + 1;
    const rank = (r: AnyRow) => SEVERITY_WEIGHT[String(r.severity)] ?? 0;
    const top = [...open].sort((a, b) => rank(b) - rank(a) || Number(b.ageDays ?? 0) - Number(a.ageDays ?? 0)).slice(0, 8);
    const perPackage = new Map<string, { code: string; open: number; score: number; worst: string }>();
    for (const r of open) {
      if (!r.packageCode) continue;
      const k = String(r.packageCode);
      const e = perPackage.get(k) ?? { code: k, open: 0, score: 0, worst: 'Low' };
      e.open++; e.score += rank(r); if (rank(r) > (SEVERITY_WEIGHT[e.worst] ?? 0)) e.worst = String(r.severity);
      perPackage.set(k, e);
    }
    return {
      total: all.length, open: open.length, closed: all.length - open.length, overdue: open.filter(r => r.overdue).length, bySeverity,
      byType: count(open, 'type'), byArea: count(open, 'area'), top, byPackage: [...perPackage.values()].sort((a, b) => b.score - a.score).slice(0, 8),
    };
  }

  private viewConcern(r: Row, cutoff: string): AnyRow {
    const { projectId: _p, ...rest } = r;
    return defs.concerns.view!(rest, { cutoff });
  }

  /* ---- the summaries at the top of each page ---- */
  private shipmentViews(projectId: string, cutoff: string): AnyRow[] {
    return this.svc.rows(SHEET.logistics, COLUMNS.logistics, projectId).map(({ projectId: _p, ...r }) => defs.logistics.view!(r, { cutoff }));
  }

  logisticsInsights(projectId: string): Insights {
    const cutoff = String(this.svc.project(projectId).cutoff);
    return logisticsInsights(this.shipmentViews(projectId, cutoff), cutoff);
  }

  planInsights(projectId: string): Insights {
    const cutoff = String(this.svc.project(projectId).cutoff);
    const pkgRows: AnyRow[] = this.svc.rows(SHEET.procurement, COLUMNS.procurement, projectId);
    const groups = new Map<string, number>();
    for (const r of pkgRows) groups.set(baseCode(String(r.code)), (groups.get(baseCode(String(r.code))) ?? 0) + 1);
    const weightOf = (r: AnyRow) => (r.weightPct == null ? 0 : Number(r.weightPct) / (groups.get(baseCode(String(r.code))) ?? 1));
    return planInsights(pkgRows, cutoff, weightOf);
  }

  expeditingInsights(projectId: string): Insights {
    const cutoff = String(this.svc.project(projectId).cutoff);
    return expeditingInsights(this.svc.rows(SHEET.expediting, COLUMNS.expediting, projectId), cutoff);
  }

  materialsInsights(projectId: string): Insights {
    return materialsInsights(this.summary.rows(projectId).map(({ projectId: _p, ...r }) => defs.summary.view!(r, { cutoff: '' })), this.balance.rows(projectId));
  }

  concernsInsights(projectId: string): Insights {
    const cutoff = String(this.svc.project(projectId).cutoff);
    return concernsInsights(this.concerns.rows(projectId).map(r => this.viewConcern(r, cutoff)), r => ACTIVE.has(String(r.status)), cutoff);
  }

  /** Cumulative procurement progress by week for one facility and one scope (LS, PS or both), plan against forecast and actual. */
  curves(projectId: string, facility?: string, scope?: string) {
    const cutoff = String(this.svc.project(projectId).cutoff);
    const rows = this.svc.rows(SHEET.procCurves, COLUMNS.procCurves, projectId);
    const facilities = [...new Set(rows.map(r => String(r.facility)))].sort((a, b) => (a === 'OVERALL' ? -1 : b === 'OVERALL' ? 1 : 0));
    const fac = facility && facilities.includes(facility) ? facility : facilities[0] ?? null;
    const scopes = ['OVR', 'LS', 'PS'].filter(s => rows.some(r => r.facility === fac && r.scope === s));
    const sc = scope && scopes.includes(scope) ? scope : scopes[0] ?? null;
    const row = rows.find(r => r.facility === fac && r.scope === sc);
    if (!row) return { cutoff, facilities, facility: fac, scopes, scope: sc, dates: [] as string[], plan: [] as (number | null)[], forecast: [] as (number | null)[], actual: [] as (number | null)[], latest: null };
    const parse = (s: unknown) => String(s ?? '').split(',').map(v => (v === '' ? null : Number(v)));
    const plan = parse(row.plan), forecast = parse(row.forecast);
    const dates = plan.map((_, i) => addDays(String(row.start), i * 7));
    const upTo = dates.filter(d => d <= cutoff).length;
    const actual = parse(row.actual).slice(0, upTo);
    const at = Math.min(upTo, actual.length) - 1;
    const latest = at >= 0 ? { date: dates[at], plan: plan[at], forecast: forecast[at], actual: actual[at] } : null;
    return { cutoff, facilities, facility: fac, scopes, scope: sc, dates, plan, forecast, actual, latest };
  }

  dashboard(projectId: string) {
    const cutoff = String(this.svc.project(projectId).cutoff);
    const states = this.svc.states(projectId);
    const on = (key: string) => isEffective(key, states);
    const strip = ({ projectId: _p, ...r }: Row) => r;

    const pkgRows = this.svc.rows(SHEET.procurement, COLUMNS.procurement, projectId);
    const exRows = this.svc.rows(SHEET.expediting, COLUMNS.expediting, projectId);
    const shipRows: AnyRow[] = this.svc.rows(SHEET.logistics, COLUMNS.logistics, projectId).map(r => defs.logistics.view!(strip(r), { cutoff }));
    const concernRows: AnyRow[] = this.concerns.rows(projectId).map(r => this.viewConcern(r, cutoff));
    const openConcerns = concernRows.filter(r => ACTIVE.has(String(r.status)));

    /* ---- pipeline ---- */
    const pipeline = on('procurement.procurement-plan') ? (() => {
      const groups = new Map<string, number>();
      for (const r of pkgRows) groups.set(baseCode(String(r.code)), (groups.get(baseCode(String(r.code))) ?? 0) + 1);
      const weightOf = (r: Row) => (r.weightPct == null ? 0 : Number(r.weightPct) / (groups.get(baseCode(String(r.code))) ?? 1));
      const totalWeight = pkgRows.reduce((s, r) => s + weightOf(r), 0);
      const placedWeight = pkgRows.filter(r => r.status === 'PO placed').reduce((s, r) => s + weightOf(r), 0);
      const byStatus = Object.fromEntries(PACKAGE_STATUSES.map(s => [s, pkgRows.filter(r => r.status === s).length]));
      const disciplines = [...new Set(pkgRows.map(r => String(r.discipline ?? 'Unassigned')))].sort();
      const slow = pkgRows.filter(r => r.status === 'LOA issued' && r.loaDate).map(r => ({ code: r.code, description: r.description, vendor: r.vendor, loaDate: r.loaDate, days: daysBetween(String(r.loaDate), cutoff) }))
        .filter(r => r.days > 30).sort((a, b) => b.days - a.days);
      return {
        total: pkgRows.length, byStatus, placedPct: totalWeight ? Math.round((placedWeight / totalWeight) * 1000) / 10 : null, byType: count(pkgRows, 'packageType'),
        byDiscipline: disciplines.map(d => ({ discipline: d, total: pkgRows.filter(r => String(r.discipline ?? 'Unassigned') === d).length, ...Object.fromEntries(PACKAGE_STATUSES.map(s => [s, pkgRows.filter(r => String(r.discipline ?? 'Unassigned') === d && r.status === s).length])) })),
        slowAward: slow.slice(0, 8), slowAwardCount: slow.length,
      };
    })() : null;

    /* ---- expediting ---- */
    const expediting = on('procurement.expediting.vendor-overview') ? (() => {
      const health = { delay: 0, highRisk: 0, atRisk: 0, ok: 0 };
      for (const r of exRows) { const s = String(r.status); if (s === 'Delay') health.delay++; else if (s === 'At High Risk') health.highRisk++; else if (s === 'At Risk') health.atRisk++; else health.ok++; }
      const both = exRows.filter(r => r.planPct != null && r.actualPct != null);
      const mean = (k: string) => (both.length ? Math.round((both.reduce((s, r) => s + Number(r[k]), 0) / both.length) * 10) / 10 : null);
      const brief = (r: Row) => ({ id: r.id, code: r.code, name: r.name, vendor: r.vendor, discipline: r.discipline, status: r.status, planPct: r.planPct ?? null, actualPct: r.actualPct ?? null, variance: r.variance ?? null, rosDate: r.rosDate ?? null });
      const behind = exRows.filter(r => r.variance != null && Number(r.variance) < 0).sort((a, b) => Number(a.variance) - Number(b.variance)).slice(0, 10).map(brief);
      const open = exRows.filter(r => !/^(Arrived)$/i.test(String(r.status)) && Number(r.actualPct ?? 0) < 100);
      const horizon = addDays(cutoff, 30);
      const rosSoon = open.filter(r => r.rosDate && String(r.rosDate) >= cutoff && String(r.rosDate) <= horizon).sort((a, b) => String(a.rosDate).localeCompare(String(b.rosDate)));
      const rosPassed = open.filter(r => r.rosDate && String(r.rosDate) < cutoff).sort((a, b) => String(a.rosDate).localeCompare(String(b.rosDate)));
      const disciplines = [...new Set(exRows.map(r => String(r.discipline ?? 'Unassigned')))].sort();
      return {
        total: exRows.length, byStatus: count(exRows, 'status'), health, avgPlanPct: mean('planPct'), avgActualPct: mean('actualPct'), behind,
        rosSoon: rosSoon.slice(0, 10).map(r => ({ ...brief(r), daysToRos: daysBetween(cutoff, String(r.rosDate)) })), rosSoonCount: rosSoon.length,
        rosPassed: rosPassed.slice(0, 8).map(r => ({ ...brief(r), daysPast: daysBetween(String(r.rosDate), cutoff) })), rosPassedCount: rosPassed.length,
        byDiscipline: disciplines.map(d => {
          const list = exRows.filter(r => String(r.discipline ?? 'Unassigned') === d);
          const v = list.filter(r => r.variance != null).map(r => Number(r.variance));
          return {
            discipline: d, total: list.length, delay: list.filter(r => r.status === 'Delay').length, highRisk: list.filter(r => r.status === 'At High Risk').length,
            atRisk: list.filter(r => r.status === 'At Risk').length, avgVariance: v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null,
          };
        }),
      };
    })() : null;

    /* ---- logistics ---- */
    const logistics = on('procurement.logistics') ? (() => {
      const notYet = shipRows.filter(r => !r.actualOnSite && r.status !== 'Received');
      const horizon = addDays(cutoff, 14);
      const overdue = shipRows.filter(r => r.overdue).sort((a, b) => Number(b.daysLate) - Number(a.daysLate));
      const soon = notYet.filter(r => r.forecastOnSite && String(r.forecastOnSite) >= cutoff && String(r.forecastOnSite) <= horizon).sort((a, b) => String(a.forecastOnSite).localeCompare(String(b.forecastOnSite)));
      const held = shipRows.filter(r => r.issue && r.status !== 'Received');
      const kg = (rows: Row[]) => Math.round(rows.reduce((s, r) => s + Number(r.grossWeightKg ?? 0), 0));
      return {
        total: shipRows.length, byStatus: count(shipRows, 'status'), bySource: count(shipRows, 'source'), weightKg: kg(shipRows), receivedKg: kg(shipRows.filter(r => r.status === 'Received')),
        inTransit: notYet.length, overdueCount: overdue.length, overdue: overdue.slice(0, 10), soonCount: soon.length, soon: soon.slice(0, 10), heldCount: held.length, held: held.slice(0, 10),
      };
    })() : null;

    /* ---- materials ---- */
    const materials = on('procurement.materials') ? (() => {
      const rows: AnyRow[] = this.summary.rows(projectId).map(r => defs.summary.view!(strip(r), { cutoff }));
      const totals = (supply: string) => {
        const list = rows.filter(r => r.supply === supply);
        const mto = list.reduce((s, r) => s + Number(r.mtoKg ?? 0), 0), got = list.reduce((s, r) => s + Number(r.arrivedKg ?? 0), 0);
        return { supply, mtoKg: Math.round(mto), arrivedKg: Math.round(got), arrivedPct: mto ? Math.round((got / mto) * 1000) / 10 : null };
      };
      return { rows, totals: [totals('PTSC MC'), totals('Client')], stockLines: this.balance.rows(projectId).length };
    })() : null;

    /* ---- concerns ---- */
    const concerns = on('procurement.concerns') ? this.concernSummary(projectId) : null;

    /* ---- packages that need attention: every signal that points at the same package, added up ---- */
    const meta = new Map<string, { name: unknown; vendor: unknown; discipline: unknown }>();
    for (const r of pkgRows) meta.set(String(r.code), { name: r.description, vendor: r.vendor, discipline: r.discipline });
    for (const r of exRows) meta.set(String(r.code), { name: r.name ?? meta.get(String(r.code))?.name, vendor: r.vendor ?? meta.get(String(r.code))?.vendor, discipline: r.discipline ?? meta.get(String(r.code))?.discipline });
    const score = new Map<string, { score: number; reasons: string[] }>();
    const note = (code: unknown, points: number, reason: string) => {
      if (!code) return;
      const e = score.get(String(code)) ?? { score: 0, reasons: [] };
      e.score += points; e.reasons.push(reason); score.set(String(code), e);
    };
    if (expediting) {
      for (const r of exRows) {
        const rank = RISK_RANK[String(r.status)];
        if (rank) note(r.code, rank, `Expediting: ${r.status}`);
        if (r.variance != null && Number(r.variance) <= -5) note(r.code, 2, `${Math.abs(Number(r.variance))} points behind plan`);
        if (r.rosDate && String(r.rosDate) < cutoff && !/^Arrived$/i.test(String(r.status)) && Number(r.actualPct ?? 0) < 100) note(r.code, 3, `Required date ${daysBetween(String(r.rosDate), cutoff)} days ago`);
      }
    }
    if (pipeline) for (const r of pipeline.slowAward) note(r.code, 2, `${r.days} days since LOA with no PO`);
    if (logistics) {
      for (const r of logistics.overdue) note(r.packageNo, 3, `Shipment ${r.shipmentNo ?? ''} ${r.daysLate} days late`.replace('  ', ' '));
      for (const r of shipRows.filter(x => x.issue && x.status !== 'Received')) note(r.packageNo, 2, `Shipment held: ${String(r.issue).slice(0, 60)}`);
    }
    if (concerns) {
      const byPkg = new Map<string, AnyRow[]>();
      for (const r of openConcerns) if (r.packageCode) byPkg.set(String(r.packageCode), [...(byPkg.get(String(r.packageCode)) ?? []), r]);
      for (const [code, list] of byPkg) {
        const worst = list.reduce((m, r) => Math.max(m, SEVERITY_WEIGHT[String(r.severity)] ?? 0), 0);
        note(code, worst + (list.length - 1), `${list.length} open ${list.length === 1 ? 'concern' : 'concerns'}, worst ${Object.keys(SEVERITY_WEIGHT).find(k => SEVERITY_WEIGHT[k] === worst)}`);
        if (list.some(r => r.overdue)) note(code, 2, 'Action overdue');
      }
    }
    const attention = [...score.entries()].map(([code, e]) => ({
      code, name: meta.get(code)?.name ?? null, vendor: meta.get(code)?.vendor ?? null, discipline: meta.get(code)?.discipline ?? null,
      score: e.score, level: e.score >= 9 ? 'Critical' : e.score >= 5 ? 'High' : 'Medium', reasons: [...new Set(e.reasons)],
    })).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));

    // The seeded work-package rows come from Procurement Plan → Progress Table (W),
    // M/N (cumulative this-week plan/actual). The source sheet's OVERALL row
    // reconciles to the weighted roll-up in Service.workPackages.
    const progressRows = this.svc.workPackages(projectId);
    const workPackages = {
      overall: { plan: progressRows.overall.thisWeekPlan, actual: progressRows.overall.thisWeekActual },
      items: progressRows.items.map(w => ({ code: w.code, name: w.name, plan: w.thisWeekPlan, actual: w.thisWeekActual })),
    };
    return { cutoff, pipeline, expediting, logistics, materials, concerns, workPackages, attention: attention.slice(0, 15), attentionCount: attention.length };
  }
}
