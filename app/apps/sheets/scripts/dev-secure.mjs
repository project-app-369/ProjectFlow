// The local simulator with password sign-in switched on, to try the sign-in, access and user screens.
// Every seeded account gets the password "demo-password-1" (the data resets when the simulator restarts).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tsx = require.resolve('tsx/cli');
const child = spawn(process.execPath, [tsx, 'src/local-server.ts'], {
  stdio: 'inherit',
  env: { ...process.env, SESSION_SECRET: process.env.SESSION_SECRET ?? 'local-development-signing-secret', DEV_PASSWORD: process.env.DEV_PASSWORD ?? 'demo-password-1' },
});
child.on('exit', code => { process.exitCode = code ?? 1; });
