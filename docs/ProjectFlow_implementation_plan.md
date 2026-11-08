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
| Milestones (reference data) | PLAN-03 | Done, read-only | **Open** |
| Risk register, 5×5 matrix, heatmap | MGT-01, MGT-06 | Done | **Open** |
| Interface register, points, matrix, transition rules | INT-01…04 | Done | **Open** |
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

## 6. Verification

- `pnpm typecheck` and `pnpm test` at `app/` run all three workspaces: the sheets backend carries the API contract tests (61), the NestJS API its catalog tests, the web client its navigation tests.
- `pnpm build:sheets` rebuilds `apps/sheets/dist/Code.js`; its bundle test runs the built file in a Node context that has only Apps Script globals.
- The local simulator (`pnpm dev:sheets-api`) plus `pnpm dev:web-sheets` exercises the full UI without Google.
