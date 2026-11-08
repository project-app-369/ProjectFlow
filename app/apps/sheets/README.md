# Pre-build backend: Google Sheets + Apps Script

A stand-in for the NestJS API while the full server and services are not yet in place. The data lives in one Google Spreadsheet, **one sheet per dataset**, and a Google Apps Script web app serves the same routes the NestJS API does. The web client switches between the two with `VITE_API_MODE`.

```
React web (static)  --GET/POST-->  Apps Script web app  --SpreadsheetApp-->  Google Spreadsheet
                                   (apps/sheets, dist/Code.js)               one sheet per dataset
```

Everything in `src/` is TypeScript. `router.ts` and `service.ts` reuse the module catalog and progress rules from `apps/api`, so both backends apply the same module rules. Only the storage differs (`sheets-store.ts` against Google, `memory-store.ts` for tests and the local simulator).

## Sheets it generates

Worksheets are named `<Area> - <dataset>`, created in area order and given a tab colour, so each workspace's data stays together (ADR 0004). Sheets that hold project records start with a `projectId` column; one file can serve several projects.

| Sheet | Area (tab colour) | Holds | Read by |
|---|---|---|---|
| `Settings - Projects` | Settings (grey) | Projects: code, name, client, location, lifecycle, reporting cut-off | Settings → Projects, all |
| `Settings - Users` | Settings | User accounts: name, email, administrator flag, account state | Settings → Users, sign-in |
| `Settings - Memberships` | Settings | Who holds which role in which project | access control |
| `Settings - Modules` | Settings | State of every module per project, with its breadcrumb path | module registry |
| `Settings - Module changes` | Settings | Log of every module state change: who, when, from, to, why | Settings |
| `Personal - Tasks` | Personal (teal) | Personal tasks: number, urgency, assigner, projects, plan dates, due, status, effort, remarks; owned by one user | Task Management |
| `Personal - Subtasks` | Personal | Checklist items of each task | Task Management |
| `EPCIC - S-curve` | EPCIC (indigo) | Monthly plan / forecast / actual | Overall Progress |
| `EPCIC - Work packages` | EPCIC | WP2 – WP6 weights and weekly progress | Work Packages |
| `EPCIC - Milestones` | EPCIC | Key milestones (reference data, 48 rows for STTP2B) | Milestones |
| `EPCIC - Procurement packages` | EPCIC | LOA/PO register | Procurement Plan |
| `EPCIC - Expediting packages` | EPCIC | Expediting status and details | Vendor Overview |
| `Governance - Risks` | Governance (amber) | Risk register (inherent and residual likelihood/impact) | Risk register |
| `Governance - Interfaces` | Governance | Interface register | Interface register and matrix |
| `Governance - Interface points` | Governance | Points under each interface | Interface points |
| `Reports - Cut-off snapshots` | Reports (red) | One row per saved cut-off report | cut-off dropdown |
| `Reports - Snapshot data` | Reports | The report's datasets as JSON parts (40,000 characters per cell) | cut-off dropdown |
| `<Workspace> - <Module> - <Submodule>` | the module's workspace | Generated when a module is established (see below) | the module's page |

Row 1 of every sheet is the header; columns are matched **by header name**, so you may reorder columns or add your own. Text and date columns are formatted as plain text so Sheets never reinterprets a value (dates stay `YYYY-MM-DD`, a leading `=` is never evaluated).

### When a module is established

Switching a module on in Settings → Modules generates the sheet behind every enabled leaf below it (for example `EPCIC - T&I - Workpacks`) with a generic register template (`id, title, status, owner, due, notes, updatedAt`), and the link appears on the module's page (**Open sheet**) and in the Modules list. A module that is already on and has no sheet shows **Generate sheet**. The placeholder page lists the sheet's rows read-only; edit them in the spreadsheet and press Refresh. Parent modules and the Dashboard keep no sheet of their own.

## Deploy

### Fast path with clasp

```bash
pnpm build:sheets                        # writes apps/sheets/dist/Code.js and appsscript.json
cd apps/sheets/dist
npx @google/clasp login                  # needs the Apps Script API switched on at script.google.com/home/usersettings
npx @google/clasp create --type sheets --title "Project Flow STTP2B"   # creates the spreadsheet and its bound script
npx @google/clasp push
```

### By hand

1. Create a blank Google Sheet. **Extensions → Apps Script**.
2. Replace the editor's code with `dist/Code.js`. Open **Project Settings**, tick *Show appsscript.json*, and paste `dist/appsscript.json` (the time zone and scopes matter).
3. Reload the spreadsheet. A **Project Flow** menu appears.

### Then

