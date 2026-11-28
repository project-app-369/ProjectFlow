# Project Flow — compact context

Snapshot reviewed: 2026-11-26. Navigation and recorded handoff only; confirm source and working-tree state before implementation. Root: `E:/PROJECTS/ProjectFlow`; package workspace: `app/`.

## Rules and backend map

- [../AGENTS.md](../AGENTS.md): data-backed figures, UI design ADR and responsive checks.
- `app/apps/sheets`: shared router, services and in-memory store (imported by the edge function and API v2) and the local simulator, kept for developing the AI functions. The Apps Script backend is gone.
- `app/apps/api-v2`: PostgreSQL/Supabase adapter using the Sheets router, with a local PGlite mode.
- `app/apps/api`: separate NestJS implementation; its parity backlog is not a statement that API v2 lacks the same routes.

## Latest recorded work and limits

Read items **14–15** under §5 of [ProjectFlow_implementation_plan.md](ProjectFlow_implementation_plan.md) for the 26 November updates. The opening §1 table has older descriptions; use the relevant later entry plus source/tests when resolving conflicts.

Item 15 reports API v2/Sheets parity coverage, a one-time budget refresh fix and corrected Sheets tests. It records a Supabase network timeout: live refresh and Edge deployment were still pending. These are historical results, not checks rerun or external actions authorized by this audit. Fabrication sequence viewers use shipped static JSON, not database tables.

The working tree already contained edits to API v2 refresh, Sheets facility-layout/seed/tests, a new parity test, the implementation plan, and reorganized construction drawing files. Preserve and inspect those changes before editing or committing; this audit did not validate their application behavior.

## Retrieve and validate selectively

- Requirements: find feature/requirement ID in [ProjectFlow_spec_final.md](ProjectFlow_spec_final.md).
- UI edits: read [ADR 0006](../app/docs/adr/0006-lintel-design-and-layout-rules.md).
- Backend changes: locate the requested route in the shared router or NestJS implementation first.
- Commands from `app/`: `corepack pnpm typecheck`, `corepack pnpm test`; use affected workspace scripts for iteration. API v2 local server: `corepack pnpm --filter @projectflow/api-v2 dev:local`; web: `corepack pnpm dev:web-v2`. Confirm environment requirements before starting.

Refresh this note after material milestones. Keep evidence in the implementation plan and read only relevant sections; do not treat this file as automatically replacing chat history.

## Live Supabase state (read-only check, 2026-11-26)

Via the Edge Function over HTTPS (`apps/web/.env.v3`; direct PostgreSQL from the dev machine times out): health ok, cut-off 2026-11-20, milestones 83, logistics 170, facility equipment 197, so the reference refresh was already applied earlier. Construction → Budget answers `MODULE_DISABLED`: the budget (453 rows) is not loaded. Applied later the same day at the user's request: `db:refresh -- --apply` (budget 453 rows, module enabled, milestones rewritten to seed), `deploy:edge-v3 -- --yes`, `db:verify` ok (53 sheets, 5,748 rows). Budget now answers 2,959,869 h, CPI 0.995.

## Facility Layout topside (27 Nov 2026)

Rebuilt from `CGF-Topside+DSF.nwd` with deck boxes by elevation, 16 Level 1 disciplines and Level 2 entries (plan item 17). Scripts: `data/3d-model/pipeline/classify_tds.py`, `build_tds.py`; UI: `FacilityLayout.tsx`, `TopsideSystems.tsx`. Not committed, not published to GitHub Pages.

## AI analysis and document import (27 Nov 2026)

Issues, Risks and Concerns pages have "AI analysis" and "Import document" buttons (`apps/web/src/AiTools.tsx`, `fileText.ts`), shown only when `GET /ai/status` reports enabled. Server side: `apps/sheets/src/ai.ts` (`handleAi`, OpenAI Chat Completions, key and model from `OPENAI_API_KEY`/`OPENAI_MODEL`, optional `OPENAI_BASE_URL`), mounted in `local-server.ts` (reads gitignored `apps/sheets/.env.local`) and `edge-v3.ts` (Supabase secrets). The model never writes: candidates are normalised against register values, reviewed and edited in a dialog, then created through the normal create routes. Readable: txt, md, csv, tsv, json, log, eml, docx, xlsx (PDF: paste text). Apps Script and `api-v2/server.ts` have no AI (buttons hidden). Tested locally with a mock service; the live account returned 429 (no credits). Live use needs `supabase secrets set OPENAI_API_KEY OPENAI_MODEL` and an edge redeploy, which have not been done. The key was shared in chat: rotate it. Not committed or published.

## UI consistency audit (27 Nov 2026)

Spacing, type, motion and wording rules added to ADR 0006 (items 7–9, "Type, motion and wording"); token utilities and fixes in `apps/web/src/styles.css` (consistency layer at the end) and 30 page files. Details in plan item 19. Remaining debt: the three historic CSS layers are not consolidated. Not committed or published.

## Issues links, Concern details, meeting-minutes AI (27 Nov 2026)

