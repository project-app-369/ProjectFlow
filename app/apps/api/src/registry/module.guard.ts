import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RegistryService } from './registry.service';

export const REQUIRE_MODULE = 'requireModule';
/** Marks a route as belonging to a module; the guard enforces the project's operation state. */
export const RequireModule = (key: string) => SetMetadata(REQUIRE_MODULE, key);

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly registry: RegistryService) {}

  async canActivate(ctx: ExecutionContext) {
    const key = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_MODULE, [ctx.getHandler(), ctx.getClass()]);
    if (!key) return true;
    const req = ctx.switchToHttp().getRequest();
    await this.registry.assertAccess(req.params.projectId, key, req.method !== 'GET' && req.method !== 'HEAD');
    return true;
  }
}
