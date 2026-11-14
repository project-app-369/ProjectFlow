# Project Flow
## Product specification, modular architecture, roadmap, and implementation plan

**Version:** 1.1 — expanded project, task, document-control, and module-access specification  
**Date:** 8 November 2026  
**Audience:** Project sponsors, EPCIC management, product owners, designers, developers, QA, and implementation teams  
**Delivery:** Responsive web application with independently enabled business modules  
**Status:** Specification for estimation and development; project-specific procedures and contractual acceptance rules require configuration before production use.

**Revision 1.1:** Adds project-specific personnel titles/levels and current-project behavior; personal and project Tasks Management with linked PIC assignments; a dedicated Document Control module with MDR/EMDR, transmittals, and CA/MWS review; Master module lifecycle and level/person assignment; recommended project-management extensions; and a revised 68-week implementation baseline. Branding adopts the selected StageLink design direction under the **Project Flow** name.

---

## 1. Product purpose and scope

Project Flow is an integrated project management application for Engineering, Procurement, Construction, Installation, and Commissioning (EPCIC). It provides one controlled view of project scope, schedules, progress, constraints, interfaces, documents, decisions, and readiness from engineering through offshore handover.

The application shall support multiple organizations and projects, with access separated by organization, project, discipline, work package, company, and record classification. A project may enable only the modules it needs. Additional modules shall become available through **Settings → Modules** as they are delivered in phases.

The product shall help users answer:

- What is planned, achieved, delayed, blocked, and forecast?
- Which engineering, procurement, construction, and commissioning dependencies prevent the next activity?
- Who owns each action, issue, interface, deliverable, or approval?
- Which information is approved for client visibility?
- What evidence supports a reported percentage or readiness decision?
- What changed since the previous reporting period?

### 1.1 Product principles

1. **Traceable progress:** Every approved progress figure links to a measurement rule, reporting period, baseline, source records, and approving user.
2. **One record, multiple views:** Dashboards, registers, reports, and discipline screens reuse shared source records.
3. **Modular delivery:** Business modules can be installed, enabled, configured, suspended, and upgraded without rebuilding the application shell.
4. **Controlled collaboration:** Access to a screen never automatically grants access to all its data or actions.
5. **Professional simplicity:** Dense project information remains readable through hierarchy, consistent controls, and restrained visual styling.
6. **Safe configuration:** Changes to weights, workflows, permissions, calendars, and module availability show impact before publication.
7. **Explicit uncertainty:** Missing, stale, provisional, rejected, and approved data are visibly different.

### 1.2 Scope boundaries

Project Flow includes project controls and operational coordination. It does not initially replace an ERP, engineering authoring tool, payroll system, certified electronic permit system, vessel navigation system, or engineering simulation platform. It may link or exchange data with those systems through controlled integrations.

Work permits, commissioning certificates, lift readiness, and handover records support approved project procedures. A software status alone does not authorize hazardous work or replace a designated person's technical acceptance.

Commercial cost control, contract administration, resource planning, and advanced integrations are recommended optional modules. They are included in the extension roadmap without expanding the Phase 1 baseline implicitly.

### 1.3 Requirement language and identifiers

- **Shall / must:** Required for the assigned release.
- **Should:** Recommended; a release owner may defer with a recorded rationale.
- **May:** Optional capability.
- Requirement prefixes identify functional families; all numbered requirements in a module inherit its phase unless explicitly marked otherwise.
- Proposed defaults in this document are configuration starting points, not contractual or regulatory requirements.

## 2. Users and responsibilities

| Role | Primary purpose | Default scope |
|---|---|---|
| Project Manager (PM) | Own project delivery, approved baseline, reporting, escalation, and client publication | Assigned project |
| Manager | Manage a function such as Engineering, Procurement, Construction, QAQC, or HSE | Assigned function/disciplines |
| Leader | Coordinate a discipline, team, system, area, or work package | Assigned team/packages |
| Team Member | Maintain assigned records, submit progress, and complete actions | Assigned records and permitted shared information |
| Client | Review specifically released project information; optionally comment or accept nominated deliverables | Explicitly granted screens, records, fields, and buttons |
| Organization Administrator | Manage organization settings, memberships, module installation, and identity policy | Organization administration; business data only when separately granted |
| Platform Operator | Maintain hosting and platform operations | Operational metadata; exceptional data access is time-limited and audited |

Administrator is an additional administrative role, not a replacement for the five requested business roles. Vendor and subcontractor users use constrained custom roles or Team Member templates scoped to their company and packages.

## 3. Information architecture and navigation

```text
Project Flow
├── Project switcher / My projects
├── My Workspace [personal, across authorized projects]
│   ├── My tasks / My day
│   ├── Assigned to me / My approvals
│   └── Personal notes and reminders
├── Dashboard
├── Tasks Management [current project]
│   ├── All tasks / Board / Calendar
│   ├── Assignments & PIC directory
│   └── Workload / Approvals
├── Document Control
│   ├── Master Document Register (MDR)
│   ├── Engineering Master Document Registers (EMDR)
│   ├── Transmittals / Submissions
│   ├── Reviews & Comments / CA / MWS
│   └── Correspondence / Distribution / Archive
├── EPCIC
│   ├── Engineering
│   │   └── Work packages [configurable]
│   ├── Procurement
│   │   ├── Procurement Plan
│   │   ├── Expediting
│   │   ├── Logistics
│   │   └── Materials
│   ├── Planning & Progress
│   │   ├── Overall progress
│   │   ├── Work packages [configurable]
│   │   └── Milestones
│   ├── Construction
│   │   ├── Yard layout
│   │   ├── Facility layout
│   │   ├── Workfront
│   │   ├── Construction sequence
│   │   ├── Construction progress & KPI
│   │   └── Productivity
│   ├── Fabrication Subcontracting
│   │   ├── Subcontractor progress
│   │   └── Concerns & highlights
│   ├── Onshore Precom-Commissioning
│   │   ├── Systems & subsystems highlights
│   │   ├── Commissioning sequence
│   │   ├── Handover schedule
│   │   ├── Check-sheet progress & KPI
│   │   └── Punch closing progress & KPI
│   ├── QAQC
│   ├── HSE
│   ├── T&I
│   │   ├── Workpacks
│   │   ├── Timeline & schedule
│   │   ├── Sequence
│   │   └── Progress
│   └── Offshore HUC
│       ├── Marine spread
│       ├── Timeline & schedule
│       └── Progress
├── Management
│   ├── Risk Register
│   ├── Issue Register
│   ├── Lessons Learned Register
│   ├── Management of Change
│   └── Stakeholders Register
├── Interface Management
│   ├── Interface Register
│   ├── Interface Matrix
│   └── Interface Points
├── Event Management
├── Reports
│   ├── Minutes of Meetings
│   ├── Documents [authorized view of Document Control]
│   └── Analytics
├── Profile
└── Settings
```

**NAV-01:** Navigation shall be generated from enabled modules and effective permissions. An unavailable feature shall never appear as a functioning empty screen.

**NAV-02:** Disabled modules shall disappear from normal navigation. Users with module-management permission may see them in the catalog with phase and availability labels.

**NAV-03:** The header shall show organization, current project, global search, reporting date, notifications, quick create, and profile. Quick create lists only permitted actions.

**NAV-04:** Project switching shall clear incompatible filters, cancel unsaved navigation only after warning, and re-evaluate every permission. Deep links shall preserve project and record context.

## 4. Branding and UX/UI specification

### 4.1 Brand direction

**Brand:** Project Flow.  
**Selected direction:** StageLink concept, branded as Project Flow.  
**Tagline:** Connected modules. Coordinated delivery.  
**Slogan / landing headline:** Start focused. Build connected.  
**Personality:** Structured, adaptable, professional, and approachable.

The identity uses linked segments or modular blocks suggesting connected project stages. Retain the Project Flow wordmark. Use the selected indigo/teal palette, generous spacing, rounded modular panels, and clear connection diagrams. The wordmark shall remain legible at small sizes and work in monochrome. Avoid decorative industrial imagery, excessive gradients, glass effects, and animated dashboard backgrounds.

Deliver brand assets as SVG and PNG, including horizontal wordmark, compact icon, light/dark variants, favicon, login lockup, and report header. A logo is a design deliverable; this specification does not supply a finished logo.

### 4.2 Design tokens

| Token | Light theme proposal | Dark theme proposal | Use |
|---|---|---|---|
| Brand primary | `#343C78` | `#C5CBFF` | Navigation emphasis and primary identity |
| Accent | `#00877D` | `#69D8CB` | Primary actions and selected states |
| Page background | `#F8FAFC` | `#111525` | Main canvas |
| Surface | `#FFFFFF` | `#19242F` | Cards, forms, drawers |
| Primary text | `#172B3A` | `#ECF2F8` | Main content |
| Secondary text | `#526477` | `#ABBCCB` | Supporting information |
| Border | `#D8E1EA` | `#3B4A59` | Separators and controls |
| Success | `#176B45` | `#73D6A2` | Accepted/completed |
| Warning | `#8C5700` | `#F4C46B` | At risk/attention |
| Critical | `#B42336` | `#FF9CAB` | Overdue/blocked/critical |
| Information | `#245BA5` | `#99BFFF` | Informational status |

Colors are proposed tokens. Every actual foreground/background combination shall pass the project's contrast checks before release; semantic colors shall always include text or icons.

- Typography: Manrope headings and Inter interface/body text when available, with system sans-serif fallback; tabular numerals for numerical columns.
- Type sizes: 12 px metadata, 14 px dense table text, 16 px body/form text, 20 px section titles, 28 px page titles.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.
- Corners: 8 px controls, 12 px application cards/drawers, and 16–22 px marketing panels, following the selected modular design; avoid excessive pill-shaped controls.
- Icons: One coherent outline icon family, 18–20 px in navigation, text labels on unfamiliar actions.
- Elevation: Subtle shadows only for overlays and floating panels; use borders for normal cards.
- Motion: 120–200 ms transitions; respect reduced-motion preferences.
- Density: Comfortable default; compact option for experienced desktop users. Touch actions remain comfortably sized.

### 4.3 Application shell and page templates

**UI-01 — Shell:** Desktop sidebar approximately 248 px expanded or 72 px collapsed; header approximately 64 px. Page margins 24 px desktop and 16 px mobile. Main content shall flex to the available width.

**UI-02 — Register template:** Breadcrumb → title/description → primary action → summary strip → search/filter/view toolbar → table or alternate view → pagination. Keep the primary action stable across modules.

**UI-03 — Record template:** Identifier, title, status, owner, due date, and action menu at top. Tabs: Overview, related module-specific details, Actions, Attachments, Comments, and History. Use a drawer for brief inspection and a full page for complex editing.

**UI-04 — Dashboard template:** Project/reporting context, data freshness notice, KPI cards, trends, exceptions, upcoming commitments, and personal actions. Cards link to the filtered source view.

**UI-05 — Forms:** Group fields by purpose, show required markers, validate inline and on submit, preserve entered data after failure, and focus the first error. Long forms support draft save. Draft and submitted states must be visually distinct.

**UI-06 — Tables:** Support configurable columns, resize, sort, multi-filter, sticky headers, column pinning, saved views, server pagination, and permission-aware bulk actions. Selections spanning pages must state the selected count and scope. Exports respect the active filter and user access.

**UI-07 — Timeline:** Provide day/week/month scales, baseline versus forecast, milestone markers, dependency inspection, and accessible table alternatives. Dragging a date proposes a change; it never silently changes an approved baseline.

**UI-08 — Charts:** Label units, reporting date, denominator, baseline, and source. Distinguish planned/actual/forecast by line style as well as color. Provide the underlying data table. Never display missing data as zero progress.

**UI-09 — Responsive behavior:** At 1440 px support dense workspaces; at 1024 px collapse secondary panels; at 768 px use a drawer navigation; at 390 px prioritize actions, status, and essential fields. Wide engineering tables may scroll horizontally with visible column context.

**UI-10 — Interaction states:** Each page shall define loading, empty, filtered-empty, denied, stale, partial-data, error, retry, offline, and success states. Empty states describe the next permitted action.

**UI-11 — Accessibility:** All core flows shall work with keyboard-only navigation, visible focus, screen-reader labels, logical headings, and 200% zoom. Target at least 4.5:1 text contrast, 3:1 for large text and essential controls, and 44 × 44 px primary touch targets. Verify these requirements rather than claiming certification.

**UI-12 — Feedback:** Success messages identify the completed action. Destructive or irreversible actions require a consequence summary. Submission and approval must display what record revision is affected.

**UI-13 — Editing conflicts:** If another user changes a record, show the conflicting fields and current revision. Require reconciliation; never overwrite an approved revision silently.

**UI-14 — Copy:** Use clear labels such as “Submit progress,” “Request review,” and “Publish to client.” Avoid unexplained abbreviations; show glossary tooltips for domain terms.

### 4.4 Theme and branding settings

Users may choose Light, Dark, or System and a preferred density. Organization administrators configure logo, approved accent palette, login artwork, and report identity. Projects may add a project logo without overriding organization identity or semantic status colors. Print/export templates use a controlled light background regardless of the user's theme.

Theme updates shall not change permissions or chart meaning. Custom brand colors require contrast validation and a fallback when invalid. Theme and density persist across devices; user preference overrides the organization default.

### 4.5 Required design handoff

Deliver reusable components and annotated desktop/mobile designs for login, registration, project onboarding, dashboard, register, record detail, workflow review, timeline, layout viewer, module catalog, permission editor, notification center, and report builder. Include all interaction states, keyboard behavior, responsive examples, token definitions, and client-restricted variants.

## 5. Identity, registration, and user access

### 5.1 Authentication and account lifecycle

**AUTH-01:** Default registration is invitation-only. Organization administrators may enable registration requests for approved email domains; domain matching alone shall not grant membership or project access.

**AUTH-02:** Registration captures name, verified email, organization invitation, password or approved single sign-on identity, and acceptance of applicable terms. New users remain pending until the required verification and approval finish.

**AUTH-03:** Invitations are single-use, expiring, revocable, and bound to the intended organization and email. Proposed expiry: seven days. Resending revokes the previous token.

**AUTH-04:** Login supports email/password and optional enterprise single sign-on. Provide password reset, optional remembered device, multi-factor authentication, session-expired handling, and generic failure messages that do not disclose account existence.

**AUTH-05:** Require multi-factor authentication for administrators, PMs, and configured privileged approvers. Recovery methods shall be auditable and shall not bypass organization access approval.

