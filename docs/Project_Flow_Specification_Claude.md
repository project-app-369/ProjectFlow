# PROJECT FLOW
## EPCIC Project Management Platform
### Product Specification · Roadmap · Detailed Implementation Plan

| Item | Value |
|---|---|
| Document No. | PF-SPEC-001 |
| Revision | Rev. B (Issued for Review) |
| Date | 08-Nov-2026 |
| Product | Project Flow — Modular EPCIC Project Management Platform |
| Audience | Product Owner, Project Management Team, Developers, UX/UI Designers, QA, IT/Security |
| Status | Draft for review |

### Revision History
| Rev | Date | Description |
|---|---|---|
| A | 08-Nov-2026 | First issue for review |
| B | 08-Nov-2026 | Added: Project Settings & Project Selection with project-specific titles and levels (§8.4.5); Module Management – Master Registry (§8.4.6); module assignment per level and per person (§4.6–4.7, §8.4.7); Tasks Management module (§10.16); Document Control module – MDR, EMDR, CA/MWS review (§10.17); additional project modules (§10.18); roadmap, catalogue, access table and plan updated |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Product Vision & Principles](#2-product-vision--principles)
3. [Scope, Assumptions & Glossary](#3-scope-assumptions--glossary)
4. [Users, Roles & Access Control](#4-users-roles--access-control)
5. [System Architecture & Plugin Framework](#5-system-architecture--plugin-framework)
6. [Branding & Visual Identity](#6-branding--visual-identity)
7. [UX/UI Specification](#7-uxui-specification)
8. [Core Platform Modules](#8-core-platform-modules)
   - 8.1 Authentication (Login / Logout / Register)
   - 8.2 User Management
   - 8.3 Profile
   - 8.4 Settings
   - 8.5 Themes
   - 8.6 Reminders & Notifications
   - 8.7 Shared Services (Audit, Files, Comments, Workflow, Search, Import/Export)
9. [Common Data Model & Progress Measurement](#9-common-data-model--progress-measurement)
10. [Functional Module Specifications](#10-functional-module-specifications)
    - 10.1 Dashboard
    - 10.2 EPCIC – Engineering
    - 10.3 EPCIC – Procurement
    - 10.4 EPCIC – Planning & Progress
    - 10.5 EPCIC – Construction
    - 10.6 EPCIC – Fabrication Subcontracting
    - 10.7 EPCIC – Onshore Pre-commissioning & Commissioning
    - 10.8 EPCIC – QAQC
    - 10.9 EPCIC – HSE
    - 10.10 EPCIC – Transportation & Installation (T&I)
    - 10.11 EPCIC – Offshore Hook-up & Commissioning (HUC)
    - 10.12 Management Registers
    - 10.13 Interface Management
    - 10.14 Event Management
    - 10.15 Reports
    - 10.16 Tasks Management *(Rev. B)*
    - 10.17 Document Control *(Rev. B)*
    - 10.18 Additional Project Modules *(Rev. B)*
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Integrations & API](#12-integrations--api)
13. [Product Roadmap](#13-product-roadmap)
14. [Detailed Implementation Plan](#14-detailed-implementation-plan)
15. [Testing & Quality Strategy](#15-testing--quality-strategy)
16. [Deployment, Go-Live & Support](#16-deployment-go-live--support)
17. [Delivery Risks](#17-delivery-risks)
18. [Appendices](#18-appendices)

---

## 1. Introduction

### 1.1 Purpose
This document defines the full set of requirements for **Project Flow**: a web-based, modular project management platform built for **EPCIC** (Engineering, Procurement, Construction, Installation, Commissioning) projects in the offshore oil & gas industry (fixed platforms / jackets / topsides, wellhead platforms, CPP, FPSO modules, subsea structures).

It covers:
- Functional requirements for every module and sub-module.
- UX/UI, branding, themes and accessibility.
- Platform services: authentication, user management, role-based access, settings, reminders.
- The plugin/module architecture that lets each module be installed, enabled and configured from Settings.
- The phased product roadmap and a sprint-level implementation plan.

### 1.2 Problem Statement
On EPCIC projects, status information is scattered across Primavera P6, Excel trackers, EDMS, email and meeting slides. As a result:
- Progress reporting is late, manual and inconsistent between disciplines.
- Interfaces, risks, issues and MOCs are tracked in separate spreadsheets with no cross-links.
- Clients (COMPANY) receive static PDF reports and have no controlled live view.
- Management has no single, trusted "one page" view of the project.

### 1.3 Solution Summary
Project Flow is **one platform with a single data model** (WBS, disciplines, work packages, systems, tags, documents) on which **pluggable modules** are installed. Each module:
- registers its own menu items, screens, dashboard widgets, permissions, settings and reports;
- can be enabled or disabled per project;
- is delivered in a defined roadmap phase.

### 1.4 Requirement Notation
| Keyword | Meaning |
|---|---|
| **SHALL** | Mandatory requirement |
| **SHOULD** | Recommended; may be deferred with Product Owner approval |
| **MAY** | Optional / nice-to-have |
| **[P1] [P2] [P3] [P4]** | Delivery phase (see §13) |
| **REQ-xxx-nnn** | Unique requirement ID, used for traceability to test cases |

---

## 2. Product Vision & Principles

### 2.1 Vision
> *"One flow of truth — from first engineering deliverable to final offshore handover."*

Project Flow gives the PM, managers, discipline leaders, team members and the client the **right information, at the right level, at the right time**, in an elegant and professional interface that people actually want to use.

### 2.2 Product Principles
| # | Principle | Meaning in practice |
|---|---|---|
| P-01 | **Single source of truth** | A tag, work package or system exists once and is referenced by every module. |
| P-02 | **Modular by design** | Every functional area is a plugin with a manifest, so it can be installed, versioned and toggled. |
| P-03 | **Configuration over code** | Work packages, disciplines, weightings, workflows, roles, cut-off dates and client visibility are set in Settings, not hard-coded. |
| P-04 | **Data in, insight out** | Every register feeds dashboards, KPIs and reports automatically. |
| P-05 | **Role-appropriate views** | Each role sees what it needs; the client sees only what has been explicitly released. |
| P-06 | **Traceable** | Every change is audited (who, what, when, old/new value). |
| P-07 | **Elegant & calm UI** | Professional, low-noise design; color is reserved for status and meaning. |
| P-08 | **Excel-friendly** | Import/export to Excel in every register; projects run on Excel today. |
| P-09 | **Bilingual** | English and Vietnamese UI from day one. |

### 2.3 Success Metrics (12 months after go-live)
| Metric | Target |
|---|---|
| Weekly progress report preparation time | −60 % vs. baseline |
| Registers (risk/issue/interface/MOC) maintained in Project Flow instead of Excel | ≥ 90 % |
| Active weekly users / licensed users | ≥ 75 % |
| Client portal adoption (COMPANY reps logging in at least weekly) | ≥ 80 % |
| Overdue interface queries (> 14 days) | −50 % |
| System availability | ≥ 99.5 % |
| User satisfaction (SUS score) | ≥ 75 |

---

## 3. Scope, Assumptions & Glossary

### 3.1 In Scope
- Web application (desktop-first, fully responsive to tablet and mobile).
- Multi-project: one installation hosts several projects; users can belong to several projects with different roles.
- All modules listed in §10, delivered in phases.
- Platform services listed in §8.
- Integrations: Excel, Primavera P6 (XER/XML), MS Project (XML), email (SMTP), Microsoft 365 / Teams (notifications), EDMS links, REST API.

### 3.2 Out of Scope (initial release)
- Native mobile apps (a PWA is provided instead; native apps MAY follow in P4).
- Cost control / earned-value accounting at ledger level (only the progress and EV indicators needed for reporting).
- Full EDMS replacement (Project Flow links to the EDMS and keeps a document register, but is not the controlled document repository of record).
- 3D model viewer (P4 option).

### 3.3 Assumptions
- One Project Flow tenant per company; projects are separated logically.
- Planning baseline lives in Primavera P6 and is imported; Project Flow does not replace P6 for CPM scheduling.
- Progress is measured with **Rules of Credit (ROC)** and **weight factors** set per project.
- The client (COMPANY) accesses through the same application, using the **Client** role with restricted permissions.

### 3.4 Glossary
| Term | Definition |
|---|---|
| EPCIC | Engineering, Procurement, Construction, Installation & Commissioning |
| COMPANY | The client / owner (e.g. operator) |
| CONTRACTOR | The main EPCIC contractor operating Project Flow |
| WBS | Work Breakdown Structure |
| WP | Work Package |
| ROC | Rules of Credit — step-based progress measurement rules |
| MR / PO | Material Requisition / Purchase Order |
| ITB / TBE / CBE | Invitation to Bid / Technical Bid Evaluation / Commercial Bid Evaluation |
| VDRL / VDB | Vendor Document Requirement List / Vendor Data Book |
| FAT | Factory Acceptance Test |
| MTO | Material Take-Off |
| ITP | Inspection & Test Plan |
| NCR | Non-Conformance Report |
| MC | Mechanical Completion |
| RFC | Ready for Commissioning |
| A/B/C check-sheet | Construction (A), Pre-commissioning (B), Commissioning (C) check sheets |
| Punch A/B/C | Punch categories (A = must clear before MC/handover; B = may be cleared later; C = optional/cosmetic) |
| T&I | Transportation & Installation (load-out, sea-fastening, tow, lift/float-over, installation) |
| HUC | Hook-up & Commissioning (offshore) |
| SIMOPS | Simultaneous Operations |
| MOC | Management of Change |
| IR / IQ | Interface Register / Interface Query |
| MoM | Minutes of Meeting |
| RAG | Red / Amber / Green status |
| SPI / CPI | Schedule / Cost Performance Index |
| PF | Productivity Factor (earned hours ÷ actual hours) |
| LTI / TRCF / LTIF | Lost Time Injury / Total Recordable Case Frequency / Lost Time Injury Frequency |

---

## 4. Users, Roles & Access Control

### 4.1 Role Definitions
Project Flow has **five standard roles**, plus a hidden **System Administrator**. Roles are assigned **per project**; one user can be PM on project A and Team Member on project B.

| Role | Typical holder | Description | Default scope |
|---|---|---|---|
| **System Administrator** | IT / application owner | Installs plugins, manages tenant-level settings, SSO, backups, licences. Not a project role. | Tenant |
| **PM (Project Manager / Project Director)** | Project Manager, Project Director | Full control of the project: configuration, modules, users, approvals, client visibility. | Full project |
| **Manager** | Engineering / Procurement / Construction / Commissioning / QAQC / HSE / Interface / Project Control Manager | Manages one or more functional areas; approves within those areas; sees all project data. | Assigned functional areas: full; others: read |
| **Leader** | Discipline lead, package engineer lead, area supervisor, subcontract coordinator | Creates and updates records in assigned disciplines/packages; submits for approval; assigns actions. | Assigned discipline/package: create/edit; others: read (configurable) |
| **Team Member** | Engineers, planners, inspectors, document controllers, supervisors | Updates assigned items, records progress, responds to actions. | Assigned items: edit; project: read (configurable) |
| **Client** | COMPANY representatives | Restricted, read-mostly access to released screens; may comment, respond to interface queries, approve where configured. | Only screens/buttons explicitly released in Settings |

> **REQ-ACL-001** The system SHALL support custom roles cloned from a standard role (e.g. "Subcontractor", "Vendor", "Auditor") — [P2].

### 4.2 Permission Model
Access is controlled by **RBAC + scope + field rules**:

```
Permission = Role × Module × Screen × Action × Scope × (optional Field rule)
```

| Dimension | Values |
|---|---|
| **Module** | Any installed plugin (e.g. `procurement.expediting`) |
| **Screen** | Any screen the plugin registers (e.g. `expediting.list`, `expediting.detail`) |
| **Action** | `view`, `create`, `edit`, `delete`, `approve`, `export`, `import`, `comment`, `assign`, `configure`, `release_to_client` |
| **Scope** | `all`, `own_discipline`, `own_package`, `own_area`, `assigned_to_me`, `created_by_me`, `released_only` |
| **Field rule** | Hide / read-only per field (e.g. hide PO value from Client and Team Member) |

**REQ-ACL-002** Permissions SHALL be configurable in *Settings → Access Control* through a matrix UI (rows = screens/actions, columns = roles) with tick boxes and scope drop-downs.
**REQ-ACL-003** Changes to the permission matrix SHALL be audited and SHALL take effect on the user's next request (no re-login needed).
**REQ-ACL-004** The UI SHALL hide menu items, screens and buttons the user has no permission for — not just disable them. Hidden buttons SHALL also be blocked at API level.
**REQ-ACL-005** The PM SHALL be able to "View as role" (impersonate a role in preview mode) to check what each role, especially the Client, sees.

### 4.3 Client Access — Detailed Rules
The Client role is the most restricted and the most configurable.

| Rule | Requirement |
|---|---|
| CL-01 | By default the Client sees **only**: Dashboard (client layout), Overall Progress, Milestones, Interface Register (items where COMPANY is a party), Minutes of Meeting (released), Documents (released), Handover Schedule, Event calendar (released events). |
| CL-02 | Every record type has a **"Released to Client"** flag. Only records with the flag are visible to Client users (scope `released_only`). |
| CL-03 | The PM can release whole screens, specific widgets, specific reports or individual records. |
| CL-04 | Commercial fields (PO values, rates, subcontract values, internal risk scores, internal comments) are hidden from the Client by default through field rules. |
| CL-05 | Comments have two visibility levels: **Internal** (never shown to Client) and **Shared**. The default for new comments is Internal. |
| CL-06 | Client buttons configurable per screen: `Comment`, `Respond` (interface queries), `Approve/Reject` (e.g. MOC client approval, handover acceptance), `Export PDF`, `Export Excel`. |
| CL-07 | Every Client login and download is logged and visible to the PM. |
| CL-08 | The Client UI SHALL show a subtle "COMPANY view" badge and a simplified navigation. |

### 4.4 Default Permission Matrix (Summary)
`F` = Full (CRUD + approve + configure) · `E` = Create/Edit within scope · `A` = Approve within scope · `R` = Read · `R*` = Read released only · `–` = Hidden

| Module | PM | Manager | Leader | Team Member | Client |
|---|---|---|---|---|---|
| Dashboard | F | E (own widgets) | E (own widgets) | R | R* (client layout) |
| Engineering | F | E/A | E | E (assigned) | – |
| Procurement Plan | F | E/A | E | R | – |
| Expediting | F | E/A | E | E (assigned) | – |
| Logistics / Materials | F | E/A | E | E (assigned) | – |
| Overall Progress | F | E/A | R | R | R* |
| Milestones | F | E/A | R | R | R* |
| Construction (all) | F | E/A | E | E (assigned) | – (configurable) |
| Fabrication Subcontracting | F | E/A | E | E (assigned) | – |
| Pre-com / Commissioning | F | E/A | E | E (assigned) | R* (handover) |
| QAQC | F | E/A | E | E (assigned) | R* (configurable) |
| HSE | F | E/A | E | E (own reports) | R* (statistics) |
| T&I | F | E/A | E | E (assigned) | R* (timeline) |
| Offshore HUC | F | E/A | E | E (assigned) | R* (timeline/progress) |
| Risk Register | F | E/A | E | R | – |
| Issue Register | F | E/A | E | E (assigned) | – |
| Lessons Learned | F | E/A | E | E | – |
| MOC | F | E/A | E (raise) | E (raise) | R*/A (if client approval required) |
| Stakeholders | F | E | R | – | – |
| Interface Register / Points | F | E/A | E | E (assigned) | R*/E (respond) |
| Interface Matrix | F | E | R | R | R* |
| Event Management | F | E | E | R | R* |
| Minutes of Meeting | F | E/A | E | R | R* |
| Documents | F | E | E | E | R* |
| Analytics | F | R | R (own areas) | – | – |
| Tasks – Personal workspace *(Rev. B)* | E (own) | E (own) | E (own) | E (own) | E (own, if assigned) |
| Tasks – Project workspace *(Rev. B)* | F | E/A | E (assign within scope) | E (assigned) | R* (shared tasks) |
| Document Control – MDR/EMDR *(Rev. B)* | F | E/A | E | E (assigned) | R* (released docs, review codes) |
| Document Control – Transmittals & Reviews *(Rev. B)* | F | E/A | E | E (Doc Controller level) | R*/E (review & return comments) |
| Correspondence *(Rev. B)* | F | E/A | E (draft) | R (cc'd) | – |
| Project Directory & Organisation *(Rev. B)* | F | E | R | R | R* (contact list) |
| Contract & Commercial / Cost Control *(Rev. B)* | F | R (if granted) | – | – | – |
| Other Rev. B modules (TQ/Deviation, Resources, Equipment, Permits, Metocean, Close-out) | F | E/A | E | E (assigned) | R* (configurable) |
| Settings | F | – (module settings if delegated) | – | – | – |
| User Management | F | – | – | – | – |

### 4.5 Delegation & Proxy
- **REQ-ACL-010** A user SHALL be able to set an **out-of-office delegate** with a start/end date; approvals and reminders are routed to the delegate in that window [P2].
- **REQ-ACL-011** The PM SHALL be able to delegate module configuration rights to a Manager (e.g. Interface Manager configures the Interface module) [P1].

### 4.6 Project-Specific Titles & Levels *(Rev. B)*
Every project has its own organisation, so job titles and the number of levels differ from project to project. Project Flow separates three things:

| Concept | Defined at | Example |
|---|---|---|
| **Access level** (fixed, 5 + Admin) | Platform | PM · Manager · Leader · Team Member · Client |
| **Project level** (configurable, 3–10 per project) | Project Settings → Organisation Levels | L1 Project Director · L2 Project Manager · L3 Package / Functional Manager · L4 Lead Engineer / Supervisor · L5 Engineer / Coordinator · L6 Document Controller · C1 COMPANY Project Rep · C2 COMPANY Discipline Rep |
| **Position title** (free text, per person, per project) | User's project membership | "Topside Package Manager", "Interface Manager", "Lead Piping Engineer", "COMPANY Site Representative" |

- **REQ-ACL-020** Each project SHALL define its own list of project levels: name (EN/VI), code, order, the base access level it maps to, default module set, default scope and colour badge.
- **REQ-ACL-021** Two projects MAY use different level names and numbers. For example, a small wellhead platform project might use 4 levels, while a large CPP project might use 7 levels with "Deputy PM" and "Package Manager".
- **REQ-ACL-022** A user's membership is stored **per project**: project level, position title, discipline(s), package(s), area(s), reports-to, start/end date on the project. The same person can be "Interface Manager (L3)" on project A and "Lead Engineer (L4)" on project B.
- **REQ-ACL-023** Level templates ("Typical EPCIC – 6 levels", "Small project – 4 levels") SHALL be selectable when a project is created and copyable from another project.
- **REQ-ACL-024** The project organisation chart, the contact directory and the PIC lists in every module SHALL show the **project** title and level, not a global one.

### 4.7 Module Assignment per Level and per Person *(Rev. B)*
On top of the permission matrix (§4.2), the PM decides **which modules each level and each person can use**.

**Effective access rule**

```
Effective access to module M for user U on project P =
   Module M enabled on project P                                (§8.4.6)
 AND ( M assigned to U's project level  OR  M granted to U personally )
 AND NOT ( M revoked from U personally )
 → then actions/scope from the role permission matrix (§4.2),
   optionally narrowed or widened by U's personal override
```

| Feature | Requirement |
|---|---|
| **Level × Module matrix** | Settings → Access Control → Module Assignment: rows = enabled modules (grouped as in the sidebar), columns = project levels; each cell = `Hidden` / `View` / `Contribute` / `Manage` (shortcuts that set the underlying actions). |
| **Per-person overrides** | From a user's profile in User Management: grant or revoke a module, change the action set (e.g. let one Team Member approve punch items), narrow or widen the scope (disciplines/packages/areas), with an optional start/end date and a mandatory reason. |
| **Bulk assignment** | Select several users or a group → assign or revoke modules in one action. |
| **Effective access viewer** | For any user: a read-only table of every module, the resulting rights and *why* (from level, from personal grant, revoked). |
| **"View as"** | PM can preview the app as any level or any specific person (§4.2, REQ-ACL-005). |
| **Client levels** | Client levels (C1, C2…) can only receive modules flagged "Client-capable" in the Master registry; fields and records still follow the client release rules (§4.3). |
| **Audit & review** | Every assignment change is audited; the quarterly access review (§8.2) includes module assignments and expiring personal grants. |

- **REQ-ACL-030** Removing a module from a user SHALL NOT remove their records; their open items stay visible to the owners and the PM, with a warning to reassign the PIC.
- **REQ-ACL-031** When a module is newly enabled on a project, it is assigned automatically using the level defaults in its manifest (`defaultLevels`). The PM can review this before enabling ("Enable & review access").
- **REQ-ACL-032** Expiring personal grants SHALL send a reminder 5 working days before expiry to the PM and the user.

---

## 5. System Architecture & Plugin Framework

### 5.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    Web Client (React SPA / PWA)                    │
│  App Shell · Router · Design System · Plugin UI Loader · i18n      │
└───────────────▲───────────────────────────────▲────────────────────┘
                │ HTTPS / REST + WebSocket      │
┌───────────────┴───────────────────────────────┴────────────────────┐
│                        API Gateway / BFF                           │
│  AuthN (JWT/OIDC) · AuthZ (policy engine) · Rate limit · Audit     │
├────────────────────────────────────────────────────────────────────┤
│                         Core Platform                              │
│ Identity │ Projects │ RBAC │ Settings │ Plugin Registry │ Workflow │
│ Notifications/Reminders │ Files │ Comments │ Search │ Audit │ Jobs │
├────────────────────────────────────────────────────────────────────┤
│                       Plugin Modules                               │
│ dashboard │ engineering │ procurement │ planning │ construction │  │
│ fab-subcon │ commissioning │ qaqc │ hse │ t-and-i │ huc │          │
│ management │ interface │ events │ reports                          │
├────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (schema per plugin) · Redis · Object storage (S3)      │
│  Search index (OpenSearch/Meilisearch) · Message bus (events)      │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Recommended Technology Stack
| Layer | Technology | Rationale |
|---|---|---|
| Front-end | React 19 + TypeScript, Vite, React Router, TanStack Query & Table | Mature ecosystem; large data grids |
| UI kit | Tailwind CSS + shadcn/ui (Radix primitives), custom design tokens | Accessible, themeable, consistent |
| Charts | Apache ECharts (S-curves, Gantt-like, heatmaps) | Handles large datasets; export to image |
| Gantt / timeline | dhtmlx-gantt or Bryntum (licensed) — or a custom SVG timeline for P1 | T&I / HUC / commissioning sequences |
| Layout drawing | Konva.js (canvas) for yard/facility layout | Zoom/pan, layers, hotspots |
| Back-end | Node.js 22 + NestJS (modular monolith) | Module system maps naturally to plugins |
| ORM | Prisma or TypeORM with migrations per plugin | Versioned schema per module |
| Database | PostgreSQL 16 (schema per plugin, row-level `project_id`) | Relational integrity, JSONB for config |
| Cache / queue | Redis + BullMQ | Reminders, scheduled jobs, notifications |
| Storage | S3-compatible (AWS S3 / MinIO on-prem) | Attachments, photos, reports |
| Search | Meilisearch (P1) / OpenSearch (P3, large scale) | Global search |
| Auth | Built-in (email + password + MFA) + OIDC/SAML SSO (Azure AD / Entra ID) | Corporate SSO |
| Real-time | WebSocket (Socket.IO) | Live notifications, presence |
| Reporting | Server-side PDF (Playwright headless), Excel (ExcelJS) | Branded PDF/Excel exports |
| DevOps | Docker, GitHub Actions / GitLab CI, Kubernetes or Docker Compose | Cloud or on-prem deployment |
| Observability | OpenTelemetry, Grafana/Loki/Prometheus, Sentry | Monitoring and error tracking |

> The architecture is a **modular monolith** first (simpler to deploy on-prem at yard sites) with clean plugin boundaries, so a heavy module can later be split into its own service.

### 5.3 Plugin Framework

#### 5.3.1 Plugin Concept
A **plugin** is a self-contained package with back-end code, front-end bundle, database migrations, permissions, settings schema, dashboard widgets and report templates. Core is never changed to add a module.

#### 5.3.2 Plugin Manifest (example)
```json
{
  "id": "procurement.expediting",
  "name": "Expediting",
  "version": "1.0.0",
  "group": "EPCIC / Procurement",
  "phase": "P1",
  "requires": { "core": ">=1.0.0", "procurement.plan": ">=1.0.0" },
  "optional": ["logistics", "qaqc"],
  "icon": "truck-fast",
  "menu": [
    { "id": "expediting", "label": { "en": "Expediting", "vi": "Đôn đốc tiến độ" },
      "route": "/procurement/expediting", "order": 20 }
  ],
  "screens": ["expediting.list", "expediting.detail", "expediting.dashboard"],
  "actions": ["view","create","edit","delete","export","import","comment","release_to_client"],
  "widgets": ["expediting.po-status-donut", "expediting.late-items", "expediting.ros-forecast"],
  "settingsSchema": "./settings.schema.json",
  "events": {
    "emits": ["po.milestone.updated", "po.delivery.late"],
    "subscribes": ["procurement.po.created"]
  },
  "reports": ["expediting-weekly.xlsx", "expediting-status.pdf"],
  "migrations": "./migrations",
  "defaultPermissions": "./permissions.default.json"
}
```

#### 5.3.3 Plugin Lifecycle
| State | Description | Who |
|---|---|---|
| **Available** | Package present in the registry, not installed | System Admin |
| **Installed** | Migrations run, permissions and settings registered at tenant level | System Admin |
| **Enabled (per project)** | Menu, widgets and screens visible in the project | PM |
| **Disabled (per project)** | Hidden; data retained, read-only by API | PM |
| **Upgraded** | New version, migrations applied, changelog shown | System Admin |
| **Uninstalled** | Removed; data archived to export (requires double confirmation) | System Admin |

**REQ-PLG-001** The system SHALL check dependencies before enabling a plugin (e.g. *Expediting* requires *Procurement Plan*) and offer to enable required plugins.
**REQ-PLG-002** Disabling a plugin SHALL NOT delete data.
**REQ-PLG-003** Plugins SHALL communicate only through the core **event bus** and published **service interfaces**, never by reading another plugin's tables directly.
**REQ-PLG-004** Each plugin SHALL ship default permissions for the five standard roles.
**REQ-PLG-005** Plugins in a future phase SHALL be shown in *Settings → Modules* as "Coming in Phase X" (roadmap visibility).
**REQ-PLG-006** Plugin settings SHALL be described with JSON Schema so the Settings UI is generated automatically.
**REQ-PLG-007** *(Rev. B)* The manifest SHALL also declare `defaultLevels` (default module assignment per base access level), `clientCapable` (true/false) and `status` for the Master Module Registry (§8.4.6).

#### 5.3.4 Extension Points
| Extension point | What a plugin can contribute |
|---|---|
| `menu` | Sidebar items and sub-items |
| `routes` | Screens |
| `widgets` | Dashboard widgets (size, data source, filters) |
| `settings` | Settings pages (generated from schema) |
| `permissions` | Screens & actions for the access matrix |
| `entities` | Linkable entities (so Risk can link to an Interface, Issue to a PO, etc.) |
| `notifications` | Notification types and default reminder rules |
| `reports` | Report templates (PDF/Excel) |
| `search` | Indexed fields for global search |
| `importers` | Excel/CSV import templates and mappings |
| `kpis` | KPI definitions that Analytics can use |

### 5.4 Multi-Project & Data Isolation
- Every business table carries `project_id`; the API enforces project scope on every query (row-level security in PostgreSQL as a second layer).
- Users switch project through the **Project Switcher** in the top bar.
- Portfolio view (PM/Director across projects) — [P3].

### 5.5 Module Catalogue & Phase Mapping
| Group | Plugin ID | Module | Phase |
|---|---|---|---|
| Core | `core.*` | Auth, Users, Roles, Settings, Themes, Reminders, Audit, Files, Profile | P0/P1 |
| Dashboard | `dashboard` | Dashboard & widget framework | P1 |
| Engineering | `engineering.workpackages` | Engineering Work Packages & deliverables | P1 |
| Procurement | `procurement.plan` | Procurement Plan | **P1** |
| | `procurement.expediting` | Expediting | **P1** |
| | `procurement.logistics` | Logistics | **P2** |
| | `procurement.materials` | Materials | **P2** |
| Planning | `planning.overall` | Overall Progress | **P1** |
| | `planning.workpackages` | Planning Work Packages | P1 |
| | `planning.milestones` | Milestones | **P1** |
| Construction | `construction.yard` | Yard Layout | P2 |
| | `construction.facility` | Facility Layout | **P3** |
| | `construction.workfront` | Workfront | P2 |
| | `construction.sequence` | Construction Sequence | **P3** |
| | `construction.progress` | Construction Progress & KPI | P1 |
| | `construction.productivity` | Productivity | P2 |
| Fab Subcon | `subcon.progress` | Subcontractor Progress | P2 |
| | `subcon.concerns` | Concerns & Highlights | P2 |
| Commissioning | `comm.systems` | Systems & Subsystems | P2 |
| | `comm.sequence` | Commissioning Sequence | P3 |
| | `comm.handover` | Handover Schedule | P2 |
| | `comm.checksheets` | Check-sheet Progress & KPI | P2 |
| | `comm.punch` | Punch Closing Progress & KPI | P2 |
| QAQC | `qaqc` | QAQC | P2 |
| HSE | `hse` | HSE | P2 |
| T&I | `ti.workpacks` / `ti.schedule` / `ti.sequence` / `ti.progress` | T&I | P3 |
| HUC | `huc.marine` / `huc.schedule` / `huc.progress` | Offshore HUC | P3 |
| Management | `mgmt.risk` / `mgmt.issue` | Risk & Issue Registers | P1 |
| | `mgmt.lessons` / `mgmt.moc` / `mgmt.stakeholders` | Lessons Learned, MOC, Stakeholders | P2 |
| Interface | `interface.register` / `interface.points` | Interface Register & Points | P1 |
| | `interface.matrix` | Interface Matrix | P1 |
| Events | `events` | Event Management | P2 |
| Reports | `reports.mom` | Minutes of Meetings | P1 |
| | `reports.documents` | Documents | P1 |
| | `reports.analytics` | Analytics | P2 (advanced P3) |
| **Rev. B additions** | | | |
| Core | `core.projects` | Project Settings & Project Selection (titles, levels, switcher) | P0/P1 |
| Core | `core.modules` | Module Management – Master Registry & assignment | P0/P1 |
| Tasks | `tasks.personal` / `tasks.project` | Tasks Management (personal & project workspaces, unified PIC inbox) | **P1** |
| Document Control | `doc.mdr` / `doc.emdr` / `doc.transmittals` / `doc.reviews` | MDR, EMDR, transmittals, COMPANY / CA / MWS reviews | **P1** (core) · P2 (CRS, distribution matrix, vendor upload) · P3 (dossiers, EDMS sync) |
| Directory | `org.directory` | Project Directory & Organisation (org chart, contacts, PIC/RACI) | P1 |
| Correspondence | `doc.correspondence` | Correspondence Register (letters in/out) | P2 |
| Engineering | `eng.tq` | Technical Query, Deviation & Concession Register | P2 |
| Resources | `res.manpower` | Resource & Manpower (mobilisation, histogram, POB, competence) | P2 |
| Equipment | `res.equipment` | Construction Equipment & Lifting Register | P2 |
| Compliance | `comp.permits` | Permits, Licences & Regulatory Compliance | P2 |
| Commercial | `com.contract` / `com.cost` | Contract & Variation Management; Cost Control & EVM | P3 |
| Metocean | `marine.metocean` | Weather & Metocean | P3 |
| Close-out | `closeout` | Completion Dossiers & Project Close-out | P3 |
| Portals | `portal.vendor` / `portal.subcon` | Vendor & Subcontractor Portals | P3 |

---

## 6. Branding & Visual Identity

### 6.1 Brand Positioning
| Attribute | Expression |
|---|---|
| Personality | Professional · Precise · Calm · Trustworthy · Modern-industrial |
| Tone of voice | Clear, factual, concise; engineering vocabulary; no slang, no exclamation marks in system messages |
| Feel | "Control room clarity" — dark navy depth, clean white space, precise lines |
| Tagline | **"Every package. Every milestone. One flow."** |

### 6.2 Logo Concept
- **Mark:** Three ascending, flowing parallel strokes forming a stylised "F" that also reads as waves turning into a rising progress curve (offshore + progress). The strokes graduate from Deep Navy to Ocean Teal.
- **Wordmark:** "Project**Flow**" — "Project" in Medium weight, "Flow" in SemiBold; tight letter-spacing (−1 %).
- **Variants:** Full colour horizontal, stacked, mark only (app icon / favicon), monochrome white (for dark headers), monochrome navy (for print).
- **Clear space:** height of the "F" stroke on all sides. **Minimum size:** 24 px (mark), 96 px (horizontal lock-up).
- **Co-branding:** Settings allow upload of the CONTRACTOR logo and the COMPANY logo; both appear on report covers and the login screen ("Powered by Project Flow").

### 6.3 Colour System

#### 6.3.1 Brand Palette
| Token | Name | HEX | Use |
|---|---|---|---|
| `brand-900` | Abyss Navy | `#0B1F3A` | Sidebar, headers, primary text on light |
| `brand-700` | Deep Navy | `#12345E` | Primary buttons (hover), charts series 1 |
| `brand-500` | Ocean Blue | `#1F5FA8` | Primary buttons, links, focus |
| `accent-500` | Ocean Teal | `#0FA3A3` | Accent, active nav, selected states, series 2 |
| `accent-300` | Light Teal | `#6FD3CF` | Highlights, progress bar fill (dark mode) |
| `gold-500` | Brass Gold | `#C9A24A` | Premium accent (milestones, achievements), sparingly |
| `neutral-0` | White | `#FFFFFF` | Surfaces |
| `neutral-50` | Mist | `#F5F7FA` | App background |
| `neutral-100` | Cloud | `#EBEFF4` | Table stripes, dividers |
| `neutral-300` | Steel | `#C3CCD8` | Borders |
| `neutral-500` | Slate | `#6B7A90` | Secondary text |
| `neutral-700` | Graphite | `#3A4658` | Body text |

#### 6.3.2 Semantic / Status Colours (fixed in all themes)
| Token | HEX (light) | HEX (dark) | Meaning |
|---|---|---|---|
| `status-green` | `#1E9E62` | `#3CC489` | On track / closed / accepted |
| `status-amber` | `#D98E04` | `#F2B33D` | At risk / pending / due soon |
| `status-red` | `#C8372D` | `#F0645A` | Late / critical / rejected |
| `status-blue` | `#2F7DD1` | `#6AA8EE` | In progress / information |
| `status-grey` | `#8A96A8` | `#9AA6B8` | Not started / N/A / on hold |
| `status-purple` | `#7B5CC4` | `#A88EE8` | Client action / awaiting COMPANY |

**Rule:** status is never conveyed by colour alone — always pair with an icon or text label (accessibility).

#### 6.3.3 Discipline Colours (charts, layout maps)
| Discipline | HEX |
|---|---|
| Structural | `#1F5FA8` |
| Piping | `#0FA3A3` |
| Mechanical | `#7B5CC4` |
| Electrical | `#D98E04` |
| Instrument | `#C8372D` |
| E&I (combined) | `#E07B39` |
| Architectural / HVAC | `#5B8C3A` |
| Painting / Insulation | `#8A6D4B` |
| Telecom | `#3F8FB5` |

Discipline colours are editable in *Settings → Disciplines*.

### 6.4 Typography
| Role | Font | Weight | Size / Line-height |
|---|---|---|---|
| Display (dashboard KPIs) | **Inter Display** (fallback Inter) | 600 | 32/40 |
| H1 page title | Inter | 600 | 24/32 |
| H2 section | Inter | 600 | 18/26 |
| H3 card title | Inter | 600 | 15/22 |
| Body | Inter | 400 | 14/22 |
| Small / caption | Inter | 400–500 | 12/18 |
| Table cell | Inter | 400 | 13/20 |
| Numerals / codes / tag numbers | **JetBrains Mono** or Inter with `tnum` (tabular figures) | 500 | 13/20 |

- Vietnamese diacritics fully supported (Inter covers Vietnamese).
- Numbers in tables and KPIs always use **tabular figures** so columns align.
- Default number format: `1,234.5` (EN) / `1.234,5` (VI) — configurable; percentages to 1 decimal place.
- Date format configurable; default `08-Nov-2026` (unambiguous for international teams).

### 6.5 Iconography & Imagery
- Icon set: **Lucide** (outline, 1.5 px stroke), sizes 16/20/24. Custom domain icons (jacket, topside, crane, barge, spool, valve, cable drum, check-sheet, punch) drawn in the same style.
- Imagery: real yard/offshore photography, desaturated 20 % with a navy overlay on the login screen and empty states. No stock photos of people in suits.
- Illustrations: thin-line isometric drawings (jacket, topside, barge) in brand colours for empty states and onboarding.

### 6.6 Elevation, Radius, Spacing
| Token | Value |
|---|---|
| Spacing scale | 4-pt grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Radius | `sm` 4 px (inputs, chips) · `md` 8 px (cards, buttons) · `lg` 12 px (modals, panels) |
| Elevation 0 | Flat, 1 px border `neutral-100` (default cards) |
| Elevation 1 | `0 1px 2px rgba(11,31,58,.06), 0 1px 3px rgba(11,31,58,.08)` (hover) |
| Elevation 2 | `0 8px 24px rgba(11,31,58,.12)` (dropdowns, popovers) |
| Elevation 3 | `0 16px 48px rgba(11,31,58,.18)` (modals) |
| Motion | 150 ms (micro), 200 ms (panels), 250 ms (modals); easing `cubic-bezier(.2,.8,.2,1)`; respects `prefers-reduced-motion` |

### 6.7 Brand in Reports
- PDF report covers: navy band top, project name, COMPANY + CONTRACTOR logos, document number, revision, cut-off date, confidentiality label.
- Every page: header with project code and report title; footer with "Generated by Project Flow · dd-MMM-yyyy hh:mm · Page x of y".
- Excel exports: frozen header row in navy with white text, auto-filter, column widths fitted, a "Report Info" sheet (project, generated by, filters, cut-off).

---

## 7. UX/UI Specification

### 7.1 UX Principles
1. **Overview first, zoom and filter, then details on demand** (Shneiderman).
2. **Three clicks to any record** from the dashboard.
3. **Consistency:** every register (risk, issue, interface, MOC, punch, NCR…) uses the same list–detail pattern, filters, bulk actions and export.
4. **Inline editing** in grids for high-volume updates (progress, expediting dates).
5. **Never lose work:** autosave drafts every 10 s; warn on navigating away from unsaved forms.
6. **Explain the numbers:** every KPI has a tooltip showing its formula, data source and cut-off date.
7. **Cut-off awareness:** the current reporting cut-off date is always visible in the top bar.

### 7.2 Application Shell

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] ProjectFlow │ Project ▾ [ABC-WHP Jacket & Topside] │ 🔍 Search (⌘K) │
│                 │ Cut-off: 06-Nov-2026 (Wk 45)         │ 🔔3  ? 🌐 EN ▾ (TN)│
├──────────┬───────────────────────────────────────────────────────────────┤
│ ▣ Dashboard        │ Breadcrumb: EPCIC › Procurement › Expediting        │
│ ▾ EPCIC            │ ┌───────────────────────────────────────────────┐   │
│   Engineering      │ │ Page title             [Filters] [Export] [+] │   │
│   Procurement  ▸   │ ├───────────────────────────────────────────────┤   │
│   Planning     ▸   │ │ KPI strip (4–6 cards)                         │   │
│   Construction ▸   │ ├───────────────────────────────────────────────┤   │
│   Fab. Subcon  ▸   │ │ Tabs: List | Board | Timeline | Analytics     │   │
│   Pre-com/Comm ▸   │ │ Data grid / chart / layout canvas             │   │
│   QAQC             │ │                                               │   │
│   HSE              │ │                                               │   │
│   T&I          ▸   │ └───────────────────────────────────────────────┘   │
│   Offshore HUC ▸   │                        ┌──────────────────────────┐ │
│ ▸ Management       │                        │ Detail drawer (right)    │ │
│ ▸ Interface Mgmt   │                        │ Fields · Links · Comments│ │
│ ▣ Events           │                        │ Attachments · History    │ │
│ ▸ Reports          │                        └──────────────────────────┘ │
│ ─────────          │                                                     │
│ ⚙ Settings         │                                                     │
│ [«] collapse       │                                                     │
└────────────────────┴─────────────────────────────────────────────────────┘
```

| Element | Requirement |
|---|---|
| **Sidebar** | 264 px expanded / 72 px collapsed (icons + tooltips); Abyss Navy background, white 80 % text, Teal 3 px left indicator for the active item; groups collapsible; order and visibility follow installed plugins and permissions; users can pin favourites. |
| **Top bar** | 56 px; project switcher; global search (⌘K / Ctrl+K command palette); cut-off date & week; notifications bell with unread count; help; language switch; avatar menu (Profile, Theme, Delegation, Logout). |
| **Breadcrumb** | Always shown below the top bar on module screens. |
| **Page header** | Title, short description (optional), primary action at right (one primary button per page), secondary actions in a "More" menu. |
| **Detail drawer** | Opens from the right (560 px, expandable to full screen) so the list stays in context; deep-linkable URL. |
| **Command palette** | Jump to any screen, record (by number, e.g. `IQ-0123`, `PO-4500012`), or action ("New risk", "Switch to dark theme"). |

### 7.3 Standard Screen Patterns
| Pattern | Used by | Key behaviours |
|---|---|---|
| **Register (List + Drawer)** | Risks, Issues, Lessons, MOC, Stakeholders, Interfaces, Punch, NCR, Concerns | Saved views, column chooser, multi-filter, group-by, inline edit, bulk update, Excel import/export, RAG chips, ageing indicator |
| **Board (Kanban)** | Issues, actions, MOC workflow, interface status | Drag between status columns (respects workflow rules) |
| **Progress grid** | Construction, check-sheets, engineering deliverables | Hierarchy WBS → WP → item; inline % / step update; roll-up totals; frozen columns |
| **Timeline / Gantt** | Milestones, T&I, HUC, commissioning sequence, handover | Zoom day/week/month; baseline vs forecast bars; dependency lines; today line; critical path highlight |
| **S-Curve** | Overall progress, discipline progress | Plan / early / late / actual / forecast; cumulative and periodic bars; cut-off marker |
| **Layout canvas** | Yard layout, facility layout, workfront | Background drawing (PDF/PNG/SVG/DWG→SVG), zones/hotspots, colour by status, layers, zoom/pan, click-to-detail |
| **Matrix** | Interface matrix, RACI, risk heat map | Cells clickable to filtered list; heat colouring |
| **Dashboard grid** | Dashboard, module dashboards | 12-column draggable/resizable widgets |
| **Form** | All create/edit | 2-column on desktop, 1-column on mobile; required fields marked; inline validation; sections with anchors |

### 7.4 Component Library (Design System "Flow UI")
Buttons (primary, secondary, ghost, destructive, icon), inputs, select/combobox with search, multi-select chips, date/date-range pickers (with project week numbers), number inputs with units, percentage slider, rich-text editor (MoM, comments), file dropzone, avatar & avatar group, status chip, RAG dot, progress bar (linear, segmented by discipline), progress ring, KPI card (value, delta vs last period, sparkline, target), data grid (virtualised for 50k rows), tree grid, tabs, accordion, drawer, modal, toast, banner, tooltip, popover, stepper (workflow), timeline, empty state, skeleton loader, breadcrumbs, pagination, tag/label, comment thread with @mentions, activity feed, calendar, heat-map cell.

**REQ-UX-001** All components SHALL be documented in Storybook with light/dark examples and accessibility notes.
**REQ-UX-002** Component tokens SHALL be CSS variables so themes switch at run time without reloading.

### 7.5 Key Interaction Specifications
| ID | Interaction | Specification |
|---|---|---|
| UX-01 | Filters | Filter bar with chips; "Add filter" by any column; saved views (personal / shared to project); URL keeps filter state |
| UX-02 | Inline edit | Double-click or Enter to edit a cell; Tab to the next cell; Esc cancels; changes highlighted until saved; batch save with a "N changes – Save / Discard" bar |
| UX-03 | Bulk actions | Select rows → assign, change status, set due date, export, release to client |
| UX-04 | Ageing | Open items show age badges: < 7 d grey, 7–14 d amber, > 14 d red (thresholds configurable) |
| UX-05 | Linking | "Link" button on any record → search any linkable entity (risk ↔ interface ↔ MOC ↔ issue ↔ PO ↔ WP ↔ document) |
| UX-06 | Comments | Threaded, @mention users, Internal/Shared toggle, attachments, reactions (✓ seen) |
| UX-07 | History | Every record has a History tab listing field changes (old → new, user, time) |
| UX-08 | Keyboard | `⌘K` palette, `N` new record, `/` focus search, `G D` go to dashboard, `?` shortcut help |
| UX-09 | Empty states | Illustration + one sentence + primary action ("Import from Excel" / "Create first risk") |
| UX-10 | Loading | Skeletons for > 300 ms; no full-page spinners after first load |
| UX-11 | Errors | Plain-language message + what to do + reference code; never raw stack traces |
| UX-12 | Confirmation | Destructive actions need confirmation; deleting a record with links shows the links first; soft delete with 30-day restore |
| UX-13 | Offline (PWA) | Read-only cache of last-viewed lists; progress entry queued offline for site/yard use — [P3] |
| UX-14 | Print | Print stylesheet for any list/detail; "Print to PDF" uses report branding |

### 7.6 Responsive Behaviour
| Breakpoint | Width | Behaviour |
|---|---|---|
| Mobile | < 640 px | Sidebar becomes bottom nav (5 items) + menu sheet; lists become cards; drawers become full-screen pages; dashboards stack in one column |
| Tablet | 640–1023 px | Collapsed sidebar; 2-column dashboard; drawer 100 % width |
| Desktop | 1024–1439 px | Full layout |
| Wide | ≥ 1440 px | Max content width 1680 px; dashboards up to 4 columns; optional second detail pane |
| Wall display | ≥ 1920 px | "TV mode" for the dashboard: auto-rotating pages, large fonts, no chrome — [P2] |

Mobile priorities (yard / site use): punch item capture with photo, check-sheet status update, HSE observation reporting, interface query response, notifications, approvals.

### 7.7 Accessibility
- **WCAG 2.2 AA**: contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components and chart elements.
- Full keyboard navigation; visible 2 px Teal focus ring.
- ARIA labels on all icon buttons; charts provide a "View as table" alternative.
- Colour-blind-safe chart palette option (Settings → Themes → "High contrast / colour-blind safe").
- Text scaling to 200 % without loss of function.

### 7.8 Internationalisation
- UI languages: **English (default), Vietnamese**; architecture ready for more.
- All labels from translation files; plugins ship their own translation keys.
- Users choose the language in Profile; reports can be generated in either language.
- Time zone per project (e.g. yard in Vũng Tàu, office in Kuala Lumpur, offshore field) and per user display.

---

## 8. Core Platform Modules

### 8.1 Authentication — Login / Logout / Register

#### 8.1.1 Login Screen (UI)
- Split layout: **left 55 %** full-height desaturated offshore photograph with navy gradient overlay, logo, tagline and the project/COMPANY co-brand; **right 45 %** white panel with the form.
- Form: Email, Password (show/hide toggle), "Remember me on this device (14 days)", **Sign in** (primary, full width), "Forgot password?", divider "or", **Sign in with Microsoft** (SSO, if configured), "Request access" link (if self-registration is enabled).
- Footer: language switch, version number, privacy/terms links.
- Dark theme version of the login screen follows the system preference.

#### 8.1.2 Requirements
| ID | Requirement | Phase |
|---|---|---|
| REQ-AUTH-001 | Users SHALL log in with email + password. | P0 |
| REQ-AUTH-002 | Passwords SHALL be hashed with Argon2id; policy configurable (default ≥ 12 chars, upper/lower/number, not in breached-password list). | P0 |
| REQ-AUTH-003 | Account lock-out after 5 failed attempts for 15 minutes (configurable); CAPTCHA after 3 failures. | P0 |
| REQ-AUTH-004 | MFA by TOTP authenticator app; mandatory for PM, Manager and System Admin (configurable); optional email OTP. | P1 |
| REQ-AUTH-005 | SSO via OIDC/SAML (Microsoft Entra ID, Google Workspace); just-in-time user creation with default role "Team Member – pending approval". | P1 |
| REQ-AUTH-006 | Session: access token 15 min + refresh token (rotating, httpOnly secure cookie); idle timeout 60 min (configurable); absolute timeout 12 h. | P0 |
| REQ-AUTH-007 | **Logout** SHALL revoke the refresh token and clear all client storage; "Log out of all devices" in Profile. | P0 |
| REQ-AUTH-008 | Forgot password: emailed single-use link valid 30 min; generic response so emails cannot be enumerated. | P0 |
| REQ-AUTH-009 | Active sessions list (device, browser, IP, location, last active) with revoke in Profile. | P1 |
| REQ-AUTH-010 | Login notifications for new device/location (email). | P2 |

#### 8.1.3 Registration Flows
Three configurable modes (*Settings → Security → Registration*):

| Mode | Flow |
|---|---|
| **Invite only** (default) | PM/Admin invites by email → user receives a link (valid 7 days) → sets name, password, MFA → lands in the assigned project with the assigned role. |
| **Request access** | User fills in the form (name, company, email, phone, project, requested role, justification) → email verification → request appears in *User Management → Pending* → PM approves/rejects (approve assigns role and scope) → user notified. |
| **Domain auto-join** | Users with an allowed email domain (e.g. `@contractor.com`) can self-register; they get the "Team Member" role in no project until assigned. Client domains (e.g. `@company.com`) map to the Client role. |

**REQ-AUTH-020** The registration form SHALL require acceptance of the terms of use / confidentiality statement.
**REQ-AUTH-021** Email verification SHALL be completed before any access.
**REQ-AUTH-022** The PM SHALL receive a reminder for pending access requests older than 2 working days.

### 8.2 User Management
Location: *Settings → Users & Access* (PM, System Admin).

| Feature | Detail | Phase |
|---|---|---|
| User list | Grid: name, email, company (CONTRACTOR / COMPANY / Subcontractor / Vendor), position, role(s) per project, disciplines/packages scope, status (Active / Invited / Pending / Suspended / Deactivated), last login, MFA status | P0 |
| Invite users | Single or bulk (Excel template); choose role + scope + projects; custom welcome message | P0 |
| Edit user | Role, scope (disciplines, packages, areas, systems), project membership, manager, delegate | P0 |
| Suspend / deactivate | Immediately revokes sessions; records stay attributed to the user; licence freed | P0 |
| Reset MFA / force password reset | Admin actions, audited | P1 |
| Groups / teams | e.g. "Piping Team", "Interface Focal Points", "COMPANY Reps"; used for assignment, notifications and permissions | P1 |
| Organisation chart | Auto-generated from "reports to" field; exportable | P2 |
| Access review | Quarterly report of users and roles; PM confirms or revokes (compliance) | P2 |
| Licence dashboard | Seats used per role / company | P2 |
| Audit | All user-management actions logged | P0 |

### 8.3 Profile
Opened from the avatar menu.

| Section | Content |
|---|---|
| **Personal info** | Photo (crop & resize), full name, display name, position/title, company, department, discipline, phone, office/yard location, time zone, signature image (for MoM / approvals) |
| **Projects & roles** | Read-only list of projects, role and scope per project |
| **Preferences** | Language, theme (Light / Dark / System / High-contrast), density (Comfortable / Compact), date & number format, default landing page, default project |
| **Notifications** | Per notification type: In-app / Email / Teams / Push; digest frequency (instant, daily at hh:mm, weekly on day); quiet hours; working days |
| **Security** | Change password, MFA set-up / recovery codes, active sessions, log out of all devices, API tokens (personal access tokens, P3) |
| **Delegation** | Out-of-office delegate with dates [P2] |
| **My work** | Shortcut to "Assigned to me" across modules (actions, interface queries, punch items, approvals), with counts |
| **Activity** | My recent activity log |

### 8.4 Settings
Settings are organised in **three levels**; the Settings screen has a left sub-navigation and a search box ("Find a setting").

#### 8.4.1 Tenant Settings (System Administrator)
| Page | Settings |
|---|---|
| Organisation | Company name, logos, default language, default time zone, fiscal calendar |
| Plugins | Plugin catalogue (available / installed / version / update), install, upgrade, uninstall |
| Security | Password policy, MFA policy, session timeouts, registration mode, allowed domains, IP allow-list, SSO configuration |
| Email & Integrations | SMTP, Microsoft 365/Teams webhook, P6 connection, EDMS link pattern, API keys |
| Data | Backup schedule, retention, archive projects, data export |
| Branding | Theme defaults, custom brand colour override (within accessible limits), login background image |
| Licences | Seats, usage |

#### 8.4.2 Project Settings (PM)
| Page | Settings |
|---|---|
| **General** | Project code, name, COMPANY, contract no., contract type, location(s), yard(s), field, start date, contractual completion, time zone, currency, units (metric/imperial), working calendar, holidays |
| **Reporting periods** | Cut-off day/time (e.g. every Thursday 24:00), week numbering (project week vs ISO), monthly cut-off, freeze of reported period (lock after approval) |
| **Modules** | List of all plugins grouped as in §5.5 with toggle **Enabled/Disabled**, phase badge, dependency info, "Configure" link, "Coming in Phase X" for future modules |
| **Facilities & Structure** | Facilities (e.g. Jacket, Topside, Living Quarters, Bridge, Flare), modules, levels/decks, areas, rooms — used by layouts, workfront, progress |
| **WBS** | WBS tree editor (import from P6 or Excel), weights per node |
| **Disciplines** | List, codes, colours, leaders; default: Structural, Piping, Mechanical, Electrical, Instrument (E&I), Architectural, HVAC, Telecom, Painting, Insulation, Safety |
| **Work Packages** | See §8.4.4 |
| **Progress rules** | Rules of Credit per discipline / item type, weight factors, measurement method (units, steps, milestones, level of effort), roll-up method |
| **Systems** | System/subsystem register import, numbering format |
| **Parties** | CONTRACTOR, COMPANY, subcontractors, vendors, third parties (used by interfaces, subcontracting, expediting) |
| **Numbering** | Auto-numbering format per record type (e.g. `{PROJ}-RSK-{0000}`, `{PROJ}-IQ-{PARTY}-{000}`) |
| **Workflows** | Status lists and approval workflows per record type (see §8.7.4) |
| **Access Control** | Permission matrix per role (§4.2), field rules, client release defaults, custom roles |
| **Client Portal** | Which screens, widgets, reports and buttons are visible to the Client; client dashboard layout; client welcome message |
| **Reminders** | Reminder rules per module (§8.6) |
| **Dashboards** | Default dashboard per role; widget library availability |
| **Reports** | Report templates, cover page, distribution lists, scheduled reports |
| **Lists of values** | Editable drop-downs (risk categories, issue types, document types, cause codes…) |
| **Import / Export** | Templates, import history, bulk data export |

#### 8.4.3 Module Settings
Every plugin contributes its own settings page (from its JSON Schema), e.g.:
- *Interface*: interface types, party list, response time targets (days), priority definitions, matrix axes.
- *Risk*: probability/impact scales (5×5 default), scoring formula, appetite thresholds, risk categories.
- *Construction*: disciplines tracked, quantity units, ROC steps, KPI targets.
- *Commissioning*: check-sheet types, punch categories, handover documents checklist.

#### 8.4.4 Work Package Configuration (Engineering & Planning)
The user explicitly requires work packages to be **configurable in Settings**.

| Field | Description |
|---|---|
| WP Code | e.g. `ENG-STR-01`, `CON-PIP-TS-03` |
| WP Name | e.g. "Jacket Primary Structure Design", "Topside Main Deck Piping" |
| Type | Engineering / Procurement / Construction / Commissioning / T&I / HUC / Management |
| Phase / Facility | Jacket / Topside / Bridge / LQ / Subsea / Offshore |
| Discipline(s) | One or more |
| WBS node | Link to WBS |
| Owner (Leader) | Package Engineer Lead / Supervisor |
| Responsible party | CONTRACTOR / Subcontractor X / Vendor |
| Weight | % of parent (validated: siblings total 100 %) |
| Measurement method | Deliverables / quantities / steps / milestones / level of effort |
| Baseline dates | Start / finish (import from P6) |
| P6 activity codes | Mapping for import/sync |
| Status | Not started / In progress / Completed / On hold / Cancelled |
| Client visible | Yes/No |
| Custom fields | Up to 20 custom fields per WP type (text, number, date, list, user) |

**REQ-SET-WP-001** WPs SHALL be creatable manually, from a template library ("Typical WHP EPCIC WP set"), or by Excel import.
**REQ-SET-WP-002** Changing weights SHALL show a preview of the effect on overall progress before saving and SHALL be versioned (weights effective from a cut-off date, no silent rewriting of history).
**REQ-SET-WP-003** WP lists SHALL be shared: the Engineering and Planning modules both read from the same WP master, filtered by type.

#### 8.4.5 Project Settings & Project Selection *(Rev. B)*

**A. Creating and setting up a project** (System Admin or a user with the tenant right "Create project")

A step-by-step **Project Setup Wizard** (progress saved at each step; can be resumed):

| Step | Content |
|---|---|
| 1. Identity | Project code, **project title** (full contractual title), short display name, COMPANY, contract no. and type (EPCIC lump sum, reimbursable…), field / block, facility type (WHP, CPP, FSO, jacket only, topside only, subsea), project logo, project accent colour (validated for contrast), project manager |
| 2. Dates & calendar | Award date, kick-off, contractual completion, key contractual milestones, time zone, working week, holidays (e.g. Vietnamese public holidays, yard calendar), cut-off rules |
| 3. Structure | Facilities, WBS (import from P6/Excel or template), disciplines, parties, systems (optional at this stage) |
| 4. Organisation levels | Choose a level template or copy from another project; edit level names, codes and base access levels (§4.6) |
| 5. Modules | Select modules from the Master registry (§8.4.6) — templates: "Full EPCIC", "Fabrication only", "T&I + HUC campaign", "Brownfield modification"; dependency check |
| 6. Module assignment | Review the Level × Module matrix (§4.7) |
| 7. Client portal | Choose released screens and buttons for Client levels |
| 8. People | Invite users with project level, position title and scope (bulk Excel) |
| 9. Review & activate | Summary; project status set to **Active** |

**Project lifecycle status:** Draft (being set up) → Active → On hold → Completed (read-only except close-out modules) → Archived (read-only, excluded from search, restorable by System Admin).

**B. Selecting the current project**

| ID | Requirement |
|---|---|
| REQ-PRJ-001 | After login, a user with **one** active project goes straight to that project's dashboard. |
| REQ-PRJ-002 | A user with **several** projects sees the **Project Selector** page: one card per project showing logo, code, title, COMPANY, current phase, overall progress (if permitted), **the user's project level and position title**, unread notifications and open tasks; search, filter (active / on hold / completed), sort, "pin" favourite projects. |
| REQ-PRJ-003 | "Remember my last project" (Profile preference): open the last-used project directly; the selector stays available. |
| REQ-PRJ-004 | **Project Switcher** in the top bar: drop-down with recent and pinned projects, search, "All projects" link; keyboard shortcut `⌘/Ctrl + P`. |
| REQ-PRJ-005 | Switching project reloads the sidebar, modules, permissions, theme accent, language defaults, cut-off date and title/level badges for **that** project; unsaved edits trigger a warning. |
| REQ-PRJ-006 | Each browser tab can be on a different project; the project code is always shown in the top bar and the browser tab title (e.g. `ABC-WHP · Expediting`) so data is never entered into the wrong project. |
| REQ-PRJ-007 | Deep links include the project code (`/p/ABC-WHP/procurement/expediting/PO-4500128`); opening a link to a project the user is not a member of shows "No access – request access" instead of data. |
| REQ-PRJ-008 | The **personal task workspace** (§10.16) and the notification centre can show all projects at once with a project filter. |
| REQ-PRJ-009 | A **Portfolio view** for directors across projects (P3) uses only the projects and data each user can access. |

**C. Project Settings home page**
A card layout grouping every project setting (General, Calendar, Structure, Organisation Levels, Modules, Module Assignment, Access Control, Client Portal, Reminders, Numbering, Workflows, Lists of values, Reports, Import/Export, Audit). Each card shows a completeness indicator (e.g. "WBS weights: 2 nodes don't add up to 100 %") so the PM can see what still needs setting up.

#### 8.4.6 Module Management — Master Registry *(Rev. B)*
Two levels: a **tenant Master Registry** (System Admin) and a **project module list** (PM).

**A. Master Registry (Settings → Tenant → Modules – Master)**

| Column | Description |
|---|---|
| Module ID & name | e.g. `doc.emdr` — EMDR (Vendor Document Register) |
| Group | Sidebar group (EPCIC / Management / Interface / Tasks / Document Control …) |
| Version | Installed version · latest available · changelog link |
| **Master status** | `Planned` (on roadmap, not built) · `In development` · `Beta` (pilot projects only) · `Available` (released, not installed) · `Installed` · `Deprecated` (still works, no new enabling; replacement named) · `Retired` (uninstalled; data archived) |
| Phase | P0–P4 roadmap phase |
| Dependencies | Required / optional modules |
| Client-capable | Whether Client levels may be assigned |
| Used by | Number of projects where enabled |
| Owner | Product / functional owner of the module |
| Licence | Included / add-on |

| Action | Rule |
|---|---|
| **Add module** | Install from the module catalogue (signed package); runs migrations; registers permissions, settings, widgets and default level assignments; status → Installed |
| **Upgrade** | Shows changelog and migrations; can be scheduled outside working hours; rollback to the previous version if the migration fails |
| **Set Beta / pilot projects** | A Beta module can be enabled only on projects listed as pilots |
| **Deprecate** | Blocks enabling on new projects; projects already using it are warned and offered the replacement module |
| **Remove (uninstall)** | Only when no project has it enabled; data is exported (JSON + Excel + files) and archived; two-step confirmation with the module ID typed in |
| **Edit roadmap entry** | For `Planned` modules: target phase/date, description; shown to PMs as "Coming in Phase X" |

**B. Project module list (Settings → Project → Modules)**

| Project status of a module | Effect |
|---|---|
| **Enabled** | Visible and fully usable (subject to assignment and permissions) |
| **Read-only** | Visible; no create/edit (e.g. after the phase is finished) |
| **Hidden** | Not visible to anyone except the PM; data kept; usable as a data source for other modules |
| **Disabled** | Not visible; data kept |
| **Not added** | Available in the Master registry but not added to this project |

- **REQ-MOD-001** The PM SHALL add/remove modules for the project from a catalogue view filtered to `Installed` and `Beta` (pilot) modules, with the dependency check.
- **REQ-MOD-002** Sidebar order and grouping SHALL be customisable per project (drag and drop) and SHALL apply to all users of the project.
- **REQ-MOD-003** Each module SHALL show a "Module health" indicator on the project list: settings complete, data imported, users assigned, last activity.
- **REQ-MOD-004** All registry and project module changes SHALL be audited and announced to the users concerned in-app.

#### 8.4.7 Module Assignment UI *(Rev. B)*
- **Settings → Access Control → Module Assignment**: tabs **By level** (Level × Module matrix), **By person** (search a person → their modules with overrides), **By module** (one module → all levels and persons with access).
- Colour legend: inherited from level (grey), personal grant (teal), personal revoke (red, struck-through), expiring (amber).
- "Copy assignment from another project" and "Reset to module defaults".
- Export the assignment as an Excel access-control register for audits.

### 8.5 Themes
| Theme | Description | Phase |
|---|---|---|
| **Light – "Harbour"** (default) | Mist background, white cards, Abyss Navy sidebar | P1 |
| **Dark – "Deep Sea"** | Background `#0A1424`, surfaces `#111E33`, borders `#1E2E48`, text `#E6ECF5`, Teal accent; charts re-tuned for dark | P1 |
| **System** | Follows OS preference | P1 |
| **High Contrast** | WCAG AAA text contrast, thicker borders, colour-blind-safe palette | P2 |
| **Client / Co-brand** | PM can set the COMPANY accent colour for the client portal header (validated for contrast) | P2 |
| **TV mode** | Dark theme, large typography, auto-rotate for control-room screens | P2 |

**REQ-THM-001** Theme switch SHALL be instant (CSS variables), persisted in the profile, and available in the avatar menu.
**REQ-THM-002** Density setting: Comfortable (row height 44 px) / Compact (32 px).
**REQ-THM-003** Reports and exports always use the light print theme irrespective of the screen theme.

### 8.6 Reminders & Notifications

#### 8.6.1 Channels
In-app (bell + notification centre), Email, Microsoft Teams (webhook/bot), Web push (PWA) [P2], SMS/Zalo (optional, P4).

#### 8.6.2 Notification Types (examples)
| Type | Trigger |
|---|---|
| Assignment | A record or action is assigned to me |
| Mention | I am @mentioned in a comment |
| Due soon | Due date in N days (default 3 and 1 day) |
| Overdue | Past due; repeats every N days until closed (default every 2 working days) |
| Escalation | Overdue > X days → notify the assignee's Leader/Manager; > Y days → PM |
| Status change | Record I own or follow changed status |
| Approval request | Workflow step waiting for me |
| Client response | COMPANY responded to an interface query / MOC |
| Milestone alert | Milestone forecast slips past baseline by > N days |
| KPI threshold | KPI crosses threshold (e.g. SPI < 0.95, punch A open > 50) |
| Delivery alert | PO forecast delivery later than Required-on-Site date |
| Report ready | Scheduled report generated |
| Event reminder | Meeting / event starting in N minutes/hours |
| Cut-off reminder | "Progress cut-off in 24 h – N items not updated" (to Leaders) |

#### 8.6.3 Reminder Rule Engine
Configurable in *Settings → Reminders* (project level) per module and record type:

```
WHEN   [record type] [condition]            e.g. Interface Query, status = Open
AND    [date field] [offset] [unit]          e.g. response_due − 3 working days
THEN   notify [assignee | owner | role | group | specific users]
VIA    [in-app | email | Teams]
REPEAT every [N] [working days] until [condition]
ESCALATE after [N] days to [Leader | Manager | PM]
```

**REQ-REM-001** Rules SHALL respect the project working calendar and the user's quiet hours.
**REQ-REM-002** Users SHALL be able to create **personal reminders** on any record ("Remind me on 12-Nov 09:00") and snooze notifications (1 h / tomorrow / next week).
**REQ-REM-003** Daily digest email at a user-chosen time summarising due/overdue items by module.
**REQ-REM-004** The notification centre SHALL allow filter by module, mark all read, and jump to the record.
**REQ-REM-005** Each notification type SHALL have a default rule shipped by its plugin; the PM can override it.
**REQ-REM-006** Reminders SHALL be processed by background jobs (BullMQ) with retry and a delivery log.

### 8.7 Shared Services

#### 8.7.1 Audit Trail
Every create/update/delete/approve/login/export, with user, timestamp (UTC + local), IP, old/new values. Immutable (append-only); searchable by PM; exportable. Retention ≥ project life + 5 years (configurable).

#### 8.7.2 Files & Attachments
Drag & drop, multiple files, up to 200 MB per file (configurable), virus scan (ClamAV), image thumbnails, PDF preview, photo capture on mobile with geotag/timestamp, version history, "link to EDMS document" instead of upload.

#### 8.7.3 Comments, Mentions, Follow
Threaded comments on every record; @user/@group; Internal vs Shared (client-visible); follow/unfollow a record; activity feed per record and per project.

#### 8.7.4 Workflow Engine
- Configurable status sets and transitions per record type (e.g. MOC: Draft → Submitted → Technical Review → Impact Assessment → PM Approval → COMPANY Approval → Implementation → Closed).
- Transition conditions (required fields, required attachments, all actions closed).
- Approval steps: single, sequential, parallel, "any of group"; e-signature (password re-entry) for formal approvals [P2].
- SLA per step feeding the reminder engine.
- Visual workflow editor [P3]; P1 uses form-based configuration.

#### 8.7.5 Global Search
Search across all records (number, title, tag, description, comments), with module facets and permission-filtered results; recent searches; results < 500 ms.

#### 8.7.6 Import / Export
- Every register: Excel template download → upload → column mapping → validation preview (errors per row) → commit; import history with rollback of the last import [P2].
- Export: current view (filters & columns) to Excel / CSV / PDF.
- P6 XER/XML import for activities, WBS, baseline and actual dates (§12).

#### 8.7.7 Custom Fields
PM can add custom fields to most record types (text, long text, number, date, list, multi-list, user, link) with permissions per field — [P2].

---

## 9. Common Data Model & Progress Measurement

### 9.1 Core Entities (shared by all plugins)
| Entity | Key fields | Used by |
|---|---|---|
| **Project** | id, code, name, company, contract, dates, calendar, cut-off rules | All |
| **Party** | id, type (COMPANY / CONTRACTOR / Subcontractor / Vendor / 3rd party), name, contacts | Interface, Subcon, Procurement, Stakeholders |
| **Facility / Area** | id, facility (Jacket, Topside…), module, level/deck, area, zone, coordinates on layout | Construction, Layouts, Workfront, Comm. |
| **Discipline** | id, code, name, colour, lead | All |
| **WBS Node** | id, parent, code, name, weight, P6 WBS id | Planning, Progress |
| **Work Package** | §8.4.4 | Engineering, Planning, Construction, T&I, HUC |
| **Activity** | id, WP, P6 activity id, baseline/forecast/actual dates, % complete, float, critical flag | Planning, Milestones, Sequences |
| **Milestone** | id, type (contractual / key / internal), baseline, forecast, actual, weight, payment link | Planning, Dashboard |
| **Document** | id, doc no., title, rev, status, discipline, type, EDMS link, client code (A/B/C) | Engineering, Reports, all (links) |
| **Tag** | tag no., type (equipment, line, cable, instrument, valve, structure), system, subsystem, area | Construction, Comm., QAQC, Materials |
| **System / Subsystem** | code, description, priority, MC/RFC/RFSU target dates | Commissioning, HUC |
| **Item of Work (quantity)** | e.g. spool, weld inch-dia, tonnage, cable metres, terminations; unit, budget qty, earned qty | Construction, Productivity |
| **Action** | id, source record, description, owner, due, status | All registers, MoM, Events |
| **Link** | from (entity, id) → to (entity, id), relation type | All |
| **Attachment / Comment / Audit** | shared services | All |

### 9.2 Progress Measurement Framework
Progress SHALL be computed consistently across modules:

1. **Item level:** progress of an item = Σ (step weight × step complete) according to the **Rules of Credit**.
2. **WP level:** WP % = Σ (item budget weight × item %) / Σ item budget weight. Budget weight = man-hours (preferred), tonnage, or equal weights (configurable).
3. **Discipline / Phase level:** weighted roll-up of WPs.
4. **Overall project:** Σ (phase weight × phase %) — e.g. Engineering 8 %, Procurement 30 %, Construction 45 %, Commissioning 5 %, T&I 7 %, HUC 5 % (configurable).

#### 9.2.1 Default Rules of Credit (editable)
| Discipline | Item | Steps (weight) |
|---|---|---|
| Engineering | Deliverable (drawing/doc) | Started 10 % · IDC 30 % · IFR 60 % · IFA/Re-issue 80 % · AFC/IFC 100 % |
| Procurement | PO package | MR issued 10 % · PO placed 20 % · Vendor docs approved 35 % · Manufacturing 60 % · FAT 75 % · Shipped 90 % · Received on site 100 % |
| Structural | Primary/secondary steel (tonnage) | Material received 5 % · Cutting/Fit-up 35 % · Welding 70 % · NDT 85 % · Painting 95 % · Erected 100 % |
| Piping | Spool (dia-inch) | Spool fabricated 50 % (fit-up 20 %, welding 25 %, NDT 5 %) · Erected 30 % · Field welds 10 % · Supports 5 % · Test 5 % |
| Mechanical | Equipment (each, weighted by mass) | Received 10 % · Set in place 40 % · Aligned/levelled 70 % · Grouted/bolted 85 % · Ready for pre-com 100 % |
| Electrical | Cable (m) / terminations | Tray installed 20 % · Cable pulled 50 % · Glanded/terminated 85 % · Tested 100 % |
| Instrument | Loop / instrument | Installed 40 % · Tubing/hook-up 70 % · Calibrated 85 % · Loop checked 100 % |
| Commissioning | Subsystem | A-sheets 40 % · B-sheets 70 % · C-sheets 90 % · Handover 100 % |

#### 9.2.2 Planned Curves
- Planned values come from the P6 baseline (time-phased, weekly) and can be overridden by an Excel-imported curve per WP.
- The system stores **Baseline (approved)**, **Re-baseline(s)**, **Forecast** and **Actual** curves per cut-off.
- Period locking: once the PM approves a weekly cut-off, reported actuals for that period become read-only (corrections recorded as adjustments in the next period with comment).

---

## 10. Functional Module Specifications

Each module section follows the same structure: **Purpose · Phase · Screens · Data · Functions · KPIs · Client access · Settings · Integrations**.

---

### 10.1 Dashboard (`dashboard`) — [P1]

**Purpose:** a configurable one-page overview for each role.

**Screens**
| Screen | Description |
|---|---|
| My Dashboard | Personal layout; widgets from any enabled plugin the user can access |
| Project Dashboard | Standard layout set by the PM per role (PM, Manager, Leader, Team Member, Client) |
| Module Dashboards | Each module has a dashboard tab (e.g. Procurement dashboard) |
| TV mode | Full-screen rotation of selected dashboards [P2] |

**Default PM dashboard (top to bottom)**
1. **Header strip:** project name, phase, cut-off week, days to next key milestone, overall RAG.
2. **KPI cards (6):** Overall progress plan vs actual (Δ %), SPI, Milestones achieved / due, Open critical risks, Overdue interface queries, HSE: man-hours without LTI.
3. **Overall S-curve** (plan, actual, forecast) + **Phase progress bars** (E, P, C, Comm., T&I, HUC).
4. **Milestone timeline** (next 12 weeks) with RAG.
5. **Discipline construction progress** (Structural, Piping, Mechanical, E&I) — bar chart plan vs actual.
6. **Procurement status** donut (POs by stage) + **late deliveries vs RoS** table.
7. **Top 5 risks** (heat map mini) & **Top 5 issues**.
8. **Interface status** (open / overdue / closed, by party).
9. **Commissioning**: check-sheets & punch A/B progress.
10. **Upcoming events / meetings** (7 days).
11. **My actions** (assigned to me, overdue first).

**Functions**
- REQ-DSH-001 12-column grid; widgets drag/resize; add from the widget library; per-widget filters (discipline, facility, party, date range).
- REQ-DSH-002 Click-through from any chart element to the filtered register.
- REQ-DSH-003 PM can publish layouts as role defaults; users can reset to default.
- REQ-DSH-004 Data refresh: on load + every 5 min + real-time for notifications; "Data as of" timestamp per widget.
- REQ-DSH-005 Export dashboard to PDF (A3 landscape) and PNG; schedule e-mail of the dashboard snapshot weekly [P2].
- REQ-DSH-006 Client dashboard uses only widgets marked "Client-safe" and released records.
- REQ-DSH-007 Narrative widget: PM writes the weekly "Highlights / Lowlights / Look-ahead" text shown on the dashboard and included in reports.

---

### 10.2 EPCIC – Engineering (`engineering.workpackages`) — [P1]

**Purpose:** track engineering work packages, deliverables (MDR), client review cycles and engineering progress.

**Screens:** Engineering Dashboard · Work Packages (configured in Settings) · Deliverables Register (MDR) · Client Review Tracker · Engineering Queries (TQ) [P2] · Vendor Document Review (VDRL) [P2].

**Data – Deliverable**
Doc no., title, WP, discipline, document type, originator, planned/forecast/actual dates per milestone (IDC, IFR, IFA, AFC), current revision, status, COMPANY review code (1 Approved / 2 Approved with comments / 3 Revise & resubmit / 4 Information only), review due date, days in review, man-hour budget, earned %, EDMS link, holds.

**Functions**
- REQ-ENG-001 WP list (from §8.4.4) with progress roll-up, deliverable counts by status and S-curve per WP.
- REQ-ENG-002 Import MDR from Excel/EDMS export; incremental update by doc no.
- REQ-ENG-003 Progress computed automatically from ROC steps; manual override with justification (audited).
- REQ-ENG-004 Client review tracker: transmittal date, review due (configurable, default 10 working days), overdue COMPANY reviews highlighted in purple ("awaiting COMPANY").
- REQ-ENG-005 Holds list (HOLD items on drawings) with owner and target release date.
- REQ-ENG-006 Look-ahead: deliverables due in next 2/4 weeks per discipline.
- REQ-ENG-007 Link deliverables to MRs (procurement), interfaces and MOCs.

**KPIs:** Engineering progress plan vs actual; deliverables issued vs plan (IFR, AFC); % first-time approval (code 1/2); average COMPANY review time; overdue reviews; number of holds; TQ ageing.

**Client access:** Engineering progress summary and deliverable status (released) — configurable; default hidden.

---

### 10.3 EPCIC – Procurement

#### 10.3.1 Procurement Plan (`procurement.plan`) — **[P1]**
**Purpose:** plan and monitor every procurement package from MR to PO award against required-on-site (RoS) dates.

**Data – Procurement Package**
Package no., description, discipline, category (long-lead / bulk / equipment / service), MR no., responsible buyer, package engineer, estimated value (hidden from Client), currency, ASL vendors invited, bid strategy, planned/forecast/actual dates for: MR issue → ITB issue → bid closing → TBE → CBE → recommendation → COMPANY approval (if required) → PO award; delivery lead time; RoS date (from construction schedule); float = RoS − (PO date + lead time + shipping); status; risk flag.

**Screens:** Procurement Plan grid (Gantt mini-bars per package) · Package detail (timeline of steps, bidders list, TBE/CBE status, documents) · Procurement Dashboard.

**Functions**
- REQ-PRC-001 Plan dates generated backwards from the RoS using standard durations per category (configurable templates).
- REQ-PRC-002 Float calculation and RAG: Green ≥ 4 weeks, Amber 0–4 weeks, Red < 0 (configurable).
- REQ-PRC-003 Bidder tracking: invited, declined, received, technically acceptable, commercially ranked (commercial data permission-restricted).
- REQ-PRC-004 COMPANY approval step optional per package, with Client respond/approve button when enabled.
- REQ-PRC-005 Long-lead items flagged and shown on the dashboard.
- REQ-PRC-006 Import plan from Excel; link to MR deliverables in Engineering.

**KPIs:** POs placed vs plan (count and value); packages with negative float; average MR-to-PO cycle time; procurement progress %.

#### 10.3.2 Expediting (`procurement.expediting`) — **[P1]**
**Purpose:** follow each PO from award to delivery, including vendor documents, manufacturing milestones, inspection and shipping.

**Data – PO Line / Expediting Record**
PO no., vendor, items/tag nos., quantity, PO date, contractual delivery (Incoterm, place), RoS, vendor milestone schedule (drawings submitted, materials ordered, manufacturing start, key manufacturing steps, FAT, ready for shipment, shipped, ETA, delivered), planned/forecast/actual per milestone, vendor document status (VDRL % approved), inspection (ITP holds, inspection release note), expeditor, last contact date, next visit, comments, concerns.

**Screens:** Expediting register · PO detail (milestone timeline baseline vs forecast; vendor docs; inspection; history of contact logs) · Expediting dashboard · Vendor scorecard [P2].

**Functions**
- REQ-EXP-001 Milestone template per item type; PO progress from milestone weights (ROC §9.2.1).
- REQ-EXP-002 Forecast delivery vs RoS comparison; automatic alert if forecast > RoS (notification type "Delivery alert").
- REQ-EXP-003 Contact log: date, method (call / email / visit), summary, next action — creates reminders.
- REQ-EXP-004 Weekly expediting report (Excel/PDF) generated in one click.
- REQ-EXP-005 Vendor portal access as a custom role to update milestones — [P3].
- REQ-EXP-006 Link POs to Logistics shipments and Materials receipts when those plugins are enabled.

**KPIs:** POs on time / late; items forecast late to RoS; average slippage (days); FAT completed vs plan; VDRL approval %.

#### 10.3.3 Logistics (`procurement.logistics`) — **[P2]**
**Purpose:** manage shipments from vendor to yard/site, including customs and transport.

**Data – Shipment:** shipment no., PO(s), packing lists, mode (sea/air/road), forwarder, Incoterm, origin, port of loading, port of discharge, ETD/ATD, ETA/ATA, customs declaration status, import permits, duties status, delivery to yard, number of packages, weight/volume, heavy-lift flag, damage reports, documents (B/L, AWB, CO, CQ, invoices).

**Functions:** shipment tracking timeline; status board (Booked → Shipped → In transit → Arrived → Customs cleared → Delivered); delay alerts; heavy/oversize cargo list; customs document checklist; link to Materials receipt; logistics dashboard (shipments in transit, at port, delayed).

**KPIs:** on-time delivery to yard; average customs clearance time; demurrage days; damage incidents.

#### 10.3.4 Materials (`procurement.materials`) — **[P2]**
**Purpose:** material control from MTO to issue to construction.

**Data:** MTO items (commodity code, size, schedule, material grade, quantity per revision), PO coverage, receipt (MRR – material receiving report), heat no./MTC, warehouse location, OS&D (over/short/damaged) reports, reservations per WP, material issue requests (MIR) / issue notes, returns, surplus.

**Functions:** MTO revision comparison; material availability check per WP / workfront ("% material available"); shortage list; receiving with QR/barcode labels; warehouse location map; traceability (heat no. → spool/structure); issue against WP; surplus/scrap register; link to QAQC (MTC review) and Construction workfront readiness.

**KPIs:** % MTO covered by PO; % received; % issued; shortage count by WP; OS&D open; inventory accuracy.

---

### 10.4 EPCIC – Planning & Progress

#### 10.4.1 Overall Progress (`planning.overall`) — **[P1]**
**Purpose:** authoritative project progress at each cut-off.

**Screens**
- **Overall S-curve**: planned (baseline / re-baseline), actual, forecast; periodic bars; toggles for early/late curves; cut-off marker.
- **Progress table**: WBS levels (Overall → Phase → Facility → Discipline → WP) with weight, plan % (cumulative, period), actual %, variance, SPI, trend arrow (vs last period).
- **Phase cards**: E / P / C / Pre-com & Comm. / T&I / HUC.
- **Weekly cut-off workflow**: data collection status by WP ("updated / not updated"), Planner review, PM approval & lock.
- **Variance analysis**: list of WPs with variance < −2 % (configurable) requiring a cause & recovery comment.

**Functions**
- REQ-PRG-001 Import P6 baseline & updates (XER/XML) and/or Excel curves.
- REQ-PRG-002 Automatic roll-up from module progress (engineering, procurement, construction, comm.) where plugins are enabled; manual entry for others.
- REQ-PRG-003 Cut-off workflow with lock and versioned snapshots; compare any two snapshots.
- REQ-PRG-004 Forecast methods: P6 forecast import, or linear/SPI-based projection (shown as "indicative").
- REQ-PRG-005 Export weekly/monthly progress report package (S-curves + tables) to PDF/Excel/PPT-ready images.

**KPIs:** overall plan/actual/variance, SPI, period progress achieved vs planned, forecast completion date.

**Client access:** Overall S-curve, phase progress, milestone table (released snapshot only — clients never see unapproved data).

#### 10.4.2 Work Packages (`planning.workpackages`) — [P1]
**Purpose:** planning view of all WPs (shared master from Settings §8.4.4).

**Functions:** WP list with weights, progress, dates (baseline/forecast/actual), float, critical flag; WP detail with activities (from P6), S-curve, progress history, linked risks/issues/interfaces; weight validation; WP look-ahead (3-week / 6-week) list; WP status reporting comment per cut-off.

#### 10.4.3 Milestones (`planning.milestones`) — **[P1]**
**Data:** milestone ID, name, type (Contractual / Key / Payment / Internal), facility, baseline date, contractual date, forecast, actual, status (Achieved / On track / At risk / Late), variance (days), weight/payment %, LD applicable (hidden from Client), evidence/certificate attachment, COMPANY acknowledgement.

**Screens:** Milestone list · Milestone timeline (swim-lanes by facility/phase; diamonds baseline vs forecast; today line) · Milestone trend chart ("slip chart": forecast date over reporting periods).

**Functions**
- REQ-MLS-001 Import from P6 milestones; manual creation.
- REQ-MLS-002 Alert when forecast slips > N days vs baseline or vs last period.
- REQ-MLS-003 Milestone achievement workflow: proposed by Planner → evidence attached → PM confirms → COMPANY acknowledges (Client button, optional).
- REQ-MLS-004 Milestone trend (slip) chart per milestone and for the key milestone set.

**KPIs:** milestones achieved on time %, upcoming milestones (30/60/90 days), average slippage.

---

### 10.5 EPCIC – Construction

#### 10.5.1 Yard Layout (`construction.yard`) — [P2]
**Purpose:** interactive map of the fabrication yard showing where each structure/module is being built and what occupies each area.

**Functions**
- Upload yard plan (PDF/PNG/SVG; DWG via conversion) and calibrate scale.
- Draw **zones** (fabrication bays, assembly areas, skid-ways, laydown, blasting/painting shops, pipe shop, warehouse, load-out quay) with capacity (m², crane SWL).
- Place **objects** (jacket, topside modules, bridge, piles, large equipment) with footprint and planned occupation period.
- **Time slider** to see layout by week (planned occupation) — conflicts highlighted (two objects overlapping in time & space).
- **Crane & equipment layer**: crawler cranes, positions, capacity charts link [P3].
- Colour by status / discipline / responsible party; click object → WP progress, workfront, issues.
- Export layout snapshot as PNG/PDF for reports.

**KPIs:** yard space utilisation %, area conflicts, laydown occupancy.

#### 10.5.2 Facility Layout (`construction.facility`) — **[P3]**
**Purpose:** level-by-level views of each facility (e.g. Topside Cellar Deck, Mezzanine, Main Deck, Weather Deck; Jacket elevations/rows) showing progress by area.

**Functions:** upload elevation/plot plans per level; define areas/rooms; heat-map colouring by % complete per discipline; overlays for punch items, open NCRs, check-sheet status, workfront availability; drill-down to tags in an area; compare two dates (progress delta) ; optional 3D model link (P4).

#### 10.5.3 Workfront (`construction.workfront`) — [P2]
**Purpose:** ensure work can start: all constraints removed before crews are assigned.

**Data – Workfront:** ID, area/facility/level, WP, discipline, planned start/finish, constraint checklist (AFC drawings available, material available %, previous trade complete, access/scaffolding, permits, equipment/crane, manpower, QA hold points released, MOC impact), readiness % , status (Not ready / Ready / Released / In progress / Completed / Handed to next trade), responsible supervisor, crew size.

**Functions**
- Constraint management with owners and due dates (feeds reminders).
- **Look-ahead board** (3-week): workfronts by week with readiness colour.
- Handover between trades (e.g. Structural → Piping → E&I → Painting) with acceptance by receiving supervisor.
- Visualise workfronts on Yard/Facility layout.
- Integration: materials availability (Materials plugin), drawing status (Engineering), QA hold points (QAQC).

**KPIs:** workfront readiness %, constraints overdue, workfronts released vs plan, idle-crew risk count.

#### 10.5.4 Construction Sequence (`construction.sequence`) — **[P3]**
**Purpose:** visualise and communicate the build sequence (e.g. jacket roll-up, topside module stacking, deck lifts, major equipment setting).

**Functions:** sequence steps with images/sketches, durations, predecessors, crane/lift references, linked WP/activities; animated step-by-step playback on the yard/facility layout; Gantt view; compare planned vs actual sequence; export as a PDF storyboard for COMPANY presentations; link to major lift plans and method statements (documents).

#### 10.5.5 Construction Progress & KPI (`construction.progress`) — [P1]
**Purpose:** quantity-based progress per discipline with ROC (§9.2.1).

**Disciplines (tabs):** **Structural · Piping · Mechanical · E&I** (Electrical and Instrument as sub-tabs), plus configurable others (Painting, Insulation, Architectural/HVAC, Telecom).

**Data by discipline**
| Discipline | Units & quantities tracked |
|---|---|
| Structural | Tonnage by type (primary, secondary, tertiary), assemblies, pre-fabricated panels, erection lifts; fit-up/welding/NDT/painting steps |
| Piping | Spools (no.), dia-inch (shop & field), weld count, supports (no./kg), test packs (no.), reinstatement |
| Mechanical | Equipment items (no. & tonnes), packages, alignment, grouting |
| Electrical | Cable tray (m), cable pulled (m), glands/terminations (no.), equipment, lighting, earthing |
| Instrument | Instruments installed (no.), tubing (m), JBs, cables, loop checks |

**Screens:** discipline progress grid (WP × step, budget qty, earned qty, %), period entry form (bulk inline), S-curve per discipline, quantity charts (installed vs plan weekly), weekly report.

**Functions**
- REQ-CON-001 Progress entry by Leaders via grid or Excel import (by item ID).
- REQ-CON-002 Item-level import from fabrication tracking systems (e.g. spool tracking), CSV/Excel.
- REQ-CON-003 Earned man-hours = budget man-hours × % complete; feeds Productivity.
- REQ-CON-004 Validation: progress cannot exceed 100 %, cannot decrease without reason code.
- REQ-CON-005 Cut-off reminder to Leaders 24 h before cut-off for items not updated.

**KPIs (per discipline):** plan vs actual %, quantities installed per week vs plan, remaining quantities, SPI, weld repair rate (from QAQC), dia-inch per week, tonnes per week.

#### 10.5.6 Productivity (`construction.productivity`) — [P2]
**Purpose:** measure labour efficiency.

**Data:** daily/weekly manpower by discipline/craft (direct/indirect), actual man-hours (timesheet import), earned man-hours (from progress), norms (unit rates, e.g. MH/tonne, MH/dia-inch), weather/downtime, overtime.

**Functions:** Productivity Factor **PF = Earned MH ÷ Actual MH** (≥ 1.0 good); unit rate actual vs norm; manpower histogram plan vs actual; productivity trend per discipline; direct/indirect ratio; lost-time causes (waiting material, drawings, permits, weather) captured for analytics; forecast of man-hours to complete (MH remaining / PF).

**KPIs:** PF per discipline, unit rates, manpower plan vs actual, % idle time, overtime %.

---

### 10.6 EPCIC – Fabrication Subcontracting

#### 10.6.1 Subcontractor Progress (`subcon.progress`) — [P2]
**Purpose:** monitor fabrication subcontractors (e.g. piping spools, skids, secondary structures, painting, scaffolding, E&I installation).

**Data:** subcontract no., subcontractor, scope, WPs, contract value (restricted), start/finish, ROC/weights, planned curve, reported progress (by subcontractor), verified progress (by CONTRACTOR), manpower, key quantities, deliveries to main yard, quality indicators (NCRs, weld repair rate), HSE stats, invoice milestones (restricted).

**Functions**
- Subcontractor submits weekly progress (custom "Subcontractor" role, P3; in P2 entered by CONTRACTOR coordinator).
- Verification step: reported vs verified progress with comments.
- S-curve per subcontractor; ranking of subcontractors; delivery schedule vs main-yard need dates.
- Subcontractor scorecard (schedule, quality, HSE, responsiveness) — feeds Lessons Learned and ASL evaluation.

#### 10.6.2 Subcontractor Concerns & Highlights (`subcon.concerns`) — [P2]
**Data:** entry type (Concern / Highlight / Achievement), subcontractor, date, category (schedule, manpower, quality, HSE, commercial, material, drawings), description, impact, action, owner, due date, status, escalation level, photos.

**Functions:** weekly concerns list per subcontractor; escalation to Manager/PM; convert a concern into an Issue or Risk (one click, with link); highlights feed for weekly report; agenda auto-generation for subcontractor progress meetings (links to MoM).

**KPIs:** open concerns by subcontractor & ageing, escalated concerns, closure rate.

---

### 10.7 EPCIC – Onshore Pre-commissioning & Commissioning

#### 10.7.1 Systems & Subsystems Highlight (`comm.systems`) — [P2]
**Data:** system/subsystem code, description, facility, priority (commissioning sequence order), boundaries (marked-up P&IDs as attachments), tag count, test packs, A/B/C check-sheet counts, punch counts, target and actual dates for MC, RFC, pre-com complete, commissioning complete, ready for handover, responsible commissioning engineer, status.

**Screens:** system tree (system → subsystem → tags); **subsystem status board** (cards coloured by stage); highlights (top concerns per system, completed this week).

**Functions:** import system/subsystem/tag register (Excel or completions system export); completion dossier status; "walkdown" scheduling; link to punch and check-sheets.

#### 10.7.2 Commissioning Sequence (`comm.sequence`) — [P3]
**Functions:** define commissioning order by subsystem with dependencies (utilities first: power generation, instrument air, firewater…); timeline view; readiness check ("can start?" based on MC status, punch A count = 0, documentation); playback on facility layout; what-if if a subsystem slips.

#### 10.7.3 Handover Schedule (`comm.handover`) — [P2]
**Data:** handover unit (system / subsystem / facility), planned/forecast/actual handover date, prerequisites checklist (A/B sheets complete, punch A closed, documentation dossier, COMPANY walkdown done), certificate type (MC certificate, RFC, RFSU, Handover certificate), signatures (CONTRACTOR, COMPANY).

**Functions:** handover timeline; prerequisites % ; certificate workflow with COMPANY acceptance (Client "Accept / Reject with comments" button); outstanding items list attached to certificates; export certificates to PDF.

**Client access:** Handover schedule (default visible), certificate acceptance (configurable).

#### 10.7.4 Check-sheet Progress & KPI (`comm.checksheets`) — [P2]
**Data:** check-sheet no., type (A = construction/MC, B = pre-commissioning, C = commissioning), discipline, tag, subsystem, form template, status (Not started / In progress / Completed / Accepted by COMPANY), dates, inspector, signatures.

**Functions:** import from completions system; bulk status update; progress by subsystem/discipline/type; burn-down chart (remaining sheets) plan vs actual; mobile completion of simple sheets with photo [P3].

**KPIs:** A/B/C % complete per subsystem & discipline, sheets completed per week vs required rate, sheets awaiting COMPANY acceptance.

#### 10.7.5 Punch Closing Progress & KPI (`comm.punch`) — [P2]
**Data:** punch no., category (A / B / C), tag, subsystem, area, discipline, description, raised by (CONTRACTOR / COMPANY), raised date, responsible party, target date, cleared date, verified (COMPANY) date, status (Open / Cleared / Verified / Closed / Rejected), photos before/after.

**Functions:** mobile punch capture (photo, location on facility layout); bulk assignment; **punch burn-down** (raised vs closed cumulative, by category); ageing analysis; punch walkdown lists per subsystem (printable); verification by COMPANY (Client button); blocking rule — Cat A open > 0 blocks handover certificate.

**KPIs:** open punch A/B/C by subsystem, discipline and party; closure rate per week; average age; % verified.

---

### 10.8 EPCIC – QAQC (`qaqc`) — [P2]
**Purpose:** quality control and assurance records linked to construction and commissioning.

**Sub-screens**
| Sub-screen | Content |
|---|---|
| ITP & Inspection Requests | ITP register per WP; inspection requests (IR/RFI) with hold (H), witness (W), review (R) points for CONTRACTOR / COMPANY / Third party (Class / CA); scheduling; results; Client "Attend / Accept" button |
| NCR Register | NCR no., source (yard / vendor / subcontractor), category, description, root cause, disposition (use-as-is / repair / rework / reject), corrective & preventive action, owner, due, status, COMPANY approval for use-as-is |
| Welding & NDT | Welder qualification register (WPQ expiry reminders), WPS/PQR library links, weld log summary (from imports), NDT requests/results, **weld repair rate** per welder / discipline / subcontractor |
| Material traceability | MTC review status (links to Materials) |
| Calibration | Calibrated equipment register with expiry reminders |
| Audits | QA audit schedule, findings, actions |
| Dossiers | Quality dossier (MDR/MRB) compilation status per system/WP |

**KPIs:** inspections passed first time %, open NCRs & ageing, weld repair rate (target < 2 %), NDT backlog, audit findings closed, dossier completeness %.

**Client access:** inspection notifications and selected NCRs (configurable).

---

### 10.9 EPCIC – HSE (`hse`) — [P2]
**Sub-screens**
| Sub-screen | Content |
|---|---|
| HSE Statistics | Man-hours (monthly, cumulative), LTI, RWC, MTC, FAC, near misses, first aid; frequency rates (LTIF, TRCF per 1,000,000 MH or 200,000 MH – configurable); days/man-hours since last LTI |
| Incident reporting | Initial report (mobile), classification, investigation (5-Why / root cause), actions, lessons learned link; restricted visibility for personal data |
| Observations (UA/UC) | Unsafe act/condition and positive observations cards; mobile capture with photo & location; trend by area/contractor |
| Permit to Work (summary) | Active permits by type and area (link/sync to PTW system, P3) |
| HSE Inspections & Audits | Schedule, findings, actions |
| Training & Competence | Induction, certifications with expiry reminders (link to user/worker list) |
| HSE Leading Indicators | Toolbox talks, drills, inspections, observations rates |

**KPIs:** LTIF, TRCF, man-hours without LTI, observation closure rate, leading-indicator scorecard.

**Client access:** HSE statistics dashboard (default visible); incident details hidden unless released.

---

### 10.10 EPCIC – Transportation & Installation (T&I) — [P3]
**Purpose:** plan and monitor load-out, sea-fastening, transportation and offshore installation of jacket, piles, topside, bridges, etc.

#### 10.10.1 T&I Workpacks (`ti.workpacks`)
**Data:** workpack no., title (e.g. "Jacket Load-out", "Sea-fastening", "Tow to Field", "Jacket Launch/Lift & Upending", "Pile Installation", "Topside Float-over/Lift", "Bridge Installation"), structure, method (skidding / SPMT / lift / launch / float-over), engineering documents (analyses, procedures, drawings – document links), weather criteria (Hs, wind, current), vessels/equipment required, MWS (Marine Warranty Surveyor) approval status, HAZID/HAZOP status, readiness checklist, responsible engineer.

**Functions:** workpack readiness tracking (procedures approved, MWS COA obtained, equipment certified, vessel available, personnel), document checklist with status, link to Marine Spread (HUC), risk & MOC links.

#### 10.10.2 T&I Timeline & Schedule (`ti.schedule`)
Gantt of T&I campaign (yard load-out → sail-away → offshore installation), weather windows overlay (seasonal monsoon periods configurable, e.g. NE monsoon), vessel mobilisation/demobilisation, baseline vs forecast, critical path, key milestones (Load-out, Sail-away, Jacket set-down, Topside installed).

#### 10.10.3 T&I Sequence (`ti.sequence`)
Step-by-step operational sequence (e.g. ballast stages, skid steps, lifting sequence, rigging) with diagrams; hold points (MWS, COMPANY); weather go/no-go checkpoints; playback/storyboard export.

#### 10.10.4 T&I Progress (`ti.progress`)
Progress by workpack (weighted steps: Engineering done / Procedures approved / Preparation / Execution / Completed); **daily operations report** entry (offshore DPR: activities, weather, downtime with causes, vessel status, personnel on board); downtime analysis (weather / equipment / waiting); comparison planned vs actual duration per step.

**KPIs:** T&I readiness %, campaign progress %, operational vs weather downtime, schedule variance (days) vs installation window.

---

### 10.11 EPCIC – Offshore Hook-up & Commissioning (HUC) — [P3]

#### 10.11.1 Marine Spread (`huc.marine`)
**Data:** vessels (accommodation work barge, crane barge, tugs, supply/crew boats, DSV, walk-to-work), owner, charter dates (on/off hire), day-rate (restricted), capacity (POB, crane SWL, deck space), certifications/expiry, location, status, utilisation.
**Functions:** marine spread timeline (Gantt per vessel), on/off-hire tracking, POB planning vs bed capacity, vessel daily status, SIMOPS matrix link, mobilisation checklists.

#### 10.11.2 HUC Timeline & Schedule (`huc.schedule`)
Offshore HUC schedule by system/subsystem and work package (hook-up, tie-ins, carry-over work from yard, offshore pre-com & commissioning, first oil/gas readiness); campaign timeline; carry-over work list from onshore (transferred punch & check-sheets); weather windows; critical milestones (Mechanical completion offshore, RFSU, First Gas/Oil).

#### 10.11.3 HUC Progress (`huc.progress`)
Progress by discipline & system (same ROC framework); offshore daily progress report (DPR) entry; manpower POB by discipline; offshore punch & check-sheet status (re-uses `comm.*` data with location = offshore); productivity offshore (PF); downtime causes.

**KPIs:** HUC progress plan vs actual, carry-over work remaining (MH), punch A offshore, POB utilisation, vessel utilisation, days to first gas/oil.

**Client access:** HUC timeline and progress summary (default visible).

---

### 10.12 Management Registers
All registers share the **Register pattern** (§7.3): list + drawer, saved views, Excel import/export, linking, comments, history, reminders, workflow, dashboards.

#### 10.12.1 Risk Register (`mgmt.risk`) — [P1]
**Data:** risk ID, title, description (cause → event → consequence), category (technical, schedule, commercial, HSE, interface, procurement, construction, marine, regulatory), WBS/WP, facility, owner, date raised, **pre-mitigation** probability (1–5) & impact (1–5 for cost, schedule, HSE, reputation; overall = max), score = P × I, rating (Low/Medium/High/Critical per thresholds), response strategy (avoid / mitigate / transfer / accept / exploit for opportunities), mitigation actions (owner, due, status), **post-mitigation** P/I/score, contingency (cost/time, restricted), trigger/early warning, status (Open / Closed / Occurred → becomes Issue), review date, trend vs last review.

**Screens:** register list, 5×5 heat map (pre/post toggle, click cell → filtered list), risk detail, risk trend (score over time), opportunities tab.
**Functions:** monthly review cycle with reminders to owners; "risk occurred" → converts into an Issue with link; quantitative fields for Monte-Carlo export (P4); top-10 risk report.
**KPIs:** number of risks by rating, high/critical open, overdue mitigation actions, risk exposure trend.

#### 10.12.2 Issue Register (`mgmt.issue`) — [P1]
**Data:** issue ID, title, description, type (technical, schedule, commercial, quality, HSE, interface, resource), priority (Low/Medium/High/Critical), impact (schedule days, cost), raised by, owner, assigned to, date raised, need-by date, actions, resolution, status (Open / In progress / Escalated / Resolved / Closed), escalation level (Leader → Manager → PM → COMPANY), source link (risk, interface, concern, MoM action).
**Functions:** Kanban + list; escalation workflow with automatic escalation by ageing; issue-to-MOC conversion; weekly top-issues report.
**KPIs:** open issues by priority, ageing, closure rate, escalated issues.

#### 10.12.3 Lesson Learned Register (`mgmt.lessons`) — [P2]
**Data:** LL ID, title, project phase, discipline, category, what happened, impact, root cause, recommendation, positive/negative, raised by, validation (Leader/Manager), applicability (all future projects / similar projects), keywords, attachments, status (Draft / Validated / Published / Implemented).
**Functions:** capture from issues/incidents/NCRs/MOCs ("Create lesson"); validation workflow; **cross-project library** (search lessons from other projects in the tenant); lessons review workshop mode (filter and vote); export to company LL database format.
**KPIs:** lessons captured per phase, % validated, % implemented.

#### 10.12.4 Management of Change (`mgmt.moc`) — [P2]
**Data:** MOC no., title, originator, date, change type (scope, design, schedule, procedure, organisation, vendor/material substitution), description, reason/justification, affected WPs/documents/tags/systems/interfaces, impact assessment by discipline (technical, HSE, schedule days, cost, quality, interfaces), risk assessment link, variation order flag (commercial, restricted), approvals, COMPANY approval required (Y/N), implementation actions, close-out verification, status.
**Workflow (default):** Draft → Submitted → Technical review (disciplines in parallel) → Impact assessment consolidated → PM approval → COMPANY approval (if required) → Implementation → Verification → Closed / Rejected / Cancelled.
**Functions:** discipline review tasks with SLA reminders; impact summary auto-calculated; links to documents to revise; MOC log report; Client approve/reject button when COMPANY approval is required.
**KPIs:** MOCs by status, average cycle time, overdue reviews, approved schedule/cost impact (restricted).

#### 10.12.5 Stakeholders Register (`mgmt.stakeholders`) — [P2]
**Data:** stakeholder, organisation, role, contact, category (COMPANY, partner, authority/regulator, class, MWS, subcontractor, vendor, community, internal management), interest (1–5), influence (1–5), current & desired engagement level (unaware / resistant / neutral / supportive / leading), key concerns, engagement strategy, communication plan (frequency, channel, owner), last contact, next contact (reminder).
**Screens:** register, **power/interest grid**, engagement assessment matrix, communication calendar.
**Access:** PM & Managers by default (sensitive).

---

### 10.13 Interface Management

#### 10.13.1 Interface Register & Interface Points (`interface.register`, `interface.points`) — [P1]
**Purpose:** manage all interfaces between parties (CONTRACTOR, COMPANY, other contractors such as drilling/pipeline/subsea/existing facilities operators, vendors, subcontractors) and internal interfaces between disciplines and packages.

**Concepts**
- **Interface Point (IP):** a defined physical or functional interface (e.g. "Riser tie-in flange at Jacket EL(+)…", "Power cable termination at existing platform switchboard", "Data exchange: pipeline design pressure").
- **Interface Query / Agreement (IQ/IA):** a request for information or agreement raised against an interface point, with response.

**Data – Interface Point:** IP no., title, description, interface type (physical / functional / organisational / contractual / information), category (structural, piping, E&I, process, marine, subsea, operations), parties A & B, facility/location, discipline, related documents/drawings, design freeze date, need date, owner (focal point each party), status (Identified / Defined / Agreed / Closed), criticality (High/Medium/Low), linked risks.

**Data – Interface Query/Agreement:** IQ no. (auto `{PROJ}-IQ-{FROM}-{TO}-{000}`), IP link, from party, to party, subject, query text, attachments, date issued, response required by (default 14 days, configurable per priority), priority, response text, response date, responder, status (Draft / Issued / Responded / Accepted / Closed / Rejected / Superseded), agreement statement, sign-off by both parties, revision history.

**Functions**
- REQ-INT-001 Interface Point & Query registers linked (one IP → many IQs).
- REQ-INT-002 Issue IQ to an external party → email notification with secure link; COMPANY users respond in the Client portal (Client "Respond" button).
- REQ-INT-003 Response due reminders, overdue escalation; ageing badges.
- REQ-INT-004 Interface agreement sign-off (both parties) with PDF certificate.
- REQ-INT-005 Interface Management Plan (IMP) document link and interface meeting agenda generation (open/overdue IQs by party) → links to MoM.
- REQ-INT-006 Bulk import from Excel interface register.
- REQ-INT-007 Link IPs/IQs to risks, issues, MOCs, documents, WPs, milestones (need-by dates derived from the schedule).
- REQ-INT-008 Interface dashboard: open/overdue by party, response time trend, critical open interfaces near need date.

**KPIs:** open/closed IQs, overdue IQs by party, average response time, % IPs agreed vs plan, critical interfaces at risk.

#### 10.13.2 Interface Matrix (`interface.matrix`) — [P1]
**Functions:** N×N matrix of parties (or disciplines / packages / facilities — selectable axes); cell shows count of IPs/IQs with heat colouring (open, overdue); click cell → filtered list; RACI responsibility matrix for interfaces (who is Responsible/Accountable/Consulted/Informed per interface category); export to Excel/PDF for the IMP.

---

### 10.14 Event Management (`events`) — [P2]
**Purpose:** plan and run project events: meetings, audits, FATs, inspections, COMPANY visits, workshops (HAZID/HAZOP, constructability, lessons learned), key ceremonies (steel cutting, load-out, sail-away, first gas), trainings, drills.

**Data:** event type, title, date/time (time zone), location (yard, office, vendor shop, offshore, online link), organiser, attendees (internal/external, required/optional), agenda, pre-read documents, logistics (transport, PPE, visitor registration, permits, catering), status (Planned / Confirmed / Completed / Cancelled / Postponed), outcome, linked MoM, actions, photos.

**Screens:** calendar (month/week/day/agenda), event list, event detail, recurring meetings (weekly progress meeting, interface meeting, HSE meeting), visitor list.

**Functions**
- Invitations (email with .ics; Outlook/Teams calendar sync [P3]).
- Reminders to attendees (24 h, 1 h).
- One click "Start MoM" from event → MoM pre-filled with attendees and agenda.
- Event checklist templates (e.g. "COMPANY Yard Visit", "FAT", "Load-out ceremony").
- Visitor management for yard visits (names, ID requirement flag only — no personal ID numbers stored, PPE, induction).
- Client visibility per event.

---

### 10.15 Reports

#### 10.15.1 Minutes of Meetings (`reports.mom`) — [P1]
**Data:** MoM no., meeting type, title, date, location, chairperson, attendees (with company, present/absent), agenda items, discussion per item, decisions, **action items** (no., description, owner, due date, status), attachments, previous actions review, distribution list, status (Draft / Issued for comments / Final / Signed).

**Functions**
- Templates per meeting type; carry forward open actions from the previous MoM of the same series.
- Rich text editing; real-time co-editing [P3].
- Action items flow into "My actions" with reminders and an Action Tracker (cross-MoM).
- Issue MoM to attendees (PDF, branded) → comment period → final; optional e-sign by COMPANY.
- Release to Client (Client sees final MoM and shared actions).
- Search across all MoMs (decisions, actions).

**KPIs:** open actions, overdue actions by owner/party, MoMs issued within 48 h.

#### 10.15.2 Documents (`reports.documents`) — [P1]
**Purpose:** project document register and report library (not a full EDMS).

**Functions:** document register (doc no., title, rev, type, discipline, originator, status, date, EDMS link or uploaded file); folders by category (Reports, Procedures, Plans, Correspondence, Certificates, Dossiers); version history; check-in/out [P3]; transmittals (simple) [P2]; **generated reports library** (weekly/monthly reports automatically stored by period); document release to Client; access per folder; preview PDF/Office/images.

#### 10.15.3 Analytics (`reports.analytics`) — [P2], advanced [P3]
**Functions**
- **Standard reports**: Weekly Progress Report, Monthly Progress Report (COMPANY format), Procurement/Expediting report, Construction report, Commissioning report, Interface report, Risk & Issue report, HSE report — configurable sections, cover, logos, narrative blocks, automatic charts; schedule & distribution.
- **Report builder**: choose data source (any plugin dataset the user can access), fields, filters, grouping, chart type; save & share [P3].
- **KPI library**: all KPIs from plugins with definition, formula, owner, target, thresholds; KPI trend over periods.
- **Cross-module insight**: e.g. late deliveries vs workfront constraints vs productivity; interface ageing vs milestone slippage.
- **Data export / BI connector**: read-only SQL views or OData feed for Power BI [P3].
- **AI assistant** (natural-language questions, weekly narrative draft, risk suggestions) — [P4], with permission-aware data access.

> **Rev. B note:** the controlled document registers (MDR, EMDR, transmittals, reviews) now sit in **Document Control (§10.17)**. *Reports → Documents* remains the library for project reports, procedures, plans and generated outputs. Engineering (§10.2) reads deliverable status and progress from Document Control rather than keeping its own copy.

---

### 10.16 Tasks Management (`tasks.personal`, `tasks.project`) — [P1] *(Rev. B)*

**Purpose:** one place where every person sees and manages **everything they have to do**. That covers their own to-dos, project tasks assigned by others, and every action where they are the **PIC** (person in charge) in any other module.

#### 10.16.1 Two Workspaces
| Workspace | Who sees it | Content |
|---|---|---|
| **Personal workspace** ("My Work") | Only the owner (unless shared) | Private to-dos and checklists; notes; personal reminders; **plus a read-through of all tasks and module actions assigned to me across all my projects** |
| **Project workspace** | Project members, according to module assignment and scope | Project task lists and boards (by WP, discipline, team, area, meeting series); tasks assigned to others; team workload |

- A personal task can be **moved to a project** (it then becomes visible to that project and can be assigned). A project task can never become private.
- Personal tasks are never visible to the PM or the Client; they are excluded from project analytics.

#### 10.16.2 Task Data
| Field | Notes |
|---|---|
| Task no. | `{PROJ}-TSK-{00000}` (project tasks); personal tasks un-numbered |
| Title, description | Rich text, @mentions |
| Type | Task · Action (from MoM/register) · Checklist · Milestone task · Approval · Recurring |
| **Assignee / PIC** | One accountable PIC (required for project tasks) + optional co-assignees |
| Requester / assigned by | Auto |
| Watchers | Users / groups notified of changes |
| Party | CONTRACTOR / COMPANY / Subcontractor / Vendor (for actions owed by another party) |
| Priority | Low · Normal · High · Urgent |
| Start, due date, reminder | Working calendar aware |
| Estimated / actual effort (h) | Optional; feeds the workload view |
| Status | To do · In progress · Waiting (on whom) · Done · Cancelled (configurable per project) |
| Progress % / checklist items | Sub-tasks and checklist lines with their own PIC and due date |
| Dependencies | Blocks / blocked by other tasks |
| Links | Any record: WP, document, PO, interface query, risk, issue, MOC, punch item, NCR, milestone, event, MoM item |
| Labels, discipline, area, WP | For filtering and boards |
| Visibility | Private · Project · **Shared with Client** (explicit) |
| Attachments, comments, history | Shared services |

#### 10.16.3 Linked Tasks — PIC Set Out in Other Modules
Each module that assigns a PIC publishes those items to the task service as **linked tasks**. The source record stays the single source of truth.

| Source module | Item that becomes a linked task for its PIC |
|---|---|
| Minutes of Meeting | Action items |
| Risk Register | Mitigation actions; risk review due |
| Issue Register | Issue resolution actions |
| Interface | Interface query responses due; agreement sign-off |
| MOC | Discipline review, impact assessment, implementation actions |
| Document Control | Documents to prepare / check / review; comments to resolve (CRS); transmittals to answer |
| Procurement / Expediting | Expediting next actions; PO milestone follow-ups |
| Construction / Workfront | Constraint removal actions |
| Commissioning | Punch items, check-sheets to complete |
| QAQC / HSE | NCR corrective actions; inspection requests; HSE observation and incident actions |
| Subcontracting | Concern actions |
| Events | Event preparation checklist items |
| Lessons Learned | Implementation actions |

- **REQ-TSK-001** Linked tasks SHALL sync both ways for the shared fields (PIC, due date, status, comments). Closing the task closes the source action when the source workflow allows it. Otherwise it is set to "Submitted for closure" and the owner verifies it.
- **REQ-TSK-002** Changing the PIC in the source module SHALL move the linked task to the new PIC's workspace and notify both people.
- **REQ-TSK-003** Linked tasks show a source badge (e.g. "MoM · ABC-MOM-WPM-034 · Item 5") and open the source record in the side drawer.
- **REQ-TSK-004** A user who loses access to the source module (§4.7) keeps seeing the task title and due date, but not the restricted details. The PM is told so the PIC can be reassigned.
- **REQ-TSK-005** PIC pickers in every module SHALL use the same component: search by name, project title, level, discipline, party or group, and show each person's current open-task load.

#### 10.16.4 Views & Functions
| Feature | Description |
|---|---|
| **My Day / This Week** | Overdue, due today, due this week, waiting on others; drag to plan the day |
| List · Board · Calendar · Timeline | Same data, four views; saved views (personal or shared to the project) |
| **Assigned by me** | Follow up what I delegated, with ageing |
| **Workload** | Per person and per week: open tasks and effort vs available hours; overloaded people highlighted; drag to reassign (Leader/Manager/PM) |
| Task templates | e.g. "Weekly cut-off checklist", "COMPANY visit preparation", "Load-out readiness", "Monthly report preparation" — generate a set of tasks with relative due dates |
| Recurring tasks | Daily / weekly / monthly / at each cut-off |
| Quick add | Natural input: "Send IQ reply to PL contractor @Minh fri #interface !high" |
| Email to task | Forward an email to a project address to create a task (P2) |
| Bulk actions | Assign, reschedule, change status, move to list |
| Delegation | Out-of-office routing of new assignments (§4.5) |
| Mobile | Quick add, tick off, photo attachment (PWA) |
| Reminders | Due soon, overdue, escalation rules from §8.6 |

**KPIs:** open/overdue tasks by person, team, party and source module; on-time completion %; average age; tasks waiting on COMPANY; workload balance.

**Client access:** only tasks explicitly "Shared with Client" or addressed to COMPANY as party; the Client can comment and mark them done (configurable).

---

### 10.17 Document Control (`doc.*`) — [P1 core, P2, P3] *(Rev. B)*

**Purpose:** control all project documents across every work package. That covers CONTRACTOR engineering documents (MDR), vendor and supplier documents (EMDR), and subcontractor documents. The module tracks their numbering, revisions, transmittals and review cycles with COMPANY, the **Certifying Authority (CA)**, the **Marine Warranty Surveyor (MWS)** and other third parties, through to the final documentation and as-built records.

#### 10.17.1 Registers
| Register | Scope | Organised by |
|---|---|---|
| **MDR** – Master Document Register | All CONTRACTOR deliverables (engineering, procedures, plans, T&I analyses, commissioning procedures…) | Work package → discipline → document type |
| **EMDR** – Equipment / Vendor Master Document Register (named "VDRL/SDRL" on some projects; label configurable) | Vendor documents required per PO / equipment package (drawings, datasheets, calculations, ITPs, FAT procedures, certificates, IOMs, MRB) | Procurement package / PO → vendor → tag |
| **Subcontractor Document Register** | Documents from fabrication and installation subcontractors (method statements, shop drawings, procedures, QC records) | Subcontract → WP |
| **Interface Document list** | Documents exchanged under interface agreements | Interface point (§10.13) |
| **Superseded / Void register** | Withdrawn numbers and revisions | Document |

Each register can be filtered to **one work package or many**, so each Package Engineer Lead manages "their" MDR and EMDR while the PM sees the project total.

#### 10.17.2 Document Data
Document no. (validated against the project numbering procedure: project – originator – facility – discipline – type – sequence, configurable), title, WP, discipline, document type, originator (CONTRACTOR / vendor / subcontractor), responsible engineer (PIC), checker, approver, PO / subcontract link, tags/systems, current revision, revision scheme (A, B, C… for review issues → 0, 1, 2… for approved issues; configurable), **issue purpose** (IDC, IFR, IFA, IFC/AFC, IFI, As-built), planned / forecast / actual date per issue, **review requirements** (COMPANY / CA / MWS / Class / Authority — from the review matrix), current review status and code per reviewer, days in review, hold flag, confidentiality, native file and PDF (or EDMS link), weight/man-hours for progress.

#### 10.17.3 Review Matrix (Document Distribution Matrix)
A project setting that defines **who must review which document type**:

| Document type (example) | COMPANY | CA | MWS | Class / Authority | Internal disciplines |
|---|---|---|---|---|---|
| Structural design report – jacket | Approve | Review / certify | Info | — | STR, MAR |
| Load-out procedure & analysis | Approve | Info | **Approve (COA required)** | — | MAR, STR, HSE |
| Sea-fastening design | Approve | — | **Approve** | — | MAR, STR |
| Lifting analysis & rigging | Approve | Review | **Approve** | — | MAR, STR |
| P&ID | Approve | Review | — | — | PRO, PIP, INS |
| Safety / fire-protection philosophy | Approve | **Review / certify** | — | Authority (if required) | SAF |
| Vendor datasheet | Review | — | — | — | Discipline lead |

- **REQ-DOC-001** When a document is created, its reviewers and review type SHALL be set automatically from the matrix and can be changed with a reason.
- **REQ-DOC-002** Reviewer review periods (days) SHALL be configurable per reviewer (e.g. COMPANY 10 WD, CA 15 WD, MWS 10 WD) and feed reminders and KPIs.

#### 10.17.4 Review Workflow
```
Draft → Internal check (IDC, parallel disciplines) → Approved for issue
      → Transmitted to reviewers (COMPANY / CA / MWS in parallel or sequence)
      → Comments received (per reviewer, with review code)
      → Comment Resolution Sheet (CRS) → Re-issued (next revision)
      → Approved / Certified / Accepted → IFC / AFC → As-built → Final documentation
```

| Reviewer | Typical outcome codes (configurable) | Special handling |
|---|---|---|
| COMPANY | 1 Approved · 2 Approved with comments · 3 Revise & resubmit · 4 For information / not reviewed | Client reviewers respond in the Client portal (review, comment, code) |
| **CA (Certifying Authority)** | Reviewed – no comments · Reviewed with comments · Not accepted · Certified | Links CA comments to the certification scope; tracks CA certificates / statements of conformity per document and system |
| **MWS (Marine Warranty Surveyor)** | No objection · Comments · Objection; **Certificate of Approval (COA)** for marine operations | COA register per marine operation (load-out, tow, installation, lift), linked to T&I workpacks (§10.10). A T&I workpack cannot be "Ready" until all MWS-required documents have "No objection" and the COA is recorded |
| Class / Authority | Configurable | Optional |

- **REQ-DOC-010** Each reviewer's status SHALL be tracked separately; the document's overall status is the most restrictive outstanding one.
- **REQ-DOC-011** **CRS**: comments imported from the returned file (Excel template) or entered online; each comment has a reply, an action (incorporate / clarify / reject with justification), a PIC and a status. A revision cannot be re-issued while comments are unanswered (configurable) [CRS online P2; Excel CRS attachment in P1].
- **REQ-DOC-012** External reviewers without accounts (CA, MWS) receive the transmittal by email with a secure, expiring download link. Returned comments are uploaded by the Document Controller, or by the reviewer through a guest upload link [P2].
- **REQ-DOC-013** Every review step and every CRS comment owed by a person becomes a **linked task** for its PIC (§10.16.3).

#### 10.17.5 Transmittals
Outgoing and incoming transmittals (no., date, from/to, purpose, list of documents and revisions, response due, cover letter PDF auto-generated with project branding), acknowledgement of receipt, ageing of unanswered transmittals, bulk transmittal of many documents, and a transmittal history on each document.

#### 10.17.6 Other Functions
- Document numbering generator and validation; reserve numbers in blocks for vendors.
- Watermarks and stamps on issued PDFs ("Issued for Review", "AFC", "Superseded", "Uncontrolled when printed").
- Hold management (HOLD clouds listed with owner and release date).
- Planned vs actual issue curves per WP and discipline; document progress feeds Engineering progress (ROC, §9.2.1).
- **Final documentation / dossiers** [P3]: MRB, completion dossiers, as-built packages per system; completeness % per dossier; handover to COMPANY.
- **EDMS integration**: P1 deep link; P3 two-way sync of the register and status with the company or client EDMS (e.g. Aconex, SharePoint, Documentum).
- Excel import/export of MDR/EMDR in the COMPANY's register format.

**KPIs:** documents issued vs plan (per issue purpose, WP, discipline); first-time approval rate (COMPANY code 1/2); average review time per reviewer (COMPANY, CA, MWS); documents overdue at reviewers; open CRS comments by PIC; vendor documents late vs PO schedule; MWS COAs outstanding vs marine operation dates; dossier completeness %.

**Client access:** released documents, review status and the review action itself for COMPANY reviewers; CA/MWS sections visible to COMPANY only if released.

**Phasing:** P1 – MDR, EMDR, numbering, transmittals, COMPANY/CA/MWS review tracking with codes, review matrix, Excel CRS. P2 – online CRS, guest reviewer upload, vendor/subcontractor document upload, distribution automation, correspondence links. P3 – dossiers and as-built, EDMS sync, OCR of returned stamps.

---

### 10.18 Additional Project Modules *(Rev. B)*
Further modules needed to manage a complete EPCIC project. They are all plugins, so each project adds only the ones it needs.

| Module | Phase | Why it is needed | Main contents |
|---|---|---|---|
| **Project Directory & Organisation** (`org.directory`) | P1 | Every module needs the right PIC; people change during the project | Project org chart by level and title; contact directory (all parties); focal points per discipline/package/interface; RACI per process (who prepares / reviews / approves); mobilisation dates; export to org-chart PDF |
| **Correspondence Register** (`doc.correspondence`) | P2 | Contractual letters and notices with COMPANY and subcontractors must be tracked and answered on time | Incoming/outgoing letters, reference numbers, subject, category (notice, instruction, claim-related, general), response required by, PIC, linked MOC/issue/variation, threads, ageing, Client view of its own letters |
| **Technical Query, Deviation & Concession Register** (`eng.tq`) | P2 | TQs and deviations affect design, cost and schedule | TQ/DQ, deviation/concession requests to COMPANY, vendor deviation lists, response tracking, link to documents, MOC and NCR |
| **Resource & Manpower** (`res.manpower`) | P2 | Productivity, POB and mobilisation depend on it | Manpower plan vs actual by discipline/craft/party, mobilisation/demobilisation, competence and certificate expiry, offshore POB and bed planning, histograms |
| **Construction Equipment & Lifting Register** (`res.equipment`) | P2 | Crane and lifting equipment availability and certification are frequent constraints | Cranes, SPMTs, lifting gear, certificates and expiry reminders, allocation to workfronts, heavy-lift plan register |
| **Permits, Licences & Regulatory Compliance** (`comp.permits`) | P2 | Statutory approvals and compliance obligations (environment, safety, registration and certification bodies) must not be missed | Compliance obligations register, permits with authority, validity, conditions, renewal reminders, evidence |
| **Contract & Variation Management** (`com.contract`) | P3 (restricted) | MOCs and instructions often become variations; payment milestones depend on progress | Contract obligations register, variation requests/orders, claims log, payment milestones and invoice status, links to MOC, correspondence and milestones; visible only to granted users |
| **Cost Control & EVM** (`com.cost`) | P3 (restricted) | Progress alone does not show cost performance | Budget by WBS/WP, commitments (POs, subcontracts), actuals import, EAC/ETC, CPI, cash-flow S-curve |
| **Weather & Metocean** (`marine.metocean`) | P3 | T&I and HUC depend on weather windows | Forecast feed import, operational limits per operation, go/no-go records, weather downtime statistics |
| **Completion Dossiers & Project Close-out** (`closeout`) | P3 | Formal close-out needs a controlled checklist | Close-out checklist, final documentation status, demobilisation, lessons-learned workshop, final reports, archive |
| **Vendor & Subcontractor Portals** (`portal.*`) | P3 | Lets external parties update their own data | Restricted roles to update PO milestones, upload documents, report progress, answer concerns |

---

## 11. Non-Functional Requirements

| Category | ID | Requirement |
|---|---|---|
| **Performance** | NFR-PER-01 | Page first load < 2.5 s (LCP) on 10 Mbps; subsequent navigation < 1 s |
| | NFR-PER-02 | API p95 < 400 ms for list queries ≤ 1,000 rows; grids virtualised to 50,000 rows |
| | NFR-PER-03 | Dashboard with 12 widgets renders < 3 s |
| | NFR-PER-04 | Excel import of 10,000 rows validated < 60 s (background job with progress bar) |
| | NFR-PER-05 | PDF monthly report (≤ 60 pages) generated < 90 s |
| **Scalability** | NFR-SCA-01 | 1,000 named users, 300 concurrent, 20 active projects per tenant without architecture change |
| **Availability** | NFR-AVL-01 | 99.5 % monthly (cloud); planned maintenance outside 07:00–19:00 project local time |
| | NFR-AVL-02 | RPO ≤ 1 h (point-in-time recovery), RTO ≤ 4 h |
| **Security** | NFR-SEC-01 | OWASP ASVS Level 2; annual penetration test; dependency scanning in CI |
| | NFR-SEC-02 | TLS 1.2+ in transit; AES-256 at rest (DB, storage, backups) |
| | NFR-SEC-03 | Authorisation enforced server-side on every request (deny by default) |
| | NFR-SEC-04 | Secrets in a vault; no secrets in code or logs |
| | NFR-SEC-05 | Audit trail immutable and retained ≥ project life + 5 years |
| | NFR-SEC-06 | Personal data minimised; compliant with Vietnam Decree 13/2023/ND-CP on personal data protection and applicable client data requirements; no national ID / passport numbers stored |
| | NFR-SEC-07 | Data residency option: on-prem or local cloud region |
| **Usability** | NFR-USE-01 | New Team Member completes a progress update without training within 10 minutes (usability test) |
| | NFR-USE-02 | SUS ≥ 75 at UAT |
| **Accessibility** | NFR-ACC-01 | WCAG 2.2 AA |
| **Compatibility** | NFR-CMP-01 | Latest 2 versions of Chrome, Edge, Safari, Firefox; iOS 16+, Android 12+ (PWA) |
| **Maintainability** | NFR-MNT-01 | Unit test coverage ≥ 80 % core, ≥ 70 % plugins; lint & type-check gates; ADRs for key decisions |
| | NFR-MNT-02 | Each plugin independently versioned (SemVer) with changelog and migration scripts (up & down) |
| **Observability** | NFR-OBS-01 | Centralised logs, metrics, traces; alerting on error rate, latency, job failures |
| **Localisation** | NFR-L10N-01 | 100 % UI strings translatable; EN & VI complete at each release |
| **Data** | NFR-DAT-01 | Soft delete with 30-day restore; full project export (JSON + Excel + files) on demand |

---

## 12. Integrations & API

| Integration | Direction | Phase | Description |
|---|---|---|---|
| Excel / CSV | In/Out | P1 | Templates for every register; exports of every view |
| Primavera P6 (XER / XML) | In | P1 | WBS, activities, baseline, actuals, milestones, activity codes → WP mapping |
| Primavera P6 (EPPM Web Services / API) | In/Out | P3 | Scheduled sync; push progress % back to P6 (optional) |
| MS Project XML | In | P2 | Alternative schedule source |
| Email (SMTP / Microsoft Graph) | Out (+ reply-to-comment P3) | P1 | Notifications, digests, report distribution |
| Microsoft Teams | Out | P2 | Channel notifications, adaptive cards for approvals (P3) |
| Microsoft Entra ID / Google (OIDC/SAML) | In | P1 | SSO, group → role mapping (P2) |
| Outlook / Google Calendar | Out | P3 | Event invitations sync |
| EDMS (Aconex, SharePoint, Documentum, etc.) | Link / In | P1 link, P3 sync | Deep links; import document register; status sync |
| Completions systems (e.g. commissioning databases) | In | P2 | Tags, systems, check-sheets, punch import (Excel/CSV), API later |
| ERP (SAP / Oracle) | In | P3 | PO header & delivery data for expediting |
| Power BI | Out | P3 | OData / read-only views |
| Timesheet / access control systems | In | P2 | Actual man-hours, manpower |

### 12.1 Public REST API
- Versioned (`/api/v1/...`), OpenAPI 3 documentation, OAuth2 client credentials for system integrations, personal access tokens for users [P3].
- Conventions: JSON, ISO-8601 UTC dates, cursor pagination, filtering `?filter[status]=open`, sparse fields, idempotency keys on POST.
- Webhooks for key events (e.g. `interface.query.overdue`, `milestone.achieved`, `po.delivery.late`) [P3].
- Rate limits: 600 req/min per token (configurable).

---

## 13. Product Roadmap

### 13.1 Phase Overview
| Phase | Name | Indicative window* | Objective |
|---|---|---|---|
| **P0** | Foundation | Jan – mid-Feb 2027 (6 wks) | Platform core, design system, plugin framework, auth, CI/CD |
| **P1** | Control Core (MVP) | mid-Feb – early Jun 2027 (16 wks) | Replace weekly progress / milestone / procurement / interface / risk-issue Excel trackers; client portal v1 |
| **P2** | Execution & Completion | Jun – Sep 2027 (16 wks) | Construction execution, subcontracting, completions (pre-com/comm), QAQC, HSE, materials & logistics, remaining registers, events, analytics v1 |
| **P3** | Offshore & Advanced | Oct 2027 – Jan 2028 (14 wks) | T&I, HUC, facility layout, construction & commissioning sequences, advanced analytics, integrations, offline mode |
| **P4** | Intelligence & Scale | 2028 onward (continuous) | AI assistant, predictive analytics, native mobile, 3D model link, portfolio, vendor/subcontractor portals at scale |

\* Based on an assumed start on Mon 04-Jan-2027 and the team in §14.1. The Tết holiday (around 06-Feb-2027) is absorbed as buffer in Sprint 2. Dates should be re-baselined once the team is mobilised.

### 13.2 Module Delivery by Phase
| Module | P0 | P1 | P2 | P3 | P4 |
|---|:-:|:-:|:-:|:-:|:-:|
| Core: Auth (login/logout/register/forgot) | ● | MFA, SSO | Login alerts | | |
| Core: User management, roles, permission matrix | ● | Client portal config, groups | Custom roles, delegation, access review | | |
| Core: Settings framework, Modules page, Work package config | ● | ● | Custom fields | Visual workflow editor | |
| Core: Themes | Light | Dark, System | High-contrast, co-brand, TV mode | | |
| Core: Reminders & notifications | In-app | Email, rule engine, digest | Teams, web push | Calendar sync | SMS/Zalo |
| Core: Audit, files, comments, search, import/export | Audit, files | Comments, search, Excel import/export | Import rollback | OpenSearch | |
| Profile | Basic | Full | Delegation | API tokens | |
| Dashboard | | ● | TV mode, scheduled snapshot | | AI narrative |
| Engineering – Work Packages & MDR | | ● | TQ, VDRL | EDMS sync | |
| Procurement Plan | | **●** | | | |
| Expediting | | **●** | Vendor scorecard | Vendor portal, ERP | |
| Logistics | | | **●** | | |
| Materials | | | **●** | QR mobile | |
| Overall Progress | | **●** | | P6 API sync | Predictive forecast |
| Planning Work Packages | | ● | | | |
| Milestones | | **●** | | | |
| Yard Layout | | | ● | Crane layer | |
| Facility Layout | | | | **●** | 3D link |
| Workfront | | | ● | | |
| Construction Sequence | | | | **●** | |
| Construction Progress & KPI (Str/Pip/Mech/E&I) | | ● | | Offline entry | |
| Productivity | | | ● | | |
| Subcontractor Progress / Concerns & Highlights | | | ● | Subcon portal | |
| Systems & Subsystems / Handover / Check-sheets / Punch | | | ● | Mobile check-sheets | |
| Commissioning Sequence | | | | ● | |
| QAQC | | | ● | | |
| HSE | | | ● | PTW link | |
| T&I (workpacks, schedule, sequence, progress) | | | | ● | |
| Offshore HUC (marine spread, schedule, progress) | | | | ● | |
| Risk Register / Issue Register | | ● | | | Monte-Carlo, AI suggestions |
| Lessons Learned / MOC / Stakeholders | | | ● | | |
| Interface Register / Points / Matrix | | ● | | | |
| Event Management | | | ● | Calendar sync | |
| Minutes of Meetings | | ● | | Co-editing | AI drafting |
| Documents | | ● | Transmittals | Check-in/out, EDMS sync | |
| Analytics | | Standard weekly report | Standard reports, KPI library | Report builder, Power BI | AI assistant |
| *Rev. B:* Project Settings & Project Selector (wizard, levels, titles) | Selector, switcher | Wizard, level templates, settings home | Copy project | Portfolio | |
| *Rev. B:* Module Management – Master Registry & assignment | Registry, enable/disable | Level × Module matrix, person overrides, effective-access viewer | Beta/pilot, deprecate | Scheduled upgrades | |
| *Rev. B:* Tasks Management | | **● Personal + project workspaces, linked PIC tasks** | Workload, templates, email-to-task | Offline | AI task suggestions |
| *Rev. B:* Document Control (MDR, EMDR, CA/MWS) | | **● Registers, transmittals, review matrix, reviews** | Online CRS, guest reviewers, vendor upload | Dossiers, EDMS sync | OCR |
| *Rev. B:* Project Directory & Organisation | | ● | RACI | | |
| *Rev. B:* Correspondence, TQ/Deviation, Resources, Equipment, Permits | | | ● | | |
| *Rev. B:* Contract & Variation, Cost & EVM, Metocean, Close-out, Portals | | | | ● | |

### 13.3 Release Gates
| Gate | Criteria |
|---|---|
| G0 – Foundation complete | Login/logout/register working, plugin can be installed/enabled, permission matrix enforced, CI/CD to staging, design system in Storybook |
| G1 – MVP go-live | All P1 modules pass UAT; pilot project data migrated (P6 baseline, MDR, procurement plan, interface/risk/issue registers); weekly report produced from Project Flow for 2 consecutive cut-offs in parallel run; security test passed; training completed |
| G2 – Execution release | P2 modules UAT; completions data imported; mobile punch/observation tested on site; performance test at target load |
| G3 – Offshore release | T&I/HUC modules accepted by Marine & Offshore teams; offline mode tested; integrations live |

---

## 14. Detailed Implementation Plan

### 14.1 Delivery Team
| Role | FTE | Responsibilities |
|---|---|---|
| Product Owner (EPCIC domain) | 1 | Backlog, priorities, acceptance, stakeholder alignment |
| Business Analyst / Project Control SME | 1 | Detailed requirements, ROC & KPI definitions, data templates, UAT scripts |
| Solution Architect / Tech Lead | 1 | Architecture, plugin framework, code quality, security |
| UX/UI Designer | 1 (0.5 from P2) | Design system, prototypes (Figma), usability tests |
| Front-end Developers | 3 | Shell, design system, module UIs, charts, layouts |
| Back-end Developers | 3 | Core services, plugins, integrations, jobs |
| QA Engineer (manual + automation) | 2 | Test plans, automation (Playwright), regression, performance |
| DevOps / SRE | 0.5 | Environments, CI/CD, monitoring, backups |
| Scrum Master / Delivery Lead | 0.5 | Ceremonies, impediments, reporting |
| Key users (per module, part-time) | — | Engineering, Procurement, Planning, Construction, Commissioning, QAQC, HSE, Interface, Marine reps for reviews and UAT |

### 14.2 Delivery Method
- **Scrum, 2-week sprints**; sprint review with key users every sprint; release at end of each phase (and feature flags for early pilots).
- **Definition of Ready:** user story with acceptance criteria (Given/When/Then), UI design approved, data fields agreed, permissions defined.
- **Definition of Done:** code reviewed, unit + integration tests passing, accessibility check, EN/VI strings, permissions enforced in API and UI, audit events, documentation (user help + API), deployed to staging, PO accepted.
- **Environments:** Dev → Test/QA → Staging (UAT, production-like data) → Production; optional on-prem yard mirror.
- **Branching:** trunk-based with short-lived feature branches; feature flags per plugin.

### 14.3 Work Breakdown of the Delivery Project
| WBS | Workstream |
|---|---|
| 1 | Product management & governance |
| 2 | UX/UI & design system |
| 3 | Core platform (auth, users, RBAC, settings, plugins, notifications, shared services) |
| 4 | Functional plugins (by module group) |
| 5 | Integrations & data migration |
| 6 | Quality assurance |
| 7 | DevOps, security & infrastructure |
| 8 | Change management: training, documentation, roll-out |

### 14.4 Phase 0 — Foundation (Sprints 0–2, 6 weeks)
| Sprint | Dates (indicative) | Goals & deliverables |
|---|---|---|
| **S0** | 04-Jan → 15-Jan-2027 | Team mobilisation; architecture decision records (stack, modular monolith, multi-project); repositories, CI pipeline, Dev/Test environments; brand & design tokens; Figma: app shell, login, dashboard concept, register pattern; domain workshops (WBS, WP, ROC, roles) |
| **S1** | 18-Jan → 29-Jan | Auth: login, logout, forgot/reset password, invite-only registration, sessions; user & project entities; app shell (sidebar, top bar, project switcher, breadcrumb); Flow UI components v1 (buttons, inputs, grid, drawer, modal, toast) in Storybook; Light theme |
| **S2** | 01-Feb → 12-Feb (Tết buffer) | Plugin registry & manifest loader (back + front); Settings framework (JSON-Schema-driven pages); Modules page (enable/disable, dependencies, "Coming in Phase X"); RBAC policy engine + permission matrix UI (5 roles); audit trail; file service; in-app notifications skeleton; **Gate G0** |

### 14.5 Phase 1 — Control Core / MVP (Sprints 3–10, 16 weeks)
| Sprint | Dates | Goals & deliverables |
|---|---|---|
| **S3** | 15-Feb → 26-Feb | Project settings (general, calendar, cut-off, disciplines, facilities, parties, numbering); WBS editor; **Work Package configuration** (manual, template, Excel import, weight validation); Request-access registration & approval; Profile (basic) |
| **S4** | 01-Mar → 12-Mar | P6 XER/XML import (WBS, activities, baseline, milestones); **Planning Work Packages**; **Milestones** (list, timeline, slip chart); Excel import/export framework; Dark theme + System theme |
| **S5** | 15-Mar → 26-Mar | **Overall Progress** (roll-up engine, S-curve, progress table, variance comments, cut-off workflow & locking, snapshots); Dashboard widget framework (grid, library, role defaults) |
| **S6** | 29-Mar → 09-Apr | **Engineering** (WP view, MDR import, ROC progress, client review tracker, look-ahead); **Procurement Plan** (packages, backward planning from RoS, float RAG, bidders, approval step) |
| **S7** | 12-Apr → 23-Apr | **Expediting** (PO milestones, forecast vs RoS alerts, contact logs, weekly report); **Construction Progress & KPI** – Structural & Piping (ROC, grid entry, import, S-curves) |
| **S8** | 26-Apr → 07-May | Construction Progress – Mechanical & E&I; **Risk Register** (5×5 heat map, mitigation actions, review reminders); **Issue Register** (list/Kanban, escalation); comments & mentions; global search |
| **S9** | 10-May → 21-May | **Interface Register & Points**, **Interface Matrix**, IQ issue/response flow incl. Client respond; **Minutes of Meetings** (templates, actions, carry-forward, PDF issue); **Documents** (register, folders, report library); Reminder rule engine + email + daily digest; MFA & SSO |
| **S10** | 24-May → 04-Jun | **Client portal** configuration & client dashboard; standard Weekly Progress Report (PDF/Excel); PM default dashboards per role; hardening, performance & security testing; data migration of pilot project; UAT; training; **Gate G1 – go-live (target 07-Jun-2027)**; 2 weeks parallel run with Excel |

### 14.6 Phase 2 — Execution & Completion (Sprints 11–18, 16 weeks)
| Sprint | Dates | Goals & deliverables |
|---|---|---|
| **S11** | 07-Jun → 18-Jun | Hypercare for P1 (fixes from parallel run); **Materials** (MTO, receipts, warehouse, issues, shortages); custom fields |
| **S12** | 21-Jun → 02-Jul | **Logistics** (shipments, customs checklist, status board); materials ↔ expediting ↔ logistics links; vendor scorecard |
| **S13** | 05-Jul → 16-Jul | **Yard Layout** (canvas, zones, objects, time slider, conflict detection); **Workfront** (constraints, look-ahead board, trade handover) |
| **S14** | 19-Jul → 30-Jul | **Productivity** (manpower, MH import, PF, unit rates, histograms); **Fabrication Subcontracting** – Subcontractor Progress & Concerns/Highlights |
| **S15** | 02-Aug → 13-Aug | **Commissioning**: Systems & Subsystems, check-sheets (A/B/C) import & KPI, punch (mobile capture, burn-down), handover schedule & certificates with COMPANY acceptance |
| **S16** | 16-Aug → 27-Aug | **QAQC** (ITP/inspection requests, NCR, welding/NDT, calibration, dossiers); **HSE** (statistics, incidents, observations mobile, inspections, training expiry) |
| **S17** | 30-Aug → 10-Sep | **MOC** (workflow, discipline reviews, COMPANY approval); **Lessons Learned** (cross-project library); **Stakeholders** (power/interest grid); **Event Management** (calendar, invitations, event→MoM) |
| **S18** | 13-Sep → 24-Sep | **Analytics v1** (standard report set, KPI library, scheduled reports); Teams notifications, web push; High-contrast & TV themes; delegation; custom roles; UAT & **Gate G2 – release (target 27-Sep-2027)** |

### 14.7 Phase 3 — Offshore & Advanced (Sprints 19–25, 14 weeks)
| Sprint | Dates | Goals & deliverables |
|---|---|---|
| **S19** | 27-Sep → 08-Oct | Hypercare P2; **T&I Workpacks** (readiness, MWS approvals, document checklist); **Marine Spread** |
| **S20** | 11-Oct → 22-Oct | **T&I Timeline & Schedule** (Gantt, weather windows); **T&I Sequence** (steps, hold points, storyboard) |
| **S21** | 25-Oct → 05-Nov | **T&I Progress** (DPR, downtime analysis); **HUC Timeline & Schedule** (carry-over work, campaign timeline) |
| **S22** | 08-Nov → 19-Nov | **HUC Progress** (offshore DPR, POB, offshore punch/check-sheets); **Facility Layout** (levels, heat maps, overlays) |
| **S23** | 22-Nov → 03-Dec | **Construction Sequence** & **Commissioning Sequence** (dependencies, playback); PWA offline mode for progress/punch entry |
| **S24** | 06-Dec → 17-Dec | Integrations: P6 API sync, EDMS sync, ERP PO data, Outlook/Google calendar, Power BI feed, webhooks, API tokens; Report builder; visual workflow editor |
| **S25** | 03-Jan → 14-Jan-2028 (after year-end break) | Performance & security re-test, portfolio view (multi-project), UAT with Marine/Offshore teams, **Gate G3 – release (target 17-Jan-2028)** |

### 14.7A Rev. B Scope — Where It Fits in the Plan
The Rev. B additions put more into Phase 1. To **keep the go-live dates**, the plan adds **1 front-end and 1 back-end developer** from S3 (team grows from about 12 to 14 FTE). If the team cannot grow, Phase 1 gets one more sprint (S10A, 07-Jun → 18-Jun-2027), and later phases move by 2 weeks.

| Sprint | Rev. B items added |
|---|---|
| **S1** | Project Selector page, Project Switcher, project-scoped URLs and tab titles |
| **S2** | Master Module Registry (statuses, install/enable), project module list (Enabled / Read-only / Hidden / Disabled) |
| **S3** | Project Setup Wizard; Organisation Levels per project (templates, base-level mapping, titles); per-project membership (level, position title, scope); Project Directory & Organisation |
| **S4** | Module assignment: Level × Module matrix, per-person grants/revokes with expiry, effective-access viewer, automated tests for the access rule |
| **S6** | Document Control core: MDR & EMDR per work package, numbering, revisions, review matrix |
| **S7** | Transmittals; COMPANY / CA / MWS review tracking with codes and review periods; MWS COA register; Excel CRS |
| **S8** | Tasks Management: personal & project workspaces, task data, list/board/calendar views, My Day |
| **S9** | Linked tasks from MoM, Risk, Issue, Interface, Document Control; shared PIC picker; task reminders |
| **S10** | Client access for tasks and document reviews; UAT of Rev. B items |
| **S11–S18** | Online CRS, guest reviewer and vendor upload; workload view, task templates, email-to-task; Correspondence, TQ/Deviation, Resource & Manpower, Equipment, Permits & Compliance; linked tasks from all P2 modules |
| **S19–S25** | Dossiers & as-built, EDMS sync; Contract & Variation; Cost & EVM; Metocean; Close-out; Vendor/Subcontractor portals; Portfolio view |

**Additional data migration (pilot):** MDR and EMDR registers with current revision and review status, open transmittals, the review matrix, open action lists from Excel (into Tasks), the project organisation chart and the levels.

### 14.8 Phase 4 — Intelligence & Scale (continuous backlog)
- AI assistant: natural-language Q&A over project data (permission-aware), weekly narrative draft, MoM drafting from notes, risk identification suggestions from issues/lessons.
- Predictive analytics: forecast completion from historical productivity, milestone slip probability, procurement delay prediction.
- Monte-Carlo schedule risk export/analysis.
- Native mobile apps (iOS/Android) for site and offshore.
- 3D model viewer integration (tags clickable to progress/punch).
- Vendor & subcontractor portals at scale; SMS/Zalo notifications.

### 14.9 Data Migration Plan (pilot project)
| Step | Data | Source | Owner | Sprint |
|---|---|---|---|---|
| 1 | Users, roles, parties | HR list / project org chart | PM / BA | S9 |
| 2 | WBS, WPs, weights | P6 + progress measurement procedure | Planning lead | S9 |
| 3 | Baseline & actuals | P6 XER (latest update) | Planner | S10 |
| 4 | Milestones | P6 / contract | Planner | S10 |
| 5 | MDR | EDMS export | Document control | S10 |
| 6 | Procurement plan & POs | Procurement tracker (Excel) | Procurement lead | S10 |
| 7 | Construction quantities & progress | Discipline trackers | Construction leads | S10 |
| 8 | Risk, issue, interface registers | Excel registers | Managers / Interface Manager | S10 |
| 9 | Completions (systems, sheets, punch) | Completions database export | Commissioning lead | S15 |

Each migration: template → trial load in Staging → reconciliation report (counts, totals, % progress vs source) → sign-off by data owner → production load at cut-over.

### 14.10 Change Management & Training
| Activity | Audience | Timing |
|---|---|---|
| Key-user group (1 per module) | Leaders & Managers | From S0 |
| Sprint demos | Key users, PM | Every sprint |
| Role-based training (2 h each) | PM, Manager, Leader, Team Member | S10, S18, S25 |
| Client portal walkthrough (45 min) | COMPANY reps | At G1 |
| Quick-reference cards (EN/VI) | All | Each release |
| In-app guided tours & help centre | All | P1 onward |
| "Floor-walking" support at office & yard | All | 2 weeks after each go-live |

---

## 15. Testing & Quality Strategy

| Level | Scope | Tools | Owner |
|---|---|---|---|
| Unit | Services, calculation engines (ROC roll-up, SPI, PF, float), components | Vitest / Jest | Developers |
| Integration / API | Endpoints, permissions per role (**automated permission matrix tests: every role × every protected action**), plugin enable/disable | Supertest, Pact | Developers / QA |
| End-to-end | Critical user journeys | Playwright | QA |
| Visual regression | Design system & key screens, light/dark | Chromatic / Playwright snapshots | QA / UX |
| Accessibility | Automated + manual screen-reader checks | axe-core, NVDA/VoiceOver | QA / UX |
| Performance | Load (300 concurrent), large grids, imports, report generation | k6 | QA / DevOps |
| Security | SAST, DAST, dependency scan, pen test before each gate | Semgrep, OWASP ZAP, Snyk/Dependabot, external pen tester | Tech Lead / DevOps |
| Calculation validation | Progress, KPI results reconciled against the current Excel method on real data | Excel reconciliation workbooks | BA / Planning |
| UAT | Business scenarios per module & role | UAT scripts, defect log | Key users / PO |

**Critical journeys for automated E2E (P1):**
1. Register (request access) → PM approves → user logs in → MFA → logout.
2. PM enables "Expediting" → dependency prompt enables "Procurement Plan" → menu appears for permitted roles only.
3. Leader updates piping progress → overall progress recalculates → PM approves cut-off → Client sees the released S-curve.
4. Interface Manager issues an IQ to COMPANY → Client responds → reminder stops → IQ closed.
5. Client user cannot see PO values, internal comments or unreleased records (UI and API).
6. Risk owner receives overdue mitigation reminder → escalation to Manager after N days.

**Defect severity & release rule:** no open Critical/High defects at a gate; Medium defects with an agreed workaround and fix date.

---

## 16. Deployment, Go-Live & Support

### 16.1 Deployment Options
| Option | Description |
|---|---|
| Cloud (recommended) | Managed Kubernetes or container service, managed PostgreSQL, S3, CDN; regional hosting chosen for data residency |
| On-premise | Docker Compose / Kubernetes on company servers (office or yard data centre); MinIO storage; same images |
| Hybrid | Cloud primary + yard edge cache for offline/poor connectivity (P3) |

### 16.2 Go-Live Checklist (per phase)
- Production environment provisioned, backups tested (restore drill), monitoring & alerts active.
- SSO configured, users invited, roles and client portal reviewed by PM ("View as role" check).
- Data migrated and reconciled; sign-offs on file.
- Training completed; help centre published.
- Cut-over plan: freeze of Excel trackers, read-only archive of old files.
- Hypercare team and escalation contacts announced.

### 16.3 Support Model
| Level | Who | Target response |
|---|---|---|
| L1 | Key users / project application admin | Same day |
| L2 | Product support team | Critical: 2 h · High: 8 working h · Medium: 3 working days |
| L3 | Development team | Per severity, hot-fix for Critical within 24 h |

Release cadence after go-live: minor releases every 2 weeks (feature-flagged), patches as needed, plugin upgrades announced in-app with changelog.

---

## 17. Delivery Risks

| # | Risk | P | I | Mitigation |
|---|---|:-:|:-:|---|
| R1 | Scope creep — every discipline wants its tracker replicated exactly | H | H | Phase gates, standard register pattern, configuration over custom code, PO prioritisation |
| R2 | Progress calculations disagree with existing Excel/P6 figures, eroding trust | M | H | Early ROC/KPI workshops, reconciliation testing on real data, transparent formula tooltips |
| R3 | Low user adoption (Excel habits) | M | H | Key-user group, parallel run then freeze Excel, quick wins (automatic weekly report), mobile-friendly entry |
| R4 | Client data exposure through misconfigured permissions | L | H | Deny-by-default, automated permission tests, "View as Client" check, release flags, audit |
| R5 | Data quality of imports (P6, MDR, completions) | H | M | Validation preview, reconciliation reports, data owners sign-off |
| R6 | Plugin framework over-engineered, delaying P1 | M | M | Keep the manifest minimal in P0; extend extension points only when needed |
| R7 | Yard/offshore connectivity issues | M | M | PWA caching, offline queue (P3), lightweight pages |
| R8 | Key-user availability during busy project phases | H | M | Agreed time allocation, short focused reviews, recorded demos |
| R9 | Licensed components (Gantt, charts) cost/licensing | L | M | Evaluate in S0; open-source fallback |
| R10 | Security / compliance requirements from COMPANY | M | M | Early security questionnaire, ASVS L2, pen test before G1 |

---

## 18. Appendices

### Appendix A — Sample User Stories with Acceptance Criteria

**US-PLG-01 Enable a module**
*As a PM, I want to enable a module from Settings so that my team can use it on this project.*
- **Given** I am PM and "Expediting" is installed but disabled, **when** I switch it on, **then** I am told it requires "Procurement Plan" and can enable both in one step.
- **Given** the module is enabled, **when** a Leader logs in, **then** "Expediting" appears in the sidebar under EPCIC › Procurement; **and** it does not appear for the Client unless released.
- **Given** I disable the module, **then** its menu and widgets disappear, data is kept, and the action is in the audit trail.

**US-ACL-03 Client restricted access**
*As a PM, I want to choose which screens and buttons the Client can use so that COMPANY sees only approved information.*
- **Given** the Client role has "Overall Progress: view (released only)", **when** a Client user opens Overall Progress, **then** only the last PM-approved cut-off is shown.
- **Given** the "Respond" button is enabled for the Client on Interface Queries, **when** a Client user opens an IQ addressed to COMPANY, **then** they can respond; **and** they cannot edit any other field.
- **Given** the Client role, **when** the API is called for PO values, **then** the response omits restricted fields (HTTP 200 without the fields, or 403 for restricted endpoints).

**US-REM-02 Overdue interface query reminder**
*As an Interface Manager, I want automatic reminders on overdue queries so that responses are not forgotten.*
- **Given** an IQ with response due 10-Nov and the default rule, **when** 07-Nov 08:00 is reached (3 working days before), **then** the responder gets in-app + email notifications.
- **Given** it is still open on 12-Nov, **then** reminders repeat every 2 working days and on day 7 overdue the responder's Manager is notified.
- **When** the IQ is responded, **then** all scheduled reminders for it are cancelled.

**US-CON-05 Piping progress entry**
*As a Piping Leader, I want to update spool progress in a grid so that weekly progress is up to date before the cut-off.*
- **Given** I am scoped to Piping, **when** I open Construction Progress › Piping, **then** I can edit only Piping items.
- **When** I tick "Welding complete" for 25 spools and save, **then** earned dia-inch, WP %, discipline % and overall % recalculate within 5 s and the change is audited.
- **Given** the cut-off is locked, **then** editing previous-period values is blocked with an explanation.

### Appendix B — Settings JSON Schema Example (Interface module)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Interface Management Settings",
  "type": "object",
  "properties": {
    "numberingFormat": { "type": "string", "default": "{PROJ}-IQ-{FROM}-{TO}-{000}" },
    "responseDays": {
      "type": "object",
      "properties": {
        "High":   { "type": "integer", "default": 7 },
        "Medium": { "type": "integer", "default": 14 },
        "Low":    { "type": "integer", "default": 21 }
      }
    },
    "interfaceTypes": {
      "type": "array", "items": { "type": "string" },
      "default": ["Physical", "Functional", "Organisational", "Contractual", "Information"]
    },
    "matrixAxes": { "enum": ["Party", "Discipline", "Package", "Facility"], "default": "Party" },
    "requireDualSignOff": { "type": "boolean", "default": true },
    "clientCanRespond": { "type": "boolean", "default": true }
  }
}
```

### Appendix C — KPI Definitions (extract)
| KPI | Formula | Target / thresholds (default) |
|---|---|---|
| Overall progress variance | Actual % − Planned % (cumulative, at cut-off) | Green ≥ −1 %, Amber −1 to −3 %, Red < −3 % |
| SPI (progress-based) | Earned % ÷ Planned % | Green ≥ 0.98, Amber 0.95–0.98, Red < 0.95 |
| Productivity Factor | Earned MH ÷ Actual MH | Green ≥ 1.0, Amber 0.85–1.0, Red < 0.85 |
| Procurement float | RoS − (PO date + lead time + transit) | Green ≥ 28 d, Amber 0–28 d, Red < 0 |
| Delivery slippage | Forecast delivery − Contract delivery (days) | Red > 0 vs RoS |
| Interface response time | Avg(response date − issue date), working days | ≤ target per priority |
| Overdue IQs | Count(open AND today > due) | 0 critical overdue |
| Weld repair rate | Repaired welds ÷ welds tested (by count or length) | < 2 % |
| Punch closure rate | Punch closed in period ÷ open at start of period | ≥ required burn rate to handover |
| Check-sheet completion | Completed sheets ÷ total sheets (by type) | Plan curve |
| LTIF | LTIs × 1,000,000 ÷ man-hours | 0 |
| TRCF | (LTI + RWC + MTC) × 1,000,000 ÷ man-hours | Project target |
| Milestone on-time rate | Milestones achieved ≤ baseline ÷ milestones due | ≥ 90 % |

### Appendix D — Default Numbering Formats
| Record | Format | Example |
|---|---|---|
| Risk | `{PROJ}-RSK-{0000}` | ABC-RSK-0042 |
| Issue | `{PROJ}-ISS-{0000}` | ABC-ISS-0108 |
| MOC | `{PROJ}-MOC-{000}` | ABC-MOC-017 |
| Lesson | `{PROJ}-LL-{000}` | ABC-LL-031 |
| Interface Point | `{PROJ}-IP-{PARTY}-{000}` | ABC-IP-PL-012 |
| Interface Query | `{PROJ}-IQ-{FROM}-{TO}-{000}` | ABC-IQ-CTR-CPY-045 |
| NCR | `{PROJ}-NCR-{SRC}-{000}` | ABC-NCR-YRD-009 |
| Punch | `{SUBSYS}-P-{0000}` | 41-01-P-0123 |
| MoM | `{PROJ}-MOM-{TYPE}-{000}` | ABC-MOM-WPM-034 |
| Event | `{PROJ}-EVT-{000}` | ABC-EVT-076 |

### Appendix E — Navigation Map
```
Dashboard
EPCIC
├─ Engineering ─ Work Packages · Deliverables (MDR) · Client Review · [TQ] · [VDRL]
├─ Procurement ─ Procurement Plan · Expediting · Logistics · Materials
├─ Planning & Progress ─ Overall Progress · Work Packages · Milestones
├─ Construction ─ Yard Layout · Facility Layout · Workfront · Construction Sequence ·
│                 Progress & KPI (Structural · Piping · Mechanical · E&I) · Productivity
├─ Fabrication Subcontracting ─ Subcontractor Progress · Concerns & Highlights
├─ Onshore Pre-com & Commissioning ─ Systems & Subsystems · Commissioning Sequence ·
│                 Handover Schedule · Check-sheets · Punch
├─ QAQC ─ Inspections/ITP · NCR · Welding & NDT · Calibration · Audits · Dossiers
├─ HSE ─ Statistics · Incidents · Observations · Inspections · Training · Leading Indicators
├─ T&I ─ Workpacks · Timeline & Schedule · Sequence · Progress
└─ Offshore HUC ─ Marine Spread · Timeline & Schedule · Progress
Management ─ Risk · Issue · Lessons Learned · MOC · Stakeholders
Interface Management ─ Interface Register · Interface Matrix · Interface Points
Event Management ─ Calendar · Events · Visitors
Tasks ─ My Work (personal, all projects) · Project Tasks · Assigned by me · Workload
Document Control ─ MDR · EMDR · Subcontractor Docs · Transmittals · Reviews (COMPANY / CA / MWS) ·
                   CRS · Review Matrix · [Correspondence] · [TQ / Deviations] · [Dossiers]
Project ─ Directory & Organisation · [Resources] · [Equipment] · [Permits & Compliance] ·
          [Contract & Variations] · [Cost Control] · [Metocean] · [Close-out]
Reports ─ Minutes of Meetings · Documents · Analytics
(Top bar) Project Switcher ▾ · Project Selector (all my projects)
─────────
Profile (avatar menu) ─ Personal info · Projects & roles · Preferences · Notifications ·
                        Security · Delegation · My work · Activity · Logout
Settings ─ General · Reporting periods · Modules · Facilities · WBS · Disciplines ·
           Work Packages · Progress rules · Systems · Parties · Numbering · Workflows ·
           Access Control · Client Portal · Reminders · Dashboards · Reports ·
           Lists of values · Import/Export · Users & Access · Themes ·
           Organisation Levels · Module Assignment (by level / by person / by module) ·
           Review Matrix · Project Setup Wizard ·
           (Tenant: Modules – Master Registry, Security, Integrations, Data, Branding, Licences)
```

### Appendix F — Open Points for Product Owner Decision
| # | Topic | Options |
|---|---|---|
| OP-01 | Hosting | Cloud (regional) vs on-prem at company data centre |
| OP-02 | Gantt component | Licensed (Bryntum/dhtmlx) vs custom SVG timeline |
| OP-03 | Pilot project | Which EPCIC project and at which phase to start (ideally early construction) |
| OP-04 | Phase weights & ROC | Confirm against the company's progress measurement procedure |
| OP-05 | Client portal scope | Confirm default released screens with COMPANY at kick-off |
| OP-06 | Completions system | Keep the existing completions database and import, or move completions fully into Project Flow |
| OP-07 | Language of reports to COMPANY | English only, or bilingual |
| OP-08 | Rev. B resourcing | Add 2 developers and keep the dates, or add one sprint to Phase 1 (+2 weeks) |
| OP-09 | EMDR naming and format | EMDR vs VDRL/SDRL label; COMPANY register template to match |
| OP-10 | Document Control vs EDMS | Project Flow as the working register with EDMS as the record system, or full sync from P3 |
| OP-11 | Commercial modules | Whether Contract/Variation and Cost/EVM live in Project Flow (restricted) or stay in the ERP |

---
*End of document — PF-SPEC-001 Rev. A*



