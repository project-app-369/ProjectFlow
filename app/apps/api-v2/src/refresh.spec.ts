import { describe, expect, it } from 'vitest';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore } from '../../sheets/src/memory-store';
import { seedStore } from '../../sheets/src/seed';
import { seedData } from '../../sheets/src/seed-data';
import { refreshStore } from './refresh';

describe('reference data refresh', () => {
  it('replaces stale reference rows, moves the cut-off, and leaves what people entered alone', () => {
    const store = new MemoryStore();
    seedStore(store, seedData);
    const issues = store.readRows(SHEET.issues, COLUMNS.issues).length;
    store.deleteRows(SHEET.milestones, COLUMNS.milestones, { projectId: 'sttp2b' });
    store.appendRows(SHEET.milestones, COLUMNS.milestones, [{ projectId: 'sttp2b', id: 'OLD-1', description: 'Old revision' }]);
    store.updateRow(SHEET.projects, COLUMNS.projects, 'id', 'sttp2b', { cutoff: '2026-10-30' });
    store.appendRows(SHEET.issues, COLUMNS.issues, [{ projectId: 'sttp2b', id: 'user-issue', title: 'Entered in the app' }]);

    const changes = refreshStore(store);
    expect(changes.map(c => c.dataset)).toEqual([SHEET.milestones, expect.stringContaining(SHEET.projects)]);
    const ms = store.readRows(SHEET.milestones, COLUMNS.milestones);
    expect(ms.some(m => m.id === 'OLD-1')).toBe(false);
    expect(ms).toHaveLength((seedData as unknown as { milestones: unknown[] }).milestones.length);
    expect(store.readRows(SHEET.projects, COLUMNS.projects)[0].cutoff).toBe(String(seedData.project.cutoff));
    expect(store.readRows(SHEET.issues, COLUMNS.issues)).toHaveLength(issues + 1);
    expect(refreshStore(store)).toEqual([]);
  });

  it('loads the facility equipment once into a database that has none and never overwrites what people edit', () => {
    const store = new MemoryStore();
    seedStore(store, seedData);
    store.deleteRows(SHEET.facilityEquipment, COLUMNS.facilityEquipment, { projectId: 'sttp2b' });
    const first = refreshStore(store);
    expect(first.map(c => c.dataset)).toEqual([expect.stringContaining(SHEET.facilityEquipment)]);
    const seeded = store.readRows(SHEET.facilityEquipment, COLUMNS.facilityEquipment).length;
    expect(seeded).toBeGreaterThan(100);
    store.updateRow(SHEET.facilityEquipment, COLUMNS.facilityEquipment, 'tag', 'MBD-2501', { method: 'Lift by Crane' }, { projectId: 'sttp2b' });
    store.deleteRow(SHEET.facilityEquipment, COLUMNS.facilityEquipment, 'tag', 'MBD-2701', { projectId: 'sttp2b' });
    expect(refreshStore(store)).toEqual([]);
    const rows = store.readRows(SHEET.facilityEquipment, COLUMNS.facilityEquipment);
    expect(rows).toHaveLength(seeded - 1);
    expect(rows.find(r => r.tag === 'MBD-2501')?.method).toBe('Lift by Crane');
  });

  it('loads the construction budget once, switches Construction → Budget on, and keeps corrected hours', () => {
    const store = new MemoryStore();
    seedStore(store, seedData);
    store.deleteRows(SHEET.budget, COLUMNS.budget, { projectId: 'sttp2b' });
    const first = refreshStore(store);
    expect(first.map(c => c.dataset)).toEqual(expect.arrayContaining([expect.stringContaining(SHEET.budget)]));
    const rows = store.readRows(SHEET.budget, COLUMNS.budget);
    expect(rows.length).toBeGreaterThan(400);
    store.deleteRow(SHEET.budget, COLUMNS.budget, 'id', String(rows[0].id), { projectId: 'sttp2b' });
    expect(refreshStore(store)).toEqual([]);
    expect(store.readRows(SHEET.budget, COLUMNS.budget)).toHaveLength(rows.length - 1);
  });
});
