import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Parses input with zod and raises a structured 400 (spec API-01). */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}
