# Master System Requirements Specification (SRS): "Project Flow" EPCIC Platform

**Document ID:** PF-SRS-2026-V3.0-FINAL  
**System Name:** Project Flow  
**Target Domain:** EPCIC (Engineering, Procurement, Construction, Installation, Commissioning)  
**Architecture Paradigm:** Multi-Tenant Microkernel Core + Hot-Swappable Plugin Modules  
**Status:** Consolidated Master Specification & Implementation Plan (Phases 1, 2 & 3)

---

## 1. Executive Summary & System Architecture

**Project Flow** is an enterprise-grade, modular operating system engineered specifically for complex onshore, offshore, and marine EPCIC mega-projects (Fixed Platforms, FPSOs, Offshore Wind Substations, Subsea Tie-backs, and LNG/Petrochemical facilities).

### 1.1 Microkernel Core & Plugin Engine
Project Flow operates on a **Microkernel (Core + Plugin) Architecture** to allow seamless phased rollouts (Phase 1, Phase 2, Phase 3) and project-specific customization without altering the core codebase or causing downtime.
* **Core Host Shell:** Manages multi-project portfolio state, authentication/SSO, dynamic routing, the bi-directional PIC Task Event Bus, notification/escalation SLAs, and the Master Module Registry.
* **Plugin Manifest (`manifest.json`):** Every functional module is packaged as an independent plugin declaring:
  * `module_id`, `semantic_version`, and `default_phase` (`PHASE_1`, `PHASE_2`, `PHASE_3`).
  * `dependencies`: Enforces prerequisite validation (e.g., *Onshore Precom-Commissioning* requires *Document Control (DCC)* and *Construction Progress* to be active).
  * `navigation_mount`: Injects menu nodes into the Left Navigation Rail.
  * `dashboard_widgets`: Exports KPI cards and charts to the Executive Dashboard.
  * `permission_hooks`: Exposes module-specific screens, data columns, and action buttons to the 3-Tier Role & Individual Access Matrix.
* **Unified EPCIC Golden Thread (Core Data Bus):**
  All plugins share a unified relational data bus indexed by four master keys:
  1. `Project_ID` (Multi-Project Context Key)
  2. `WBS_ID` & `WP_ID` (Work Breakdown Structure & Configurable Work Package ID)
  3. `Asset_Tag_ID` (Equipment, Line, Spool, Cable, Instrument, or Structural Piece Mark)
  4. `System_Subsystem_ID` (Commissioning Systemization Hierarchy)
  *Result:* Any single tag (e.g., `GTG-1001A` or Piping Spool `ISO-2104-01`) can be traced end-to-end: **Engineering Deliverable (MDR)** $\rightarrow$ **PO / Expediting** $\rightarrow$ **Warehouse MRR / Preservation** $\rightarrow$ **4-Gate Workfront** $\rightarrow$ **QA/QC Weld/NDE** $\rightarrow$ **Precom ITR / Punch** $\rightarrow$ **Offshore HUC**.

### 1.2 Master Phased Rollout Matrix
| Phase | Target Modules | Primary Objective |
| :--- | :--- | :--- |
| **Phase 1 (Foundation & Core Control)** | Core Shell, Multi-Project Switcher, Dashboard, Task Management (Personal & Project), Document Control (MDR/EMDR/CRS/Transmittals), Engineering (Work Packages), Procurement (Plan, Expediting), Planning & Progress (Overall S-Curve, WBS, Milestones), Construction (Workfront, KPI, Productivity), QA/QC, HSE, Regulatory/Class, Management Registers, Reports (MoM, Docs), Settings & RBAC Matrix | Establish single source of truth for schedule, document control, procurement tracking, PIC task accountability, and core site metrics. |
| **Phase 2 (Supply Chain, Commercial & Field Integration)** | Procurement (Logistics, Materials/MatMan), Equipment Preservation, Fabrication Subcontracting, Onshore Precom-Commissioning, Commercial/Cost & Variation Management, Interface Management ($N \times N$), Event Management, Reports (BI Analytics) | Connect material availability (MTO/MRR/OSD) and preservation to workfront readiness, manage yard subcontractors, track VOWD/variations, and drive Mechanical Completion (MC). |
| **Phase 3 (Spatial 4D, SIMOPS & Offshore Execution)** | Construction (Interactive 2D/3D Yard & Facility Layout, 4D Sequence), e-PTW / LOTO & Spatial SIMOPS, T&I (Workpacks, Sequence, Schedule), Offshore HUC (Marine Spread, POB Optimizer, Timeline, Progress) | Full visual digital twin integration, spatial permit conflict detection, heavy-lift/loadout MWS certification, and offshore vessel/hook-up campaign execution. |

