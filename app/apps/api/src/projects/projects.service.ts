import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { projects } from '../db/schema';

@Injectable()
export class ProjectsService {
  constructor(private readonly dbs: DbService) {}

  list() {
    return this.dbs.db.select().from(projects);
  }

  async require(id: string) {
    const [p] = await this.dbs.db.select().from(projects).where(eq(projects.id, id));
    if (!p) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: `Project "${id}" was not found.` });
    return p;
  }
}
