import { describe, expect, it } from 'vitest';
import { SheetsStore } from '../src/sheets-store';
import type { Column } from '../src/store';
import { FakeSpreadsheet, asSpreadsheet, fakeLock } from './fake-gas';

const columns: Column[] = [
  { key: 'id', type: 'text' }, { key: 'title', type: 'text' }, { key: 'score', type: 'number' }, { key: 'due', type: 'date' },
];

function setup() {
  const ss = new FakeSpreadsheet();
  const lock = fakeLock();
  let n = 0;
  const store = new SheetsStore({ spreadsheet: asSpreadsheet(ss), lock, uuid: () => `id-${++n}` });
  return { ss, lock, store };
}

describe('SheetsStore', () => {
  it('creates a sheet with a frozen, styled header and plain-text formats for text and date columns', () => {
    const { ss, store } = setup();
    const info = store.ensureSheet('Tasks', columns);
    const sheet = ss.getSheetByName('Tasks')!;
    expect(sheet.getRange(1, 1, 1, 4).getValues()[0]).toEqual(['id', 'title', 'score', 'due']);
    expect(sheet.frozenRows).toBe(1);
    expect(sheet.headerWeight).toBe('bold');
    expect([...sheet.formats.entries()].sort()).toEqual([[1, '@'], [2, '@'], [4, '@']]);
    expect(info).toEqual({ name: 'Tasks', gid: sheet.getSheetId(), url: `https://docs.google.com/spreadsheets/d/FAKE/edit#gid=${sheet.getSheetId()}` });
  });

  it('does not touch an existing sheet', () => {
    const { ss, store } = setup();
    store.ensureSheet('Tasks', columns);
    store.appendRows('Tasks', columns, [{ id: 'a', title: 'x', score: 1, due: null }]);
    store.ensureSheet('Tasks', [{ key: 'other', type: 'text' }]);
    expect(ss.getSheets().filter(s => s.getName() === 'Tasks')).toHaveLength(1);
    expect(store.readRows('Tasks', columns)).toHaveLength(1);
  });

  it('round-trips typed rows and returns null for blanks', () => {
    const { store } = setup();
    store.ensureSheet('Tasks', columns);
    store.appendRows('Tasks', columns, [{ id: 'a', title: '=SUM(1)', score: 4.5, due: '2026-11-06' }, { id: 'b', title: null, score: null, due: null }]);
    expect(store.readRows('Tasks', columns)).toEqual([
      { id: 'a', title: '=SUM(1)', score: 4.5, due: '2026-11-06' },
      { id: 'b', title: null, score: null, due: null },
    ]);
  });

  it('reads numbers typed as text and real dates entered by hand', () => {
    const { ss, store } = setup();
    store.ensureSheet('Tasks', columns);
    const sheet = ss.getSheetByName('Tasks')!;
    sheet.getRange(2, 1, 1, 4).setValues([['a', 'hand typed', '12', new Date('2026-11-09T00:00:00Z')]]);
    expect(store.readRows('Tasks', columns)).toEqual([{ id: 'a', title: 'hand typed', score: 12, due: '2026-11-09' }]);
  });

  it('matches columns by header name, so reordered or extra columns are safe', () => {
    const { ss, store } = setup();
    store.ensureSheet('Tasks', columns);
    const sheet = ss.getSheetByName('Tasks')!;
    sheet.getRange(1, 1, 1, 5).setValues([['title', 'id', 'comment', 'score', 'due']]);
    store.appendRows('Tasks', columns, [{ id: 'a', title: 'T', score: 2, due: '2026-11-06' }]);
    expect(sheet.getRange(2, 1, 1, 5).getValues()[0]).toEqual(['T', 'a', '', 2, '2026-11-06']);
    expect(store.readRows('Tasks', columns)[0]).toMatchObject({ id: 'a', title: 'T', score: 2 });
  });

  it('updates only the patched cells and deletes by id', () => {
    const { ss, store } = setup();
    store.ensureSheet('Tasks', columns);
    store.appendRows('Tasks', columns, [{ id: 'a', title: 'one', score: 1, due: null }, { id: 'b', title: 'two', score: 2, due: null }]);
    expect(store.updateRow('Tasks', columns, 'id', 'b', { title: 'TWO' })).toBe(true);
    expect(store.readRows('Tasks', columns).map(r => r.title)).toEqual(['one', 'TWO']);
    expect(store.updateRow('Tasks', columns, 'id', 'zzz', { title: 'x' })).toBe(false);
    expect(store.deleteRow('Tasks', columns, 'id', 'a')).toBe(true);
    expect(store.deleteRow('Tasks', columns, 'id', 'a')).toBe(false);
    expect(ss.getSheetByName('Tasks')!.getLastRow()).toBe(2);
  });

  it('scopes update and delete to one project when ids repeat across projects', () => {
    const { ss, store } = setup();
    const cols: Column[] = [{ key: 'projectId', type: 'text' }, { key: 'id', type: 'text' }, { key: 'title', type: 'text' }];
    store.ensureSheet('Risks', cols);
    store.appendRows('Risks', cols, [
      { projectId: 'p1', id: 'R1', title: 'a1' }, { projectId: 'p2', id: 'R1', title: 'b1' }, { projectId: 'p2', id: 'R2', title: 'b2' },
    ]);
    expect(store.updateRow('Risks', cols, 'id', 'R1', { title: 'B-new' }, { projectId: 'p2' })).toBe(true);
    expect(store.readRows('Risks', cols).map(r => r.title)).toEqual(['a1', 'B-new', 'b2']);
    expect(store.deleteRow('Risks', cols, 'id', 'R1', { projectId: 'p1' })).toBe(true);
    expect(store.readRows('Risks', cols).map(r => `${r.projectId}/${r.id}`)).toEqual(['p2/R1', 'p2/R2']);
    expect(store.deleteRows('Risks', cols, { projectId: 'p2' })).toBe(2);
    expect(ss.getSheetByName('Risks')!.getLastRow()).toBe(1);
  });

  it('colours the tab when asked', () => {
    const { ss, store } = setup();
    store.ensureSheet('Governance - Risks', columns, '#ad751d');
    expect(ss.getSheetByName('Governance - Risks')!.tabColor).toBe('#ad751d');
  });

  it('extends the sheet when appending past its last row', () => {
    const { ss, store } = setup();
    store.ensureSheet('Tasks', columns);
    const sheet = ss.getSheetByName('Tasks')!;
    sheet.maxRows = 3;
    store.appendRows('Tasks', columns, [1, 2, 3, 4].map(n => ({ id: `r${n}`, title: `t${n}`, score: n, due: null })));
    expect(store.readRows('Tasks', columns).map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(sheet.maxRows).toBe(5);
  });

  it('returns nothing for a missing sheet and holds the lock around work', () => {
    const { lock, store } = setup();
    expect(store.readRows('Nope', columns)).toEqual([]);
    expect(store.sheetInfo('Nope')).toBeNull();
    expect(store.withLock(() => 7)).toBe(7);
    expect(lock.log).toEqual(['lock', 'unlock']);
    expect(() => store.withLock(() => { throw new Error('boom'); })).toThrow('boom');
    expect(lock.log.slice(-2)).toEqual(['lock', 'unlock']);
  });
});
