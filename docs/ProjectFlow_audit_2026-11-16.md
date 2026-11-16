# Project Flow plan and execution audit

Audit date: 16 November 2026, Asia/Saigon. Tracked baseline: `ed2837d981716aceafa60787784d44b8c94c6842`.

Project Flow has a substantial functional pre-build and a working first NestJS slice. It does not yet meet the governing specification's P0 exit or production acceptance gates. The highest risks are caller-controlled identity, alternate routes that disclose private data, mutable historical reports, and incomplete delivery controls. Continuing to expand registers before closing these foundations increases the eventual migration and validation workload.

This report covers the governing specification, implementation plan, ADRs, application workspaces, reference-data pipeline, local Sites packaging, tests, and operational readiness. It distinguishes demonstrated defects from planned omissions and unverified deployment conditions. No hosted application, live spreadsheet, user account, email recipient, or production configuration was changed.

## Assessment

| Area | Assessment | Meaning |
|---|---|---|
| Product specification | Broad and useful, inconsistently versioned | Requirements and release gates are strong; revision metadata and subsequent scope additions need reconciliation |
| Implementation plan | Useful inventory, insufficient delivery baseline | Backend split is candid, but status is stale and parity sequencing omits important implemented capabilities and shared foundations |
| Sheets pre-build | Significant prototype coverage | Registers, CRUD, workflows, charts and seeded project data exist; several control guarantees fail under alternate paths |
| NestJS backend | Working early slice | Build, migrations and seeding work locally; identity, membership enforcement and much of the pre-build remain absent |
| Quality checks | Unit checks pass; smoke suite fails | 170 application tests pass; fresh-database HTTP checks have two failures |
| Deployment and operations | Not ready for controlled production use | Public proxy code trusts caller identity; recovery, isolation, monitoring and release evidence remain incomplete |
| Delivery confidence | Cannot substantiate a completion percentage or finish date | Screen count and test count do not measure the specification's end-to-end acceptance gates |

“Critical” below means an immediate blocker for exposing real data through the affected deployment. “High” means a material access, reporting, integrity or release-control defect. “Medium” means a correctness or maintainability issue requiring planned remediation. Suggested owners are roles to assign, not existing commitments.

## Verification results

| Check | Observed result |
|---|---|
| Web TypeScript | Passed |
| Sheets TypeScript, including audit probes | Passed |
| API TypeScript | Passed |
| Web unit suite | 6 files, 19 tests passed |
| Sheets unit and bundle suite | 4 files, 140 tests passed; bundle test rebuilds Apps Script and exercises mocked Apps Script globals |
| API unit suite | 1 file, 11 tests passed |
| NestJS production build | Passed |
| Web production and Sheets-mode builds | Both passed; entry chunks approximately 669 KB and 688 KB minified, triggering the configured 600 KB warning |
| Fresh isolated PGlite startup | Passed on local port 3317; audit process stopped afterward |
| API HTTP smoke suite | 7 checks passed, 2 failed; command exited 1 |
| Local Sites v2 suite | 7 files, 21 tests passed, including 2 proxy tests |
| Local Sites v1 proxy suite | 1 file, 2 tests passed |
| Additional audit probes | Reproduced the access, state, snapshot, date, calculation and reminder defects described below |

The two smoke failures are stale exact-count assertions: dashboard procurement expects 137 and receives 139; Piping procurement expects 30 and receives 32. Execution stops at the first assertion inside each failed check, so later assertions in those checks were not verified. These failures establish fixture/test drift; they do not by themselves establish incorrect business totals. See `app/apps/api/scripts/smoke.mjs:26` and `:34`.

The root pnpm commands first failed on a temporary-directory permission issue, then attempted dependency reconciliation and stopped with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. No forced installation or purge was performed. The installed TypeScript, Vitest, Nest and Vite entry points were run directly instead. Therefore the underlying checks passed where reported, while the documented root-command workflow remains unverified in this desktop runtime.

## Confirmed defects and release risks

### F01 Critical Caller identity is trusted across the public proxy

