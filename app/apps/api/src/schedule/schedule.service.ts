import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { scurvePoints, workPackages } from '../db/schema';
import { overallProgress } from './progress';

@Injectable()
export class ScheduleService {
  constructor(private readonly dbs: DbService) {}

  async workPackages(projectId: string) {
    const items = await this.dbs.db.select().from(workPackages).where(eq(workPackages.projectId, projectId)).orderBy(asc(workPackages.code));
    return { items: items.map(({ projectId: _p, ...w }) => w), overall: overallProgress(items) };
  }

  async overall(projectId: string) {
    const scurve = (await this.dbs.db.select().from(scurvePoints).where(eq(scurvePoints.projectId, projectId)).orderBy(asc(scurvePoints.pointDate))).map(p => ({
      date: p.pointDate,
      plan: p.plan,
      forecast: p.forecast,
      actual: p.actual,
    }));
    const latest = [...scurve].reverse().find(p => p.actual != null) ?? null;
    const wps = await this.workPackages(projectId);
    return { scurve, latest, thisWeek: { plan: wps.overall.thisWeekPlan, actual: wps.overall.thisWeekActual }, workPackageCount: wps.items.length };
  }
}
