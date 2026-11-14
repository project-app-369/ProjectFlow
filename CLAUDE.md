# Project Flow: working rules

- Web UI follows `app/docs/adr/0006-lintel-design-and-layout-rules.md`: shared spacing tokens (`--gap`, `--card-px`, `--card-py`), no page-level margins or paddings on cards, KPI cards via `Stat`, registers via `DataTable` / `.table-wrap` (cards on phones), drawers via `Modal` (bottom sheet on phones). Check new pages at 1440, 1024 and 375 px in light and dark.
- Load data from the sheets/data files, never hard-code figures in code.
- Plan and status: `docs/ProjectFlow_implementation_plan.md`.