1. **Project Flow → Set up sheets.** Authorise when asked. It creates the sheets, loads the STTP2B reference data and the four demo users, and generates an API token. Running it again changes nothing. A spreadsheet in the older single-project layout (sheets named `Project`, `Modules`, …) must be migrated first; see ADR 0004.
2. **Deploy → New deployment → Web app.** Execute as *Me*; who has access: *Anyone*. (`ANYONE_ANONYMOUS` is required because the browser calls it from another origin.) After changing the code, deploy a **new version** of the same deployment so the URL stays the same.
3. **Project Flow → Show API token** shows the web app URL and token. Put them in `apps/web/.env.sheets.local`:

   ```
   VITE_SHEETS_URL=https://script.google.com/macros/s/…/exec
   VITE_SHEETS_TOKEN=…
   ```
4. `pnpm dev:web-sheets`, or `pnpm --filter @projectflow/web build:sheets` and host `apps/web/dist` anywhere static.

### Pre-filled spreadsheet

`pnpm --filter @projectflow/sheets export-seed <dir>` writes every dataset sheet as JSON (`{sheet, header, types, rows}`), exactly what *Set up sheets* loads. That is how a ready-made spreadsheet can be filled without running Apps Script: create the sheets, load these rows, then add the Apps Script project to it and run *Set up sheets* (it leaves existing sheets and the loaded rows alone and only creates the API token).

## Try it without Google

```bash
pnpm dev:sheets-api      # local simulator on http://localhost:3200/exec, rows in memory
pnpm dev:web-sheets      # web client in sheets mode (reads .env.sheets.local)
```

`.env.sheets.local` already points at the simulator. The simulator uses the same router and service as the deployed script; only the storage is in memory, so data resets on restart.

## Protocol

Apps Script web apps accept only `doGet` and `doPost`, cannot answer a CORS preflight, and always return HTTP 200. So:

- `GET <exec>?path=/projects/sttp2b/procurement/packages?page=2&token=…&user=u-admin`
- `POST <exec>` with `Content-Type: text/plain` and body `{"method":"PUT","path":"/projects/sttp2b/modules/hse","body":{"state":"Enabled"},"token":"…","user":"u-admin"}`
- Response: `{"ok":true,"status":200,"data":…}` or `{"ok":false,"status":409,"error":{"code","message","issues?"}}`. The client turns the envelope back into the status and error the NestJS API would send.
- CSV exports come back as `{"csv","filename"}`; the client saves them as a file.

Routes, module guards and error codes match `apps/api` where it has them. The pre-build adds: `GET /directory` (names for the sign-in picker, no token user needed), `GET /me`, `/projects` CRUD with `POST /projects/:id/lifecycle` and `/projects/:id/members`, `/users` (administrators), `/projects/:id/milestones`, `/risks` (+ `/summary`), `/interfaces` (+ `/summary`, `/matrix`, `POST /:id/transition`), `/interface-points`, `POST /projects/:id/modules/:key/sheet` (generate a sheet) and `GET /projects/:id/modules/:key/records` (a module's sheet rows). Every route except `/health` and `/directory` needs `user`.

## Limits and risks

- **Access is a shared secret, not a login.** The web app must be public for a browser to call it, so anyone holding the URL and token can read and change the data. The token ends up in the built web app. The reference data contains vendor contracts and named staff (see `docs/ProjectFlow_reference_data.md`): keep the URL private, host the web build somewhere access-controlled, and treat this as a team pre-build only. Real identity arrives with the full server.
- **Concurrent writes** take the script lock (20 s wait), so they queue rather than collide. Editing the same row by hand in the sheet while the app writes it is last-write-wins.
- **Speed and quotas.** Each request reads whole sheets (≈ 150 rows each) and takes roughly one to two seconds; the dashboard reads several sheets. Apps Script daily quotas apply. This is fine for a handful of users, not for a site-wide rollout.
- **Edits made in the sheet** appear on the next request. Invalid values (text in a number column) read as blank.
- **Demo identity, not authentication.** The client names a user id and the backend believes it. Roles (administrator; Project Manager, Manager, Leader, Team Member, Client per project) are enforced so the permission model can be exercised, but anyone with the token can act as anyone. Four demo users are seeded: Admin, Manager, Team member, Client (all `@example.com`). See ADR 0004.
- **Several projects are supported.** Project sheets carry `projectId`; only STTP2B (with milestones) is seeded. A project created in the app starts empty with the default modules.
- **Not tested against live Google.** Automated tests cover the logic in memory, the spreadsheet layer against a fake of the Apps Script API, and the built `Code.js` in a sandbox that has only Apps Script style globals. A first real deployment can still surface differences (authorisation prompts, the `ANYONE_ANONYMOUS` redirect behaviour, quotas).

## Commands

```bash
pnpm --filter @projectflow/sheets test        # 76 tests
pnpm --filter @projectflow/sheets typecheck
pnpm --filter @projectflow/sheets build       # dist/Code.js (about 600 kB minified, mostly zod and the seed data)
```
