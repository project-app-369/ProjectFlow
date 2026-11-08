# ProjectFlow_spec_final

**Product:** Project Flow — EPCIC project management application  
**Version:** 1.4 — project and user settings, milestones as reference data  
**Date:** 8 November 2026  
**Status:** Final consolidated specification for design, estimation, and implementation. Project-specific operating rules and production acceptance remain subject to the release gates below.  
**Audience:** Product owner, project management, discipline leads, design, engineering, QA, and operations.

Project Flow connects Engineering, Procurement, Construction, Installation, and Commissioning through shared work packages, controlled information, evidence-based progress, and accountable decisions. It shall provide a consistent answer to what is complete, what is late, what prevents the next activity, who must act, and what may be shared with the client.

This document is the governing specification for the app. It consolidates the four source drafts listed in Appendix A and resolves their conflicting architecture, release allocations, measurement rules, and access defaults. Those drafts remain reference material; they do not add requirements to this baseline automatically.

**Revision 1.1:** Adds personal/project task workspaces, canonical PIC-linked tasks, full P1 Document Control, project-specific personnel levels and positions, level/person access matrices, explicit module-state axes, and the StageLink brand direction. Revises the delivery envelope to 68 weeks and records the disposition of additional modules proposed in the updated drafts.

**Revision 1.2:** Adds Production Schedule Monitoring as a P1 subsection of Expediting, covering vendor production, baseline/forecast schedules, manufacturing progress, risks, highlights, concerns, vendor-management reviews, and accountable follow-up. Re-estimate P1 effort during discovery; the 68-week envelope is not a confirmed schedule for this added scope.

**Revision 1.3:** Organizes navigation into four workspaces — Personal, EPCIC, Governance, and Reports — with display groups inside EPCIC (Yard Execution, Installation, Commissioning), keeping T&I apart from HUC and grouping HUC with Onshore Precom-Commissioning. Settings become separate pages by setting type, with a dedicated Modules page that lists every module and submodule as a breadcrumb-titled hierarchy with an enable/disable control. Release allocation and the effort estimate do not change; the module registry ships in P0 and Settings in P1 as before.

**Revision 1.4:** Adds the Settings pages for Projects (list, select, create, edit, lifecycle, delete rules, members) and Users (administrator mode), restates milestones as reference data loaded from the project workbook, and records how the first Risk and Interface Management screens meet MGT-01 and INT-01 to INT-03. Defines the personal Task Management screens (TASK-13 to TASK-15): one task set shown as list, card, kanban and gantt, a separate calendar, and a per-project workload. A non-normative note (§11.4) records how the Google Sheets pre-build organizes worksheets by area. Release allocation and the effort estimate do not change.

## 1. Product scope and governing decisions

### 1.1 Product outcomes

The application shall support multiple organizations and projects, with desktop workspaces for planning and management and responsive tablet/mobile workflows for field teams. Each project activates only the business modules it needs. All modules use the same identity, permissions, project structures, documents, actions, approvals, and audit services.

The primary outcomes are:

- A reconciled view of planned, submitted, accepted, and forecast progress.
- Traceability from engineering deliverables through procurement, materials, construction, inspection, system completion, and offshore handover.
- Early identification of constraints, overdue commitments, interface gaps, and delivery risks.
- Controlled internal review and explicit publication to client audiences.
- Less repeated data entry and manual preparation of weekly reports.

### 1.2 Decisions that apply throughout the app

| ID | Final decision | Consequence |
|---|---|---|
| DEC-01 | Use a modular monolith with a shared application shell and versioned module contracts. | Modules are independently registered and enabled; separate microservices and runtime code hot-swapping are not initial requirements. |
| DEC-02 | Use one canonical WBS, work-package master, tag register, and system/subsystem hierarchy. | Engineering and Planning show views of the same scope. Domain records link to it rather than creating disconnected copies. |
| DEC-03 | Use one governed progress service and approved rules of credit. | A scope item has one authoritative earning source for each allocation; dashboards and reports reconcile. |
| DEC-04 | Separate internal approval from release to client. | Permission to see a screen never releases all its records, revisions, fields, or attachments. |
| DEC-05 | Use scoped roles rather than an unrestricted role hierarchy. | PM and administrator privileges remain bounded by project, action, classification, and approval policy. |
| DEC-06 | Preserve baselines and issued reporting snapshots. | Changes apply through new revisions and effective periods; history is not silently rewritten. |
| DEC-07 | Deliver controls in P1, yard execution and completion capture in P2, integrated handover and offshore execution in P3. | Section 13 is the single release allocation authority. |
| DEC-08 | Build 2D yard/facility views first. | Full BIM, 4D simulation, proprietary model streaming, and GIS are optional extensions. |
| DEC-09 | Require connectivity for authoritative actions. | Optional offline drafts cannot approve work, reserve inventory, or authorize release. |
| DEC-10 | Adopt the updated StageLink concept under the Project Flow name, using indigo/teal and shared screen patterns. | Modules do not introduce independent palettes, navigation behavior, or competing record layouts. |
| DEC-11 | Provide one canonical Task service for project actions and PIC work, plus a private personal organizer. | Workspaces are views; source workflows retain authority over approvals and completion. |
| DEC-12 | Deliver dedicated Document Control in P1 with independent internal/client/CA/MWS reviews. | MDR, engineering, vendor, and package registers share documents and revision history. |
| DEC-13 | Separate project titles, personnel levels, positions, and authorization grants. | Level templates and per-person exceptions are project-scoped; job seniority alone grants nothing. |
| DEC-14 | Organize navigation into Personal, EPCIC, Governance, and Reports workspaces, and manage module availability on one dedicated Modules settings page. | The sidebar shows one workspace at a time; every module and submodule can be switched per project from a single catalog list (NAV-04 to NAV-06, SET-05, SET-06). |
| DEC-15 | Manage projects and user accounts from separate Settings pages: Projects for everyone who belongs to a project, Users in administrator mode only. | A person picks the project they work in from Settings or the header; only administrators create projects and accounts; project roles stay a project matter (PRJ-07, SET-07, SET-08). |

### 1.3 Boundaries

Project Flow manages project controls, coordination, evidence, and acceptance records. It does not initially replace an ERP, engineering authoring application, payroll system, advanced scheduling engine, vessel navigation system, or certified permit-to-work system. Hazardous-work authorization and technical acceptance remain with the designated project authorities and procedures.

Cost control/EVM, contracts and claims, resource optimization, BIM, AI assistance, native mobile apps, full offline operation, and unnamed enterprise connectors require separate extension scope. A timeline visualization does not imply critical-path calculation. A stored approval is an attributable workflow decision; regulated electronic-signature capability requires separate qualification.

### 1.4 Requirement conventions

“Shall” and “must” are mandatory for the assigned release. “May” denotes optional scope. Requirement IDs are stable backlog and test references. Each functional family inherits the phase in Section 13 unless a requirement specifies otherwise. Numeric defaults are initial configuration values, not contractual or regulatory facts. Changes to this specification require an impact review covering data, workflows, access, release scope, and acceptance tests.

## 2. Users and authorization

### 2.1 Roles

| Role | Responsibilities | Default access boundary |
|---|---|---|
| Project Manager | Project configuration, baseline decisions, escalation, official reporting, client publication | Assigned project and explicitly granted restricted domains |
| Manager | Functional performance, review, approval, team coordination | Assigned functions/disciplines; cross-function reading only when granted |
| Leader | Work packages, assignments, validation, readiness coordination | Assigned discipline, area, system, or packages |
| Team Member | Assigned updates, evidence, actions, submissions | Assigned records and permitted shared project information |
| Client | Review released information; comment, respond, or accept when authorized | Explicit audience, records/revisions, fields, and actions |
| Organization Administrator | Memberships, security policy, approved module installation, organization settings | Administrative scope; no automatic business-data entitlement |
| Platform Operator | Hosting, availability, recovery, technical operations | Operational metadata; exceptional business-data access is time-limited and audited |

Vendor, subcontractor, and auditor templates shall use the same scoped permission model. One user may hold different roles in different projects. Company identity is separate from the hosting organization: an external party's membership must explicitly authorize its project access.

### 2.2 Identity requirements

**AUTH-01:** Registration shall be invitation-only by default. Optional approved-domain requests remain pending until identity verification and membership approval. Email-domain matching does not grant project access.

**AUTH-02:** Invitations shall be email-bound, single-use, revocable, and expiring; default expiry is seven days. Resending invalidates the previous token. Account states are Invited, Pending verification, Pending approval, Active, Suspended, and Deactivated.

**AUTH-03:** Support email/password login, recovery, MFA, session expiry, and logout. Require MFA for administrators, PMs, and privileged approvers. Enterprise SSO is an optional adapter unless required by the pilot deployment. Authentication and recovery shall be rate-limited and shall avoid account-enumeration messages.

**AUTH-04:** Initial local-password policy is at least 14 characters, password-manager/paste support, and adaptive salted hashing. Initial session limits are 30 minutes idle and 12 hours absolute, configurable by organization policy. Reauthenticate sensitive administrative operations. Warn before expiry and preserve authorized server drafts.

**AUTH-05:** Logout shall invalidate the current session and clear protected local state. Profile shall support revoking all sessions. Suspension and permission revocation shall take effect on the next protected request. Deactivation preserves historical attribution and identifies open work requiring reassignment.

### 2.3 Permission enforcement

**ACL-01:** A project operation is allowed only when account and memberships are active, the installed module's catalog/project state permits that operation, an action grant exists within its own scope, record and field access match, workflow conditions pass, and no applicable explicit deny exists. Read-only/Locked states permit only their configured reads; Pilot additionally requires pilot eligibility. Platform administration, private personal tasks, and retained-report access use their own explicit permissions.

**ACL-02:** Enforce authorization on the server for APIs, searches, counts, widgets, files, exports, integrations, notifications, and background jobs. Apply organization/project isolation at the database layer as defense in depth. Client-supplied project identifiers are not trusted authorization evidence.

**ACL-03:** Grants shall cover view, create, edit, import, submit, review, approve, reject, reopen, assign, comment, upload, download, export, publish, archive, delete eligible draft, and configure. Supported scope dimensions include project, function, discipline, company, area, system, work package, assignment, and explicit shared record. Combining roles must not combine one grant's broad scope with another grant's privileged action.

**ACL-04:** Settings shall provide a role/action/scope matrix, field hiding/read-only rules, change history, and read-only preview as a specific user. Preview shall use actual policy evaluation, carry a visible banner, and perform no business actions. Administrators may not grant beyond their delegated authority.

**ACL-05:** Approval delegation shall be bounded by dates, scope, and the delegate's effective authority; record both delegator and acting user. Self-approval restrictions and independent verification shall be configurable. A role name alone never overrides a technical hold or mandatory approval.

### 2.4 Client publication

**PUB-01:** Client access defaults to denied. A project may apply a reviewed template for Dashboard, Overall Progress, Milestones, released Documents/MoM, and assigned Interfaces. Applying the template still requires explicit record/audience publication.

**PUB-02:** Publication shall identify source revision, audience, allowed fields, included attachments, permitted actions, publisher, approval, and optional expiry. Later internal edits do not become visible automatically. Revocation blocks future controlled access while retaining the publication audit.

**PUB-03:** Commercial values, internal labor/rates, internal comments, unreleased risks, stakeholder assessments, and sensitive HSE data are hidden by default. Internal and Shared comments are distinct; Internal is the default. Shared comments remain subject to audience and record access.

**PUB-04:** Client response, comment, acceptance, PDF export, and spreadsheet export are separate grants. Client acceptance applies only to its nominated workflow stage. Exports and notification subjects must not leak hidden values or infer them through totals.

### 2.5 Project Master and current project

**PRJ-01:** Settings → Master → Projects shall list authorized projects with code, full contractual title, short name, client, contract/type, asset/facility type, location, PM, stage, lifecycle, dates, and enabled-module count. Support search/filter, template creation, edit, archive, and controlled restore. Codes are organization-unique; renaming retains immutable IDs and aliases.

**PRJ-02:** A resumable setup wizard shall configure identity/branding, dates/calendars/shifts, structures/packages, personnel levels/positions, modules/dependencies, level/person assignments, client publication policy, people/PICs, document numbering/review bodies, notifications, and retention. Show completeness and conflicts before activation. Project stage and personnel level are separate concepts; project financial tier is optional metadata, not an authorization rule.

**PRJ-03:** Lifecycle is Draft → Setup → Active → On hold → Closing → Archived. Setup is restricted to setup members. On hold blocks configured execution while allowing authorized remediation/reporting. Closing permits controlled closeout. Archived is read-only and omitted from normal active lists, but available to authorized archive search. Reopening requires authority/reason; controlled records prevent hard deletion.

**PRJ-04:** My Projects shall show permitted cards with project code/title, role/title/level, stage, and authorized progress/task summaries. With one active project, open it; with multiple, show the selector unless Remember last project is enabled. Fall back to the selector when the saved membership expires. Header switching supports search, favorites, recent projects, and the command palette; retain the browser's standard Print shortcut.

**PRJ-05:** Project context is tab-specific. Show project code/title in headers, browser tab titles, creation/approval dialogs, task details, and job results. Switches reset destination permissions, module state, PIC candidates, calendars, cutoff, templates, and filters, with an explicit unsaved-work decision. In-flight writes remain bound to their original immutable project ID. Cache keys include organization, project, and policy context.

**PRJ-06:** Deep links resolve immutable record/project identity and visibly enter the authorized project; denied links reveal no record details. My Workspace is an explicit cross-project task view, not a change of current project. Portfolio reporting requires its own permission and compatible measurement basis; a PM role in one project grants no access to others.

**PRJ-07:** Settings → Projects shall let any signed-in person select the project they work in from the projects they belong to, and shall show each project's code, name, client, location, lifecycle, the person's role, member count and reporting cut-off. Selection is remembered per browser and also available from the header. Only an organization administrator creates a project; the creator becomes its Project Manager. The Project Manager (or an administrator) edits project details and the reporting cut-off, moves the project through the PRJ-03 lifecycle, and manages its members; renaming the project code is an administrator action. Restoring an archived project requires a reason. A project may be deleted only by an administrator, only while it is in Draft and holds no business records; otherwise it is archived. An administrator who is not a member can configure a project but receives no business data from it (§2.1).

### 2.6 Project personnel and effective access

