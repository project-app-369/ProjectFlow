import { z } from 'zod';
import { requireConfigure, requireManage, type Actor } from './auth';
import { COLUMNS, SHEET, SNAPSHOT_DATASETS } from './datasets';
import { HttpError, notFound, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const snapshotBody = z.object({
  cutoff: iso.optional(),
  note: z.string().trim().max(200).nullish().transform(v => (v ? v : null)),
  replace: z.boolean().default(false),
});

/** A spreadsheet cell holds 50,000 characters; each dataset is stored as JSON cut into parts below that. */
const CHUNK = 40_000;

/**
 * Cut-off reports: a saved copy of a project's report datasets at a reporting date, normally the Friday the data was
 * imported (spec NAV-03: historical mode is read-only and limited to stored reporting snapshots).
 * One row per snapshot in `Reports - Cut-off snapshots`; the data itself in `Reports - Snapshot data`.
 */
export class SnapshotsService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }

  private headers(projectId: string) {
    return this.store.readRows(SHEET.snapshots, COLUMNS.snapshots).filter(s => s.projectId === projectId);
  }

  list(projectId: string) {
    const users = new Map(this.store.readRows(SHEET.users, COLUMNS.users).map(u => [u.id, String(u.name)]));
    return this.headers(projectId)
      .map(s => ({ cutoff: String(s.cutoff), createdAt: s.createdAt, createdBy: users.get(s.createdBy) ?? String(s.createdBy ?? ''), note: s.note, rowCount: Number(s.rowCount ?? 0) }))
      .sort((a, b) => b.cutoff.localeCompare(a.cutoff));
  }

  /** The saved rows of every dataset for one cut-off, or null when no snapshot exists. */
  load(projectId: string, cutoff: string): Map<string, Row[]> | null {
    if (!this.headers(projectId).some(s => s.cutoff === cutoff)) return null;
    const parts = this.store.readRows(SHEET.snapshotData, COLUMNS.snapshotData).filter(r => r.projectId === projectId && r.cutoff === cutoff);
    const text = new Map<string, Row[]>();
    for (const p of parts) text.set(String(p.dataset), [...(text.get(String(p.dataset)) ?? []), p]);
    const out = new Map<string, Row[]>();
    for (const [dataset, chunks] of text) {
      chunks.sort((a, b) => Number(a.part) - Number(b.part));
      out.set(dataset, JSON.parse(chunks.map(c => String(c.json ?? '')).join('')) as Row[]);
    }
    return out;
  }

  create(projectId: string, body: unknown, actor: Actor) {
    requireManage(actor, projectId);
    const v = parse(snapshotBody, body);
    const project = this.svc.project(projectId);
    const cutoff = v.cutoff ?? String(project.cutoff);
    const tomorrow = new Date(this.svc.clock().getTime() + 86_400_000).toISOString().slice(0, 10);
    if (cutoff > tomorrow) {
      throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'cutoff', message: 'A cut-off report cannot be dated in the future.' }] });
    }
    return this.store.withLock(() => {
      const existed = this.headers(projectId).some(s => s.cutoff === cutoff);
      if (existed && !v.replace) {
        throw new HttpError(409, { code: 'SNAPSHOT_EXISTS', message: `A snapshot for the cut-off ${cutoff} already exists. Replace it to save the current data over it.` });
      }
      const match = { projectId, cutoff };
      this.store.deleteRows(SHEET.snapshots, COLUMNS.snapshots, match);
      this.store.deleteRows(SHEET.snapshotData, COLUMNS.snapshotData, match);

      let rowCount = 0;
      const chunks: Row[] = [];
      for (const key of SNAPSHOT_DATASETS) {
        const rows = this.svc.rows(SHEET[key], COLUMNS[key], projectId);
        rowCount += rows.length;
        const json = JSON.stringify(rows);
        for (let i = 0, part = 1; i < json.length || part === 1; i += CHUNK, part++) chunks.push({ projectId, cutoff, dataset: key, part, json: json.slice(i, i + CHUNK) });
      }
      this.store.appendRows(SHEET.snapshotData, COLUMNS.snapshotData, chunks);
      const createdAt = this.svc.clock().toISOString();
      this.store.appendRows(SHEET.snapshots, COLUMNS.snapshots, [{ projectId, cutoff, createdAt, createdBy: actor.id, note: v.note, rowCount }]);
      return { cutoff, createdAt, createdBy: actor.name, note: v.note, rowCount, replaced: existed };
    });
  }

  remove(projectId: string, cutoff: string, actor: Actor) {
    requireConfigure(actor, projectId);
    this.store.withLock(() => {
      if (!this.headers(projectId).some(s => s.cutoff === cutoff)) throw notFound('SNAPSHOT_NOT_FOUND', `No snapshot was saved for the cut-off ${cutoff}.`);
      const match = { projectId, cutoff };
      this.store.deleteRows(SHEET.snapshots, COLUMNS.snapshots, match);
      this.store.deleteRows(SHEET.snapshotData, COLUMNS.snapshotData, match);
    });
  }
}
