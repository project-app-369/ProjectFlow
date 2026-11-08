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
    const s = this.sheet(name);
    if (!s || s.getLastRow() < 2) return [];
    const width = Math.max(s.getLastColumn(), 1);
    const values = s.getRange(1, 1, s.getLastRow(), width).getValues();
    return cellsToRows(columns, values[0], values.slice(1), this.env.formatDate);
  }

  appendRows(name: string, columns: Column[], rows: Row[]) {
    if (!rows.length) return;
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
    const [rowNo] = this.findRows(s, idKey, id, scope, true);
    if (!rowNo) return false;
    s.deleteRow(rowNo);
    return true;
  }

  deleteRows(name: string, _columns: Column[], match: Row) {
    const s = this.sheet(name);
    if (!s) return 0;
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