**AUTH-06:** Proposed password policy: minimum 14 characters, support password managers and paste, reject known compromised passwords where an approved service is available, and use an adaptive salted password hash. Rate-limit authentication and recovery attempts.

**AUTH-07:** Proposed session policy: 30-minute inactivity limit, 12-hour absolute limit, re-authentication for sensitive administrative actions. Display a warning before expiration and protect unsaved work without retaining data on shared devices indefinitely.

**AUTH-08:** Logout invalidates the current server session and clears protected local state. “Log out all devices” revokes all account sessions. Suspension, membership removal, or critical role revocation takes effect on the next protected request.

**AUTH-09:** Account states: Invited → Pending verification → Pending approval → Active → Suspended/Deactivated. Historical records preserve attribution after deactivation.

**AUTH-10:** Membership removal must identify owned open actions and require reassignment or an explicit exception. Users may hold different roles in different projects.

### 5.2 Permission model

An allowed operation requires all of the following:

```text
Active account and organization membership
AND active project membership
AND module enabled for the project
AND screen/action permission
AND record scope match
AND field permission
AND workflow-state eligibility
AND no applicable explicit deny
```

Permissions shall be enforced on the server for reads, writes, searches, file downloads, notifications, analytics, exports, and integrations. Hidden buttons are a usability feature, not the security boundary.

Supported actions: view, create, edit, submit, review, approve, reject, reopen, assign, comment, upload, download, export, publish, archive, delete draft, and configure. Buttons map to these actions and may add state-specific conditions.

Supported scopes: organization, project, function, discipline, company, area, system, work package, assigned record, and explicit shared-record list. Scope restrictions remain attached to each role grant; combining roles must not accidentally combine one role's broad scope with another role's privileged action. Explicit denies take precedence.

| Capability | PM | Manager | Leader | Team Member | Client default |
|---|---|---|---|---|---|
| View internal project data | Project scope | Function scope | Team scope | Assigned/shared scope | Denied |
| Create/edit draft records | Yes | Function | Team | Assigned scope | Denied |
| Submit progress | Yes | Function | Team | Assigned scope | Denied |
| Review progress | Yes | Function | Delegated | Denied | Denied |
| Approve project baseline | Yes | Delegated proposal only | Denied | Denied | Denied |
| Publish client reports | Yes | Explicit delegation | Denied | Denied | Denied |
| View released client records | Yes | Scoped | Scoped | Scoped | Explicit grant only |
| Comment/accept client deliverable | If assigned | If assigned | If assigned | If assigned | Explicit grant only |
| Configure project workflows | Yes | Delegated module scope | Denied | Denied | Denied |
| Manage organization users/install modules | Additional admin grant | Denied | Denied | Denied | Denied |
| Export data | Explicit grant | Explicit grant | Explicit grant | Explicit grant | Denied |

Role defaults are editable templates; they are not unconditional entitlements. Self-approval is denied for baselines, changes, and final acceptance unless an explicitly documented project policy allows an exception.

### 5.3 Client access configuration

**ACL-01:** Settings shall provide a Client Access editor with screen tree, visible widgets, button/action matrix, field masks, record scopes, release status, and expiry.

**ACL-02:** Client access defaults to deny. A recommended initial profile allows a released dashboard, published milestones, released progress reports, nominated documents, and nominated meeting minutes. Costs, private comments, personal information, draft risk assessments, and internal concerns remain denied.

**ACL-03:** Client visibility is explicit at record/revision level. Public comments and internal comments use separate scopes. Publishing requires an exact audience and preview.

**ACL-04:** “Preview as client” shall render the effective policy without impersonating the client or allowing edits. A policy comparison shall show newly exposed screens, fields, and actions before saving.

**ACL-05:** Aggregations shall not leak hidden records through counts, totals, search suggestions, chart tooltips, or file names. A PM may publish a reviewed summary snapshot whose explicitly approved values are visible without exposing internal source records.

**ACL-06:** Revoking access blocks existing download links and future scheduled deliveries. Previously downloaded files cannot be recalled; the publication dialog shall state this limitation.

## 6. Core platform and common behavior

Project configuration and personnel assignment details are specified in Sections 11.3–11.5. Titles are display attributes; levels are project-specific permission templates; roles and individual grants control allowed operations. These concepts shall not be treated as interchangeable.

### 6.1 Shared data model

| Entity | Required relationships and purpose |
|---|---|
| Organization, User, Membership, Role, Grant | Identity and scoped authorization |
| Project | Organization, code, client, location, project timezone, reporting calendar, status |
| ProjectMembership, PersonnelLevel, ProjectPosition | Project-specific title, level, manager, company, validity period and access-template relationships |
| Task, TaskAssignment, PICAssignment, SourceLink | Personal/project work, accountable owner, assigned person, source revision, workflow and history |
| Project structure | WBS, discipline, area, location, system/subsystem, tag/equipment |
| WorkPackage | Canonical package ID, type, parent WBS, owner, scope, discipline, dependencies |
| Activity, Milestone, Baseline | Schedule, dependencies, planned/forecast/actual dates, approved revisions |
| ProgressMeasurement, ProgressSnapshot | Source, rule, quantity, reporting period, approval, baseline |
| Action, Approval, Comment | Shared ownership, due dates, review decisions, discussion |
| Document, DocumentRevision, RegisterEntry, Transmittal, ReviewCycle, ReviewComment | Canonical controlled files, MDR/EMDR memberships, review responses, distribution and acknowledgments |
| Risk, Issue, Change, Interface | Cross-module management records |
| Event, Meeting | Calendar commitments and minutes/actions |
| ModuleInstallation, ModuleActivation | Version, project settings, dependency and lifecycle state |
| AuditEvent, Notification, IntegrationJob | Traceability and operational processing |

All business records shall include organization ID, project ID, immutable record ID, display code, revision, created/updated timestamps and users, status, classification, and ownership. Dates representing instants are stored in UTC and displayed in the selected timezone. Date-only commitments remain date-only and use the project's working calendar.

Engineering and Planning work packages shall be views of shared packages or explicitly linked package types. They must not create two unconnected copies of the same scope. Documents under Reports are the interface to the shared document service, not a separate file store.

### 6.2 Shared record requirements

**CORE-01:** Support search, filter, saved views, attachment upload, links, comments, ownership, related actions, and immutable change history.

**CORE-02:** Proposed standard lifecycle: Draft → Submitted → Under review → Approved/Returned → Closed/Archived. Each module defines appropriate variations and transition rules.

**CORE-03:** Approval stores actor, decision, timestamp, comments, record revision, and applicable workflow version. Editing approved content creates a new revision and invalidates affected approvals according to policy.

**CORE-04:** A shared action has title, source record, assignee, accountable owner, priority, due date, status, completion evidence, and escalation route. Modules reference this record rather than creating duplicate tasks.

**CORE-05:** Import shall provide a template, field mapping, dry-run validation, row-level errors, duplicate detection, and a clear create/update summary. Imports cannot bypass authorization or workflow.

**CORE-06:** Attachments shall be validated for allowed type and size, scanned before availability, versioned when controlled, and downloaded through access-checked expiring links. Proposed limit: 100 MB per standard file; large design packages use an approved external repository link or separately configured limit.

**CORE-07:** Deletion is restricted to eligible drafts without dependencies. Approved records are superseded or archived. Retention and purge are separately governed processes.

**CORE-08:** Bulk edits shall validate each affected record, show impact, and produce a result report. Approved data, locked periods, and unavailable actions shall be excluded explicitly.

**CORE-09:** Units, currencies, disciplines, contractors, status definitions, and package types are controlled dictionaries. A used value may be retired but not removed from history.

## 7. Plugin and module architecture

### 7.1 Delivery model

The initial architecture shall use a modular application with stable module boundaries and independently registered business capabilities. Separate microservices are optional when justified by scale; installability does not require each module to be a separate service.

Distinguish two operations:

1. **Install:** An organization administrator makes an approved, compatible module version available to the organization.
2. **Enable:** An authorized project administrator activates and configures an installed module for a project.

The core shell, identity, permissions, audit, shared structures, document references, notification service, and module registry cannot be disabled. Business modules can be enabled independently subject to declared dependencies.

### 7.2 Module manifest

Each module shall declare:

```yaml
id: procurement.expediting
name: Expediting
version: 1.0.0
coreCompatibility: ">=1.0.0 <2.0.0"
phase: 1
dependencies:
  procurement.plan: ">=1.0.0 <2.0.0"
optionalIntegrations:
  - procurement.logistics
permissions:
  - expediting.view
  - expediting.edit
  - expediting.submit
  - expediting.approve
navigation:
  parent: epcic.procurement
  route: /procurement/expediting
settingsSchema: expediting-settings-v1
migrations: [001-initial]
eventsPublished: [vendor-milestone.updated, delivery.forecast-changed]
eventsConsumed: [purchase-order.approved]
```

The production manifest additionally declares publisher identity, integrity signature, capability permissions, background jobs, data entities, health checks, backup requirements, uninstall/export behavior, and support metadata. The example is an interface contract, not a commitment to a particular package manager.

### 7.3 Lifecycle requirements

**MOD-01:** Catalog states: Planned, Available, Installed, Enabled, Disabled, Updating, Failed, and Deprecated. Planned modules show delivery phase and cannot be installed.

**MOD-02:** Installation shall check compatibility, signature, dependencies, data migration requirements, and administrator permission. Arbitrary user-uploaded executable code is outside the first three phases.

**MOD-03:** Enabling a module launches a wizard for scope, master data, roles, workflows, notification defaults, integrations, and seed data. Preview affected navigation and dependencies before activation.

**MOD-04:** The dependency resolver shall identify required modules and prohibit incompatible versions and dependency cycles. Missing optional integrations degrade gracefully with a clear explanation.

**MOD-05:** Disabling removes entry points and stops new writes/jobs for that project. Preserve records and historical published reports. Downstream consumers show retained approved snapshots with source status rather than zeroing progress.

**MOD-06:** A module with active dependents cannot be disabled until those dependents are reconfigured or disabled through an impact-reviewed transaction. Re-enable restores its retained data and configuration.

**MOD-07:** Uninstall is separate from disable. Before uninstall, show dependencies, retained data, export options, active jobs, and migration implications. Physical purge requires a separate retention-authorized operation.

**MOD-08:** Upgrades shall be staged, backed up, compatibility-tested, and audited. Backward-compatible migrations are preferred. If a migration cannot safely reverse, recovery uses a validated restore or forward repair plan; never promise automatic rollback for every migration.

**MOD-09:** A module fault shall not prevent unrelated modules from loading. Show module-level unavailable states and retain shared navigation and identity services.

**MOD-10:** Installation does not grant user access automatically. New permissions default to denied until assigned through an approved template or explicit policy update.

### 7.4 Integration contracts

Modules communicate through stable APIs and domain events rather than direct modifications to each other's tables. Events contain event ID, schema version, organization/project context, source record and revision, timestamp, and correlation ID. Consumers shall tolerate duplicate and out-of-order delivery, use idempotent processing, and send unrecoverable events to a monitored failure queue.

An outbox or equivalent durable mechanism shall ensure committed business changes and emitted events remain consistent. Search indexes, dashboards, and notifications may update asynchronously; their freshness must be visible.

### 7.5 Dependency rules for the expanded scope

| Capability | Required foundation | Business-module relationship |
|---|---|---|
| Project selection and level/person policy | Core project/membership/authorization services | Always available to authorized administrators; cannot be removed as a business plugin |
| Canonical tasks, PIC resolution and approval actions | Core action/task service, membership, audit and notifications | Required by workflows; task workspace screens are separately assignable |
| My Workspace private organizer | Core identity and personal task service | Core user capability; shows project tasks only when current project-task access permits |
| Tasks Management project screens | Core tasks and PIC service | Enable/assign as a business module; disabling the screens does not stop required actions inside other enabled modules |
| Document Control | Core files/revisions, tasks, workflows, membership and dictionaries | MDR/EMDR can reference shared packages without requiring Engineering UI to be enabled |
| Engineering with controlled-document reviews | Shared packages and core measurement | Full review functionality requires Document Control; basic imported deliverable status may operate under a declared limited mode |
| Construction / T&I / handover document gates | Shared gate service and document references | If a mandatory gate uses Document Control, dependency checks prevent its disable/removal until an approved replacement source is configured |

Disabling a module shall cancel its obsolete module-owned reminders and writes, but shall not cancel unrelated core workflow tasks merely because a Tasks Management screen is unavailable. Tasks linked to a disabled source remain attributable and show the source's current availability; completion/reassignment follows the approved disable plan. Required responsibility records cannot disappear through navigation changes.

## 8. Functional module specifications

Every module below inherits the shared permission, audit, attachment, filtering, import/export, revision, reminder, and accessibility requirements.

### 8.1 Dashboard — Phase 1

**DASH-01:** Provide role-based templates: PM overview, function manager, team leader, personal workload, and restricted client overview. Users may reorder permitted widgets and save personal layouts; PMs may publish project defaults.

**DASH-02:** Widgets include approved overall progress, planned versus actual S-curve, forecast milestones, overdue actions, engineering deliverables, procurement delivery risks, top issues/risks, interfaces awaiting response, and reporting completeness. Add construction, HSE, QAQC, and commissioning widgets when their modules are enabled.

**DASH-03:** Filters include project, reporting period, discipline, area, contractor, and work package where applicable. Show active filters consistently across widgets.

**DASH-04:** Every KPI displays unit, as-of date, source state, and drill-down. Show unavailable or stale data explicitly. Dashboard totals must reconcile with the matching approved report snapshot.

**Acceptance:** A client sees only approved widgets and released data; disabling Materials does not break the dashboard; a PM can reconcile the overall percentage to approved package records.

### 8.2 Engineering / Work packages — Phase 1 foundation, Phase 2 expansion

**ENG-01:** Configure package types, disciplines, numbering, mandatory fields, review stages, and measurement rules. Package fields: code, title, scope, WBS, discipline, area/system, owner, planned/forecast/actual dates, weight, deliverables, dependencies, and status.

**ENG-02:** Maintain a deliverable register with document number, title, discipline, revision, contractor, responsible engineer, reviewer, planned issue dates, actual issue dates, purpose/status, review outcome, and client release classification.

