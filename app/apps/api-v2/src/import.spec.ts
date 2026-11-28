import { describe, expect, it } from 'vitest';
import { Api } from '../../sheets/src/api';
import { MemoryStore } from '../../sheets/src/memory-store';
import { handle } from '../../sheets/src/router';
import { seedData } from '../../sheets/src/seed-data';
import { seedStore } from '../../sheets/src/seed';
import { upgradeArchive, validate } from './import';

describe('API v2 Sheet archive', () => {
  it('retains live row edits and route results after a snapshot round trip', () => {
    const original = new MemoryStore();
    seedStore(original, seedData);
    const archive = original.snapshot();
    validate(archive);
    const users = archive.sheets.find(s => s.name === 'Settings - Users')!;
    users.rows.find(r => r.id === 'u-admin')!.name = 'Admin changed in Sheet';
    const loaded = new MemoryStore();
    loaded.loadSnapshot(archive);
    expect(loaded.snapshot()).toEqual(archive);
    const result = handle(new Api(loaded), { method: 'GET', path: '/me', user: 'u-admin' });
    expect(result.ok && (result.data as { name: string }).name).toBe('Admin changed in Sheet');
  });

  it('rejects incomplete archives before database writes', () => {
    expect(() => validate({ sheets: [{ name: 'Settings - Projects', gid: 1, header: ['id'], rows: [] }] })).toThrow('Projects and Users');
  });

  it('adds missing columns without changing existing values', () => {
    const store = new MemoryStore();
    seedStore(store, seedData);
    const archive = store.snapshot();
    const curves = archive.sheets.find(s => s.name === 'EPCIC - Procurement S-curves')!;
    curves.header = curves.header.filter(key => key !== 'updatedAt');
    const first = { ...curves.rows[0] };
    upgradeArchive(archive);
    expect(curves.header).toContain('updatedAt');
    expect(curves.rows[0]).toMatchObject(first);
    validate(archive);
  });
});
