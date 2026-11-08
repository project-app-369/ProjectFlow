import { describe, expect, it } from 'vitest';
import { parseBudgetImport, parseDelimited, toIsoDate } from './budgetImport';

describe('budget import', () => {
  it('reads tab-separated text pasted from a spreadsheet', () => {
    const r = parseBudgetImport('WBS\tActivity\tParent\tDiscipline\tManhours\tStart\tFinish\n1\tJacket\t\t\t\t\t\n1.1\tRoll up\t1\tStructural\t1,250.5\t02/11/2026\t15-11-26');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { wbs: '1', name: 'Jacket', parentWbs: null, discipline: null, manhours: null, planStart: null, planFinish: null, notes: null },
      { wbs: '1.1', name: 'Roll up', parentWbs: '1', discipline: 'Structural', manhours: 1250.5, planStart: '2026-11-02', planFinish: '2026-11-15', notes: null },
    ]);
  });

  it('reads CSV with quoted commas, quotes and header aliases in any order', () => {
    const r = parseBudgetImport('Name,Code,Budget,Notes\n"Weld, fit ""A""",2.1,300,"line 1\nline 2"\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ wbs: '2.1', name: 'Weld, fit "A"', manhours: 300, notes: 'line 1\nline 2' });
  });

  it('reports every bad row with its line number instead of importing part of it', () => {
    const r = parseBudgetImport('wbs,name,manhours,start\n,No code,10,\n1,Fine,abc,\n2,Dated,5,31/02/2026');
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([
      'Row 2: WBS is empty.',
      'Row 3: "abc" is not a number of hours.',
      'Row 4: Start "31/02/2026" is not a date (use yyyy-mm-dd or dd/mm/yyyy).',
    ]);
  });

  it('needs a header with WBS and Name, and ignores empty input', () => {
    expect(parseBudgetImport('1,Jacket').errors[0]).toMatch(/header/);
    expect(parseBudgetImport('  \n ')).toEqual({ rows: [], errors: [] });
  });

  it('converts dates', () => {
    expect(toIsoDate('2026-11-08')).toBe('2026-11-08');
    expect(toIsoDate('8/11/2026')).toBe('2026-11-08');
    expect(toIsoDate('2026-02-30')).toBeNull();
    expect(toIsoDate('Nov 8')).toBeNull();
    expect(parseDelimited('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
