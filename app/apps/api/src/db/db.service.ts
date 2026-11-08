import { Global, Injectable, Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { config } from '../config';
import { createDb, type Db, type DbHandle } from './client';
import { seedIfEmpty } from './seed';

@Injectable()
export class DbService implements OnModuleInit, OnApplicationShutdown {
  private handle!: DbHandle;

  get db(): Db {
    return this.handle.db;
  }
  get kind() {
    return this.handle.kind;
  }

  async onModuleInit() {
    this.handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
    if (config.autoSeed) await seedIfEmpty(this.handle.db);
  }

  async onApplicationShutdown() {
    await this.handle?.close();
  }
}

@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}
