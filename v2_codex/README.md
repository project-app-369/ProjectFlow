# Project Flow — v2_codex

Interactive MVP based on `docs/ProjectFlow_spec_final.md` v1.2. Built with HTML, vanilla CSS, and vanilla JavaScript. No framework, build step, package installation, or backend is required.

## Open

Open `index.html` in a modern browser. For a consistent local preview, run `node serve.cjs` from this directory and open http://127.0.0.1:5182. Stop the server with Ctrl+C. Google Fonts are optional; system fonts work when offline.

## Try the main workflow

1. Open **Production schedule** and select **Atlas Copco**.
2. Choose **Update forecast**, enter a forecast, vendor-reported progress, and recovery reason. The approved baseline and accepted progress remain unchanged.
3. Reopen the package and **Review submission** with an evidence reference. The accepted progress and dashboard now update.
4. **Add vendor update** as a Risk or Concern. A single linked task appears in **Tasks management**. Highlights do not create tasks.
5. Start that task, then submit it for verification. Open its item under **Risks & concerns**, record verification evidence, and close it. This completes the linked task without approving FAT or technical release.
6. Open **Document control**. The loadout procedure is blocked by the pending MWS review; record a sample response to see its separate review gate update.
7. Switch projects in the header. Registers, tasks, documents, and review history use the selected project. **My workspace** includes private tasks and Minh Nguyen's assignments.
8. Use **Settings** to preview the client view, change the theme, or restore all sample data. Export the current register with **Export CSV**.

## Implemented scope

- Responsive application shell and the Project Flow StageLink visual direction.
- Dashboard, Engineering/document view, Procurement, Expediting, and dedicated Production Schedule Monitoring.
- Vendor schedule bars, searchable/filterable production register, working-day delay calculation, missing-transit exposure, accepted versus reported progress, and forecast/review dialogs.
- Vendor risks, concerns, highlights, recovery reasons, source-linked tasks, review history, and notification summary.
- Project/private task views and independent client/CA/MWS document-review states.
- CSV export with formula-like text neutralization, local browser persistence, dark mode, and role-preview filtering.

## Demo boundaries

All data is fictional. The fixed reporting cutoff is 8 November 2026; the calendar uses Monday–Friday without public holidays. Storage is local to the browser/origin and is not shared between machines or users. Reset restores seeded data. Private tasks are excluded from project views and project audit text.

This is a frontend simulation, not a secure multi-user product. Client preview filters the interface, but all sample data is available in browser memory/storage. There is no authentication, server authorization, real approval signature, file upload, email delivery, live ERP integration, automatic critical-path scheduling, or regulatory certification. Evidence inputs store text references only. The full specification's P2/P3 modules are not implemented in this MVP.

## Files

- `index.html` — application entry point
- `styles.css` — responsive styles and themes
- `app.js` — sample data, view rendering, interactions, and persistence
- `serve.cjs` — optional dependency-free local preview server
- `verify.cjs` — deterministic workflow and data-isolation checks; run with `node verify.cjs`