**ENG-03:** Phase 1 supports manual or imported deliverable updates, shared document links, review cycles, late deliverables, weighted progress, and interfaces to Procurement and Construction. Phase 1 Document Control (Section 8.20) provides transmittals and structured review-comment consolidation. Phase 2 adds advanced document-system synchronization and optional technical-query automation.

**ENG-04:** Deliverable progress uses configured stage credits or quantity rules. Repeated revisions do not earn the same stage credit twice. A rejection or supersession follows the approved measurement policy and records its effect.

**ENG-05:** Views: package register, deliverable table, discipline summary, review queue, and look-ahead. KPIs: approved deliverables, late issues, review aging, forecast variance, and weighted engineering progress.

**Acceptance:** Settings can add a new package type without code changes; an approved drawing revision remains traceable after supersession; the same package is visible in Planning without duplicate progress.

### 8.3 Procurement Plan — Phase 1, user-specified

**PROC-01:** Maintain procurement packages, material requisitions, bid/award milestones, and purchase order references. Fields include package code, description, WBS, discipline, buyer, vendor, requisition date, inquiry date, bid evaluation date, award date, PO date, contractual delivery, required-on-site date, forecast delivery, criticality, and document references.

**PROC-02:** Support lifecycle: Planned → Requisition ready → Inquiry → Evaluation → Awarded → PO issued → In execution → Delivered → Closed, with project-specific stages and controlled exceptions.

**PROC-03:** Link required-on-site dates to consuming activities/packages. Forecast slippage shall create a delivery-risk flag and optional issue/action; it shall not silently change the receiving construction baseline.

**PROC-04:** Commercial fields, if captured, have separate permissions. An operational procurement view shall remain usable without exposing prices or commercial evaluations.

**PROC-05:** Views: procurement register, milestone timeline, buyer workload, critical items, and package detail. KPIs: awards due/late, PO placement versus plan, packages at delivery risk, and upcoming delivery commitments.

**Acceptance:** Imported packages report duplicate codes; a changed delivery forecast identifies affected packages; commercial fields remain excluded from client views and exports.

### 8.4 Expediting — Phase 1, user-specified

**EXP-01:** Track vendor milestones for engineering approval, raw material readiness, manufacture, inspection, testing, release, packing, and dispatch. Fields include PO/line, vendor, item quantity, milestone, baseline/forecast/actual dates, evidence, expeditor, and next follow-up.

**EXP-02:** Record vendor visits, contact logs, promised dates, photographs, inspection release references, concerns, mitigation, and responsible persons. Support partial quantities and split deliveries.

**EXP-03:** Status: Not started → In progress → Awaiting inspection/release → Released → Dispatched → Complete, with blockers recorded separately.

**EXP-04:** Compute vendor and package progress using approved stage weights, keeping manufacturing progress distinct from physical delivery. Generate reminders for follow-ups and slippage escalation.

**EXP-05:** Phase 1 provides manual dispatch and receipt references. Phase 2 transfers released items to Logistics and reconciles material receipts without recreating PO lines.

**Acceptance:** A split delivery preserves outstanding quantities; repeated vendor updates do not double-count stage credit; a missed critical milestone triggers one deduplicated escalation per configured interval.

### 8.5 Logistics — Phase 2, user-specified

**LOG-01:** Maintain shipments and shipment lines linked to PO lines, packing lists, vendor releases, and receiving locations. Fields include mode, carrier, route, shipment reference, dimensions/weight, planned/actual departure and arrival, customs status, delivery terms reference, and shipping documents.

**LOG-02:** Lifecycle: Planned → Booking confirmed → Ready → In transit → Customs/clearance → Arrived → Received/Exception → Closed. Support multiple transport legs and partial receipts.

**LOG-03:** Record shipping exceptions, damage, missing documentation, delivery appointment, and proof of receipt. Integration with Materials shall reconcile shipped, received, rejected, and outstanding quantities.

**LOG-04:** Views: shipment board, timeline, upcoming arrivals, exceptions, and location-based list. KPIs: on-time arrival, transit variance, clearance aging, and incomplete shipments.

**Acceptance:** Partial and damaged receipts create the correct available/quarantined stock quantities and retain shipment evidence.

### 8.6 Materials — Phase 2, user-specified

**MAT-01:** Maintain material master, tag/serial or heat/batch references where applicable, units, warehouse/bin, stock condition, certificates, preservation requirements, and package demand.

**MAT-02:** Transactions: receive, inspect, accept/quarantine/reject, reserve, issue, return, transfer, adjust, and scrap. Every movement records quantity, unit, location, actor, time, and source document.

**MAT-03:** Prevent negative available stock and concurrent over-reservation. Quarantined stock cannot satisfy a readiness gate. Unit conversions require a controlled compatible conversion rule.

**MAT-04:** Workfront demand shall show required, available, reserved, issued, and shortage quantities. Maintain material traceability to package, installation record, and certificate when required.

**MAT-05:** Views: inventory, shortages, receiving queue, preservation due, and movement history. KPIs: material availability, shortages by workfront, receipt discrepancies, and overdue preservation.

**Acceptance:** Two users cannot reserve the same final item; a returned item restores availability only after the required condition check.

### 8.7 Planning & Progress — Phase 1

**PLAN-01:** Maintain WBS, shared work packages, schedules, reporting calendars, baseline revisions, activity dependencies, and milestones. Package configuration resides in Settings and may include discipline-specific fields and stage credits.

**PLAN-02:** Overall progress shall roll up approved measurements through the configured hierarchy. Display baseline, planned-to-date, actual-to-date, forecast, period achievement, variance, and data completeness.

**PLAN-03:** Milestone fields: code, title, category, WBS/package, owner, baseline date, current forecast, actual date, acceptance evidence, predecessor references, criticality, and client visibility. Completion requires the configured evidence and acceptance.

**PLAN-04:** Reporting workflow: Open period → Enter/import → Validate → Submit → Review → Approve → Publish → Lock. Reopening a locked period requires permission, reason, and a revised snapshot; the original remains accessible.

**PLAN-05:** Phase 1 supports manual activity entry and validated CSV/XLSX imports with baseline/forecast comparison. It does not claim automatic critical-path scheduling. Phase 2 may add an approved scheduler integration; Phase 3 adds richer sequence and dependency views.

**PLAN-06:** Support S-curves, milestone trends, package comparison, look-ahead, and exception lists. Flag missing updates and dates inconsistent with predecessor completion.

**Acceptance:** Approved period totals reproduce exactly from their stored weights, scope and source revisions; a rebaseline does not rewrite previously published results.

### 8.8 Construction — Phase 2 foundation, Phase 3 spatial/sequence expansion

**CON-01 — Yard layout (Phase 2):** Upload a revision-controlled yard drawing/image, define zones, and pin packages, storage, access routes, cranes, laydown areas, and constraints. Support legend, search, linked records, zoom, and effective dates. Phase 2 pins are indicative unless scale is explicitly calibrated.

**CON-02 — Facility layout (Phase 3, user-specified):** Provide revision-controlled facility drawings with levels, areas, systems, equipment tags, layers, and issue/workfront overlays. Link each annotation to a drawing revision; reconcile or mark unresolved annotations on drawing replacement. Full 3D/BIM is a separate optional extension.

**CON-03 — Workfront (Phase 2):** Define scope, location, responsible leader, predecessor activities, drawings, materials, permits, access, resources, inspection needs, and release date. Readiness checklist evaluates mandatory gates. Lifecycle: Draft → Constraint review → Ready → Released → In execution → Complete → Accepted.

**CON-04 — Readiness:** Each gate shall identify source, evaluator, evidence, expiry, and allowed waiver policy. Critical gates cannot be bypassed by changing a status field. New constraints may suspend or revoke release with an audit trail and notifications.

**CON-05 — Construction sequence (Phase 3, user-specified):** Provide ordered activities, dependencies, hold points, resource/access constraints, and scenario comparison. Detect cycles and conflicts. Publishing a scenario creates an approved sequence revision; it does not automatically overwrite the schedule baseline.

**CON-06 — Progress and KPI (Phase 2):** Capture installed and accepted quantities by package, area, contractor, and discipline. Configurable examples: Structural tonnes/joints; Piping weld diameter-inches/spools/metres; Mechanical equipment sets/alignment/testing; E&I cable metres/terminations/instruments/loops. Never add incompatible units directly.

**CON-07 — Productivity (Phase 2):** Capture direct hours, crew, shift, quantities, rework, lost-time categories, and benchmark norms. Show hours per unit or units per hour with the exact unit basis. Distinguish installed work from accepted work and direct from total hours.

**CON-08:** Provide daily report entry, weekly trends, constraint aging, discipline dashboards, productivity comparison, and approved quantity adjustment history.

**Acceptance:** Unavailable material prevents the configured workfront release; Structural and Piping quantities roll up through weights rather than raw addition; a layout revision preserves previous annotations and audit context.

### 8.9 Fabrication Subcontracting — Phase 2

**SUB-01:** Register subcontractor, contract reference, assigned packages, scope, reporting obligations, baseline quantities, and responsible coordinator. Commercial values are optional and separately restricted.

**SUB-02:** Capture subcontractor planned/actual/forecast progress, quantities, hours, evidence, recovery plans, and review decisions. External users see only their assigned company and packages.

**SUB-03:** Concerns and highlights include category, description, impact, severity, owner, raised date, due date, action link, reporting inclusion, and client visibility. A concern may create an Issue without duplicating its resolution task.

**SUB-04:** Reviewed subcontractor quantities feed the corresponding Construction package. Choose one authoritative measurement source to prevent counting the same scope twice.

**Acceptance:** One subcontractor cannot discover another's data; accepted subcontract progress reconciles to Construction; rejected submissions remain visible in history but do not earn progress.

### 8.10 Onshore Precom-Commissioning — Phase 3

**COM-01 — Systems/subsystems:** Maintain system hierarchy, boundaries, tags, ownership, prerequisites, phase, readiness status, blocking punches, and highlights. Allow engineering packages and construction scope to map to multiple systems with explicit allocation.

**COM-02 — Sequence:** Define approved precommissioning and commissioning steps with prerequisites, test procedures, isolation/permit references, responsible roles, hold points, and acceptance criteria. Prevent progression through unresolved mandatory gates.

**COM-03 — Handover schedule:** Track planned, forecast, and actual handover by subsystem/system; include boundary description, completion dossier, certificates, signatures/approvals, recipient, outstanding exceptions, and acceptance evidence.

**COM-04 — Check sheets:** Provide versioned templates by equipment/test type. Instances contain tag, system, sheet revision, required checks, readings and units where relevant, attachments, executor, verifier, and approval. Lifecycle: Assigned → In progress → Submitted → Returned/Verified → Accepted.

**COM-05 — Check-sheet KPI:** Show assigned, completed, submitted, accepted, overdue, and rejected counts. Numerators and denominators use the same approved applicable scope; cancelled or not-applicable sheets require justification and scope revision.

**COM-06 — Punch management:** Record punch ID, category, system/tag/location, description, originator, owner, evidence, target date, blocking effect, rectification, verification, and closure. Lifecycle: Open → Assigned → Rectified → Awaiting verification → Closed/Reopened.

**COM-07 — Punch KPI:** Show opening balance, raised, closed, reopened, closing balance, aging, overdue, and blocking items by category. Rectification alone does not count as verified closure.

**COM-08:** Handover readiness aggregates mandatory check sheets, tests, documents, and punches. Exceptions require designated approval and explicit inclusion in the handover package.

**Acceptance:** A blocking punch prevents system handover; reopening a punch updates readiness without erasing an earlier certificate; an approved dossier records the exact revisions used.

### 8.11 QAQC — Phase 2

**QA-01:** Manage inspection and test plans, inspection requests, hold/witness points, inspection results, nonconformance reports, corrective actions, and quality certificates linked to packages, materials, tags, and systems.

**QA-02:** Inspection requests include scope/location, procedure/drawing revision, inspection type, readiness evidence, requested date, inspector, result, and supporting records. Hold points require explicit release by an authorized role.

**QA-03:** NCR workflow: Raised → Reviewed → Disposition proposed → Approved → Implemented → Verified → Closed. Capture cause, affected scope, repair/rework evidence, and recurrence actions.

**QA-04:** Link quality acceptance to earned construction quantities where configured. Failed inspections retain installed quantity but may withhold accepted progress until resolution.

**QA-05:** KPIs: inspection acceptance rate, first-pass acceptance, NCR aging, overdue corrective actions, and quality holds. Denominators and reinspection treatment shall be explicit.

**Acceptance:** A failed hold-point inspection blocks downstream release; NCR closure requires independent verification when the workflow demands it.

### 8.12 HSE — Phase 2

**HSE-01:** Maintain observations, incidents, near misses, hazards, inspections, toolbox meetings, corrective actions, and permit references. Restrict sensitive incident details and personal information by field and role.

**HSE-02:** Incident records include event time/location, classification, factual description, involved organization, immediate response, investigation owner, evidence, causes, actions, and review status. Sensitive health details should reside only in explicitly authorized fields or linked approved systems.

**HSE-03:** Support stop-work/constraint records linked to a workfront, release conditions, and authorized clearance. Project Flow is a coordination record unless separately qualified as the project's permit system.

**HSE-04:** KPIs include observations, overdue actions, inspection completion, hours worked, and configurable incident rates. Rate categories and normalization factors must be visible and versioned; no assumed jurisdiction-specific formula is hardcoded.

**HSE-05:** Urgent HSE notices may bypass quiet hours only under an approved notification policy. The application is not the sole emergency communication channel.

**Acceptance:** A restricted incident does not appear in unauthorized search, exports, notifications, or analytics; a cleared stop-work record identifies the authorized clearing user and evidence.

### 8.13 Transportation & Installation (T&I) — Phase 3

**TI-01 — Workpacks:** Maintain installation scope, cargo/equipment, location, lift or installation procedure references, required documents, vessel/spread assignment, personnel/resource requirements, predecessor packages, readiness checks, and acceptance evidence.

**TI-02 — Timeline/schedule:** Track mobilization, loadout, sailaway, arrival, installation, surveys, completion, and demobilization with baseline/forecast/actual dates and configurable working windows.

**TI-03 — Sequence:** Show ordered operations, technical hold points, weather-window references, dependencies, and contingency paths. Weather or vessel integrations are optional; manually entered assumptions must be labeled and timestamped.

**TI-04 — Progress:** Measure accepted stages/quantities per workpack, daily achievements, delays, downtime reasons, and remaining scope. Separate vessel utilization from physical installation progress.

