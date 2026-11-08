import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { MANIFESTS, defaultState } from '../registry/catalog';
import type { Db } from './client';
import * as t from './schema';

export const DEMO_PROJECT_ID = 'sttp2b';
export const DEMO_OWNER = 'demo-user';

const isoOrNull = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

type Raw = {
  project: { name: string; code: string; contract: string; cutoff: string };
  schedule: { scurve: any[]; workPackages: any[] };
  procurement: any[];
  expediting: any[];
};

/** Loads the STTP2B reference data (extracted from the /data workbooks) once; safe to call repeatedly. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const existing = await db.select().from(t.projects).where(eq(t.projects.id, DEMO_PROJECT_ID));
  if (existing.length) return false;

  const raw: Raw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'seed', 'sttp2b.json'), 'utf8'));
  const pid = DEMO_PROJECT_ID;

  await db.transaction(async db => {
  await db.insert(t.projects).values({ id: pid, code: raw.project.code, name: raw.project.name, contract: raw.project.contract, cutoff: raw.project.cutoff });
  await db.insert(t.projectModules).values(MANIFESTS.map(m => ({ projectId: pid, moduleKey: m.key, state: defaultState(m) })));
  await db.insert(t.scurvePoints).values(raw.schedule.scurve.map(p => ({ projectId: pid, pointDate: p.date, plan: p.plan, forecast: p.forecast, actual: p.actual })));
  await db.insert(t.workPackages).values(raw.schedule.workPackages.map(w => ({ projectId: pid, ...w, weight: w.weight })));
  await db.insert(t.procurementPackages).values(raw.procurement.map(p => ({
    projectId: pid, id: p.id, code: p.code, discipline: p.discipline === 'Pipline' ? 'Pipeline' : p.discipline, description: p.description, vendorCode: p.vendorCode, vendor: p.vendor,
    origins: p.origins, loaNo: p.loaNo, loaDate: isoOrNull(p.loaDate), poNo: p.poNo, poDate: isoOrNull(p.poDate), buyer: p.buyer, expeditor: p.expeditor, pe: p.pe, vqc: p.vqc, status: p.status,
  })));
  await db.insert(t.expeditingPackages).values(raw.expediting.map(x => {
    const { id, discipline, code, name, vendor, status, planPct, actualPct, variance, rosDate, ...details } = x;
    return { projectId: pid, id, discipline, code, name, vendor, status, planPct, actualPct, variance, rosDate: isoOrNull(rosDate), details };
  }));

  const flagged = raw.expediting.filter(x => /Delay|At Risk/i.test(x.status) && x.highlight && x.highlight !== 'No').slice(0, 3);
  await db.insert(t.tasks).values([
    ...flagged.map(x => ({ id: randomUUID(), owner: DEMO_OWNER, title: `Follow up: ${x.name || x.code}`, note: `${x.discipline} · ${x.vendor ?? 'vendor tbc'} · ${x.status}`, due: raw.project.cutoff, priority: x.status === 'Delay' ? 'High' : 'Normal', status: 'To do' })),
    { id: randomUUID(), owner: DEMO_OWNER, title: 'Prepare weekly vendor review agenda', note: 'Personal · recurring', due: raw.project.cutoff, priority: 'Normal', status: 'In progress' },
  ]);
  });
  return true;
}
