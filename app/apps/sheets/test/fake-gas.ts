/** Minimal in-memory fakes of the Apps Script services the sheets backend uses. */

export class FakeRange {
  constructor(private sheet: FakeSheet, private r: number, private c: number, private nr: number, private nc: number) {}
  setValues(values: unknown[][]) {
    values.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v)));
    return this;
  }
  setValue(v: unknown) { this.sheet.set(this.r, this.c, v); return this; }
  getValues() {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sheet.get(this.r + i, this.c + j)));
  }
  setNumberFormat(format: string) {
    for (let j = 0; j < this.nc; j++) this.sheet.formats.set(this.c + j, format);
    return this;
  }
  setFontWeight(w: string) { this.sheet.headerWeight = w; return this; }
  setBackground(bg: string) { this.sheet.headerBackground = bg; return this; }
}

export class FakeSheet {
  grid: unknown[][] = [];
  formats = new Map<number, string>();
  frozenRows = 0;
  headerWeight = '';
  headerBackground = '';
  constructor(private name: string, private id: number) {}
  getName() { return this.name; }
  getSheetId() { return this.id; }
  maxRows = 1000;
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(_after: number, howMany: number) { this.maxRows += howMany; }
  getLastRow() { for (let i = this.grid.length; i > 0; i--) if (this.grid[i - 1]?.some(v => v !== '' && v !== undefined)) return i; return 0; }
  getLastColumn() { return this.grid.reduce((m, row) => Math.max(m, row?.reduce((n: number, v, j) => (v !== '' && v !== undefined ? j + 1 : n), 0) ?? 0), 0); }
  get(r: number, c: number) { return this.grid[r - 1]?.[c - 1] ?? ''; }
  set(r: number, c: number, v: unknown) {
    if (r > this.maxRows) throw new Error(`Range out of bounds: row ${r} > ${this.maxRows}`);
    (this.grid[r - 1] ??= [])[c - 1] = v;
  }
  getRange(r: number, c: number, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  /** The used area, as one call (the real service answers this faster than getLastRow + getLastColumn + getRange). */
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows(n: number) { this.frozenRows = n; }
  tabColor = '';
  setTabColor(c: string) { this.tabColor = c; }
  deleteRow(r: number) { this.grid.splice(r - 1, 1); }
}

export class FakeSpreadsheet {
  sheets: FakeSheet[] = [];
  private nextId = 7;
  constructor(sheet1 = true) { if (sheet1) this.insertSheet('Sheet1'); }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/FAKE/edit'; }
  getSheetByName(name: string) { return this.sheets.find(s => s.getName() === name) ?? null; }
  insertSheet(name: string) { const s = new FakeSheet(name, this.nextId++); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s: FakeSheet) { this.sheets = this.sheets.filter(x => x !== s); }
}

export const asSpreadsheet = (s: FakeSpreadsheet) => s as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet;
export const fakeLock = () => { const log: string[] = []; return { log, waitLock: () => log.push('lock'), releaseLock: () => log.push('unlock') }; };
