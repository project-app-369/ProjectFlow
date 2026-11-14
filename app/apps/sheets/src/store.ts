/** Storage abstraction. One implementation talks to a Google Spreadsheet, another keeps rows in memory for tests and local runs. */

export type ColumnType = 'text' | 'number' | 'date' | 'datetime';
export interface Column { key: string; type: ColumnType }
export type Row = Record<string, string | number | null>;

export interface SheetInfo { name: string; gid: number; url: string }

export interface Store {
  /** Creates the sheet with a header row when it does not exist yet; never alters existing data. */
  /** `tabColor` (CSS hex) is applied only when the sheet is created. */
  ensureSheet(name: string, columns: Column[], tabColor?: string): SheetInfo;
  /**
   * Schema upgrade: adds a header cell for every column the sheet does not have yet, after the existing ones. Existing
   * cells are never moved or changed, so this is safe on a sheet that people edit. Returns the keys that were added.
   */
  addMissingColumns(name: string, columns: Column[]): string[];
  sheetInfo(name: string): SheetInfo | null;
  readRows(name: string, columns: Column[]): Row[];
  appendRows(name: string, columns: Column[], rows: Row[]): void;
  /**
   * Merges the patch into the row whose id column matches (and, when given, whose `scope` columns match, e.g. the project);
   * false when no row matches.
   */
  updateRow(name: string, columns: Column[], idKey: string, id: string, patch: Row, scope?: Row): boolean;
  deleteRow(name: string, columns: Column[], idKey: string, id: string, scope?: Row): boolean;
  /** Deletes every row whose columns equal all the `match` values; returns how many were removed. */
  deleteRows(name: string, columns: Column[], match: Row): number;
  spreadsheetUrl(): string;
  withLock<T>(fn: () => T): T;
  newId(): string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateFormatter = (d: Date) => string;
const utcDate: DateFormatter = d => d.toISOString().slice(0, 10);

/**
 * Turns a raw cell into the column's type: blanks become null, numbers parse, Date objects become ISO strings.
 * Sheets hands back dates as midnight in the spreadsheet's time zone, so the caller supplies a formatter for that zone.
 */
export function coerceCell(value: unknown, type: ColumnType, dateFormat: DateFormatter = utcDate): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return type === 'datetime' ? value.toISOString() : dateFormat(value);
  }
  if (type === 'number') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const n = Number(String(value).replace(/,/g, '').replace(/%$/, ''));
    return String(value).trim() !== '' && Number.isFinite(n) ? n : null;
  }
  const s = String(value).trim();
  return s === '' ? null : s;
}

export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && ISO_DATE.test(v);

/** Converts a row to the cell array written to a sheet, in column order. */
export const rowToCells = (columns: Column[], row: Row): (string | number)[] =>
  columns.map(c => {
    const v = row[c.key];
    return v === null || v === undefined ? '' : v;
  });

/** Rows as typed objects, skipping rows whose cells are all blank. */
export function cellsToRows(columns: Column[], header: unknown[], data: unknown[][], dateFormat?: DateFormatter): Row[] {
  const index = new Map(header.map((h, i) => [String(h).trim(), i]));
  const rows: Row[] = [];
  for (const cells of data) {
    if (cells.every(c => c === '' || c === null || c === undefined)) continue;
    const row: Row = {};
    for (const col of columns) {
      const i = index.get(col.key);
      row[col.key] = i === undefined ? null : coerceCell(cells[i], col.type, dateFormat);
    }
    rows.push(row);
  }
  return rows;
}
