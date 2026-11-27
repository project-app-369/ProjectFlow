import type { AnyRow } from './crud';

/**
 * Summaries shown at the top of each procurement page. Every builder is a pure function of the rows and the reporting
 * cut-off, so the numbers follow a cut-off report like everything else. The shape is the same for every page so the
 * web client can draw them with one component: six cards, an optional pipeline strip, an optional look-ahead, and charts.
 */
export interface InsightCard { label: string; value: string | number; foot: string; icon: string; tone?: 'red' | 'amber' | 'green' }
export interface InsightBox { label: string; value: number; sub: string; tone?: 'red' | 'amber' | 'green'; filter?: Record<string, string> }
export interface InsightChart {
  title: string; sub: string; layout: 'column' | 'bar'; stacked?: boolean; unit: string; categoryKind?: 'month';
  categories: string[]; series: { name: string; color: string; data: number[] }[];
  /** The register filter a click on a category sets, and the value for each category (defaults to the category). */
  filterKey?: string; filterValues?: string[];
}
export interface Insights {
  cards: InsightCard[];
  strip?: { title: string; sub: string; boxes: InsightBox[] };
  lookAhead?: { title: string; sub: string; boxes: InsightBox[] };
  charts: InsightChart[];
}

/**
 * Colours are named by meaning, never by hue; the web client resolves them to its themed tokens so every chart agrees.
 * Time series: plan, forecast, actual. Progress: done, open, wait, neutral. Severity ramp: low, medium, high, critical.
 * brand is for single-series counts that carry no status.
 */
export const COLOR = { plan: 'plan', forecast: 'forecast', actual: 'actual', done: 'done', open: 'open', wait: 'wait', neutral: 'neutral', brand: 'brand', low: 'low', medium: 'medium', high: 'high', critical: 'critical' } as const;

