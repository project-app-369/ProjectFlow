import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DashboardController } from './dashboard/dashboard.controller';
import { DbModule } from './db/db.service';
import { ExpeditingController } from './expediting/expediting.controller';
import { ExpeditingService } from './expediting/expediting.service';
import { HealthController } from './health.controller';
import { ProcurementController } from './procurement/procurement.controller';
import { ProcurementService } from './procurement/procurement.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { ModuleGuard } from './registry/module.guard';
import { RegistryController } from './registry/registry.controller';
import { RegistryService } from './registry/registry.service';
import { ScheduleController } from './schedule/schedule.controller';
import { ScheduleService } from './schedule/schedule.service';
import { TasksController } from './tasks/tasks.controller';

@Module({
  imports: [DbModule],
  controllers: [HealthController, ProjectsController, RegistryController, ScheduleController, ProcurementController, ExpeditingController, DashboardController, TasksController],
  providers: [
    ProjectsService,
    RegistryService,
    ScheduleService,
    ProcurementService,
    ExpeditingService,
    { provide: APP_GUARD, useClass: ModuleGuard },
  ],
})
export class AppModule {}
