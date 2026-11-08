# 0004 — Projects, users, registers and worksheet areas in the pre-build

Status: accepted (pre-build only). Extends [0003](0003-prebuild-on-google-sheets.md). The NestJS API remains the target backend and does not yet have these features (see the [implementation plan](../../../docs/ProjectFlow_implementation_plan.md)).

## Context

The pre-build served one hard-wired project to one anonymous user. The team now needs to create and select projects, manage user accounts (administrators only), keep each workspace's data apart in the spreadsheet, run the first Governance modules (Risk, Interface) and see milestones.

## Decisions

- **Multi-project from the data model up.** Every sheet that holds project records starts with a `projectId` column; routes are `/projects/:pid/...`. Reads and writes are always scoped to one project, and update/delete match on `(projectId, id)` so ids such as `RSK-001` can repeat across projects. Cross-project leakage is covered by tests.
- **Demo identity, real roles.** There is no authentication. The client sends a user id (`?user=` on GET, `user` in the POST body) chosen at a sign-in screen, and the backend trusts it behind the shared token. Roles are still enforced so the permission model can be exercised: organization administrator (flag on the user), and per project *Project Manager, Manager, Leader, Team Member, Client* (a subset of spec §2.1). Client is read-only; Project Manager and Manager may delete records; configuring a project (modules, members) needs an administrator or that project's Project Manager. An administrator who is not a member gets no business data (spec §2.1). Replace this with the authentication service before any real use; the identity is **not** a security boundary.
- **Projects.** Lifecycle Draft → Setup → Active → On hold → Closing → Archived with a transition table; restoring from Archived needs a reason; delete only for an empty Draft project; the creator becomes Project Manager; the last Project Manager and the last active administrator cannot be removed.
- **Users** live in `Settings - Users`, memberships in `Settings - Memberships`. Account states follow AUTH-02 minus the pending states.
- **Worksheets grouped by area.** Sheets are named `<Area> - <dataset>` and created in area order with a tab colour: Settings (grey), Personal (teal), EPCIC (indigo), Governance (amber), Reports (red). Module sheets generated on demand use the module's workspace as the area. *Interpretation:* "separate the worksheets for each workspace and general settings" was read as grouping inside the one spreadsheet, because the Apps Script web app is bound to a single spreadsheet, one token and one deployment. Separate files per workspace would need several scripts or cross-file access and was rejected for the pre-build; the naming and colours give the same separation. If separate files are wanted, only `datasets.ts` and the store would change.
- **Registers.** Risks, Interfaces and Interface points are dedicated datasets. Scores, levels, overdue flags and the interface party matrix are derived at read time, never stored, so a changed matrix or cut-off needs no data migration. Risk matrix v1 is 5×5. Interface status changes only through a transition endpoint (spec API-01); open points block closure.
- **Milestones are reference data** loaded from the Key Milestones workbook into `EPCIC - Milestones` (48 rows), read-only in the app; status is derived from the project's reporting cut-off.
- **Migration.** The live spreadsheet created under 0003 was migrated in place: sheets renamed, `projectId` inserted, Projects widened, Users/Memberships/Milestones/Risks/Interfaces/Interface points added.

## Addendum: personal Task Management (8 November 2026)

- **One task set, many views.** `Personal - Tasks` holds the user's tasks (owner-scoped) and `Personal - Subtasks` their checklist items (replaced as a whole on every task save). The page key stays `task-management.board` so existing module states survive; its label is now *Tasks*. Calendar and Workload are derived views with no sheet of their own.
- **Statuses.** The request lists Backlog, Planned, Ongoing, Completed for the board and Backlog, Ongoing, Completed, Overdue for the field. Reconciled as four stored statuses plus a derived Overdue (deadline passed, not Completed). Overdue is computed against the browser's local date, passed as `today`.
- **Projects on a personal task** are stored as a comma-separated list of project ids and may only name projects the user belongs to; ids of deleted projects are dropped on read.
- **Task number** is `TSK-0001`, global and sequential, so it stays unique if tasks are ever shared between users.
- **Workload** attributes a task to the period of its deadline (else plan finish, else plan start) and counts a multi-project task in each project but once in the period total. Effort is not split across projects; that rule can change without a data migration.
- **Gantt** shows only tasks with plan start, plan finish and a deadline, as requested, and reports how many are hidden.

## Addendum: cut-off reports (8 November 2026)

