import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const envFile = join(import.meta.dirname, '../../api-v2/.env.local');
const token = readFileSync(envFile, 'utf8').split(/\r?\n/).find(line => line.startsWith('API_V2_TOKEN='))?.slice('API_V2_TOKEN='.length);
if (!token) throw new Error('Set API_V2_TOKEN in apps/api-v2/.env.local before starting the v2 web client.');
const vite = join(import.meta.dirname, '../node_modules/vite/bin/vite.js');
const child = spawn(process.execPath, [vite, '--mode', 'supabase'], { stdio: 'inherit', env: { ...process.env, API_V2_TOKEN: token } });
child.on('exit', code => { process.exitCode = code ?? 1; });