Issues carry `packageCode` and `subcontract` (columns added to `datasets.ts`; schema upgrade adds them). `GET /projects/:pid/issues/options` lists packages (procurement + expediting registers) and service subcontracts. There is no Service Subcontract register: suggestions come from interface parties, milestone subcontract areas and values already typed. Issues page filters by package (`?package=`), subcontract and "Open only"; insights add open issues by package and by subcontract when there is data. Concern details moved from the generic drawer to `pages/ConcernDrawer.tsx` (xl modal like Risk details, package card with links and other open items on the package). "Meeting minutes" button (`MinutesDialog` in `AiTools.tsx`) posts to `/projects/:pid/ai/digest`: the server reads `GET /ai/context/meeting` (parties, packages, key dates ±45/90 days of cut-off, readable registers; entries proposed only for registers the user may change), asks the model, and `cleanDigest` keeps only known party/package codes and list values. Output: meeting header, summary, decisions, party cards (role, status, plan/actual %, key dates, concerns, risks), actions, register entries to review and add, Markdown download. Verified with a local mock. Committed (21aad5e), published to Pages (gh-pages 9c84b73) and the edge function redeployed on 27 Nov 2026 at the user's request: live `/issues/options` returns 148 packages and 27 subcontracts, issues carry `packageCode`/`subcontract`, `active=true` filters. AI stays hidden live (`/ai/status` disabled) until OpenAI credits and `supabase secrets set OPENAI_API_KEY OPENAI_MODEL`.

## Issues and Risks: people by name, actions checked (27 Nov 2026)

People in charge of issues and sub-tasks are picked from the project's members by name (`pages/people.tsx`: `useMembers` on `GET /projects/:pid/members`, `PeoplePicker`, `PersonInput`). The server (`issues-service.ts`, `people()`) accepts an account name, a user id or an e-mail, stores the e-mail (reminders still go by mail) and returns `people`/`picName`/`facets.picPeople` with names. An unknown name gets 400 `PERSON_UNKNOWN`. The log, CSV and the "by person in charge" chart use names. Risk owners and mitigation-action owners suggest member names (still free text). Create, update and delete for issues, sub-tasks, risks and risk actions were run through the router for each demo role: Project Manager and Manager can do everything; Team Member everything except deleting an issue or a risk (403 `MANAGER_REQUIRED`, now explained in the dialog footer); Client is read-only. Not checked in the browser (no free dev-server slot), not committed, not deployed.

## Task management audit (27 Nov 2026)

Personal → Task Management pages (`pages/tasks/*`, `icons.tsx` adds `hourglass`, CSS block "Task management audit" at the end of `styles.css`) reworked for labelled controls, consistent icons and token motion; Project Tasks (`task-management.project-tasks`) renders `TaskManagement scope="project"`. Details in plan item 21 and ADR 0006 ("Type, motion and wording"). Checked at 1440 and 375 px, light and dark. Not committed or published.

## Card gaps, motion, git hygiene (28 Nov 2026)

Layout and motion rules are in ADR 0006 ("No gaps in card layouts", "Interaction and motion"); fixes are appended at the end of `apps/web/src/styles.css`. `desktop.ini` was already in `.gitignore`; the `fatal: bad object refs/codex/desktop.ini` and repack failures came from Windows writing `desktop.ini` files inside `.git/refs` and `.git/objects` (269 removed). They can come back (OneDrive/Explorer); if `git for-each-ref` warns of broken refs again, delete `desktop.ini` under `.git`. The gap sweep is a script run in the browser console (measures card rows per container); it is not in the repo. Not committed or published.

## "Generate sheet" removed (28 Nov 2026)

The "Generate sheet" button on module placeholders, the `POST /projects/:pid/modules/:key/sheet` route (`router.ts`) and `generateSheet` (`service.ts`) are gone; the route now answers `ROUTE_NOT_FOUND` (test in `api.spec.ts`). Enabling a module in Settings still creates its sheet automatically. The older `sites/project-flow-v1` and `v2` apps still carry the button. Typecheck, 28 web and 187 sheets tests and the web build pass; not checked in the browser, not committed, not deployed (needs an edge redeploy and a Pages rebuild). The broader request to remove all Google Sheets data and links is not done yet.

## Supabase is the only backend (28 Nov 2026)

[ADR 0007](../app/docs/adr/0007-supabase-only-backend.md), plan item 23. Apps Script, the Google Sheet links, `pull-sheets`, `sheetLinks.ts` and the Apps Script env files and scripts are removed; `/health` no longer carries a spreadsheet URL; reminders answer `NOT_AVAILABLE` (no mail service or schedule on Supabase). Live check (`db:verify`, 53 datasets, 5,748 rows): data matches the seed with cut-off 2026-11-20, so the five 27 Nov 2026 workbooks in `data/EPCIC/Procurement` are not loaded. Live Issues lack `packageCode`/`subcontract` and Facility equipment lacks `model` until the next write or `db:refresh`. Typecheck and tests pass (sheets 171, api-v2 10, web 28). Not committed; the edge function and Pages have not been redeployed, so the live site still serves the old `/health` and the sheet links. An empty stray file `E:\tmp_unused` came from a mistyped command and can be deleted.

