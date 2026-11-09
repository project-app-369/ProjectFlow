/** Supports both the current API and a local Sheets simulator started before the API update. */
export function progressTableValues(row: {
  plan?: number | null; actual?: number | null;
  thisWeekPlan?: number | null; thisWeekActual?: number | null;
}) {
  return {
    plan: row.plan !== undefined ? row.plan : row.thisWeekPlan ?? null,
    actual: row.actual !== undefined ? row.actual : row.thisWeekActual ?? null,
  };
}