**Acceptance:** A workpack cannot be released without mandatory approved procedures and readiness evidence; a vessel conflict appears before schedule publication; acceptance links to the completed installation evidence.

### 8.14 Offshore Hook-Up & Commissioning (HUC) — Phase 3

**HUC-01 — Marine spread:** Register vessels, barges, accommodation/support assets, roles, capacities, planned/actual availability, allocation, operating location, and restrictions. Track people-on-board summary and limits if enabled, without exposing personal lists to unauthorized users.

**HUC-02 — Timeline:** Coordinate hook-up activities, offshore commissioning, system access, marine dependencies, and handover windows. Detect overlapping resource bookings and show onshore handover dependencies.

**HUC-03 — Progress:** Capture daily/weekly package and system progress, accepted quantities, checks completed, punches closed, constraints, productive/nonproductive hours, and forecast completion.

**HUC-04:** Reuse the shared system, check-sheet, punch, and handover entities. Distinguish onshore and offshore execution locations rather than creating disconnected registers.

**Acceptance:** An onshore handover delay flags dependent offshore work; the same punch cannot be counted as closed twice; unavailable marine resources block affected readiness rules.

### 8.15 Management — Phase 1 foundation

Each register is separately enableable under the Management group.

**MGT-RISK:** Fields: risk ID, cause/event/effect, category, owner, probability, impact dimensions, inherent rating, response strategy, mitigation actions, residual rating, trigger, review date, status, and related packages. Configure a scoring matrix and version it. Views: register, heatmap, top risks, and review queue. Materialized risks link to Issues without deleting the risk history.

**MGT-ISSUE:** Fields: issue ID, description, source, severity, impact, owner, target resolution, containment, actions, resolution evidence, and closure approver. Workflow: Open → Triaged → In progress → Resolved → Verified/Closed; support reopen. Show overdue and aging by owner and discipline.

**MGT-LESSON:** Fields: context, event, cause, result, recommendation, applicability, phase, discipline, author, reviewer, tags, and reusable action. Workflow: Draft → Reviewed → Published → Archived. Cross-project sharing requires explicit classification and permission.

**MGT-MOC:** Fields: change request, originator, reason, scope affected, alternatives, cost/schedule/resource/quality/HSE/interface impacts, attachments, reviewers, decision, effective date, and implementation verification. Workflow: Draft → Impact assessment → Review → Approved/Rejected → Implementing → Verified → Closed. Phase 1 supports manual impact estimates; Phase 2 links richer downstream data. Approved changes create controlled scope/baseline revisions, never overwrite history.

**MGT-STAKE:** Fields: person/organization, role, influence/interest, contact details, communication needs, engagement owner, cadence, and confidentiality. Views: register, engagement matrix, and communications due. Restrict contact data and internal assessments from client exposure by default.

**Acceptance:** A change cannot alter an approved baseline before approval; an issue cannot close without required evidence; client access does not reveal internal stakeholder assessments.

### 8.16 Interface Management — Phase 1 foundation, Phase 2 expansion

**INT-01 — Register:** Record interface ID, type, description, originating party, receiving party, accountable coordinator, disciplines, systems/packages, required deliverable, need date, response date, status, and acceptance criteria.

**INT-02 — Points:** Each interface may contain multiple points with distinct boundary/location, technical responsibility, input/output requirement, owner, dates, linked documents, actions, and acceptance evidence.

**INT-03 — Matrix:** Generate party-to-party, discipline-to-discipline, and package-to-package matrices from registered interfaces. Cells show authorized open/overdue/accepted counts and drill down to source records. The matrix is not a separate manually maintained dataset.

**INT-04:** Workflow: Identified → Assigned → Information requested → Responded → Under review → Agreed → Closed. Both sides acknowledge nominated interface deliverables when required.

**INT-05:** Phase 1 includes register, basic matrix, points, and reminders. Phase 2 adds advanced boundary visualization, bulk coordination, and external-party submission workflows.

**Acceptance:** An interface response without required receiving-party acceptance remains open; matrix totals reconcile with filtered register counts.

### 8.17 Event Management — Phase 1

**EVT-01:** Support meetings, reviews, inspections, workshops, deadlines, and project events with title, category, organizer, participants, timezone, start/end, location/link, recurrence, agenda, attachments, and source records.

**EVT-02:** Provide calendar, agenda, and list views; date-range, discipline, owner, and event-type filters; reminders; attendance and meeting-minute links.

**EVT-03:** Recurrence edits distinguish one occurrence from the series. Cancellation notifies authorized participants. External invitations are sent only after an authorized user selects recipients and confirms sending.

**EVT-04:** Phase 1 offers downloadable calendar files and in-app scheduling. Two-way external calendar synchronization is a later optional integration.

**Acceptance:** Events display correctly across user/project timezones and daylight-saving changes; recurring-event edits do not create duplicate reminders.

### 8.18 Reports — Phase 1 foundation, Phase 2 analytics expansion

**REP-01 — Minutes of Meetings:** Capture meeting reference, date, participants, apologies, agenda items, discussion summary, decisions, actions, owners, deadlines, attachments, and distribution. Workflow: Draft → Review → Issued → Revised. Shared actions stay linked across subsequent meetings rather than being copied.

**REP-02 — Documents:** Maintain controlled metadata, revisions, classifications, review/approval, access, related records, and released download links. Phase 1 uses the full Document Control module (Section 8.20), including register, revisions, transmittals/acknowledgments and review routes; Phase 2 adds advanced external repository integration.

**REP-03 — Analytics:** Phase 1 provides predefined dashboards, discipline progress, milestone, procurement, risk/issue, interface, and overdue-action reports. Phase 2 adds a governed custom report builder, cross-module comparisons, and scheduled delivery.

**REP-04:** Report configuration includes period, filters, baseline, audience, charts, sections, comments, branding, and output format. Support PDF for formal distribution, XLSX/CSV for tables, and permission-checked in-app links. Escape spreadsheet formula-like input on export.

**REP-05:** Formal reports are immutable snapshots with version, generation time, data cutoff, source revisions, approval, recipient scope, and supersession links. A live dashboard must not be presented as a locked report.

**REP-06:** Scheduled distribution revalidates each recipient's current access at send time. External emails should use controlled links by default; attachment distribution requires an explicit publication choice.

**Acceptance:** A published report remains reproducible after source changes; restricted columns never appear in exported files; action closure updates the current meeting view while preserving issued minutes.

### 8.19 Tasks Management — Phase 1

#### 8.19.1 Workspace separation

**TASK-01 — My Workspace:** Provide My day, Inbox, Upcoming, Overdue, Assigned to me, Assigned by me, My approvals, and personal task lists. Show personal tasks plus tasks the user is authorized to access across projects. Every project task displays project code/name and source module. Filters include project, due date, status, priority, assigner, and source. This is an explicit cross-project view; it does not change the current project automatically.

**TASK-02 — Personal tasks:** A private task belongs to its creator and has no project membership requirement. Support title, description, dates, priority, checklist, reminders, private notes and optional authorized source link. Other users, including project managers, cannot inspect private tasks by default. Organization retention and authorized exceptional administrative access follow the declared policy. Personal tasks cannot be assigned to other users; assigning or sharing requires conversion to a project task with a visibility preview.

**TASK-03 — Project workspace:** Provide list, Kanban board, calendar, workload-by-assignee, approvals, and package/module views for the current project. Project tasks include project ID, task code, title, description, source module/record, WBS/package, discipline, area/system, accountable owner, primary assignee/PIC, collaborators, reviewer, priority, status, start/due dates, estimate, time spent if enabled, dependencies, evidence, and visibility classification.

**TASK-04 — Conversion:** Converting a personal task into project work creates a new project task linked by a private conversion reference. Show exactly which fields, comments, attachments, and participants will be shared; copy only selected content. Revalidate destination project access and assignment permission. A project task cannot be made private to conceal its execution history.

#### 8.19.2 Assignment and PIC integration

**TASK-05:** PIC means Person in Charge. Configure responsibility slots by project, module, discipline, company, work package, record type, and action type. A slot may resolve to a project position, team queue, or named person. The approved lookup order is record-specific PIC → package PIC → discipline/module PIC → designated project coordinator. Display the selected source and effective dates. An unresolved assignment remains in a visible coordination queue and triggers an administrator alert.

**TASK-06:** Assign only to active, eligible project members. Assignment is not an access grant. Before assigning, validate the recipient's task access and the minimum authorized source access. If absent, block assignment or create a separate access request for an authorized administrator. Never silently expose the source record. A person may receive a deliberately redacted standalone task only when a workflow explicitly allows it and records the restricted link.

**TASK-07:** A task has one accountable owner and one primary assignee; additional contributors are supported. An optional acceptance step allows Accept / Request reassignment. Rejection of assignment requires a reason and returns responsibility to the owner or queue; the task must never disappear.

**TASK-08:** Module actions shall use the same canonical Task entity as project Tasks Management. Existing Action records shall migrate to or become a compatible view of Task, retaining IDs or durable aliases and history. A risk mitigation, MoM action, expediting follow-up, document review action, interface response, or punch rectification task appears in the relevant module and Tasks Management without duplicate due dates or completion records.

**TASK-09:** SourceLink records module, entity, record ID, revision, workflow step, and relationship type. Generated-task uniqueness uses source + revision/cycle + step + responsible slot. Retries shall not create duplicates. One task may link to multiple supporting records; its authoritative workflow source remains explicit.

**TASK-10:** Source-driven task completion follows the source workflow. Completing a review task requires a review decision; closing a rectification task does not close the punch until verification. Workflow-owned status/due-date fields are read-only in the generic task editor, with a link to the allowed source action. Updates propagate through idempotent events with a visible pending-sync state and reconciliation job.

**TASK-11:** When a PIC changes, show all affected open tasks and offer keep existing assignments, transfer selected tasks, or apply to future tasks only. Record old/new assignees, actor, reason, effective date, notifications, and approval impacts. Closed tasks retain their original attribution. Temporary delegation has an expiry and does not grant additional data access.

#### 8.19.3 Task workflow and controls

**TASK-12:** Default lifecycle: Draft → Assigned → Accepted/In progress → Blocked/On hold → Submitted for review → Completed → Closed; support Returned, Cancelled, and Reopened. A simple task may omit formal review; source-generated approval tasks follow their source lifecycle. Cancellation and reopening require reasons. Store blockers as structured links, not only free text.

**TASK-13:** Support subtasks, finish-to-start dependency links, recurring tasks, watchers, comments, attachments, reminders and escalation. Reject dependency cycles. Cross-project dependencies require permission to both projects and reveal only authorized metadata. Recurrence creates distinct dated instances and supports editing one occurrence or future instances.

**TASK-14:** Only permitted managers may bulk assign, change due dates, or close tasks; show scope and exclusions. Team workload uses only project tasks and explicitly shared estimates. Private tasks and private time allocations do not appear in manager charts. Task percentages never contribute automatically to EPCIC physical progress unless a separately approved measurement rule declares that relationship.

**TASK-15:** Boards support status moves subject to transition validation; provide equivalent keyboard actions. Task detail shows project context, assignee/PIC source, dependencies, related records, and completion requirements. Dashboard widgets include My overdue tasks, Unassigned project tasks, and Tasks awaiting review.

**Acceptance:** A MoM action appears once in personal and project views; changing its due date updates both; a task assigned in Project A is never assigned using Project B's title or level; an unauthorized recipient cannot gain document access through assignment; a source-approved completion is reflected without bypassing review.

### 8.20 Document Control — Phase 1 controlled delivery, Phase 2 integration expansion

Document Control is an independent business module using the core file/revision service. Engineering, Procurement and Reports link to its canonical records. The Reports → Documents page becomes an authorized view of Document Control. The complete Phase 1 scope below supersedes the earlier Phase 2 timing of full transmittal and review processing in ENG-03 and REP-02; Phase 2 retains advanced integrations and automation.

#### 8.20.1 Registers, work packages, and metadata

**DOC-01 — MDR:** Provide a project-wide Master Document Register covering engineering, vendor, construction, quality, HSE, installation, commissioning, and handover deliverables. Each document has one canonical ID, one controlled revision chain, and one owning party. Register memberships and package associations shall not duplicate the file or review history.

**DOC-02 — EMDR:** Provide configurable Engineering Master Document Registers per engineering work package, discipline, subcontractor, or defined scope. A document may appear in several register views with one owning register and explicitly allocated reporting credit. Project settings define the exact EMDR terminology, package hierarchy, document categories and inclusion rules. Consolidation into the MDR shall be automatic and traceable.

**DOC-03:** Required metadata: document number/title/type, originator/company, discipline, WBS, owning package, related packages/systems/tags, register membership, responsible engineer/PIC, document controller, reviewer groups, confidentiality, revision, issue purpose, suitability/use status, contractual requirement, planned/forecast/actual issue dates, review deadline, applicable review routes, current internal/client/CA/MWS disposition, supersession links and distribution class. Vendor documents also link to PO/package and vendor document number.

**DOC-04:** Project numbering settings define segments, separators, sequence, prefix, revision syntax, uniqueness and reserved numbers. Validate project + document number uniqueness and revision uniqueness within a document. A display-number correction retains immutable IDs and aliases, with change reason. Planned MDR entries may exist before any file is uploaded.

**DOC-05:** MDR/EMDR views include planned versus issued, revision history, pending review, overdue response, returned documents, package completeness, distribution status, and handover readiness. Provide column presets, filters, bulk metadata import, and reconciliation of register totals.

#### 8.20.2 Controlled revisions and transmittals

**DOC-06:** Maintain separate dimensions for revision lifecycle, issue purpose, technical disposition, and distribution state. Example: a revision can be Issued for Review, receive a Commented response, and still be awaiting MWS response. Do not collapse these into one “Approved” status.

**DOC-07:** Proposed lifecycle: Planned → Draft/uploaded → Internal check → Authorized for issue → Transmitted → Review in progress → Response received → Closed for cycle / Revision required → Superseded/Archived. Issue purposes such as review, approval, information, construction and as-built are configured by project; abbreviations are mapped, not assumed universal.

**DOC-08:** Uploads require file validation, controlled revision metadata, duplicate checks and immutable checksum. Replacement of a transmitted file creates a new revision or controlled correction; it cannot overwrite the transmitted binary. Optional working-copy locks have expiry and administrator release with audit.