---

## 2. Multi-Project Portfolio & Context Architecture

EPCIC contractors and Owner PMTs execute multiple concurrent contracts. Project Flow provides a **Multi-Tenant Portfolio & Context Engine** that adapts terminology, WBS structures, installed modules, and user authority per project.

### 2.1 Global Project Switcher (`Cmd/Ctrl + P`)
* **Instant Context Switching:** Located in the Top Command Bar. Displays the active `Project_Code`, `Project_Title`, `Asset_Type`, `Contract_Mode`, and `Current_Stage_Gate`.
* **Portfolio Executive Roll-Up:** Directors and executives can select **"All-Portfolio Master View"** to aggregate S-Curves, VOWD cash flow, HSE safe manhours, and Personal Tasks across all assigned projects.
* **Session State Isolation:** Switching projects dynamically reloads the active sidebar modules, Client/Contractor co-branding logos, cutoff clock, and the user's project-specific role and title.

### 2.2 Project-Specific Role, Level & Title Mapping
A user’s authority and job title are bound per project rather than fixed globally:
* **Dynamic Level Assignment:** The same user can hold **Level 1 (`PM`)** with title *"Deputy Project Director"* on **Project A (Block B CPP Jacket)** while holding **Level 3 (`Leader`)** with title *"Structural Advisory Lead"* on **Project B (FPSO Turret Mooring)**.
* **Custom Organisational Nomenclature:** In **Settings $\rightarrow$ Project Profile**, Admins map standard system levels (`PM`, `Manager`, `Leader`, `Team Member`, `Client`) to contract-specific titles (e.g., mapping `Client` to *"COMPANY PMT"*, *"JV Partner"*, or *"Owner Representative"*, and `Leader` to *"Package Manager"* or *"Offshore Area Superintendent"*).

### 2.3 Project Settings & Metadata Parameters
| Parameter Group | Configurable Settings |
| :--- | :--- |
| **Project Identity** | `Project_Code`, `Project_Title`, `Asset_Type` (Fixed Platform, FPSO, Offshore Wind OSS, Subsea SURF, Onshore Plant), `Contract_Mode` (LSTK, EPCC, Reimbursable, T&I Only). |
| **Governance & Stage Gate** | `Project_Tier` (Tier 1 Mega-Project $>\$500\text{M}$, Tier 2 Mid-Cap, Tier 3 Brownfield), `Active_Stage_Gate` (FEED, Detailed Engineering, Yard Fabrication, Loadout/T&I, Offshore HUC, Warranty). |
| **Calendar & Cutoff Clock** | `Project_Timezone` (e.g., `UTC+7`), `Weekly_Cutoff_Day_Time` (e.g., `Friday 17:00`), `Shift_Pattern` (Onshore $6 \times 10\text{h}$ vs. Offshore $14/14$ $12\text{h}$ Day/Night shifts). |
| **Units & Currency** | `Base_Currency` (`USD`, `EUR`, `VND`), `Piping_Unit` (`Dia-Inch` vs. `Linear Meter`), `Structural_Unit` (`Metric Ton - MT`), `Pressure/Temp` (`Barg/°C` vs. `PSIG/°F`). |
| **Phase Weighting & RoC** | Custom EPCIC phase weights (e.g., `E: 12%`, `P: 28%`, `C: 42%`, `T&I: 8%`, `HUC: 10%`) and deliverable Rules of Credit gates. |

---

## 3. Branding, UX/UI & Visual Design System

Project Flow combines **high-density engineering precision** with **modern executive elegance**.

### 3.1 Brand Identity & Color Tokens
* **Primary Brand (Deep Maritime Navy):** `#0A192F` (Headers/Navigation) & `#1E3A8A` (Primary Interactive Accents).
* **Accent (Industrial Safety Amber):** `#F59E0B` (Key Callouts, Active States, Cutoff Indicators).
* **Technical Cyan:** `#06B6D4` (Interactive CAD/BIM links, Tag Deep-Links, Baseline Curves).
* **Semantic RAG Statuses:**
  * *On-Track / Approved / Safe:* Emerald `#10B981`
  * *At-Risk / Hold Point / Expedite:* Amber `#F59E0B`
  * *Critical / Delayed / Punch A / NCR:* Crimson `#EF4444`
  * *Archived / Phase-Locked:* Slate `#64748B`
