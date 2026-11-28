# Shared router and services (`@projectflow/sheets`)

The Project Flow router, services and in-memory store. **Supabase is the only backend**: the data lives in PostgreSQL (schema `projectflow_v2`) and is served by the Supabase edge function (`apps/api-v2/src/edge-v3.ts`) or by API v2 (`apps/api-v2/src/server.ts`). Both import this package, load the stored datasets into a `MemoryStore` for each request, run the route, and write back what changed. The Google Sheet and Apps Script this package was first built on are gone.

```
React web (static)  --POST-->  Supabase edge function  --SQL-->  PostgreSQL (projectflow_v2)
                               router + services from apps/sheets
```

The package is still called `sheets` and the datasets are still called sheets (`Governance - Issues`): the names are historic and are stored that way in the database. `router.ts` and `service.ts` reuse the module catalog and progress rules from `apps/api`, so both backends apply the same module rules.

The **local simulator** (`src/local-server.ts`, `pnpm dev:sheets-api`, port 3200) is kept for developing the AI functions (`src/ai.ts`): it serves the same router with seeded rows in memory, reset on every restart, and reads the OpenAI key from the git-ignored `.env.local`. It is not a second backend and nothing it holds survives a restart.

## Datasets

Datasets are named `<Area> - <dataset>`, so each workspace's data stays together (ADR 0004). Sheets that hold project records start with a `projectId` column; one file can serve several projects.

| Dataset | Area | Holds | Read by |
|---|---|---|---|
| `Settings - Projects` | Settings | Projects: code, name, client, location, lifecycle, reporting cut-off | Settings → Projects, all |
| `Settings - Users` | Settings | User accounts: name, email, administrator flag, account state | Settings → Users, sign-in |
| `Settings - Memberships` | Settings | Who holds which role in which project | access control |
| `Settings - Modules` | Settings | State of every module per project, with its breadcrumb path | module registry |
| `Settings - Module changes` | Settings | Log of every module state change: who, when, from, to, why | Settings |
| `Personal - Tasks` | Personal | Personal tasks: number, urgency, assigner, projects, plan dates, due, status, effort, remarks; owned by one user | Task Management |
| `Personal - Subtasks` | Personal | Checklist items of each task | Task Management |
| `EPCIC - S-curve` | EPCIC | Monthly plan / forecast / actual | Overall Progress |
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
| `EPCIC - Facility equipment` | EPCIC | Large equipment of the 3D model, one row per tag: name, deck, package, vendor, ROS, ETA, status, installation method (Lift by Crane / Skidding), remarks, comments, source (111 seeded from the expediting report). Added, edited and deleted in the app | Construction → Facility Layout |
| `Governance - Issues` | Governance | Issues with persons in charge (emails), priority, status, dates (38 from the task monitor) | Issues |
| `Governance - Issue sub-tasks` | Governance | Steps of each issue with a PIC and due date | Issues |
| `Governance - Issue log` | Governance | History of every change and reminder | Issues |
| `Governance - Risks` | Governance | Risk register: RBS, status, probability and four impacts before and after mitigation, response (90 seeded) | Risk register |
| `Governance - Risk actions` | Governance | Mitigation actions per risk with owner, due and done dates (split from the seeded mitigation lines) | Risk drawer |
| `Governance - Risk matrix` | Governance | The project's probability × severity cells and their level (4×4 for STTP2B); edit to change the matrix | Risk register, heatmap |
| `Governance - Risk breakdown` | Governance | Risk breakdown structure: category and discipline codes (37) | Risk register |
| `Governance - Interfaces` | Governance | Interface register | Interface register and matrix |
| `Governance - Interface points` | Governance | Interface points: originator → target query, dates, resolution (34 seeded) | Interface points, matrix |
| `Governance - Interface point revisions` | Governance | Earlier revisions of an interface point (request, response, dates), kept as superseded when the requestor revises it | Interface points |
| `Governance - Interface parties` | Governance | Party codes and names (24) | Interface pages |
| `Governance - Responsibility matrix` | Governance | Activity × facility → responsible party (425 cells) | Interface matrix |
| `Governance - RASCI` | Governance | RASCI role per activity and party/phase (340 cells) | Interface matrix |
| `Reports - Knowledge` | Reports | General Knowledge articles, all areas | General Knowledge |
| `Reports - Cut-off snapshots` | Reports | One row per saved cut-off report | cut-off dropdown |
| `Reports - Snapshot data` | Reports | The report's datasets as JSON parts (40,000 characters per part) | cut-off dropdown |
| `<Workspace> - <Module> - <Submodule>` | the module's workspace | Generated when a module is established (see below) | the module's page |

