# Project Flow — implementation plan

**Status date:** 8 November 2026 · **Governing spec:** [ProjectFlow_spec_final.md](ProjectFlow_spec_final.md) v1.4 · **Decisions:** [ADR 0001–0004](../app/docs/adr/)

This plan separates what exists today (a *pre-build* on Google Sheets plus a first NestJS slice) from the full application, and lists what has to happen for the full application to reach feature parity with the pre-build and then the spec's P1. Phases and exits follow spec §13; this plan adds no requirement.

## 1. Where things stand

| Layer | Location | State |
|---|---|---|
| Web client (React 19, Vite, TanStack Query/Table, ECharts) | `app/apps/web` | One client, two modes (`VITE_API_MODE=rest\|sheets`). Full feature set in `sheets` mode; reduced set in `rest` mode |
| Pre-build backend (Apps Script + Google Sheets) | `app/apps/sheets` | Multi-project, demo identity with roles, projects, users, modules, schedule, procurement, expediting, milestones, risks, interfaces, tasks. Local simulator for development |
| Target backend (NestJS, Drizzle, PostgreSQL/PGlite) | `app/apps/api` | First slice only: one seeded project, no users, module registry, schedule, procurement, expediting, tasks |
| Live data | Google spreadsheet (see `app/apps/sheets/README.md`) | Reference data loaded and verified; migrated to the worksheet layout of ADR 0004 |

### Feature status by backend

| Feature | Spec | Sheets pre-build | NestJS API |
|---|---|---|---|
| Module registry, states, change log | MOD-01…10, SET-06 | Done (per project) | Done (single project) |
| Module sheet generation and links | ADR 0003 | Done | n/a |
| Dashboard, Overall Progress, Work Packages | PLAN-01 | Done | Done |
| Procurement Plan, Expediting Vendor Overview | PROC, EXP | Done | Done |
| Procurement CRUD (plan, expediting) with drawer forms | PROC-04 | Done | **Open** (read-only) |
| Procurement dashboard, attention ranking | PROC-05 | Done | **Open** |
| Risks & Concerns register and summary | PROC-06 | Done (22 seeded) | **Open** |
| Logistics shipments, Materials weights and stock | PROC-07, PROC-08 | Done (193 shipments, 190 stock lines, 10 weight lines) | **Open** |
| Right-hand drawer modals | NAV-09 | Done | Done (web) |
| Personal tasks: list, card, kanban (drag and drop), gantt, sub-tasks, projects | TASK-13, TASK-14 | Done (owner-scoped) | Old board only (To do / In progress / Done) |
| Task Calendar (day/week/month) and Workload by project | TASK-15 | Done | **Open** |
| Cut-off reports (snapshots) and read-only historical view | NAV-03, NAV-07 | Done (stored as chunked JSON in two sheets) | **Open** |
| Construction budget (WBS manhours, histogram, WBS import) | CON-05 to CON-07 | Done; no budget data loaded yet | **Open** |
| General Knowledge (nine areas, articles, sources) | KNW-01 to KNW-04 | Done; 4 starter articles | **Open** |
| Projects: list, select, create, edit, lifecycle, delete rules | PRJ-01, 03, 07, SET-07 | Done | **Open** |
| Project members and project roles | §2.1, PRJ-07 | Done (5 roles) | **Open** |
| Users and account states (admin mode) | SET-08, AUTH-02 | Done (no passwords) | **Open** |
| Milestones (reference data) | PLAN-03 | Sheets-backed create, edit and guarded delete; linked risks and interfaces block deletion | **Open** |
| Risk register on the project matrix (sheet data, 4×4 for STTP2B), per-impact pre/post ratings, RBS, actions, heatmap, insights | MGT-01, MGT-06 | Done (90 seeded, 16-cell matrix, 37 RBS) | **Open** |
| Interface points (Open→Responded→Resolved→Closed), interface register (INT-04 workflow), party×party, responsibility and RASCI matrices, insights | INT-01…04 | Done (34 points, 425 responsibility cells, 340 RASCI cells seeded) | **Open** |
| Authentication, sessions, invitations | AUTH-01…, §2 | Demo identity only | **Open** |
| Level/person access matrices, restricted domains | §2.6 | Not started | **Open** |
| Audit log beyond module changes | AUD | Module and nothing else | Module and nothing else |
| Documents, notifications, jobs, file storage | DOC, NOT | Not started | Not started |

## 2. Pre-build limits, to be clear about

