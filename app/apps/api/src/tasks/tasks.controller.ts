import { randomUUID } from 'node:crypto';
import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { parse } from '../common/validation';
import { DbService } from '../db/db.service';
import { DEMO_OWNER } from '../db/seed';
import { tasks } from '../db/schema';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const createBody = z.object({
  title: z.string().trim().min(1).max(120),
  due: iso,
  priority: z.enum(['High', 'Normal', 'Low']).default('Normal'),
  note: z.string().max(500).nullish(),
});
const patchBody = z.object({
  title: z.string().trim().min(1).max(120),
  due: iso,
  priority: z.enum(['High', 'Normal', 'Low']),
  note: z.string().max(500).nullable(),
  status: z.enum(['To do', 'In progress', 'Done']),
}).partial();

/**
 * Personal organizer tasks. Core Task/PIC services stay available independently of module
 * state (spec MOD-10), so these routes are not module-guarded. Owner is a placeholder until identity lands.
 */
@Controller('tasks')
export class TasksController {
  constructor(private readonly dbs: DbService) {}

  @Get()
  async list() {
    const rows = await this.dbs.db.select().from(tasks).where(eq(tasks.owner, DEMO_OWNER)).orderBy(asc(tasks.createdAt));
    return { items: rows.reverse().map(({ owner: _o, ...t }) => t) };
  }

  @Post()
  async create(@Body() body: unknown) {
    const v = parse(createBody, body);
    const [row] = await this.dbs.db.insert(tasks).values({ id: randomUUID(), owner: DEMO_OWNER, title: v.title, due: v.due, priority: v.priority, note: v.note ?? null, status: 'To do' }).returning();
    const { owner: _o, ...task } = row;
    return task;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const v = parse(patchBody, body);
    const [row] = await this.dbs.db.update(tasks).set(v).where(and(eq(tasks.id, id), eq(tasks.owner, DEMO_OWNER))).returning();
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    const { owner: _o, ...task } = row;
    return task;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const rows = await this.dbs.db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.owner, DEMO_OWNER))).returning();
    if (!rows.length) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
  }
}