**DOC-09 — Transmittals:** Create incoming/outgoing transmittals with number, sender, recipients, purpose, due date, exact document revisions, attachments, message, distribution list and acknowledgment requirements. Validate recipient access and classification before issue. Issue locks the document/revision list and creates immutable distribution evidence. Recall/correction generates an auditable notice; it cannot remove a recipient's previously downloaded copy.

**DOC-10:** Support submission batches and partial returns. Store actual sent/received timestamps, external reference, acknowledgment, bounce/failure and follow-up. External secure links are recipient-scoped and expiring. Downloads recheck access. Where external responses are uploaded by a controller, identify the external respondent and the recording user separately.

#### 8.20.3 Internal, client, CA, and MWS reviews

**DOC-11:** Configure review organizations and routes independently: internal interdisciplinary, client, CA and MWS. MWS denotes Marine Warranty Surveyor. The project administrator shall confirm the meaning and scope of **CA** for the contract—such as Certification Authority or another named review body—before publishing the route. A reviewer group's label alone never implies legal or technical authority.

**DOC-12:** Routes support sequential or parallel review, applicability by document type/package/issue purpose, lead reviewer, mandatory reviewers, consolidation owner, due-date calendars and return codes. A mandatory external route must be completed unless a permitted waiver is approved with reason, scope, expiry and evidence. Late response never automatically means approval unless an explicit contractual rule is configured and auditable.

**DOC-13:** Review assignments create canonical tasks resolved through PIC settings. External reviewers have narrow organization/project/package access, or respond through controlled links/manual recorded returns. Client, CA and MWS memberships remain distinct even when one person holds multiple assignments.

**DOC-14:** Each review cycle binds to an exact revision, submission, applicable route version, reviewer, response code, dates, attachments and authority. A new revision starts a new cycle or a controlled carry-forward review. Approval of an older revision must never appear as approval of the latest revision.

**DOC-15 — Comments:** Capture comment ID, reviewer/company, document revision, page/section, discipline, severity/category, text, assigned PIC, response, proposed resolution, evidence and status. Statuses: Open → Responded → Awaiting reviewer acceptance → Closed/Reopened. Track carried-forward comments across revisions. Author replies do not automatically close reviewer comments.

**DOC-16:** Phase 1 supports structured comment sheets and uploaded annotated files. Native browser PDF annotation, optical comparison and automated extraction are Phase 2 candidates. Consolidation preserves original reviewer comments and identifies conflicting responses for resolution by the authorized lead.

**DOC-17:** Return codes and their meanings are project-configured and versioned. A suggested template is Accepted; Accepted with comments; Revise and resubmit; Rejected; Information only. Each mapped code specifies reissue requirement, use restrictions and gate effect. Do not assume identical codes between client, CA and MWS.

**DOC-18:** Effective release-for-use status is calculated from all applicable mandatory review results and unresolved blocking comments. Example: internal acceptance plus client acceptance cannot release a document for an operation if required MWS review is still outstanding. A document's use permission shall be separate from the progress credit earned for submission/review stages.

#### 8.20.4 Distribution, supersession, and metrics

**DOC-19:** Maintain controlled distribution lists by project position, organization, discipline and work package. Show authorized users the current applicable revision and superseded warning. QR/link references point to a controlled current-revision resolver while retaining access to permitted historical revisions. Offline/printed copies display revision and generation time.

**DOC-20:** Link document applicability to workfront, procurement release, inspection, T&I readiness and handover gates. Revocation/supersession creates an impact review for dependent gates; it must not silently delete previous release decisions. Gate reevaluation follows the configured project procedure.

**DOC-21:** KPIs include planned/issued/accepted documents, first-pass acceptance, review aging, overdue client/CA/MWS responses, open blocking comments, package completeness and as-built readiness. Every metric declares applicable scope, revision basis, cutoff, and whether it counts documents, revisions or review cycles. Avoid double counting documents listed in multiple EMDRs.

**DOC-22:** Export register snapshots, revision histories, transmittal sheets, comment-response sheets and dossier indexes with audience-aware permissions. Archive packages include file manifest, checksums, metadata, review decisions and distribution history. Retention/legal holds apply to revisions and returns as well as files.

**Acceptance:** A document shared by two package EMDRs appears once in the consolidated MDR; a revision awaiting required MWS review remains blocked; CA and client response codes remain distinguishable; a transmitted file cannot be overwritten; a PIC change reassigns selected open review tasks with history; Reports and Engineering open the same document ID.

### 8.21 Additional recommended project-management modules

The following fill useful management gaps. They are recommended optional scope; the revised 68-week baseline includes the foundation links and shared data needed to add them, not full implementation of every extension.

| Module | Why it is useful | Minimum detailed scope | Proposed timing |
|---|---|---|---|
| Correspondence & Technical Queries | Controls formal requests and decisions outside document revisions | Incoming/outgoing correspondence, TQ/RFI number, sender/recipient, package, question, response, due date, disposition, attachment, PIC and escalation; reference relevant documents/MOC without treating every answer as an approved change | Basic correspondence in Phase 1 Document Control; dedicated TQ/RFI workflows optional Phase 2+ |
| Project Responsibility / Organization | Resolves who owns work and review obligations across changing teams | Project organization chart, positions, PIC directory, RACI by package/module, alternates, effective dates, vacancy and transfer checks | Foundation required Phase 1; visual organization/RACI editor optional Phase 2 |
| Cost, Forecast & Commitments | Connects delivery decisions to financial impact | CBS/WBS mapping, approved budgets, commitments, actuals import, accruals, forecast to complete, contingency, change linkage and restricted commercial reporting | Optional Phase 2+; separate approved estimate |
| Contracts, Variations & Obligations | Tracks contractual commitments and time-sensitive notices | Contract register, parties, deliverables, obligations, notice deadlines, variations/claims, correspondence and approved changes; preserve project-specific terms | Optional Phase 2+ |
| Resource & Equipment Planning | Makes labor/equipment demand and allocation visible | Team/crew capacity, calendar, package demand, allocation conflicts, mobilization, competencies/certificate expiry where authorized | Optional Phase 2+; avoid duplicating marine asset records |
| Assurance & Readiness Gates | Coordinates cross-discipline stage reviews | Gate templates, required evidence, responsible approvers, findings, exceptions, expiry and release history | Shared gate service Phase 2; optional dedicated module Phase 3+ |
| Project Closeout | Prevents incomplete records and outstanding obligations at closure | Closeout checklist, final documents/as-builts, warranties, training/spares evidence, final actions, lessons, acceptance, archive manifest and retention handover | Optional Phase 3+ using existing dossier services |

Constraints remain part of shared actions, issues and Workfront readiness; approvals remain a shared service; vendors/subcontractors remain scoped company records. Do not add parallel modules that duplicate these authoritative records.

## 9. Progress, KPI, and reporting rules

### 9.1 Canonical measurement rules

**KPI-01:** Each progress-bearing leaf scope selects one authoritative method:

- Quantity-based: `accepted quantity / approved budget quantity × 100`.
- Weighted stages: `sum(earned stage weights) / sum(applicable stage weights) × 100`.
- Weighted children: `sum(child weight × child percentage) / sum(child weights)`.
- Binary milestone: 0% until accepted, then 100%, unless a different staged rule is approved.

Stage weights are nonnegative and total 100% within the approved scope. Parent weights are validated at each level. For quantity-based credit, excess accepted quantity is shown as an overrun but earned progress is capped at 100% until an approved scope change adjusts the budget.

**KPI-02:** Zero or missing denominators produce “Not calculable,” not zero or infinity. Incomplete required inputs produce an incomplete/stale marker and block formal publication unless an approved reporting exception records the treatment.

**KPI-03:** Display precision defaults to one decimal percentage point; calculations retain higher precision. Round only for presentation. A date forecast is separate from percentage complete.

**KPI-04:** Overall EPCIC weights are project-configured and approved. Example only: Engineering 15%, Procurement 25%, Construction 35%, Installation 10%, Commissioning 15%. Disabling a module does not remove its scope from the approved denominator. A controlled manual source may represent that scope until the module exists.

**KPI-05:** Track installed, submitted, verified, and accepted quantities separately. Formal progress uses the project's approved acceptance basis. Corrections and rework may reduce current earned progress with a reason and approval; historical snapshots remain unchanged.

**KPI-06:** Procurement, subcontracting, construction, and commissioning may reference the same physical item but must not earn the same parent scope twice. Store allocation relationships and source ownership explicitly.

### 9.2 KPI definitions

| KPI | Definition / interpretation |
|---|---|
| Progress variance | Actual approved percentage minus planned percentage, in percentage points |
| Milestone variance | Forecast finish minus baseline finish, in project working days; positive means late |
| Period achievement | Current approved cumulative earned amount minus previous comparable approved cumulative amount |
| On-time delivery | Eligible deliveries received by their agreed due date / eligible received deliveries; also show outstanding overdue items separately |
| Productivity | Accepted quantity / direct labor hours, or inverse hours per unit; show selected basis |
| Inspection first-pass rate | First inspections accepted / first inspections completed; reinspections excluded from both terms |
| Check-sheet acceptance | Accepted applicable sheets / total approved applicable sheets |
| Punch balance | Opening open + newly raised + reopened − verified closed, with scope adjustments separately disclosed |
| Overdue action | Not closed and due before current project date/time under the configured date semantics |
| Reporting completeness | Required reporting units with valid submissions / total required reporting units |

Earned value measures such as CPI/SPI shall only be enabled when compatible budget, planned value, earned value, and actual cost definitions exist. Physical-progress variance must not be labeled SPI.

### 9.3 Reporting governance

Project settings define week ending, cutoff timezone, calendars/holidays, report submission deadlines, review chain, baseline, approved measurement rules, and stale-data thresholds. Proposed weekly cadence: period closes Friday, submissions by Monday, approval Tuesday; replace these defaults with the actual project rhythm.

Changing scope, weights, or definitions creates a version effective from an approved period. Comparison screens shall state whether figures share the same basis or include a reconciliation bridge.

## 10. Reminders and notification center

**NOT-01:** Supported triggers include approaching due date, overdue action, approval request, returned submission, comment mention, milestone slippage, critical material shortage, unresolved interface, expediting follow-up, reporting cutoff, and handover blocker.

**NOT-02:** Channels: in-app and email in Phase 1; optional push and enterprise messaging connectors later. In-app notifications have unread/read, category, urgency, source, timestamp, and a permission-checked deep link.

**NOT-03:** Configure rules by organization default, project policy, module, record type, severity, and user preference. Project mandatory rules override optional user opt-outs; the interface shall explain this.

**NOT-04:** Proposed due reminders: three days before, one day before, on due date; overdue summary daily; escalation to Leader after two working days, Manager after five, and PM after ten. Critical items may have faster project-defined escalation.

**NOT-05:** Support quiet hours, timezone, business calendars, daily/weekly digest, temporary snooze with reason, delegation during absence, and escalation fallback when an owner is inactive.

**NOT-06:** A notification has an idempotency key based on rule, recipient, record revision/due-date version, and scheduled window. Completion, cancellation, due-date change, access revocation, or disabled source module cancels obsolete jobs.

**NOT-07:** Email content shall contain only currently authorized information. Retry transient failures, record delivery results, and expose failed deliveries to administrators without resending indefinitely.

**Acceptance:** Changing a due date replaces obsolete reminders; a closed item receives no new overdue reminders; a client cannot receive an internal issue title through an email subject.

## 11. Profile and Settings

### 11.1 Profile

Users shall manage display name, avatar, job title, contact details, preferred language/timezone, theme, density, notification preferences, password/MFA where locally managed, active sessions, and delegation dates. Email or identity changes require re-verification. Users cannot elevate their own role through Profile.

### 11.2 Settings information architecture

| Settings area | Required controls | Default authority |
|---|---|---|
| Organization | Identity, brand, domains, organization-wide defaults | Organization Admin |
| Projects / Project Master | Code/title, current-project selector, client, locations, calendars, lifecycle, project templates | PM / delegated project admin; organization grants for creation |
| Modules / Module Master | Add/register, install, version, status axes, project assignment, read-only/disable/remove, dependencies, health | Master/install: Organization Admin; project configuration: PM with grant |
| Personnel levels & positions | Project-specific titles/levels, access templates, responsibility slots, effective dates | Project personnel/access administrator |
| Module access by level/person | Inherit/Allow/Deny, screens/actions, scope, field policy, individual expiry, effective-access preview | Access administrator within delegated authority |
| PIC & assignments | Module/package responsibility rules, task assignment, reassignment and delegation | Authorized project/module coordinator |
| Document Control | Numbering, MDR/EMDR scope, revision/purpose codes, CA/MWS/client routes, transmittals, distribution | Document-control administrator and authorized technical approver |
| Users & teams | Invite, assign, suspend, company/team scope, ownership transfer | Scoped user administrator |
| Roles & permissions | Templates, action grants, scope, denies, policy preview | Access administrator |
| Client access | Released screens, widgets, fields, buttons, records, expiry | PM with client-publication grant |
| Work packages & WBS | Types, numbering, hierarchy, disciplines, required fields | PM / controls administrator |
| Progress & baseline | Rules, weights, reporting periods, freeze/rebaseline | Authorized project controls approver |
| Workflows | States, reviewers, conditions, escalation, delegation | Authorized module administrator |
| Dictionaries | Units, categories, statuses, contractors, locations, systems | Scoped administrator |
| Notifications | Reminder templates, channels, quiet-hour policy, escalation | Project/organization administrator |
| Reports | Templates, branding, distribution, publication rules | Reporting administrator |
| Security & retention | Sessions, MFA, retention schedules, access audit | Organization security administrator |
| Integrations | Connection status, mappings, service accounts, job history | Integration administrator |
| Audit & system health | Filtered history, failures, job status | Authorized administrator/auditor |

**SET-01:** Settings shall distinguish Organization default, Project override, and Personal preference. Display inherited values and the effective result.

**SET-02:** Configuration changes shall validate before saving and retain version history. High-impact changes require a change reason, effective date, and approval where configured.

**SET-03:** Workflow changes affect new submissions by default. In-flight records remain pinned to their workflow version unless explicitly migrated with an impact report.

**SET-04:** Custom fields support text, rich text, number, date, boolean, choice, user, and record reference, with validation and permissions. Arbitrary executable formulas/scripts are excluded from initial releases.

**SET-05:** Project templates may bundle module selections, dictionaries, roles, workflows, and report layouts. Cloning templates must not copy users, secrets, business records, or client-sharing grants automatically.

### 11.3 Project Master, project setup, and current project