- **No authentication.** The user id is chosen at a sign-in screen and trusted. Anyone with the web app and token can act as any user, including an administrator. The API token is shipped inside the built web client. Keep the app URL and the spreadsheet private. This exists to exercise roles and workflows, not to protect data.
- **Single spreadsheet, locks.** One script lock serialises writes; throughput is low and each request reads whole sheets. Fine for tens of users and a few thousand rows per sheet.
- **Derived values are computed per request** (risk levels, overdue flags, milestone status, matrix) against the project cut-off.
- **Role model is a subset** of §2.1: administrator plus five project roles. No levels, positions, restricted domains or client publication.
- **Manual edits in the sheet bypass validation.** Bad cells read back as blank; ids typed by hand can collide.

## 3. Parity backlog for the NestJS API

Work in this order; each item ships with the same test cases as `apps/sheets/test/api.spec.ts` so both backends stay route-compatible (ADR 0003).

1. **Identity and membership schema**: `users`, `project_members`, `projects` widening (short name, client, location, lifecycle, timestamps). Replace the demo `user` parameter with a session/JWT principal behind the same `actor` shape.
2. **Project and user routes**: `/me`, `/directory`, `/projects` CRUD, `/projects/:id/lifecycle`, `/projects/:id/members`, `/users`. Port the guard rules (last Project Manager, last administrator, delete only empty Draft, reason to restore).
3. **Project scoping**: add `project_id` to schedule, procurement, expediting, tasks (owner) and enforce membership in a Nest guard instead of the per-route access levels used in `router.ts`.
4. **Registers**: tables for milestones, risks, interfaces, interface points; move scoring (`risk-matrix.ts`) and the interface state machine (`interface-flow.ts`) into a shared package so the two backends cannot drift. The catalog and progress maths are already shared by relative import.
5. **Personal tasks**: new task schema (task number, urgency, assigner, projects, plan dates, effort, remarks), sub-tasks table, derived overdue and the `/tasks/workload` route; move the workload and date helpers (`tasks-service.ts`) into a shared package with the sheets backend.
6. **Cut-off snapshots**: a `snapshots` table with one row per report and the datasets copied as JSONB (or a versioned copy of the report tables), the `?asOf=` read parameter and the read-only guard; replaces the 40,000-character cell chunks used in the sheets.
7. **Budget and knowledge tables**: `wbs_budget` (project, code, parent, hours, dates), `knowledge_articles` with sources as JSONB, and full-text search in PostgreSQL instead of the in-memory search used on sheets; the histogram arithmetic moves with `budget-service.ts`.
8. **Loader for milestones** from the Key Milestones workbook (currently a one-off extract in `sttp2b.json`).
9. **Web client**: in `rest` mode, enable sign-in, Projects and Users once steps 1–2 land; remove the sheets-only gating in `nav.ts` and `App.tsx`.
10. **Cutover**: load the spreadsheet into PostgreSQL (column names equal API field names), switch `VITE_API_MODE=rest`, retire `apps/sheets` or keep it as an export format.

## 4. Roadmap against the spec

| Phase | Scope (spec §13) | Pre-build contribution | Remaining |
|---|---|---|---|
| P0 Foundation (weeks 1–8) | Schema, context/membership, module registry, workflows/audit, test skeleton | Registry, project context, membership prototype | Real auth, tenant isolation proof, audit service, deployment skeleton, recovery approach |
| P1 Project controls (9–34) | Project Master, personnel, access, Tasks, Document Control, Dashboard, Engineering, Procurement, Planning, Management, Interfaces, Events, MoM, reports | Project Master (basic), Dashboard, Planning, Procurement, Expediting, Risks, Interfaces, Milestones, Tasks | Setup wizard, personnel levels/positions, level/person access, Document Control, Engineering, Issues/Lessons/MOC/Stakeholders, Events, MoM, reports, client publication, reminders |
| P2 Yard execution (35–52) | Logistics, Materials, Construction, Fabrication, QAQC, HSE, Systems | None | All |
| P3 Handover and offshore (53–68) | Handover, T&I, HUC | None | All |

The 68-week envelope is not re-estimated here (spec revision 1.2 note).

## 5. Next steps, in priority order

0. **Load real content.** No construction manhour budget and no knowledge source documents exist in `data/` yet. Supply the budget WBS (a spreadsheet with WBS, activity, parent, discipline, manhours, start and finish pastes straight into Import WBS) and decide who writes the knowledge articles for the areas that are still empty.