The local Sites v2 worker forwards `/exec` requests and injects `SHEETS_TOKEN`, while preserving the visitor's `user`, method, path and body. It performs no session or identity check. The Sheets backend then resolves that supplied user ID as the actor. Keeping the upstream token server-side protects the token's text but does not protect the actions it authorizes.

An offline probe sent a request without cookies or Authorization, claiming `u-admin` and requesting a user-administration mutation. The worker forwarded the mutation with that identity and injected its configured token. The upstream was mocked; no account was changed. The code path is confirmed. Whether an additional hosting access gate currently protects the deployed site is unverified.

Evidence: local ignored files `sites/project-flow-v2/worker/runtime.js:5`, `sites/project-flow-v2/README.md:3`; tracked `app/apps/sheets/src/auth.ts:41`, `app/apps/sheets/src/main.ts:57`. The NestJS API independently has no authentication and stamps module changes as `demo-user` (`app/apps/api/src/registry/registry.controller.ts:26`).

Action: establish server-verified identity, derive the actor from it, and deny unverified requests at the proxy and backend. Until then, restrict the affected deployment to an explicitly controlled demonstration environment. Do not treat the pre-build's role checks as user authentication. Owner: backend/security.

### F02 High Generic module records disclose other users' private tasks

`GET /tasks` correctly restricts tasks to their owner. However, `GET /projects/sttp2b/modules/task-management.board/records` reads the shared Tasks sheet. Because its columns have no `projectId`, `Service.records()` returns every row without an owner filter.

Reproduction: create an administrator's private task; request `/tasks` as `u-client` and verify it is absent; request the generic records route as the same client and observe that task. The local fixture returned five task rows, including the new private task. This bypass exists even while assuming the actor identity itself is trustworthy.

Evidence: `app/apps/sheets/src/service.ts:138`, `app/apps/sheets/src/datasets.ts:179`, `app/apps/sheets/src/router.ts:83`. Action: remove personal datasets from the generic project records route, or use dataset-specific authorization that enforces owner and field access. Check every generic mapping for equivalent bypasses. Add negative tests with two owners and two projects. Owner: backend.

### F03 High Dashboard summaries bypass party restrictions

The router checks party access for the requested module. The dashboard then loads other modules' summaries using module state alone, without evaluating the actor's party restrictions on each source.

Reproduction: deny `management.risks` to the Client party. `/risks` returns 403 for `u-client`, while `/dashboard` still returns a non-null risk summary. This confirms aggregate disclosure; it does not demonstrate full risk-record disclosure through the dashboard.

Evidence: `app/apps/sheets/src/router.ts:246`, `app/apps/sheets/src/api.ts:51`, `app/apps/sheets/src/admin-service.ts:109`. Action: pass the actor into aggregation and apply source permissions to each widget, including counts, facets, exports and insights. Party-based screen visibility also cannot substitute for the specification's record/revision publication model. Owner: backend/security.

### F04 High Saved reports remain dependent on live configuration

Snapshots copy risks but omit their scoring matrix and risk breakdown. A historical risk request recalculates against the current matrix. The audit saved a report, changed a live matrix cell, and observed different `/risks/options?asOf=2026-11-13` output for the same saved date.

Other omitted dependencies include procurement S-curves, facility curves/scopes/WBS, interface parties, responsibility and RASCI matrices, and issue history. The browser's snapshot-path expression also omits `/facilities`, `/logistics`, `/materials` and `/construction/budget`. These paths need an explicit historical-data policy; current behavior cannot support a blanket promise that every page represents the selected historical report.

Evidence: `app/apps/sheets/src/datasets.ts:168`, `app/apps/sheets/src/service.ts:47`, `app/apps/sheets/src/risks-service.ts:71`, `app/apps/web/src/api.ts:41`. Action: define a versioned report manifest containing data, configuration, calculation basis and source revisions. Reject unsupported historical views or label them current. Include the selected snapshot revision in frontend query keys. Owner: reporting/backend.

### F05 High Reports can be overwritten or lost during replacement

