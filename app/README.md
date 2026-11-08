# Project Flow — app

Implementation of `docs/ProjectFlow_spec_final.md` on the spec's baseline stack (§11.1): React + Vite web client, NestJS REST API, PostgreSQL. The static prototypes in `../MVP` and `../v*_*` are references only. Requirements live in [`../docs/ProjectFlow_spec_final.md`](../docs/ProjectFlow_spec_final.md) (v1.4).

## Run it

```bash
pnpm install
pnpm --filter @projectflow/api build
pnpm dev:api          # http://localhost:3100/api/v1  (NestJS, watch mode)
pnpm dev:web          # http://localhost:5173         (Vite, proxies /api to the API)
```

With no `DATABASE_URL` the API uses an embedded PGlite database in `apps/api/.data/` (real Postgres, no Docker needed) and seeds the STTP2B reference data on first start. To use PostgreSQL instead:

```bash
docker compose up -d
DATABASE_URL=postgres://projectflow:projectflow@localhost:5432/projectflow pnpm --filter @projectflow/api start
```

| Variable | Default | |
|---|---|---|
| `PORT` | `3100` | API port (3000 is avoided because it is commonly taken) |
| `DATABASE_URL` | unset | PostgreSQL connection; unset → embedded PGlite |
| `PGLITE_DIR` | `apps/api/.data/pglite` | PGlite storage |
| `AUTO_SEED` | `true` | Seed reference data when the database is empty |
| `API_URL` | `http://localhost:3100` | Vite dev proxy target |

## Pre-build on Google Sheets

Before the full server exists, the same web client can run against a Google Spreadsheet served by an Apps Script web app: one sheet per dataset, and a sheet plus link generated whenever a module is established. It also carries projects, users and roles, milestones, risks and interfaces, which the NestJS API does not have yet. See [`apps/sheets/README.md`](apps/sheets/README.md), [ADR 0003](docs/adr/0003-prebuild-on-google-sheets.md), [ADR 0004](docs/adr/0004-projects-users-and-worksheet-areas.md) and the [implementation plan](../docs/ProjectFlow_implementation_plan.md).

```bash
pnpm dev:sheets-api    # local simulator of the Apps Script API (no Google needed), http://localhost:3200/exec
pnpm dev:web-sheets    # web client in sheets mode, http://localhost:5173
pnpm build:sheets      # apps/sheets/dist/Code.js + appsscript.json, ready to deploy to Apps Script
```

## Checks

```bash
pnpm typecheck
pnpm test                                  # unit tests (module catalog rules, progress maths, navigation, sheets backend)
pnpm --filter @projectflow/api smoke       # end-to-end HTTP checks against a running API
pnpm --filter @projectflow/web build
```

## What is in this first slice

- **Module registry** (spec §11.2): catalog manifests for every module in the §3.1 navigation, with phase, availability, dependencies and per-project operation state. Core modules cannot be disabled, required modules cannot be disabled while dependants are on, disabled modules reject data requests (`403 MODULE_DISABLED`), and every change is logged in `module_state_changes`.
- **Shell**: Personal / EPCIC / Governance / Reports workspaces (spec NAV-04 to NAV-06), nav driven by the project's module state, Settings → Modules / General / Data sources (SET-05, SET-06). EPCIC modules sit under the display groups Yard Execution, Installation and Commissioning.
- **Wired modules**: Dashboard, Planning → Overall Progress and Work Packages, Procurement → Procurement Plan and Expediting → Vendor Overview, Personal → Task Management → Board. Server-side search, filter, sort, pagination and CSV export (formula-neutralised).
- **Data**: the STTP2B workbooks in `/data` were extracted once into `apps/api/seed/sttp2b.json` and load into the database on first start. The API serves it read-only. Sources, mapping, cleaning rules and the files not yet used are in [`docs/ProjectFlow_reference_data.md`](../docs/ProjectFlow_reference_data.md).
- Every other catalog entry is toggleable and shows a "not yet connected" placeholder.

## Not built yet

Authentication and authorization (spec §2) — requests run as a single demo user, the project is chosen by URL and is not an authority; the project is the only seeded one. Also: background jobs and notifications, file storage, workbook import from the UI, audit beyond module changes, and all unwired modules.

## Layout

```
apps/api   NestJS + Drizzle ORM. src/registry (catalog + rules), src/db (schema, migrations, seed), one folder per module.
apps/web   React + TanStack Query/Table + ECharts. src/pages per screen, src/nav.ts navigation rules.
apps/sheets Pre-build backend: Apps Script web app over a Google Spreadsheet, same routes as apps/api.
docs/adr   Architecture decisions (0001 stack and dev database, 0002 navigation and module catalog, 0003 pre-build on Google Sheets).
```

Schema changes: edit `apps/api/src/db/schema.ts`, run `pnpm --filter @projectflow/api db:generate`, commit the generated SQL in `apps/api/drizzle/`. Migrations apply on API start.
