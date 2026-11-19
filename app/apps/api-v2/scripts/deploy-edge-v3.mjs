/**
 * Deploys the Edge Function (API v3) to Supabase over HTTPS, for networks that cannot reach the database or the Docker daemon.
 *
 *   pnpm --filter @projectflow/api-v2 deploy:edge-v3 [-- --yes]
 *
 * The CLI asks to confirm a deploy; from a non-interactive run (an agent, CI) pass --yes after you have decided to deploy.
 *
 * Needs a Supabase access token (https://supabase.com/dashboard/account/tokens) in SUPABASE_ACCESS_TOKEN, or a prior `npx supabase login`.
 * The function is public (--no-verify-jwt) as before: the static site calls it without a key; sign-in is the app's own (SESSION_SECRET).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.env.SUPABASE_PROJECT_REF ?? 'dulzdonvhjkvqmthsezh';
const name = 'project-flow-api-v3';
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
};

run('pnpm', ['run', 'build:edge-v3'], root);
// the Supabase CLI deploys supabase/functions/<name>/index.ts; use a scratch project so nothing is added to the repository
const work = join(root, '.tmp-deploy');
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'supabase', 'functions', name), { recursive: true });
copyFileSync(join(root, 'dist', 'edge-v3.js'), join(work, 'supabase', 'functions', name, 'index.ts'));
try {
  // --use-api bundles on Supabase's side (no Docker needed)
  run('npx', ['--yes', 'supabase@latest', 'functions', 'deploy', name, '--project-ref', ref, '--no-verify-jwt', '--use-api', ...(process.argv.includes('--yes') ? ['--yes'] : [])], work);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`Deployed ${name}. Check: https://${ref}.supabase.co/functions/v1/${name}?path=/health`);
