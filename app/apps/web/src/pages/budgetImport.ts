import type { BudgetInput } from '../api';

/** Splits pasted spreadsheet text (tab separated) or CSV into rows of cells. Quoted cells may hold commas, tabs and line breaks. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const ALIASES: Record<keyof Required<Pick<BudgetInput, 'wbs' | 'name' | 'parentWbs' | 'discipline' | 'manhours' | 'planStart' | 'planFinish' | 'notes'>>, string[]> = {
  wbs: ['wbs', 'wbs code', 'code'],
  name: ['name', 'activity', 'activity name', 'description'],
  parentWbs: ['parent', 'parent wbs', 'parentwbs', 'parent code'],
  discipline: ['discipline', 'trade'],
  manhours: ['manhours', 'man-hours', 'man hours', 'budget manhours', 'budget', 'hours', 'mh'],
  planStart: ['start', 'plan start', 'planstart', 'start date'],
  planFinish: ['finish', 'plan finish', 'planfinish', 'end', 'end date', 'finish date'],
  notes: ['notes', 'note', 'remarks'],
};

/** Accepts yyyy-mm-dd and day-first dd/mm/yyyy or dd-mm-yyyy (two-digit years mean 20yy). */
export function toIsoDate(raw: string): string | null {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return validDate(v) ? v : null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return validDate(iso) ? iso : null;
}
const validDate = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; };

export interface ImportParse { rows: BudgetInput[]; errors: string[] }

/** Reads a pasted WBS: a header row (WBS and Name at least), then one activity per row. Nothing is sent until every row is clean. */
export function parseBudgetImport(text: string): ImportParse {
  const cells = parseDelimited(text).filter(r => r.some(c => c.trim() !== ''));
  if (!cells.length) return { rows: [], errors: [] };
  const header = cells[0].map(h => h.trim().toLowerCase());
  const col = Object.fromEntries((Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map(k => [k, header.findIndex(h => ALIASES[k].includes(h))])) as Record<keyof typeof ALIASES, number>;
  if (col.wbs < 0 || col.name < 0) return { rows: [], errors: ['The first row must be a header with at least the columns WBS and Name.'] };

  const rows: BudgetInput[] = [];
  const errors: string[] = [];
  cells.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: keyof typeof ALIASES) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
    const problems: string[] = [];
    const wbs = get('wbs');
    if (!wbs) problems.push('WBS is empty');
    if (!get('name')) problems.push('Name is empty');
    let manhours: number | null = null;
    if (get('manhours') !== '') {
      const n = Number(get('manhours').replace(/[\s,]/g, ''));
      if (Number.isFinite(n) && n >= 0) manhours = n; else problems.push(`"${get('manhours')}" is not a number of hours`);
    }
    const date = (k: 'planStart' | 'planFinish', label: string) => {
      if (get(k) === '') return null;
      const iso = toIsoDate(get(k));
      if (!iso) problems.push(`${label} "${get(k)}" is not a date (use yyyy-mm-dd or dd/mm/yyyy)`);
      return iso;
    };
    const planStart = date('planStart', 'Start');
    const planFinish = date('planFinish', 'Finish');
    if (problems.length) { errors.push(`Row ${line}: ${problems.join('; ')}.`); return; }
    rows.push({ wbs, name: get('name'), parentWbs: get('parentWbs') || null, discipline: get('discipline') || null, manhours, planStart, planFinish, notes: get('notes') || null });
  });
  return { rows, errors };
}