The snapshot API accepts `replace: true`, deletes the existing header and chunks, then writes replacement chunks. It also exposes deletion. There is no preserved restatement chain or immutable issued revision.

Two probes confirmed that replacement succeeds for an existing date, and that an injected storage failure after deletion causes replacement to return 500 while the original report subsequently returns 404. The second probe models a write failure; it is not a claim that this failure occurred in the live Sheet. A script lock serializes cooperating writers but provides no rollback.

Evidence: `app/apps/sheets/src/snapshots-service.ts:64`. This conflicts with specification PROG-07 to PROG-09 and the database document's statement that stored reports never change. Action: append a new report revision with reason and linkage; retain the original; write and validate all chunks before publishing its manifest. Use database transactions at cutover. Owner: reporting/backend.

### F06 High A read-only parent does not freeze its child registers

`isEffective()` accepts Locked and Read-only ancestors as reachable, then each backend's `assertAccess()` checks write permission only on the requested leaf's own state. Reproduction in Sheets: set parent `procurement` to Read-only; PATCH an enabled procurement package; receive 200 and persist the change. The same leaf-only check exists in NestJS, though its child-write path was not separately reproduced over HTTP.

Evidence: `app/apps/api/src/registry/catalog.ts` (`isEffective`, `allowsWrites`); `app/apps/sheets/src/service.ts:131`; `app/apps/api/src/registry/registry.service.ts:54`. Action: evaluate write restrictions along the full ancestor chain and state the inherited freeze in the UI. Test parent and leaf combinations, not only Disabled ancestors. Owner: backend.

### F07 High The last Project Manager can be demoted

`removeMember()` protects the final Project Manager, but `setMember()` overwrites their role without that invariant. The audit demoted `u-admin`, the only PM in the seeded project, to Team Member and counted zero remaining PM memberships.

Evidence: `app/apps/sheets/src/admin-service.ts:279` and `:293`. Action: apply a shared invariant to removal, role changes, suspension and deactivation; count eligible active managers within the same locked transaction. Add self-demotion and concurrent-change cases. Owner: backend.

### F08 High Progress arithmetic reports missing denominators as zero

The shared weighted helper returns 0 when total weight is zero and treats null measurements as zero. `overallProgress([])` returns four zero percentages. Specification §14.2 explicitly requires a zero denominator to be “Not calculable”; missing data must remain visible in completeness reporting.

Evidence: `app/apps/api/src/schedule/progress.ts:9`. Action: return a nullable value with completeness and validation information; distinguish measured zero from missing input. Define policy for partial weights and measurements, validate negative/nonfinite inputs, and implement the specification's calculation fixtures. Imported percentages also lack the approved earning-source and rule-version evidence needed for operational acceptance. Owner: project controls/backend.

### F09 Medium Impossible calendar dates pass API validation

The task API accepted `due: "2026-02-31"` and returned 201. Many other service validators use the same regex-only date pattern. String comparison and JavaScript date normalization can then produce inconsistent deadlines and workload buckets.

Evidence: `app/apps/sheets/src/tasks-service.ts:14`; analogous patterns in register services and NestJS tasks. Action: introduce shared strict calendar-date validation and explicit project-timezone/calendar rules. Cover leap years, invalid months/days, date ordering and reporting-day boundaries. Owner: shared domain/backend.

### F10 Medium Failed reminders are recorded as sent and suppressed

The reminder job stamps `lastRemindedOn` before delivery. `mail()` swallows send failures, and the job logs “Reminder sent” regardless. With an injected mailer that always throws, the first call reported one email; a same-day retry reported zero, with only one delivery attempt and the row marked reminded.

Normal public Apps Script requests also intentionally use `noMailer` and refuse manual reminder endpoints, so simulator behavior does not prove live assignment emails or manual reminders work. This is a sensible restriction against arbitrary public sending, but it needs to be reflected in feature status and user guidance.

Evidence: `app/apps/sheets/src/issues-service.ts:106`, `:323`, `:331`; `app/apps/sheets/src/main.ts:64`. Action: retain pending/failed/sent delivery states, record success after delivery, retry safely, expose failures, and bind recipients to authorized publication policy. Owner: backend/operations.