**PRJ-01 — Project Master:** Settings → Master → Projects shall list authorized projects with code, name/title, client, contract reference, project type, location, PM, lifecycle status, dates, enabled-module count and last update. Support search, filters, create, template-based create, edit, archive and controlled restore. Editing the display title preserves immutable project ID and links; project codes are unique within the organization and changes retain aliases.

**PRJ-02 — Project setup tabs:** General; Branding & terminology; Organization & personnel; Structures & work packages; Calendars & reporting; Modules; Access; PIC & workflows; Documents & review bodies; Notifications; Integrations; Retention & closeout. The wizard shall identify incomplete mandatory setup and allow draft save before activation.

**PRJ-03:** General settings include short/full project names, code, client and contracting parties, locations, EPCIC scope, contract references, start/target dates, lifecycle status, language, timezone, working calendar, default units/currency, logos, PM, coordinator and contacts. Module settings include applicable project stages and availability; project stage is distinct from personnel level.

**PRJ-04:** Lifecycle: Draft → Setup → Active → On hold → Closing → Archived. Draft/setup projects are visible only to authorized setup members. On hold blocks configured new execution/approvals while allowing permitted remediation and reporting. Archived projects are read-only; reopening requires authority and reason. No project hard delete is permitted once controlled records exist.

**PRJ-05 — Current project selector:** Always display current code + title in project screens and creation/approval dialogs. The selector lists only memberships with current validity and available project status, shows the user's project-specific title/level, and supports search, favorites and recent projects. On first login show My Projects; subsequently offer the last authorized project, falling back to My Projects if access expired.

**PRJ-06:** Switching projects resets navigation, module grants, fields, PIC options, calendars, reporting period, templates and filters to the destination context. Warn about unsaved edits; cancel or save a draft explicitly. In-flight writes remain bound to their original immutable project ID, and background-job results are labeled with that project. Cache/query keys include organization, project and authorization context.

**PRJ-07:** Keep current-project context tab-specific so switching in one browser tab does not silently retarget another tab's edit. A deep link opens the record's authorized project with a visible context change. If inaccessible, display access denied without exposing record details. Server checks project membership and record ownership independently of client selection.

**PRJ-08:** My Workspace may aggregate authorized tasks across projects. Opening a task from another project shows its project banner and offers Open in project. Cross-project reporting is a separate explicit portfolio permission; being PM in one project grants no portfolio access to others.

**PRJ-09:** Support project-specific terminology and structure depth: title labels, personnel levels, package types, discipline hierarchy and review-role names. Rename display labels without changing permission identifiers or record semantics. Cloning a project template copies configuration only; active personnel grants, confidential files, review approvals and secrets are excluded.

**Acceptance:** A user who is Manager in Project A and Engineer in Project B sees the correct title, level, modules and buttons in each. Switching project cannot reuse Project A's review authority in Project B. Two open tabs keep independent context. Revoked memberships disappear immediately from protected requests and the next selector refresh.

### 11.4 Project titles, personnel levels, positions, and PIC

**PEOPLE-01:** Separate global identity from project membership. Membership includes project, company, title, personnel level, position(s), role grants, discipline/team/package scope, line manager, start/end validity, employment/contractor category, status and alternate. One person may have different titles and levels in each project.

**PEOPLE-02:** Configure project-specific personnel levels with stable ID, label, optional ordering, description and access-template version. Example: Project A uses PM / Manager / Leader / Member; Project B uses Director / Superintendent / Supervisor / Engineer. Client is a restricted access category and may have its own levels. Numeric level or senior title never automatically inherits all lower-level access.

**PEOPLE-03:** Title describes the person's job; level provides a module/action template; role describes a business capability; position identifies a responsibility slot. A “Lead Engineer” title alone grants no approval rights. Position assignments and approval authority require explicit valid grants.

**PEOPLE-04:** Maintain a position/PIC directory with responsibility area, primary holder, alternate, manager, effective dates, company, package/module scope and vacancy status. Configure one named PIC for each mandatory ownership slot, or a queue with a named accountable coordinator. Allow RACI indicators—Responsible, Accountable, Consulted, Informed—but treat workflow execution permissions separately.

**PEOPLE-05:** The personnel editor shows effective modules/actions and why each is allowed or denied. Changing title only changes display metadata. Changing level shows the old/new access difference and affected approvals, tasks, PIC assignments and distribution lists before publication. Project administrators cannot grant capabilities beyond their delegated authority.

**PEOPLE-06:** Personnel suspension/expiry removes live access, flags responsibility vacancies, cancels unauthorized future deliveries and routes open tasks to the approved fallback. Approval history and issued transmittal recipients remain attributable. Temporary delegation has scope and dates and cannot bypass separation-of-duty rules.

### 11.5 Master module management and level/person assignments

#### 11.5.1 Settings navigation and lifecycle separation

```text
Settings
├── Master
│   ├── Projects
│   ├── Modules & module versions
│   ├── Personnel-level templates
│   ├── Role/action templates
│   └── Organizations / review bodies / dictionaries
├── Current Project
│   ├── Project details & terminology
│   ├── Personnel levels / positions / memberships
│   ├── Modules & dependencies
│   ├── Access by level
│   ├── Access by person
│   ├── PIC / responsibility assignments
│   ├── Document numbering / MDR / EMDR / CA / MWS
│   └── Workflows / calendars / reporting / notifications
└── Access audit & policy history
```

**MASTER-01:** Master → Modules shall support Add/register approved module, Edit metadata, Publish availability, Retire, Remove, and version inspection according to administrative authority. Fields: immutable module key, display title, group, description, icon, publisher, version, release phase, compatibility, dependencies, default settings, exposed screens/actions/fields, support owner and lifecycle status.

**MASTER-02:** Keep status axes distinct: master catalog status **Draft / Available / Suspended / Retired**; deployment status **Not installed / Installing / Installed / Updating / Failed**; project activation **Not assigned / Setup / Enabled / Read-only / Disabled**; access assignment **Inherited / Allowed / Denied / Expired**. Existing MOD-01 labels are a summary presentation of these axes, not one ambiguous state field. Planned is a roadmap availability label and cannot execute.

**MASTER-03:** Add in Master registers only approved packages/manifests through the existing trusted installation process. “Add module to project” selects from compatible installed/available modules and does not install arbitrary code. Remove from project disables/unassigns through dependency and record-impact checks. Remove from Master hides an unused draft or retires a used module; it must not erase historical records or referenced manifests. Purge remains a separate retention-governed operation.

**MASTER-04:** Master suspension blocks new activation and writes according to policy and displays affected projects/jobs. Retiring prevents new activation but may permit existing projects to remain read-only or run a supported version under explicit policy. A security suspension may revoke runtime access; its scope and recovery path must be visible. Disabled and read-only states differ: read-only permits authorized reads/exports but denies writes and new approvals.

#### 11.5.2 Level and individual access editors

**ACCESS-01 — By level:** Provide a matrix with project personnel levels as rows and module groups/modules as columns. Expand a cell into screens, buttons/actions, permitted fields and scope. Bulk apply a versioned template or copy a level, preview changes, then publish. A group checkbox expands to child module decisions and does not override required dependencies automatically.

**ACCESS-02 — By person:** Provide membership/person rows with title, level, project, company, effective modules and exceptions. For each module allow Inherit, Allow with action/scope limits, or Deny. Direct exceptions require reason, grantor and optional expiry. Changing a person's level recomputes inherited grants; explicit person exceptions remain visible and are revalidated against the new role scope and delegating authority.

**ACCESS-03:** Each grant is a tuple of project, principal, module/screen/action, field policy, record scope, validity and source template. Individual Allow may add a narrowly authorized capability absent from the level template. Individual Deny overrides template/direct allows. Organization/project explicit denies, suspended account/module, disabled project module, invalid membership and workflow conditions always constrain an individual Allow. Keep action and scope bound in the same grant; never combine broad scope from one grant with approval authority from another.

**ACCESS-04:** Effective access follows organization entitlement → installed compatible module → project activation/state → valid membership → applicable level/role/person grants → explicit denies → record/field/workflow rules. A project role or level template creates no global membership. Project-level access never exposes private personal tasks. The personal task organizer is a core user capability; project task participation is governed by project module access.

**ACCESS-05:** A module enabled for the project but unassigned to a person is hidden/denied for that person. Assignment exposes only authorized capabilities; it does not enable a disabled module, satisfy a workflow role, or override client publication restrictions. Client-specific grants remain subject to ACL-01–06 and per-record release.

**ACCESS-06:** The policy preview includes “View as level” and “View as person,” final navigation/screens/buttons, representative record scopes, masked fields, and explanations of every allow/deny. Preview is read-only; it cannot perform actions as another user. Show conflicts and pending ownership/access problems before publishing.

**ACCESS-07:** Changes apply on the next protected request, invalidate relevant permission caches, cancel newly unauthorized jobs/download links and create a before/after audit record. Existing issued reports remain historical objects but require current permission to reopen. Bulk grants require explicit destination project and a clear count of affected people.

**ACCESS-08:** Offer reports: modules by project; module access by level/person; expiring exceptions; users without necessary source access; inactive PICs; privileged grants; and unassigned required responsibilities. Export itself requires permission. Template changes are versioned and project adoption is explicit rather than silently changing every live project.

**Acceptance examples:** A Project A Leader receives Engineering view/edit but no baseline approval; one named Leader receives Expediting review until an expiry date; an explicit deny still blocks it; another project's same level name conveys nothing. Removing Document Control shows dependent Engineering/review tasks before the operation. A client with a module Allow still cannot view unreleased documents.

## 12. Technical architecture and data exchange

### 12.1 Proposed implementation approach

Use a responsive TypeScript web frontend, a typed backend API, a relational database, private object storage, and a durable background-job service. A practical candidate is React with a TypeScript backend and PostgreSQL, but framework selection remains an architecture decision after hosting, team capability, and integration constraints are confirmed.

Separate layers:

1. Application shell and shared design system.
2. Identity, authorization, project context, audit, and configuration services.
3. Module registry and business modules.
4. Shared documents, actions, approvals, schedules, and progress calculation services.
5. Integration adapters, notifications, exports, and background processing.
6. Persistent transactional data, object files, reporting snapshots, and search indexes.

Each module owns its schema and service interface. Cross-module references use stable IDs. Reporting read models may denormalize data with clear source and refresh timestamps. Database transactions protect inventory, workflow transitions, and approval consistency.

### 12.2 API requirements

- Versioned interfaces with pagination, filtering, sort allowlists, and structured validation errors.
- Every request has authenticated organization/project context and server-side scope enforcement.
- Revision or ETag checks prevent lost updates.
- Idempotency keys protect imports, approvals, publication, and external callbacks from duplicate processing.
- Service accounts have explicit scopes, expiry/rotation, and no interactive administrator rights by default.
- Webhooks verify signatures, reject replay outside policy, and log processing state.
- Rate limits and upload quotas apply by organization and service account.
- Example operations: list work packages, submit period measurement, approve revision, publish report, reserve material, and enable project module. Generic record update endpoints must not bypass state transitions.

### 12.3 Imports, migration, and source ownership

Phase 1 imports cover users/project membership, WBS, packages, deliverables, procurement plans, vendor milestones, schedule activities, and management registers. Phase 2 expands to materials, quantities, quality/HSE records, and subcontractor data. Phase 3 adds systems, tags, check sheets, punches, marine assets, and offshore workpacks.

For each import, define external key, target entity, source-of-truth owner, create/update behavior, unit/date conversion, duplicate policy, error handling, and reconciliation totals. Preserve original source references and import batch ID. Large jobs run asynchronously with progress and downloadable error reports.

Optional adapters include scheduling systems, ERP/procurement systems, document repositories, enterprise identity, calendars, and business-intelligence tools. An adapter is not considered delivered until authentication, mapping, reconciliation, retry, access control, and operational ownership are tested.

### 12.4 Expanded implementation contracts

| Data group | Required fields / constraints |
|---|---|
| Project membership | Unique active membership per organization/project/user; project title; level ID; position links; scopes; start/end; validity/status; effective policy version |
| Personnel level/template | Immutable project-scoped level ID; editable label; template version; grants with action+scope bound together; explicit adoption history |
| PIC assignment | Project, module/package/discipline slot, person or queue/position, primary/alternate, validity, accountable coordinator and reassignment history |
| Task | Immutable ID; personal owner or project ID; source; primary assignee; accountable owner; lifecycle; source-owned field flags; revision; visibility; dates; completion evidence |
| Source-generated task | Unique source ID + source revision/review cycle + workflow step + responsibility slot; source link remains permission-checked |
| Document and register membership | Canonical project document ID; unique number/aliases; register/package links; owning register; progress allocation basis; classification |
| Revision and review cycle | Immutable revision/file checksum; issue purpose; review-route version; independent party dispositions; comment history; computed release-for-use status |
| Module Master/activation/grant | Stable module key/version; catalog/deployment/project status independently stored; project configuration; level/person grants with reason, validity and grantor |

**Implementation sequence:** First establish project context and membership constraints; then the canonical task/PIC interfaces; then document/register/review models; finally module-level/person-level policy matrices and end-to-end reconciliation. Early Phase 1 modules may use the core task APIs before the complete Tasks Management interface ships.

**API operations:** Include select/list authorized projects, edit project setup, create/version a personnel level, publish a project policy, preview effective user access, resolve PIC, assign/reassign task, convert private task to project task, submit source decision, create document/register membership, issue transmittal, record party response, resolve comment, and calculate document-use eligibility. Every operation validates destination context; a selected-project value from the browser is never sufficient authorization.

**Events:** Add project.membership-changed, project.policy-published, pic.assignment-changed, task.assignment-changed, task.source-transitioned, document.revision-issued, transmittal.issued, review.response-recorded, document.release-status-changed and module.project-state-changed. Consumers shall refresh authorized read models, recompute relevant gates and cancel obsolete notifications idempotently.

**Migration:** Map existing Action IDs to canonical Tasks, existing files to Document IDs/revisions, package document lists to MDR/EMDR memberships, and current roles to project-scoped membership grants. Preserve provenance and approved records. Do not infer CA/MWS acceptance from a generic legacy “Approved” value; flag ambiguous rows for document-controller resolution. Reconcile task counts, assignees, reminders, document numbers, revision checksums and review dispositions before cutover.

**Data validation:** Reject cross-project foreign references except explicitly permitted portfolio links. Enforce document ownership, project membership, stock allocation and source-task uniqueness in transactional persistence. Read models and search indexes must include authorization context and be invalidated after policy changes; stale indexes cannot serve revoked records.

