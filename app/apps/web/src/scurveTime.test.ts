import { describe, expect, it } from 'vitest';
import { isWeekly, toMonthly } from './scurveTime';

const row = (date: string, plan: number | null, actual: number | null) => ({ date, plan, forecast: null as number | null, actual });

describe('monthly cut-offs of an S-curve', () => {
  it('takes the last figure of each month and keeps the previous month where a month has none', () => {
    const rows = [row('2026-08-07', 10, 8), row('2026-08-28', 12, 9), row('2026-10-09', 20, 15), row('2026-10-30', 24, 18), row('2026-11-13', 27, 20), row('2026-12-04', 30, null)];
    const m = toMonthly(rows, ['plan', 'forecast', 'actual'], '2026-11-13', ['actual']);
    expect(m.map(r => r.date)).toEqual(['2026-08-28', '2026-09-30', '2026-10-30', '2026-11-13', '2026-12-04']);
    expect(m[1]).toMatchObject({ plan: 12, actual: 9 }); // September has no cut-off: August's figures stay
    expect(m[2]).toMatchObject({ plan: 24, actual: 18 });
    expect(m[4]).toMatchObject({ plan: 30, actual: null }); // the actual is not carried past the reporting cut-off
    expect(m.every(r => r.forecast === null)).toBe(true);
  });

  it('tells weekly from monthly cut-offs', () => {
    expect(isWeekly([row('2026-10-02', 1, 1), row('2026-10-09', 2, 2), row('2026-10-16', 3, 3)])).toBe(true);
    expect(isWeekly([row('2026-08-28', 1, 1), row('2026-09-30', 2, 2), row('2026-10-30', 3, 3)])).toBe(false);
  });
});
