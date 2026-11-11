import { cellsToRows, rowToCells, type Column, type DateFormatter, type Row, type SheetInfo, type Store } from './store';

/** The slice of the Apps Script spreadsheet/lock/utility services this store uses; tests pass fakes. */
export interface GasEnv {
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
  lock: { waitLock(ms: number): void; releaseLock(): void };
  uuid(): string;
  /** yyyy-MM-dd in the spreadsheet's time zone; defaults to UTC. */
  formatDate?: DateFormatter;
}

const HEADER_BG = '#eef0fb';
const LOCK_WAIT_MS = 20_000;

export class SheetsStore implements Store {
  constructor(private readonly env: GasEnv) {}

  /**
   * Rows already read from a sheet during this request. Each Apps Script request builds its own store, so nothing
   * outlives a request; within one, the same sheets are asked for many times (projects, module states, curves).
   * A write to a sheet drops its entry. Callers get copies, so changing a returned row never changes the cache.
   */
  private readonly read = new Map<string, Row[]>();
  private forget(name: string) { this.read.delete(name); }

  private sheet(name: string) {
    return this.env.spreadsheet.getSheetByName(name);
  }

  private info(s: GoogleAppsScript.Spreadsheet.Sheet): SheetInfo {
    const gid = s.getSheetId();
    return { name: s.getName(), gid, url: `${this.env.spreadsheet.getUrl()}#gid=${gid}` };
  }

  /**
   * Text and date columns are formatted as plain text so Sheets never reinterprets a value
   * (ISO dates stay strings, and a leading "=" is not evaluated as a formula).
   */
  private applyFormats(s: GoogleAppsScript.Spreadsheet.Sheet, columns: Column[]) {
    columns.forEach((c, i) => {
      if (c.type !== 'number') s.getRange(1, i + 1, s.getMaxRows(), 1).setNumberFormat('@');
    });
  }

  ensureSheet(name: string, columns: Column[], tabColor?: string): SheetInfo {
    const existing = this.sheet(name);
    if (existing) return this.info(existing);
    const s = this.env.spreadsheet.insertSheet(name);
    this.applyFormats(s, columns);
    const header = s.getRange(1, 1, 1, columns.length);
    header.setValues([columns.map(c => c.key)]);
    header.setFontWeight('bold').setBackground(HEADER_BG);
    s.setFrozenRows(1);
    if (tabColor) s.setTabColor(tabColor);
    return this.info(s);
  }

  sheetInfo(name: string) {
    const s = this.sheet(name);
    return s ? this.info(s) : null;
  }

  /** Header cells as written in the sheet; columns are matched by name so users may reorder or add columns. */
  private header(s: GoogleAppsScript.Spreadsheet.Sheet): string[] {
    const cols = s.getLastColumn();
    return cols < 1 ? [] : s.getRange(1, 1, 1, cols).getValues()[0].map(h => String(h).trim());
  }

  readRows(name: string, columns: Column[]): Row[] {
    let rows = this.read.get(name);
    if (!rows) {
      const s = this.sheet(name);
      // One call for the used area; asking for the last row, the last column and the values separately is three round trips.
      const values = s ? s.getDataRange().getValues() : [];
      rows = values.length < 2 ? [] : cellsToRows(columns, values[0], values.slice(1), this.env.formatDate);
      this.read.set(name, rows);
    }
    return rows.map(r => ({ ...r }));
  }

  appendRows(name: string, columns: Column[], rows: Row[]) {
    if (!rows.length) return;
    this.forget(name);
    const s = this.sheet(name) ?? this.env.spreadsheet.getSheetByName(this.ensureSheet(name, columns).name)!;
    const header = this.header(s);
    const byKey = new Map(columns.map(c => [c.key, c]));
    const matrix = rows.map(r => header.map(h => (byKey.has(h) ? rowToCells([byKey.get(h)!], r)[0] : '')));
    const start = Math.max(s.getLastRow(), 1) + 1;
    const missing = start + rows.length - 1 - s.getMaxRows();
    if (missing > 0) s.insertRowsAfter(s.getMaxRows(), missing); // a sheet only has 1000 rows until it is extended
    s.getRange(start, 1, rows.length, header.length).setValues(matrix);
  }

  /** 1-based row numbers whose id column and `scope` columns all match (the header row is never returned). */
  private findRows(s: GoogleAppsScript.Spreadsheet.Sheet, idKey: string | null, id: string | null, scope: Row | undefined, firstOnly: boolean): number[] {
    const lastRow = s.getLastRow();
    if (lastRow < 2) return [];
    const header = this.header(s);
    const tests: [number, string][] = [];
    if (idKey !== null) tests.push([header.indexOf(idKey), String(id)]);
    for (const [k, v] of Object.entries(scope ?? {})) tests.push([header.indexOf(k), String(v)]);
    if (!tests.length || tests.some(([c]) => c < 0)) return [];
    const values = s.getRange(2, 1, lastRow - 1, Math.max(header.length, 1)).getValues();
    const found: number[] = [];
    values.forEach((cells, i) => {
      if (!(firstOnly && found.length) && tests.every(([c, want]) => String(cells[c]) === want)) found.push(i + 2);
    });
    return found;
  }

  updateRow(name: string, columns: Column[], idKey: string, id: string, patch: Row, scope?: Row) {
    const s = this.sheet(name);
    if (!s) return false;
    this.forget(name);
    const [rowNo] = this.findRows(s, idKey, id, scope, true);
    if (!rowNo) return false;
    const header = this.header(s);
    for (const c of columns) {
      const col = header.indexOf(c.key);
      if (c.key in patch && col >= 0) s.getRange(rowNo, col + 1).setValue(rowToCells([c], patch)[0]);
    }
    return true;
  }

  deleteRow(name: string, _columns: Column[], idKey: string, id: string, scope?: Row) {
    const s = this.sheet(name);
    if (!s) return false;
    this.forget(name);
    const [rowNo] = this.findRows(s, idKey, id, scope, true);
    if (!rowNo) return false;
    s.deleteRow(rowNo);
    return true;
  }

  deleteRows(name: string, _columns: Column[], match: Row) {
    const s = this.sheet(name);
    if (!s) return 0;
    this.forget(name);
    const rows = this.findRows(s, null, null, match, false);
    for (let i = rows.length - 1; i >= 0; i--) s.deleteRow(rows[i]); // bottom-up keeps the remaining row numbers valid
    return rows.length;
  }

  spreadsheetUrl() {
    return this.env.spreadsheet.getUrl();
  }

  withLock<T>(fn: () => T): T {
    this.env.lock.waitLock(LOCK_WAIT_MS);
    try {
      return fn();
    } finally {
      this.env.lock.releaseLock();
    }
  }

  newId() {
    return this.env.uuid();
  }
}
