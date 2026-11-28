# Project Flow — database (Supabase)

**Version:** 2.0 · **Date:** 28 November 2026 · **Project:** STTP2B (Su Tu Trang Phase 2B) · Version 1.0 (9 November 2026) described the Google Sheet this data started in; that Sheet and its Apps Script are retired.

This document describes the database that backs Project Flow: what is in it, how it is laid out, where the data came from, who can change it, and how to keep it in step with the code. The data is stored as named datasets (the file name and the dataset names keep the old "sheet" wording). The application specification is `ProjectFlow_spec_final.md`; the design decisions are in `app/docs/adr/0004-projects-users-and-worksheet-areas.md` and `0007-supabase-only-backend.md`; setup and deployment are in `app/apps/api-v2/README.md` and `app/apps/sheets/README.md`.

## 1. What it is

All data lives in Supabase PostgreSQL, schema `projectflow_v2`: `datasets` (name, id, header) and `dataset_rows` (typed row objects as JSONB, in stable order). The router and services in `apps/sheets` run in the Supabase edge function (`project-flow-api-v3`) and in API v2; for each request they load the datasets into memory, run the route and write back what changed in one transaction under a write lock. The React web app calls them with the same routes the NestJS API uses. Nothing else should write to the tables while the app is in use.

| | |
|---|---|
| Backend | Supabase project `dulzdonvhjkvqmthsezh`: edge function `src/edge-v3.ts`, Node API `src/server.ts` (`apps/api-v2`) |
| Time zone | Asia/Saigon (dates are plain `YYYY-MM-DD`; timestamps are UTC) |
| Code | `app/apps/sheets` (shared router, services, in-memory store, local AI simulator) |
| Seed | `app/apps/api/seed/sttp2b.json`, built from the workbooks in `data/` (see §5) |
| Datasets | 53 live on 28 November 2026 (5,748 rows): the 46 defined in `src/datasets.ts` plus module datasets created when modules were switched on |

The same code runs against an in-memory store for tests and the local simulator (`pnpm --filter @projectflow/sheets test`; the simulator is kept for developing the AI functions, started as `app-sheets-sim` on port 3200). The simulator holds its own seeded copy: changes made in it never reach Supabase.

## 2. Layout rules

