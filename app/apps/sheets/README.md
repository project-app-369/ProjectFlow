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
| `EPCIC - Procurement packages` | EPCIC | LOA/PO register (plus work package, contract type, weight in progress) | Procurement Plan |
| `EPCIC - Expediting packages` | EPCIC | Expediting status and details | Vendor Overview |
| `EPCIC - Logistics shipments` | EPCIC | Shipments from vendor to yard: dates, status, weight, vessel, B/L, yard, issue note (193 rows for STTP2B) | Logistics |
| `EPCIC - Material balance` | EPCIC | Stock lines on hand: code, heat no., MRIR, balance, yard, status (190 rows) | Materials |
| `EPCIC - Material summary` | EPCIC | Needed / arrived / on-yard weight per facility and supply (10 rows) | Materials, Procurement dashboard |
| `EPCIC - Procurement S-curves` | EPCIC | Weekly cumulative plan, forecast and actual per facility and LS / PS / overall, as comma-separated percentages from a start date (17 rows) | Procurement dashboard |
| `EPCIC - Procurement concerns` | EPCIC | Risks, concerns and issues per package with severity, owner, action (22 seeded from expediting and logistics) | Risks & Concerns, Procurement dashboard |
| `EPCIC - Construction budget` | EPCIC | WBS rows with parent, discipline, manhours, plan start and finish | Construction → Budget |
| `EPCIC - Facility equipment` | EPCIC | Large equipment of the 3D model, one row per tag: name, deck, package, vendor, ROS, ETA, status, installation method (Lift by Crane / Skidding), remarks, comments, source (111 seeded from the expediting report). Added, edited and deleted in the app (and in the sheet, if you keep the Sheets backend) | Construction → Facility Layout |
| `Governance - Issues` | Governance | Issues with persons in charge (emails), priority, status, dates (38 from the task monitor) | Issues |
| `Governance - Issue sub-tasks` | Governance | Steps of each issue with a PIC and due date | Issues |
| `Governance - Issue log` | Governance | History of every change and reminder | Issues |
| `Governance - Risks` | Governance (amber) | Risk register: RBS, status, probability and four impacts before and after mitigation, response (90 seeded) | Risk register |
| `Governance - Risk actions` | Governance | Mitigation actions per risk with owner, due and done dates (split from the seeded mitigation lines) | Risk drawer |
| `Governance - Risk matrix` | Governance | The project's probability × severity cells and their level (4×4 for STTP2B); edit to change the matrix | Risk register, heatmap |
| `Governance - Risk breakdown` | Governance | Risk breakdown structure: category and discipline codes (37) | Risk register |
| `Governance - Interfaces` | Governance | Interface register | Interface register and matrix |
| `Governance - Interface points` | Governance | Interface points: originator → target query, dates, resolution (34 seeded) | Interface points, matrix |
| `Governance - Interface parties` | Governance | Party codes and names (24) | Interface pages |
| `Governance - Responsibility matrix` | Governance | Activity × facility → responsible party (425 cells) | Interface matrix |
| `Governance - RASCI` | Governance | RASCI role per activity and party/phase (340 cells) | Interface matrix |
| `Reports - Knowledge` | Reports (red) | General Knowledge articles, all areas | General Knowledge |
| `Reports - Cut-off snapshots` | Reports (red) | One row per saved cut-off report | cut-off dropdown |
| `Reports - Snapshot data` | Reports | The report's datasets as JSON parts (40,000 characters per cell) | cut-off dropdown |
| `<Workspace> - <Module> - <Submodule>` | the module's workspace | Generated when a module is established (see below) | the module's page |

Row 1 of every sheet is the header; columns are matched **by header name**, so you may reorder columns or add your own. Text and date columns are formatted as plain text so Sheets never reinterprets a value (dates stay `YYYY-MM-DD`, a leading `=` is never evaluated).

### When a module is established

Switching a module on in Settings → Modules generates the sheet behind every enabled leaf below it (for example `EPCIC - T&I - Workpacks`) with a generic register template (`id, title, status, owner, due, notes, updatedAt`), and the link appears on the module's page (**Open sheet**) and in the Modules list. A module that is already on and has no sheet shows **Generate sheet**. The placeholder page lists the sheet's rows read-only; edit them in the spreadsheet and press Refresh. Parent modules and the Dashboard keep no sheet of their own.

## Deploy

### Existing Project Flow spreadsheet