* **Typography:**
  * **UI & Executive Headers:** *Plus Jakarta Sans* or *Inter* for clean geometric legibility.
  * **Tabular Data, Tag Numbers, WBS & S-Curve Metrics:** *JetBrains Mono* (monospaced numerals prevent column jitter in MDRs, ITRs, and manhour tables).

### 3.2 Multi-Environment Theme Engine
1. **Control Room Dark Theme (Default):** Deep `#090D16` canvas and `#111827` cards for low-glare 24/7 onshore/offshore monitoring rooms.
2. **Executive Light Theme:** Crisp `#F8FAFC` background and `#FFFFFF` cards optimized for office desktop use and print/PDF dossier exports.
3. **Field High-Contrast Sunlight Mode:** Pure black/white/amber high-contrast strokes (`48x48px` minimum glove-friendly touch targets) for iPads and rugged tablets under direct fabrication yard or offshore sunlight.

---

## 4. Authentication, User Management & 3-Tier Access Matrix

### 4.1 Authentication Flows (Login / Logout / Register)
* **Login Portal:** Split-screen enterprise portal displaying current project artwork and a live countdown to the next major milestone (e.g., *Topside Sailaway*) on the left, paired with Corporate SSO (Azure AD / Okta / SAML 2.0) and Email + Password + MFA (TOTP) on the right.
* **Registration & Onboarding:**
  * **Encrypted Invite Flow:** Admins/PMs dispatch pre-bound invitations specifying Organization (Client, Main Contractor, Subcontractor, Class CA, MWS, Vendor), Project Assignment, Level, and Discipline.
  * **Domain Whitelisted Self-Registration:** Users from approved corporate domains land in a **Pending Approval Queue** for Admin verification before accessing project data.
* **Security Controls:** Configurable idle session timeout, concurrent session revocation, and cryptographic PIN/2FA verification for signing ITRs, MOCs, Transmittals, and Handover Certificates.

### 4.2 5-Tier Personnel Hierarchy
| Level | System Role | Default Authority & Scope |
| :--- | :--- | :--- |
| **Level 1** | **PM (Project Director / PM)** | Full executive visibility and approval authority across all project modules, baselines, MOCs, and Client Sandbox configurations. |
| **Level 2** | **Manager (Dept / Area Manager)** | Full CRUD and approval authority within assigned department/domain (Engineering, Procurement, Construction, QA/QC, Precom, HUC) + read access to interfaced modules. |
| **Level 3** | **Leader (Discipline / Package Lead)** | Creates, updates, delegates tasks, and verifies weekly progress, MDR deliverables, expediting logs, ITRs, and workfronts within assigned Work Packages. |
| **Level 4** | **Team Member (Engineer / Inspector / Expeditor)** | Field and desk execution: uploads drawings, logs manhours, raises RFIs/punches, completes assigned PIC tasks. Cannot alter baselines or delete records. |
| **Level 5** | **Client (Company PMT / CA / MWS)** | **Strictly Sandboxed Role.** Accesses only whitelisted screens, data columns, and action buttons configured in the **Client Access Matrix**. |

### 4.3 Master Module Lifecycle & 3-Tier Assignment Engine (In Settings)
Module visibility and action rights are governed by a 3-tier cascade:
$$\text{Effective Access} = \text{Master Module Status} \rightarrow \text{Level Baseline Matrix} \rightarrow \text{Individual Personnel Override}$$

1. **Master Module Catalog (`Settings → Master Modules`):**
   * Add/install new plugins, validate module dependencies, or remove unused modules.
   * Set project-wide module status:
     * `ACTIVE`: Live and operational.
     * `PILOT`: Visible only to designated test users/leads.
     * `ARCHIVE`: Read-only vault (e.g., locking *Engineering* after Sailaway).
     * `LOCKED`: Temporarily frozen during Friday weekly progress cutoffs.
     * `DISABLED`: Hidden from the project workspace.
2. **Level-Based Module Assignment (`Settings → Level Matrix`):**
   * Toggle `View`, `Create`, `Edit`, `Delete`, `Approve/Sign`, and `Export` permissions per module for each of the 5 personnel levels.
