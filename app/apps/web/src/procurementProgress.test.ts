import { describe, expect, it } from 'vitest';
import { progressTableValues } from './procurementProgress';

describe('Procurement Progress Table (W) API values', () => {
  it('reads cumulative this-week values from a running older Sheets simulator', () => {
    expect(progressTableValues({ thisWeekPlan: 50, thisWeekActual: 47.6 })).toEqual({ plan: 50, actual: 47.6 });
  });
  it('prefers the current API and preserves missing values', () => {
    expect(progressTableValues({ plan: null, actual: null, thisWeekPlan: 50, thisWeekActual: 47.6 })).toEqual({ plan: null, actual: null });
  });
});