## 13. Security, reliability, and nonfunctional requirements

The following are proposed release targets to validate against realistic infrastructure and project data.

| Area | Requirement and verification |
|---|---|
| Tenant isolation | Automated negative tests for every API family, file download, search, export, and background job across two organizations and projects |
| Encryption | TLS for transport; encryption for database, storage, and backups; managed secret storage |
| Session security | Protected cookies where cookie sessions are used; CSRF defenses, output encoding, input validation, and restrictive browser policy |
| Audit | Append-only business audit with actor, action, before/after or change reference, time, reason, project, correlation ID; restrict audit access |
| Availability | Proposed 99.9% monthly service availability, with agreed maintenance treatment before contracting |
| Interactive performance | At agreed load, p95 register response under 2 seconds and dashboard usable under 3 seconds; external network latency measured separately |
| Capacity test | Initial acceptance fixture: 20 active projects, 500 concurrent active users, 100,000 register records per large project, and 1 million progress/audit events across test data |
| Large jobs | Exports/imports beyond interactive limits run in background; user receives status and authorized download link |
| Recovery | Proposed recovery point at most 1 hour and recovery time at most 4 hours; prove by restore exercise before production |
| Observability | Track request errors/latency, job delays, notification failures, integration failures, stale reporting models, and module health |
| Retention | Configurable by record class and organization policy; legal hold or contractual retention prevents unauthorized purge |
| Browser support | Test supported desktop Chrome, Edge, Safari, and Firefox releases plus mobile Safari/Chrome; publish exact versions per release |
| Localization | English first; externalize UI strings and support configurable date/number formats and Unicode content |
| Offline | Phase 1 requires connectivity; Phase 2 may add controlled offline field drafts. Full offline approvals and live inventory commitments are excluded |
| Data portability | Authorized export includes record metadata, relationships, attachments manifest, configuration versions, and audit references |

Offline drafts, if implemented, shall be encrypted locally where supported, expire under policy, and synchronize only after fresh authentication and conflict checks. They must not queue unconditional approvals or material reservations.

## 14. Delivery roadmap

### 14.1 Phase allocation

User-specified phases are fixed below. Other allocations are proposed to support a useful first release and manageable integration order.

| Module / capability | Phase | Basis / dependencies |
|---|---|---|
| Core shell, identity, permissions, settings, registry | 0 foundation | Prerequisite for all business modules |
| Dashboard, Profile, themes, reminders | 1 | Proposed essential product capability |
| Engineering packages and deliverables foundation | 1 | Proposed; shared WBS/documents |
| Procurement Plan | 1 | User-specified |
| Expediting | 1 | User-specified; Procurement Plan |
| Overall progress | 1 | User-specified; measurement/approval services |
| Planning packages | 1 | Proposed; shared package configuration |
| Milestones | 1 | User-specified |
| Management registers including basic MOC | 1 | Proposed project governance foundation |
| Interface register, matrix, and points | 1 | Proposed basic coordination |
| Events, MoM, document register, predefined analytics | 1 | Proposed shared collaboration |
| Project Master / switcher / project titles, levels and PIC directory | 0–1 | Foundation in Phase 0; complete project-specific setup in Phase 1 |
| Module Master / assignment by personnel level and person | 0–1 | Registry foundation in Phase 0; full policy matrices/preview in Phase 1 |
| Tasks Management: personal and project workspaces | 1 | Canonical task/action model; PIC and source-access validation |
| Document Control: MDR/EMDR, transmittals, client/CA/MWS reviews | 1 | Full controlled lifecycle, source review tasks and effective release gates |
| Logistics | 2 | User-specified; Procurement/Expediting |
| Materials | 2 | User-specified; Logistics/shared quantities |
| Yard layout, Workfront, construction KPI, productivity | 2 | Proposed; packages/materials/quality gates |
| Fabrication Subcontracting | 2 | Proposed; construction measurement ownership |
| QAQC and HSE | 2 | Proposed; readiness and acceptance gates |
| Advanced Engineering, interfaces, analytics, document adapters/annotation | 2 | Transmittals and structured reviews already delivered in Phase 1 |
| Facility layout | 3 | User-specified |
| Construction sequence | 3 | User-specified |
| Onshore Precom-Commissioning | 3 | Proposed; systems/tags, QAQC, accepted construction |
| T&I | 3 | Proposed; workpacks, readiness, sequences |
| Offshore HUC | 3 | Proposed; commissioning, T&I, marine assets |
| Optional commercial/resource/advanced integrations | 4+ | Separate approved extensions |

### 14.2 Indicative schedule and staffing assumptions

The revised roadmap spans **68 weeks / 34 two-week sprints**, using one multidisciplinary delivery team. Revision 1.1 adds four Phase 1 sprints for full task workspaces, controlled MDR/EMDR delivery and external reviews, and project-level personnel/module assignment verification. This adds eight weeks to the original 60-week baseline. It is an estimation baseline, not a fixed-price commitment. Re-estimate after discovery and each release using actual throughput and integration findings. Full implementation of optional modules in Section 8.21 requires a separate estimate and is not silently included.

Assumed team: one product owner/business analyst, one EPCIC subject-matter lead available at least half-time, one designer, one technical lead who also develops, four software engineers, two QA engineers, and half-time platform/security support. Discipline approvers and pilot users must be available for workshops and acceptance.

| Stage | Weeks | Outcome |
|---|---|---|
| Phase 0: Discovery and foundation | 1–8 | Agreed workflows, design system, architecture, secure core, module framework |
| Phase 1: Project controls, tasks, document control and procurement | 9–34 | Usable pilot, full project-specific access, task workspaces, MDR/EMDR and reviews |
| Phase 2: Yard execution and supply chain | 35–52 | Materials, construction, subcontracting, quality/HSE and richer reporting |
| Phase 3: Completion and offshore execution | 53–68 | Commissioning, sequence/layout expansion, T&I and HUC |
| Phase 4+: Optional extensions | Re-estimate after Phase 2 | Cost/contracts, resource planning, BIM, additional connectors |

Overlapping design and discovery for the next phase are allowed, but a module shall not be released before its dependencies and access tests pass. Schedule includes dedicated integration/pilot sprints; significant connector work, complex data migration, or certification needs require additional scope and time.

### 14.3 Release outcomes and gates

**Phase 0 exit:** Approved scope and source ownership; representative data; tested authentication and tenant separation; signed-off key screens; module enable/disable prototype; working delivery pipeline and restore procedure draft.

**Phase 1 exit:** A pilot project completes two weekly reporting cycles using Engineering, Procurement, Expediting, Planning, and governance modules. A published client report reconciles to approved records. No unresolved critical security defect or release-blocking calculation error remains.

Revision 1.1 Phase 1 acceptance also requires two projects with different personnel titles/levels and module assignments; private-task separation; source-linked PIC task reassignment; an MDR consolidated from multiple EMDRs; and a document cycle with independent client/CA/MWS responses and the correct release-for-use restriction. Existing register actions must reconcile to canonical tasks without duplicate notifications or ownership.

**Phase 2 exit:** A material item is traced from shipment through receipt, reservation, issue, installation, and quality acceptance. Construction progress and subcontractor inputs reconcile without double counting. HSE/QAQC gates operate as configured.

**Phase 3 exit:** A representative system moves from accepted construction through check sheets, punch resolution, handover, installation/offshore dependencies, and final acceptance. Sequence and marine conflicts are detected. Module upgrades and recovery are rehearsed with realistic data.

## 15. Detailed implementation plan

### 15.1 Workstream ownership

| Workstream | Accountable role | Deliverables |
|---|---|---|
| Product and EPCIC process | Product owner + EPCIC lead | Prioritized backlog, data dictionary, process maps, acceptance decisions |
| UX and branding | Design lead | Identity proposal, components, prototypes, accessibility notes |
| Architecture and platform | Technical lead | Module contracts, data model, security design, integration decisions |
| Module implementation | Engineering team | Tested screens, APIs, rules, jobs, migration scripts |
| Quality and acceptance | QA lead + discipline representatives | Automated checks, scenario evidence, defect triage, UAT results |
| Operations and rollout | Platform lead + project administrator | Environments, monitoring, backup/restore, migration, training, support |

### 15.2 Sprint-by-sprint delivery sequence

Each sprint includes refinement, design review, development, automated verification, demonstration with representative data, and updated documentation. The items below are sprint outcomes, not a promise that every item is independently releasable.

| Sprint / weeks | Work packages | Dependencies | Reviewable deliverable / exit condition |
|---|---|---|---|
| S01 / 1–2 | Discovery, process workshops, inventory current registers, confirm roles and package hierarchy | Sponsor and discipline access | Scope map, glossary, representative datasets, decisions log, prioritized backlog |
| S02 / 3–4 | Brand/UI system, key prototypes, architecture decisions, threat model, module manifest | S01 | Approved core journeys; architecture and schema reviewed; build environments available |
| S03 / 5–6 | Organizations/projects, login/register/invites, sessions, role scopes, audit | S02 | Two isolated test organizations; invitation/login/logout and denial tests pass |
| S04 / 7–8 | Shell, Settings, module catalog, activation, common records, files/actions, CI/backup foundations | S03 | Enable/disable demonstration, access preview, common record template; Phase 0 gate |
| S05 / 9–10 | Shared WBS/packages, master data, numbering, imports, document register | S04 | Validated structure import and canonical package links |
| S06 / 11–12 | Engineering packages/deliverables, basic review, Procurement Plan | S05 | Engineer and buyer complete draft-to-review flows |
| S07 / 13–14 | Expediting milestones, split quantities, follow-ups, procurement risk flags | S06 | PO package traced through vendor updates; forecast impact visible |
| S08 / 15–16 | Measurement engine, weights, reporting periods, approved snapshots | S05–S07 | Calculation fixtures and approval/lock/reopen scenarios pass |
| S09 / 17–18 | Overall progress, milestones, S-curves, PM/team dashboards | S08 | Dashboard-to-source reconciliation; missing data labeled correctly |
| S10 / 19–20 | Risk, issue, lessons, MOC, stakeholders, shared action escalation | Shared workflows; S08 for baseline links | Governance scenarios and baseline-change control demonstrated |
| S11 / 21–22 | Interfaces, events, MoM, notifications, profile/theme completion | S10/shared actions | Matrix reconciliation, recurring event handling, notification cancellation tests |
| S12 / 23–24 | Predefined reports, client policy editor, publication, full integration tests | S06–S11 | Restricted client portal and immutable report; permission/export tests pass |
| S13 / 25–26 | Complete project setup/switching, titles/levels, Module Master, by-level/person matrices, personal/project task views | S03–S05, S10–S12 | Two-project role test, effective-access preview, private task separation and controlled assignment |
| S14 / 27–28 | MDR/EMDR, package memberships, numbering, revision controls, incoming/outgoing transmittals | S05–S06, S13 | Shared documents consolidate without duplication; exact revision distribution and immutable file checks |
| S15 / 29–30 | Client/CA/MWS routes, review cycles, structured comments, PIC-generated review tasks and use-release calculation | S13–S14 | Independent parallel responses, comment carry-forward and mandatory external gate tests |
| S16 / 31–32 | Source-task migration, reassignment/delegation, module status/removal impacts, full access and document integration tests | S13–S15 | Existing actions reconcile; grants/denies/expiry tested; module disable and outstanding reviews verified |
| S17 / 33–34 | Pilot reporting cycles, performance/security fixes, migration rehearsal, training | S16 | Phase 1 acceptance evidence, rollback decision criteria, production readiness |
| S18 / 35–36 | Logistics shipment/line model, transport stages, receipt exceptions | Procurement/Expediting | Partial shipments and delivery reconciliation demonstrated |
| S19 / 37–38 | Materials master, inventory transactions, reservations, traceability | S18 | Concurrent reservation and quarantine tests pass |
| S20 / 39–40 | QAQC inspections, hold points, NCR; HSE observations/incidents/constraints | Shared records/packages | Access-restricted HSE data and evidence-based quality release |
| S21 / 41–42 | Workfront readiness and release, yard layout pins/zones | S19–S20 | Readiness computed from real dependencies; layout revision links work |
| S22 / 43–44 | Discipline quantities, daily reports, productivity, correction workflow | S21 + measurement engine | Discipline units and hours reconcile; rejected work excluded correctly |
| S23 / 45–46 | Subcontractor submissions, concerns/highlights, company scope | S22 | Contractor isolation and single-source progress acceptance demonstrated |
| S24 / 47–48 | Advanced Engineering/document adapters, interface expansion, analytics builder | Phase 1 and Phase 2 data | Controlled distribution and cross-module authorized analytics |
| S25 / 49–50 | Selected integrations, migration reconciliation, end-to-end yard scenarios | S18–S24 | Shipment-to-accepted-installation scenario; recoverable integration failure |
| S26 / 51–52 | Pilot, performance fixes, training, operating runbooks | S25 | Phase 2 gate and production rollout |
| S27 / 53–54 | System/subsystem/tag model expansion, check-sheet templates, punch categories | Accepted construction/QAQC | Approved completion hierarchy, mapping/import validation |
| S28 / 55–56 | Check-sheet execution/review, punch lifecycle and KPI | S27 | Acceptance and reopen scenarios update readiness correctly |
| S29 / 57–58 | Commissioning sequence, handover schedule/dossiers | S28 | Blocked and exception-approved handovers demonstrated |
| S30 / 59–60 | Facility layouts, construction sequence, revision and scenario comparison | Yard layout + dependency model | Annotation reconciliation and dependency-cycle tests pass |
| S31 / 61–62 | T&I workpacks, schedule, readiness, sequence/progress | S29–S30 | Installation package linked from onshore readiness to acceptance |
| S32 / 63–64 | Marine spread, HUC schedule/progress, resource conflict detection | S31 + shared completion entities | Offshore dependencies and marine double-booking checks demonstrated |
| S33 / 65–66 | End-to-end completion/offshore integration, large data and recovery tests | S27–S32 | Complete representative system dossier and validated module-upgrade recovery |
| S34 / 67–68 | User acceptance, final migration, training, staged rollout | S33 | Phase 3 sign-off, support handover, measured production health |

### 15.3 Module implementation checklist

For each module, create a delivery ticket group containing:

1. **Process definition:** Actors, record lifecycle, mandatory evidence, exceptions, ownership, and client exposure.
2. **Data contract:** Entity fields, required/optional rules, units, unique keys, relationships, status transitions, and retention.
3. **UX:** Register, detail, creation/editing, approval, dashboard widget, empty/error states, and responsive behavior.
4. **Authorization:** Screen/action identifiers, row/field scopes, export/download policy, and negative tests.
5. **Backend:** API operations, validation, concurrency checks, migrations, audit, events, and jobs.
6. **Frontend:** Typed forms, tables, state management, permission rendering, notifications, and accessible interactions.
7. **Integration:** Import template, source ownership, event consumers, error handling, and reconciliation.
8. **Configuration:** Manifest, dependencies, settings schema, default role grants, onboarding and disable behavior.
9. **Verification:** Calculation tests where applicable, workflow scenarios, access tests, migration/upgrade tests, and UAT evidence.
10. **Release:** Seed/reference data, training guide, operational metrics, support owner, and release notes.

Revision 1.1 additionally requires each module to declare personnel-level/person assignment capabilities, PIC resolver slots, generated task keys, source-task transition mapping, document/review prerequisites, and the behavior of open work when the module or assignee becomes unavailable.

### 15.4 Example backlog decomposition

**Epic: EXP — Expediting**

| Story | Implementation tasks | Completion evidence |
|---|---|---|
| EXP-A: Configure vendor milestones | Settings schema; stage validation; versioning; project template | Invalid weights rejected; existing records keep their rule version |
| EXP-B: Update vendor forecast | Record form; revision API; date validation; audit event | Authorized expeditor updates forecast; unauthorized user denied |
| EXP-C: Record partial dispatch | PO-line allocation; quantity validation; split-shipment reference | Total dispatched cannot exceed approved quantity without controlled adjustment |
| EXP-D: Follow-up reminders | Scheduling rule; deduplication; cancellation; escalation | Due-date changes cancel old reminders; completed record stops reminders |
| EXP-E: Report delivery risk | Need-date comparison; linked activity impact; filtered dashboard | Report reconciles to affected packages and respects client scope |

This level of decomposition shall be applied to each module before sprint commitment. Story estimates should use the delivery team's actual estimation method and be revised after the first two implementation sprints.

### 15.5 Data migration and rollout procedure

1. Inventory existing spreadsheets and systems, owners, data quality, units, and confidential fields.
2. Agree authoritative sources and map identifiers before import.
3. Clean duplicates, invalid units, missing owners, orphan packages, and inconsistent dates.
4. Run a rehearsal in a nonproduction environment; reconcile row counts, quantities, weights, dates, document counts, and critical financial totals if included.
5. Obtain discipline-owner acceptance of reconciled results and record unresolved exceptions.
6. Announce cutover, freeze affected source editing where necessary, take backups, and import the final delta.
7. Run smoke tests with PM, Manager, Leader, Team Member, Client, and administrator accounts.
8. Release first to one pilot project, then expand in controlled batches.
9. Monitor errors, performance, permissions, and report reconciliation; keep named support owners available.
10. If release criteria fail, halt expansion and use the rehearsed rollback/restore or forward repair plan. Reconcile writes made after cutover before resuming the previous system.

### 15.6 Training and adoption

Provide short role-based guides and exercises: PM approvals/client publication; manager review; leader workfront and reporting; member daily updates; client review/comment; administrator configuration and access. Include a sandbox project with representative EPCIC data, contextual help, a glossary, and release-specific walkthroughs. Track completion of pilot training and unresolved usability findings before broad rollout.

## 16. Acceptance and verification plan

### 16.1 High-priority end-to-end scenarios

| Test ID | Scenario | Expected result |
|---|---|---|
| UAT-01 | Invite, verify, approve, login, logout, suspend | Correct membership states; logout/suspension prevent further protected requests |
| UAT-02 | Client calls a hidden API and downloads a revoked file link | Server denies access; no protected data leaks |
| UAT-03 | Client views dashboard, search, export, notification | Only released/authorized content and aggregates appear |
| UAT-04 | Create package in Engineering and inspect Planning | Same canonical scope or explicit mapping; no independent duplicate |
| UAT-05 | Submit and approve progress, lock period, reopen with correction | Reproducible original snapshot and separately approved revision |
| UAT-06 | Change weights or scope after publication | Historical report unchanged; new basis and reconciliation visible |
| UAT-07 | Delay vendor delivery needed by a workfront | Impact/constraint and configured reminders appear; baseline unchanged |
| UAT-08 | Receive partial shipment with damaged quantity | Stock quantities reconcile; damaged stock cannot be reserved |
| UAT-09 | Concurrently reserve remaining stock | Only valid quantity reserved; second user receives a clear conflict |
| UAT-10 | Submit subcontractor quantity already in Construction | Single authoritative credit; no double counting |
| UAT-11 | Fail quality hold point and raise HSE stop-work | Configured workfront release blocked until authorized resolution |
| UAT-12 | Close then reopen a blocking punch | Readiness recalculated; closure and reopen audit preserved |
| UAT-13 | Attempt handover with incomplete mandatory check sheet | Handover denied or explicit permitted exception workflow required |
| UAT-14 | Assign marine asset to incompatible overlapping activities | Conflict visible and publication/release blocked per policy |
| UAT-15 | Disable required module while dependent module is active | Impact shown; unsafe change denied; retained reports remain readable |
| UAT-16 | Upgrade module with failed migration | Controlled failed state and rehearsed recovery; unrelated modules remain usable |
| UAT-17 | Change action due date or deactivate owner | Obsolete reminders cancelled; ownership/escalation fallback applied |
| UAT-18 | Import malformed/duplicate data and retry batch | Clear row errors and idempotent handling; no unauthorized state transitions |
| UAT-19 | Navigate core workflows with keyboard and mobile viewport | Accessible actions, visible focus, readable content, usable error recovery |
| UAT-20 | Restore backed-up production-like dataset | Data and files reconcile within recovery targets; access policy retained |
| UAT-21 | Same person is Manager in Project A and Engineer in Project B | Correct project-specific title, level, modules, buttons and row scope; no inherited cross-project authority |
| UAT-22 | Switch project while a form, export job and another browser tab are open | Writes/jobs retain original project; unsaved form warning; other tab remains in its own context |
| UAT-23 | Grant module by level, add individual allow/deny with expiry | Effective-access preview matches runtime; deny and expiry enforced on APIs, search, jobs and downloads |
| UAT-24 | Rename project or personnel title; change level template | Immutable references intact; display rename alone grants nothing; template impact reviewed |
| UAT-25 | Personal task, project task and source-driven MoM action | Private task stays private; shared action appears once across views; source workflow controls completion |
| UAT-26 | Change a PIC, suspend old assignee, transfer open review tasks | Only selected open tasks transfer; no new source access silently granted; closed-task history preserved |
| UAT-27 | Document included in several package EMDRs | One canonical MDR document/revision; weighted credit and register counts do not duplicate it |
| UAT-28 | Parallel client, CA and MWS review with one mandatory response pending | Each disposition is separate; effective release remains blocked; no implicit late approval |
| UAT-29 | Return comments against old revision after a new revision is issued | Response remains bound to old cycle; carry-forward explicit; latest revision not falsely accepted |
| UAT-30 | Disable/remove a module containing active tasks and dependent document gates | Dependency/ownership impact shown; permitted state transition preserves evidence and stops unauthorized jobs |
| UAT-31 | Transmittal download after recipient access revocation | Existing link denied; historical issue evidence retained; recipient list does not imply live access |
| UAT-32 | Convert personal task to project task with private notes/attachments | Explicit sharing preview; only selected content copied; destination access validated |

### 16.2 Calculation fixtures

- Weighted children at 20% weight/50% completion and 80% weight/25% completion yield **30%** parent progress.
- Accepted 40 units against an approved budget of 100 yields **40%**; a pending 10 units does not increase accepted progress.
- Zero approved budget yields **Not calculable** and cannot silently enter an overall rollup.
- Installed 110 against budget 100 shows **110 installed, 10 overrun, at most 100% earned** until approved scope adjustment.
- Opening punches 20 + raised 5 + reopened 2 − verified closed 8 yields **19 open**, absent separate scope adjustments.
- A 100% complete package removed from a future baseline remains included in the historical snapshot under the original scope.

### 16.3 Definition of Done

A feature is done only when its acceptance criteria pass, server authorization is tested, audit records are correct, error and empty states exist, configuration is documented, relevant calculations reconcile, accessibility checks pass, and no release-blocking defect remains. A module additionally needs lifecycle tests, migration/upgrade validation, operational monitoring, and administrator/user guidance.

Release-blocking defects include cross-organization disclosure, privilege escalation, data loss, unreconciled approved progress, broken required approval gates, or failed restore readiness. Lower-severity exceptions require an owner, mitigation, target date, and release-owner acceptance.

## 17. Recommended future plugin catalog

These extensions are optional and shall be independently estimated and approved.

| Plugin | Purpose | Dependencies / scope note |
|---|---|---|
| Cost Control & Earned Value | Budgets, commitments, actuals, forecasts, approved EVM | Approved WBS and cost source; separate commercial permissions |
| Contracts & Claims | Variations, notices, obligations, claims and correspondence | Documents, MOC, milestones; contractual rules configured per project |
| Resource & Equipment Planning | Resource demand, crews, equipment bookings, capacity | Schedule, productivity, marine/yard resource boundaries |
| Timesheets | Validated hours allocation and approval | Users, packages, calendars; payroll remains external unless separately scoped |
| Advanced Scheduling Connector | Controlled import/export and schedule reconciliation | External scheduler, baseline governance |
| BIM / 3D Viewer | Model navigation, tag links, spatial coordination | Approved model formats, storage and performance budget |
| Mobile Field Capture | Offline drafts, QR/barcode capture, photographs | Device/security policy; online approval and inventory validation |
| Vendor / Subcontractor Portal | Narrow external submission journeys | Company-scoped identity, Procurement/Subcontracting |
| Advanced Completion Dossiers | Structured dossier assembly and external acceptance exchange | Documents, check sheets, punch and handover records |
| Integration Hub | Managed connectors, mappings, job monitoring | Core integration framework and named system owners |

## 18. Key risks and mitigations

| Delivery risk | Consequence | Mitigation / owner |
|---|---|---|
| Unclear progress rules | Disputed percentages and reports | Approve measurement dictionary and fixtures before building dashboards; project controls lead |
| Inconsistent package/tag IDs | Broken integration and double counting | Canonical identifiers, ownership mapping, import validation; data lead |
| Broad client grants | Confidential information exposure | Deny by default, policy preview, negative tests, publication review; access administrator |
| Overcustomized workflows | Complex upgrades and support | Versioned templates, constrained configuration, change governance; product owner |
| Module dependency coupling | Unsafe disable/upgrade and release delays | Stable contracts, dependency checks, lifecycle testing; technical lead |
| Poor source data | Misleading readiness and progress | Rehearsal migration, reconciliation, visible completeness; discipline owners |
| Limited user availability | Late workflow changes and delayed UAT | Named representatives and booked sprint demonstrations; PM |
| Integration uncertainty | Roadmap overrun | Early connector discovery and explicit scope budgets; integration lead |
| Offshore connectivity | Lost or duplicated updates | Controlled offline drafts, sync conflict handling, online critical actions; platform lead |

## 19. Decisions to confirm during discovery

The specification is actionable with the proposed defaults. The following decisions refine implementation estimates and project-specific acceptance; they do not require delaying initial design and architecture work.

1. Initial project size, number of organizations/projects/users, and expected data volumes.
2. Hosting region, managed cloud versus customer-hosted deployment, backup location, and retention obligations.
3. Existing identity provider and whether enterprise single sign-on is required for Phase 1.
4. Authoritative WBS/package structure, disciplines, systems, tags, and document numbering conventions.
5. Approved overall weights, measurement rules, calendars, and progress acceptance basis.
6. Exact client-visible screens, fields, actions, audiences, publication approvers, and acceptance authority.
7. Existing schedule, ERP, document-control, quality, and completion systems and required integration direction.
8. Required QAQC hold points, HSE constraints, punch categories, and handover exceptions.
9. Whether basic commercial data is needed in Procurement or reserved for the later cost-control plugin.
10. Pilot project, named discipline approvers, training dates, and operational support ownership.
11. Personnel title/level terminology per project, required position/PIC slots, template adoption policy, and authorized individual exceptions.
12. MDR/EMDR ownership and numbering, CA acronym/authority, MWS applicability, review return codes and release-for-use rules.
13. Which recommended modules in Section 8.21 are required for the first rollout versus separately funded extensions.

## 20. Glossary

| Term | Meaning in Project Flow |
|---|---|
| EPCIC | Engineering, Procurement, Construction, Installation, and Commissioning |
| PM | Project Manager |
| PIC | Person in Charge; configured responsibility holder for a task or module/package workflow |
| Personnel level | Project-specific access-template classification, distinct from title, position and business role |
| Position | Effective-dated project responsibility slot that may be occupied by different personnel over time |
| MDR | Master Document Register; consolidated canonical project document register |
| EMDR | Engineering Master Document Register; configurable package/discipline engineering register linked to the MDR |
| CA | Project-defined reviewing authority/body; exact expansion and authority confirmed in project settings |
| MWS | Marine Warranty Surveyor; applicable review scope and acceptance rules configured per contract |
| TQ / RFI | Technical Query / Request for Information; controlled question-and-response workflows |
| RACI | Responsible, Accountable, Consulted, Informed; responsibility mapping separate from system permissions |
| WBS | Work Breakdown Structure |
| Work package | Controlled scope unit with owner, dates, deliverables, measurement and dependencies |
| Workfront | Executable construction scope released after readiness constraints are satisfied |
| QAQC | Quality Assurance / Quality Control |
| HSE | Health, Safety, and Environment |
| T&I | Transportation & Installation |
| HUC | Hook-Up & Commissioning |
| Precom | Precommissioning |
| E&I | Electrical and Instrumentation |
| MOC | Management of Change |
| NCR | Nonconformance Report |
| PO | Purchase Order |
| KPI | Key Performance Indicator |
| Baseline | Approved version of scope, dates, weights, and/or budget used for comparison |
| Snapshot | Immutable published view of data and calculation inputs at a reporting cutoff |
| Module | Independently registered business capability with declared dependencies and settings |
| Plugin | Installable, versioned package delivering one or more modules or integrations |
| Released to client | Explicitly approved record/revision or report audience, distinct from internal approval |

---

**End of specification.**

