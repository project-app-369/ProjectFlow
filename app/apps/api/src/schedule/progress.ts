export interface WorkPackageProgress {
  weight: number | null;
  lastWeekPlan: number | null;
  lastWeekActual: number | null;
  thisWeekPlan: number | null;
  thisWeekActual: number | null;
}

const weighted = (rows: WorkPackageProgress[], pick: (r: WorkPackageProgress) => number | null) => {
  const total = rows.reduce((a, r) => a + (r.weight ?? 0), 0);
  if (!total) return 0;
  return rows.reduce((a, r) => a + (r.weight ?? 0) * (pick(r) ?? 0), 0) / total;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Overall progress is reproduced from stored work-package inputs by weight (spec §5 "Approved progress reproduces from stored inputs"). */
export function overallProgress(rows: WorkPackageProgress[]) {
  return {
    lastWeekPlan: round1(weighted(rows, r => r.lastWeekPlan)),
    lastWeekActual: round1(weighted(rows, r => r.lastWeekActual)),
    thisWeekPlan: round1(weighted(rows, r => r.thisWeekPlan)),
    thisWeekActual: round1(weighted(rows, r => r.thisWeekActual)),
  };
}