3. **Individual Personnel Override Matrix (`Settings → Per-Person Overrides`):**
   * Select any individual user to apply granular exceptions without changing their role level:
     * **`+ Grant Extra Module`**: Grant a specific `Team Member` access to *Preservation* or *Interface Points*.
     * **`- Revoke Module`**: Hide *Commercial/Cost* or *Procurement* from a specific `Manager` (e.g., HSE Manager).
     * **`WBS / Work Package Scope Filter`**: Restrict a Subcontractor Lead or Package Engineer so they only see records tagged to their assigned Work Package (e.g., `WP-FAB-JACKET`).
     * **`Out-of-Office Delegation`**: Temporarily delegate sign-off authority to a deputy with an automatic expiration date.
4. **Client Sandbox Configurator (`Settings → Client Access Matrix`):**
   * Live **"View As Client"** preview toggle.
   * **Screen Toggles:** Show/hide specific modules or sub-tabs from the Client sidebar.
   * **Data Masking:** Mask internal Manhour Productivity Factors (`PF`), internal commercial variation exposure, subcontractor commercial claims, and unvetted internal risks.
   * **Button Locks:** Granularly enable/lock action buttons for the Client role (`btn_export_pdf`, `btn_approve_moc`, `btn_sign_itr`, `btn_raise_punch`, `btn_stamp_crs`, `btn_edit_baseline`).

---

## 5. Task Management Module (Personal & Project Workspaces + PIC Bus)

The **Task Management Module** is the operational nerve center of Project Flow, bi-directionally synchronized with every **PIC (Person In Charge)** field across all EPCIC modules.

### 5.1 Dual-Workspace Design
1. **Personal Workspace ("My Desk"):**
   * Aggregates every task, document review, RFI witness notice, punch item, and approval assigned to the user (`Primary_PIC` or `Co_Assignee`) across **all** assigned projects, plus private scratchpad tasks.
   * **Smart Views:** Kanban Board (`To Do` $\rightarrow$ `In Progress` $\rightarrow$ `Under Review` $\rightarrow$ `Blocked` $\rightarrow$ `Completed`), Priority Grid, and Calendar Lookahead.
2. **Project Workspace ("Master Action Tracker"):**
   * Displays all tasks across the active project, filterable by Work Package, Discipline, Originating Module, Organization, Priority (`P1 Critical Path` to `P4`), and PIC.
   * **Workload Heatmap:** Identifies overloaded Discipline Leads or bottlenecked packages so Managers can bulk-reassign tasks during shift rotations.

### 5.2 Bi-Directional PIC Auto-Sync Rules
Assigning a **PIC** anywhere in the platform automatically spawns or updates a linked Task Card with a 1-click deep link back to the originating record:
* **Document Control (DCC):** Assigning a `Reviewer_PIC` or `CRS_Responder_PIC` creates a task linked to the drawing revision and transmittal SLA due date. Uploading the IFC revision or closing the CRS comment auto-completes the task.
* **Procurement & Expediting:** Assigning an `Expeditor_PIC` on a delayed PO orOSD report spawns a tracked expediting task.
* **Construction Workfront:** Assigning a constraint owner on a blocked Workpack (e.g., *Missing Material or Scaffold*) dispatches a `P1` task to clear the blocker.
* **Precom & QA/QC:** Assigning a `PIC` to a `Punch Category A` item or `NCR` pushes an immediate task to their field tablet.
* **Management & Interfaces:** Assigning a Risk Mitigation Owner, MOC Approver, Interface Query (`IQ`) responder, or Minutes of Meeting (`MoM`) Action Owner creates a gated task with automated SLA escalation reminders.

### 5.3 Sub-Delegation & Evidence Verification Gates
* **Parent-Child Sub-Tasking:** A Discipline Lead can break a high-level MoM or Interface action into child sub-tasks for Team Members while remaining accountable as the Parent PIC.
* **Verification Gate:** Tasks flagged with `Requires_Evidence = True` cannot be marked `Completed` until a file attachment, transmittal number, or digital signature is recorded.

---

## 6. Document Control Module (DCC: MDR, EMDR, VDR, CA/MWS & CRS)

The **Document Control Center (DCC)** governs the full lifecycle of engineering deliverables and vendor data across all work packages.

### 6.1 MDR, EMDR & Vendor Document Register (VDR / SDRL)
* **Configurable Work Package Registers:** Separate or combined views for **EMDR** (Engineering Master Document Register by work package: Topside, Jacket, Subsea, Pipeline) and **VDR/SDRL** (Vendor Document Register linked to Procurement POs).
* **Earned Value Rules of Credit (RoC):**
  * Each deliverable has a budgeted manhour weight and configurable milestone gates (default: `IFR = 30%`, `IFA = 65%`, `AFD = 85%`, `IFC = 100%`).
  * Progress automatically rolls up into the Engineering Work Package and Overall EPCIC S-Curve.
