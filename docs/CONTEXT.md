# Project Flow — compact context

Snapshot reviewed: 2026-11-26. Navigation and recorded handoff only; confirm source and working-tree state before implementation. Root: `E:/PROJECTS/ProjectFlow`; package workspace: `app/`.

## Rules and backend map

- [../AGENTS.md](../AGENTS.md): data-backed figures, UI design ADR and responsive checks.
- `app/apps/sheets`: shared router, Apps Script backend and local simulator.
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
