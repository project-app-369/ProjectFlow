import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { toCsv } from '../common/csv';
import { listQuery } from '../common/list-query';
import { parse } from '../common/validation';
import { RequireModule } from '../registry/module.guard';
import { ProcurementService } from './procurement.service';

const query = listQuery(['code', 'discipline', 'vendor', 'status', 'poDate', 'loaDate'] as const);

@Controller('projects/:projectId/procurement')
@RequireModule('procurement.procurement-plan')
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  @Get('summary')
  summary(@Param('projectId') projectId: string) {
    return this.svc.summary(projectId);
  }

  @Get('packages.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="procurement-packages.csv"')
  async csv(@Param('projectId') projectId: string, @Query() raw: unknown) {
    const rows = await this.svc.all(projectId, parse(query, raw));
    return toCsv([
      ['Code', 'Discipline', 'Description', 'Vendor', 'LOA No', 'LOA Date', 'PO No', 'PO Date', 'Buyer', 'Expeditor', 'Status'],
      ...rows.map(p => [p.code, p.discipline, p.description, p.vendor, p.loaNo, p.loaDate, p.poNo, p.poDate, p.buyer, p.expeditor, p.status]),
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
