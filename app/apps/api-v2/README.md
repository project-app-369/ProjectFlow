# Project Flow API v2 — Supabase PostgreSQL

API v2 uses the **current Google Sheets route contract** with PostgreSQL persistence in a private `projectflow_v2` schema. The React client can use the same `/exec` envelope through a server-side proxy. The v1 Google Sheet and Apps Script remain in place as the backup; the import reads them and never writes to them.

## Current migration (17 November 2026)

The [Project Flow Supabase project](https://supabase.com/dashboard/project/dulzdonvhjkvqmthsezh) contains 42 imported worksheets and 4,541 rows from the live [Project Flow Sheet](https://docs.google.com/spreadsheets/d/1CTkxAb2HEhjLEIoz0EAQHN1qm4VF4Sg6mwoorClnKQY/edit). The local export and JSON archive are in the repository root's ignored `.tmp/` directory; connection credentials are in the ignored `.env.local`. The PostgreSQL import audit, six representative data routes, API v2 HTTP health and dashboard, and task create/read/delete were verified. The separate Project Flow v3 Site now reads and writes through the Supabase Edge Function; v2 remains on Google Sheets.

## Setup

1. Create a private Supabase project. Keep the `projectflow_v2` schema out of Supabase's [exposed Data API schemas](https://supabase.com/docs/guides/api/using-custom-schemas). Copy the **Session pooler** URI from the project's Connect dialog (do not guess the host), as described in the [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres). The `pg` client uses the bundled Supabase root certificate with full server verification. Do not add `sslmode` to the URI because it overrides the explicit client TLS settings.
2. Copy `example.env` to `.env.local`. Set `SUPABASE_DB_URL`, a new random `API_V2_TOKEN`, the existing Apps Script deployment URL and API token, and the original Sheet URL. Keep `.env.local` private.
3. From `app/`, run `pnpm install` and `pnpm --filter @projectflow/api-v2 db:migrate`.
4. Export the live Google Sheet. The preferred repeatable path is to deploy the Apps Script source from `apps/sheets/` so `/admin/export` is available. This read-only admin endpoint is guarded by the existing Sheet API token and `u-admin` role, and pages 100 rows at a time. Run `pnpm --filter @projectflow/api-v2 sheets:pull -- ../../../.tmp/projectflow-sheets-backup.json`. Alternatively, export the complete live Sheet as XLSX and use `python scripts/convert-sheet-xlsx.py source.xlsx sheet-gids.json archive.json`, where `sheet-gids.json` is the Sheet API metadata mapping of tab titles to sheet IDs. The converter restores names over Excel's 31-character tab limit.
5. Save the resulting JSON archive in the repository root's ignored `.tmp/` directory. Run `pnpm --filter @projectflow/api-v2 db:validate -- ../../../.tmp/projectflow-live-archive.json` and `pnpm --filter @projectflow/api-v2 db:smoke-import -- ../../../.tmp/projectflow-live-archive.json`. Check the sheet and row counts against the Sheet. API v2 fills newly added columns with null in Supabase without changing the Google Sheet.
6. Run `pnpm --filter @projectflow/api-v2 db:import -- ../../../.tmp/projectflow-live-archive.json`. The import creates an audit record and refuses to replace existing Supabase data unless `REPLACE_SUPABASE_DATA=true` is explicitly set after a backup.
7. Start with `pnpm --filter @projectflow/api-v2 dev`. For deployment, build with `pnpm --filter @projectflow/api-v2 build` and run `pnpm --filter @projectflow/api-v2 start` with the same environment variables injected by the host. Verify `GET /api/v2/exec?path=/health&token=...` and representative dashboard, register, and write routes through a server-side proxy before pointing the Site at v2.

8. When the extractors refresh `apps/api/seed/sttp2b.json` (a new cut-off), run `pnpm --filter @projectflow/api-v2 db:refresh` to see which reference datasets would change (S-curves, milestones, procurement, expediting, logistics, material, facility progress, working schedule, CPN, and the project cut-off), then `db:refresh -- --apply` to write them. It saves the previous rows to `.tmp/`, writes in one transaction under the API write lock, and records an audit row so `db:verify` still matches. Users, memberships, tasks, issues, risks, interfaces, lessons, and the other registers are never touched.

For local UI testing, start API v2 and then run `pnpm --filter @projectflow/web dev:v2` in another terminal. Vite's `/exec` proxy attaches the API token on the server side; `.env.supabase` contains no secret. Open `http://localhost:5173`.

`--seed` is available for a disposable development database, but **production migration must use the live Sheet archive** so edits after the original workbook extraction are retained.

## Sign-in

Set `SESSION_SECRET` (a long random string, kept private) in `.env.local` or the host's environment to require e-mail and password: the server then issues signed 12-hour session tokens at `POST /auth/login`, takes the acting user from the token and ignores a stated `user`. Without it API v2 stays in demo mode. Nobody can sign in before a password exists, so set the first administrator's from the command line (the password comes from the environment so it stays out of the shell history):

```bash
NEW_PASSWORD='a long password' pnpm --filter @projectflow/api-v2 db:set-password -- admin@example.com
```

After that administrators set and reset passwords under Settings → Users. Run `pnpm --filter @projectflow/api-v2 db:refresh -- --apply` once after upgrading so the database gets the new Role access, Person access and Access log worksheets. The Edge Function (`src/edge-v3.ts`) reads the same `SESSION_SECRET` (`supabase secrets set SESSION_SECRET=…`) and must be redeployed to use it. Changing a password ends the person's sessions; suspending an account does too.

## Storage and safety

`projectflow_v2.datasets` stores worksheet metadata and `projectflow_v2.dataset_rows` stores typed row objects in JSONB with stable order. This transitional schema preserves all current fields, including the module-specific sheets; it does not claim the older partial NestJS schema has full app parity. API v2 loads the affected dataset state, applies the existing route validation and authorization logic, then commits changed datasets in one PostgreSQL transaction. A PostgreSQL advisory lock serializes writes across API instances. Each instance keeps its last snapshot and reuses it while the dataset version (count and latest `updated_at` of `projectflow_v2.datasets`) is unchanged, so a read costs one query instead of loading every row; a write by any instance changes the version. The API refuses to start without a database URL and server-side token.

The current demo user ID mechanism is **not real authentication**. Keep API v2 behind a server-side proxy with the token secret; do not put either database credentials or the API token in a browser bundle. Migration does not switch production traffic. Keep the Sheet available for rollback and export a fresh copy before cutover.

The Google Sheet is a **point-in-time backup** after cutover; API v2 does not write back to it. To refresh the backup, export Supabase data separately or add a reviewed backup job before production traffic moves. Rollback to the Sheet would otherwise lose writes made only in Supabase.

## API v3 and static distribution

API v3 is the Supabase Edge Function in src/edge-v3.ts. Build with pnpm --filter @projectflow/api-v2 build:edge-v3 and deploy the generated dist/edge-v3.js as the project-flow-api-v3 function. Its public HTTPS endpoint uses the same GET ?path=... and POST envelope as the Sheets backend. The private Postgres connection is provided by the Edge Function runtime through SUPABASE_DB_URL; no database credential belongs in the static frontend. Public editing is intentionally enabled to match the v2 demo access model. The identity chooser is not authentication.

The separate [Project Flow v3 Site](https://project-flow-v3.ptsc-7423.chatgpt.site/) and deliverables/project-flow-v3-static.zip both call that endpoint. Upload the ZIP contents to any HTTPS shared host or CDN. The portable build uses hash routes, so no rewrite rule is needed for subdirectory hosting. The Sheet remains a point-in-time backup; Supabase edits do not sync back to it.

