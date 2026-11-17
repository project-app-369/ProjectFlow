import { describe, expect, it } from 'vitest';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore } from '../../sheets/src/memory-store';
import { seedStore } from '../../sheets/src/seed';
import { seedData } from '../../sheets/src/seed-data';
import { refreshStore } from './refresh';

describe('reference data refresh', () => {
  it('replaces stale reference rows, moves the cut-off, and leaves what people entered alone', () => {
    const store = new MemoryStore('x');
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
});
