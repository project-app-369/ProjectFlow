import data from '../../api/seed/sttp2b.json';
import type { SeedData } from './seed';

/** The reference data, for the simulator, the tests and the scripts. The Apps Script bundle does not import this file. */
export const seedData: SeedData = data;
