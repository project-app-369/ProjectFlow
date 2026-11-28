# 0007 — Supabase is the only backend

Status: accepted (28 Nov 2026). Supersedes [0003](0003-prebuild-on-google-sheets.md); [0004](0004-projects-users-and-worksheet-areas.md) still describes the dataset layout.

## Context

The pre-build ran on a Google Sheet served by an Apps Script web app. Since 17 Nov 2026 the same router and services have run on Supabase (API v2, then the edge function), and the Sheet stayed as a rollback copy that nothing wrote to. Two storage paths, a Google dependency and links to a stale Sheet were left in the code, the UI and the docs.

## Decisions

- **Supabase PostgreSQL (`projectflow_v2`) is the only store.** `apps/sheets` stays as the shared package (router, services, in-memory store) that the edge function and API v2 import; its name and the dataset names keep the "sheet" wording, which is also how they are stored.
- **Apps Script is removed**: bundle, manifest, Sheets store, fake Apps Script, `pull-sheets`, XLSX converter, `export-seed`, env files and scripts. Nothing links to or reads Google Sheets.
- **The local simulator stays**, for developing the AI functions (`ai.ts`) against seeded in-memory data. It is not a backend and never writes to Supabase.
- **Health** answers `{status, database, api}`; no URL of a spreadsheet is exposed.
- **Mail and schedules are not available** until a mail service and a scheduled function exist; the reminder routes answer `NOT_AVAILABLE`. Apps Script mail and its time trigger are gone.

## Consequences

- Rolling back to the Sheet is no longer possible; use Supabase backups and the `.tmp/` copies `db:refresh` writes.
- The web app's mode name `sheets` and the env name `VITE_SHEETS_URL` are historic and unchanged, to avoid breaking the published build.
- Reference data newer than the cut-off in Supabase (the 27 Nov 2026 procurement workbooks) is loaded with the extractors and `db:refresh`, not by hand.
