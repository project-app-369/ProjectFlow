import { Controller, Get, Param } from '@nestjs/common';
import { RequireModule } from '../registry/module.guard';
import { ScheduleService } from './schedule.service';

@Controller('projects/:projectId/schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('overall-progress')
  @RequireModule('planning.overall-progress')
  overall(@Param('projectId') projectId: string) {
    return this.schedule.overall(projectId);
  }

  @Get('work-packages')
  @RequireModule('planning.work-packages')
  workPackages(@Param('projectId') projectId: string) {
    return this.schedule.workPackages(projectId);
  }
}
