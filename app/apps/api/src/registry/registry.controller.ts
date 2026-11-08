import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/validation';
import { MANIFESTS, WORKSPACES } from './catalog';
import { RegistryService } from './registry.service';

const changeBody = z.object({ state: z.string(), reason: z.string().max(500).optional() });

@Controller()
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  /** Static master catalog (spec MOD-07). */
  @Get('modules')
  catalog() {
    return { workspaces: WORKSPACES, modules: MANIFESTS };
  }

  @Get('projects/:projectId/modules')
  async projectModules(@Param('projectId') projectId: string) {
    return { workspaces: WORKSPACES, modules: await this.registry.list(projectId) };
  }

  @Put('projects/:projectId/modules/:key')
  change(@Param('projectId') projectId: string, @Param('key') key: string, @Body() body: unknown) {
    const { state, reason } = parse(changeBody, body);
    return this.registry.change(projectId, key, state, reason, 'demo-user');
  }

  @Get('projects/:projectId/module-changes')
  history(@Param('projectId') projectId: string) {
    return this.registry.history(projectId);
  }
}
