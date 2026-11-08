import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { toCsv } from '../common/csv';
import { listQuery } from '../common/list-query';
import { parse } from '../common/validation';
import { RequireModule } from '../registry/module.guard';
import { ExpeditingService } from './expediting.service';

const query = listQuery(['code', 'discipline', 'vendor', 'status', 'actualPct', 'variance'] as const);

@Controller('projects/:projectId/expediting')
@RequireModule('procurement.expediting.vendor-overview')
export class ExpeditingController {
  constructor(private readonly svc: ExpeditingService) {}

  @Get('summary')
  summary(@Param('projectId') projectId: string) {
    return this.svc.summary(projectId);
  }

  @Get('packages.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="expediting-packages.csv"')
  async csv(@Param('projectId') projectId: string, @Query() raw: unknown) {
    const rows = await this.svc.all(projectId, parse(query, raw));
    return toCsv([
      ['Code', 'Discipline', 'Name', 'Vendor', 'Plan %', 'Actual %', 'Variance', 'Status'],
      ...rows.map(x => [x.code, x.discipline, x.name, x.vendor, x.planPct, x.actualPct, x.variance, x.status]),
    ]);
  }

  @Get('packages')
  list(@Param('projectId') projectId: string, @Query() raw: unknown) {
    return this.svc.list(projectId, parse(query, raw));
  }

  @Get('packages/:id')
  get(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.svc.get(projectId, id);
  }
}
