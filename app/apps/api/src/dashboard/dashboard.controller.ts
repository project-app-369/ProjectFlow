import { Controller, Get, Param } from '@nestjs/common';
import { ExpeditingService } from '../expediting/expediting.service';
import { ProcurementService } from '../procurement/procurement.service';
import { ProjectsService } from '../projects/projects.service';
import { isEffective } from '../registry/catalog';
import { RequireModule } from '../registry/module.guard';
import { RegistryService } from '../registry/registry.service';
import { ScheduleService } from '../schedule/schedule.service';

/**
 * Dashboard widgets draw on other modules. A widget whose source module is off comes back as null,
 * so the client can show an explicit unavailable state (spec §6.1 acceptance).
 */
@Controller('projects/:projectId/dashboard')
@RequireModule('dashboard')
export class DashboardController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly registry: RegistryService,
    private readonly schedule: ScheduleService,
    private readonly procurement: ProcurementService,
    private readonly expediting: ExpeditingService,
  ) {}

  @Get()
  async get(@Param('projectId') projectId: string) {
    const [project, states] = await Promise.all([this.projects.require(projectId), this.registry.states(projectId)]);
    const on = (key: string) => isEffective(key, states);
    const [overall, wps, procurement, expediting] = await Promise.all([
      on('planning.overall-progress') ? this.schedule.overall(projectId) : null,
      on('planning.work-packages') ? this.schedule.workPackages(projectId) : null,
      on('procurement.procurement-plan') ? this.procurement.summary(projectId) : null,
      on('procurement.expediting.vendor-overview') ? this.expediting.summary(projectId) : null,
    ]);
    return { project, overallProgress: overall, workPackages: wps, procurement, expediting };
  }
}