* **Engineering Hold Tracker:** Flags drawings containing technical holds (`HOLD-01`) and automatically alerts linked Construction Workpacks.

### 6.2 Multi-Party Review & Approval Matrix (Client, Class CA & MWS)
* **Parallel & Sequential Routing:** Tracks review statuses across three external authorities:
  1. **Client PMT:** `Code 1 (Approved)`, `Code 2 (Approved with Comments)`, `Code 3 (Rejected - Resubmit)`, `Code 4 (For Information)`.
  2. **Certifying Authority (CA / Classification Society - DNV, ABS, Lloyd's, BV):** Tracks Design Verification Reports (`DVR`) and class stamping for structural, pressure vessel, and safety-critical systems.
  3. **Marine Warranty Surveyor (MWS):** Tracks mandatory review and **Certificate of Approval (`CoA`)** issuance for Loadout, Sea-fastening, Towage, and Heavy Lift procedures.
* **Comment Resolution Sheet (CRS) Engine:**
  * Consolidates all reviewer comments per document revision into a structured grid (`Comment_ID`, `Reviewer_Org`, `Category: Mandatory/Technical/Editorial`, `Comment_Text`, `Contractor_Response`, `Responder_PIC`, `Status`).
  * Assigning a `Responder_PIC` automatically syncs a task to their Personal Desk.
* **Formal Transmittal Engine (`TRN-XXXX`):**
  * Generates immutable Outgoing/Incoming Transmittal packages with PDF cover sheets, digital receipt timestamps, and SLA review countdowns (e.g., *10 working days for Client IFA review; auto-reminder at Day 7; "Deemed Approved" flag at Day 11*).

---

## 7. Detailed Functional Specifications: Core EPCIC & Governance Modules

### 7.1 Executive Dashboard
* Customizable widget grid showing Overall EPCIC S-Curve (Early/Late Banana envelope), Key Milestones traffic light, HSE LTI-free manhours, Top 5 Critical Path bottlenecks, Marine Spread summary, and Personal Action Queue.

### 7.2 Engineering
* **Work Packages (Configurable in Settings):** Discipline breakdown (*Process, Structural, Piping, Mechanical, E&I, Telecom, Safety*), deliverable progress roll-ups from DCC, 3D Model Review (`30% / 60% / 90%`) readiness, and MTO (Material Take-Off) revision tracking.

### 7.3 Procurement & Material Management (MatMan)
* **Procurement Plan (Phase 1):** Tracks Long Lead Items (LLIs) and bulk packages through *RFQ $\rightarrow$ TBE/CBE $\rightarrow$ PO Award $\rightarrow$ Vendor Data $\rightarrow$ Manufacturing $\rightarrow$ FAT $\rightarrow$ ROS Date* with schedule float calculation.
* **Expediting (Phase 1):** Shop progress %, sub-vendor tracking, FAT witness schedules, and field expediting flash reports.
* **Logistics (Phase 2):** Incoterms, Packing Lists, Bill of Lading, Customs clearance, vessel tracking, and Port-to-Yard arrival.
* **Materials / MatMan (Phase 2):** Material Receiving Reports (`MRR`), Over/Short & Damaged (`OSD`) claims, Heat Number traceability, quarantine control, and **Bag & Tag** allocation to Construction Workpacks.

### 7.4 Planning & Progress
* **Overall Progress (Phase 1):** Multi-level WBS roll-up, interactive S-Curves (Baseline 0, Revised Baseline, Actual, Forecast), and Manhour Histograms.
* **Work Packages (Configurable in Settings):** Custom physical weightage trees and earned value calculation rules.
* **Milestones (Phase 1):** Contractual Payment Milestones vs. Key Project Milestones with variance days and predecessor blockers.

### 7.5 Construction
* **Yard Layout (Phase 1 Static / Phase 3 Interactive GIS/CAD):** Interactive map of fabrication yard skidways, pipe shops, blasting cells, laydown zones, heavy-lift crane swing radii, and loadout quay.
* **Facility Layout (Phase 3):** 2D Deck Plans & browser-based 3D BIM/IFC viewer of Topside/Jacket modules color-coded by erection or turnover status.
* **Workfront (Phase 1):** **4-Gate Constraint Engine** verifying *1) IFC Drawing Available + 2) Material Bagged & Tagged + 3) Predecessor Complete + 4) Scaffold/Rigging Ready* before releasing a workpack.
* **Construction Sequence (Phase 3):** 4D visual simulation linking schedule bars to 3D structural blocks and heavy lifts.
* **Construction Progress & KPI (Phase 1):**
  * *Structural:* Metric Tons (MT) cut, fit-up, welded, NDE passed, erected, painted.
  * *Piping:* Dia-Inch (DI) / Spools prefabricated, hydrotested, erected.
  * *Mechanical:* Equipment skids set, aligned, grouted.
  * *E&I:* Cable tray (m), cable pulled (m), glanded & terminated (qty), loop tested.
