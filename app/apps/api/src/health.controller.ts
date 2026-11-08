import { Controller, Get } from '@nestjs/common';
import { DbService } from './db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly dbs: DbService) {}

  @Get()
  health() {
    return { status: 'ok', database: this.dbs.kind };
  }
}
