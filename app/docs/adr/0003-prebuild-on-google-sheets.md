# 0003 — Pre-build on Google Sheets and Apps Script

Status: **superseded by [0007](0007-supabase-only-backend.md)** (28 Nov 2026): the Google Sheet and Apps Script are retired. Kept as the record of the pre-build. Was: accepted (pre-build only). Sheet names, single-project scope and the access model were extended by [0004](0004-projects-users-and-worksheet-areas.md). Supersedes nothing: the NestJS API in `apps/api` remains the target backend.

## Context

A working version is needed before the full server, database and services exist, and the project team already keeps this data in spreadsheets. They want each dataset in its own sheet of one Google file, and a link to a sheet whenever a module is established.

## Decisions

- **Apps Script is the API.** A web app bound to the spreadsheet answers the same routes as the NestJS API (`apps/sheets`). The web client has two modes behind one `request()` function (`VITE_API_MODE=rest|sheets`), so no screen knows which backend it uses.
- **One sheet per dataset**, header row = field names, columns matched by name so people can reorder or add columns. Dataset sheets are created by *Set up sheets*; module sheets are created when a module is established.
- **A module's sheet and link.** Enabling a module generates a sheet for each enabled leaf beneath it from a generic register template, and the API returns its link (`sheet.url`, with `#gid=`). Parent modules and the Dashboard have none. A module that is on but has no sheet can generate one on request. Module pages show **Open sheet**; placeholder pages also list the sheet's rows read-only.
- **Shared logic, not a copy.** The module catalog, its state rules and the progress calculation are imported from `apps/api` and bundled into `Code.js` with esbuild, so the two backends cannot drift on module rules. Query, list and CSV behaviour is reimplemented over rows and is covered by tests that mirror the API smoke checks. When a shared package is worth its build cost, move the three imported files there.
- **Storage behind an interface.** `Store` has a spreadsheet implementation and an in-memory one. The in-memory store drives unit tests and a local simulator (`pnpm dev:sheets-api`) that speaks the same envelope protocol.
- **Transport constraints.** Apps Script cannot answer a CORS preflight or set an HTTP status. Requests are simple GET (route in `?path=`) or `text/plain` POST (`{method,path,body,token}`), and every response is `{ok,status,data|error}` with HTTP 200. CSV downloads are saved client-side.
- **Plain-text cells.** Text and date columns are formatted `@` before writing, so ISO dates stay strings and `=` is never evaluated as a formula. Dates a person types as real dates are read back in the spreadsheet's time zone.
- **Access control is a shared token.** The script runs as its deployer and must accept anonymous callers, so the only gate is an `API_TOKEN` script property that the client sends. It is visible in the built web app. This is acceptable for a private pre-build and is not an authorization model (spec §2). The confidential reference data raises the stakes: keep the URL private.

## Consequences

- Both backends must stay route-compatible. A new route goes into `apps/api` and `apps/sheets/src/router.ts`, and the smoke checks (`apps/api/scripts/smoke.mjs`, `apps/sheets/test/api.spec.ts`) both get a case.
- Data written in sheets is not validated until read. Bad cells read as blank rather than failing a request.
- Moving to the full app means loading the sheets into PostgreSQL (sheet columns use the same field names the API returns) and switching `VITE_API_MODE` back to `rest`.
- `Code.js` is about 600 kB because it carries zod and the seed data. Replacing zod with small hand-written validators would roughly halve it if the editor paste becomes a problem.