## AI provider: AI/ML API (28 Nov 2026)

`aiConfigFrom` (`apps/sheets/src/ai.ts`) picks the provider from the host environment: with `AIMLAPI_API_KEY` set it uses AI/ML API (`https://api.aimlapi.com/v1`, model `AIMLAPI_MODEL`, default `alibaba/qwen3.7-max`), else OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_BASE_URL`). Both hosts use it (`local-server.ts` reads gitignored `apps/sheets/.env.local`; `edge-v3.ts` reads Supabase secrets). Answers wrapped in a code fence are accepted; a 402, or a 403 that says funds/credit, is reported as `AI_QUOTA`. The key is in `.env.local` only. Test call returned 403 "run out of funds": the AI/ML API balance needs a top-up at aimlapi.com/app/billing before AI can be tried end to end. Live use still needs `supabase secrets set AIMLAPI_API_KEY=...` and an edge redeploy (not done). Not committed or published.

## Google Sheet rows merged into Supabase (28 Nov 2026)

At the user's request, every tab of the Google Sheet ("Project Flow — STTP2B data (pre-build)", read through its public xlsx export, 44 tabs, 4,648 rows) was compared with live Supabase, and only rows that Supabase lacked were added; nothing in Supabase was overwritten. Added through the live edge API create routes (direct PostgreSQL to both pooler ports reset the connection from this network): issues ISS-044 to ISS-055 (source "Task monitor" in the Sheet; the person in charge is only named in Remarks, so `pics` is empty and stored as `source: App`, created 28 Nov 2026 by u-admin, disciplines stored as codes) and the six personal tasks of u-admin (TSK-0001 to TSK-0006, two of them tests: "Thái test từ Google sheet", "Test 2 Test Test"). Live now: 53 issues, 6 tasks. Left out as obsolete or replaced in Supabase: reference data that `db:refresh` rewrites from the seed (S-curves, facility curves and scopes, modules, RASCI and matrices, expediting EX-146 to EX-153, which exist under other ids, and material summary MS-09, whose LQ module figures are newer in Supabase). The Client-supplied logistics shipments and the Client rows of the material summary (conductor pile and four others) were missing because `apps/api/seed/extract_procurement.py` no longer read them: the Client sheet's item numbers are now text, and the "Summary Weight" sheet gained Sub/Remark columns that moved the Client block (the old reader also invented a "Client / VSP" row and skipped Brownfield STPIP). Fixed on the user's request: columns are found by the block titles, item numbers may be text, and an optional cut-off argument picks the newest workbook on or before it (`python extract_procurement.py 2026-11-20`). The seed was rebuilt at the current 20 Nov cut-off: only `logistics` (170 → 214, 44 Client) and `materialSummary` (8 → 13) changed; four `api.spec.ts` assertions updated (one had asserted zero Client shipments). Tests pass (sheets 173, api-v2 10, web 28, api 11). Applied to live Supabase on 28 Nov 2026 for logistics and material summary only (53 datasets, 5,830 rows, `db:verify` ok; backup in `.tmp/supabase-before-refresh-2026-11-28T12-51-49-544Z.json`). Milestones were left alone: 9 rows carry actual dates and descriptions entered in the app (03-F1300, M1030, M1040, LQM-F-3120/3190/3290/3380, KD-025, EQ-001) that a full `db:refresh -- --apply` would reset to the seed, so do not run it with `--apply` until the seed or the refresh keeps app edits. Not committed. Unused: the "Constructability" (88 rows, lifting list) and "Models" (7 Autodesk URNs) tabs, which no screen or dataset uses. The Sheet itself was not changed or deleted.

## Long lists load as you scroll (28 Nov 2026)

`apps/web/src/lazyList.tsx`: `useInfiniteList` (TanStack `useInfiniteQuery` over the existing `page`/`pageSize` API; key `[prefix, pid, 'list', query, pageSize]` so prefix invalidations still refetch; `data` keeps the `Page` shape with the server total), `useProgressive` (client-side slices) and `LoadMore` (IntersectionObserver sentinel 600 px ahead, "Load N more" button fallback, `role=status` count "Showing 50 of 214 shipments", focus moves to the first new row after a click). New rows fade in (`DataTable revealFrom`, `.row-in`); while rows remain the foot is a sticky frosted bar (`.panel:has(>.load-more.has-more){overflow:clip}`); all motion off under `prefers-reduced-motion` (CSS block at the end of `styles.css`). Applied to Issues, Risks, Concerns, Logistics, Procurement, Expediting, Material balance, Milestones (list and grouped), Interface points and formal interfaces, Knowledge, Budget WBS and Task list/cards; Pager no longer used there. `persistCache.ts` saves only the first page of such lists. Typecheck, tests (web 32, sheets 173, api-v2 10, api 11) and web build pass; checked in the sim at 1440 px light on Logistics (50→214). Not yet checked at 375 px or dark, not committed.
