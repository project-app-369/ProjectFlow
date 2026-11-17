import type { ProcurementCurve } from './api';

export type Cutoffs = 'weekly' | 'monthly';

interface Dated { date: string }
const monthOf = (d: string) => d.slice(0, 7);
const lastDayOf = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12)).toISOString().slice(0, 10);
const nextMonth = (month: string) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 12)); return d.toISOString().slice(0, 7); };

/** True when the points are cut-offs a week apart (the median gap is under 20 days). */
export function isWeekly(points: Dated[]): boolean {
  if (points.length < 3) return false;
  const gaps = points.slice(1).map((p, i) => Date.parse(p.date) - Date.parse(points[i].date)).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] / 86_400_000 < 20;
}

/**
 * The month-end cut-offs of a curve: for each month, the last value the month has. A month with no value (no cut-off in it, or none
 * for that series) keeps the previous month's figure, as the project reports it. Only inside a series' own span: the actual stops at
 * the reporting cut-off and a forecast stops where it ends, so neither is drawn beyond.
 */
export function toMonthly<K extends string, T extends Dated & Record<K, number | null>>(rows: T[], keys: K[], cutoff?: string | null, stopAtCutoff: K[] = []): (Dated & Record<K, number | null>)[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const lastWith = Object.fromEntries(keys.map(k => [k, [...sorted].reverse().find(r => r[k] != null)?.date ?? ''])) as Record<K, string>;
  const out: (Dated & Record<K, number | null>)[] = [];
  const carry = {} as Record<K, number | null>;
  keys.forEach(k => { carry[k] = null; });
  const first = monthOf(sorted[0].date), last = monthOf(sorted[sorted.length - 1].date);
  for (let m = first; m <= last; m = nextMonth(m)) {
    const inMonth = sorted.filter(r => monthOf(r.date) === m);
    const date = inMonth.length ? inMonth[inMonth.length - 1].date : lastDayOf(m);
    const row = { date } as Dated & Record<K, number | null>;
    for (const k of keys) {
      const have = [...inMonth].reverse().find(r => r[k] != null);
      if (have) carry[k] = have[k];
      const beyond = date > lastWith[k] || (stopAtCutoff.includes(k) && !!cutoff && date > cutoff && !have);
      (row as Record<K, number | null>)[k] = have ? (have[k] as number | null) : beyond ? null : carry[k];
    }
    out.push(row);
  }
  return out;
}

/** A procurement curve (parallel arrays) as month-end cut-offs, with the same carry-forward rule. */
export function monthlyCurve(curve: ProcurementCurve): ProcurementCurve {
  const rows = curve.dates.map((date, i) => ({ date, plan: curve.plan[i] ?? null, forecast: curve.forecast[i] ?? null, actual: curve.actual[i] ?? null }));
  const m = toMonthly(rows, ['plan', 'forecast', 'actual'], curve.cutoff, ['actual']);
  return { ...curve, dates: m.map(r => r.date), plan: m.map(r => r.plan), forecast: m.map(r => r.forecast), actual: m.map(r => r.actual) };
}