* **Productivity (Phase 1):** Earned Manhours vs. Burned Manhours, calculating **Productivity Factor (`PF`)** per discipline and crew against bid norms.

### 7.6 Fabrication Subcontracting (Phase 2)
* **Subcontractor Progress:** Tracks offsite yard tonnage/spools, physical progress vs. certified invoice milestones, and manpower mobilization curves.
* **Subcontractor Concerns & Highlights:** Executive log of technical bottlenecks, capacity risks, QA/HSE flags, and recovery plans.

### 7.7 Onshore Precom-Commissioning (Phase 2)
* **Systems & Subsystems Highlight:** Visual Systemization tree (*System $\rightarrow$ Subsystem $\rightarrow$ Loop*) color-coded from *Construction $\rightarrow$ Mechanical Completion (MC) $\rightarrow$ Precom (ITR-A/B) $\rightarrow$ Dynamic Commissioning $\rightarrow$ RFSU*.
* **Commissioning Sequence:** Interactive logic network from Utilities/Emergency Power to Hydrocarbon systems.
* **Handover Schedule:** Walkdown dates, MC Dossier compilation, and **SHC (Subsystem Handover Certificate)** digital sign-off.
* **Check-Sheet Progress & KPI:** ITR matrix (Planned vs. Submitted vs. QA Verified vs. Client Signed).
* **Punch Closing Progress & KPI:** Master Punch List categorized by **Category A** (Must clear before MC/Sailaway), **Category B** (Clear before RFSU), and **Category C** (Minor).

### 7.8 QA/QC & HSE (Phase 1)
* **QA/QC:** Welder continuity log, daily Welding Repair Rate (`WRR%`) by RT/UT/MT/PT, Request for Inspection (`RFI`) Hold/Witness point scheduling, and `NCR / CAR` registers.
* **HSE:** Safe manhours, LTI/TRIR lagging indicators, safety walk observations, incident 5-Why root-cause tracker.

### 7.9 T&I (Transport & Installation - Phase 3)
* **T&I Workpacks:** Readiness tracker for Loadout, Sea-fastening, Towage, Heavy Lift, Piling, and Subsea Tie-ins with **MWS Certificate of Approval (`CoA`)** gates.
* **T&I Timeline, Schedule & Sequence:** Weather-window adjusted Gantt chart, step-by-step ballast/skidway loadout sequence, and real-time execution progress.

### 7.10 Offshore HUC (Hook-Up & Commissioning - Phase 3)
* **Marine Spread & POB Optimizer:** Live tracker for Flotel, Heavy Lift Vessel (HLV), Barges, and AHTS boats. Manages **POB (Persons on Board)** bed allocation by shift/discipline, helicopter manifests, and gangway uptime vs. Waiting on Weather (`WOW`).
* **HUC Schedule & Progress:** 12-hour Day/Night shift lookahead, structural/piping/E&I hook-up burn-down, offshore leak testing, and First Gas/Oil RFSU readiness.

### 7.11 Strategic EPCIC Support Modules (New Additions)
1. **Commercial, Cost & Contract Management (Phase 2):** WBS budget vs. commitments, Value of Work Done (`VOWD`), Milestone Payment Certificates, and Variation Order (`VOR`) claim recovery linked to MOCs.
2. **Digital e-PTW, LOTO & Spatial SIMOPS (Phase 2/3):** Hot/Cold/Confined Space/Radiography permits, Lockout-Tagout (`LOTO`) electrical/mechanical isolation registers during Precom/HUC, and spatial SIMOPS conflict detection on the Yard/Deck layout map.
3. **Equipment Preservation & Maintenance (Phase 2):** Recurring weekly/bi-weekly preservation routines (shaft rotation, $\text{N}_2$ purges, desiccant checks) from Warehouse `MRR` receipt until Offshore `RFSU` to protect vendor warranties.
4. **Regulatory, Class & Statutory Compliance (Phase 1/2):** Tracks Flag State, Class Society (`DNV/ABS`), Environmental, and Customs Bonded Zone clearances required for Sailaway and operation.