Each dataset stores a header (its column keys) and rows; columns are matched **by key**, and a column added to the code is added to an existing dataset the next time it is written (`addMissingColumns`), without touching its rows. Dates stay `YYYY-MM-DD` text.

### When a module is established

Switching a module on in Settings → Modules creates the dataset behind every enabled leaf below it (for example `EPCIC - T&I - Workpacks`) with a generic register template (`id, title, status, owner, due, notes, updatedAt`). A module with no screen of its own shows those rows read-only on its placeholder page. There is no route to create one on request.

## Run the simulator

```bash
pnpm dev:sheets-api      # http://localhost:3200/exec, rows in memory (reset on restart)
```

Put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in `apps/sheets/.env.local`, which is git-ignored, to try the AI helpers. Point the web app at it with `pnpm --filter @projectflow/web dev:sim` (reads `.env.sim`). On Supabase the same key and model are secrets of the edge function.

## Protocol

The web app sends every request as `POST <api>` with `Content-Type: text/plain` (no CORS preflight) and a JSON body, and the host always answers HTTP 200 with an envelope:

- `POST` body `{"method":"PUT","path":"/projects/sttp2b/modules/hse","body":{"state":"Enabled"},"user":"u-admin","session":"…"}`
- Batches: `{"method":"BATCH","requests":[{"method":"GET","path":"…"}, …]}` answer with one envelope each (up to 20).
- Response: `{"ok":true,"status":200,"data":…}` or `{"ok":false,"status":409,"error":{"code","message","issues?"}}`. The client turns the envelope back into the status and error the NestJS API would send.
- CSV exports come back as `{"csv","filename"}`; the client saves them as a file.

Routes, module guards and error codes match `apps/api` where it has them; the router adds the routes the NestJS API does not have (directory, me, projects and members, users, issues, risks, interfaces, procurement, facilities, budget, knowledge, snapshots, AI). Read `src/router.ts` for the list. Health: `GET /health` answers `{status, database, api}`.

## Limits and risks

- **Access is a stated user or a signed session.** With `SESSION_SECRET` set on the host, sign-in with a password is required and a stated user is ignored; without it the host trusts the user id the client names (demo mode). Roles (administrator; Project Manager, Manager, Leader, Team Member, Client per project) are enforced either way. See ADR 0004.
- **Concurrent writes** are serialised by a database write lock, so they queue rather than collide.
- **Speed.** Each request loads the stored datasets into memory (cached by dataset version on API v2). Fine for a project team, not for a site-wide rollout.
- **Several projects are supported.** Project datasets carry `projectId`; only STTP2B is seeded. A project created in the app starts empty with the default modules.
- **No e-mail or schedule yet.** Issue assignments and the daily reminder (`remindAll`) need a mail service and a scheduled trigger that Supabase does not have set up; the reminder routes answer `NOT_AVAILABLE` on the hosts.

## Commands

```bash
pnpm --filter @projectflow/sheets test
pnpm --filter @projectflow/sheets typecheck
pnpm --filter @projectflow/sheets sheet-catalog   # Markdown table of every dataset, to keep docs/ProjectFlow_prebuild_database.md in step
```
