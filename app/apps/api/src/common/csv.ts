/** CSV with spreadsheet formula neutralisation (spec REP-03). */
export function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
