import data from '../../api/seed/sttp2b.json';
import type { SeedData } from './seed';

/** The reference data, for the simulator, the tests and the database scripts. The deployed edge function does not import this file. */
export const seedData: SeedData = data;