const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (rows: AnyRow[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const kgToT = (kg: number) => r1(kg / 1000);
const tText = (kg: number) => `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/** Counts per key, in the given order first and then alphabetically for anything else. */
function tally(rows: AnyRow[], keyOf: (r: AnyRow) => string | null, order: string[] = []) {
  const m = new Map<string, AnyRow[]>();
  for (const r of rows) { const k = keyOf(r); if (k == null) continue; m.set(k, [...(m.get(k) ?? []), r]); }
  const keys = [...order.filter(k => m.has(k)), ...[...m.keys()].filter(k => !order.includes(k)).sort()];
  return { keys, get: (k: string) => m.get(k) ?? [] };
}

/** The look-ahead windows shared by every page: overdue, within 30, 45 and 60 days, and undated. */
function windows(rows: AnyRow[], dateOf: (r: AnyRow) => string | null, cutoff: string, weight: (rs: AnyRow[]) => string, unit: string, filterKey = 'within'): InsightBox[] {
  const open = (rs: AnyRow[]) => weight(rs);
  const dated = rows.map(r => ({ r, d: dateOf(r) }));
  const within = (n: number) => dated.filter(x => x.d && x.d >= cutoff && x.d <= addDays(cutoff, n)).map(x => x.r);
  const overdue = dated.filter(x => x.d && x.d < cutoff).map(x => x.r);
  const undated = dated.filter(x => !x.d).map(x => x.r);
  const box = (label: string, rs: AnyRow[], value: string, tone?: InsightBox['tone']): InsightBox => ({ label, value: rs.length, sub: open(rs) || unit, tone: rs.length ? tone : undefined, filter: { [filterKey]: value } });
  return [box('Overdue', overdue, 'overdue', 'red'), box('Within 30 days', within(30), '30', 'amber'), box('Within 45 days', within(45), '45'), box('Within 60 days', within(60), '60'), box('No date', undated, 'none')];
}

/** Predicate for the `within` filter: matches the window the look-ahead box counts. */
export function withinPredicate(dateOf: (r: AnyRow) => string | null, isOpen: (r: AnyRow) => boolean) {
  return (r: AnyRow, value: string, ctx: { cutoff: string }) => {
    if (!isOpen(r)) return false;
    const d = dateOf(r);
    if (value === 'none') return !d;
    if (!d) return false;
    if (value === 'overdue') return d < ctx.cutoff;
    return d >= ctx.cutoff && d <= addDays(ctx.cutoff, Number(value));
  };
}

/* ============================== logistics ============================== */
export const SHIPMENT_STAGES: [status: string, label: string][] = [
  ['Planned', 'Ready ex-works'], ['On Sailing', 'On sailing'], ['Under Customs', 'Under customs'], ['Inland transportation', 'Inland transport'], ['Received', 'Received at yard'],
];
export const shipmentOpen = (r: AnyRow) => !r.actualOnSite && r.status !== 'Received';
export const shipmentDue = (r: AnyRow) => (r.forecastOnSite ? String(r.forecastOnSite) : null);

export function logisticsInsights(rows: AnyRow[], cutoff: string): Insights {
  const ptsc = rows.filter(r => r.source === 'PTSC'), client = rows.filter(r => r.source === 'Client');
  const open = rows.filter(shipmentOpen);
  const received = (rs: AnyRow[]) => rs.filter(r => !shipmentOpen(r));
  const customs = rows.filter(r => r.status === 'Under Customs');
  const late = rows.filter(r => r.overdue);
  const openPtsc = ptsc.filter(shipmentOpen);

  const byMonth = tally(rows, r => { const d = r.actualOnSite ?? r.forecastOnSite; return d ? String(d).slice(0, 7) : null; });
  const yard = tally(rows, r => (r.deliveryYard ? String(r.deliveryYard) : 'Not stated'));
  const yardKeys = [...yard.keys].sort((a, b) => sum(yard.get(b), 'grossWeightKg') - sum(yard.get(a), 'grossWeightKg'));

  return {
    cards: [
      { label: 'PTSC shipments tracked', value: ptsc.length, foot: `${tText(sum(ptsc, 'grossWeightKg'))} gross weight`, icon: 'box' },
      { label: 'Received at yard', value: received(ptsc).length, foot: tText(sum(received(ptsc), 'grossWeightKg')), icon: 'check', tone: 'green' },
      { label: 'In transit / pending', value: openPtsc.length, foot: `${tText(sum(openPtsc, 'grossWeightKg'))} still moving`, icon: 'calendar' },
      { label: 'Under customs clearance', value: customs.length, foot: customs.length ? `${tText(sum(customs, 'grossWeightKg'))} · watch for clearance delays` : 'Watch for clearance delays', icon: 'flag', tone: customs.length ? 'amber' : undefined },
      { label: 'Pending past forecast on-site', value: late.length, foot: 'Forecast date before the cut-off', icon: 'clock', tone: late.length ? 'red' : undefined },
      { label: 'Client free-issue shipments', value: client.length, foot: tText(sum(client, 'grossWeightKg')), icon: 'layers' },
    ],
    strip: {
      title: 'Shipment pipeline', sub: 'Where every shipment stands at the cut-off, from vendor works to the yard. Select a stage to filter the register.',
      boxes: SHIPMENT_STAGES.map(([status, label]) => { const rs = rows.filter(r => r.status === status); return { label, value: rs.length, sub: tText(sum(rs, 'grossWeightKg')), filter: { status } }; }),
    },
    lookAhead: {
      title: 'Receiving look-ahead', sub: 'Shipments not yet received, by forecast date on site, counted from the cut-off. Select a window to filter the register.',
      boxes: windows(open, shipmentDue, cutoff, rs => tText(sum(rs, 'grossWeightKg')), '0 t'),
    },
    charts: [
      {
        title: 'Arrivals at site by month (gross weight, t)', sub: 'Actual on-site date for received shipments, forecast for open ones. Select a month to list its shipments.', layout: 'column', stacked: true, unit: 't', categoryKind: 'month',
        categories: byMonth.keys, filterKey: 'month',
        series: [
          { name: 'Received (actual)', color: COLOR.done, data: byMonth.keys.map(k => kgToT(sum(received(byMonth.get(k)), 'grossWeightKg'))) },
          { name: 'Open (forecast)', color: COLOR.forecast, data: byMonth.keys.map(k => kgToT(sum(byMonth.get(k).filter(shipmentOpen), 'grossWeightKg'))) },
        ],
      },
      {
        title: 'Weight at delivery yards (t)', sub: 'Gross weight by receiving yard, received against still to arrive. Select a yard to filter.', layout: 'bar', stacked: true, unit: 't', categories: yardKeys, filterKey: 'yard',
        series: [
          { name: 'Received', color: COLOR.done, data: yardKeys.map(k => kgToT(sum(received(yard.get(k)), 'grossWeightKg'))) },
          { name: 'Still to arrive', color: COLOR.open, data: yardKeys.map(k => kgToT(sum(yard.get(k).filter(shipmentOpen), 'grossWeightKg'))) },
        ],
      },
    ],
  };
}

/* ============================== procurement plan ============================== */
export function planInsights(pkgs: AnyRow[], cutoff: string, weightOf: (r: AnyRow) => number): Insights {
  const status = (s: string) => pkgs.filter(r => r.status === s);
  const share = (rs: AnyRow[]) => { const total = pkgs.reduce((s, r) => s + weightOf(r), 0); return total ? r1((rs.reduce((s, r) => s + weightOf(r), 0) / total) * 100) : 0; };
  const loa = status('LOA issued');
  const age = (r: AnyRow) => (r.loaDate ? daysBetween(String(r.loaDate), cutoff) : null);
  const aged = loa.filter(r => age(r) != null);
  const band = (lo: number, hi: number) => aged.filter(r => age(r)! >= lo && age(r)! <= hi);
  const placed = status('PO placed');
  const poIn = (days: number) => placed.filter(r => r.poDate && String(r.poDate) <= cutoff && String(r.poDate) > addDays(cutoff, -days));
  const slow = loa.filter(r => (age(r) ?? 0) > 30);
  const oldest = aged.reduce<AnyRow | null>((m, r) => (!m || age(r)! > age(m)! ? r : m), null);
  const wps = new Set(pkgs.map(r => r.workPackage).filter(Boolean));
  const byMonth = tally(placed.filter(r => r.poDate), r => String(r.poDate).slice(0, 7));
  const wp = tally(pkgs, r => String(r.workPackage ?? 'Unassigned'));
  const buyer = tally(pkgs.filter(r => r.status !== 'PO placed'), r => String(r.buyer ?? 'Unassigned'));
  const buyerKeys = [...buyer.keys].sort((a, b) => buyer.get(b).length - buyer.get(a).length).slice(0, 10);
  const STAGES = ['Planned', 'In tendering', 'LOA issued', 'PO placed'];
  const STAGE_COLORS = [COLOR.neutral, COLOR.plan, COLOR.wait, COLOR.done];

  return {
    cards: [
      { label: 'Packages', value: pkgs.length, foot: `${plural(wps.size, 'work package')} · ${pkgs.filter(r => r.packageType === 'LS').length} LS · ${pkgs.filter(r => r.packageType === 'PS').length} PS`, icon: 'box' },
      { label: 'PO placed', value: placed.length, foot: `${share(placed)}% of the progress weight`, icon: 'check', tone: 'green' },
      { label: 'LOA awaiting PO', value: loa.length, foot: oldest ? `Oldest ${age(oldest)} days (${oldest.code})` : 'None waiting', icon: 'clock' },
      { label: 'In tendering / planned', value: status('In tendering').length + status('Planned').length, foot: `${status('In tendering').length} in tendering · ${status('Planned').length} planned`, icon: 'layers' },
      { label: 'POs placed, last 30 days', value: poIn(30).length, foot: `${poIn(90).length} in the last 90 days`, icon: 'calendar' },
      { label: 'Waiting over 30 days', value: slow.length, foot: 'LOA issued, still no PO', icon: 'risk', tone: slow.length ? 'amber' : undefined },
    ],
    strip: {
      title: 'Award pipeline', sub: 'Packages by stage, with the share of overall progress weight each carries. Select a stage to filter the register.',
      boxes: STAGES.map(s => { const rs = status(s); return { label: s, value: rs.length, sub: `${share(rs)}% of weight`, filter: { status: s } }; }),
    },
    lookAhead: {
      title: 'LOA awaiting PO — ageing', sub: 'Days since the LOA was issued for packages that have no PO yet.',
      boxes: [
        { label: '0–30 days', value: band(0, 30).length, sub: 'Normal award window' },
        { label: '31–60 days', value: band(31, 60).length, sub: 'Follow up the buyer', tone: band(31, 60).length ? 'amber' : undefined },
        { label: '61–90 days', value: band(61, 90).length, sub: 'Escalate', tone: band(61, 90).length ? 'red' : undefined },
        { label: 'Over 90 days', value: band(91, 99999).length, sub: 'Stalled', tone: band(91, 99999).length ? 'red' : undefined },
        { label: 'No LOA date', value: loa.length - aged.length, sub: 'Date missing' },
      ],
    },
    charts: [
      { title: 'POs placed by month', sub: 'Packages by PO date.', layout: 'column', unit: 'packages', categoryKind: 'month', categories: byMonth.keys, series: [{ name: 'POs placed', color: COLOR.done, data: byMonth.keys.map(k => byMonth.get(k).length) }] },
      {
        title: 'Stage by work package', sub: 'Packages by stage in each work package.', layout: 'bar', stacked: true, unit: 'packages', categories: wp.keys, filterKey: 'workPackage',
        series: STAGES.map((s, i) => ({ name: s, color: STAGE_COLORS[i], data: wp.keys.map(k => wp.get(k).filter(r => r.status === s).length) })),
      },
      {
        title: 'Open packages by buyer', sub: 'Packages not yet at PO, for the ten busiest buyers.', layout: 'bar', stacked: true, unit: 'packages', categories: buyerKeys, filterKey: 'buyer',
        series: STAGES.slice(0, 3).map((s, i) => ({ name: s, color: STAGE_COLORS[i], data: buyerKeys.map(k => buyer.get(k).filter(r => r.status === s).length) })),
      },
    ],
  };
}

/* ============================== expediting ============================== */
export const expeditingDone = (r: AnyRow) => /^arrived$/i.test(String(r.status)) || Number(r.actualPct ?? 0) >= 100;
export const expeditingDue = (r: AnyRow) => (r.rosDate ? String(r.rosDate) : null);

export function expeditingInsights(rows: AnyRow[], cutoff: string): Insights {
  const st = (s: string) => rows.filter(r => r.status === s);
  const open = rows.filter(r => !expeditingDone(r));
  const both = rows.filter(r => r.planPct != null && r.actualPct != null);
  const avgPlan = mean(both.map(r => Number(r.planPct))), avgActual = mean(both.map(r => Number(r.actualPct)));
  const flagged = ['Delay', 'At High Risk', 'At Risk'].reduce((n, s) => n + st(s).length, 0);
  const behind = rows.filter(r => r.variance != null && Number(r.variance) <= -5);
  const passed = open.filter(r => r.rosDate && String(r.rosDate) < cutoff);
  const vendors = new Set(rows.map(r => r.vendor).filter(Boolean));
  const byMonth = tally(open.filter(r => r.rosDate), r => String(r.rosDate).slice(0, 7));
  const disc = tally(rows, r => String(r.discipline ?? 'Unassigned'));
  const avg = (rs: AnyRow[], k: string) => mean(rs.filter(r => r[k] != null).map(r => Number(r[k]))) ?? 0;

  return {
    cards: [
      { label: 'Packages tracked', value: rows.length, foot: `${plural(vendors.size, 'vendor')} · ${plural(disc.keys.length, 'discipline')}`, icon: 'box' },
      { label: 'Average progress', value: avgActual != null ? `${avgActual}%` : '—', foot: avgPlan != null ? `${avgPlan}% planned (${avgActual != null ? (avgActual - avgPlan > 0 ? '+' : '') + r1(avgActual - avgPlan) : '—'} pp)` : 'No plan', icon: 'chart', tone: avgActual != null && avgPlan != null && avgActual < avgPlan ? 'amber' : 'green' },
      { label: 'Flagged packages', value: flagged, foot: `${st('Delay').length} delay · ${st('At High Risk').length} high risk · ${st('At Risk').length} at risk`, icon: 'risk', tone: flagged ? 'red' : undefined },
      { label: 'Five or more points behind', value: behind.length, foot: 'Actual progress under plan', icon: 'clock', tone: behind.length ? 'amber' : undefined },
      { label: 'Required date passed', value: passed.length, foot: 'Not yet arrived or complete', icon: 'calendar', tone: passed.length ? 'red' : undefined },
      { label: 'Arrived or complete', value: rows.length - open.length, foot: `${rows.length ? Math.round(((rows.length - open.length) / rows.length) * 100) : 0}% of packages`, icon: 'check', tone: 'green' },
    ],
    strip: {
      title: 'Package health', sub: 'Packages by status at the cut-off. Select a status to filter the register.',
      boxes: [
        { label: 'On track', value: rows.length - flagged - st('Arrived').length, sub: 'Normal or in production' },
        { label: 'At risk', value: st('At Risk').length, sub: 'Watch', tone: st('At Risk').length ? 'amber' : undefined, filter: { status: 'At Risk' } },
        { label: 'At high risk', value: st('At High Risk').length, sub: 'Needs action', tone: st('At High Risk').length ? 'red' : undefined, filter: { status: 'At High Risk' } },
        { label: 'Delay', value: st('Delay').length, sub: 'Behind the required date', tone: st('Delay').length ? 'red' : undefined, filter: { status: 'Delay' } },
        { label: 'Arrived', value: st('Arrived').length, sub: 'At site', tone: 'green', filter: { status: 'Arrived' } },
      ],
    },
    lookAhead: {
      title: 'Required-on-site look-ahead', sub: 'Packages not yet arrived, by required-on-site (ROS) date, counted from the cut-off. Select a window to filter the register.',
      boxes: windows(open, expeditingDue, cutoff, rs => `${avg(rs, 'actualPct')}% avg progress`, 'No packages'),
    },
    charts: [
      { title: 'Required on site by month', sub: 'Packages not yet arrived, by ROS date.', layout: 'column', unit: 'packages', categoryKind: 'month', categories: byMonth.keys, series: [{ name: 'Packages', color: COLOR.open, data: byMonth.keys.map(k => byMonth.get(k).length) }] },
      {
        title: 'Progress by discipline (%)', sub: 'Average plan against average actual. Select a discipline to filter.', layout: 'column', unit: '%', categories: disc.keys, filterKey: 'discipline',
        series: [{ name: 'Plan', color: COLOR.plan, data: disc.keys.map(k => avg(disc.get(k), 'planPct')) }, { name: 'Actual', color: COLOR.actual, data: disc.keys.map(k => avg(disc.get(k), 'actualPct')) }],
      },
      {
        title: 'Flags by discipline', sub: 'Packages that are delayed, at high risk or at risk.', layout: 'bar', stacked: true, unit: 'packages', categories: disc.keys, filterKey: 'discipline',
        series: [['Delay', COLOR.critical], ['At High Risk', COLOR.high], ['At Risk', COLOR.medium]].map(([s, color]) => ({ name: s, color, data: disc.keys.map(k => disc.get(k).filter(r => r.status === s).length) })),
      },
    ],
  };
}

/* ============================== materials ============================== */
export function materialsInsights(summary: AnyRow[], stock: AnyRow[]): Insights {
  const supply = (s: string) => summary.filter(r => r.supply === s);
  const mto = (rs: AnyRow[]) => sum(rs, 'mtoKg'), got = (rs: AnyRow[]) => sum(rs, 'arrivedKg');
  const pct = (rs: AnyRow[]) => (mto(rs) ? r1((got(rs) / mto(rs)) * 100) : null);
  const hold = stock.filter(r => /hold/i.test(String(r.status ?? '')));
  const yard = tally(stock, r => String(r.yard ?? 'Not stated'));
  const yardKeys = [...yard.keys].sort((a, b) => yard.get(b).length - yard.get(a).length);
  const cat = tally(stock, r => String(r.category ?? 'Other'));
  const catKeys = [...cat.keys].sort((a, b) => cat.get(b).length - cat.get(a).length).slice(0, 12);
  const label = (r: AnyRow) => `${r.facility} (${r.supply === 'Client' ? 'client' : 'PTSC'})`;
  const withTarget = summary.filter(r => r.mtoKg);
  const toArrive = withTarget.reduce((s, r) => s + Math.max(0, Number(r.mtoKg) - Number(r.arrivedKg ?? 0)), 0);

  return {
    cards: [
      { label: 'Needed for purchase', value: tText(mto(summary)), foot: `PTSC MC ${tText(mto(supply('PTSC MC')))} · client ${tText(mto(supply('Client')))}`, icon: 'layers' },
      { label: 'Arrived', value: tText(got(summary)), foot: `${pct(summary) ?? '—'}% of what is needed`, icon: 'box', tone: 'green' },
      { label: 'PTSC MC supply arrived', value: pct(supply('PTSC MC')) != null ? `${pct(supply('PTSC MC'))}%` : '—', foot: `${tText(got(supply('PTSC MC')))} of ${tText(mto(supply('PTSC MC')))}`, icon: 'chart' },
      { label: 'Client supply arrived', value: pct(supply('Client')) != null ? `${pct(supply('Client'))}%` : '—', foot: `${tText(got(supply('Client')))} of ${tText(mto(supply('Client')))}`, icon: 'chart' },
      { label: 'On VSP yard', value: tText(sum(summary, 'vspYardKg')), foot: `On MC yard ${tText(sum(summary, 'mcYardKg'))}`, icon: 'flag' },
      { label: 'Stock lines on hand', value: stock.length, foot: hold.length ? `${hold.length} on hold` : 'None on hold', icon: 'check', tone: hold.length ? 'amber' : undefined },
    ],
    strip: {
      title: 'Where the material is', sub: 'Weight needed for purchase against what has arrived and where it sits.',
      boxes: [
        { label: 'Needed', value: kgToT(mto(summary)), sub: 't for purchase' },
        { label: 'Arrived', value: kgToT(got(summary)), sub: `t · ${pct(summary) ?? '—'}%`, tone: 'green' },
        { label: 'On VSP yard', value: kgToT(sum(summary, 'vspYardKg')), sub: 't' },
        { label: 'On MC yard', value: kgToT(sum(summary, 'mcYardKg')), sub: 't' },
        { label: 'Still to arrive', value: kgToT(toArrive), sub: 't where a target is set', tone: toArrive ? 'amber' : undefined },
      ],
    },
    charts: [
      {
        title: 'Needed against arrived by facility (t)', sub: 'Weight needed for purchase and weight arrived, by facility and supply.', layout: 'column', unit: 't', categories: withTarget.map(label),
        series: [{ name: 'Needed', color: COLOR.plan, data: withTarget.map(r => kgToT(Number(r.mtoKg))) }, { name: 'Arrived', color: COLOR.actual, data: withTarget.map(r => kgToT(Number(r.arrivedKg ?? 0))) }],
      },
      { title: 'Stock lines by yard', sub: 'Lines on hand. Select a yard to filter.', layout: 'bar', unit: 'lines', categories: yardKeys, filterKey: 'yard', filterValues: yardKeys, series: [{ name: 'Lines', color: COLOR.brand, data: yardKeys.map(k => yard.get(k).length) }] },
      { title: 'Stock lines by category', sub: 'The twelve largest categories. Select one to filter.', layout: 'bar', unit: 'lines', categories: catKeys, filterKey: 'category', series: [{ name: 'Lines', color: COLOR.brand, data: catKeys.map(k => cat.get(k).length) }] },
    ],
  };
}

/* ============================== risks, concerns and issues ============================== */
export const concernDue = (r: AnyRow) => (r.dueDate ? String(r.dueDate) : null);
export function concernsInsights(rows: AnyRow[], active: (r: AnyRow) => boolean, cutoff: string): Insights {
  const open = rows.filter(active);
  const sev = (s: string) => open.filter(r => r.severity === s);
  const overdue = open.filter(r => r.overdue);
  const due30 = open.filter(r => r.dueDate && String(r.dueDate) >= cutoff && String(r.dueDate) <= addDays(cutoff, 30));
  const ages = open.filter(r => r.ageDays != null).map(r => Number(r.ageDays));
  const area = tally(open, r => String(r.area ?? 'Other'));
  const owner = tally(open, r => String(r.owner ?? 'Unassigned'));
  const ownerKeys = [...owner.keys].sort((a, b) => owner.get(b).length - owner.get(a).length).slice(0, 10);
  const pkg = tally(open.filter(r => r.packageCode), r => String(r.packageCode));
  const pkgKeys = [...pkg.keys].sort((a, b) => pkg.get(b).length - pkg.get(a).length).slice(0, 8);
  const SEV = ['Critical', 'High', 'Medium', 'Low'], SEV_COLOR = [COLOR.critical, COLOR.high, COLOR.medium, COLOR.low];
  const sevSeries = (keys: string[], get: (k: string) => AnyRow[]) => SEV.map((s, i) => ({ name: s, color: SEV_COLOR[i], data: keys.map(k => get(k).filter(r => r.severity === s).length) }));

  return {
    cards: [
      { label: 'Open', value: open.length, foot: `${rows.length - open.length} resolved or closed`, icon: 'risk' },
      { label: 'Critical or high', value: sev('Critical').length + sev('High').length, foot: `${sev('Critical').length} critical · ${sev('High').length} high`, icon: 'flag', tone: sev('Critical').length + sev('High').length ? 'red' : undefined },
      { label: 'Action overdue', value: overdue.length, foot: 'Due date before the cut-off', icon: 'clock', tone: overdue.length ? 'red' : undefined },
      { label: 'Action due in 30 days', value: due30.length, foot: 'Open, with a due date', icon: 'calendar', tone: due30.length ? 'amber' : undefined },
      { label: 'Average age', value: ages.length ? `${Math.round(ages.reduce((s, x) => s + x, 0) / ages.length)} d` : '—', foot: 'Of open items, since raised', icon: 'chart' },
      { label: 'Packages affected', value: pkg.keys.length, foot: `${open.filter(r => !r.packageCode).length} open without a package`, icon: 'box' },
    ],
    strip: {
      title: 'Open items by severity', sub: 'Open risks, concerns and issues. Select a severity to filter the register.',
      boxes: SEV.map((s, i) => ({ label: s, value: sev(s).length, sub: `${sev(s).filter(r => r.overdue).length} overdue`, tone: i < 2 && sev(s).length ? 'red' : undefined, filter: { severity: s } })),
    },
    lookAhead: {
      title: 'Action look-ahead', sub: 'Open items by action due date, counted from the cut-off. Select a window to filter the register.',
      boxes: windows(open, concernDue, cutoff, rs => `${rs.filter(r => r.severity === 'Critical' || r.severity === 'High').length} critical or high`, 'None'),
    },
    charts: [
      { title: 'Open items by area', sub: 'Select an area to filter.', layout: 'bar', stacked: true, unit: 'items', categories: area.keys, filterKey: 'area', series: sevSeries(area.keys, area.get) },
      { title: 'Open items by owner', sub: 'The ten owners with most open items.', layout: 'bar', stacked: true, unit: 'items', categories: ownerKeys, filterKey: 'owner', series: sevSeries(ownerKeys, owner.get) },
      { title: 'Open items by package', sub: 'The eight packages with most open items. Select one to filter.', layout: 'bar', stacked: true, unit: 'items', categories: pkgKeys, filterKey: 'packageCode', series: sevSeries(pkgKeys, pkg.get) },
    ],
  };
}

/* ============================== milestones ============================== */
export const milestoneOpen = (r: AnyRow) => !r.actual;
export const milestoneDue = (r: AnyRow) => (r.forecast ?? r.planBaseline ? String(r.forecast ?? r.planBaseline) : null);
export function milestonesInsights(rows: AnyRow[], cutoff: string): Insights {
  const open = rows.filter(milestoneOpen);
  const st = (s: string) => rows.filter(r => r.status === s);
  const slipping = open.filter(r => r.slipDays != null && Number(r.slipDays) > 0);
  const slips = slipping.map(r => Number(r.slipDays));
  const subs = tally(rows, r => String(r.subName ?? 'Unassigned'));
  const facilities = tally(rows, r => String(r.facility ?? 'Project'));
  const byMonth = tally(rows, r => { const d = r.actual ?? r.forecast ?? r.planBaseline; return d ? String(d).slice(0, 7) : null; });
  const nextOne = [...open].filter(r => milestoneDue(r)).sort((a, b) => String(milestoneDue(a)).localeCompare(String(milestoneDue(b))))[0];
  const STATUS = ['Done', 'Overdue', 'Due soon', 'Planned'], COLORS = [COLOR.done, COLOR.critical, COLOR.wait, COLOR.plan];

  return {
    cards: [
      { label: 'Milestones', value: rows.length, foot: `Across ${subs.keys.length} subcontract areas`, icon: 'flag' },
      { label: 'Achieved', value: st('Done').length, foot: `${rows.length ? Math.round((st('Done').length / rows.length) * 100) : 0}% of all milestones`, icon: 'check', tone: 'green' },
      { label: 'Overdue', value: st('Overdue').length, foot: 'Forecast before the cut-off', icon: 'risk', tone: st('Overdue').length ? 'red' : undefined },
      { label: 'Due in 30 days', value: st('Due soon').length, foot: nextOne ? `Next: ${nextOne.description}` : 'Not yet achieved', icon: 'clock', tone: st('Due soon').length ? 'amber' : undefined },
      { label: 'Forecast to slip', value: slipping.length, foot: slips.length ? `${Math.round(slips.reduce((s, x) => s + x, 0) / slips.length)} days later than baseline on average` : 'None later than baseline', icon: 'calendar', tone: slipping.length ? 'amber' : undefined },
      { label: 'Still to achieve', value: open.length, foot: `${open.filter(r => !r.forecast).length} without a forecast`, icon: 'layers' },
    ],
    strip: {
      title: 'Milestone status', sub: 'Status is worked out against the cut-off. Select a status to filter the register.',
      boxes: STATUS.map((s, i) => ({ label: s, value: st(s).length, sub: s === 'Done' ? 'Actual date recorded' : s === 'Overdue' ? 'Past forecast' : s === 'Due soon' ? 'Next 30 days' : 'Later', tone: i === 1 && st(s).length ? 'red' : i === 0 ? 'green' : undefined, filter: { status: s } })),
    },
    lookAhead: {
      title: 'Milestone look-ahead', sub: 'Milestones not yet achieved, by forecast (or baseline) date, counted from the cut-off. Select a window to filter the register.',
      boxes: windows(open, milestoneDue, cutoff, rs => (rs.length ? 'Not yet achieved' : 'None'), 'None'),
    },
    charts: [
      {
        title: 'Milestones by month', sub: 'Achieved on the actual date, otherwise forecast, otherwise baseline.', layout: 'column', stacked: true, unit: 'milestones', categoryKind: 'month', categories: byMonth.keys,
        series: [{ name: 'Achieved', color: COLOR.done, data: byMonth.keys.map(k => byMonth.get(k).filter(r => r.status === 'Done').length) }, { name: 'Not yet achieved', color: COLOR.open, data: byMonth.keys.map(k => byMonth.get(k).filter(r => r.status !== 'Done').length) }],
      },
      {
        title: 'Status by facility', sub: 'Select a facility to filter.', layout: 'bar', stacked: true, unit: 'milestones', categories: facilities.keys, filterKey: 'facility',
        series: STATUS.map((s, i) => ({ name: s, color: COLORS[i], data: facilities.keys.map(k => facilities.get(k).filter(r => r.status === s).length) })),
      },
    ],
  };
}

/* ============================== issues ============================== */
export function issuesInsights(rows: AnyRow[], subtasks: AnyRow[], cutoff: string): Insights {
  const open = rows.filter(r => r.status !== 'Completed');
  const st = (s: string) => rows.filter(r => r.status === s);
  const hot = open.filter(r => r.priority === 'Critical' || r.priority === 'High');
  const overdue = open.filter(r => r.overdue);
  const due30 = open.filter(r => r.dueDate && String(r.dueDate) >= cutoff && String(r.dueDate) <= addDays(cutoff, 30));
  const unassigned = open.filter(r => !r.pics.length);
  const done = subtasks.filter(s => s.done === 'Yes').length;
  const PRI = ['Critical', 'High', 'Medium', 'Low'], PRI_COLOR = [COLOR.critical, COLOR.high, COLOR.medium, COLOR.low];
  const byPic = new Map<string, AnyRow[]>();
  for (const r of open) for (const e of r.pics as string[]) byPic.set(e, [...(byPic.get(e) ?? []), r]);
  const picKeys = [...byPic.keys()].sort((a, b) => byPic.get(b)!.length - byPic.get(a)!.length).slice(0, 10);
  const team = tally(open, r => String(r.discipline ?? 'Unassigned'));
  const teamKeys = [...team.keys].sort((a, b) => team.get(b).length - team.get(a).length).slice(0, 12);
  const series = (keys: string[], get: (k: string) => AnyRow[]) => PRI.map((p, i) => ({ name: p, color: PRI_COLOR[i], data: keys.map(k => get(k).filter(r => r.priority === p).length) }));
  const linked = (key: 'packageCode' | 'subcontract') => { const t = tally(open.filter(r => r[key]), r => String(r[key])); return { t, keys: [...t.keys].sort((a, b) => t.get(b).length - t.get(a).length).slice(0, 12) }; };
  const pkg = linked('packageCode'), sub = linked('subcontract');

  return {
    cards: [
      { label: 'Open issues', value: open.length, foot: `${rows.length} in the register · ${st('Completed').length} completed`, icon: 'risk' },
      { label: 'Critical or high', value: hot.length, foot: `${open.filter(r => r.priority === 'Critical').length} critical · ${open.filter(r => r.priority === 'High').length} high`, icon: 'flag', tone: hot.length ? 'red' : undefined },
      { label: 'Overdue', value: overdue.length, foot: 'Due date before the cut-off', icon: 'clock', tone: overdue.length ? 'red' : undefined },
      { label: 'Due in 30 days', value: due30.length, foot: 'Open, with a due date', icon: 'calendar', tone: due30.length ? 'amber' : undefined },
      { label: 'Nobody assigned', value: unassigned.length, foot: 'Open issues with no PIC', icon: 'link', tone: unassigned.length ? 'amber' : undefined },
      { label: 'Sub-tasks done', value: `${done}/${subtasks.length}`, foot: subtasks.length ? `${Math.round((done / subtasks.length) * 100)}% complete` : 'No sub-tasks yet', icon: 'check', tone: 'green' },
    ],
    strip: {
      title: 'Issue status', sub: 'All issues at the cut-off. Select a status to filter the register.',
      boxes: ['Not started', 'In progress', 'Pending', 'Completed'].map(s => ({ label: s, value: st(s).length, sub: s === 'Completed' ? 'Closed out' : `${st(s).filter(r => r.overdue).length} overdue`, tone: s === 'Completed' ? 'green' : undefined, filter: { status: s } })),
    },
    lookAhead: {
      title: 'Due-date look-ahead', sub: 'Open issues by due date, counted from the cut-off. Select a window to filter the register.',
      boxes: windows(open, r => (r.dueDate ? String(r.dueDate) : null), cutoff, rs => `${rs.filter(r => r.priority === 'Critical' || r.priority === 'High').length} critical or high`, 'None'),
    },
    charts: [
      { title: 'Open issues by person in charge', sub: 'The ten people with most open issues. An issue with several PICs counts for each. Select a person to filter.', layout: 'bar', stacked: true, unit: 'issues', categories: picKeys, filterKey: 'pic', series: series(picKeys, k => byPic.get(k)!) },
      { title: 'Open issues by team', sub: 'The responsible team named on the issue. Select a team to filter.', layout: 'bar', stacked: true, unit: 'issues', categories: teamKeys, filterKey: 'discipline', series: series(teamKeys, team.get) },
      ...(pkg.keys.length ? [{ title: 'Open issues by procurement package', sub: 'Issues linked to a procurement or expediting package. Select a package to filter.', layout: 'bar' as const, stacked: true, unit: 'issues', categories: pkg.keys, filterKey: 'packageCode', series: series(pkg.keys, pkg.t.get) }] : []),
      ...(sub.keys.length ? [{ title: 'Open issues by service subcontract', sub: 'Issues linked to a subcontractor or service package. Select one to filter.', layout: 'bar' as const, stacked: true, unit: 'issues', categories: sub.keys, filterKey: 'subcontract', series: series(sub.keys, sub.t.get) }] : []),
    ],
  };
}

/* ============================== risks ============================== */
/** Colours by level name, so a project matrix with three levels and the 5 x 5 matrix with four read the same way. */
export const LEVEL_COLOR: Record<string, string> = { Low: COLOR.low, Medium: COLOR.medium, High: COLOR.high, Extreme: COLOR.critical };
const levelColor = (l: string) => LEVEL_COLOR[l] ?? COLOR.neutral;
const RISK_STATUS_ORDER = ['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed'];

/** Risk register summary. `rows` are risk views (with currentLevel, responseOverdue, ...); `levels` runs from least to most severe. */
export function risksInsights(rows: AnyRow[], cutoff: string, levels: string[]): Insights {
  const active = rows.filter(r => r.status !== 'Closed');
  const top = levels[levels.length - 1];
  const hot = active.filter(r => r.currentLevel === top);
  const responseOverdue = active.filter(r => r.responseOverdue);
  const unrated = active.filter(r => !r.preLevel);
  const awaitingPost = active.filter(r => r.preLevel && !r.postLevel);
  const assessed = rows.filter(r => r.preScore && r.postScore);
  const pre = assessed.reduce((s, r) => s + r.preScore, 0), post = assessed.reduce((s, r) => s + r.postScore, 0);
  const reduction = pre ? Math.round(((pre - post) / pre) * 100) : null;
  const byLevel = (keys: string[], get: (k: string) => AnyRow[]) => [...levels].reverse().map(l => ({ name: l, color: levelColor(l), data: keys.map(k => get(k).filter(r => r.currentLevel === l).length) }));
  const disc = tally(active, r => String(r.discipline ?? r.rbs ?? 'Unclassified'));
  const discKeys = [...disc.keys].sort((a, b) => disc.get(b).length - disc.get(a).length).slice(0, 12);
  const owners = new Map<string, AnyRow[]>();
  for (const r of active) for (const o of (r.owners as string[]).length ? (r.owners as string[]) : ['No owner']) owners.set(o, [...(owners.get(o) ?? []), r]);
  const ownerKeys = [...owners.keys()].sort((a, b) => owners.get(b)!.length - owners.get(a)!.length).slice(0, 10);
  const months = tally(rows.filter(r => r.recordDate), r => String(r.recordDate).slice(0, 7));
  const monthKeys = [...months.keys].sort();

  return {
    cards: [
      { label: 'Active risks', value: active.length, foot: `${rows.length} in the register · ${rows.length - active.length} closed`, icon: 'risk' },
      { label: `${top} now`, value: hot.length, foot: `Active · ${active.filter(r => r.preLevel === top).length} before mitigation`, icon: 'flag', tone: hot.length ? 'red' : undefined },
      { label: 'Response overdue', value: responseOverdue.length, foot: 'Action date passed, not done', icon: 'clock', tone: responseOverdue.length ? 'red' : undefined },
      { label: 'Awaiting post-mitigation', value: awaitingPost.length, foot: 'Active, rated before but not after mitigation', icon: 'shield', tone: awaitingPost.length ? 'amber' : undefined },
      { label: 'Not rated', value: unrated.length, foot: 'Active risks without a pre-mitigation rating', icon: 'link', tone: unrated.length ? 'amber' : undefined },
      { label: 'Score reduced', value: reduction == null ? '—' : `${reduction}%`, foot: assessed.length ? `Pre to post score, ${plural(assessed.length, 'risk')} rated both` : 'No post-mitigation ratings yet', icon: 'check', tone: 'green' },
    ],
    strip: {
      title: 'Risk lifecycle', sub: 'Every risk at the cut-off. Select a status to filter the register.',
      boxes: RISK_STATUS_ORDER.map(s => {
        const rs = rows.filter(r => r.status === s);
        return { label: s, value: rs.length, sub: s === 'Closed' ? 'No longer tracked' : `${rs.filter(r => r.currentLevel === top).length} ${top.toLowerCase()}`, tone: s === 'Closed' ? 'green' : undefined, filter: { status: s } };
      }),
    },
    lookAhead: {
      title: 'Response plan look-ahead', sub: 'Active risks whose response is not done yet, by plan action date. Select a window to filter.',
      boxes: windows(active.filter(r => !r.actualDate), r => (r.planDate ? String(r.planDate) : null), cutoff, rs => `${rs.filter(r => r.currentLevel === top).length} ${top.toLowerCase()}`, 'None'),
    },
    charts: [
      { title: 'Active risks by discipline', sub: 'RBS discipline, coloured by current level. Select a discipline to filter.', layout: 'bar', stacked: true, unit: 'risks', categories: discKeys, filterKey: 'discipline', series: byLevel(discKeys, disc.get) },
      { title: 'Active risks by owner', sub: 'The ten owners with most active risks; a shared risk counts for each. Select an owner to filter.', layout: 'bar', stacked: true, unit: 'risks', categories: ownerKeys, filterKey: 'owner', filterValues: ownerKeys.map(k => (k === 'No owner' ? 'none' : k)), series: byLevel(ownerKeys, k => owners.get(k)!) },
      {
        title: 'Risks recorded per month', sub: 'By record date; the closed share shows how many of each month are already closed.', layout: 'column', stacked: true, unit: 'risks', categoryKind: 'month', categories: monthKeys,
        series: [
          { name: 'Active', color: COLOR.open, data: monthKeys.map(k => months.get(k).filter(r => r.status !== 'Closed').length) },
          { name: 'Closed', color: COLOR.done, data: monthKeys.map(k => months.get(k).filter(r => r.status === 'Closed').length) },
        ],
      },
      {
        title: 'Level before and after mitigation', sub: 'Active risks by pre-mitigation level and by current level (post where rated).', layout: 'column', unit: 'risks', categories: [...levels].reverse(), filterKey: 'level',
        series: [
          { name: 'Before mitigation', color: COLOR.plan, data: [...levels].reverse().map(l => active.filter(r => r.preLevel === l).length) },
          { name: 'Current', color: COLOR.actual, data: [...levels].reverse().map(l => active.filter(r => r.currentLevel === l).length) },
        ],
      },
    ],
  };
}

/* ============================== interface points ============================== */
const AGE_BUCKETS: [string, number, number][] = [['0-30 days', 0, 30], ['31-60 days', 31, 60], ['61-90 days', 61, 90], ['91-180 days', 91, 180], ['Over 180 days', 181, Infinity]];

/** Predicate for the `age` filter ("31-60", "181-"): days since the query date of an open point. */
export function agePredicate(r: AnyRow, value: string) {
  const [lo, hi] = value.split('-').map(v => (v === '' ? Infinity : Number(v)));
  return !r.settled && typeof r.ageDays === 'number' && r.ageDays >= lo && r.ageDays <= hi;
}

/** Interface point summary. `rows` are point views (with overdue, ageDays, settled). */
export function pointsInsights(rows: AnyRow[], cutoff: string): Insights {
  const open = rows.filter(r => !r.settled);
  const st = (s: string) => rows.filter(r => r.status === s);
  const overdue = open.filter(r => r.overdue);
  const noDate = open.filter(r => !r.targetDate);
  const ages = open.map(r => r.ageDays).filter((n): n is number => typeof n === 'number');
  const turnaround = rows.filter(r => r.settled && typeof r.ageDays === 'number').map(r => r.ageDays as number);
  const WAITING: [string, string, string][] = [['Open', 'Awaiting response', COLOR.wait], ['Responded', 'Awaiting acceptance', COLOR.open]];
  const byStatus = (keys: string[], get: (k: string) => AnyRow[]) => WAITING.map(([s, name, color]) => ({ name, color, data: keys.map(k => get(k).filter(r => r.status === s).length) }));
  const target = tally(open, r => String(r.target ?? 'No target'));
  const targetKeys = [...target.keys].sort((a, b) => target.get(b).length - target.get(a).length).slice(0, 10);
  const disc = tally(open, r => String(r.discipline ?? 'Unclassified'));
  const discKeys = [...disc.keys].sort((a, b) => disc.get(b).length - disc.get(a).length);
  const bucket = (k: string) => { const [, lo, hi] = AGE_BUCKETS.find(b => b[0] === k)!; return open.filter(r => typeof r.ageDays === 'number' && r.ageDays >= lo && r.ageDays <= hi); };
  const avgAge = mean(ages), avgTurn = mean(turnaround);

  return {
    cards: [
      { label: 'Open points', value: open.length, foot: `${rows.length} in the register · ${rows.length - open.length} resolved or closed`, icon: 'link' },
      { label: 'Overdue', value: overdue.length, foot: 'Target date before the cut-off', icon: 'clock', tone: overdue.length ? 'red' : undefined },
      { label: 'Awaiting response', value: st('Open').length, foot: 'Raised, no answer from the target party', icon: 'risk', tone: st('Open').length ? 'amber' : undefined },
      { label: 'Awaiting acceptance', value: st('Responded').length, foot: 'Answered, awaiting acceptance', icon: 'shield' },
      { label: 'No target date', value: noDate.length, foot: 'Open points nobody has dated', icon: 'calendar', tone: noDate.length ? 'amber' : undefined },
      { label: 'Average age', value: avgAge == null ? '—' : `${Math.round(avgAge)} d`, foot: avgTurn == null ? 'Open points, from the query date' : `Open points · settled ones took ${Math.round(avgTurn)} d`, icon: 'check' },
    ],
    strip: {
      title: 'Point status', sub: 'All points at the cut-off. Select a status to filter the register.',
      boxes: ['Open', 'Responded', 'Resolved', 'Closed'].map(s => ({ label: s, value: st(s).length, sub: s === 'Resolved' || s === 'Closed' ? 'Settled' : `${st(s).filter(r => r.overdue).length} overdue`, tone: s === 'Resolved' || s === 'Closed' ? 'green' : undefined, filter: { status: s } })),
    },
    lookAhead: {
      title: 'Target date look-ahead', sub: 'Open points by target date, counted from the cut-off. Select a window to filter.',
      boxes: windows(open, r => (r.targetDate ? String(r.targetDate) : null), cutoff, rs => `${rs.filter(r => r.status === 'Open').length} awaiting response`, 'None'),
    },
    charts: [
      { title: 'Open points by target party', sub: 'Who owes an answer or an acceptance. Select a party to filter.', layout: 'bar', stacked: true, unit: 'points', categories: targetKeys, filterKey: 'target', series: byStatus(targetKeys, target.get) },
      { title: 'Open points by discipline', sub: 'Select a discipline to filter.', layout: 'bar', stacked: true, unit: 'points', categories: discKeys, filterKey: 'discipline', series: byStatus(discKeys, disc.get) },
      {
        title: 'Age of open points', sub: 'Days since the query date; points without one are not counted. Select a bar to filter.', layout: 'column', stacked: true, unit: 'points',
        categories: AGE_BUCKETS.map(b => b[0]), filterKey: 'age', filterValues: AGE_BUCKETS.map(b => `${b[1]}-${b[2] === Infinity ? '' : b[2]}`),
        series: byStatus(AGE_BUCKETS.map(b => b[0]), bucket),
      },
    ],
  };
}
