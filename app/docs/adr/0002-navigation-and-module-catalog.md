# 0002 — Navigation workspaces and module catalog

Status: accepted (first slice). Requirements: spec v1.3, NAV-04 to NAV-06, SET-05, SET-06.

## Decisions

- **Four workspaces, one catalog.** Personal, EPCIC, Governance and Reports are a sidebar grouping over a single module catalog (`apps/api/src/registry/catalog.ts`). Module keys are dotted paths (`procurement.expediting.vendor-overview`); submodule keys are generated from the parent key and the label slug, so renaming a label changes the key. Keys are stored in `project_modules`, so treat a rename as a migration.
- **Grouping per direction, not per the spec's flat list.** T&I is alone under Installation; Offshore HUC is grouped with Onshore Precom-Commissioning under Commissioning; Construction, Fabrication Subcontracting, QAQC and HSE sit under Yard Execution. Groups carry no permissions or dependencies.
- **Governance uses the spec's module names.** Risks, Issues, Lessons Learned, Management of Change and Stakeholders are submodules of Management (MGT-01 to MGT-05), so there are no separate "Risk Management" or "MOC" modules. Interface Management, Document Control and Event Management sit beside Management.
- **Periodic Reports** is a grouping of the predefined reports in REP-03 (weekly and monthly progress, milestones, engineering, procurement, risk and issue, interface, actions). It is not a new capability.
- **Phase and availability are manifest data.** Phase follows spec §13.1. A module is Available if it or a descendant has a real screen, In development if it is P1 and has none, otherwise Planned. The Settings page shows both labels.
- **Defaults.** Available and In development modules start Enabled; Planned modules start Disabled. All can be toggled. A Planned module enabled early shows a placeholder. Whether project activators may do this is an open decision (spec §15.2).
- **State rules** live in pure functions next to the catalog and are unit tested: core modules cannot be disabled; a module cannot be enabled while a required module is off, or disabled while an enabled module requires it (today only Engineering requires Document Control, per MOD-10); a disabled parent hides children without changing their stored state; a child is effective only when every ancestor is.
- **Enforcement is server-side.** A route marked with `@RequireModule(key)` returns `403 MODULE_DISABLED` when the module is not effective for the project, and `MODULE_READ_ONLY` for writes while Locked or Read-only. The Dashboard returns `null` for widgets whose source module is off so the client shows an explicit unavailable state. Hiding a menu item is not the control.
- **Breadcrumbs** are `workspace / group / module / submodule`; the group is included only when the module has one. The same path titles screens and Settings rows.
- **Settings are routes.** `/settings/modules`, `/settings/general`, `/settings/data`. Display preferences (appearance, last workspace) are browser-local; module state is a project setting stored in the database.

## Consequences

Adding a module means adding a manifest entry, an implementation key to `IMPLEMENTED` in the catalog and `WIRED_KEYS` in the web client, and a page. Until both lists agree the module is a placeholder. Moving a module between groups changes only presentation.