### 7.12 Governance, Interfaces, Events & Reporting
* **Management Registers (Phase 1):** $5 \times 5$ Risk Register, Issue Register, Lesson Learned Register, formal **Management of Change (`MOC`)** workflow (evaluating cost, schedule, and dry weight/CoG impact), and Stakeholders Register.
* **Interface Management (Phase 2):** Internal & External Battery-Limit **Interface Register**, interactive **$N \times N$ Interface Matrix** across contractors, and physical Tie-In **Interface Points** (`X, Y, Z` coordinates, clash status).
* **Event Management (Phase 2):** Readiness tracker for HAZOPs, 3D Model Reviews, First Steel Cut, VIP Yard Visits, and Sailaway Ceremonies with automated post-event MoM generation.
* **Reports & BI Analytics (Phase 1/2):** Structured **Minutes of Meetings (`MoM`)** where discussion bullets convert into tracked PIC Tasks; Document Vault; and 1-click **DPR / WPR / MPR** PDF/Excel/PPT report generator.

---

## 8. Global Notification, Reminder & Escalation Engine

* **Time-Based Triggers:** $X$ days prior to Milestone, ROS date, Vessel charter window, Transmittal SLA expiry, Preservation routine, or Task due date.
* **Threshold-Based Triggers:** S-Curve variance drops below $-2.0\%$, Welding Repair Rate exceeds $2.0\%$, or Open Punch A count exceeds target prior to Subsystem Handover.
* **Workflow & Escalation SLAs:**
  * 24-hour advance notice to QA/QC, Client PMT, and MWS for `Hold / Witness` inspections.
  * **Automated Escalation Ladder:** Overdue tasks or CRS comments $>3$ days at `Team Member / Leader` level automatically escalate to the `Department Manager`; $>7$ days escalate to the `PM / Director`.

---

## 9. API & Integration Architecture (REST & GraphQL)

Project Flow exposes a hybrid **RESTful (OpenAPI 3.1)** and **Federated GraphQL** API layer secured by OAuth2/OIDC JWTs and the `X-Project-Context-ID` header.

### 9.1 Core API Endpoints Summary
| Domain | Endpoint / Operation | Architectural Function |
| :--- | :--- | :--- |
| **Multi-Project & RBAC** | `GET /api/v2/portfolio/my-projects` | Returns assigned projects with user's `project_specific_title`, `access_level`, and cutoff clock. |
| **Context & Permissions** | `GET /api/v2/projects/{id}/context` | Resolves effective sidebar modules (`Master Status` $\rightarrow$ `Level` $\rightarrow$ `User Override`), WBS scopes, and Client Sandbox UI masks. |
| **Master Module Admin** | `PATCH /api/v2/projects/{id}/settings/modules/{modId}` | Changes module status (`ACTIVE`, `PILOT`, `ARCHIVE`, `LOCKED`, `DISABLED`) with dependency validation. |
| **Per-Person Overrides** | `POST /api/v2/projects/{id}/rbac/user-overrides` | Grants/revokes specific modules or WBS work package scopes for an individual user. |
| **PIC Task Event Bus** | `POST /api/v2/pic-bus/assign` | Atomically assigns a PIC on any module entity (DCC, PO, Workfront, Punch, MoM) and spawns/updates the linked Task Card. |
| **Task Workspaces** | `GET /api/v2/tasks/personal-desk` & `/projects/{id}/tasks` | Queries cross-project Personal Desk tasks or the Project Master Action Tracker with Verification Gate enforcement. |
| **DCC & Transmittals** | `POST /api/v2/projects/{id}/dcc/transmittals` | Bundles revisions into a formal Transmittal (`TRN-XXXX`), generates cover PDF, starts SLA timer, and dispatches reviewer tasks. |
| **CRS & Multi-Party Sign** | `POST /api/v2/projects/{id}/dcc/revisions/{revId}/sign-off` | Records cryptographically signed Client, Class CA (`DVR`), or MWS (`CoA`) return codes and recalculates MDR Rules of Credit. |
| **External Integrations** | `POST /api/v2/integrations/p6-xer-import` | Ingests Primavera P6 `.XER` / `.XML` baselines, SAP/Oracle PO commitments, and IFC 3D model metadata. |

---

## 10. Master 12-Month Product Roadmap & Implementation Plan

### 10.1 Phased Execution Timeline (24 Two-Week Sprints)

