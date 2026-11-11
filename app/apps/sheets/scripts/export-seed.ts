/**
 * Writes each dataset sheet as {header, rows} JSON (blank cells as null) from the same seed the Apps Script
 * `setup` function loads. Usage: tsx scripts/export-seed.ts <output-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const out = process.argv[2];
if (!out) throw new Error('Usage: tsx scripts/export-seed.ts <output-dir>');
mkdirSync(out, { recursive: true });

const store = new MemoryStore();
seedStore(store, seedData);

const sheets: [string, string, typeof COLUMNS[keyof typeof COLUMNS]][] = [
  ['projects', SHEET.projects, COLUMNS.projects], ['users', SHEET.users, COLUMNS.users], ['memberships', SHEET.memberships, COLUMNS.memberships],
  ['modules', SHEET.modules, COLUMNS.modules], ['moduleChanges', SHEET.moduleChanges, COLUMNS.moduleChanges], ['tasks', SHEET.tasks, COLUMNS.tasks], ['subtasks', SHEET.subtasks, COLUMNS.subtasks],
  ['scurve', SHEET.scurve, COLUMNS.scurve], ['workPackages', SHEET.workPackages, COLUMNS.workPackages], ['milestones', SHEET.milestones, COLUMNS.milestones],
  ['procurement', SHEET.procurement, COLUMNS.procurement], ['expediting', SHEET.expediting, COLUMNS.expediting],
  ['logistics', SHEET.logistics, COLUMNS.logistics], ['materialBalance', SHEET.materialBalance, COLUMNS.materialBalance], ['materialSummary', SHEET.materialSummary, COLUMNS.materialSummary], ['procConcerns', SHEET.procConcerns, COLUMNS.procConcerns], ['procCurves', SHEET.procCurves, COLUMNS.procCurves], ['phaseProgress', SHEET.phaseProgress, COLUMNS.phaseProgress], ['budget', SHEET.budget, COLUMNS.budget], ['knowledge', SHEET.knowledge, COLUMNS.knowledge], ['risks', SHEET.risks, COLUMNS.risks], ['snapshots', SHEET.snapshots, COLUMNS.snapshots], ['snapshotData', SHEET.snapshotData, COLUMNS.snapshotData], ['interfaces', SHEET.interfaces, COLUMNS.interfaces], ['interfacePoints', SHEET.interfacePoints, COLUMNS.interfacePoints],
];

for (const [file, name, columns] of sheets) {
  const rows = store.readRows(name, [...columns]).map(r => columns.map(c => r[c.key] ?? null));
  const payload = { sheet: name, header: columns.map(c => c.key), types: columns.map(c => c.type), rows };
  writeFileSync(join(out, `${file}.json`), JSON.stringify(payload));
  console.log(`${name}: ${rows.length} rows × ${columns.length} columns, ${JSON.stringify(payload).length} bytes`);
}
