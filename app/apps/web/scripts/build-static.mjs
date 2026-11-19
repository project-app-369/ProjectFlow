/**
 * Builds the portable static distribution of Project Flow for shared hosting or a CDN.
 *
 *   pnpm --filter @projectflow/web build:static [-- --out <dir>] [--mode v3] [--no-zip]
 *
 * - Relative asset paths (base "./") and hash routes (#/…): the folder can be uploaded to the root of a host or to any sub-folder,
 *   with no rewrite rule on the server.
 * - The service worker is not registered (it would conflict with a sub-folder path).
 * - The API is the one named by apps/web/.env.<mode> (default "v3": the Supabase Edge Function over HTTPS). Those files hold no secret.
 * - The 3D model (public/models/facility, ~61 MB) and the Draco decoder (public/vendor) are copied into the folder by Vite.
 * - Adds .htaccess (Apache shared hosting: wasm/glb types, compression, caching) and _headers (Netlify / Cloudflare Pages).
 * - Writes README.txt and <out>.zip (needs the `tar` that ships with Windows 10+, macOS and Linux).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const mode = arg('mode', 'v3');
const out = resolve(arg('out', join(root, '../../../dist-static/project-flow-static')));
const zip = !process.argv.includes('--no-zip');

process.env.VITE_STATIC_HASH_ROUTER = 'true';
rmSync(out, { recursive: true, force: true });
await build({ root, mode, base: './', logLevel: 'warn', build: { outDir: out, emptyOutDir: true } });

// index.html: the icons, manifest and share image are written as "/x"; make them relative to the page like the bundles.
const indexPath = join(out, 'index.html');
writeFileSync(indexPath, readFileSync(indexPath, 'utf8').replace(/\b(href|content|src)="\/(?!\/)/g, '$1="./'));

// the service worker is never registered in this build; do not ship it
rmSync(join(out, 'sw.js'), { force: true });
const purge = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) purge(p); else if (e.name === 'desktop.ini') rmSync(p); } };
purge(out);

const env = Object.fromEntries(readFileSync(join(root, `.env.${mode}`), 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

writeFileSync(join(out, '.htaccess'), `# Apache shared hosting. No rewrite rule is needed: the app uses hash routes (#/...).
AddType application/wasm .wasm
AddType model/gltf-binary .glb
AddType application/manifest+json .webmanifest
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json application/wasm image/svg+xml
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 1 hour"
  ExpiresByType text/html "access plus 0 seconds"
  # files in assets/ carry a content hash in their name
  <FilesMatch "\\.(js|css|png|ico|wasm)$">
    ExpiresDefault "access plus 30 days"
  </FilesMatch>
  # the model manifest is read with no-cache; the .glb files change only with a new model
  <FilesMatch "\\.glb$">
    ExpiresDefault "access plus 7 days"
  </FilesMatch>
</IfModule>
`);
writeFileSync(join(out, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/index.html
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/models/*
  Cache-Control: public, max-age=604800
/vendor/*
  Cache-Control: public, max-age=2592000
`);
writeFileSync(join(out, 'README.txt'), `Project Flow: static distribution
=================================

Upload EVERY file of this folder (including the hidden .htaccess) to one directory of any HTTPS shared host or CDN, then open
index.html through the host URL, e.g. https://example.com/ or https://example.com/projectflow/. The app uses hash routes and relative
paths, so it works in a sub-folder and needs no server rewrite rule.

  index.html, assets/        the app
  models/facility/           the 3D topside model (7 Draco-compressed .glb files, ~61 MB) and its list (facility-model.json)
  vendor/draco/              the Draco WebAssembly decoder the 3D page uses
  .htaccess / _headers       MIME types (.wasm, .glb), compression and cache rules for Apache / Netlify / Cloudflare Pages

API:  ${env.VITE_SHEETS_URL ?? '(none)'}
Data: Supabase. The original Google Sheet remains a backup.

Needs outbound HTTPS to: the API above, cdn.jsdelivr / developer.api.autodesk.com (the Autodesk Viewer script of the 3D page; the page
credits it as powered by Autodesk), and fonts if the host serves none. Serve the site over HTTPS.

The static files contain no database password or server-side secret. Whoever can open the app can use the API it names; access control
is the API's (sign-in is required once SESSION_SECRET is set on the Edge Function).

The 3D page needs the Edge Function with the Facility Layout routes (apps/api-v2: pnpm deploy:edge-v3); an older function answers
"No route" and the page shows an error in place of the equipment list.

Built ${new Date().toISOString().slice(0, 10)} with: pnpm --filter @projectflow/web build:static
`);

const size = dir => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
console.log(`Built ${out} (${(size(out) / 1048576).toFixed(1)} MB), API ${env.VITE_SHEETS_URL}`);
if (zip) {
  const file = `${out}.zip`;
  rmSync(file, { force: true });
  // Windows ships bsdtar, which writes zip; a GNU tar earlier on PATH (Git Bash) cannot. Relative names also avoid "E:" read as a host.
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe') : 'tar';
  const r = spawnSync(tar, ['-a', '-c', '-f', basename(file), '-C', basename(out), '.'], { cwd: dirname(file), stdio: 'inherit' });
  if (r.status !== 0 || !existsSync(file)) throw new Error('Could not create the zip with tar; zip the folder yourself.');
  console.log(`Zip ${file} (${(statSync(file).size / 1048576).toFixed(1)} MB)`);
}
