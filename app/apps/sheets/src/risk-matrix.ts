/** Risk scoring matrix v1 (spec MGT-01): 5 x 5, score = likelihood x impact. Versioned so a later matrix can replace it without rewriting history. */
export const RISK_MATRIX_VERSION = 'v1';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Extreme';

export const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'] as const;
export const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'] as const;

export const riskScore = (likelihood: number | null, impact: number | null): number | null =>
  likelihood && impact ? likelihood * impact : null;

export const riskLevel = (score: number | null): RiskLevel | null =>
  score === null ? null : score >= 17 ? 'Extreme' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low';

export const RISK_STATUSES = ['Open', 'Mitigating', 'Accepted', 'Closed', 'Realized'] as const;
export const RISK_CATEGORIES = ['Technical', 'Schedule', 'Cost', 'HSE', 'Commercial', 'Interface', 'Supply chain', 'Regulatory', 'Other'] as const;
/** A risk still needs attention while it is in one of these states. */
export const ACTIVE_RISK = new Set<string>(['Open', 'Mitigating']);
