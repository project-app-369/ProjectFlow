/** Storage abstraction over named datasets. The deployed backend loads a snapshot of them from Supabase into memory for each request; tests and the local simulator keep rows in memory. */

export type ColumnType = 'text' | 'number' | 'date' | 'datetime';
export interface Column { key: string; type: ColumnType }
export type Row = Record<string, string | number | null>;

/** A dataset (a worksheet in the old pre-build): its name and numeric id. */
export interface SheetInfo { name: string; gid: number }

export interface Store {
  /** Creates the sheet with a header row when it does not exist yet; never alters existing data. */
  ensureSheet(name: string, columns: Column[]): SheetInfo;
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
  withLock<T>(fn: () => T): T;
  newId(): string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Turns a raw value into the column's type: blanks become null, numbers parse, Date objects become ISO strings. */
export function coerceCell(value: unknown, type: ColumnType): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return type === 'datetime' ? value.toISOString() : value.toISOString().slice(0, 10);
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
