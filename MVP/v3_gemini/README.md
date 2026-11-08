# Project Flow — MVP Demo (`v3_gemini`)

**Project Flow** is the EPCIC (Engineering, Procurement, Construction, Installation, and Commissioning) project management and controls application built in strict accordance with [ProjectFlow_spec_final.md](../docs/ProjectFlow_spec_final.md) (Revision 1.2).

This demo is implemented entirely in **HTML, vanilla CSS, and vanilla JavaScript** without external build tools or framework dependencies.

---

## 🚀 How to Run the Demo

You can run this demo using any web browser or local HTTP server:

### Option 1: Direct File Open
Simply open `v3_gemini/index.html` in your web browser (Chrome, Edge, Firefox, or Safari).

### Option 2: Local HTTP Server (Recommended)
Using Python or Node:
```powershell
# Using Node http-server or npx serve:
npx serve v3_gemini

# Or using Python:
python -m http.server 8080 --directory v3_gemini
```
Then navigate to `http://localhost:8080` in your browser.

---

## 🌟 Key Architecture & Specification Highlights Implemented

### 1. StageLink Design System (§3.2, DEC-10)
- **Palette**: Brand `#343C78` (dark `#C5CBFF`), Interactive Accent `#00877D` (dark `#69D8CB`), Surface `#FFFFFF` (dark `#19242F`), Main text `#172B3A`.
- **Themes & Densities**: Light, Dark, and System theme toggle + Comfort and Compact density toggle in the sidebar footer.
- **Visual Language**: Modular connected cards, rounded pills, tabular numerals for all measurements and dates.

### 2. Multi-Project Context & Tab Isolation (§2.5 PRJ-01..06)
- Switch between **PRJ-084: Golden Ray FPSO Topsides** (Execution, 64.2% progress) and **PRJ-092: South Natuna Subsea Pipeline** directly from the header dropdown.

### 3. Role-Based Access & Policy Simulation (§2.1, §2.3, §2.6)
- **Persona Switcher**: Switch on-the-fly between:
  - **Sarah Jenkins** (Project Manager - L2)
  - **Michael Chen** (Lead Planning / Controls - L2)
  - **Elena Rostova** (Lead Document Controller - L3)
  - **David Miller** (Expediting & Procurement Lead - L3)
  - **Johan Vries** (Client Representative - Equinor JV - L5)
  - **Tuan Nguyen** (QAQC & Yard Engineer - L4)
- **Client Audited Mode (PUB-01..04)**: When switching to Johan Vries, commercial prices are masked, internal contractor notes are hidden, and only released document revisions are shown.
- **Read-Only Preview Mode (ACL-04, ACCESS-04)**: Test effective permissions as any person/level with a top preview banner and exit button.

### 4. Canonical Task Workspaces & Private Organizer (§6.7 TASK-01..12)
- **My Workspace**: Displays "Assigned to Me", "My Day", and **Private Personal Organizer** (TASK-02).
- **Private-to-Project Conversion (TASK-03)**: Convert confidential private tasks into canonical project tasks with explicit review of which fields are shared.
- **Project Tasks**: Full register with tabular list, interactive Kanban board, and Assignee Capacity & Workload bars.
- **Bidirectional Source Linking**: Tasks are canonically bound to CRS comments (`TSK-012`), Vendor Concerns (`TSK-019`), Workfront releases (`TSK-021`), and Punch verifications (`TSK-022`).

### 5. Document Control & Multi-Party Review (§6.8 DOC-01..17)
- **MDR vs VDR**: Independent filter by semantic register type (Engineering MDR vs Vendor VDR / SDRL).
- **Multi-Party Reviews**: Separate independent decision channels for **Client (COMPANY)**, **CA (DNV Class)**, and **MWS (Marine Warranty Surveyor)**.
- **Comment Resolution Sheet (CRS)**: Attributable comments, PIC responses, and blocking gates.
- **Release for Use Calculation (DOC-13)**: Automatically verifies that Client approval, Class verification, MWS CoA, and open blocking CRS comments are satisfied before granting "Released for Use (IFC)".
- **Transmittal Cover Sheet**: Interactive preview and download modal with checksum verification.

### 6. Vendor Production Schedule Monitoring (§7.2.1 VPROD-01..10, Rev 1.2)
- Dedicated monitoring workspace for **PO-4500128: Siemens Gas Compressor Packages**.
- **Reconciled Progress**: Planned (88.0%) vs Reported (82.0%) vs Expeditor Accepted (76.5%).
- **Milestone Timeline**: Engineering data → Forgings → Rotor machining → Skid reinforcement → FAT witness → Dispatch.
- **Highlights & Concerns**: Actionable concerns linked directly to canonical tasks, with recovery schedules.

### 7. Planning, S-Curves & Rules of Credit (§5.1, §6.3, §14.2)
- **S-Curve SVG**: Planned Baseline vs Accepted Actual with cutoff date marker.
- **Calculation Fixtures Test Bench (§14.2)**:
  - Fixture 1: Children weighted 20% @ 50% + 80% @ 25% = 30.0% parent progress.
  - Fixture 2: Accepted 40 of 100 budget + 10 pending = 40.0% accepted (not 50%).
  - Fixture 3: Installed 110 of 100 budget = 10 overrun and capped at 100.0% earned.
  - Fixture 4: Cumulative stage thresholds 10/40/70/100 yield 70.0% at 3rd milestone (never summed as 120%).
- **Immutable Snapshots**: Freeze new cutoff snapshots with locked historical audit.

### 8. Yard Execution & 2D Layout Plan (P2 Foundation, §8.1, §9.1)
- **2D Yard Map**: Interactive SVG plan of Batam Yard (Assembly Hall 1, Blast Bay 3, Laydown East, Quayside Berth).
- **Spatial Pins**: Clickable pins for Workfronts, Punches, and Material Receipts that open directly into the Inspector drawer.
- **Workfront Readiness Gates (CON-03)**: Non-waivable evaluation of Engineering IFC, Material MRR, QAQC Hold, and HSE PTW.
- **Punch Balance Calculator (§14.2)**: Opening (20) + Raised (5) + Reopened (2) − Verified Closed (8) = 19 Active Punches.

### 9. Governance, Risks & Interface Management (§6.4, §6.5, §6.6)
- **5×5 Risk Heatmap**: Likelihood vs Consequence scoring matrix with inherent vs residual risk migration.
- **Live Issues Register**: Active blockers and containment actions.
- **Management of Change (MOC)**: Proposal, impact evaluation, and approval workflow.
- **Interface Management**: Inter-party boundary points (FPSO Topsides ↔ Hull Shipyard ↔ Turret Vendor).
- **Minutes of Meetings (MoM)**: Attributable decisions and auto-generated canonical tasks.

### 10. Module Catalog & RACI Directory (§11.2, §2.6)
- **4-Axis Module State**: Displays Catalog Availability × Deployment Status × Project Operational State × User Assignment Grant.
- **Personnel Levels (L1–L5)** & Tabular RACI matrix.

### 11. Productivity Shell Utilities
- **Slide-out Inspector Drawer (`Ctrl+Click` or click any row)**: Overview, related records, and internal vs shared commentary.
- **Command Palette (`Ctrl+K`)**: Instant search and screen jumping.
- **Toast Notifications**: Feedback for all user operations.
