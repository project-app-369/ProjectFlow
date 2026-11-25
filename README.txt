Project Flow: static distribution
=================================

Upload EVERY file of this folder (including the hidden .htaccess) to one directory of any HTTPS shared host or CDN, then open
index.html through the host URL, e.g. https://example.com/ or https://example.com/projectflow/. The app uses hash routes and relative
paths, so it works in a sub-folder and needs no server rewrite rule.

  index.html, assets/        the app
  models/                    the 3D models of Facility layout (topside, jacket, LQM, link bridge: Draco-compressed .glb files and their lists)
  sequence/jacket/           the jacket fabrication sequence (Construction sequence): one .glb per component and sequence.json
  vendor/draco/              the Draco WebAssembly decoder the 3D page uses
  .htaccess / _headers       MIME types (.wasm, .glb), compression and cache rules for Apache / Netlify / Cloudflare Pages

API:  https://dulzdonvhjkvqmthsezh.supabase.co/functions/v1/project-flow-api-v3
Data: Supabase. The original Google Sheet remains a backup.

Needs outbound HTTPS to: the API above, cdn.jsdelivr / developer.api.autodesk.com (the Autodesk Viewer script of the 3D page; the page
credits it as powered by Autodesk), and fonts if the host serves none. Serve the site over HTTPS.

The static files contain no database password or server-side secret. Whoever can open the app can use the API it names; access control
is the API's (sign-in is required once SESSION_SECRET is set on the Edge Function).

The 3D page needs the Edge Function with the Facility Layout routes (apps/api-v2: pnpm deploy:edge-v3); an older function answers
"No route" and the page shows an error in place of the equipment list.

Built 2026-11-25 with: pnpm --filter @projectflow/web build:static
