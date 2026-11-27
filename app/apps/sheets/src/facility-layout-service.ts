import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, notFound, parse } from './http';
import type { Service } from './service';
import type { Row } from './store';

/** The 3D models the equipment list covers: the topside has equipment, the others one row per system. */
export const MODELS = ['topside', 'jacket', 'lqm', 'linkbridge'] as const;
export type ModelId = typeof MODELS[number];

export interface FacilityEquipment {
  tag: string;
  /** Which 3D model the row belongs to; rows typed before the column existed are topside. */
  model: ModelId;
  name: string | null;
  deck: string;
  packageCode: string | null;
  vendor: string | null;
  /** Required on site, and the best known arrival on site (ETA). */
  rosDate: string | null;
  etaDate: string | null;
  status: string | null;
  packageStatus: string | null;
  /** Lift by Crane / Skidding, typed in the sheet. */
  method: string | null;
  remarks: string | null;
  comments: string | null;
  source: string | null;
}

/** Decks as the Facility Layout page lists them: the order of the model's files. A deck typed in the sheet that is not here follows them. */
export const DECK_ORDER = ['Sub-Cellar Deck', 'Cellar Deck', 'Intermediate Deck', 'Main Deck', 'DSF', 'Caissons', 'Bridge'];

export const METHODS = ['Lift by Crane', 'Skidding'] as const;

const text = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').nullish().transform(v => v ?? null);
const tagCode = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._# -]*$/, 'Use letters, digits, dot, dash, underscore or space');
const fields = {
  name: text(200), deck: z.string().trim().min(1).max(60), packageCode: text(60), vendor: text(160), rosDate: date, etaDate: date,
  status: text(60), packageStatus: text(40), method: z.enum(METHODS).nullish().transform(v => v ?? null), remarks: text(2000), comments: text(2000), source: text(200),
};
const createIn = z.object({ tag: tagCode, model: z.enum(MODELS).default('topside'), ...fields });
const patchIn = z.object(fields).partial();

const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const deckRank = (d: string) => {
  const i = DECK_ORDER.findIndex(x => x.toLowerCase() === d.toLowerCase());
  return i < 0 ? DECK_ORDER.length : i;
};

/**
 * Construction → Facility Layout: the large equipment of the 3D model with the dates and installation method kept in one sheet.
 * Equipment is created, edited and removed here; nothing is cached, so a change shows on the next load of the page.
 */
export class FacilityLayoutService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private rows(projectId: string): Row[] { return this.svc.rows(SHEET.facilityEquipment, COLUMNS.facilityEquipment, projectId) as Row[]; }
  private item = (r: Row): FacilityEquipment => ({
    tag: String(r.tag).trim(), model: (MODELS as readonly string[]).includes(String(r.model)) ? String(r.model) as ModelId : 'topside', name: str(r.name), deck: str(r.deck) ?? 'Unassigned', packageCode: str(r.packageCode), vendor: str(r.vendor),
    rosDate: str(r.rosDate), etaDate: str(r.etaDate), status: str(r.status), packageStatus: str(r.packageStatus), method: str(r.method),
    remarks: str(r.remarks), comments: str(r.comments), source: str(r.source),
  });
  private find(projectId: string, tag: string) { return this.rows(projectId).find(r => String(r.tag).trim().toLowerCase() === tag.trim().toLowerCase()); }

  create(projectId: string, body: unknown, actor: Actor): FacilityEquipment {
    requireWrite(actor, projectId);
    const v = parse(createIn, body);
    return this.store.withLock(() => {
      if (this.find(projectId, v.tag)) throw new HttpError(409, { code: 'TAG_EXISTS', message: `${v.tag} is already in the equipment list.` });
      this.store.appendRows(SHEET.facilityEquipment, COLUMNS.facilityEquipment, [{ projectId, ...v, source: v.source ?? 'Added in Project Flow', updatedAt: this.svc.clock().toISOString() }]);
      return this.item(this.find(projectId, v.tag)!);
    });
  }

  update(projectId: string, tag: string, body: unknown, actor: Actor): FacilityEquipment {
    requireWrite(actor, projectId);
    const patch = parse(patchIn, body);
    return this.store.withLock(() => {
      const current = this.find(projectId, tag);
      if (!current) throw notFound('NOT_FOUND', `${tag} was not found in the equipment list.`);
      this.store.updateRow(SHEET.facilityEquipment, COLUMNS.facilityEquipment, 'tag', String(current.tag), { ...(patch as Row), updatedAt: this.svc.clock().toISOString() }, { projectId });
      return this.item(this.find(projectId, tag)!);
    });
  }

  remove(projectId: string, tag: string, actor: Actor): void {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      const current = this.find(projectId, tag);
      if (!current) throw notFound('NOT_FOUND', `${tag} was not found in the equipment list.`);
      this.store.deleteRow(SHEET.facilityEquipment, COLUMNS.facilityEquipment, 'tag', String(current.tag), { projectId });
    });
  }

  list(projectId: string): { items: FacilityEquipment[]; decks: string[] } {
    const items = this.rows(projectId)
      .filter(r => str(r.tag))
      .map(this.item)
      .sort((a, b) => deckRank(a.deck) - deckRank(b.deck) || a.deck.localeCompare(b.deck) || a.tag.localeCompare(b.tag, undefined, { numeric: true }));
    const present = new Set(items.map(i => i.deck));
    const decks = [...DECK_ORDER.filter(d => present.has(d)), ...[...present].filter(d => !DECK_ORDER.includes(d)).sort((a, b) => a.localeCompare(b))];
    return { items, decks };
  }
}