The live [Project Flow — STTP2B data (pre-build)](https://docs.google.com/spreadsheets/d/1CTkxAb2HEhjLEIoz0EAQHN1qm4VF4Sg6mwoorClnKQY/edit) already has the dataset tabs. Its bound [Project Flow API Apps Script project](https://script.google.com/u/0/home/projects/1_kxZYQk9dzl1-b0HBHL4xitd2K_qYfS5E23Sued3W6uxMFyPG9cFW20P/edit) contains the generated `Code.js` and manifest. The manifest limits spreadsheet access to this bound spreadsheet. Setup has preserved the existing data and created a script property token. The [version 1 web app](https://script.google.com/macros/s/AKfycbzVp11yLpxjz_gwhm4Q9mhmTnNWe9h9NpaO6nzzfqD7PY58jCjjMNgj8dutl4k47s_H/exec) runs as the Sheet owner with `Anyone` access; data routes require the token. The owner-private [Project Flow v1 Site](https://project-flow-v1.ptsc-7423.chatgpt.site/) holds `SHEETS_URL` and `SHEETS_TOKEN` in its server runtime and proxies `/exec`. Never put the token in a browser build.

### Fast path with clasp

```bash
pnpm build:sheets                        # writes apps/sheets/dist/Code.js, seed.html and appsscript.json
cd apps/sheets/dist
npx @google/clasp login                  # needs the Apps Script API switched on at script.google.com/home/usersettings
npx @google/clasp create --type sheets --title "Project Flow STTP2B"   # creates the spreadsheet and its bound script
npx @google/clasp push
```

### By hand

1. Create a blank Google Sheet. **Extensions → Apps Script**.
2. Replace the editor's code with `dist/Code.js`, and add an HTML file named `seed` (the + next to Files → HTML) containing `dist/seed.html`. The data is not in the code: the script reads it from `seed` only when *Set up sheets* runs, and every other request reads the spreadsheet alone. Open **Project Settings**, tick *Show appsscript.json*, and paste `dist/appsscript.json` (the time zone and scopes matter).
3. Reload the spreadsheet. A **Project Flow** menu appears.

### Then

1. **Project Flow → Set up sheets.** Authorise when asked. It creates the sheets, loads the STTP2B reference data and the four demo users, and generates an API token. Running it again changes nothing, apart from one-off upgrades a new version brings (missing columns, new sheets and their reference data); existing rows are never overwritten. An administrator can run the same setup over the API without opening the spreadsheet: `POST {"method":"POST","path":"/admin/setup","token":"…","user":"<admin user id>"}` returns the sheet list, or the error if setup fails. A spreadsheet in the older single-project layout (sheets named `Project`, `Modules`, …) must be migrated first; see ADR 0004.
2. **Deploy → New deployment → Web app.** Execute as *Me*; who has access: *Anyone*. (`ANYONE_ANONYMOUS` lets the private Site's server reach the web app.) After changing the code, deploy a **new version** of the same deployment so the URL stays the same.
3. **Project Flow → Show API token** shows the web app URL and token. For the private Site, set `SHEETS_URL` and secret `SHEETS_TOKEN` as server runtime variables. For a trusted local browser build only, put them in `apps/web/.env.sheets.local`:

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

- **Access is a shared secret, not a login.** Anyone holding the URL and token can read and change the data. The deployed Site keeps the token server-side and limits Site access to its owner. A separately built browser client that embeds `VITE_SHEETS_TOKEN` exposes that token to its viewers; use it only in a trusted environment. The reference data contains vendor contracts and named staff (see `docs/ProjectFlow_reference_data.md`). Real identity arrives with the full server.
- **Concurrent writes** take the script lock (20 s wait), so they queue rather than collide. Editing the same row by hand in the sheet while the app writes it is last-write-wins.
- **Speed and quotas.** Each request reads whole sheets (≈ 150 rows each) and takes roughly one to two seconds; the dashboard reads several sheets. Apps Script daily quotas apply. This is fine for a handful of users, not for a site-wide rollout.
- **Edits made in the sheet** appear on the next request. Invalid values (text in a number column) read as blank.
- **Demo identity, not authentication.** The client names a user id and the backend believes it. Roles (administrator; Project Manager, Manager, Leader, Team Member, Client per project) are enforced so the permission model can be exercised, but anyone with the token can act as anyone. Four demo users are seeded: Admin, Manager, Team member, Client (all `@example.com`). See ADR 0004.
- **Several projects are supported.** Project sheets carry `projectId`; only STTP2B (with milestones) is seeded. A project created in the app starts empty with the default modules.
- **Live deployment verified for reads.** The deployed web app returned `UNAUTHORIZED` without a token, and the published Site loaded the STTP2B dashboard from the Sheet. Automated tests cover the logic in memory, the spreadsheet layer against a fake of the Apps Script API, and the built `Code.js` in a sandbox that has only Apps Script style globals. Live write routes and quota behavior have not been exercised.

## Commands

```bash
pnpm --filter @projectflow/sheets test        # 101 tests
pnpm --filter @projectflow/sheets typecheck
pnpm --filter @projectflow/sheets build       # dist/Code.js (about 600 kB minified) and dist/seed.html (the reference data, read only by Set up sheets)
```

## Issue reminders

The script emails persons in charge (assignments, and a daily reminder of what is due within 3 days or overdue). After deploying, choose **Project Flow → Turn on daily issue reminders** once. The manifest asks for two extra permissions, send email and manage triggers, so Google shows an authorisation prompt after the next deploy. See `docs/ProjectFlow_prebuild_database.md` §4.3.
