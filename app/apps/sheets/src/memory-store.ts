import { randomUUID } from 'node:crypto';
import { coerceCell, type Column, type Row, type SheetInfo, type Store } from './store';

interface MemSheet { gid: number; header: string[]; rows: Row[] }
export interface StoreSnapshot { sheets: { name: string; gid: number; header: string[]; rows: Row[] }[] }

/** In-memory store: the working copy of one request on the deployed backend, and the store for tests and the local simulator. */
export class MemoryStore implements Store {
  private sheets = new Map<string, MemSheet>();
  private nextGid = 1000;

  /** Keep every worksheet, including dynamically created module sheets, in a portable archive. */
  snapshot(): StoreSnapshot {
    return { sheets: [...this.sheets].map(([name, sheet]) => ({
      name, gid: sheet.gid, header: [...sheet.header], rows: sheet.rows.map(row => ({ ...row })),
    })) };
  }

  loadSnapshot(snapshot: StoreSnapshot) {
    this.sheets.clear();
    for (const sheet of snapshot.sheets) {
      this.sheets.set(sheet.name, { gid: sheet.gid, header: [...sheet.header], rows: sheet.rows.map(row => ({ ...row })) });
      this.nextGid = Math.max(this.nextGid, sheet.gid + 1);
    }
  }

  private info(name: string, s: MemSheet): SheetInfo {
    return { name, gid: s.gid };
  }

  ensureSheet(name: string, columns: Column[]): SheetInfo {
    let s = this.sheets.get(name);
    if (!s) {
      s = { gid: this.nextGid++, header: columns.map(c => c.key), rows: [] };
      this.sheets.set(name, s);
    }
    return this.info(name, s);
  }

  addMissingColumns(name: string, columns: Column[]): string[] {
    const s = this.sheets.get(name);
    if (!s) return [];
    const missing = columns.map(c => c.key).filter(k => !s.header.includes(k));
    s.header.push(...missing);
    return missing;
  }

  sheetInfo(name: string) {
    const s = this.sheets.get(name);
    return s ? this.info(name, s) : null;
  }

  sheetNames() {
    return [...this.sheets.keys()];
  }

  readRows(name: string, columns: Column[]): Row[] {
    const s = this.sheets.get(name);
    if (!s) return [];
    return s.rows.map(r => Object.fromEntries(columns.map(c => [c.key, coerceCell(r[c.key], c.type)])) as Row);
  }

  appendRows(name: string, columns: Column[], rows: Row[]) {
    const s = this.sheets.get(name) ?? (this.ensureSheet(name, columns), this.sheets.get(name)!);
    for (const r of rows) s.rows.push(Object.fromEntries(columns.map(c => [c.key, coerceCell(r[c.key], c.type)])) as Row);
  }

  private matches(r: Row, scope?: Row) {
    return !scope || Object.entries(scope).every(([k, v]) => r[k] === v);
  }

  updateRow(name: string, columns: Column[], idKey: string, id: string, patch: Row, scope?: Row) {
    const row = this.sheets.get(name)?.rows.find(r => String(r[idKey]) === id && this.matches(r, scope));
    if (!row) return false;
    for (const c of columns) if (c.key in patch) row[c.key] = coerceCell(patch[c.key], c.type);
    return true;
  }

  deleteRow(name: string, _columns: Column[], idKey: string, id: string, scope?: Row) {
    const s = this.sheets.get(name);
    const i = s ? s.rows.findIndex(r => String(r[idKey]) === id && this.matches(r, scope)) : -1;
    if (!s || i < 0) return false;
    s.rows.splice(i, 1);
    return true;
  }

  deleteRows(name: string, _columns: Column[], match: Row) {
    const s = this.sheets.get(name);
    if (!s) return 0;
    const before = s.rows.length;
    s.rows = s.rows.filter(r => !this.matches(r, match));
    return before - s.rows.length;
  }

  withLock<T>(fn: () => T): T {
    return fn();
  }

  newId() {
    return randomUUID();
  }
}
