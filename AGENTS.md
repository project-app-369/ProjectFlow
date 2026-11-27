# Project Flow — agent guidance

## Project rules

- Web UI follows `app/docs/adr/0006-lintel-design-and-layout-rules.md`: shared spacing tokens (`--gap`, `--card-px`, `--card-py`), no page-level margins or paddings on cards, KPI cards via `Stat`, registers via `DataTable` / `.table-wrap` (cards on phones), drawers via `Modal` (bottom sheet on phones). Check new pages at 1440, 1024 and 375 px in light and dark. Read that ADR before UI edits.
- Load data from the sheets/data files, never hard-code figures in code.
- Plan and status remain in `docs/ProjectFlow_implementation_plan.md`; governing requirements remain in `docs/ProjectFlow_spec_final.md`.

## Context routing

Start with `docs/CONTEXT.md` when project state is needed. Search the plan, spec or ADR index by feature, requirement ID or endpoint and read the relevant section. Verify source freshness; the plan's opening table contains older descriptions than its later updates.

Distinguish `app/apps/sheets` (shared router/simulator), `app/apps/api-v2` (PostgreSQL adapter using that router), and `app/apps/api` (separate NestJS implementation). Identify the backend for the task before investigating parity or choosing commands.

Use targeted source searches under `app/apps` and `app/docs`. Skip `.pnpm-store`, `.tmp`, `dist-static`, built bundles and binary/3D assets for initial text retrieval; include them explicitly for asset, pipeline or live-archive tasks. Read data schemas or summaries before loading large datasets.

## Commands and continuity

Run workspace commands from `app/` with `corepack pnpm` (pnpm 9.15.4). Root `typecheck` and `test` run recursively. Use the affected workspace's checks during iteration; complete checks required for the change before claiming success. Scripts in the relevant package.json are authoritative.

Preserve existing uncommitted edits. Retain concise source paths, backend, decisions, validation and next actions in `docs/CONTEXT.md` after material milestones, with detailed evidence in the implementation plan. Context notes and historical deployment instructions do not authorize live refreshes, deployment or other external writes.
