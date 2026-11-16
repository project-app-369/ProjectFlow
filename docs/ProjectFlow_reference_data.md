# Project Flow — reference data (STTP2B)

Real project workbooks in `data/` feed the prototypes and the first application modules. This note records what each file is, what has been extracted, the cleaning applied, and what is still unused. Reporting cut-off for the current set is **13 November 2026** (procurement plan, expediting and logistics). The material files are still those of 7 November, and the progress, key-milestone and governance workbooks are the latest in their folders (progress 30 October, milestones and governance earlier).

**Project:** Su Tu Trang Phase 2B Field Development — EPCIC services, code STTP2B.

## Folder layout

The folder was reorganized on 8 November 2026 and again when the procurement files moved under `data/EPCIC/`. The first extraction (below) was made from the earlier layout (`data/Expediting`, `data/Logistics`, `data/Materials`, `data/Procurement Plan`); the files are unchanged, only moved.

| Path | Content | Status |
|---|---|---|
| `data/EPCIC/Procurement/Procurement Plan/STTP2B-Procurement Plan-updated 13-Nov-26.xlsm` | Procurement plans per work package, package summary, S-curves, weekly progress table | Extracted (plan weights, work package, contract type) |
| `data/EPCIC/Procurement/Expediting/STT2B  - Expediting Report Cut off 13-Nov-2026.xlsx` | Package register, expediting summaries per commodity, item-level sheets, shipments | Partly extracted (register, summaries; concerns seeded from highlights) |
| `data/EPCIC/Procurement/Logistics/STTP2B - Logistics Report cut off 13-Nov-2026.xlsx` | Sheets `PTSC-supplied materials` and `Client-supplied materials` (the 06-Nov report called them `PTSC items` and `CLJOC Items` and had packing list, vessel, B/L and port columns that the 13-Nov report no longer carries) | Extracted: 200 shipments (158 PTSC, 42 client) into Procurement → Logistics |
| `data/EPCIC/Procurement/Materials/STT2B - Material Stock Report Cut off 07.11.2026.xlsx` | Stock report: `Sheet1` (6,288 rows), `Balance`, `PTSC - MSV`, `PTSC - No MSV`, `HHI` | `Balance` extracted (190 stock lines); the ledger and the other sheets are not loaded |
| `data/EPCIC/Procurement/Materials/STTP2B - MATERIAL SUMMARY LIST Cut off 07.11.2026.xlsx` | PTSCMC and client (FIM) summaries, summary weight, MRIR numbering | `Summary Weight` extracted (10 lines); the rest not loaded |
| `data/EPCIC/Schedule Progress/Milestones/STTP2B - Key Milestones Rev 0.xlsx` | 48 key dates: ID, description, baseline, subcontractor plan, subcontractor, forecast, actual, variance, comment | Extracted (Milestones module, sheets pre-build) |
| `data/EPCIC/Schedule Progress/Schedules/*.pdf` | Level 3 EPCIC schedule, CGF-Jacket, Pile & Conductor, Link Bridge, LQ Module #2 | Reference only (PDF) |
| `data/EPCIC/Schedule Progress/Schedules/schedule-edits.json` | Empty edit structure (`tasks`, `res`, `relAdd`, `relDel`, `rsrc`) | Unused; purpose to be confirmed |

## What the application uses today

The output is `app/apps/api/seed/sttp2b.json`, loaded into the database on first start and, for the Google Sheets pre-build, into one worksheet per register. The procurement extraction is repeatable: `PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_procurement.py` re-reads the workbooks and rewrites the `procurementPlan`, `logistics`, `materialBalance`, `materialSummary` and `procCurves` keys. The earlier extraction of the other keys was a one-off and its script is not in the repository.