```
====================================================================================================
MONTHS 1 - 4 (SPRINTS 1 - 8): PHASE 1 — CORE FOUNDATION, DCC, TASK BUS & FIELD KPIs
====================================================================================================
[M1: Sprints 1-2]  Core Microkernel Shell, Multi-Project Context Engine, SSO/MFA, 3-Tier RBAC Matrix
[M2: Sprints 3-4]  Bi-Directional PIC Task Engine (Personal/Project Desk) + Document Control (MDR/EMDR/CRS)
[M3: Sprints 5-6]  Engineering Work Packages, Procurement Plan/Expediting, Planning S-Curves & P6 Importer
[M4: Sprints 7-8]  Construction 4-Gate Workfront, Discipline KPIs, QA/QC, HSE, Risk/MOC, DPR/WPR Generator
                   >>> MILESTONE GATE 1: ONSHORE ENGINEERING & YARD MOBILIZATION GO-LIVE <<<

====================================================================================================
MONTHS 5 - 8 (SPRINTS 9 - 16): PHASE 2 — SUPPLY CHAIN, PRECOM, COMMERCIAL & INTERFACES
====================================================================================================
[M5: Sprints 9-10]  Logistics & Material Management (MatMan MRR/OSD/Bag&Tag) + Equipment Preservation
[M6: Sprints 11-12] Fabrication Subcontracting Portal + Commercial/Cost (VOWD, Milestone Certs, VORs)
[M7: Sprints 13-14] Onshore Precom-Commissioning (Systemization Tree, ITR A/B Matrix, Punch List, SHC)
[M8: Sprints 15-16] Interface Management (NxN Matrix, Tie-in Points), Event Management & Offline Tablet PWA
                   >>> MILESTONE GATE 2: YARD ERECTION & MECHANICAL COMPLETION GO-LIVE <<<

====================================================================================================
MONTHS 9 - 12 (SPRINTS 17 - 24): PHASE 3 — 4D SPATIAL TWIN, SIMOPS, T&I & OFFSHORE HUC
====================================================================================================
[M9: Sprints 17-18]  Interactive 2D/3D Yard & Facility Layout (WebGL/IFC) + 4D Construction Sequence
[M10: Sprints 19-20] Digital e-PTW, LOTO Isolation Register & Spatial SIMOPS Conflict Overlay
[M11: Sprints 21-22] T&I Module (Loadout Workpacks, Ballast/Lift Sequence, MWS CoA Gate Tracker)
[M12: Sprints 23-24] Offshore HUC & Marine Spread (Vessel Tracker, Flotel POB Optimizer, Shift Lookahead)
                   >>> MILESTONE GATE 3: SAILAWAY, OFFSHORE HUC & RFSU HANDOVER GO-LIVE <<<
```

### 10.2 Recommended Engineering Squad Structure
* **Core Platform & Security Squad (4 Engineers):** 1 Principal Architect, 2 Backend Engineers (Node.js/NestJS or Go), 1 DevSecOps Engineer.
* **EPCIC Domain & Data Squad (5 Engineers):** 3 Full-Stack Engineers (DCC, Task Bus, Procurement, Precom, HUC), 1 Data/P6 Integration Engineer, 1 EPCIC Subject Matter Expert (Lead Planning/Commissioning Advisor).
* **Frontend, Mobile PWA & 3D Spatial Squad (4 Engineers):** 2 Senior React/TypeScript UI Engineers, 1 Offline PWA/RxDB Specialist, 1 WebGL/Three.js/IFC 3D Engineer (mobilized in Month 7 for Phase 3).
* **QA & Field UAT Squad (2 Engineers):** 1 Automated E2E Test Lead, 1 Field Tablet/Load-Testing Engineer.

### 10.3 Legacy Data Migration & Yard Rollout Strategy
1. **Automated Ingestion Templates:** Pre-built validators for importing existing Excel MDRs, Vendor SDRLs, MTO cut-lists, and Primavera P6 `.XER` schedules in under 15 minutes per project.
2. **Parallel Shadow Cutoff (2 Weeks):** Run Project Flow alongside legacy spreadsheets for two Friday cutoffs to verify 100% mathematical alignment on S-Curves, Rules of Credit, and Manhour Productivity Factors before locking legacy sheets.
3. **Offline Yard & Offshore Readiness:** Deploy ruggedized tablets pre-synced with local IndexedDB storage for QA/QC and Precom inspectors working inside steel modules or offshore flotels with intermittent satellite connectivity.