**PEOPLE-01:** Membership shall contain project/company, position title, personnel level, positions, role grants, discipline/package/area scope, reports-to, primary/alternate assignments, validity dates, and status. The same user may have different titles and authority in each project. Directory, organization chart, and PIC pickers use the current project's labels.

**PEOPLE-02:** Levels have stable project-scoped IDs, editable labels/order, description, and versioned module/action templates. Title describes the job; level supplies a template; role supplies capabilities; position identifies a responsibility slot. Numeric order conveys no automatic inheritance. Client, CA, MWS, vendor, and subcontractor audiences remain separately scoped even when level labels overlap.

**PEOPLE-03:** P1 shall include a project directory, position/manager relationships, basic organization tree, PIC directory, and tabular RACI (Responsible, Accountable, Consulted, Informed). Record holder, alternate, dates, company/scope, vacancy, and accountable coordinator. A visual RACI/org-chart editor and formatted chart export are optional P2 enhancements. RACI designations do not grant workflow rights.

**ACCESS-01:** Settings shall provide By level, By person, and By module views. Cells summarize Hidden/View/Contribute/Manage and expand into screens, actions, fields, and record scope. These are shortcuts to explicit grants, not unrestricted CRUD bundles. Publish versioned changes only after previewing the affected users, responsibilities, approvals, and distribution lists.

**ACCESS-02:** Personal exceptions are Inherit, Allow with scoped actions, or Deny, with reason, grantor, validity, and optional expiry. Explicit denies override all applicable allows. An allow may add a delegated capability absent from a level template but cannot override membership, module state, publication, field restrictions, or workflow conditions. Bind action and scope in each grant. Level changes recompute inheritance and revalidate exceptions.

**ACCESS-03:** Resolve access through organization entitlement → compatible installed module → project operational state → valid membership → level/role/person grants → denies → record/field/workflow rules. Private personal tasks instead use owner-scoped core access and never inherit project grants. New module defaults are proposals requiring explicit adoption; installation or activation does not auto-grant access.

**ACCESS-04:** Preview as level/person shall be read-only, explain each effective allow/deny, and flag inaccessible sources or vacant PIC slots. Bulk changes identify destination project and people count. Copying templates across projects maps scopes explicitly and excludes live personal exceptions and publication grants.

**ACCESS-05:** Published changes invalidate policy caches on the next protected request and revoke unauthorized links/jobs/deliveries. Removing access preserves records/history, flags open responsibilities for reassignment, and does not expose their titles to the revoked user. Review privileged grants, inactive PICs, missing source access, and expiring exceptions; default expiry reminder is five working days. Project adoption of changed master templates is explicit.

## 3. Information architecture and experience

### 3.1 Navigation

```text
Project Flow
  Header — My Projects / Current Project, search, notifications, Profile
  Workspace switch — Personal | EPCIC | Governance | Reports
  Personal
    My Workspace — My Day, Inbox, Assigned to Me, Assigned by Me, Approvals
    Task Management — Project Tasks, Tasks, Calendar, Workload
  EPCIC
    Dashboard
    Engineering — Work Packages, Deliverables, Review Queue
    Procurement — Procurement Plan, Expediting, Logistics, Materials
      Expediting — Vendor Overview, Production Schedule Monitoring
    Planning & Progress — Overall Progress, Work Packages, Milestones
    Yard Execution (display group)
      Construction — Yard Layout, Facility Layout, Workfront,
                     Construction Sequence, Progress & KPI, Productivity
      Fabrication Subcontracting — Progress, Concerns & Highlights
      QAQC
      HSE
    Installation (display group)
      T&I — Workpacks, Timeline & Schedule, Sequence, Progress
    Commissioning (display group)
      Onshore Precom-Commissioning — Systems & Subsystems, Sequence,
                                    Handover Schedule, Check Sheets, Punches
      Offshore HUC — Marine Spread, Timeline & Schedule, Progress
  Governance
    Management — Risks, Issues, Lessons Learned, Management of Change, Stakeholders
    Interface Management — Register, Matrix, Points
    Document Control — MDR, Package/Engineering Registers, Vendor Registers,
                       Transmittals, Reviews, CRS, Correspondence, Dossiers
    Event Management
  Reports
    Minutes of Meetings
    Documents
    Analytics
    Periodic Reports — Weekly Progress, Monthly Progress, Milestones, Engineering,
                       Procurement, Risk & Issue, Interface, Actions
  Settings — Modules, General, Data sources; further pages per §10
```

**NAV-01:** Navigation and quick-create actions shall derive from module operational state and effective permissions. Authorized Read-only/Locked modules remain visibly labeled with prohibited actions unavailable; Pilot is limited to eligible participants. Disabled/future modules appear only in the authorized Settings catalog, with availability and phase labels. Deep links cannot bypass module or access rules.

**NAV-02:** The header shall display organization/project, live or reporting-snapshot context, search/command palette, notifications, and profile. Switching projects rechecks permissions, clears incompatible filters, and warns about unsaved changes. Favorites and saved views retain project context.

**NAV-03:** Historical mode is read-only and limited to stored reporting snapshots and included source revisions. Screens without historical coverage shall say so and offer an explicit return to live data. The app shall not imply arbitrary whole-system time travel.

**NAV-04:** The sidebar shall be organized into workspaces, switchable at its top: Personal, EPCIC, Governance, and Reports. Only the modules of the selected workspace are listed, and Settings stays reachable from every workspace. Personal holds My Workspace and Task Management; EPCIC holds the Dashboard and the delivery modules; Governance holds Management, Interface Management, Document Control, and Event Management; Reports holds Minutes of Meetings, Documents, Analytics, and Periodic Reports. Switching workspace does not change the current project, and it opens the first enabled module that has a delivered screen. A workspace with no enabled module shows an empty state that links to the Modules settings page. The last selected workspace is a personal preference (SET-01) and has no effect on access. “Workspace” here names this navigation grouping; it is distinct from the task views called My Workspace and project task workspace in Section 6.7.

**NAV-05:** Within EPCIC, modules are listed under display groups: Yard Execution (Construction, Fabrication Subcontracting, QAQC, HSE), Installation (T&I), and Commissioning (Onshore Precom-Commissioning, Offshore HUC). T&I is not grouped with HUC, which belongs with Onshore Precom-Commissioning. A group is listed only while one of its modules is enabled. Groups are presentation only, consistent with MOD-09; they carry no permissions or dependencies.

**NAV-06:** Every module and submodule is identified by a breadcrumb path — workspace, display group where one applies, module, submodule, and any deeper level — for example EPCIC / Procurement / Expediting / Vendor Overview. The same path titles the screen header and the module's entry on the Modules settings page. Selecting a module that has enabled submodules opens its first enabled submodule that has a delivered screen.

