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