1. Confirm the role names and the two Governance screens with the project team using the pre-build (demo identities: administrator, manager, team member, client).
2. Decide whether separate spreadsheet files per workspace are still wanted (ADR 0004 reads the request as sheet grouping inside one file).
3. Start parity items 1–3 in §3; they unblock everything else on the NestJS side.
4. Extract the remaining workbooks listed as "Not extracted" in the [reference data note](ProjectFlow_reference_data.md) (Logistics, Materials) as P2 datasets are scheduled.
5. Replace the demo identity before any real data or external user touches the pre-build.
6. Finish the Lintel UI rollout on branch `try-new-UI` (rules in [ADR 0006](../app/docs/adr/0006-lintel-design-and-layout-rules.md)): check every page at 1440, 1024 and 375 px in light and dark, move any page-level spacing onto the `--gap` / `--card-px` / `--card-py` tokens, then merge. Every new page follows the ADR's checklist.

7. Profiles and party access (sheets pre-build): header profile menu (profile, switch user type, sign out), `/profile` page (name, title, company, email, password), Settings → Users with title, company and party, and Settings → Party access (module × Contractor / Client / Subcontractor). Hidden screens leave the menu and the API refuses them (`NOT_FOR_YOUR_PARTY`). Still to do: real sign-in that uses the stored password hash, and the same on the NestJS API.

8. Branding and installable app: logo and icon set from the supplied artwork in `apps/web/public` (favicon, 192/512, maskable, Apple touch, Open Graph card), full meta in `index.html`, `manifest.webmanifest`, a service worker (`sw.js`, app shell only, data never cached) and an Install button (header and Settings → General; Safari on iPhone shows the Add to Home Screen steps). Settings → Data sources links the exact Google Sheet from `VITE_SPREADSHEET_URL`.

9. Schedule and Progress per facility (Planning & Progress → Schedule, Progress): CGF Topside, CGF Jacket, Pile & Conductor, Bridge and LQM#2 each have weekly S-curves (plan, forecast, actual; overall and by phase where the facility workbook has them), a WBS schedule from Primavera with progress at the cut-off, and their key milestones. DSF is listed as later. Data comes from `app/apps/api/scripts/extract_facility_progress.py` into the `facilityProgress` key of `sttp2b.json` (cut-off 30 Oct 2026). Still to do: CGF Topside all-phase curve (its workbook table is incomplete), DSF, a forecast for the all-phase curves, and the same on the NestJS API.

10. Schedule, CPN, milestones and 13 November cut-off (Planning & Progress): **Schedule** is now one timeline of all facilities (planned span filled by progress, the CGF Topsides working-schedule span, key milestones as diamonds) in place of the per-facility milestone list. **Critical Path Network** (`planning.cpn`, new page) shows the CPN progress by work package beside the baseline plan, the CPN S-curve, a key-milestone network per facility and the CGF Topsides activities with 7 days of float or less against the baseline finish. The CGF Topsides S-curve is checked against the working schedule (`Final Wk SCH 7Nov26.xlsx`): two dashed lines and a card compare the plan with the progress the baseline and working dates imply. Key Milestones are now Rev 1 (50 key dates with the facility and the subcontractor date, plus 31 equipment installation dates with ETA, kind "Equipment"). Progress, phases and work packages come from the standard 13 Nov 2026 report in `Schedule Progress/Progress` (the CPN variant in `CPN` is used only for the CPN page, its weights differ: overall 29.3% against 10.0% on the CPN basis). CGF Topsides and LQM#2 now carry overall, engineering, procurement, construction and pre-com & commissioning curves from their work packages (WP2, WP4) of that report, and the construction workbook of 13 Nov feeds the construction curves; scopes are listed in that order everywhere. New extractor `apps/api/seed/extract_schedule.py` (milestones, working schedule, CPN); `extract_progress.py` now picks the newest report from the Progress and CPN folders. Not refreshed: the CGF Jacket and Bridge overall, engineering and procurement curves, which still come from their own 30 Oct workbooks (not issued again; WP3 of the report covers jacket, bridge, pile and conductor together). Open: the workbooks hold no precedence links, so the CPN network is a milestone chain and float is derived from dates; NestJS parity for the new endpoints (`facility-timeline`, `cpn`); the live sheet needs a re-seed to pick up Rev 1 and the new sheets.

## 6. Verification

- `pnpm typecheck` and `pnpm test` at `app/` run all three workspaces: the sheets backend carries the API contract tests (61), the NestJS API its catalog tests, the web client its navigation tests.
- `pnpm build:sheets` rebuilds `apps/sheets/dist/Code.js`; its bundle test runs the built file in a Node context that has only Apps Script globals.
- The local simulator (`pnpm dev:sheets-api`) plus `pnpm dev:web-sheets` exercises the full UI without Google.
