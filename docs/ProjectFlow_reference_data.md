# Project Flow — reference data (STTP2B)

Real project workbooks in `data/` feed the prototypes and the first application modules. This note records what each file is, what has been extracted, the cleaning applied, and what is still unused. Reporting cut-off for the current set is **6 November 2026** (materials files 7 November).

**Project:** Su Tu Trang Phase 2B Field Development — EPCIC services, code STTP2B.

## Folder layout

The folder was reorganized on 8 November 2026. The first extraction (below) was made from the earlier layout (`data/Expediting`, `data/Logistics`, `data/Materials`, `data/Procurement Plan`); the files are unchanged, only moved.

| Path | Content | Status |
|---|---|---|
| `data/Procurement/Procurement Plan/STTP2B-Procurement Plan-updated 06-Nov-26.xlsm` | Procurement plans per work package, package summary, S-curves, weekly progress table | Partly extracted |
| `data/Procurement/Expediting/STT2B - Expediting Report Cut-off 06-Nov-2026.xlsx` | Package register, expediting summaries per commodity, item-level sheets, shipments | Partly extracted |
| `data/Procurement/Logistics/Weekly Report Cut off 06.11.2026.xlsx` | Sheets `PTSC items` (642 rows) and `CLJOC Items` (45 rows) | Not extracted |
| `data/Procurement/Materials/STT2B - Material Stock Report Cut off 07.11.2026.xlsx` | Stock report: `Sheet1` (6,288 rows), `Balance`, `PTSC - MSV`, `PTSC - No MSV`, `HHI` | Not extracted |
| `data/Procurement/Materials/STTP2B - MATERIAL SUMMARY LIST Cut off 07.11.2026.xlsx` | PTSCMC and client (FIM) summaries, summary weight, MRIR numbering | Not extracted |
| `data/Schedule  Progress/Milestones/STTP2B - Key Milestones Rev 0.xlsx` | 48 key dates: ID, description, baseline, subcontractor plan, subcontractor, forecast, actual, variance, comment | Extracted (Milestones module, sheets pre-build) |
| `data/Schedule  Progress/Schedules/*.pdf` | Level 3 EPCIC schedule, CGF-Jacket, Pile & Conductor, Link Bridge, LQ Module #2 | Reference only (PDF) |
| `data/Schedule  Progress/Schedules/schedule-edits.json` | Empty edit structure (`tasks`, `res`, `relAdd`, `relDel`, `rsrc`) | Unused; purpose to be confirmed |

## What the application uses today

Extraction was a one-off script run; the output is `app/apps/api/seed/sttp2b.json`, loaded into the database on first start. The scripts are not in the repository.

| Module | Source workbook · sheet | Entity | Records | Notes |
|---|---|---|---|---|
| Planning & Progress → Overall Progress | Procurement Plan · `S-CURVES (M)` | S-curve point (date, plan, forecast, actual) | 28 monthly points, Mar 2025 – Jun 2027 | Actual is empty after the cut-off (source shows `#N/A`) |
| Planning & Progress → Work Packages | Procurement Plan · `Progress Table (W)` | Work package with weight and weekly plan/actual | 5 (WP2 – WP6) | Overall progress is recomputed from the work packages by weight rather than copied from the OVERALL row; the two agree |
| Procurement → Procurement Plan | Expediting Report · `pgk_gen_info` | Procurement package: vendor, LOA, PO, buyer, expeditor, PE, VQC | 137 | Status is derived: PO placed if a PO number exists, else LOA issued if an LOA exists, else In tendering |
| Procurement → Expediting → Vendor Overview | Expediting Report · `Equipment-Summary`, `Structural Steel-Summary`, `Pipe-Fitting - Summary`, `Valves - Summary`, `Misc-Summary` | Expediting package with status and cumulative progress | 153 (Equipment 42, Valves 29, Misc 48, Structural 19, Piping 15) | Equipment rows also carry stage progress, ROS/ETA, highlights and action plans; other disciplines carry ex-works/arrival progress or shipment text |

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
| Procurement Plan · `Package Summary`, `PS Package Matrix` | Procurement Plan facility/WP, LS/PS type and package weights |
| Procurement Plan · `PP-WP2` to `PP-WP6`, `PS (Rebid) monitoring` | Per-package tender and award milestones |
| Procurement Plan · `Monthly Progress Cert` | Reporting snapshots |
| Expediting Report · `R1` to `R5` item-level sheets, `Medium` shipments | Expediting item and shipment detail; Logistics |
| Logistics workbook | Procurement → Logistics |
| Materials workbooks | Procurement → Materials |
| Schedule PDFs | Reference for schedule import design; not machine-readable as supplied |

## Handling

The data contains vendor names, PO and LOA numbers, and named buyers, expeditors, and engineers. Treat it and the seed file as project-confidential: do not publish the repository or the prototypes outside the project team. Replacing the one-off extraction with a validated import (spec API-02, CORE-06) is the next step; it should read from the current folder layout, keep the source file and cut-off with each load, and report row errors instead of dropping rows.
