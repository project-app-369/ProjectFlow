/**
 * The discipline codes of the management registers (risks, issues, interface points): short, in capitals, and an item may carry
 * several. The sheets hold free text ("Cons, Comm", "Transportation & Installation", an RBS code such as PEP-T&I), so what is
 * read is mapped to these codes, and what is saved is written back as them.
 */
export const DISCIPLINES: readonly (readonly [string, string])[] = [
  ['DE', 'Detail Engineering'], ['CE', 'Construction Engineering'], ['PRO', 'Procurement'], ['CON', 'Construction & Fabrication'],
  ['T&I', 'Transportation & Installation'], ['COM', 'Onshore Pre-Com & Commissioning'], ['HUC', 'Offshore Hook-up & Commissioning'],
  ['CTR', 'Contracting'], ['PLN', 'Planning & Schedule'], ['QC', 'Quality Control'], ['HSE', 'Health, Safety & Environment'], ['COOR', 'Coordination'],
];
const ORDER = new Map(DISCIPLINES.map(([c], i) => [c, i]));

/** The last part of an RBS code (PEP-T&I, CTR-CTR…) is the discipline of a risk. */
const RBS: Record<string, string> = { DEN: 'DE', CEN: 'CE', PRO: 'PRO', CON: 'CON', 'T&I': 'T&I', COM: 'COM', HUC: 'HUC', CTR: 'CTR', SCH: 'PLN', QAC: 'QC', HSE: 'HSE', COR: 'COOR', MAR: 'PRO', PRF: 'PRO', LOG: 'PRO' };

const RULES: [RegExp, string][] = [
  [/hook-?up|\bHUC\b|offshore/i, 'HUC'], [/\bDE\b|detail/i, 'DE'], [/\bCE\b|construction eng/i, 'CE'],
  [/procure|supply|vendor|supplier|commercial|\bPRO\b/i, 'PRO'], [/\bcons?\b|construction(?! eng)|fabricat|\bfab\b|\bCON\b/i, 'CON'],
  [/T\s*[/&]\s*I\b|transport|install/i, 'T&I'], [/\bcomm?\b|commission|pre-?com/i, 'COM'], [/contract/i, 'CTR'],
  [/plan|schedul|progress|\bPLN\b/i, 'PLN'], [/\bQA|\bQC\b|quality/i, 'QC'], [/\bHSE\b|safety/i, 'HSE'], [/coor/i, 'COOR'],
];

const sortCodes = (codes: Iterable<string>) => [...new Set(codes)].sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99) || a.localeCompare(b));

export function disciplineCodes(text: string | null | undefined, rbs?: string | null): string[] {
  const fromRbs = rbs ? RBS[String(rbs).split('-').pop()!.toUpperCase()] : undefined;
  if (fromRbs) return [fromRbs];
  const t = String(text ?? '').trim();
  if (!t) return [];
  const found = new Set(RULES.filter(([re]) => re.test(t)).map(([, c]) => c));
  if (found.has('HUC')) found.delete('COM');
  if (found.size) return sortCodes(found);
  return [t.length <= 5 ? t.toUpperCase() : t.split(/[\s/,&-]+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 5)];
}

export const disciplineText = (text: string | null | undefined, rbs?: string | null) => disciplineCodes(text, rbs).join(', ');
export const normaliseDiscipline = (text: string | null | undefined) => disciplineText(text) || null;

/** The codes to offer in a filter: those in use, in the standard order. */
export const disciplineFacets = (rows: { disciplines?: string[] }[]) => sortCodes(rows.flatMap(r => r.disciplines ?? []));

/** `discipline` as the codes joined for display and sorting, and `disciplines` as the list to filter on. */
export const withDisciplines = <T extends { discipline?: unknown; rbs?: unknown }>(r: T): T & { discipline: string | null; disciplines: string[] } => {
  const disciplines = disciplineCodes(r.discipline as string | null, r.rbs as string | null);
  return { ...r, discipline: disciplines.join(', ') || null, disciplines };
};
