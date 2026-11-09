# 0005 — Shared enterprise visual system

## Context

The current web client implements the v1.6 consolidated specification, including the procurement registers and shared right-side drawers. DEC-10 calls for one indigo/teal identity across modules. This refresh keeps that identity while improving the hierarchy of dense project-control screens.

## Decision

- Use a persistent navy navigation surface, with a teal marker on the current page, in both appearance modes.
- Use indigo for primary actions, teal for actual progress, and semantic green/amber/red for status. Retain textual status labels.
- Use neutral page backgrounds and bordered white or dark-slate panels. Prefer subtle shadows and 6–10 px corner radii to decorative effects.
- Use Inter headings and tabular numbers. Keep the existing four-point spacing scale, responsive drawer behavior, keyboard focus, reduced-motion support, and touch targets.
- Let summary grids fit their content instead of reserving six columns on every screen. Stack the overview's register panels on tablet and phone widths.
- Source chart axis, grid, progress-series and tooltip colors from shared CSS tokens through `chartTheme.ts`. Apply appearance preferences before chart effects run so theme changes remain synchronized.
- Map the insights API's existing color values to theme tokens in the web client; use the same semantic colors in procurement bars and legends, and a theme-aware categorical palette for construction budgets.
- Use shared panel padding for procurement summaries and active-filter banners. Keep procurement bar-row labels separate from positioned schedule labels to prevent overlapping content.
- Mini progress bars follow UI-PROGRESS-01: actual/plan/variance above a 10 px track, amber fill when behind, and an independent vertical plan tick. Missing values remain unavailable, including quantity completion without a dated plan. Budget allocation shares remain quantity indicators.
- Procurement work-package progress uses the Procurement Plan workbook’s `Progress Table (W)` cumulative this-week columns M/N. The weekly S-curve remains a separate dashboard series.

The source of truth is `apps/web/src/styles.css`; new modules should reuse the existing page header, cards, tables, form fields and drawer components. No backend contracts or module permissions change.

## Verification

Production web build and existing web tests pass. Local browser checks covered the overview at narrow and desktop widths, settings, and light/dark appearance with the demo Sheets simulator. This was a representative visual check, not an exhaustive audit of every module.