- **One dataset per register.** A dataset is named `<Area> - <dataset>`. Areas are, in order: **Settings**, **Personal**, **EPCIC**, **Governance**, **Reports**, so each workspace's data stays together. A module that is switched on in Settings → Modules without a dataset of its own gets a generated one named `<Workspace> - <Module> - <Submodule>` with a generic register template.
- **The header is matched by key.** Each dataset stores its column keys; the code reads and writes only the columns it knows. A column the code expects but the dataset lacks is treated as empty and is added when a row is written. Extra columns that older data carries are kept and ignored.
- **Project rows start with `projectId`.** One database serves several projects. Settings and Personal datasets, which are not project-scoped, have no `projectId` (Personal rows carry `owner`).
- **Everything is stored as plain text, numbers or ISO dates.** Dates stay `YYYY-MM-DD`, timestamps are ISO 8601 UTC, and strings like `0,0,0.18` are never turned into numbers. Number columns hold numbers. Blank means empty (null).
- **Ids.** Records get a prefixed running number when created in the app: `LG-0194` (shipment), `MB-191` (stock line), `PC-023` (concern), `KM-001` (milestone you add; milestones loaded from the workbook keep the workbook's id such as `02-M-1030`), `PR-…`, `EX-…`, `RSK-…`, and so on. An id is unique within its sheet and is never reused or edited.
- **Derived values are not stored.** Status and flags that depend on the reporting cut-off are worked out when read: milestone status, shipment overdue and days late, concern overdue and age, procurement package status, expediting variance, the dashboard attention score, and every summary shown at the top of a page. The stored `variance` on a milestone and on an expediting package is the exception: it is recalculated whenever the dates or the progress figures change.
- **Limits.** Long series are kept compact (see S-curves below) and cut-off report data is split into parts of 40,000 characters, so one row stays small.

## 3. Access and roles

Every change goes through the script, which checks the caller's role in the project before it writes. The pre-build uses a demo identity (the client names a user id and the script believes it); this is not authentication and must not be exposed outside the project team.

| Role | May do |
|---|---|
| Administrator | Everything, including Settings → Projects and Users |
| Project Manager / Manager | Read, create, edit and delete records in the project |
| Team Member | Read, create and edit; delete is refused (checked by the tests) |
| Leader | Between Team Member and Manager; see the role notes in `app/apps/sheets/README.md` |
| Client | Read only |

While a saved cut-off report is open (`?asOf=`), every write is refused with `READ_ONLY_SNAPSHOT`.

## 4. Sheet catalogue

Rows are the number the seed loads. “Columns” lists every column in the order the code writes them; text columns have no type shown.

| Sheet | Rows seeded | Columns (in order; type if not text) |
|---|---|---|
| `Settings - Projects` | 1 | `id`, `code`, `name`, `shortName`, `client`, `contract`, `location`, `lifecycle`, `cutoff` (date), `createdAt` (datetime), `updatedAt` (datetime) |
| `Settings - Users` | 4 | `id`, `name`, `email`, `isAdmin`, `status`, `createdAt` (datetime) |
| `Settings - Memberships` | 4 | `projectId`, `userId`, `role`, `title` |
| `Settings - Modules` | 100 | `projectId`, `moduleKey`, `path`, `state`, `updatedAt` (datetime) |
| `Settings - Module changes` | 0 | `projectId`, `id`, `at` (datetime), `moduleKey`, `fromState`, `toState`, `reason`, `actor` |
| `Personal - Tasks` | 4 | `id`, `taskNo`, `title`, `description`, `urgency`, `assigner`, `projects`, `planStart` (date), `planFinish` (date), `due` (date), `status`, `effort` (number), `remarks`, `createdAt` (datetime), `updatedAt` (datetime), `owner` |
| `Personal - Subtasks` | 0 | `taskId`, `id`, `title`, `done`, `position` (number) |
| `EPCIC - S-curve` | 43 | `projectId`, `date` (date), `plan` (number), `forecast` (number), `actual` (number) |
| `EPCIC - Work packages` | 5 | `projectId`, `code`, `name`, `weight` (number), `lastWeekPlan` (number), `lastWeekActual` (number), `achievedPlan` (number), `achievedActual` (number), `thisWeekPlan` (number), `thisWeekActual` (number) |
| `EPCIC - Milestones` | 48 | `projectId`, `id`, `description`, `planBaseline` (date), `planSub` (date), `subName`, `forecast` (date), `actual` (date), `variance` (number), `comment`, `facility` |
| `EPCIC - Procurement packages` | 145 | `projectId`, `id`, `code`, `discipline`, `description`, `vendorCode`, `vendor`, `origins`, `loaNo`, `loaDate` (date), `poNo`, `poDate` (date), `buyer`, `expeditor`, `pe`, `vqc`, `status`, `workPackage`, `packageType`, `weightPct` (number) |
| `EPCIC - Expediting packages` | 153 | `projectId`, `id`, `discipline`, `code`, `name`, `vendor`, `status`, `planPct` (number), `actualPct` (number), `variance` (number), `rosDate` (date), `etaSite`, `dateDiff`, `engPlan` (number), `engActual` (number), `procPlan` (number), `procActual` (number), `fabPlan` (number), `fabActual` (number), `testPlan` (number), `testActual` (number), `delPlan` (number), `delActual` (number), `highlight`, `actionPlan`, `remark`, `lsps`, `poNo`, `deliveryDate`, `currentStatusText`, `planExw` (number), `actExw` (number), `planArrival` (number), `actArrival` (number) |
| `EPCIC - Construction budget` | 0 | `projectId`, `wbs`, `name`, `parentWbs`, `discipline`, `manhours` (number), `planStart` (date), `planFinish` (date), `notes`, `updatedAt` (datetime) |
| `EPCIC - Logistics shipments` | 193 | `projectId`, `id`, `source`, `packageNo`, `packageDescription`, `poNo`, `shipmentNo`, `shipmentDescription`, `etdPol` (date), `etaPod` (date), `forecastOnSite` (date), `actualOnSite` (date), `status`, `grossWeightKg` (number), `qty`, `packingList`, `vessel`, `blNo`, `portLoading`, `portDischarge`, `transport`, `deliveryYard`, `issue`, `updatedAt` (datetime) |
| `EPCIC - Material balance` | 190 | `projectId`, `id`, `facility`, `supply`, `discipline`, `serialNo`, `category`, `materialCode`, `description`, `grade`, `poNo`, `shipmentNo`, `supplier`, `mrirNo`, `heatNo`, `unit`, `balance` (number), `yard`, `location`, `status`, `remark`, `updatedAt` (datetime) |
| `EPCIC - Material summary` | 10 | `projectId`, `id`, `supply`, `facility`, `mtoKg` (number), `arrivedKg` (number), `vspYardKg` (number), `mcYardKg` (number), `updatedAt` (datetime) |
| `EPCIC - Procurement concerns` | 22 | `projectId`, `id`, `packageCode`, `type`, `title`, `description`, `severity`, `area`, `owner`, `raisedDate` (date), `dueDate` (date), `status`, `action`, `source`, `sourceRef`, `createdAt` (datetime), `updatedAt` (datetime), `createdBy` |
| `EPCIC - Procurement S-curves` | 17 | `projectId`, `id`, `facility`, `scope`, `start` (date), `plan`, `forecast`, `actual`, `updatedAt` (datetime) |
| `EPCIC - Phase progress` | 6 | `projectId`, `id`, `phase`, `plan` (number), `actual` (number), `reportDate` (date), `updatedAt` (datetime) |
| `Governance - Risks` | 90 | `projectId`, `id`, `no` (number), `status`, `rbs`, `category`, `discipline`, `title`, `description`, `cause`, `effect`, `owner`, `recordDate` (date), `preProbability`, `preSchedule`, `preCost`, `preScope`, `preQuality`, `strategy`, `mitigationCause`, `mitigationEffect`, `planDate` (date), `actualActions`, `actualDate` (date), `postProbability`, `postSchedule`, `postCost`, `postScope`, `postQuality`, `remark`, `external`, `reviewDate` (date), `milestoneId`, `createdAt` (datetime), `updatedAt` (datetime), `createdBy` |
| `Governance - Risk actions` | derived | `projectId`, `id`, `riskId`, `action`, `owner`, `dueDate` (date), `doneDate` (date), `createdAt` (datetime), `updatedAt` (datetime) |
| `Governance - Risk matrix` | 16 | `projectId`, `probability` (number), `probabilityLabel`, `severity` (number), `severityLabel`, `level` |
| `Governance - Risk breakdown` | 37 | `projectId`, `code`, `category`, `categoryName`, `discipline`, `disciplineName` |
| `Governance - Issues` | 38 | `projectId`, `id`, `title`, `description`, `priority`, `discipline`, `status`, `startDate` (date), `dueDate` (date), `completedDate` (date), `nextAction`, `remarks`, `pics`, `source`, `lastRemindedOn` (date), `createdAt` (datetime), `updatedAt` (datetime), `createdBy` |
| `Governance - Issue sub-tasks` | 0 | `projectId`, `id`, `issueId`, `title`, `pic`, `dueDate` (date), `done`, `position` (number), `lastRemindedOn` (date), `updatedAt` (datetime) |
| `Governance - Issue log` | 38 | `projectId`, `id`, `issueId`, `at` (datetime), `actor`, `action`, `field`, `fromValue`, `toValue`, `note` |
| `Governance - Interfaces` | 0 | `projectId`, `id`, `title`, `type`, `originator`, `receiver`, `coordinator`, `discipline`, `boundary`, `requiredInput`, `requiredOutput`, `needDate` (date), `response`, `acceptance`, `evidence`, `status`, `milestoneId`, `createdAt` (datetime), `updatedAt` (datetime) |
| `Governance - Interface points` | 34 | `projectId`, `id`, `interfaceId`, `title`, `description`, `owner`, `workPackage`, `discipline`, `originator`, `target`, `action`, `queryDate` (date), `targetDate` (date), `reference`, `status`, `resolution`, `resolvedDate` (date), `resolvedDocument`, `remarks`, `createdAt` (datetime), `updatedAt` (datetime) |
| `Governance - Interface parties` | 24 | `projectId`, `code`, `name` |
| `Governance - Responsibility matrix` | 425 | `projectId`, `order` (number), `level` (number), `section`, `ref`, `activity`, `workPackage`, `facility`, `party`, `remark` |
| `Governance - RASCI` | 340 | `projectId`, `matrix`, `order` (number), `section`, `ref`, `activity`, `phase`, `party`, `role`, `remark` |
| `Reports - Knowledge` | 4 | `projectId`, `id`, `domain`, `category`, `title`, `summary`, `body`, `tags`, `sources`, `status`, `createdAt` (datetime), `updatedAt` (datetime), `createdBy`, `updatedBy` |
| `Reports - Cut-off snapshots` | 0 | `projectId`, `cutoff` (date), `createdAt` (datetime), `createdBy`, `note`, `rowCount` (number) |
| `Reports - Snapshot data` | 0 | `projectId`, `cutoff` (date), `dataset`, `part` (number), `json` |

### 4.1 What each EPCIC sheet holds

| Sheet | Meaning | Changed in the app? |
|---|---|---|
| `EPCIC - S-curve` | Monthly cumulative plan and actual for the **whole EPCIC scope**. Actual stops at the report date; forecast is empty | Read only (reference data) |
| `EPCIC - Work packages` | WP2 to WP6: weight in overall progress, cumulative last week, period progress, cumulative at the report date | Read only; progress figures come from the progress report |
| `EPCIC - Phase progress` | Plan and actual by phase: engineering, procurement, onshore construction, pre-com, T&I, offshore HUC, at the report date | Read only |
| `EPCIC - Milestones` | Key contract dates with baseline, subcontractor plan, forecast and actual dates, the subcontractor area and the **facility** | Create, edit, delete |
| `EPCIC - Procurement packages` | LOA and PO register, with work package, contract type and weight in progress | Create, edit, delete |
| `EPCIC - Expediting packages` | Vendor expediting status, stage progress and highlights | Create, edit, delete |
| `EPCIC - Logistics shipments` | One row per shipment from vendor to yard; `issue` is the pending or stuck note | Create, edit, delete |
| `EPCIC - Material balance` | Stock lines still on hand | Create, edit, delete |
| `EPCIC - Material summary` | Weight needed for purchase, arrived and on the VSP and MC yards, per facility and supply | Create, edit, delete |
| `EPCIC - Procurement concerns` | Risks, concerns and issues against a package | Create, edit, delete |
| `EPCIC - Procurement S-curves` | Weekly cumulative plan, forecast and actual per facility and scope (see below) | Read only (reference data) |
| `EPCIC - Construction budget` | WBS rows with manhours and plan dates | Create, edit, delete, import |

**`EPCIC - Procurement S-curves`.** One row per facility and scope (`LS` lump sum, `PS` reimbursable, `OVR` both; `OVERALL` is the whole project). `plan`, `forecast` and `actual` are each one cell of comma-separated percentages, one value per week, starting on the Friday in `start`. The actual series is shorter because it stops at the cut-off. 17 rows replace about 7,000 if each week were a row.

**Milestone facility.** The facility is read from the workbook id: `02-…` is CGF Topsides, `03-…` and `M10xx` CGF Jacket & Bridge, `04-…` and `LQM-…` LQ Module #2, `06-…` Pipeline, `01-…` Project (contract-level dates). It can be changed in the milestone form, and a milestone you add can be given any facility.

### 4.2 Milestone rules

- Create needs a key date (`description`). The id is optional; if given it must be unique and 2 to 40 letters, digits, dots, dashes or underscores. Otherwise the next `KM-nnn` is used.
- `variance` is the number of days from the baseline date to the actual date, or to the forecast date while the milestone is not achieved. It is empty if either date is missing.
- A milestone with an actual date is **Done**. Otherwise it is **Overdue** if its forecast (or, with none, its baseline) is before the cut-off, **Due soon** within 30 days after it, and **Planned** after that.
- A milestone linked from a risk or an interface cannot be deleted (`409 IN_USE`); unlink it first.

### 4.3 Issue management sheets

| Sheet | Meaning |
|---|---|
| `Governance - Issues` | One row per issue: title, description, priority (Critical, High, Medium, Low), responsible team (`discipline`), status (Not started, In progress, Pending, Completed), start and due dates, `completedDate`, next action, remarks, **`pics`** and `lastRemindedOn`. 38 issues are loaded from the task monitor workbook (`data/Governance/Issue Management`) by `extract_issues.py` |
| `Governance - Issue sub-tasks` | The steps of an issue: title, optional `pic` email, due date, `done` (Yes/No), `position`, `lastRemindedOn` |
| `Governance - Issue log` | The history. One row for every change: who, when, the action (Created, Updated, Status changed, PIC added, PIC removed, Sub-task added, Sub-task done, Sub-task reopened, Sub-task updated, Sub-task removed, Note, Reminder sent), the field with its old and new value, and a note. Rows are only ever added by the app; deleting an issue deletes its log |

- **Numbers follow the task monitor.** An issue keeps the number it has in the workbook's "No." column: `ISS-005` is item 5 there, and the gaps in the monitor's numbering (4, 18) stay gaps. Issues added in the app continue after the highest number.
- **Values are tidied on read.** The app reads a status or priority by meaning and ignoring case ("In Progess", "done", "HIGH" become In progress, Completed, High). People are picked by name; the e-mail is stored (see below).
- **Persons in charge** are stored as email addresses in `pics`, separated by commas, lower case, without repeats; at most 10 per issue. A sub-task has one `pic`. Any valid email is accepted, so a person does not need an account.
- **Overdue** is judged against the project cut-off, like the other registers. **Reminders** use today's date.
- **Emails.** The code can email a person when they are added to an issue or given a sub-task, on *Remind PICs*, and in a daily job (`remindDue`) that lists open items overdue or due within 3 days. **None of this runs on Supabase yet:** there is no mail service and no schedule, and the reminder routes answer `NOT_AVAILABLE`. Setting that up (a mail provider and a Supabase scheduled function) is open work.
- The simulator sends no mail; it prints each message in its console.

## 5. Where the data came from, and how to reload it

All reference data is extracted from the project workbooks under `data/EPCIC` and `data/Governance`. The extractors write into `app/apps/api/seed/sttp2b.json`; the seed and the simulator read that file.

| Extractor | Source workbook (folder under `data/EPCIC`) | Writes |
|---|---|---|
| `extract_progress.py` | `Schedule Progress/Progress/1 - … Progress Report & Scurve_20261030` | `schedule.scurve`, `schedule.workPackages`, `schedule.overall`, `phaseProgress`, `progressCutoff` |
| `extract_issues.py` | `Governance/Issue Management/TASK_MONITOR_*` (sheet `Master Task List`) | `issues` |
| `extract_procurement.py` | `Procurement/` procurement plan, expediting report, logistics weekly report, material stock report and summary list | `procurementPlan`, `logistics`, `materialBalance`, `materialSummary`, `procCurves` |
| (one-off, script not kept) | Key Milestones workbook, expediting report, interface workbooks | `milestones`, `procurement`, `expediting`, interface data |

Run an extractor with `PYTHONIOENCODING=utf-8 python app/apps/api/seed/<name>.py`. Reading is by position in the workbook, so a restructured workbook makes the extractor stop with an assertion rather than load wrong numbers.

**Report dates differ between sources.** Progress is at **30 October 2026**; procurement, logistics and expediting are at **6 November 2026**; stock is at 7 November. The project's cut-off (Settings → Projects) is 6 November, and statuses that depend on a date use it. The phase and work-package figures are labelled with the progress report date.

**Re-running an extractor does not change the live data.** The seed fills a new database (`db:import -- --seed`) and the simulator. To bring reference datasets (S-curves, milestones, procurement, expediting, logistics, materials, facility progress, working schedule, CPN, cut-off) up to a new seed, run `pnpm --filter @projectflow/api-v2 db:refresh` to see what would change, then `db:refresh -- --apply`; it saves the previous rows to `.tmp/`, writes in one transaction and never touches users, memberships, tasks, issues, risks, interfaces or lessons. Details are in `app/apps/api-v2/README.md`.

### 5.1 Not loaded

The stock ledger (`Sheet1`, 6,288 rows) and the PTSC-MSV, PTSC-No MSV and HHI sheets of the stock report; the received-shipment lists of the material summary; the item-level expediting sheets (`R1` to `R5`); the weekly and the S-curve data by work package and phase in the progress report; the construction progress monitoring and manpower histogram workbooks; the schedule PDFs. The construction budget and the formal interface register start empty. Risks, the risk matrix and breakdown (RBS), interface points, interface parties, the responsibility matrix and the RASCI come from the project's Risk and Interface management workbooks (`app/apps/api/seed/extract_governance.py`); risk actions are split from the numbered mitigation lines when the seed is loaded.

## 6. Changing data

Change data in the app, which validates every write and logs it. Do not edit the tables by hand: a row typed into `dataset_rows` skips the validation, the access checks and the issue log. Reference data is refreshed with `db:refresh` (§5); corrections to a single record go through the app or a reviewed script.

## 7. Cut-off reports

Saving a cut-off report copies these datasets into `Reports - Snapshot data` as JSON parts, one row per dataset part, with one summary row in `Reports - Cut-off snapshots`: S-curve, work packages, phase progress, milestones, procurement packages, expediting packages, construction budget, logistics, material balance, material summary, concerns, issues, issue sub-tasks, risks, risk actions, interfaces and interface points. The issue log is not copied. Procurement S-curves are not copied (they are large and reference-only). Opening a report reads the whole snapshot sheet, so it slows as reports accumulate (about 110 KB per report). Modules and their states, members, personal tasks and Settings are not part of a report.

## 8. Setting up and deploying

1. Create the Supabase project and fill `app/apps/api-v2/.env.local` from `example.env`.
2. `pnpm --filter @projectflow/api-v2 db:migrate`, then `db:import -- --seed` for a new database (or `db:refresh` on an existing one), then `db:verify`.
3. Deploy the edge function with `pnpm --filter @projectflow/api-v2 deploy:edge-v3 -- --yes` and publish the web app (`build:static`) with `VITE_SHEETS_URL` pointing at it.

Full steps, secrets (`SESSION_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`) and troubleshooting are in `app/apps/api-v2/README.md` and `docs/Supabase_configuration.md`.

## 9. Keeping this document in step

- The catalogue in §4 is generated: `pnpm --filter @projectflow/sheets sheet-catalog` prints the table; paste it over §4.
- When a column or dataset is added, change `src/datasets.ts` (columns, name, area order) and `src/seed.ts` (seed rows and order), update the sheet-order assertion in `test/api.spec.ts`, then run `db:refresh` so the live datasets get the column.
- Run `pnpm test` and `pnpm typecheck` after any such change.