**NAV-07:** The header shows the project by its short name (the code when none is set; the full title is available on hover and in Settings) and a cut-off dropdown. The dropdown lists the current data with its reporting cut-off and every saved cut-off report, normally dated the Friday the data was imported. Choosing a saved report opens that date's data read-only (NAV-03), with a visible banner and a way back to the current data; derived statuses such as overdue and due soon are evaluated against the report's date. An icon-only snapshot button, available to roles that may manage records, saves the current data as a cut-off report for a chosen date (default the project's cut-off, with a shortcut to the latest Friday); saving over an existing date requires confirmation. A report copies the report datasets (schedule, milestones, procurement, expediting, risks, interfaces) and never changes after it is saved. The sidebar carries no project or cut-off card, and page content uses the full width of the window.

### 3.2 Brand and design system

The product name is **Project Flow**. Adopt the updated Codex draft's selected **StageLink** direction: linked segments/modular blocks, clear connections, rounded panels, and generous spacing around dense operational content. Tagline: **Connected modules. Coordinated delivery.** Landing headline: **Start focused. Build connected.** Use Manrope headings and Inter body/interface text with system fallbacks, tabular numerals, and one outline icon family. Monospace may be used for identifiers, not all body text. Deliver monochrome and light/dark wordmarks, compact icon, favicon, login lockup, and report header as SVG/PNG; a finished logo remains a design deliverable.

| Token | Light | Dark |
|---|---|---|
| Brand | `#343C78` | `#C5CBFF` |
| Interactive accent | `#00877D` | `#69D8CB` |
| Background | `#F8FAFC` | `#111525` |
| Surface | `#FFFFFF` | `#19242F` |
| Main text | `#172B3A` | `#ECF2F8` |
| Secondary text | `#526477` | `#ABBCCB` |
| Border | `#D8E1EA` | `#3B4A59` |
| Success | `#176B45` | `#73D6A2` |
| Warning | `#8C5700` | `#F4C46B` |
| Critical | `#B42336` | `#FF9CAB` |
| Information | `#245BA5` | `#99BFFF` |

**UX-01:** Deliver Light, Dark, and System themes in P1, plus comfortable and compact density. P2 adds a high-contrast field mode with stronger borders and at least 48 px primary touch targets. Semantic status meaning remains constant, while theme-specific shades shall pass actual contrast checks. Status always includes text or an icon.

**UX-02:** Use a 4/8/12/16/24/32/48 px spacing scale, 8 px control and 12 px application panel radii, and restrained overlay shadows; marketing panels may use 16–22 px radii. Default type sizes are 14 px table text, 16 px forms/body, 20 px section titles, and 28 px page titles. Reports use a controlled light print theme. Light is the initial office default; users may select Dark or System. Login artwork must not reveal protected live milestones or HSE statistics before authentication.

**UX-03:** Desktop shell: approximately 248 px expanded sidebar, 72 px collapsed sidebar, 64 px header, and 24 px content margins. Tablet collapses navigation; mobile uses a menu drawer and full-screen record details. Preserve essential column context when tables scroll horizontally. Verify at 390, 768, 1024, and 1440 px widths.

### 3.3 Shared interaction patterns

| Pattern | Required behavior |
|---|---|
| Register | Title and primary action, summary strip, filters, saved views, configurable columns, sort/group, sticky headers, server pagination, permission-aware bulk actions |
| Record | Identifier, title, status, owner, due date; Overview, Related Records, Actions, Attachments, Comments, Workflow, History |
| Inspector | Deep-linkable right drawer for inspection; retain list filters and scroll; expand complex editing to full page |
| Dashboard | Reporting context, freshness/completeness, progress and trends, exceptions, upcoming commitments, personal actions |
| Progress grid | WBS/package/item hierarchy; controlled draft edits; explicit save/submit; accepted totals distinct from pending values |
| Timeline | Baseline/forecast/actual, day/week/month scales, dependencies, milestone markers, accessible table alternative |
| Layout | Drawing revision, zones/layers, search, pan/zoom, pins linked to records, status legend |
| Forms | Grouped fields, inline validation, required markers, server draft save, first-error focus, preserved input on failure |

**UX-04:** All screens shall define loading, empty, filtered-empty, denied, stale, partial-data, error/retry, offline, and success states. Missing data must not appear as zero. Charts show unit, denominator, cutoff, baseline, and a source drill-down/table.

**UX-05:** Inline edits and board/timeline dragging shall obey the same authorization and workflow rules as forms. Moving a date proposes a forecast or change; it never silently revises an approved baseline. Concurrent edits require revision conflict resolution.

**UX-06:** Support keyboard-only core workflows, visible focus, semantic labels, screen readers, reduced motion, and 200% zoom. Target text contrast of at least 4.5:1, large text/essential controls of 3:1, and primary touch targets of 44 px outside field mode. Accessibility is an acceptance test, not an assumed property of the component library.

**UX-07:** English is the P1 interface language; externalize all strings, support Unicode content and regional formats. Additional translations, including Vietnamese, may be enabled when complete and reviewed. Organization branding and project logos must not change semantic colors or permissions.

**UX-08:** Design handoff shall include tokens, reusable components, documented interaction states, and desktop/mobile examples for login, onboarding, dashboard, register, record, approval, timeline, layout, module catalog, access editor, and reports. Include client-restricted examples and a component gallery.

## 4. Shared data and lifecycle rules

### 4.1 Canonical data model

| Entity family | Records and responsibility |
|---|---|
| Identity | Organization, User, Membership, PersonnelLevel, Position, PICAssignment, Party, Team, Role, scoped Grant/PolicyVersion |
| Project structure | Project, WBS node, WorkPackage, Discipline, Facility/Area/Location, System/Subsystem, AssetTag |
| Controls | Activity, Milestone, BaselineRevision, MeasurementRule, ProgressMeasurement, ReportingPeriod, ProgressSnapshot |
| Collaboration | Task (Action compatibility view), SourceLink, Recurrence, Decision, WorkflowDefinition/Instance, Approval, Comment, typed RecordLink |
| Information | Document, RegisterMembership, DocumentRevision, ReviewRoute/Cycle, PartyResponse, ReviewComment, Transmittal/Item, Correspondence, Attachment, Publication, ReportSnapshot |
| Supply chain | ProcurementPackage, Requisition, PO/Line, VendorMilestone, Shipment/Line, Receipt, MaterialLot, StockMovement, Reservation |
| Execution | Workfront, WorkItem, QuantityMeasurement, LaborEntry, Inspection, NCR, HSERecord, Constraint |
| Completion | CheckSheetTemplate/Instance, PunchItem, HandoverPackage, CertificateReference |
| Offshore | InstallationWorkpack, MarineAsset, Booking, HUCCampaign, execution Activity |
| Governance | Risk, Issue, Lesson, ChangeRequest, Stakeholder, Interface/Point, Event, Meeting |
| Platform | ModulePackage/Installation/Activation, ConfigurationVersion, AuditEvent, Notification, IntegrationJob |

**DATA-01:** Every project business record shall have an immutable ID, organization/project context, display code, revision, status, owner, classification, created/updated timestamps and actors. Private personal tasks have owner/organization context and no project ID until explicitly converted; they cannot enter project queries or aggregates. Display-code uniqueness shall be enforced within a documented project/entity namespace. Renaming a code shall not break references.

**DATA-02:** Engineering and Planning share WorkPackage records. Packages may have typed relationships across engineering, construction, installation, and completion, but allocated scope and earning ownership must be explicit. Typed many-to-many links connect packages, documents, tags, systems, interfaces, and material demand without duplicating masters.

**DATA-03:** The traceability path shall support: deliverable revision → requisition/PO line → shipment/receipt/material lot → workfront/work item → inspection/accepted quantity → tag/system check sheet and punch → handover/offshore workpack. Relationships may be many-to-many; each link identifies its purpose and source. Systems/tags shall exist in the shared core before commissioning screens are delivered.

**DATA-04:** Store event instants in UTC and display the chosen timezone. Preserve date-only commitments as dates using the project calendar. Record units and controlled compatible conversion rules. Different physical units must not be summed into one quantity total.

### 4.2 Shared behavior

**CORE-01:** All registers inherit search/filter, saved views, related actions, documents, comments, typed links, import/export, ownership, reminders, and history where applicable. Search results, suggestions, and facets shall respect effective access.

**CORE-02:** Default review lifecycle is Draft → Submitted → Under review → Approved or Returned → Closed/Archived. Modules define valid variations. Each transition validates prerequisites atomically and records actor, time, reason, revision, and workflow version.

**CORE-03:** Approved-content changes create new revisions and invalidate affected approvals according to policy. In-flight workflow instances stay pinned to their original definition unless explicitly migrated with an impact review. P1 supports form-based sequential/parallel approval configuration; a visual workflow editor is optional later scope.

**CORE-04:** Task is the canonical work/action entity; Action is a compatible view, not a duplicate table with independent dates/status. It has source, title, assignee, accountable owner, priority, due date, status, evidence, and escalation route. Meetings, risks, interfaces, and modules reference the same task. Completion and verified closure remain distinct where required. Core workflow tasks remain available to their source modules even if project task workspace screens are disabled.

**CORE-05:** Files shall use private storage, type/size validation, malware scanning, access-checked expiring download links, and controlled revision history. Initial standard file limit is 100 MB; large engineering packages may use approved repository links or an explicitly configured limit. External links do not grant external repository access.

**CORE-06:** Imports shall provide templates, mapping, staging/dry-run validation, row errors, duplicate/orphan detection, create/update preview, batch ID, and reconciliation totals. Commit only after review. Retries shall be idempotent; imports cannot bypass approval, tenant boundaries, or closed periods. Historical backfill shall label imported provenance and approval evidence.

**CORE-07:** Delete only eligible unapproved drafts without dependent records. Supersede or archive approved records. Purge is a separate retention-authorized operation and honors holds. Bulk changes show affected/excluded counts and individual failures; no blanket import rollback may undo subsequent approved work.

**CORE-08:** Append-only audit shall cover material business/configuration changes, approvals, publication, access changes, exports/downloads, and security events. Capture relevant before/after values or immutable revision references, actor, context, timestamp, reason, and correlation ID. Audit access itself is restricted.

## 5. Progress and reporting rules

### 5.1 Rules of credit

**PROG-01:** Each progress-bearing leaf shall select one authoritative method and approved basis:

| Method | Calculation |
|---|---|
| Quantity | `100 × accepted quantity / approved budget quantity` |
| Incremental weighted stages | `100 × sum(earned stage weights) / sum(applicable stage weights)` |
| Weighted children | `sum(child weight × child percent) / sum(child weights)` |
| Binary milestone | 0% until accepted; 100% after acceptance |

Stage rules shall explicitly distinguish incremental weights from cumulative thresholds. Example: engineering cumulative thresholds of 10%, 40%, 70%, and 100% correspond to incremental credits of 10%, 30%, 30%, and 30%; they must not be summed as 220%. Project-specific rules require project-controls approval. Repeated revisions or repeated event delivery cannot re-earn the same stage.

**PROG-02:** Weights shall be nonnegative, explicitly normalized, and validated at each parent. Do not mix unrelated quantities as weights without an approved common weighting basis. Overall EPCIC weights are project-configured; no source draft's sample percentages are mandatory defaults.

**PROG-03:** Track installed, submitted, verified, and accepted quantities separately. Formal actual progress uses accepted quantities/credits under the approved measurement basis. Excess quantity appears as overrun while earned progress is capped at 100% until an approved budget change. Rework or correction may reduce current accepted progress with reason and approval.

**PROG-04:** Zero/missing denominators produce Not calculable. Missing required inputs show incomplete/stale status and block formal publication unless a reporting exception specifies treatment. Display one decimal percentage point by default and retain higher calculation precision.

**PROG-05:** Subcontractor submissions, construction acceptance, procurement progress, and commissioning records must not double-count an allocated scope. Procurement may earn its own approved phase allocation for an item also tracked in Construction, but that is distinct scope credit with a documented allocation.

**PROG-06:** A disabled or undelivered module does not remove project scope from the denominator. Use a controlled manual/imported reporting source with the same approval rules until operational ownership moves to the module. Migration shall reconcile balances and explicitly retire the former earning source.

### 5.2 Reporting and baseline governance

**PROG-07:** Reporting workflow is Open → Enter/import → Validate → Submit → Review → Approve → Publish → Lock. Store reporting period, cutoff, baseline revision, scope/weights, rule versions, source revisions, approvals, exceptions, and calculation version in each immutable snapshot.

**PROG-08:** Scope, calendar, weight, or rule changes require a change request and approved effective period. Show the predicted impact before acceptance. Rebaselining preserves previous snapshots. Cross-baseline comparisons show the basis change and a reconciliation bridge.

**PROG-09:** Correct locked results through a next-period adjustment or explicitly authorized restatement. A restatement creates a new snapshot linked to the original with a reason; the original remains accessible. Current operational data and issued historical reports shall be clearly distinguished.

### 5.3 KPI dictionary

| KPI | Final definition |
|---|---|
| Progress variance | Accepted actual % minus planned %, in percentage points; negative is behind |
| Schedule/delivery variance | Forecast date minus baseline/required date, in project working days; positive is late |
| Period achievement | Current accepted cumulative earning minus previous comparable earning; show basis changes separately |
| Reporting completeness | Required reporting units with valid submissions / all required reporting units |
| On-time delivery | Eligible receipts on/before agreed due date / eligible receipts; show overdue outstanding deliveries separately |
| Productivity | Accepted quantity / direct labor hours, with unit; inverse hours/unit shown only when labeled |
| First-pass inspection acceptance | First inspections accepted / first inspections completed; exclude reinspections from both |
| Check-sheet acceptance | Accepted applicable sheets / approved applicable sheets |
| Punch balance | Opening open + raised + reopened − verified closed, with scope adjustments separately disclosed |
| Overdue action | Not closed and due before the current project date/time under its date semantics |

**PROG-10:** Every KPI shall expose formula, unit, eligibility/denominator, source, cutoff, refresh time, baseline, and configured threshold. HSE incident-rate categories and normalization factors are project-configured and versioned. CPI/SPI require a separately approved EVM basis with compatible PV/EV/AC; physical-progress ratios shall not be labeled SPI.

## 6. Core controls and collaboration modules

### 6.1 Dashboard

**DASH-01:** Provide PM, Manager, Leader, personal-workload, and client layouts. Users may reorder permitted widgets and save layouts; authorized managers may publish role defaults.

**DASH-02:** P1 widgets shall include overall progress, S-curves, milestone trends, overdue actions, review queues, engineering deliverables, procurement risks, top issues/risks, interfaces, and reporting completeness. Add execution/completion widgets only when sources are available.

**DASH-03:** Shared project/period/discipline/area/company/package filters shall apply where supported; disclose widgets that cannot apply a filter. Drill-down shall reconcile to source records. Restricted totals shall not reveal hidden scope.

**Acceptance:** The same audience, period, and baseline yield identical dashboard/report totals; client widgets expose only released data; missing modules produce explicit unavailable states.

### 6.2 Engineering

**ENG-01:** Work-package configuration shall include type, code, scope, WBS, discipline, area/system, owner, company, dates, weight, dependencies, deliverables, mandatory fields, and approved measurement rule. Templates and imports shall create canonical packages.

**ENG-02:** Deliverables shall track document number/title, revision, purpose/status, responsible engineer, reviewer, planned/forecast/actual issue dates, review result, holds, and release audience. Document binaries/revisions belong to the shared document service.

**ENG-03:** P1 shall support deliverable register, review queue, discipline summaries, look-ahead, manual/imported updates, stage credit, and links to procurement/interface needs. P1 Document Control supplies transmittals, multi-party review, and structured comment consolidation; Engineering reuses those records. P2 adds optional dedicated technical-query/deviation workflows and richer automation. External document-system synchronization is an optional adapter.

**ENG-04:** A superseded/held drawing shall identify affected workfronts and packages. Accepted progress and readiness follow the approved revision policy; a new upload cannot silently become an approved construction drawing.

**ENG-05:** P2 shall track MTO (Material Take-Off) revision references and changes in demand, plus model-review milestones such as 30/60/90% with assigned reviewers, findings, and closure tasks. These are controlled review records; an embedded 3D viewer is an optional extension. MTO changes require reconciliation with material demand and MOC where applicable.

**Acceptance:** Planning sees the same package ID; repeated issue stages do not double-earn credit; a blocking technical hold is visible in dependent readiness checks.

### 6.3 Planning and Progress

**PLAN-01:** Maintain WBS, packages, activities, milestones, dependencies, calendars, baseline/forecast/actual dates, reporting periods, and approved curves. Provide overall and discipline rollups, look-ahead, milestone trend, and source completeness views.

**PLAN-02:** Milestones shall include category, owner, related scope, baseline/forecast/actual dates, predecessor references, completion evidence, acceptance authority, criticality, and publication. Completion requires evidence and configured acceptance.

**PLAN-03:** Until milestone authoring exists, milestones are reference data: the project's Key Milestones workbook is loaded once per project (ID, key date, baseline, subcontractor plan, subcontractor, forecast, actual, variance, comment) and shown read-only with filter, search and export. Status is derived against the reporting cut-off: Done when an actual date exists; otherwise Overdue when the forecast (or baseline) is before the cut-off, Due soon within 30 days, else Planned. Risks and interfaces may reference a milestone by ID.

**PLAN-03:** P1 shall support manual entry and validated CSV/XLSX schedule import. Imported criticality/float must name its source and cutoff. Automatic critical-path scheduling and bidirectional schedule synchronization are excluded unless a named adapter is separately accepted.

**Acceptance:** Approved progress reproduces from stored inputs; forecast changes leave baseline dates intact; rebaselining preserves historical issued totals.

### 6.4 Management registers

| ID | Register | Required information and workflow |
|---|---|---|
| MGT-01 | Risk | Cause/event/effect, owner, category, likelihood, impact dimensions, inherent/residual score, mitigation actions, trigger, review date, status; versioned scoring matrix and heatmap |
| MGT-02 | Issue | Source, severity, impact, owner, target, containment, actions, resolution evidence; Open → Triaged → In progress → Resolved → Verified/Closed, with reopen |
| MGT-03 | Lessons Learned | Context, cause, result, recommendation, applicability, author, reviewer, tags; Draft → Reviewed → Published → Archived |
| MGT-04 | Management of Change | Reason, alternatives, scope, schedule/cost/resource/quality/HSE/interface impacts, reviewers, decision, effective date, implementation verification; Draft → Assessment → Review → Approved/Rejected → Implementing → Verified → Closed |
| MGT-05 | Stakeholders | Person/party, role, influence/interest, contacts, communication needs, engagement owner/cadence, confidentiality; register and engagement matrix |

P1 provides these registers and manual impact assessment. P2 enriches impact links with execution data. Realized risks link to Issues without erasing history. Cross-project lesson publication requires explicit access and classification. Approved MOC triggers controlled baseline/scope revisions; approval alone does not mean implementation is complete.

**Acceptance:** Unauthorized baseline mutation is blocked; issue closure requires evidence; client access cannot expose internal stakeholder assessments.

### 6.5 Interface Management

**INT-01:** Maintain interface ID/type, originator and receiving party, accountable coordinator, disciplines/packages/systems, boundary, required input/output, need date, response, acceptance criteria, status, and linked evidence. Each interface may contain separately owned points.

**INT-02:** Lifecycle is Identified → Assigned → Information requested → Responded → Under review → Agreed → Closed. Closure requires receiving-party acknowledgment when configured, rather than treating a sent response as acceptance.

**INT-03:** Party, discipline, and package matrices shall derive from the register. Cells drill down to authorized open/overdue/accepted records. P1 includes register, points, basic matrix, and reminders; P2 adds boundary visualization and external-party submission journeys.

**INT-04:** The first delivered Interface Management screens implement INT-01 to INT-03 as follows. Points are blocking: an interface cannot close while any of its points is neither accepted nor closed. Status changes happen only through a dedicated transition action that checks the allowed next states, a named coordinator before Assigned, and a recorded response before Responded; a plain edit cannot change status. Originator and receiving party must differ. A party-by-party matrix counts open, overdue and settled interfaces and drills down to the filtered register. Reminders, discipline/package matrices and receiving-party acknowledgment configuration remain open.

**MGT-06:** The first delivered Risk screens implement MGT-01 with a versioned 5×5 matrix (v1): score is likelihood × impact; Low below 5, Medium 5–9, High 10–16, Extreme 17 and above. Inherent and residual scores are stored separately and the residual score, once recorded, is the current score. A risk may link to a milestone. The heatmap counts only active risks (Open, Mitigating, Accepted). A review date earlier than the reporting cut-off flags an active risk as overdue. Impact dimensions, mitigation action records and matrix configuration per project remain open.

**Acceptance:** Matrix counts reconcile; an unresolved point blocks configured parent closure; client participants see only published interfaces assigned to their audience.

### 6.6 Events, minutes, documents, and reports

**EVT-01:** Events shall include type, title, organizer, participants, project timezone, start/end, location/link, recurrence, related scope, reminders, and visibility. One-occurrence versus series edits and cancellation shall be explicit. P1 supports in-app calendar and downloadable calendar files; external invitations require recipient review and a send action.

**REP-01:** Minutes of Meetings shall contain agenda, attendance, discussion, decisions, shared actions, owners/dates, attachments, and distribution. Lifecycle is Draft → Review → Issued → Revised. Carry actions forward by reference; issued minutes preserve the action state at issue while live views show current state.

**REP-02:** Reports → Documents shall be an authorized view of the P1 Document Control module, including metadata, revision history, classifications, review/approval, transmittals, acknowledgments, distribution, and controlled publication. It is not a second repository. P2 expands automation and external-party submission; advanced dossiers arrive in P3.

**REP-03:** P1 supplies predefined weekly/monthly progress, milestone, engineering, procurement, risk/issue, interface, and action reports. P2 adds a governed report builder and scheduled distribution. Export PDF for formal reports and XLSX/CSV for tables; neutralize formula-like text in spreadsheet exports.

**REP-04:** Formal reports shall be immutable, versioned snapshots with filters, reporting basis, commentary, approval, audience, and supersession. Recheck access at generation and delivery; use controlled links by default. Explicit attachment distribution shall disclose that already-downloaded copies cannot be revoked.

**Acceptance:** Issued documents and reports remain reproducible; hidden columns are absent from exports; rescheduled/cancelled events do not produce obsolete reminders.

### 6.7 Tasks Management and PIC coordination

**TASK-01:** My Workspace shall provide My Day, Inbox, Upcoming, Overdue, Assigned to me, Assigned by me, My approvals, and private lists. Aggregate only currently authorized project tasks across projects, each labeled by project/source. Filter by project, date, status, priority, assigner, and module. Selecting a cross-project task shows its context and offers Open in project.

**TASK-02:** Private tasks belong to their creator and support description, checklist, dates, priority, notes, reminders, and authorized source links. PMs, clients, team workload charts, and project analytics cannot access them by default. Private tasks cannot be assigned to others. Exceptional administrative access follows a declared, audited organization policy; ordinary project administration does not qualify.

**TASK-03:** Conversion creates a new project task after previewing the destination, participants, and selected fields/comments/files to share. Recheck project/source rights and copy only selected content. Preserve a private conversion reference; do not expose the private original. Project tasks cannot become private to conceal their history.

**TASK-04:** Project workspace shall offer list, board, calendar, workload-by-assignee, approvals, and package/module views. Task data includes code, title, description, project, authoritative source, WBS/package, discipline/area/system, accountable owner, primary assignee/PIC, contributors, requester, reviewer, party, priority, status, start/due dates, optional estimated/actual effort, dependencies, evidence, classification, watchers, and revision. Use Low/Normal/High/Urgent priorities so priority labels do not conflict with release phase labels.

**TASK-05:** PIC means Person in Charge. Resolve responsibility through record-specific PIC → package PIC → discipline/module PIC → designated project coordinator. Slots may identify a position, named person, or queue with an accountable coordinator. Show resolution source and effective dates. Unresolved assignments enter a visible coordination queue; they do not disappear or silently select another project's personnel.

**TASK-06:** Shared PIC pickers shall search by project name/title/level, party, discipline, and scope, show eligible active members and authorized workload, and validate source access. Assignment is not an access grant. Block assignment or raise a separate access request if minimum access is absent. A redacted standalone task is allowed only through an explicit workflow; never leak the restricted source title/link.

**TASK-07:** Source actions shall create/update one canonical task per source ID + revision/review cycle + workflow step + responsibility slot. SourceLink records module/entity/ID/revision, authoritative relationship, and source-owned fields. Cover MoM, risk/issue, MOC, interface, document preparation/review/CRS, expediting, workfront constraints, check sheets/punches, NCR/HSE, subcontractor concerns, and event preparation as those modules ship.

**TASK-08:** Synchronize permitted PIC, dates, status, and comments through validated source transitions and idempotent events. Source-owned dates/status are read-only in generic task editing. A review task requires an actual review decision; uploading IFC does not imply all approvals; a rectification task does not close a punch/NCR before verification. Show pending sync/failure and run reconciliation to detect orphan/duplicate tasks.

**TASK-09:** Default project lifecycle is Draft → Assigned → In progress → Submitted for review → Completed → Closed, with Blocked/On hold, Returned, Cancelled, and Reopened branches. Simple tasks may omit review. Optional assignment acceptance allows Accept or Request reassignment with reason; responsibility returns to the owner/queue. Evidence requirements and source approval rules remain mandatory regardless of board movement.

**TASK-13:** Personal Task Management → Tasks shall show one set of the user's own tasks in four views switched by tabs: List (sortable table), Card (cards with a sub-task checklist that can be ticked in place), Kanban (columns Backlog, Planned, Ongoing, Completed; dragging a card to another column changes its status, with a non-drag alternative), and Gantt (a bar from plan start to plan finish with a deadline marker, listing only tasks that have plan start, plan finish and deadline and saying how many were left out). All views share search and filters by project, urgency and status. A task is defined by: task number (assigned automatically, unique, never reused), title, description, urgency (Low, Normal, High, Urgent), assigner, projects (zero, one or several of the projects the user belongs to), plan start, plan finish, due date (the deadline), status, estimated effort in hours, sub-tasks (add, remove, tick to complete) and remarks. Plan finish may not precede plan start.

**TASK-14:** Stored task status is Backlog, Planned, Ongoing or Completed. Overdue is derived and never stored: a task whose due date is before today and that is not Completed is Overdue, is flagged in every view, and can be filtered. Status is free to move in any direction; completing sub-tasks does not complete the task. Private-task confidentiality (TASK-02) applies: only the owner sees these tasks and their effort.

**TASK-15:** Task Management → Calendar shows the same tasks by day, week or month, placing each on its plan start–finish span and marking its deadline, with the same filters and creation of a task for a chosen day. Task Management → Workload shows, per week or per month and per project, the number of tasks and the estimated hours, with open-only and all-status totals. A task counts in the period of its deadline, else its plan finish, else its plan start; tasks with no date are reported separately and tasks outside the range are counted. A task linked to several projects counts in each project, and the period total counts each task once. A task with no project appears as "No project".

**TASK-10:** Support subtasks, structured blockers, finish-to-start dependencies, recurrence, templates, comments/files, watchers, and reminders. Reject dependency cycles. Cross-project dependencies require access to both endpoints. Recurrence creates separate dated instances and supports single/future-instance edits. P1 includes manual quick-add and basic recurring templates; natural-language input, email-to-task, and richer timeline planning are optional P2 enhancements.

**TASK-11:** PIC changes shall preview affected open tasks and allow future-only, selected transfer, or retain-existing assignments. Record old/new person, reason, actor, dates, notifications, and approval impact. Closed-task attribution remains intact. Suspension/expiry flags vacancies and routes work through approved fallback; revocation removes restricted content from the former assignee's workspace rather than preserving leaked titles.

**TASK-12:** Workload shall use only authorized project tasks and shared effort, distinguish missing estimates from zero, and compare capacity only when a valid calendar exists. Bulk reassignment/rescheduling/closure requires authority and shows excluded records. Task completion percentages never automatically become physical EPCIC progress. Client tasks require explicit publication and action grants; being addressed to COMPANY alone does not publish them.

**Acceptance:** A MoM action appears once across both workspaces; source changes reconcile without duplicate reminders; private notes never appear in workload; revocation removes source details; task closure cannot bypass source review; the same title/level in a different project never determines PIC eligibility.

### 6.8 Document Control

Document Control is a dedicated P1 business module over core files, revisions, tasks, workflows, and shared structures. Engineering, Procurement, and Reports use the same document IDs. P1 includes registers, numbering, transmittals, multi-party review, and structured CRS; P2 enhances submission/annotation/integration automation; P3 adds final dossier assembly and handover.

**DOC-01:** Maintain one project-wide Master Document Register (MDR) covering contractor, engineering, vendor, subcontractor, quality, HSE, installation, commissioning, and handover information. Engineering/package registers, vendor/equipment registers, subcontractor registers, and interface-document lists are typed views/memberships. One document has one owning party, revision chain, owning register, and explicit progress allocation even when shown in multiple packages.

**DOC-02:** EMDR terminology is project-configurable: it may mean Engineering Master Document Register or Equipment/Vendor Master Document Register under the contract. Store the semantic register type separately from its display label and require its definition during setup. Vendor records also support VDR/SDRL labels and PO/vendor/tag links. Never infer register type solely from the acronym or count a document twice in MDR totals.

**DOC-03:** Metadata shall include number/title/type, originator/company, discipline, WBS/owning and related packages, systems/tags, register membership, PIC/checker/approver/controller, confidentiality, native/PDF files or repository references, revision, issue purpose, suitability/use status, contractual requirement, planned/forecast/actual issue dates, review deadlines/routes, separate party dispositions, holds, supersession, and distribution class. Vendor records include PO and vendor document number. Planned entries may exist without a file.

**DOC-04:** Numbering shall configure segments, separators, sequence, originator/facility/discipline/type codes, revision syntax, uniqueness, and vendor block reservations. Enforce project/document-number uniqueness and revision uniqueness within the document. Corrections retain aliases, immutable IDs, and a reason. Support company-format imports/exports with validation.

**DOC-05:** Keep revision lifecycle, issue purpose, technical disposition by party, and distribution state separate. Suggested lifecycle: Planned → Draft → Internal check → Authorized for issue → Transmitted → Review in progress → Response received → Cycle closed or Revision required → Superseded/Archived. Purpose labels such as IDC/IFR/IFA/IFC/AFC/IFI/As-built are mapped per project, not hardcoded as equivalent approvals.

**DOC-06:** Uploaded revisions require validation, metadata, duplicate checks, and checksums. A transmitted binary is immutable; replacement requires a new revision or audited correction. Optional working-copy locks expire and support audited release. Generated watermarks/stamps identify purpose, revision, supersession, and uncontrolled print status without overwriting the original binary. Checksums are integrity evidence, not certification.

**DOC-07:** Incoming/outgoing transmittals shall identify number, sender, recipient organizations/people, purpose, exact revisions/files, cover PDF, message, due date, distribution, acknowledgment, and external reference. Validate recipients/classification before issue, freeze issued contents, and retain sent/received/acknowledged/failure timestamps. Support batch issue, partial returns, and outstanding-response tracking. Recall/correction is an auditable notice, not deletion of past distribution.

**DOC-08:** External links shall be recipient-scoped, expiring, and access-checked. P1 supports authenticated reviewers and controller-recorded external returns; record external respondent and recording user separately. Guest/vendor/subcontractor upload portals are optional P2 enhancements with restricted upload targets and scanning. Recheck rights before sending, downloading, or exposing returned files.

**DOC-09:** Configure independent internal, client/COMPANY, CA, MWS, class, and other-authority review routes by type/package/purpose. MWS means Marine Warranty Surveyor; confirm CA's contractual identity and authority during setup. Support parallel/sequential steps, required reviewers, lead/consolidator, calendars, deadlines, review types, and route versions. Changes require a reason and cannot silently drop a mandatory route.

**DOC-10:** Each cycle binds to exact revision, transmittal, route version, reviewer/party, response code, dates, attachments, and authority. A new revision creates a new cycle or explicit carried-forward review. Older approval never appears as latest-revision approval. Client, CA, and MWS decisions stay independently visible subject to audience rights.

**DOC-11:** P1 CRS (Comment Resolution Sheet) shall support structured entry and spreadsheet import/export plus annotated-file attachments. Record original comment ID, party/reviewer, revision/page/section, discipline/category/severity, text, responder PIC, response/action, evidence, status, and cross-revision carry-forward. Lifecycle is Open → Responded → Awaiting reviewer acceptance → Closed/Reopened. Preserve conflicting reviewer comments for lead resolution. Replies alone do not close comments; configurable gates may block reissue while mandatory comments remain unanswered.

**DOC-12:** Map each review body's return codes to acceptance, resubmission requirement, use restriction, and readiness effect. Templates may include Accepted, Accepted with comments, Revise/resubmit, Rejected, and Information only; identical code numbers across parties need not mean the same thing. Deadline expiry triggers reminders/escalation, never automatic approval by default. Any contractual deemed-acceptance rule requires explicit configuration/authority, evidence, applicability, and audit, and cannot bypass a separate non-waivable gate.

**DOC-13:** Compute release-for-use from all applicable mandatory routes, blocking comments/holds, revision, and required certificate evidence. Internal/client acceptance cannot override outstanding required CA/MWS review. Document submission credit and permission to use the document are separate outcomes. Track MWS Certificate of Approval (CoA), design-verification/class evidence, scope, revision, validity, and operation linkage where the configured procedure requires them.

**DOC-14:** Review/CRS responsibilities create canonical PIC tasks. Due-date/assignment changes and actual source decisions synchronize through TASK-07–11. Basic correspondence in P1 records incoming/outgoing reference, subject, party, date, response due, PIC/task, attachment, thread, and linked document/MOC/issue. A letter or technical reply does not automatically approve a change.

**DOC-15:** Controlled distribution shall resolve project positions, parties, disciplines, and packages. Current-revision links/QR references retain authorized historical access and warn about superseded files; printed/downloaded copies show revision/time. Revocation, supersession, or a new hold creates an impact review for procurement/workfront/inspection/T&I/handover gates and preserves previous release evidence.

**DOC-16:** Provide register, pending-review, overdue-return, returned-document, hold/CRS, distribution, package-completeness, vendor-data-due, and as-built-readiness views. KPIs shall distinguish document, revision, and review-cycle counts, applicable scope, party, cutoff, and denominator. Do not collapse CA/client/MWS approval aging or double-count documents in multiple registers.

**DOC-17:** P3 dossiers shall assemble revision-specific file manifests/checksums, metadata, reviews/CRS, transmittals, certificates, as-builts, and required handover evidence by package/system. Track completeness and receiving acceptance; publish audience-aware dossier indexes and archive manifests. Retention/holds cover decisions, returns, and revisions as well as files. Native PDF annotation, OCR/comparison, and two-way EDMS synchronization are optional enhancements, not prerequisites for P1 controlled review.

**Acceptance:** One document in two package registers counts once in the MDR; Engineering/Reports open the same record; transmitted content cannot be overwritten; pending MWS review blocks the applicable operation; a new revision does not inherit old approval silently; responding to a CRS comment does not close it without the required acceptance.

## 7. Supply chain modules

### 7.1 Procurement Plan

**PROC-01:** Track procurement package, requisition, inquiry, evaluation, award, PO/lines, buyer/vendor, WBS, criticality, quantities/units, contractual delivery, required-on-site date, forecast arrival, and document references. Commercial fields have separate permissions.

**PROC-02:** Lifecycle is Planned → Requisition ready → Inquiry → Evaluation → Awarded → PO issued → In execution → Delivered → Closed. Project-specific gates include technical/commercial evaluation and award recommendation with configured approvals.

**PROC-03:** Link required-on-site dates to consuming activities. Forecast slippage shall identify affected packages and create a risk/action when configured without changing their approved baseline. Provide buyer workload, critical items, milestone timeline, and award/delivery exceptions.

**Acceptance:** Duplicate package codes are rejected; a late PO line identifies consuming scope; operational exports exclude unauthorized commercial values.

### 7.2 Expediting

**EXP-01:** Track vendor engineering, material readiness, manufacture, inspection/FAT, release, packing, and dispatch milestones with baseline/forecast/actual dates, evidence, expeditor, and next follow-up.

**EXP-02:** Record contacts, shop visits, photographs, promised dates, bottlenecks, corrective actions, partial quantities, and split deliveries. Manufacturing stage credit is separate from physical receipt. P1 permits controlled dispatch/receipt references; P2 links canonical shipment and receipt records.

**Acceptance:** A split delivery preserves outstanding quantity; repeated vendor updates do not duplicate credit; changed promises retain history and replace obsolete follow-ups.

#### 7.2.1 Production Schedule Monitoring

**VPROD-01:** Expediting → Production Schedule Monitoring shall provide a vendor-management workspace with production overview, schedule/timeline, progress, risks, highlights, concerns, review log, and action follow-up. Filters include project, vendor, PO/line, package, equipment/tag, discipline, criticality, PIC, status, and reporting cutoff. Overview totals shall reconcile to the filtered records and identify stale or missing vendor submissions.

**VPROD-02:** Each production plan shall reference the canonical vendor, PO/line and work package and capture scope/quantity/unit, manufacturing location, responsible vendor contact, project expeditor/PIC, reporting frequency, current reporting date, approved baseline version, forecast, required-on-site date, and source evidence. Support sub-vendor activities, split lots and partial completions without duplicating parent quantities or procurement credit.

**VPROD-03:** Production activities shall include engineering/vendor-data readiness, raw-material procurement, fabrication, assembly, inspection/NDE, coating, FAT, release, packing and dispatch as applicable. Record predecessors, responsible party, baseline/forecast/actual start and finish, planned and reported/verified/accepted progress, production quantities, blockers, evidence, and recovery actions. Show planned versus actual/forecast bars and milestone markers, with accessible tabular alternatives. This is schedule monitoring; automatic critical-path or resource optimization requires a separately scoped scheduler.

**VPROD-04:** Monitor working-day finish variance, required-on-site exposure, overdue/incomplete milestones, upcoming FAT/witness points, manufacturing-progress variance, and update completeness. Forecast site arrival shall include configured transport/clearance assumptions; vendor factory finish must not be presented as site arrival. Missing assumptions produce Unknown exposure, not an on-time assurance. Positive date variance means late; physical progress variance is accepted actual minus planned in percentage points.

**VPROD-05:** Vendor submissions shall pass Draft → Submitted → Expeditor review → Accepted/Returned, with optional Manager approval by policy. Preserve reported versus accepted figures and source/reporting period. Manufacturing progress uses approved stage/quantity rules and remains distinct from dispatch, receipt, and construction earning. Generic task completion or a vendor-reported 100% shall not approve production, FAT, or release-for-use automatically.

**VPROD-06:** Record vendor-production risks with cause/event/effect, probability/impact, severity, owner, mitigation, trigger, due/review dates, affected activities/POs, and residual assessment. Reuse the canonical Risk register with a vendor-production classification; materialized risks link to Issues. Concerns shall track observed capacity, manpower, material, technical, quality, schedule, or sub-vendor problems with consequence, owner, recovery action, due date, evidence, and verified closure. Use canonical Issues/Tasks rather than parallel unresolved-action lists.

**VPROD-07:** Vendor-management highlights shall record dated achievements, positive developments, key decisions, recovery successes, and upcoming critical events with author, period, affected scope, evidence, visibility, and review status. Keep Highlights separate from actionable Concerns and uncertain Risks. Support weekly review notes, attendees, commitments, previous/current forecasts, and an issued summary retaining the state at that cutoff.

**VPROD-08:** Expeditors and authorized vendor-management personnel may review submissions, update forecasts, raise risks/concerns/highlights, assign PIC actions, request recovery plans, and record shop visits. Vendor contributors are restricted to their company/package and submission rights; acceptance, baseline change, and client publication remain separately granted. Create deduplicated canonical Tasks for commitments and escalate stale updates, missed milestones, high risks, and overdue recovery actions under project rules.

**VPROD-09:** Recovery plans shall identify revised sequence/forecast, accountable owner, actions, target dates, resource assumptions and expected improvement. Forecast edits retain prior values; a recovery plan never silently changes the approved baseline. Rebaselining requires approved MOC, impact preview, effective date, and version. Downstream delivery/workfront impacts shall be refreshed while preserving issued reports.

**VPROD-10:** Provide vendor scorecards and weekly production reports showing as-of date, baseline, planned/reported/accepted progress, schedule variance, delivery exposure, production achievements, open risks/concerns, highlights, recovery commitments, overdue tasks, and next review. Support audience-aware PDF/XLSX/CSV export and the existing publication workflow. Links shall open the same underlying PO, Risk, Issue, Task and document evidence.

**Acceptance:** A delayed raw-material activity identifies affected production/FAT/delivery milestones; a changed forecast leaves baseline and previous reports intact; a stale or unreviewed vendor submission is visible without earning accepted progress; a concern action appears once in Tasks; restricted vendor/client views never expose another vendor's data or internal assessments. Missing transit assumptions yield Unknown site exposure. Closing a task does not independently accept FAT or clear a production quality hold.

### 7.3 Logistics

**LOG-01:** Shipments/lines shall reference PO lines, vendor releases, packing lists, mode/carrier, route/legs, dimensions/weight, departure/arrival dates, customs status, receiving location, and documents.

**LOG-02:** Lifecycle is Planned → Booked → Ready → In transit → Clearance → Arrived → Received/Exception → Closed. Track partial receipts, shortages, damage, proof of receipt, and unresolved claims. Arrival alone does not make inventory accepted/available.

**Acceptance:** Shipped, received, rejected/quarantined, and outstanding balances reconcile by PO and shipment line.

### 7.4 Materials

**MAT-01:** Maintain material/tag/serial/heat-batch references as applicable, unit, location/bin, condition, certificates, preservation requirements, and demand allocation. Ledger transactions include receive, inspect, accept/quarantine/reject, reserve, issue, return, transfer, adjust, and scrap.

**MAT-02:** Each movement shall identify source document, quantity/unit, location, actor, time, and reversal/correction linkage. Prevent negative available stock and concurrent over-reservation transactionally. Quarantined/rejected stock cannot satisfy readiness. Returns require condition acceptance before becoming available.

**MAT-03:** Workfront views shall show required, available, reserved, issued, and shortage quantities. Preserve traceability through installed scope and certificates. Provide receiving queue, shortage, preservation-due, stock, and movement views.

**MAT-04:** Preservation requirements shall identify item/lot/tag, procedure/revision, interval, conditions, PIC, evidence, due date, and handover responsibility. Generate recurring canonical tasks and record missed/failed routines as condition constraints according to policy. Track MRR (Material Receiving Report), OSD (Over/Short/Damaged), and bag/tag allocation references without replacing stock movements with status labels.

**Acceptance:** Two users cannot reserve the same last available item; unit conversions reconcile; damaged receipts cannot release a workfront.

## 8. Yard execution, quality, and safety

### 8.1 Construction

**CON-01:** P2 Yard Layout shall support revision-controlled drawings/images, zones, storage/laydown/crane/access pins, linked workfronts, constraints, search, layers, and zoom. Spatial pins are indicative unless explicitly calibrated. P3 Facility Layout adds decks/areas/systems/equipment overlays and annotation reconciliation on drawing replacement.

**CON-02:** Workfronts shall record scope, location, owner, predecessors, drawings, material demand, resources/access, permit references, inspections, and release evidence. Lifecycle is Draft → Constraint review → Ready → Released → In execution → Complete → Accepted; suspension/revocation records new blockers.

**CON-03:** Readiness shall evaluate at least engineering approval/holds, material acceptance and availability, predecessor acceptance, resources/access, QAQC holds, and HSE constraints. Each gate has source revision, evaluator, evidence, validity/expiry, and waiver policy. Re-evaluate at release and after relevant source changes. Missing sources remain unresolved, not implicitly passed.

**CON-04:** Non-waivable gates cannot be bypassed. Permitted exceptions require designated authority, rationale, scope, expiry, and evidence. A status dropdown alone cannot release work. An upstream invalidation shall notify owners and suspend affected release where the project policy requires it.

**CON-05:** Progress shall track discipline quantities and approved steps against packages/work items, with installed/submitted/verified/accepted values and evidence. P2 includes quantity/KPI tracking, look-ahead, and basic productivity using accepted quantities and direct hours. P3 adds linked sequence/dependency visualization and bottleneck analysis.

**CON-06:** Productivity shall keep units and direct/support/nonproductive hours distinct. Zero hours yields Not calculable. Baseline norms and variance are visible only to authorized audiences. Sequence views shall distinguish imported scheduler results from manually entered dependencies.

**Acceptance:** Held drawings, quarantined material, failed inspection holds, and active stop-work constraints prevent configured release; accepted quantities reconcile to progress; drawing updates never silently move pins to an unrelated revision.

### 8.2 Fabrication Subcontracting

**SUB-01:** Assign canonical scope to contractor/company/package; capture submitted quantities/stages, evidence, concerns, highlights, owner, due date, and corrective actions. Maintain contractor forecasts and review history.

**SUB-02:** Subcontractor input shall feed construction acceptance through a single earning allocation. Their views are company/package-scoped. Distinguish subcontractor-reported and project-accepted progress and retain disputed quantities separately.

**Acceptance:** A quantity submitted through both screens earns once; one contractor cannot inspect another contractor's restricted records or commercial values.

### 8.3 QAQC

**QA-01:** Maintain inspection/test plans, inspection requests and results, hold/witness points, NCRs, certificates, and corrective actions linked to work items, tags, lots, and document revisions. Capture inspector, date, procedure, result, evidence, and required witness/acceptance.

**QA-02:** NCR workflow is Raised → Reviewed → Disposition proposed → Approved → Implemented → Verified → Closed. Hold-point release requires an authorized decision. Failed inspections preserve installed quantity but withhold accepted progress where the measurement policy requires it.

**QA-03:** Provide first-pass acceptance, inspection completion, hold counts, NCR aging, and overdue corrective actions with explicit denominators. Independent verification is required where specified by workflow.

**QA-04:** P2 shall support weld/NDE records linked to work items and heat/batch references, welder qualification/continuity evidence and expiry, and configured RT/UT/MT/PT test methods. Welding repair rates shall declare whether the denominator is inspected length, weld count, or another approved basis and separate first tests from retests. Request for Inspection and technical Request for Information shall use distinct record types even when both are labeled RFI.

**Acceptance:** Failed holds block downstream release; closing an NCR without required verification is denied; acceptance references the tested item and procedure revision.

### 8.4 HSE

**HSE-01:** Maintain observations, incidents, near misses, hazards, inspections, toolbox meetings, corrective actions, stop-work constraints, and permit references. Incident fields include time/location, classification, facts, immediate response, investigation owner, cause, evidence, actions, and review.

**HSE-02:** Restrict sensitive personal/health data at field and record levels. Stop-work clearance requires the designated authority and evidence. Urgent notifications may bypass quiet hours only under the configured policy; the app is not the sole emergency communication channel.

**Acceptance:** Restricted incident details remain absent from search, analytics, exports, and notification content; clearance records who authorized resumption and why.

## 9. Completion, installation, and offshore execution

### 9.1 Onshore Precom-Commissioning

**COM-01:** P2 shall deliver systems/subsystems views, tag linkage, check-sheet template/instance management, punch capture/closure, and completion KPIs. This enables field evidence capture before P3 handover and sequence orchestration.

**COM-02:** Check sheets shall identify template revision, applicable tag/system, required checks, responsible executor, verifier, evidence, status, and acceptance. Submitted is not Accepted. Applicability changes require review and a versioned denominator; reopening invalidates affected readiness and current acceptance according to policy.

**COM-03:** Punches shall identify category/severity, affected tag/system, location, description/photo, origin, owner, due date, rectification evidence, verifier, status, and stage-blocking rules. Lifecycle is Open → Assigned → Rectified → Verification → Closed, with reopen. Category names may be configured; their blocking rules must be explicit.

**COM-04:** P3 shall deliver commissioning sequences and handover schedules/packages. Configure stage gates such as mechanical completion, ready for commissioning, and ready for startup. Each gate defines applicable accepted sheets, blocking punches, document dossiers, inspection releases, signatories, and allowed exceptions. A percentage alone cannot establish readiness.

**COM-05:** Handover shall freeze an evidence manifest identifying revisions, signoffs, exceptions, and receiving-party acceptance. An item reopened after issue flags the affected package for reassessment; previously issued certificates remain preserved and may be superseded.

**Acceptance:** A missing mandatory sheet or open blocking punch prevents handover; rectification alone does not close a punch; onshore/offshore views reference the same system and punch IDs.

### 9.2 Transportation and Installation

**TI-01:** Workpacks shall contain scope/cargo, location, approved procedure references, vessel/spread requirements, personnel/resources, predecessors, readiness gates, and acceptance evidence.

**TI-02:** Timeline and sequence shall cover mobilization, loadout, sailaway, arrival, installation, survey, completion, and demobilization with baseline/forecast/actual dates, hold points, weather-window assumptions, and contingency paths. Manual assumptions shall be timestamped and identified; external weather feeds are optional.

**TI-03:** Progress shall use accepted workpack stages/quantities, daily achievements, remaining scope, delays, and downtime reasons. Vessel utilization is separate from physical installation progress. Shared marine bookings shall detect incompatible overlap before publication/release.

**Acceptance:** Unapproved mandatory procedures block release; vessel conflicts are surfaced; completed installation links to acceptance evidence.

### 9.3 Offshore HUC

**HUC-01:** Marine spread shall register vessels/barges/support and accommodation assets, roles, capacity, availability, location, restrictions, and shared bookings. Optional people-on-board summaries require configured limits and separately protected personal detail.

**HUC-02:** Timeline shall coordinate hook-up, offshore commissioning, system access, marine resources, and handover windows. Onshore readiness delays shall identify dependent offshore scope.

**HUC-03:** Capture package/system achievements, accepted quantities, check sheets, punch closure, constraints, productive/nonproductive hours, and forecasts. Reuse completion entities with execution-location attributes; do not create parallel punch/system masters.

**HUC-04:** P3 shall support day/night shift look-ahead, discipline burn-down, operating restrictions, and reason-coded downtime including waiting on weather and access/gangway unavailability. Manual POB/capacity summaries are core HUC scope when enabled; bed-allocation optimization, personal travel/helicopter manifests, live vessel tracking, and weather-feed integration remain separately approved enhancements.

**Acceptance:** The same punch closes once in aggregate counts; unavailable marine assets block configured readiness; completion evidence remains traceable through final acceptance.

## 10. Notifications, Profile, and Settings

**NOT-01:** P1 channels are in-app and email. Triggers include assignment, mention, approval, due/overdue, reporting cutoff, delivery slippage, unresolved interface, readiness change, and report availability. Later modules register their own event types and defaults.

**NOT-02:** Rules shall define condition, date/threshold, project calendar, recipients, channel, repeat interval, quiet-hours policy, escalation, and end condition. Initial reminders are three and one working days before due; daily overdue digest; escalation after two working days to Leader, five to Manager, and ten to PM. These are configurable defaults.

**NOT-03:** Support preferences, digest time, personal reminders, snooze, absence delegation, and inactive-owner fallback. Mandatory project rules explain why they cannot be disabled. Completion, date change, cancelled event, disabled source module, and access revocation cancel obsolete jobs.

**NOT-04:** Deduplicate by rule, recipient, source/due-date revision, and scheduled window. Recheck recipient access at dispatch. Retry transient failures with bounds and expose failures to administrators. Reading a notification does not complete its source action.

**PROFILE-01:** Profile shall manage name/avatar, job title/contact details, language/timezone, theme/density, notifications, password/MFA when locally managed, sessions, and delegation. Identity/email changes require re-verification; users cannot change their own authority.

| Settings area | Required configuration | Authority |
|---|---|---|
| Organization and security | Identity, branding, domains, sessions/MFA, retention | Organization/security administrator |
| Project | Code, client, locations, lifecycle, timezone/calendar | PM or delegated project administrator |
| Project organization | Project levels, positions/titles, membership validity, directory/RACI, PIC lookup and alternates | Scoped personnel/access administrator |
| Access assignments | By-level/person/module matrices, exceptions/expiry, effective policy preview | Delegated access administrator |
| Document Control | Numbering, register semantics, review bodies/routes/codes, CRS, distribution and dossier templates | Document-control administrator with delegated authority |
| Modules | Catalog, install/upgrade, enable/disable, dependencies, health | Organization installer; authorized project activator |
| Users and access | Membership, teams/company scope, roles/grants, client publication policies | Scoped access administrator/publisher |
| Structure and progress | WBS/package types, numbering, units, tags/systems, weights, rules, periods/baselines | Project controls/data authority |
| Workflows | Transitions, reviewers, evidence, delegation, exceptions | Delegated module administrator |
| Reminders and reports | Templates, thresholds, channels, calendars, branding/distribution | Project/reporting administrator |
| Integrations and health | Connections, mappings, job status, audit, failures | Integration/operator grants |

**SET-01:** Display Organization default → Project override → Personal preference and the effective value. Personal preferences cannot weaken access or required project rules.

**SET-02:** Validate and version configuration changes; show impact and effective date for weights, workflows, scopes, gates, permissions, and module availability. Custom fields support typed text, number, date, boolean, choice, user, and record links with field permissions. Arbitrary executable scripts are excluded.

**SET-03:** Project templates may include module choices, dictionaries, roles, workflows, and report layouts. Cloning must not copy users, secrets, business records, or publication grants automatically.

**SET-04:** Organize Settings into Master (Projects, Module versions, Personnel-level/Role templates, Parties/Review bodies/Dictionaries), Current Project (Details, People/Positions, Modules, Access by level/person, PIC, Documents, Workflows/Calendars/Reporting), and Access audit/Policy history. Show setup completeness, invalid weights, unassigned responsibilities, failed integrations, and pending access decisions.

**SET-05:** Settings shall be organized as separate pages by setting type, each with its own address and breadcrumb, rather than one long page. The first pages are Projects, Users (administrator mode), Modules, General (personal display preferences such as appearance and default workspace), and Data sources (source workbooks, reporting cut-off, and integration status). The other areas in the table above and in SET-04 become further pages as the modules that need them ship. Access to each page follows the authority in the table.

**SET-06:** The Modules page shall list every catalog module and submodule, grouped by workspace and indented by level, each titled by its breadcrumb path (NAV-06) with its description, catalog availability and phase (MOD-02), and an enable/disable control. Disabling a module hides its submodules and rejects their data requests while keeping their individual states, so enabling the parent again restores the earlier selection (MOD-04, MOD-05). Core modules are shown as always on. A change that breaks a declared dependency or a required-by relationship is refused with the reason (MOD-03, MOD-05, MOD-10). A module that is not yet delivered may be enabled to prepare the project and then shows an explicit not-yet-available screen until it ships; a deployment may restrict that to administrators. Each change records actor, time, previous and new state, and reason.

**SET-07:** The Projects page implements PRJ-07: a list with select, and for authorized people create, edit, lifecycle change with reason, member assignment with project role and title, and guarded delete. Errors that refuse an action state the rule (last Project Manager, invalid transition, project has records).

**SET-08:** The Users page is visible and usable only in administrator mode. It lists accounts with name, email, administrator flag, account state (Invited, Active, Suspended, Deactivated per AUTH-02) and project roles; an administrator creates and edits accounts. Email is unique. Only Active accounts can act. The last active administrator cannot be demoted or deactivated. Passwords, invitations and identity-provider linkage belong to the authentication service and are not part of this page until it exists.

## 11. Architecture and module lifecycle

### 11.1 Implementation baseline

The selected architecture is a responsive TypeScript web application with a modular backend, transactional relational database, private file storage, and durable background processing. The implementation baseline is React with Vite, a shared token/component layer, TanStack Query/Table for server data/grids, and ECharts for charts; NestJS for backend modules; PostgreSQL for transactional records and reporting snapshots; Redis/BullMQ for queued jobs; and S3-compatible object storage. Use REST with documented typed contracts. Select supported dependency versions during implementation and record them in the lockfile and architecture decisions.

This selection combines the drafts' common TypeScript/PostgreSQL direction with a single deployment model. It does not require Next.js and Vite together, REST and GraphQL together, a dedicated search cluster, a time-series database, Kubernetes, or microservices. Start with database-backed authorized search and extract specialized infrastructure only when measured needs justify it.

**ARCH-01:** Layers shall separate shell/design system, identity/policy/configuration, module registry, domain modules, shared documents/actions/approvals/progress, integration/job services, and persistence. Modules own their schemas/services and shall not modify another module's tables directly.

**ARCH-02:** Transactions shall protect inventory, workflow transitions, approvals, and publication. An outbox or equivalent durable mechanism shall couple committed state changes to events. Event payloads carry ID, version, organization/project, source/revision, timestamp, and correlation ID. Consumers handle duplicates and out-of-order delivery and route failures to monitored queues.

**ARCH-03:** Reporting/search read models may be asynchronous but must expose freshness. Authorization and material readiness/release checks shall use current authoritative state, not a stale aggregate. A module UI fault shall preserve the shell and show a local unavailable state; a monolith does not guarantee isolation from process-wide failure.

### 11.2 Module contracts

**MOD-01:** A module manifest shall declare stable ID, version/core compatibility, phase, required/optional dependencies, navigation/routes, permissions, settings schema, entities, events, jobs, widgets, report/import/search contributions, migrations, health checks, publisher/integrity information, and export/retention behavior.

**MOD-02:** Keep module status axes independently stored: catalog availability (Planned, In development, Beta, Available, Suspended, Deprecated, Retired); deployment (Not installed, Installing, Installed, Updating, Failed); project operation (Not assigned, Setup, Pilot, Enabled, Locked, Read-only, Disabled); and user assignment (Inherited, Allowed, Denied, Expired). Installing approved code is an administrator operation and may require a deployment/maintenance window. Project activation and user assignment are separate operations; neither installs arbitrary code or automatically grants access.

**MOD-03:** Activation shall validate dependencies/versions, reject cycles, configure master data/workflows/access/reminders, preview effects, and record the decision. Core identity, policy, registry, project structures, audit, and shared reference services cannot be disabled.

**MOD-04:** Disable shall remove normal navigation, reject business writes/direct access, and stop source jobs for that project. Retain records and approved snapshots. Authorized retained reports remain available through reporting/archive permissions. Downstream scope stays in the reporting denominator with source-status disclosure.

**MOD-05:** Prevent disabling required dependencies until dependents are safely reconfigured/disabled. Required operational sources may not silently fall back to manual gates. Optional integrations must degrade explicitly. Re-enable restores retained configuration/data with validation.

**MOD-06:** Upgrades shall use staging, compatibility checks, backup, migration validation, health checks, and a recovery plan. Prefer backward-compatible migrations; use tested restore or forward repair when reversal is unsafe. Uninstall is separate from disable and physical purge. Arbitrary third-party executable uploads and guaranteed zero-downtime hot-swapping are outside this baseline.

**MOD-07:** Master catalog shall expose immutable key, name/group/icon, description, publisher, installed/available version, phase, dependencies/compatibility, client-capable flag, owner/support/license, exposed actions/fields, project usage, health, and changelog. Support register, publish availability, pilot restriction, suspend, deprecate/retire, upgrade, and controlled removal. Referenced manifests and historical data survive retirement. Uninstall requires dependent-project checks and archive/export/recovery planning.

**MOD-08:** Pilot restricts operation to designated projects/participants with normal authorization; it is not a security bypass. Locked is a temporary freeze with reason and unlock authority; Read-only permits authorized reads/exports but denies writes and new approvals. Disabled denies normal runtime access and stops affected module jobs. Deprecated prevents new activation while existing supported use follows policy. Suspension specifies affected runtime rights/jobs and a recovery path. Historical archive access uses reporting/archive permissions.

**MOD-09:** Navigation visibility/order/grouping is separate from operational state. Hiding a menu item never changes server rights; therefore Hidden is not a security state. Required dependencies remain enforced when menus are hidden. Preview every state change's users, jobs, open tasks, gate sources, and data effects. Module health shall show setup completeness, imported data status, assigned users, last activity, and failures.

**MOD-10:** Core Task/PIC services and private organizer remain available independently of project task screens. Disabling those screens does not cancel actions owned by enabled source modules. Disabling a source follows a reviewed disposition of its open tasks and gates. Document Control depends on core files/tasks/workflows/shared packages, not the Engineering UI; Engineering controlled reviews and downstream document gates require Document Control or an explicitly approved replacement source. Undeclared manual fallback cannot satisfy a mandatory gate.

### 11.3 Interfaces and data exchange

**API-01:** APIs shall enforce authenticated organization/project context, scoped grants, pagination, filter/sort allowlists, structured validation errors, revision/ETag conflict checks, rate limits, and upload quotas. Dedicated transition endpoints shall prevent generic edits from bypassing approvals.

**API-02:** Use idempotency keys for imports, approvals, publication, reservations, and callbacks. Service accounts have limited scopes and revocable credentials. Webhooks shall verify signatures and replay windows. Integration logs shall avoid credentials and restricted payload disclosure.

**API-03:** Each adapter shall declare its authoritative fields, external keys, direction, mapping, units/timezones, reconciliation, retries, conflict resolution, and operational owner. Baseline imports cannot overwrite approved baselines automatically. Named optional adapters include enterprise identity, P6/MS Project, ERP, document repositories, calendars, and BI; none is delivered merely by listing it.

**API-04:** Required operations shall include authorized project listing/context, setup updates, level/template versioning, policy preview/publication, PIC resolution, task assignment/conversion/source decisions, register membership, revision issue, transmittal issue, party responses, CRS decisions, and release-for-use calculation. The project-context header is a routing input, never proof of authority. Use the existing REST contract rather than adding mandatory federated GraphQL.

**API-05:** Publish versioned events for membership/policy changes, PIC/task assignment, source-task transitions, revision/transmittal issue, review response, document-use eligibility, and module project state. Store unique active memberships, source-task uniqueness, project-owned foreign references, and exact revision/transmittal relationships transactionally. Durable aliases preserve migrated Action IDs. Consumers recompute authorized views/gates and cancel stale jobs idempotently.

## 12. Nonfunctional acceptance targets

These are implementation acceptance targets, not claims of measured performance. Confirm the deployment profile in P0 and re-estimate scope/infrastructure if it changes.

| ID | Area | Requirement and verification |
|---|---|---|
| NFR-01 | Isolation | Negative tests across two organizations and multiple projects for API, search/facets/counts, files, exports, notifications, and jobs; no cross-scope disclosure |
| NFR-02 | Protection | Encrypted transport, database/storage/backups; managed secrets; input validation, output encoding, session/CSRF protections as applicable; no secrets in logs |
| NFR-03 | Performance | At agreed acceptance load, p95 standard register usable within 2 seconds and dashboard within 3 seconds; measure network separately and document test conditions |
| NFR-04 | Capacity | Test 20 active projects, 500 concurrent active users, 100,000 records in a large project register, and 1 million measurement/audit events across the fixture; use server pagination/virtualization |
| NFR-05 | Large jobs | Imports/exports beyond interactive limits run asynchronously with progress, cancellation where safe, row errors, and authorized result downloads |
| NFR-06 | Availability | Target 99.9% monthly service availability; define measurement boundary and maintenance treatment before production commitment |
| NFR-07 | Recovery | Target recovery point ≤1 hour and recovery time ≤4 hours; restore database, files, configuration, permissions, and job state in a measured drill before production |
| NFR-08 | Monitoring | Observe latency/errors, queue age, delivery/integration failures, stale read models, module health, and backup failures; assign alert owner and runbook |
| NFR-09 | Compatibility | Test the latest two stable desktop Chrome/Edge/Firefox/Safari versions at release plus supported mobile Safari/Chrome; publish tested versions |
| NFR-10 | Accessibility | Verify Section 3 keyboard, contrast, labels, zoom, touch, reduced-motion, and chart alternatives in critical journeys |
| NFR-11 | Retention | Configure retention by class/project, preserve holds, audit purge, and export records with relationship/file manifests and configuration versions |
| NFR-12 | Offline extension | If enabled after P2, cache only authorized expiring drafts with device protection; reauthenticate and reconcile revisions at sync; no unconditional approval or stock commitments |

Exact hosting region, customer-managed deployment, retention periods, and any jurisdiction/contract-specific controls shall be determined for the pilot. The application shall not claim certification or legal compliance solely from having audit logs, hashes, or approval screens.

## 13. Delivery roadmap and implementation sequence

### 13.1 Authoritative release allocation

| Release | Mandatory capability | Dependency and outcome |
|---|---|---|
| P0 Foundation | Shared schema, project context/membership and level policy, Task/PIC and document contracts, design system, module registry, workflows/audit/jobs, test/deployment skeleton | Prove tenant separation, tab-specific context, module activation, calculation approach, and representative journeys |
| P1 Project controls | Project Master/setup/selector; personnel levels/positions/directory; level/person access; My Workspace and project Tasks; full Document Control MDR/package/vendor registers/transmittals/client-CA-MWS reviews/CRS/basic correspondence; Dashboard; Engineering packages/deliverables; Procurement Plan/Expediting; Planning/Overall Progress/Milestones; all five basic Management registers; Interface register/points/matrix; Events; MoM; predefined reports; Profile/Settings/themes/reminders | First controlled weekly reporting, source-linked task, document-review, and client-publication cycles |
| P2 Yard execution | Logistics/Materials with preservation routines; Yard Layout/Workfront/Construction Progress/basic Productivity; Fabrication Subcontracting; QAQC/HSE and weld/NDE evidence; Systems/Check Sheets/Punches; richer Engineering/MTO/model-review/interface records; report builder/distribution; field contrast mode | Trace materials into accepted construction and capture completion evidence; extend canonical tasks to execution modules |
| P3 Handover and offshore | Facility Layout; Construction Sequence; Commissioning Sequence/Handover Schedule and packages; T&I; Offshore HUC/Marine Spread | Controlled system handover and integrated offshore execution |
| Extensions | BIM/4D, AI, portfolio benchmarking, cost/EVM/contracts, resource optimization, offline drafts, native apps, additional adapters | Separately scoped and accepted; no implicit dependency for P1–P3 |

Core system/tag masters are present in P0/P1 even though completion screens arrive in P2. P1 represents undelivered execution phases through controlled manual/imported progress. P2 hands over authoritative earning sources through reconciliation. P3 builds on the same completion records rather than migrating to a different register.

### 13.2 Planning envelope

Use a **68-week estimation envelope / 34 two-week sprints**. The expanded P1 adds four sprints (eight weeks) to the previous 60-week consolidation for task workspaces/PIC synchronization, controlled registers/external reviews, and project-specific access verification. This adopts the updated Codex estimate rather than assuming Claude's additional developers or Gemini's larger specialist squads are available. Re-estimate after P0 and each release; optional support modules below require separate estimates.

| Stage | Indicative weeks | Implementation order |
|---|---|---|
| P0 | 1–8 | Discovery/data sample → design patterns → identity/isolation → canonical structures → module/workflow/progress prototypes → recovery approach |
| P1 | 9–34 | Project setup/personnel/access → canonical Tasks/PIC/workspaces → MDR/registers/reviews/transmittals/CRS → Engineering/Planning → Procurement/Expediting → governance/interfaces/events → reports/publication → migration and pilot |
| P2 | 35–52 | PO/shipment/stock ledger/preservation → QAQC/HSE gates → workfront/construction/subcontractor earning → system/check-sheet/punch capture → analytics and integrated pilot |
| P3 | 53–68 | Handover gates/dossiers → shared marine bookings → T&I/HUC → sequence/facility views → integrated acceptance and recovery rehearsal |

Assumed delivery capacity: one product owner/business analyst, a half-time EPCIC domain lead, one designer, one technical lead contributing code, four software engineers, two QA engineers, and half-time platform/security support. Discipline approvers and pilot users must participate in workshops and demonstrations. Additional connectors, complex migrations, or specialized certification require explicit budget/schedule changes.

### 13.3 Backlog and release gates

Each feature shall map its requirement IDs to data contract, permissions, workflow, screen states, calculations/events, configuration, import/export behavior, tests, and operator guidance. Build vertical journeys before expanding every register independently.

| Gate | Required evidence |
|---|---|
| P0 exit | Pilot scope/data ownership agreed; measurement fixtures approved; representative screens reviewed; isolation, module activation, and restore approach demonstrated |
| P1 exit | Two weekly reporting cycles; two projects with different levels/titles/assignments; private-task isolation and source/PIC reassignment; one document in multiple registers; independent client/CA/MWS review and correct use restriction; client report reconciliation; access/migration/restore tests pass |
| P2 exit | Trace PO → shipment → receipt → reservation → issue → installation → inspection acceptance; no duplicate subcontractor earning; gates block unresolved constraints; completion capture reconciles |
| P3 exit | Trace accepted construction → sheets/punches → handover → T&I/HUC → final acceptance; marine conflicts and reopened blockers handled; upgrades and recovery rehearsed |

### 13.4 Migration, rollout, and support

1. Inventory source spreadsheets/registers and name the owner and authoritative system for each field.
2. Clean WBS, party, package, unit, document, tag, and system identifiers; map external keys.
3. Stage imports and resolve duplicates/orphans, units/dates, missing approvals, and historical provenance.
4. Rehearse migration; reconcile counts, quantities, progress, files, permissions, and report snapshots with discipline owners.
5. Pilot with role-specific training and two reporting cycles; record defects and operating adjustments.
6. Cut over with backup, change freeze/delta import, reconciled totals, support contacts, and a defined go/no-go decision.
7. Provide hypercare, monitor adoption and failed jobs, and transfer to named operational support with runbooks.

Historical percentages without sufficient original evidence shall be labeled imported historical data, not represented as newly verified operational achievements. Training shall cover team submissions, leader verification, manager approvals, PM reporting/publication, and client access.

Revision 1.1 migration shall map Action IDs to canonical Tasks with durable aliases, reconcile PICs/due dates/reminders, map files to document/revision IDs and checksums, and turn package lists into register memberships. Import personnel levels, scoped grants, open transmittals/review cycles, and CRS. Do not infer CA/MWS acceptance from legacy “Approved”; flag ambiguous records for controller resolution. Reconcile task counts, private/project separation, unique document counts, and independent review outcomes before cutover.

### 13.5 Additional module coverage and scope disposition

The updated drafts propose the following capabilities. This catalog preserves their coverage while distinguishing included foundations from optional implementation. Optional timing is earliest sensible sequencing, not a funded delivery promise.

| Capability | Included baseline | Optional extension and earliest sequence |
|---|---|---|
| Project Directory/Organization/RACI | P1 positions, hierarchy, PIC directory, tabular responsibility and validity | P2 visual organization/RACI editor, chart PDF |
| Correspondence | P1 Document Control references, threads, response tasks and evidence | P2 dedicated notices/letter register, distribution automation, email ingestion |
| Technical Queries, Deviations, Concessions | Document/issue/MOC links and PIC response tasks | P2 dedicated TQ/DQ workflows, vendor deviations, dispositions; technical answers cannot silently approve scope changes |
| Preservation/Maintenance | P2 Materials recurring preservation requirements/tasks, interval, evidence, condition, overdue constraints from receipt through installation handover | P2 expanded equipment routines after installation through RFSU, warranty/service history and maintenance-system adapter; reuse tags and tasks |
| Regulatory/Class/Statutory Compliance | P1 document review evidence; P2 gate references to permits/clearances | P2 obligations register with authority, condition, validity, owner, renewal task, and evidence for class/flag/environment/customs requirements |
| Resource/Manpower | P1 task effort/workload; P2 productivity hours; P3 marine capacity summaries | P2 capacity/mobilization by craft/party, competence expiry, allocation conflicts and histograms; private personal tasks excluded |
| Construction Equipment/Lifting | P2 workfront resource/certificate references; P3 shared marine assets/bookings | P2 cranes/SPMT/lifting gear register, certificate expiry, maintenance and workfront allocations; reuse shared asset identities |
| Contracts/Variations/Claims | P1 MOC and contractual milestone references with restricted fields | P2+ contract/obligation/notice registers, VORs, claims, payment certificates and invoice status; approved changes remain separate from commercial agreement |
| Cost/Forecast/EVM | Governed physical progress and optional restricted commercial references | P2+ CBS/WBS budget, commitments, actuals/accruals, VOWD, ETC/EAC, contingency, cash flow and correctly based CPI/SPI; validate source units and commercial access |
| Assurance/Readiness | P2 shared gate checks, evidence, findings/waivers/expiry; P3 handover | P3 dedicated stage-review workspace using the same gates |
| e-PTW/LOTO/SIMOPS | HSE permit/isolation references and constraints; workfront/T&I readiness | P3 separately qualified permits/isolation workflow and spatial conflict overlays; no automatic hazardous-work authorization or implied certification |
| Weather/Metocean | P3 timestamped weather-window assumptions, operating restrictions, reason-coded downtime | P3 feed integration, operational-limit matching and designated go/no-go decisions; forecasts cannot grant authority |
| Closeout/Dossiers | P3 revision-specific evidence dossiers, as-built readiness, handover acceptance/archive manifest | P3 comprehensive warranties/spares/training, final obligations, demobilization, lessons and contractual closure checklist |
| Vendor/Subcontractor Portals | Scoped memberships and controlled submissions in existing screens | P2 document upload/guest returns; P3 tailored portal journeys for vendor milestones/progress/concerns; same policies and canonical records |
| Portfolio/Benchmarking | P1 authorized My Projects and cross-project My Workspace | P3 permissioned executive rollups with compatible baselines/units and no cross-project information leakage |
| BIM/4D/GIS and AI | 2D layout, controlled links, review milestones and sequence records | P3+ supported-model viewer/simulation, model streaming or assistant insights after format/license/performance scope; AI cannot approve records |
| Additional outputs/connectors | PDF/XLSX/CSV, calendar files, repository links, REST contracts | P2+ PPTX report templates, scheduling/EDMS/ERP/CMMS adapters, push/Teams/Slack, OCR and native annotations; each independently accepted |

Material preservation evidence, regulatory reviews, and equipment certifications affect readiness only through configured authoritative gates. None of these extensions introduces a competing task, document, asset, approval, or responsibility master.

## 14. Verification and acceptance

### 14.1 Required end-to-end scenarios

| Test | Requirements | Pass condition |
|---|---|---|
| UAT-01 | AUTH-01–05 | Invite, verify, approve membership, login/MFA, suspend, and revoke sessions; denied access takes effect next protected request |
| UAT-02 | ACL-01–05, PUB-01–04 | Cross-tenant and direct-URL/API attempts fail; role combination does not expand scope; exports/search/counts/files/emails cannot disclose restricted information |
| UAT-03 | DATA-02, ENG-01, PLAN-01 | Engineering and Planning share IDs and scope; renaming a code preserves references |
| UAT-04 | PROG-01–10 | Accepted rollups match calculation fixtures and published reports; missing inputs are visible; approval/rule versions are retained |
| UAT-05 | PROG-07–09, MGT-04 | Rebaseline/restatement preserves original snapshot and records reconciliation/effective period |
| UAT-06 | PUB-02, REP-01–04 | Client sees only the released revision/audience; internal edits do not leak; issued minutes and reports remain immutable |
| UAT-07 | PROC-03, EXP-02, LOG-02 | Late/split deliveries retain outstanding balance and identify affected scope |
| UAT-08 | MAT-01–03 | Concurrent reservation cannot overdraw; damage/quarantine and return condition affect availability correctly |
| UAT-09 | CON-02–05, QA-01–03, HSE-01–02 | Failed hold, missing drawing/material, or stop-work blocks release; source invalidation triggers reassessment |
| UAT-10 | SUB-01–02, PROG-05 | Subcontractor and construction records produce one accepted earning allocation |
| UAT-11 | COM-01–05 | Mandatory sheets/open blocking punches prevent handover; reopening flags affected acceptance; prior issue remains available |
| UAT-12 | TI-01–03, HUC-01–03 | Shared marine bookings detect overlap; onshore delay affects offshore readiness; punch counts remain unique |
| UAT-13 | MOD-01–06 | Dependency validation, disable/re-enable, retained snapshots, failed upgrade, and recovery behave as specified |
| UAT-14 | NOT-01–04, EVT-01 | Due-date/recurrence changes cancel obsolete jobs; retries deduplicate; revoked users receive no restricted content |
| UAT-15 | CORE-06–07, API-01–03 | Invalid/duplicate imports produce row errors; retry is idempotent; conflicts cannot overwrite approved work |
| UAT-16 | UX-01–08, NFR-03–10 | Core journeys pass responsive/accessibility and agreed load tests; recovery meets measured targets |
| UAT-17 | PRJ-01–06, PEOPLE-01–03 | The same person has different titles/levels in two projects; concurrent tabs, deep links, pending writes, PIC options, and cached permissions retain the correct project |
| UAT-18 | ACCESS-01–05, MOD-02, MOD-07–10 | Level defaults, temporary personal allow, deny, expiry, Pilot/Locked/Read-only/Disabled states produce the explained access; activation does not auto-grant rights |
| UAT-19 | TASK-01–06, TASK-12 | Private tasks/notes/effort are absent from project and PM views; conversion previews exactly what becomes shared; assignment cannot grant source access |
| UAT-20 | TASK-07–11, API-05 | Replayed events create one task; PIC transfer updates authorized views; source closure gates remain enforced; revoked users lose restricted titles; workspace disable does not cancel other modules' tasks |
| UAT-21 | DOC-01–06 | Engineering and vendor EMDR labels resolve to explicit types; one document across registers counts once; numbering/aliases and immutable transmitted revisions persist |
| UAT-22 | DOC-07–13 | Partial transmittal returns preserve separate client/CA/MWS results; late response is not default approval; required MWS CoA/CRS blockers prevent use; new revisions do not inherit old acceptance |
| UAT-23 | DOC-14–17, COM-05 | Review/CRS tasks reconcile; supersession flags dependent release; dossier manifests reference exact evidence and preserve issued acceptance |
| UAT-24 | MAT-04, QA-04, HUC-04 | Preservation tasks/failed routines and qualification evidence affect configured gates; shift/downtime summaries use the correct scope and units |
| UAT-25 | NAV-04–06, SET-05–06 | Workspace switch lists only that workspace's enabled modules and lands on the first delivered screen; EPCIC groups keep T&I apart from HUC; disabling a module hides its submodules, rejects their data requests, and restores their prior states on re-enable; core and dependency violations are refused with a reason; every change is logged; breadcrumbs match between screen header and Modules page |

### 14.2 Calculation fixtures

- Children weighted 20% at 50% complete and 80% at 25% complete yield **30%** parent progress.
- Accepted 40 of budget 100, plus pending 10, yields **40% accepted**, not 50%.
- Installed/accepted 110 against budget 100 shows **10 overrun** and no more than **100% earned** before approved scope adjustment.
- A zero denominator yields **Not calculable** and does not disappear from required reporting completeness.
- Cumulative stage thresholds 10/40/70/100 yield **70% at the third accepted threshold**, not 120%.
- Opening punches 20 + raised 5 + reopened 2 − verified closed 8 yields **19 open** before separately disclosed scope adjustments.
- Forecast delivery two project working days after required-on-site yields **+2 days late**.
- A completed package removed in a future baseline remains in the original historical snapshot and denominator.

### 14.3 Definition of Done

A feature is complete when its requirement-linked acceptance criteria, server authorization, state transitions, audit, calculations, configuration, empty/error/conflict states, and relevant accessibility checks pass. A module additionally requires dependency/lifecycle tests, migration and recovery guidance, monitoring, and role-specific user guidance. Release evidence shall include unresolved defects and explicit owner acceptance for any nonblocking exception.

Cross-organization disclosure, privilege escalation, data loss, incorrect approved progress, bypassed mandatory readiness gates, and failed restore readiness are release blockers. A release cannot pass by hiding an incomplete required module behind navigation.

## 15. Success measures and deployment decisions

### 15.1 Product success targets

Measure a baseline during the pilot and review results after three and six months. These are adoption targets, separate from technical release acceptance.

| Measure | Initial target and measurement |
|---|---|
| Reporting effort | Reduce staff hours per comparable weekly report by at least 30% against the pilot baseline |
| Submission timeliness | At least 95% of required weekly reporting units submit by cutoff |
| Weekly use | At least 80% of active assigned project users use the app weekly |
| Action closure | At least 90% of eligible actions verified closed by due date; disclose changed deadlines |
| Interface closure | At least 90% closed by agreed date with required receiving acceptance |
| User satisfaction | At least 4.2/5 in a role-balanced pilot survey, with response count disclosed |

### 15.2 Decisions required before production

The architecture and product baseline above are settled for implementation. The following project facts must be configured and accepted; they are not permission to expand scope silently.

| Decision | Owner | Required by |
|---|---|---|
| Pilot scale, hosting region, deployment responsibility, support hours | Sponsor and platform owner | P0 exit |
| Identity provider and whether SSO is required at first release | Organization security owner | P0 exit |
| WBS/package/tag/system naming and source-system ownership | Project controls and data leads | Before migration rehearsal |
| Phase weights, rules of credit, calendars, cutoff cadence, approval chain | Project controls lead and PM | Before first formal reporting cycle |
| Client audiences, fields, publication/acceptance authority | PM and client-interface owner | Before client pilot |
| QAQC/HSE holds, punch categories, stage gates, exception authority | Quality, HSE, construction, and commissioning leads | Before P2 operational pilot |
| Handover evidence, signatories, offshore resource rules | Commissioning and offshore leads | Before P3 pilot |
| Retention, data residency, sensitive fields, contractual controls | Organization data/security owners | Before production |
| Named adapters, direction/mappings, licensing, ongoing ownership | Product and integration owners | Before adapter commitment |
| Project levels/titles/positions, PIC fallback, personal exceptions and expiry | PM and access administrator | Before P1 membership migration |
| EMDR label semantics, CA identity, review matrices/codes/calendars, CoA requirements, deemed-acceptance policy if applicable | Document-control lead and designated project authorities | Before first controlled issue |
| Private-task retention/conversion policy and source-task ownership mappings | Product owner and organization data owner | Before P1 task rollout |
| Whether project activators may enable modules that are not yet delivered, or only administrators (SET-06) | Product owner and platform owner | Before P1 pilot |

### 11.4 Non-normative note: worksheet organization in the Google Sheets pre-build

The pre-build stores data in one Google spreadsheet. Its worksheets are named `<area> - <dataset>` and ordered by area, so each workspace's data stays together: Settings (Projects, Users, Memberships, Modules, Module changes), Personal (Tasks), EPCIC (S-curve, Work packages, Milestones, Procurement packages, Expediting packages, plus a sheet per established module), Governance (Risks, Interfaces, Interface points). Each area has its own tab colour. Sheets that hold project records start with a `projectId` column so one file can serve several projects. A separate file per workspace was considered and rejected for the pre-build: one deployment, one token and one link per module are simpler, and the prefix gives the same separation. This note adds no requirement to the full application.

## Appendix A. Source selection and conflict resolution

| Source | Selected contribution | How it is reconciled here |
|---|---|---|
| [Codex specification v1.1](Project-Flow-Specification__codex.md), §§4–9, 11–16 | StageLink branding, source-owned Tasks/PIC, controlled MDR/EMDR/reviews, project personnel/access, independent module-state axes, migration/acceptance and 68-week estimate | Integrity and expanded P1 backbone; shared tasks replace Action duplication; project settings and test coverage are integrated throughout |
| [Claude specification Rev. B](Project_Flow_Specification_Claude.md), §§4.6–4.7, 8.4, 10.16–10.18, 14.7A | Level/person assignment UX, project wizard/tab context, personal/project workspaces, vendor register detail, review matrices, correspondence/resource/closeout coverage | Clear screen patterns and coverage retained; EMDR meaning is configurable; source-data leaks after revocation and auto-grant defaults are rejected; optional extensions receive explicit disposition |
| [Gemini specification v3.0](project_flow_epcic_system_requirements_specification_Gemini.md), §§1–10 | Project context, PIC synchronization, VDR/SDRL/CRS, CA/MWS evidence, preservation, regulatory/permit/resource/offshore operations and strategic module catalog | Traceability, field details, review gates and support-module coverage retained; overdue-is-approved defaults, automatic task signoff, mandatory hot-swap/GraphQL/3D and unsupported fixed delivery guarantees are excluded |
| [Perplexity specification](project_flow_specification__perplexity.md), §§2, 7–18, 20–24 | Consistent register behavior, broad module coverage, relationship model, adoption measures | Coverage and usability retained; conflicting phase allocations and open-ended integration promises replaced by one release matrix |

Specific resolutions: Construction and QAQC/HSE ship in P2, with controlled summary reporting in P1. Systems/check sheets/punches ship in P2; handover/sequence orchestration in P3. T&I and HUC both ship in P3. Basic MOC and interfaces ship in P1 because baseline control and cross-party commitments are prerequisites to reliable reporting. Productivity begins in P2 using the same quantity/hour records; advanced visualization is later scope. Client access is deny-by-default, not automatically inherited from a screen, party label, or role. The revised 68-week estimate replaces the earlier final spec's 60-week envelope and the updated drafts' incompatible staffing/date assumptions.

### Revision 1.1 coverage map

| Updated source area | Final destination | Resolution |
|---|---|---|
| Codex §4 selected branding; Claude §6; Gemini §3 | §3.2 | StageLink indigo/teal, Manrope/Inter, Project Flow name; light/dark/field modes retained |
| Codex §§11.3–11.4; Claude §§4.6, 8.4.5; Gemini §2 | §§2.5–2.6, 10 | Project Master, wizard, tab isolation, memberships, titles/levels/positions, directory/PIC |
| Codex §11.5; Claude §§4.7, 8.4.6–8.4.7; Gemini §4.3 | §§2.6, 11.2 | Three assignment views, bounded overrides, explanation/expiry; lifecycle axes separated; hiding is not access control |
| Codex §8.19; Claude §10.16; Gemini §5 | §§4, 6.7, 11.3, 14 | Private/project workspaces, canonical tasks, source-authoritative PIC sync, recurrence/workload, migration and negative tests |
| Codex §8.20; Claude §10.17; Gemini §6 | §§6.2, 6.6, 6.8 | P1 full document control and structured CRS; distinct engineering/vendor semantic types; separate party codes and use gates |
| Codex §8.21; Claude §10.18; Gemini §7.11 | §13.5 plus §§7–9 | Every named support capability is represented as included foundation or explicit optional extension |
| Codex §§7.5, 12.4, 14–16; Claude §14.7A; Gemini §§9–10 | §§11–14 | Dependency contracts, events/migration, revised estimate, expanded release gates/UAT |
| Perplexity §§7–24 | §§3–15 | Existing functional breadth, register UX, relationships, adoption and acceptance retained; no new revision metadata observed |

The selection preserves capability intent without treating every proposed implementation as mandatory. In particular, guest upload/OCR/EDMS integration, dedicated commercial/resource modules, e-PTW/LOTO qualification, and 3D/AI remain explicit extensions; source-linked tasks, full document review, personnel/access configuration, preservation basics, and review evidence are included requirements with phases and tests.

### Revision 1.4 coverage map

| Direction | Final destination | Resolution |
|---|---|---|
| Settings for project create/read/update/delete and selection | PRJ-07, SET-07 | Projects page with select, create, edit, lifecycle, members and guarded delete |
| User management in Settings, administrator mode | SET-08, DEC-15 | Users page visible to administrators only |
| Separate worksheets per workspace and general settings | §11.4 | Non-normative pre-build note; the full application is unaffected |
| Build Risk Management and Interface Management | MGT-06, INT-04 | First screens over MGT-01 and INT-01 to INT-03 |
| Milestones as reference data | PLAN-03 | Read-only register loaded from the Key Milestones workbook |
| Header: short project name, cut-off dropdown, snapshot button, full-width content, no sidebar project card | NAV-07 | Saved cut-off reports opened read-only from the dropdown; the Friday default is a shortcut, not a rule |
| Task Management: list/card/kanban/gantt, task fields, calendar, workload | TASK-13 to TASK-15 | Personal tasks with derived Overdue; Planned added as a stored status so the four kanban columns map to the status field |

### Revision 1.3 coverage map

| Direction | Final destination | Resolution |
|---|---|---|
| Split the sidebar into Personal and EPCIC workspaces, with task management under Personal | §3.1, NAV-04, DEC-14 | Four workspaces; Personal holds My Workspace and Task Management |
| Add Governance (risk, interface, MOC, document control) and Reports workspaces | §3.1, NAV-04 | Management registers (MGT-01 to MGT-05) stay submodules of Management, so Risks and Management of Change appear there; Interface Management, Document Control, and Event Management sit beside it. No new modules are created |
| Keep HUC apart from T&I; group HUC with Onshore Precom/Com | NAV-05 | Display groups Yard Execution, Installation, Commissioning; T&I alone under Installation |
| Separate Settings pages by type | SET-05 | Modules, General, Data sources first |
| Modules page with all modules and submodules, tick to enable/disable, titles as breadcrumbs | SET-06, NAV-06 | Every entry of the §3.1 navigation is in the catalog; Periodic Reports groups the predefined reports of REP-03 |

## Appendix B. Glossary

| Term | Meaning |
|---|---|
| EPCIC | Engineering, Procurement, Construction, Installation, and Commissioning |
| WBS | Work Breakdown Structure |
| Work package | Controlled scope with owner, dates, dependencies, measurement, and acceptance |
| Workfront | Scope assessed and released for execution against readiness gates |
| Rule of credit | Approved method for earning progress against defined evidence/stages |
| Baseline | Approved version of scope, dates, budget quantities, weights, and measurement basis |
| Snapshot | Immutable issued reporting state with source revisions and calculation basis |
| QAQC | Quality Assurance / Quality Control |
| HSE | Health, Safety, and Environment |
| NCR | Nonconformance Report |
| MOC | Management of Change |
| PO | Purchase Order |
| FAT | Factory Acceptance Test |
| IFC | Issued for Construction in document status; Industry Foundation Classes only in BIM context |
| Check sheet / ITR | Inspection or test record using a controlled template and acceptance workflow |
| Punch | Recorded incomplete/defective item requiring rectification and verification |
| T&I | Transportation and Installation |
| HUC | Hook-Up and Commissioning |
| Module | Registered business capability with declared dependencies and project activation |
| Module catalog | Full list of modules and submodules with phase, availability, dependencies, and per-project state |
| Workspace (navigation) | One of Personal, EPCIC, Governance, or Reports; a sidebar grouping of modules. Not the same as the task views My Workspace and project task workspace |
| Display group | Sidebar heading that groups EPCIC modules (Yard Execution, Installation, Commissioning); presentation only |
| Plugin package | Approved versioned code/configuration delivering one or more modules or adapters |
| Released to client | Explicit revision/audience publication, separate from internal approval |
| PIC | Person in Charge; a project-scoped responsibility resolved to an eligible person/position/queue |
| MDR | Project-wide Master Document Register with canonical document identities |
| EMDR | Project-defined Engineering or Equipment/Vendor Master Document Register label; semantic type stored separately |
| VDR / SDRL | Vendor Document Register / Supplier Document Requirements List, mapped to vendor-document scope |
| CRS | Comment Resolution Sheet with attributable response and reviewer acceptance |
| CA | Contract-defined review/certification authority; identity and scope configured per project |
| MWS / CoA | Marine Warranty Surveyor / Certificate of Approval for a specified operation and evidence scope |
| MRR / OSD | Material Receiving Report / Over, Short and Damaged discrepancy record |
| RACI | Responsible, Accountable, Consulted, Informed; responsibility labels distinct from authorization |
| MTO / NDE | Material Take-Off / Nondestructive Examination |
| POB / RFSU | Persons on Board / Ready for Startup, under configured project definitions |
| e-PTW / LOTO / SIMOPS | Electronic Permit to Work / Lockout-Tagout / Simultaneous Operations; separately scoped operational systems |

## Appendix C. Reference data and prototypes

| Item | Location | Purpose |
|---|---|---|
| STTP2B project data | `data/` and [ProjectFlow_reference_data.md](ProjectFlow_reference_data.md) | Real workbooks used to seed the first modules, with mapping and cleaning rules |
| Static prototypes | `v2_codex/`, `v3_gemini/`, `MVP/Claude/` | Interaction and visual reference only; they add no requirements |
| Application | `app/` ([README](../app/README.md), [ADRs](../app/docs/adr/)) | Implementation on the §11.1 baseline |
| Pre-build backend | `app/apps/sheets/` ([README](../app/apps/sheets/README.md)) | Google Sheets + Apps Script stand-in for the API until the full server exists; not a deployment target for this specification |
| Implementation plan | [ProjectFlow_implementation_plan.md](ProjectFlow_implementation_plan.md) | What exists, pre-build limits, NestJS parity backlog and roadmap against §13 |
