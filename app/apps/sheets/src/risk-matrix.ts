/**
 * Risk scoring (spec MGT-01, MGT-06). The matrix is project data, read from the "Governance - Risk matrix" sheet: one row per
 * probability x severity cell with the level that cell means, so a project's own matrix (STTP2B uses 4 x 4 with three levels,
 * coloured cell by cell) needs no code change. A project without matrix rows falls back to the 5 x 5 matrix v1.
 *
 * Severity is rated per impact dimension (schedule, cost, scope, quality); the risk's severity is the worst of them, and its
 * score is probability x severity. Ratings are recorded before mitigation (pre) and after it (post); the post rating, once
 * recorded, is the current one.
 */
import type { Row } from './store';

export const RISK_STATUSES = ['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
/** Every state but Closed needs attention: it is counted on the heatmap and its dates are chased. */
export const isActiveRisk = (status: unknown) => normRiskStatus(status) !== 'Closed';
export const RISK_STRATEGIES = ['Avoid', 'Mitigate', 'Transfer', 'Accept', 'Escalate'] as const;
export const IMPACT_DIMENSIONS = [['Schedule', 'Schedule'], ['Cost', 'Cost'], ['Scope', 'Scope'], ['Quality', 'Quality']] as const;
export type Phase = 'pre' | 'post';

export interface RiskMatrix {
  version: string;
  /** Index 0 is score 1. */
  probabilityLabels: string[];
  severityLabels: string[];
  /** Levels from least to most severe. */
  levels: string[];
  /** cells[probability - 1][severity - 1] is the level of that cell. */
  cells: string[][];
}

const V1_LEVEL = (score: number) => (score >= 17 ? 'Extreme' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low');
/** The matrix of spec MGT-06 (v1): 5 x 5, Low below 5, Medium 5-9, High 10-16, Extreme 17 and above. */
export const MATRIX_V1: RiskMatrix = {
  version: 'v1 (5 x 5)',
  probabilityLabels: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'],
  severityLabels: ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'],
  levels: ['Low', 'Medium', 'High', 'Extreme'],
  cells: [1, 2, 3, 4, 5].map(p => [1, 2, 3, 4, 5].map(s => V1_LEVEL(p * s))),
};

const LEVEL_ORDER = ['Low', 'Medium', 'High', 'Extreme'];

/** Builds the matrix from its sheet rows; null when the rows do not make a complete square. */
export function matrixFromRows(rows: Row[]): RiskMatrix | null {
  const cells = rows.filter(r => Number(r.probability) > 0 && Number(r.severity) > 0 && r.level);
  if (!cells.length) return null;
  const np = Math.max(...cells.map(r => Number(r.probability)));
  const ns = Math.max(...cells.map(r => Number(r.severity)));
  if (cells.length !== np * ns) return null;
  const at = (p: number, s: number) => cells.find(r => Number(r.probability) === p && Number(r.severity) === s);
  const grid = Array.from({ length: np }, (_, p) => Array.from({ length: ns }, (_, s) => String(at(p + 1, s + 1)?.level ?? '').trim()));
  if (grid.some(row => row.some(l => !l))) return null;
  const used = [...new Set(grid.flat())];
  const levels = [...LEVEL_ORDER.filter(l => used.includes(l)), ...used.filter(l => !LEVEL_ORDER.includes(l))];
  return {
    version: `Project matrix (${np} x ${ns})`,
    probabilityLabels: Array.from({ length: np }, (_, p) => String(at(p + 1, 1)?.probabilityLabel ?? p + 1).trim()),
    severityLabels: Array.from({ length: ns }, (_, s) => String(at(1, s + 1)?.severityLabel ?? s + 1).trim()),
    levels,
    cells: grid,
  };
}

/**
 * A rating as typed in the sheet: a score ("3"), or a label of the matrix ("Possible", "moderate"). Out of range or unknown
 * values read as not rated, so a typo never invents a rating.
 */
export function normRating(v: unknown, labels: string[]): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isInteger(n)) return n >= 1 && n <= labels.length ? n : null;
  const i = labels.findIndex(l => l.toLowerCase() === String(v).trim().toLowerCase());
  return i >= 0 ? i + 1 : null;
}

const STATUS_WORDS: Record<string, RiskStatus> = {
  new: 'New', open: 'New', identified: 'New', firmed: 'Firmed', confirmed: 'Firmed',
  'under assessment': 'Under assessment', 'under evaluation': 'Under assessment', assessing: 'Under assessment',
  'under resolving': 'Under resolving', resolving: 'Under resolving', mitigating: 'Under resolving',
  monitor: 'Monitor', monitoring: 'Monitor', accepted: 'Monitor', closed: 'Closed', close: 'Closed', realized: 'Closed', resolved: 'Closed',
};
/** Status as typed in the sheet, with or without the workbook's number prefix ("5-Monitor"). */
export const normRiskStatus = (v: unknown): RiskStatus => STATUS_WORDS[String(v ?? '').replace(/^\s*\d+\s*-\s*/, '').trim().toLowerCase()] ?? 'New';
export const normStrategy = (v: unknown) => RISK_STRATEGIES.find(s => s.toLowerCase() === String(v ?? '').trim().toLowerCase()) ?? null;

export interface Rating { probability: number | null; severity: number | null; dimensions: Record<string, number | null>; score: number | null; level: string | null; worst: string[] }

/** The pre- or post-mitigation rating of a risk row on the given matrix. */
export function rate(r: Row, phase: Phase, m: RiskMatrix): Rating {
  const probability = normRating(r[`${phase}Probability`], m.probabilityLabels);
  const dimensions = Object.fromEntries(IMPACT_DIMENSIONS.map(([k]) => [k.toLowerCase(), normRating(r[`${phase}${k}`], m.severityLabels)]));
  const given = Object.values(dimensions).filter((v): v is number => v != null);
  const severity = given.length ? Math.max(...given) : null;
  const score = probability && severity ? probability * severity : null;
  const level = probability && severity ? m.cells[probability - 1][severity - 1] : null;
  const worst = severity ? IMPACT_DIMENSIONS.filter(([k]) => dimensions[k.toLowerCase()] === severity).map(([, label]) => label) : [];
  return { probability, severity, dimensions, score, level, worst };
}

export const levelRank = (m: RiskMatrix, level: string | null) => (level ? m.levels.indexOf(level) + 1 : 0);