- **A report is a stored copy.** `Reports - Cut-off snapshots` has one row per project and cut-off date (who saved it, a note, the row count). `Reports - Snapshot data` holds the copied datasets as JSON, cut into parts of at most 40,000 characters because a spreadsheet cell holds 50,000. Saving over a date needs `replace: true`.
- **Reading a report** is `?asOf=<date>` on any project data route. The router loads the snapshot once and `Service.atSnapshot` makes `rows()` and `project()` answer from it for the duration of that synchronous request, so every existing view, summary and CSV works unchanged, and derived statuses use the report's date as the cut-off. Writes with `asOf` are refused (`READ_ONLY_SNAPSHOT`); the web client also blocks them and turns off every create/edit control while a report is open.
- **Not in a report:** modules and their states, members, personal tasks and Settings. A report therefore shows the data of that date under today's module switches.
- **Cost.** Opening a report reads the whole snapshot sheet, so it slows as weeks accumulate (about 110 KB per report today). Acceptable for the pre-build; the full application stores reports in the database.
- **Friday** is a default and a shortcut, not a rule: any date up to tomorrow can be used.

## Addendum: construction budget and General Knowledge (8 November 2026)

- **Budget** is `EPCIC - Construction budget`: one row per WBS code with a parent code, so the WBS is a tree and parents roll up their children. Only rows at the bottom carry hours, which keeps totals from counting the same hours twice. The histogram is computed at read time by spreading each activity evenly over its calendar days, so changing dates or hours needs no recomputation or migration. The budget is included in cut-off reports.
- **No invented numbers.** There is no construction budget in `data/`, so the sheet starts empty. A pasted-WBS import (header row, then rows; checked as a whole) is the way to load it.
- **General Knowledge** lives in the Reports workspace as `knowledge`, with one submodule per area (`knowledge.engineering`, `.procurement`, `.services`, `.quality`, `.hse`, `.construction`, `.precom`, `.ti`, `.huc`) and an Overview. All share one sheet, `Reports - Knowledge`; the area is a column. Topics per area are fixed in code and returned by the API, so the web client carries no second copy.
- **Seed articles are derived, not written.** Four starter articles are generated from the loaded milestone dates and the documented status rules of the procurement registers, each listing that workbook as its source. They can be edited or deleted.
- **Why Reports.** Knowledge is read-mostly reference, closest to Documents and Periodic Reports. The workspace can change without touching the data.

## Addendum: procurement registers and right-hand drawers (8 November 2026)

- **Four new sheets** hold the procurement data from `data/EPCIC/Procurement`: `EPCIC - Logistics shipments`, `EPCIC - Material balance`, `EPCIC - Material summary` and `EPCIC - Procurement concerns`. The procurement packages sheet gains work package, contract type and weight columns. They are project datasets, so they carry `projectId`, appear in cut-off reports and are covered by the module guards of Procurement.
- **CRUD is generic.** `apps/sheets/src/crud.ts` defines `Resource`: list with filters and a text search, CSV, get, create (ids `PREFIX-NNN`), update that merges onto the stored row, and delete for roles that manage. Each register is a few lines of definition (`procurement-ops.ts`) with a zod schema; writes need the write role and are refused while a cut-off report is open.
- **Derived, not stored.** Shipment overdue, concern overdue and age, package status and the dashboard's attention score are computed at read time against the project's cut-off, so they follow a report's date like every other derived status.
- **Concerns are seeded, then owned by people.** 22 rows are generated from the expediting highlights and logistics notes (source and reference recorded); everything after that is entered in the app.
- **Loading a live spreadsheet is a data step.** The new sheets are created by *Set up sheets* with their headers. Their rows come from `sttp2b.json`; for a deployed script that is the seed, and for the live file used in development they were written once with the Sheets API from the same extraction. Re-running `extract_procurement.py` changes the seed only, not a sheet that already has rows.
- **S-curves are compact on purpose.** `EPCIC - Procurement S-curves` has one row per facility and scope; plan, forecast and actual are each one cell of comma-separated percentages (about 900 characters) and `start` is the first Friday. That keeps 17 curves of 144 weeks in 17 rows instead of 7,000, and stays under the 50,000-character cell limit. The actual series is shorter than plan because it stops at the cut-off. The sheet is not part of cut-off reports.
- **Drawers.** Detail and edit modals are a right-hand drawer on all screen sizes (the earlier centred overlay was a misreading of the request). One `Modal` component supplies it, with small, medium and large widths.

## Consequences

- The web client has two modes. Projects and Users settings, project switching, sign-in and the new registers exist only in `sheets` mode; in `rest` mode (NestJS) the new screens fall back to a placeholder and the Settings pages are hidden until the API catches up.
- The module catalog is shared, so `Available` now includes milestones, risks and the interface screens even when the NestJS backend serves them as placeholders.
- A spreadsheet without `projectId` (the 0003 layout) is not readable by this code; use the migration, or re-run *Set up sheets* on an empty file.
- Because the reporting cut-off is a per-project field, changing it moves every derived status for that project at once.