### F11 High Audit history does not meet the acceptance contract

The implementation plan says audit beyond module changes is absent, but Issues now has a dedicated change log. Conversely, issue deletion explicitly deletes its history, and generic procurement CRUD has no durable change history or optimistic concurrency check. Module decisions use real demo IDs in Sheets and a fixed actor in NestJS; neither is attributable authentication.

Evidence: `app/apps/sheets/src/issues-service.ts:211`, `app/apps/sheets/src/crud.ts:116`, `app/apps/api/src/registry/registry.controller.ts:29`. Action: implement a shared append-only audit service with stable principal IDs, before/after values, reason and correlation. Use archival/tombstones for controlled records. Add record versions to reject stale edits; serialization alone does not prevent a later stale form from overwriting accepted changes. Owner: platform/backend.

### F12 High Release packaging is outside tracked source control

The root `.gitignore` excludes all `sites/`. Both local Sites variants contain worker runtime, tests, configuration and frontend copies, but `git ls-files sites` returns nothing. Sites v2 describes itself as aligned to the audited commit, yet source hashes differ for Layout, styles, IssueDrawer and Issues. These may be intentional deployment adjustments; they are not automatically reproducible from the tracked commit.

Evidence: `.gitignore:11`, local `sites/project-flow-v2/README.md`, `sites/project-flow-v2/build.mjs`. Action: track the deployment adapter and deterministic build recipe, generate frontend output from one source, run worker tests in the release workflow, and record deployed source/build/backend versions together. Avoid committing secrets or generated bundles as a substitute for a build recipe. Owner: platform.

## Plan quality and execution alignment

The plan correctly separates the Sheets prototype from the target backend and correctly puts identity, memberships and project scoping near the start of parity work. The shared catalog, shared progress helper, storage abstraction and Apps Script bundle tests are useful foundations. Drawer primitives include keyboard focus handling, Escape and reduced-motion support; the audit found implemented accessibility mechanisms, not just styling claims.

However, the plan needs the following corrections before it can govern delivery:

| Plan issue | Evidence and consequence | Required correction |
|---|---|---|
| Baseline version drift | Plan and app README reference spec v1.4; spec header says v1.7 and contains a v1.8 revision | Declare one current version and reconcile change history and acceptance scope |
| Status date drift | Plan remains dated 8 November while HEAD is 16 November; UI merge is still listed as future work although merge `c0a9312` exists | Date each status review and distinguish merged, deployed and accepted |
| P2 inventory contradicts implemented work | Roadmap says no P2 contribution, while Logistics, Materials and Budget registers are implemented early | Record early register delivery without claiming full stock-ledger, preservation or construction acceptance |
| Stale migration prerequisites | Plan asks to add `project_id` to schedule, procurement and expediting, but those tables already have it | Replace with membership/isolation enforcement and migration tests; personal tasks require owner scope, not indiscriminate project scope |
| Incomplete parity backlog | Procurement mutations/dashboard, logistics/materials, issues/history/reminders, profiles/party access and facility data lack complete explicit migration items | Inventory every route and response contract and assign domain migration work |
| Incomplete foundational sequence | A ten-item parity list does not fully cover organizations, publication, canonical task/document contracts, earning evidence, audit/jobs/files | Build the P0 foundations and P1 vertical journeys before expanding parity screen by screen |
| Unqualified “Done” | Pre-build feature rows do not include the definition-of-done evidence required by spec §14.3 | Use separate implemented, verified, accepted and deployed states with known exceptions |
| Stale verification and data counts | Plan lists 61 Sheets contract tests; current suite has 140 total Sheets tests. Logistics notes mix 193 and 200 shipments | Generate fixture inventories and link status to exact source/import revisions |
| Outdated next steps | Logistics/Materials extraction is still proposed though current reference notes describe extraction | Replace completed actions with remaining ledger, reconciliation and ownership tasks |
| Unfunded scope growth | Issue management, risk/interface rebuilds, early P2 registers, facility progress, branding and UI work accumulated without a revised delivery estimate | Re-estimate remaining scope and capacity; retain 68 weeks as an envelope only |
| No accountable delivery baseline | Priority lists lack named owners, effort ranges, dependency dates and gate evidence | Create a requirement-to-contract-to-test-to-gate ledger and assign owners |