| Module | Source workbook · sheet | Entity | Records | Notes |
|---|---|---|---|---|
| Planning & Progress → Overall Progress | Procurement Plan · `S-CURVES (M)` | S-curve point (date, plan, forecast, actual) | 28 monthly points, Mar 2025 – Jun 2027 | Actual is empty after the cut-off (source shows `#N/A`) |
| Procurement → Dashboard, progress by work package (also used by Planning & Progress → Work Packages) | Procurement Plan · `Progress Table (W)` | Procurement work packages WP2–WP6; cumulative this-week plan M and actual N | 5 work packages, plus OVERALL row 22 | Rows 7, 10, 13, 16 and 19; workbook fractions are stored as percent. The weighted overall roll-up agrees with row 22. This is the source of the procurement work-package bars; `S-curve data` supplies the separate weekly curve. |
| Procurement → Procurement Plan | Expediting Report · `pgk_gen_info`, Procurement Plan · `Package Summary` | Procurement package: vendor, LOA, PO, buyer, expeditor, PE, VQC, work package, contract type, weight in progress | 139 register rows + 9 plan-only packages (148 on the sheet) | Status is derived: PO placed if a PO number exists, else LOA issued if an LOA exists, else In tendering |
| Procurement → Expediting → Vendor Overview | Expediting Report · `Equipment-Summary`, `Structural Steel-Summary`, `Pipe-Fitting - Summary`, `Valves - Summary`, `Misc-Summary` | Expediting package with status and cumulative progress | 145 (Equipment 42, Valves 18, Misc 51, Structural 19, Piping 15) | Equipment rows also carry stage progress, ROS/ETA, highlights and action plans; other disciplines carry ex-works/arrival progress or shipment text |
| Procurement → Logistics | Logistics workbook · `PTSC items`, `CLJOC Items` | Shipment: package, PO, dates, status, weight, vessel, B/L, yard, issue note | 193 (152 PTSC, 41 client) | The `issue` column holds the source's pending or stuck note; overdue is derived against the cut-off, not stored |
| Procurement → Materials | Material Stock Report · `Balance`; Material Summary List · `Summary Weight` | Stock line on hand; weight needed / arrived / on yard per facility and supply | 190 stock lines, 10 weight lines | The 6,288-row ledger is not loaded |
| Procurement → Dashboard (S-curve) | Procurement Plan · `S-curve data` | Weekly cumulative plan, forecast and actual per facility (CGF Topsides, CGF Jacket & Bridge, LQ Module #2, Brown Field, Pipeline, Overall) and per scope (LS, PS, both) | 17 curves of 144 weeks, Apr 2025 – Dec 2027 | Actual is kept to the cut-off; the baseline-1 rows (`PLANNED (B1)`) and the `PS - S-CTR` sub-series are not loaded |
| Procurement → Risks & Concerns | Expediting highlights and logistics notes | Concern: type, severity, area, owner, action | 22 seeded | Seeded with source `Expediting` or `Logistics` and the reference; new ones are entered in the app |
| Planning & Progress → Schedule, Progress | Progress-monitoring workbooks in `data/EPCIC/Schedule Progress/Progress` (cut-off 30 Oct 2026): `6 - Construction Progress Monitoring` · `S-Curve Data`, `R-WBS`, `Level 3 (WBS)`; Jacket, Bridge and LQM#2 workbooks · `Project S-Curve` | Facility curve point (facility, scope, week, plan, forecast, actual), scope weight, WBS node with dates and progress | 1,005 curve points, 22 scopes, 165 WBS nodes for 5 facilities | Repeatable with `app/apps/api/scripts/extract_facility_progress.py`. CGF Topside has construction curves only: the all-phase weekly table in its workbook is incomplete. DSF has no workbook yet. |

## Cleaning rules applied

- PO dates written `TBA` are stored as empty; the package keeps its PO number.
- The discipline typo `Pipline` is stored as `Pipeline`.
- In the Valves summary, seven rows had a number where the status text belongs (a column shift in the source); they are treated as `Normal`.
- In the Misc summary the status column is headed `Column 11` in the source; it is read as the package status.
- The Structural summary has an extra header row before the table; the table header is on row 5.
- Free text longer than 320 characters (highlights, action plans, shipment status) was truncated in the seed file. Re-extraction should keep the full text.
- Replacement characters in the source (`�`) were converted to apostrophes.
- Percentages in the workbooks are fractions; they are stored as percent values.

## Not yet used, with the module each would feed

| Source | Would feed |
|---|---|
| Key Milestones workbook | Planning & Progress → Milestones (baseline, forecast, actual, variance per key date) |
| Procurement Plan · `PS Package Matrix` | Procurement Plan facility cross-reference (`Package Summary` is used for work package, LS/PS type and weights) |
| Procurement Plan · `PP-WP2` to `PP-WP6`, `PS (Rebid) monitoring` | Per-package tender and award milestones |
| Procurement Plan · `Monthly Progress Cert` | Reporting snapshots |
| Expediting Report · `R1` to `R5` item-level sheets, `Medium` shipments | Expediting item detail |
| Material Stock Report · `Sheet1` ledger, `PTSC - MSV`, `PTSC - No MSV`, `HHI`; Material Summary List received-shipment lists | Materials: movement history and received-shipment detail |
| Schedule PDFs | Reference for schedule import design; not machine-readable as supplied |

## Handling

The data contains vendor names, PO and LOA numbers, and named buyers, expeditors, and engineers. Treat it and the seed file as project-confidential: do not publish the repository or the prototypes outside the project team. Replacing the one-off extraction with a validated import (spec API-02, CORE-06) is the next step; it should read from the current folder layout, keep the source file and cut-off with each load, and report row errors instead of dropping rows.

## Refreshing from a newer cut-off (13 November 2026)

The three procurement-side scripts now pick the workbook with the newest cut-off date in its file name, so a new report dropped in its folder is picked up by re-running them:

```
PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_expediting.py [--check]     # procurement register, expediting packages, project cut-off
PYTHONIOENCODING=utf-8 python app/apps/api/seed/extract_procurement.py              # procurement plan, logistics, materials, procurement S-curves
```

`extract_expediting.py` is new: it replaces a one-off extraction. `--check` shows how the extraction differs from the seed without writing. Run against the 06-Nov report it reproduces the earlier seed apart from whitespace, and it matches columns by header text.

| What changed between 6 and 13 November | Effect |
|---|---|
| Procurement register | 139 packages (+3: `STTP2B-GF-ELE-011-A`, `STTP2B-GFLQBF-PIP-001E` and `-001F`), 119 with a PO and 20 with only an LOA |
| Expediting | 145 packages (was 153). The Valves package table moved to the new sheet `Valves - Detail status`; `Valves - Summary` is now a plan by valve type. The old extraction also picked up the 13 quantity rows of the lower table of `Valves - Summary` as packages with status Normal; they are not packages and are no longer loaded |
| Logistics | 200 shipments (+7); the report was restructured (see above) |
| Procurement S-curves | Actuals to the 13 November cut-off |
| Not changed in the folders | Material files (7 Nov), progress workbooks (30 Oct), key milestones (Rev 0), risk register (21 Oct), interface points (24 Oct), task monitor (10 Nov) |

The tests run on a fixed reporting week (cut-off 6 November 2026, test clock 8 November) whatever cut-off the seed carries, so a data refresh changes the counts they check but not their dates.
