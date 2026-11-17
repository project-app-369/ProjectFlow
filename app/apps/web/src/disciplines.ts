/** The discipline codes of the management registers: short, in capitals; the server maps and stores them (see sheets/src/disciplines.ts). */
export const DISCIPLINES: readonly (readonly [string, string])[] = [
  ['DE', 'Detail Engineering'], ['CE', 'Construction Engineering'], ['PRO', 'Procurement'], ['CON', 'Construction & Fabrication'],
  ['T&I', 'Transportation & Installation'], ['COM', 'Onshore Pre-Com & Commissioning'], ['HUC', 'Offshore Hook-up & Commissioning'],
  ['CTR', 'Contracting'], ['PLN', 'Planning & Schedule'], ['QC', 'Quality Control'], ['HSE', 'Health, Safety & Environment'], ['COOR', 'Coordination'],
];
export const DISCIPLINE_NAME: Record<string, string> = Object.fromEntries(DISCIPLINES);
export const disciplineList = (value: string | null | undefined) => (value ? value.split(/\s*,\s*/).filter(Boolean) : []);
export const disciplineTitle = (value: string | null | undefined) => disciplineList(value).map(c => `${c} · ${DISCIPLINE_NAME[c] ?? c}`).join('\n');