The pre-build has been effective for exploring real project workflows. Execution has also expanded ahead of the foundation sequence: UI and register breadth grew while production identity, publication, canonical services and target-backend parity remained deferred. This is an architectural rework risk, not proof that those prototype features should be discarded.

## Capability and release coverage

| Capability | Sheets evidence | Target-backend and acceptance gap |
|---|---|---|
| Organizations and identity | Demo users and project roles | No organization isolation model or authenticated principal; no session revocation proof |
| Projects and personnel | Multi-project CRUD, memberships, lifecycle | NestJS project reads only; levels, positions, scoped grants, wizard and tab-isolation evidence incomplete |
| Module lifecycle | Catalog, per-project state and decision log | Parent freeze bug; deployment/user-assignment axes and participant-bound Pilot policy incomplete |
| Planning and progress | Imported curves, WBS/facility views, milestones | Approved evidence/rules/baselines, completeness and immutable reporting basis incomplete |
| Procurement and expediting | Registers, CRUD, dashboard, concerns and imported curves | NestJS read slice; full production-schedule monitoring, review workflows and canonical task integration incomplete |
| Tasks | Owner-scoped organizer with multiple views, subtasks and workload | Generic-route bypass; target schema is old board; canonical source/PIC synchronization absent |
| Risks and interfaces | Workbook-driven ratings, actions, states and matrices | Target persistence absent; historical configuration not preserved; actor/party acceptance needs full scoped policy |
| Issues | PICs, subtasks, log and daily reminder entry point | Target migration absent; delivery failure handling and history retention defective |
| Budget and knowledge | Screens and services; starter knowledge content | Accepted budget/content ownership incomplete; target persistence/search absent |
| Documents and client release | Catalog/navigation placeholders | Canonical documents/revisions, MDR, transmittals, independent reviews, CRS, files and publication absent |
| Other P1 controls | Some catalog entries exist | Engineering deliverables, MOC/Lessons/Stakeholders, Events, MoM and controlled reports remain substantial work |
| P2 and P3 | Early Logistics/Materials/Budget registers | No accepted PO-to-installation chain, reservation ledger, preservation, QAQC/HSE/system gates, handover or offshore execution chain |

P0 exit is not demonstrated: real tenant separation, authenticated membership, canonical contracts, deployment evidence and a restore approach remain incomplete. P1 exit is not demonstrated: the required controlled reporting, document review, source-linked task and client-publication cycles cannot be completed on the current implementation. P2/P3 operational gates remain future work. No defensible “percent complete” follows from these inventories because requirement weights, effort and acceptance evidence are not baselined.

## Data migration and operational readiness

The reference-data pipeline extracts real project workbooks into `sttp2b.json`, and Sheets seed logic enriches that data differently from NestJS. In the current fixtures Sheets has 148 procurement rows and the API has 139. The extra Sheets rows include planned packages merged from the procurement plan. This is a known transformation difference requiring explicit migration reconciliation, rather than a backend interchangeability guarantee.

Seeding is not a recurring import strategy. NestJS skips when the project exists; Sheets preserves existing rows and performs selected one-off schema/data upgrades. Refreshing the JSON or redeploying does not establish that an existing live Sheet or database contains refreshed data. A recurring loader needs external keys, upsert rules, source versions, ownership of manual edits, row errors and reconciliation summaries. Historical percentages must retain the specification's imported-data qualification.

The following operational acceptance remains unverified or absent in the inspected tracked implementation:

- A measured backup/restore drill covering records, files, permissions, configuration and job state against the specified one-hour RPO and four-hour RTO.
- Capacity and latency measurements at 20 projects, 500 concurrent active users, 100,000 register rows and one million events. Whole-sheet reads and a global write lock are a prototype constraint, not evidence for that target.
- Durable background jobs, retries, delivery monitoring, audit retention, production alert ownership and a support runbook.
- An automated tracked release workflow with both backend contracts, migrations, worker policy, security/isolation tests and artifact provenance.
- Browser/device and accessibility acceptance at the mandated 1440, 1024 and 375 pixel widths, in light and dark, plus supported browser versions. Successful builds and source review do not establish visual acceptance.

The installed web client persists query data in localStorage for up to a day, while the service worker itself excludes API data. The app's overall data-retention behavior therefore needs a policy beyond “the service worker does not cache data.” Permission revocation, shared-device sign-out, snapshot transitions and in-flight requests need targeted browser tests. These are review risks, not reproduced browser exploits in this audit.

The pre-existing untracked `data/3d-model/` work is an optional BIM-related extension under spec DEC-08 and §13.1. Its add-in README explicitly says it has not been compiled or run against Navisworks Manage. It should have separate scope and acceptance; it contributes no evidence toward P0/P1 completion. No add-in compilation or model processing was attempted.

## Remediation sequence

| Order | Work package | Proposed accountable role | Exit evidence |
|---|---|---|---|
| 1 | Restrict exposed demo deployments; replace caller-selected identity; close generic/private and aggregate disclosure | Security/backend lead | Anonymous requests denied; authenticated actor cannot be overridden; two-owner/two-project negative tests pass |
| 2 | Repair parent freezes and PM/account invariants | Backend lead | Nested-state and last-eligible-manager tests cover all mutation paths |
| 3 | Preserve historical data, configuration and original report revisions | Reporting lead | A saved report remains identical after live edits; failed restatement preserves original; unsupported historical pages are explicit |
| 4 | Correct calculation completeness, strict dates, reminder failures and controlled history | Domain/backend leads | Specification calculation fixtures, date boundaries, retry/failure and retention tests pass |
| 5 | Baseline current scope and track deployment source | Product/technical/platform leads | Current requirement ledger, route parity inventory, owners, estimates, source/build versions and passing smoke suite |
| 6 | Complete P0 foundations in the target stack | Technical lead | Authenticated organization/project isolation, canonical structures/contracts, audit/jobs/files/deployment and measured recovery evidence |
| 7 | Deliver P1 as vertical acceptance journeys | Product and QA leads | Two reporting cycles across two projects; canonical tasks/PICs; controlled document review and client publication; reconciled migration |
| 8 | Expand execution and optional extensions through their own gates | EPCIC/domain leads | P2 and P3 traceability chains and separately accepted optional work |

Do not assign calendar promises until the responsible team sizes these packages and confirms staffing. The current plan should explicitly identify prototype maintenance capacity versus target-backend delivery capacity, and cap additional prototype scope until its migration cost is accepted.

## Reproduction and audit limitations

The retained probes intentionally assert the observed defective behavior so another reviewer can reproduce the findings. They are audit evidence, not regression tests asserting correct behavior. After repairs, replace the expectations with appropriate rejection, isolation and preservation tests in the normal suites.

From `app/apps/sheets`:

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/audit-2026-11-16.ts
node scripts/audit-site-proxy-2026-11-16.mjs
```

The first probe uses disposable MemoryStore instances and an injected failing mailer/storage operation. The proxy probe imports the local ignored Sites v2 worker and replaces network fetch with a stub. It requires that local Sites copy, which is precisely the source-control limitation identified in F12. Neither probe contacts the live service or sends email.

This is a repository and local-execution audit, not a penetration test or release certification. Source workbooks were reviewed through extraction code, fixture behavior and reference notes; every workbook cell was not independently reconciled. Hosted deployment versions, live spreadsheet sharing, external hosting access controls, production secrets, actual email delivery, PostgreSQL production behavior, concurrency/load, restore readiness and rendered browser layouts were not verified. The original untracked model work was preserved. Deliverables added by this audit are this report and the two local reproduction scripts; application behavior was not changed.
