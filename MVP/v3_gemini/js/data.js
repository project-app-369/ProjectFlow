/**
 * ProjectFlow - Core Seed Data & Store (v3_gemini)
 * Authoritative implementation of ProjectFlow_spec_final.md
 */

const ProjectFlowData = {
  // Current Global State
  state: {
    currentProjectId: 'PRJ-084',
    currentPersonaId: 'USR-001', // Sarah Jenkins (PM)
    previewMode: false,
    previewPersonaId: null,
    snapshotMode: false, // live data vs snapshot
    activeSnapshotId: 'SNP-2026-W44',
    activeView: 'dashboard',
    inspectorEntity: null,
    theme: 'light',
    density: 'comfort',
  },

  // Projects (§2.5 PRJ-01..06)
  projects: [
    {
      id: 'PRJ-084',
      code: 'PRJ-084',
      title: 'Golden Ray FPSO Topsides EPCIC',
      shortName: 'Golden Ray Topsides',
      client: 'Equinor / Petrobras JV',
      contractType: 'Lump Sum EPCIC',
      facilityType: 'Deepwater FPSO (220,000 bpd)',
      location: 'Batam Yard & Campos Basin, Brazil',
      pm: 'Sarah Jenkins',
      stage: 'Execution',
      lifecycle: 'Active',
      startDate: '2025-03-01',
      endDate: '2027-08-30',
      cutoffDate: '2026-11-06',
      baselineRev: 'Rev 2.1 (Approved 2026-06-15)',
      overallProgress: 64.2,
      plannedProgress: 67.8,
      varianceProgress: -3.6, // negative is behind (§5.3)
      currency: 'USD',
      enabledModuleCount: 16
    },
    {
      id: 'PRJ-092',
      code: 'PRJ-092',
      title: 'South Natuna Gas Pipeline & Tie-In',
      shortName: 'South Natuna Pipeline',
      client: 'Medco Energi / Premier Oil',
      contractType: 'Reimbursable with Target Price',
      facilityType: 'Subsea 24" Export Pipeline (114 km)',
      location: 'Natuna Sea, Indonesia',
      pm: 'Alex Mercer',
      stage: 'Engineering & Procurement',
      lifecycle: 'Active',
      startDate: '2026-02-15',
      endDate: '2028-01-20',
      cutoffDate: '2026-11-06',
      baselineRev: 'Rev 1.0 (Approved 2026-04-10)',
      overallProgress: 24.5,
      plannedProgress: 26.0,
      varianceProgress: -1.5,
      currency: 'USD',
      enabledModuleCount: 12
    }
  ],

  // Users & Personas (§2.1, §2.6)
  users: [
    {
      id: 'USR-001',
      name: 'Sarah Jenkins',
      email: 's.jenkins@stage-link.com',
      avatar: 'SJ',
      role: 'Project Manager',
      projectRole: 'Project Manager (PM)',
      personnelLevel: 'L2',
      discipline: 'Management',
      company: 'Main Contractor EPCIC',
      isClient: false,
      permissions: ['all_internal', 'publish_client', 'baseline_approve', 'approve_moc']
    },
    {
      id: 'USR-002',
      name: 'Michael Chen',
      email: 'm.chen@stage-link.com',
      avatar: 'MC',
      role: 'Manager',
      projectRole: 'Lead Planning & Project Controls',
      personnelLevel: 'L2',
      discipline: 'Project Controls',
      company: 'Main Contractor EPCIC',
      isClient: false,
      permissions: ['planning_edit', 'baseline_propose', 'wbs_manage', 'reports_generate']
    },
    {
      id: 'USR-003',
      name: 'Elena Rostova',
      email: 'e.rostova@stage-link.com',
      avatar: 'ER',
      role: 'Leader',
      projectRole: 'Lead Document Controller',
      personnelLevel: 'L3',
      discipline: 'Document Control',
      company: 'Main Contractor EPCIC',
      isClient: false,
      permissions: ['mdr_manage', 'transmittal_issue', 'crs_manage', 'distribute_docs']
    },
    {
      id: 'USR-004',
      name: 'David Miller',
      email: 'd.miller@stage-link.com',
      avatar: 'DM',
      role: 'Leader',
      projectRole: 'Expediting & Procurement Lead',
      personnelLevel: 'L3',
      discipline: 'Procurement',
      company: 'Main Contractor EPCIC',
      isClient: false,
      permissions: ['procurement_edit', 'expediting_manage', 'vendor_review', 'shop_visit']
    },
    {
      id: 'USR-005',
      name: 'Johan Vries',
      email: 'j.vries@equinor-client.com',
      avatar: 'JV',
      role: 'Client',
      projectRole: 'Company Representative (CLIENT)',
      personnelLevel: 'L5',
      discipline: 'Client Oversight',
      company: 'Equinor / Petrobras JV',
      isClient: true,
      permissions: ['client_read_released', 'crs_comment', 'transmittal_acknowledge']
    },
    {
      id: 'USR-006',
      name: 'Tuan Nguyen',
      email: 't.nguyen@batam-yard.com',
      avatar: 'TN',
      role: 'Team Member',
      projectRole: 'Lead Yard QAQC Engineer',
      personnelLevel: 'L4',
      discipline: 'QAQC / Yard',
      company: 'Main Contractor Yard Operations',
      isClient: false,
      permissions: ['yard_inspect', 'punch_raise', 'checksheet_execute', 'workfront_verify']
    }
  ],

  // Personnel Level Definitions (§2.6 PEOPLE-02)
  personnelLevels: [
    { level: 'L1', title: 'Project Director / Executive', description: 'Enterprise sponsorship, strategic signoff' },
    { level: 'L2', title: 'Project Manager / Controls Lead', description: 'Project configuration, baseline decisions, client publication' },
    { level: 'L3', title: 'Discipline Lead / Section Head', description: 'Work package signoff, technical verification, transmittal authority' },
    { level: 'L4', title: 'Field / Execution Engineer', description: 'Workfront readiness, inspection, check sheet completion' },
    { level: 'L5', title: 'External Client / Subcontractor', description: 'Restricted audience, released records only' }
  ],

  // Module Catalog with 4-Axis State (§11.2 MOD-02)
  modules: [
    {
      id: 'MOD-CORE-ID',
      name: 'Identity & Access Controls',
      phase: 'P0',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: true,
      description: 'Scoped RBAC, project isolation, personal exceptions, preview.'
    },
    {
      id: 'MOD-CORE-TASK',
      name: 'Task & PIC Coordination',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: true,
      description: 'Canonical project tasks, personal organizer, source synchronization.'
    },
    {
      id: 'MOD-DOC-CTRL',
      name: 'Document Control & CRS',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: 'MDR, transmittals, client/CA/MWS review cycles, release for use.'
    },
    {
      id: 'MOD-ENG-CTRL',
      name: 'Engineering Management',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: 'Work packages, deliverables, technical holds, look-ahead.'
    },
    {
      id: 'MOD-PLAN-PROG',
      name: 'Planning & S-Curve Progress',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: 'WBS, rules of credit, baselines, immutable snapshots.'
    },
    {
      id: 'MOD-PROC-EXP',
      name: 'Procurement & Expediting',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: 'Procurement plans, PO lines, ROS dates, delivery variance.'
    },
    {
      id: 'MOD-VEND-PROD',
      name: 'Production Schedule Monitoring',
      phase: 'P1 (Rev 1.2)',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: 'Vendor manufacturing Gantt, FAT milestones, concerns, highlights.'
    },
    {
      id: 'MOD-GOV-RISK',
      name: 'Management Registers & MOC',
      phase: 'P1',
      catalogState: 'Available',
      deploymentState: 'Installed',
      projectState: 'Enabled',
      userGrant: 'Allowed',
      isCore: false,
      description: '5x5 risk matrix, issues, MOC, interface management, MoM.'
    },
    {
      id: 'MOD-YARD-EXEC',
      name: 'Yard Layout & Workfronts',
      phase: 'P2',
      catalogState: 'Beta',
      deploymentState: 'Installed',
      projectState: 'Pilot',
      userGrant: 'Allowed',
      isCore: false,
      description: '2D interactive yard map, workfront readiness gates, spatial pins.'
    },
    {
      id: 'MOD-QAQC-PUNCH',
      name: 'QAQC Check Sheets & Punches',
      phase: 'P2',
      catalogState: 'Beta',
      deploymentState: 'Installed',
      projectState: 'Pilot',
      userGrant: 'Allowed',
      isCore: false,
      description: 'Inspection test records (ITR), Cat A/B punches, verification.'
    },
    {
      id: 'MOD-OFFSHORE-HUC',
      name: 'T&I and Offshore HUC',
      phase: 'P3',
      catalogState: 'Planned',
      deploymentState: 'Not installed',
      projectState: 'Disabled',
      userGrant: 'Inherited',
      isCore: false,
      description: 'Marine spread bookings, offshore sequence, hookup campaigns.'
    }
  ],

  // Canonical Work Packages (§4.1, §6.2 ENG-01, §6.3 PLAN-01)
  workPackages: [
    {
      id: 'WP-100',
      wbs: '1.0',
      code: 'WP-100-ENG',
      title: 'Detailed Engineering & Design',
      discipline: 'Engineering',
      weight: 18.0, // 18% of project
      plannedPercent: 96.0,
      actualPercent: 92.5,
      variance: -3.5,
      owner: 'Elena Rostova',
      status: 'In execution',
      creditMethod: 'Weighted Deliverables'
    },
    {
      id: 'WP-200',
      wbs: '2.0',
      code: 'WP-200-PROC',
      title: 'Major Equipment & Bulk Procurement',
      discipline: 'Procurement',
      weight: 32.0, // 32% of project
      plannedPercent: 88.0,
      actualPercent: 81.4,
      variance: -6.6,
      owner: 'David Miller',
      status: 'In execution',
      creditMethod: 'Weighted Milestones'
    },
    {
      id: 'WP-300',
      wbs: '3.0',
      code: 'WP-300-YARD',
      title: 'Yard Fabrication & Module Assembly',
      discipline: 'Construction',
      weight: 35.0, // 35% of project
      plannedPercent: 54.0,
      actualPercent: 51.2,
      variance: -2.8,
      owner: 'Tuan Nguyen',
      status: 'In execution',
      creditMethod: 'Quantity & Stages'
    },
    {
      id: 'WP-400',
      wbs: '4.0',
      code: 'WP-400-PRECOM',
      title: 'Onshore Pre-commissioning',
      discipline: 'Commissioning',
      weight: 10.0, // 10% of project
      plannedPercent: 22.0,
      actualPercent: 18.0,
      variance: -4.0,
      owner: 'Sarah Jenkins',
      status: 'In execution',
      creditMethod: 'Check Sheet Count'
    },
    {
      id: 'WP-500',
      wbs: '5.0',
      code: 'WP-500-OFFSHORE',
      title: 'T&I and Offshore Hook-Up (HUC)',
      discipline: 'Offshore',
      weight: 5.0, // 5% of project
      plannedPercent: 0.0,
      actualPercent: 0.0,
      variance: 0.0,
      owner: 'Sarah Jenkins',
      status: 'Planned',
      creditMethod: 'Binary Milestones'
    }
  ],

  // S-Curve Data Points for Golden Ray Topsides (§5.1, §6.1 DASH-02)
  sCurveData: [
    { period: 'May 25', planned: 5.0, actual: 5.2, pending: 0.0 },
    { period: 'Jul 25', planned: 14.0, actual: 13.8, pending: 0.5 },
    { period: 'Sep 25', planned: 25.0, actual: 23.5, pending: 1.0 },
    { period: 'Nov 25', planned: 36.0, actual: 33.2, pending: 1.8 },
    { period: 'Jan 26', planned: 46.0, actual: 43.0, pending: 2.1 },
    { period: 'Mar 26', planned: 54.0, actual: 50.8, pending: 2.5 },
    { period: 'May 26', planned: 60.0, actual: 56.4, pending: 3.0 },
    { period: 'Jul 26', planned: 64.0, actual: 60.1, pending: 2.8 },
    { period: 'Sep 26', planned: 66.0, actual: 62.4, pending: 2.0 },
    { period: 'Nov 26 (Cutoff)', planned: 67.8, actual: 64.2, pending: 2.4 },
    { period: 'Jan 27 (Forecast)', planned: 76.0, actual: null, forecast: 71.5 },
    { period: 'Mar 27 (Forecast)', planned: 85.0, actual: null, forecast: 80.0 },
    { period: 'May 27 (Forecast)', planned: 94.0, actual: null, forecast: 89.0 },
    { period: 'Jul 27 (Target)', planned: 100.0, actual: null, forecast: 97.5 }
  ],

  // Master Document Register (MDR) (§6.8 DOC-01..16)
  documents: [
    {
      id: 'DOC-001',
      docNumber: 'GLD-ENG-DWG-0014',
      title: 'Topsides Module M10 Structural Framing Plan Deck 1',
      discipline: 'Structural',
      registerType: 'MDR',
      semanticRegister: 'Engineering MDR',
      packageId: 'WP-100',
      owningParty: 'Main Contractor Engineering',
      rev: 'Rev 0',
      purpose: 'IFC (Issued for Construction)',
      status: 'Released for Use',
      clientStatus: 'Code 1 (Approved)',
      caStatus: 'Code 1 (DNV Approved)',
      mwsStatus: 'Code 1 (CoA Issued)',
      hasBlockingCrs: false,
      releasedToClient: true,
      lastModified: '2026-10-24',
      pic: 'Elena Rostova',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb924',
      size: '14.8 MB',
      fileType: 'PDF'
    },
    {
      id: 'DOC-002',
      docNumber: 'GLD-M10-PID-0021',
      title: 'P&ID High Pressure Separation & Gas Compression Train A',
      discipline: 'Process',
      registerType: 'MDR',
      semanticRegister: 'Engineering MDR',
      packageId: 'WP-100',
      owningParty: 'Main Contractor Engineering',
      rev: 'Rev C',
      purpose: 'IFA (Issued for Approval)',
      status: 'Under Client Review',
      clientStatus: 'Code 2 (Approved with Comments)',
      caStatus: 'Under Review',
      mwsStatus: 'Not Required',
      hasBlockingCrs: true, // Has unresolved blocking comment!
      releasedToClient: true,
      lastModified: '2026-11-02',
      pic: 'Elena Rostova',
      checksum: '9f86d081884c7d659a2feaa0c55ad015',
      size: '8.4 MB',
      fileType: 'PDF'
    },
    {
      id: 'DOC-003',
      docNumber: 'GLD-VDR-DS-0105',
      title: 'Gas Turbine Compressor Skid Datasheet & Dynamic Load Analysis',
      discipline: 'Mechanical',
      registerType: 'VDR',
      semanticRegister: 'Vendor VDR / SDRL',
      packageId: 'WP-200',
      owningParty: 'Siemens Energy Oil & Gas',
      poNumber: 'PO-4500128',
      rev: 'Rev 2',
      purpose: 'IFR (Issued for Review)',
      status: 'Technical Hold',
      clientStatus: 'Code 3 (Revise & Resubmit)',
      caStatus: 'Code 3 (Hold - Vibration Specs)',
      mwsStatus: 'Not Required',
      hasBlockingCrs: true,
      releasedToClient: true,
      lastModified: '2026-10-18',
      pic: 'David Miller',
      checksum: '4b227777d4dd1fc61c6f884f48641d02',
      size: '22.1 MB',
      fileType: 'PDF'
    },
    {
      id: 'DOC-004',
      docNumber: 'GLD-MWS-MTH-0008',
      title: 'Topsides Module M10 & M20 Loadout and Sea Fastening Procedure',
      discipline: 'Marine & T&I',
      registerType: 'MDR',
      semanticRegister: 'Engineering MDR',
      packageId: 'WP-500',
      owningParty: 'T&I Subcontractor Heerema',
      rev: 'Rev 1',
      purpose: 'IFA (Issued for Approval)',
      status: 'Awaiting MWS CoA',
      clientStatus: 'Code 1 (Approved)',
      caStatus: 'Code 1 (Class Approved)',
      mwsStatus: 'Code 2 (MWS Pending CoA Endorsement)',
      hasBlockingCrs: false,
      releasedToClient: true,
      lastModified: '2026-10-30',
      pic: 'Sarah Jenkins',
      checksum: 'ef2d127de37b942baad06145e54b0c61',
      size: '34.6 MB',
      fileType: 'PDF'
    },
    {
      id: 'DOC-005',
      docNumber: 'GLD-QAQC-ITP-0045',
      title: 'Inspection & Test Plan: Piping Pressure Testing & NDE Batam Yard',
      discipline: 'QAQC',
      registerType: 'MDR',
      semanticRegister: 'Engineering MDR',
      packageId: 'WP-300',
      owningParty: 'Main Contractor QAQC',
      rev: 'Rev 0',
      purpose: 'IFC (Issued for Construction)',
      status: 'Released for Use',
      clientStatus: 'Code 1 (Approved)',
      caStatus: 'Code 1 (Approved)',
      mwsStatus: 'Not Required',
      hasBlockingCrs: false,
      releasedToClient: false, // Internal release only!
      lastModified: '2026-09-12',
      pic: 'Tuan Nguyen',
      checksum: '0123456789abcdef0123456789abcdef',
      size: '5.2 MB',
      fileType: 'PDF'
    }
  ],

  // Comment Resolution Sheet (CRS) (§6.8 DOC-11)
  crsComments: [
    {
      id: 'CRS-042',
      docNumber: 'GLD-M10-PID-0021',
      docRev: 'Rev C',
      commentNumber: 'EQ-PRC-01',
      reviewerParty: 'Client (Equinor)',
      reviewerName: 'Johan Vries',
      sheetPage: 'Sheet 02, Zone C-4',
      discipline: 'Process Safety',
      category: 'Major / Safety Critical',
      commentText: 'PSV-1021 discharge line must include car-sealed open isolation bypass with pressure transducer interlock to ESD-1.',
      contractorResponse: 'Agreed. Interlock added to cause & effect matrix and shown on Sheet 02 revision D draft.',
      responderPic: 'Elena Rostova',
      reviewerDisposition: 'Under Review', // Open -> Responded -> Awaiting reviewer acceptance -> Closed
      isBlocking: true, // Blocks release for use!
      status: 'Awaiting Client Signoff',
      dateRaised: '2026-10-28',
      dateResponded: '2026-11-03'
    },
    {
      id: 'CRS-043',
      docNumber: 'GLD-VDR-DS-0105',
      docRev: 'Rev 2',
      commentNumber: 'CA-DNV-03',
      reviewerParty: 'CA (DNV Maritime)',
      reviewerName: 'Henrik Larsson',
      sheetPage: 'Section 4.2 Dynamic Loads',
      discipline: 'Mechanical',
      category: 'Design Verification',
      commentText: 'Dynamic skid natural frequency is within 8% of 1st harmonic compressor operating speed (3,600 RPM). Skid stiffening required to achieve 20% margin per API 617.',
      contractorResponse: 'Vendor Siemens notified under Concern VCON-012. Structural gussets being reinforced.',
      responderPic: 'David Miller',
      reviewerDisposition: 'Open / Blocking',
      isBlocking: true,
      status: 'Open Blocker',
      dateRaised: '2026-10-19',
      dateResponded: '2026-10-25'
    },
    {
      id: 'CRS-044',
      docNumber: 'GLD-ENG-DWG-0014',
      docRev: 'Rev 0',
      commentNumber: 'CL-STR-09',
      reviewerParty: 'Client (Equinor)',
      reviewerName: 'Johan Vries',
      sheetPage: 'Grid Line 4 / Row B',
      discipline: 'Structural',
      category: 'Minor / Editorial',
      commentText: 'Clarify weld symbol for padeye gusset backing bar.',
      contractorResponse: 'Full penetration butt weld symbol with NDE class 1 added on detail W-12.',
      responderPic: 'Elena Rostova',
      reviewerDisposition: 'Accepted & Closed',
      isBlocking: false,
      status: 'Closed',
      dateRaised: '2026-10-15',
      dateResponded: '2026-10-20'
    }
  ],

  // Transmittals (§6.8 DOC-07)
  transmittals: [
    {
      id: 'TRN-2026-089',
      number: 'TR-GLD-EQN-OUT-0089',
      direction: 'Outgoing to Client',
      recipient: 'Equinor / Petrobras JV',
      attn: 'Johan Vries',
      purpose: 'Issued for Client Review (IFA)',
      documentsCount: 4,
      issueDate: '2026-11-02',
      dueDate: '2026-11-16 (14 Days)',
      status: 'Issued / Pending Client Return',
      sender: 'Elena Rostova'
    },
    {
      id: 'TRN-2026-088',
      number: 'TR-GLD-DNV-OUT-0088',
      direction: 'Outgoing to CA',
      recipient: 'DNV Certification Authority',
      attn: 'Henrik Larsson',
      purpose: 'Issued for Verification (IFV)',
      documentsCount: 2,
      issueDate: '2026-10-29',
      dueDate: '2026-11-12',
      status: 'Partially Returned',
      sender: 'Elena Rostova'
    },
    {
      id: 'TRN-2026-082',
      number: 'TR-SIE-GLD-IN-0042',
      direction: 'Incoming from Vendor',
      recipient: 'Project Flow Document Control',
      attn: 'David Miller',
      purpose: 'Vendor Data Submission (Rev 2)',
      documentsCount: 6,
      issueDate: '2026-10-18',
      dueDate: '2026-11-01',
      status: 'Returned with Code 3',
      sender: 'Siemens Energy Document Lead'
    }
  ],

  // Major Equipment & Procurement Register (§7.1 PROC-01..03)
  purchaseOrders: [
    {
      id: 'PO-4500128',
      poNumber: 'PO-4500128',
      title: 'Gas Turbine Compressor Packages (2 Trains)',
      vendor: 'Siemens Energy AG, Duisburg',
      packageId: 'WP-200',
      currency: 'USD',
      commercialValue: '$ 42,500,000', // Restricted commercial field!
      requiredOnSite: '2026-12-15',
      forecastArrival: '2027-01-14',
      varianceDays: 30, // 30 days late!
      status: 'Late - Recovery Action Plan',
      criticality: 'Critical (Tier 1)',
      expeditor: 'David Miller',
      manufacturingProgress: 76.5,
      plannedProgress: 88.0
    },
    {
      id: 'PO-4500135',
      poNumber: 'PO-4500135',
      title: 'HP Test Separator & Coalescer Vessels',
      vendor: 'Belleli Energy CPE, Mantova',
      packageId: 'WP-200',
      currency: 'USD',
      commercialValue: '$ 18,200,000',
      requiredOnSite: '2026-11-30',
      forecastArrival: '2026-11-28',
      varianceDays: -2, // On time
      status: 'In Transit / Sea Freight',
      criticality: 'High (Tier 2)',
      expeditor: 'David Miller',
      manufacturingProgress: 100.0,
      plannedProgress: 100.0
    },
    {
      id: 'PO-4500142',
      poNumber: 'PO-4500142',
      title: 'Subsea Inconel 625 Clad Gate Valves 12" 10k',
      vendor: 'Cameron (Schlumberger), Celle',
      packageId: 'WP-200',
      currency: 'USD',
      commercialValue: '$ 9,450,000',
      requiredOnSite: '2026-12-01',
      forecastArrival: '2026-12-10',
      varianceDays: 9, // 9 days late
      status: 'FAT Witness Pending',
      criticality: 'Critical (Tier 1)',
      expeditor: 'David Miller',
      manufacturingProgress: 91.0,
      plannedProgress: 95.0
    },
    {
      id: 'PO-4500155',
      poNumber: 'PO-4500155',
      title: 'Emergency Diesel Generator 2.8 MW Skid',
      vendor: 'Caterpillar / Pon Power, Oslo',
      packageId: 'WP-200',
      currency: 'USD',
      commercialValue: '$ 6,100,000',
      requiredOnSite: '2027-01-20',
      forecastArrival: '2027-01-18',
      varianceDays: -2,
      status: 'Assembly in Progress',
      criticality: 'Medium (Tier 3)',
      expeditor: 'David Miller',
      manufacturingProgress: 68.0,
      plannedProgress: 70.0
    }
  ],

  // Vendor Production Schedule Monitoring (Revision 1.2 §7.2.1 VPROD-01..10)
  // Dedicated to PO-4500128: Siemens Gas Compression Skid
  vendorProduction: {
    poId: 'PO-4500128',
    vendor: 'Siemens Energy AG',
    equipment: 'M10 Compressor Package Trains A & B',
    location: 'Duisburg Factory, Germany',
    expeditorPic: 'David Miller',
    reportingCutoff: '2026-11-06 (Week 45)',
    plannedOverallProgress: 88.0,
    reportedVendorProgress: 82.0,
    acceptedExpeditorProgress: 76.5, // §5.1, §7.2.1 VPROD-05
    finishVarianceWorkingDays: 22, // +22 working days late
    siteArrivalExposure: 'High Risk - 30 Calendar Days Delay',
    transportAssumption: '30 days sea freight via Rotterdam to Batam Yard (confirmed with Bollore Logistics)',

    // Manufacturing Schedule Milestones & Stages (VPROD-03)
    milestones: [
      {
        id: 'VM-01',
        activity: 'Engineering & Vendor Data Submissions',
        baselineFinish: '2026-04-15',
        forecastFinish: '2026-05-10',
        actualFinish: '2026-05-10',
        weight: 10,
        plannedPercent: 100,
        acceptedPercent: 100,
        status: 'Completed',
        evidence: 'VDR Rev 1 Approved with Comments'
      },
      {
        id: 'VM-02',
        activity: 'Raw Forging & Casing Procurement',
        baselineFinish: '2026-06-30',
        forecastFinish: '2026-07-20',
        actualFinish: '2026-07-25',
        weight: 20,
        plannedPercent: 100,
        acceptedPercent: 100,
        status: 'Completed',
        evidence: 'Material Test Certificates 3.1 EN 10204 verified'
      },
      {
        id: 'VM-03',
        activity: 'Impeller CNC Machining & Rotor Assembly',
        baselineFinish: '2026-08-30',
        forecastFinish: '2026-09-28',
        actualFinish: '2026-10-05',
        weight: 25,
        plannedPercent: 100,
        acceptedPercent: 100,
        status: 'Completed',
        evidence: 'Over-speed test report 115% signed off'
      },
      {
        id: 'VM-04',
        activity: 'Baseframe Skid Structural Reinforcement',
        baselineFinish: '2026-09-15',
        forecastFinish: '2026-10-30',
        actualFinish: '2026-11-04',
        weight: 15,
        plannedPercent: 100,
        acceptedPercent: 90,
        status: 'In Progress / Final NDE',
        evidence: 'MPI inspection record pending Class DNV'
      },
      {
        id: 'VM-05',
        activity: 'String Test & Mechanical Run / FAT Witness',
        baselineFinish: '2026-10-25',
        forecastFinish: '2026-11-24',
        actualFinish: null,
        weight: 15,
        plannedPercent: 70,
        acceptedPercent: 0,
        status: 'Late - Witness Point Scheduled',
        evidence: 'FAT Procedure GLD-FAT-002 Rev 1'
      },
      {
        id: 'VM-06',
        activity: 'Preservation, Packing & Sea Fastening',
        baselineFinish: '2026-11-10',
        forecastFinish: '2026-12-08',
        actualFinish: null,
        weight: 10,
        plannedPercent: 20,
        acceptedPercent: 0,
        status: 'Pending FAT',
        evidence: 'Nitrogen purge procedure'
      },
      {
        id: 'VM-07',
        activity: 'Dispatch & Port Clearance Antwerp/Rotterdam',
        baselineFinish: '2026-11-15',
        forecastFinish: '2026-12-15',
        actualFinish: null,
        weight: 5,
        plannedPercent: 0,
        acceptedPercent: 0,
        status: 'Pending Dispatch',
        evidence: 'Shipping booking BLL-9982'
      }
    ],

    // Vendor Management Highlights (VPROD-07)
    highlights: [
      {
        id: 'VHL-001',
        date: '2026-11-04',
        author: 'David Miller (Expeditor)',
        text: 'Successful dynamic over-speed test of Train B high-pressure rotor verified at 14,200 RPM. Zero vibration peaks detected.',
        category: 'Technical Success',
        visibility: 'Shared with Project Team'
      },
      {
        id: 'VHL-002',
        date: '2026-10-28',
        author: 'David Miller (Expeditor)',
        text: 'Shop visit to Duisburg plant completed. Siemens added a 2nd shift (6 technicians) dedicated to pipe spool pre-assembly on Train A.',
        category: 'Recovery Progress',
        visibility: 'Shared with Project Team'
      }
    ],

    // Vendor Concerns & Bottlenecks (VPROD-06, VPROD-08)
    concerns: [
      {
        id: 'VCON-012',
        title: 'Skid Baseframe Resonance Vibration Issue (CRS-043)',
        consequence: 'DNV Class hold preventing string test startup. Potential 3-week delay to FAT.',
        owner: 'David Miller',
        status: 'Mitigation in Progress',
        severity: 'Critical',
        actionTask: 'TSK-084-019',
        recoveryPlan: 'Siemens engineering submitted weld reinforcement drawing. Stiffener plates tack-welded yesterday.',
        targetClosure: '2026-11-12'
      },
      {
        id: 'VCON-015',
        title: 'Lube Oil Cooler Sub-Vendor Casting Delay',
        consequence: 'Sub-supplier in Brescia, Italy experienced foundry furnace shutdown.',
        owner: 'David Miller',
        status: 'Contained',
        severity: 'Medium',
        actionTask: 'TSK-084-023',
        recoveryPlan: 'Air-freighted alternative spare cooler core from Siemens Houston warehouse.',
        targetClosure: '2026-11-18'
      }
    ],

    // Vendor Risks (VPROD-06)
    risks: [
      {
        id: 'VRISK-004',
        title: 'European Winter Barge Congestion on Rhine River',
        cause: 'Low Rhine water levels or winter ice near Duisburg port.',
        effect: 'Barge transport to Rotterdam delayed by 7-10 days.',
        probability: 3,
        impact: 4,
        score: 12,
        mitigation: 'Booked road heavy-haul transport permits as contractual contingency.',
        owner: 'David Miller'
      }
    ]
  },

  // Canonical Tasks (§6.7 TASK-01..12)
  // Shared between My Workspace and Project Tasks!
  tasks: [
    {
      id: 'TSK-084-012',
      code: 'TSK-012',
      title: 'Review CRS-042 PSV Bypass Safety Interlock with Equinor',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Document Control',
      sourceEntity: 'CRS',
      sourceId: 'CRS-042',
      pic: 'Elena Rostova',
      assignedBy: 'Sarah Jenkins',
      priority: 'Urgent',
      status: 'Submitted for review',
      dueDate: '2026-11-09',
      estimatedHours: 4,
      actualHours: 3.5,
      isPrivate: false,
      isClientVisible: true,
      description: 'Formalize agreement with Johan Vries on PSV bypass ESD-1 interlock configuration.'
    },
    {
      id: 'TSK-084-019',
      code: 'TSK-019',
      title: 'Witness MPI Inspection of Reinforcement Gussets on Compressor Skid',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Expediting',
      sourceEntity: 'Vendor Concern',
      sourceId: 'VCON-012',
      pic: 'David Miller',
      assignedBy: 'Sarah Jenkins',
      priority: 'High',
      status: 'In progress',
      dueDate: '2026-11-11',
      estimatedHours: 8,
      actualHours: 4,
      isPrivate: false,
      isClientVisible: false,
      description: 'Coordinate with DNV surveyor at Siemens Duisburg shop for magnetic particle inspection signoff.'
    },
    {
      id: 'TSK-084-021',
      code: 'TSK-021',
      title: 'Release Workfront WF-101 Structural Laydown Clearance',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Construction',
      sourceEntity: 'Workfront Gate',
      sourceId: 'WF-101',
      pic: 'Tuan Nguyen',
      assignedBy: 'Sarah Jenkins',
      priority: 'Normal',
      status: 'Assigned',
      dueDate: '2026-11-14',
      estimatedHours: 6,
      actualHours: 1,
      isPrivate: false,
      isClientVisible: false,
      description: 'Verify all structural drawings are Rev 0 IFC and material mill certs are cleared in Batam store.'
    },
    {
      id: 'TSK-084-022',
      code: 'TSK-022',
      title: 'Close Punch PCH-M10-001 on Compressor Train Foundation Bolts',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'QAQC',
      sourceEntity: 'Punch',
      sourceId: 'PCH-001',
      pic: 'Tuan Nguyen',
      assignedBy: 'Elena Rostova',
      priority: 'High',
      status: 'In progress',
      dueDate: '2026-11-10',
      estimatedHours: 5,
      actualHours: 3,
      isPrivate: false,
      isClientVisible: true,
      description: 'Re-torque foundation anchor bolts to 850 Nm with calibrated torque wrench and re-apply sealant.'
    },
    {
      id: 'TSK-084-023',
      code: 'TSK-023',
      title: 'Track Air-Freight Tracking for Lube Oil Cooler Replacement',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Expediting',
      sourceEntity: 'Vendor Concern',
      sourceId: 'VCON-015',
      pic: 'David Miller',
      assignedBy: 'David Miller',
      priority: 'Normal',
      status: 'Assigned',
      dueDate: '2026-11-13',
      estimatedHours: 2,
      actualHours: 0.5,
      isPrivate: false,
      isClientVisible: false,
      description: 'Monitor DHL Air Cargo AWB-883921 from Houston to Frankfurt logistics hub.'
    },
    {
      id: 'TSK-084-024',
      code: 'TSK-024',
      title: 'Finalize Week 45 Executive Progress Snapshot for Client Publication',
      projectId: 'PRJ-084',
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Planning',
      sourceEntity: 'Reporting Snapshot',
      sourceId: 'SNP-2026-W45',
      pic: 'Michael Chen',
      assignedBy: 'Sarah Jenkins',
      priority: 'Urgent',
      status: 'In progress',
      dueDate: '2026-11-08',
      estimatedHours: 4,
      actualHours: 2.5,
      isPrivate: false,
      isClientVisible: true,
      description: 'Lock cutoff inputs, review variance notes, and submit for PM approval.'
    }
  ],

  // Private Personal Tasks (§6.7 TASK-01..03)
  // Visible ONLY to the current user in My Workspace! Can be converted to Project Task!
  privateTasks: [
    {
      id: 'PVT-001',
      title: 'Review confidential contract amendment #4 with Commercial Director',
      ownerId: 'USR-001', // Sarah Jenkins
      priority: 'Urgent',
      dueDate: '2026-11-09',
      isCompleted: false,
      notes: 'Evaluate liquidated damages exposure on Siemens compressor delay ($50k/day cap at $2M).',
      checklist: [
        { text: 'Check force majeure clause for European strikes', done: true },
        { text: 'Calculate actual delay days based on Batam float', done: false }
      ]
    },
    {
      id: 'PVT-002',
      title: 'Draft personal performance review for Elena and Michael',
      ownerId: 'USR-001',
      priority: 'Normal',
      dueDate: '2026-11-15',
      isCompleted: false,
      notes: 'Prepare Q4 appraisals before annual talent council.',
      checklist: [
        { text: 'Review Elena document audit score', done: true },
        { text: 'Assess Michael scheduling accuracy KPI', done: false }
      ]
    },
    {
      id: 'PVT-003',
      title: 'Prepare executive talking points for monthly Board meeting',
      ownerId: 'USR-001',
      priority: 'High',
      dueDate: '2026-11-12',
      isCompleted: false,
      notes: 'Focus on Campos Basin sailaway target preserved despite compressor recovery schedule.',
      checklist: []
    }
  ],

  // Yard Layout & 2D Facility Plan (P2 preview §8.1 CON-01, DEC-08)
  yardZones: [
    {
      id: 'ZONE-A',
      name: 'Assembly Hall 1 (Heavy Modular)',
      x: 100, y: 80, width: 240, height: 160,
      color: 'rgba(52, 60, 120, 0.1)',
      borderColor: '#343c78',
      activeModule: 'Module M10 Compression',
      pins: [
        {
          id: 'PIN-01',
          code: 'WF-101',
          type: 'workfront',
          label: 'WF-101: M10 Structural Deck Assembly',
          x: 160, y: 130,
          status: 'Ready / Released',
          gateEngineering: 'Passed (Rev 0 IFC)',
          gateMaterials: 'Passed (100% Available)',
          gateQAQC: 'Passed (Zero Open Cat A Punches)',
          gateHSE: 'Passed (PTW-BAT-442 Active)'
        },
        {
          id: 'PIN-02',
          code: 'PCH-001',
          type: 'punch',
          label: 'Cat A Punch: Anchor Bolt Torque',
          x: 230, y: 170,
          status: 'Rectification in Progress',
          blocking: true
        }
      ]
    },
    {
      id: 'ZONE-B',
      name: 'Blast & Paint Bay 3',
      x: 380, y: 80, width: 180, height: 160,
      color: 'rgba(0, 135, 125, 0.1)',
      borderColor: '#00877d',
      activeModule: 'Pipe Spool Coating',
      pins: [
        {
          id: 'PIN-03',
          code: 'WF-104',
          type: 'workfront',
          label: 'WF-104: 3-Coat Epoxy Application on Manifold',
          x: 460, y: 140,
          status: 'In Execution',
          gateEngineering: 'Passed',
          gateMaterials: 'Passed',
          gateQAQC: 'Witness Point Hold (DFT Test)',
          gateHSE: 'Passed'
        }
      ]
    },
    {
      id: 'ZONE-C',
      name: 'Laydown Yard East',
      x: 100, y: 280, width: 240, height: 150,
      color: 'rgba(140, 87, 0, 0.1)',
      borderColor: '#8c5700',
      activeModule: 'Equipment Staging & Preservation',
      pins: [
        {
          id: 'PIN-04',
          code: 'MAT-992',
          type: 'material',
          label: 'Separators PO-4500135 Quarantine / Receipt',
          x: 200, y: 340,
          status: 'MRR Inspection Scheduled',
          blocking: false
        }
      ]
    },
    {
      id: 'ZONE-D',
      name: 'Quayside Loadout Berth 2',
      x: 380, y: 280, width: 260, height: 150,
      color: 'rgba(36, 91, 165, 0.1)',
      borderColor: '#245ba5',
      activeModule: 'Barge Mobilization & Heavy Lift',
      pins: [
        {
          id: 'PIN-05',
          code: 'MWS-01',
          type: 'mws',
          label: 'MWS Barge H-403 Ballast Inspection',
          x: 480, y: 330,
          status: 'Awaiting CoA Signoff',
          blocking: true
        }
      ]
    }
  ],

  // Check Sheets & Punches (P2 preview §9.1 COM-01..03)
  punches: [
    {
      id: 'PCH-001',
      code: 'PCH-M10-001',
      category: 'Cat A (Pre-Commissioning Blocking)',
      tag: 'C-1010-SKD',
      system: 'SYS-10 Compression Train A',
      location: 'Assembly Hall 1, Skid Foundation',
      description: 'Anchor bolt #8 and #12 torque verified at 650 Nm against required 850 Nm.',
      owner: 'Tuan Nguyen',
      verifier: 'Elena Rostova',
      raisedDate: '2026-10-31',
      dueDate: '2026-11-10',
      status: 'Rectified / Verification Scheduled',
      actionTask: 'TSK-084-022'
    },
    {
      id: 'PCH-002',
      code: 'PCH-M10-004',
      category: 'Cat B (Non-Blocking Handover)',
      tag: 'PT-1024',
      system: 'SYS-10 Instrumentation',
      location: 'M10 Mezzanine Deck',
      description: 'Cable tray identification tag missing yellow reflective safety band.',
      owner: 'Tuan Nguyen',
      verifier: 'Tuan Nguyen',
      raisedDate: '2026-11-03',
      dueDate: '2026-11-20',
      status: 'Open',
      actionTask: null
    },
    {
      id: 'PCH-003',
      code: 'PCH-M20-009',
      category: 'Cat A (Pre-Commissioning Blocking)',
      tag: 'V-2010',
      system: 'SYS-20 Separation',
      location: 'Separation Skid Deck 2',
      description: 'Flange insulation gasket damaged during hydrotest reassembly. Replacement required.',
      owner: 'Tuan Nguyen',
      verifier: 'Johan Vries (Client)',
      raisedDate: '2026-11-01',
      dueDate: '2026-11-08',
      status: 'Open Blocker',
      actionTask: null
    }
  ],

  // Management Registers: Risks, Issues, MOC (§6.4 MGT-01..05)
  risks: [
    {
      id: 'RSK-084-001',
      title: 'Siemens Gas Compressor Skid Delivery Delay Impacting Batam Integration',
      category: 'Procurement / Schedule',
      cause: 'European casting supplier strike and baseframe dynamic vibration redesign.',
      effect: 'Module M10 integration float consumed; potential 3-week delay to Batam mechanical completion.',
      owner: 'David Miller',
      likelihood: 4, // 1 to 5
      consequence: 4, // 1 to 5
      inherentScore: 16, // Critical Red
      residualLikelihood: 2,
      residualConsequence: 3,
      residualScore: 6, // Managed Yellow
      mitigationPlan: 'Siemens authorized 2-shift overtime. Parallel workfronts created in Yard Assembly Hall 1.',
      status: 'Active / Under Mitigation',
      reviewDate: '2026-11-12'
    },
    {
      id: 'RSK-084-002',
      title: 'Monsoon Sea State Delay during Module Loadout to Transport Barge',
      category: 'Marine / T&I',
      cause: 'December swell waves exceeding 2.0m significant wave height at Batam quayside.',
      effect: 'Barge grounding or loadout window missed.',
      owner: 'Sarah Jenkins',
      likelihood: 3,
      consequence: 4,
      inherentScore: 12, // Amber
      residualLikelihood: 2,
      residualConsequence: 2,
      residualScore: 4,
      mitigationPlan: 'Ballast simulation approved by MWS. Standby tug chartered for prompt maneuver.',
      status: 'Active',
      reviewDate: '2026-11-15'
    },
    {
      id: 'RSK-084-003',
      title: 'Inconel Clad Piping Welding Repair Rate Exceedance',
      category: 'Quality / Yard',
      cause: 'Welder qualification drift on 6G orbital GTAW welding.',
      effect: 'Radiographic testing reject rate exceeds 4% project threshold.',
      owner: 'Tuan Nguyen',
      likelihood: 2,
      consequence: 3,
      inherentScore: 6,
      residualLikelihood: 1,
      residualConsequence: 2,
      residualScore: 2,
      mitigationPlan: 'Re-certified 12 welders; purging gas oxygen analyzer calibrated daily.',
      status: 'Controlled',
      reviewDate: '2026-11-20'
    }
  ],

  // Issues Register (§6.4 MGT-02)
  issues: [
    {
      id: 'ISS-084-008',
      title: 'Missing MWS Certificate of Approval for Module M10 Heavy Lift Padeyes',
      severity: 'Critical Blocker',
      owner: 'Sarah Jenkins',
      targetDate: '2026-11-10',
      containment: 'Loadout rigging stopped pending MWS calculation report signoff.',
      status: 'In Progress',
      actionTask: 'TSK-084-012'
    },
    {
      id: 'ISS-084-009',
      title: 'Quarantined 2" Stainless Valves due to Missing Heat Numbers on MTC',
      severity: 'Medium',
      owner: 'David Miller',
      targetDate: '2026-11-14',
      containment: 'Valves physically segregated in Laydown East quarantine rack.',
      status: 'Open',
      actionTask: null
    }
  ],

  // Management of Change (MOC) (§6.4 MGT-04)
  mocs: [
    {
      id: 'MOC-084-003',
      code: 'MOC-003',
      title: 'Upgrade Gas Compressor Train B Anti-Surge Valve from 8" to 10"',
      reason: 'Dynamic process simulation showed potential surge condition under rapid emergency depressurization.',
      scheduleImpact: '+10 Days to Valve delivery (absorbed in Yard float)',
      costImpact: '+$ 240,000 USD',
      initiator: 'Michael Chen',
      leadReviewer: 'Elena Rostova',
      approver: 'Sarah Jenkins (PM)',
      status: 'Approved & Implementing',
      clientApproved: true,
      effectiveDate: '2026-10-15'
    },
    {
      id: 'MOC-084-004',
      code: 'MOC-004',
      title: 'Relocate Firewater Deluge Foam Skid on M50 Quarters Deck',
      reason: 'Helideck safety clearance compliance under CAP 437 requirement.',
      scheduleImpact: 'Zero Schedule Impact',
      costImpact: '+$ 45,000 USD',
      initiator: 'Tuan Nguyen',
      leadReviewer: 'Elena Rostova',
      approver: 'Sarah Jenkins (PM)',
      status: 'Under Assessment',
      clientApproved: false,
      effectiveDate: null
    }
  ],

  // Interface Management (§6.5 INT-01..03)
  interfaces: [
    {
      id: 'INT-084-001',
      code: 'IF-FPSO-HULL-01',
      title: 'Module M10 Seating Stool Alignment with Hull Deck Longitudinal Bulkhead',
      originatorParty: 'Topsides EPCIC Contractor',
      receivingParty: 'Hull Shipyard (Daewoo DSME)',
      coordinator: 'Elena Rostova',
      needDate: '2026-12-01',
      status: 'Agreed & Closed',
      blockingPoints: 0
    },
    {
      id: 'INT-084-002',
      code: 'IF-FPSO-TURRET-04',
      title: 'High Pressure Swivel Piping Tie-in Flange Rating & Loads (API 10k)',
      originatorParty: 'Topsides EPCIC Contractor',
      receivingParty: 'Turret Mooring Vendor (SBM Offshore)',
      coordinator: 'Michael Chen',
      needDate: '2026-11-25',
      status: 'Under Review',
      blockingPoints: 1
    }
  ],

  // Minutes of Meeting (MoM) (§6.6 REP-01)
  meetings: [
    {
      id: 'MOM-084-044',
      title: 'Weekly EPCIC Executive Progress & Expediting Review #44',
      date: '2026-11-04 14:00 UTC',
      location: 'Virtual MS Teams & Batam Yard Boardroom',
      attendees: 'Sarah Jenkins (PM), Michael Chen (Controls), Elena Rostova (Docs), David Miller (Expediting), Johan Vries (Client Rep)',
      decisions: [
        'Agreed recovery baseline schedule for Siemens Compressor package without altering overall Campos Basin sailaway date.',
        'MWS surveyor will attend Batam yard on 2026-11-12 for barge ballast system dry-run inspection.',
        'Client agreed in principle to MOC-003 valve upgrade; formal transmittal to be signed by Friday.'
      ],
      actionsGenerated: ['TSK-084-012', 'TSK-084-019', 'TSK-084-024'],
      status: 'Issued & Signed'
    }
  ],

  // Published Historical Snapshots (§5.2 PROG-07..09)
  snapshots: [
    {
      id: 'SNP-2026-W44',
      code: 'Snapshot W44 (2026-10-30)',
      period: 'Week 44 - October 2026',
      cutoffDate: '2026-10-30',
      overallProgress: 63.1,
      plannedProgress: 66.5,
      variance: -3.4,
      publishedBy: 'Sarah Jenkins',
      publishedAt: '2026-10-31 18:00 UTC',
      status: 'Locked / Published to Client'
    },
    {
      id: 'SNP-2026-W43',
      code: 'Snapshot W43 (2026-10-23)',
      period: 'Week 43 - October 2026',
      cutoffDate: '2026-10-23',
      overallProgress: 61.9,
      plannedProgress: 65.0,
      variance: -3.1,
      publishedBy: 'Sarah Jenkins',
      publishedAt: '2026-10-24 17:30 UTC',
      status: 'Locked / Published to Client'
    }
  ],

  // Audit Log (§4.2 CORE-08)
  auditLogs: [
    {
      timestamp: '2026-11-06 09:15 UTC',
      actor: 'David Miller',
      action: 'Updated Expediting Status',
      entity: 'PO-4500128',
      details: 'Recorded shop visit notes and updated manufacturing accepted progress to 76.5%.'
    },
    {
      timestamp: '2026-11-05 16:40 UTC',
      actor: 'Elena Rostova',
      action: 'Transmittal Issued',
      entity: 'TR-GLD-EQN-OUT-0089',
      details: 'Transmitted 4 deliverables including GLD-M10-PID-0021 Rev C to Equinor.'
    },
    {
      timestamp: '2026-11-04 11:20 UTC',
      actor: 'Sarah Jenkins',
      action: 'MOC Approved',
      entity: 'MOC-084-003',
      details: 'Approved Compressor Train B anti-surge valve upgrade with budget adjustment +$240k.'
    },
    {
      timestamp: '2026-11-03 14:05 UTC',
      actor: 'Johan Vries (Client)',
      action: 'CRS Comment Raised',
      entity: 'CRS-042',
      details: 'Raised safety critical comment on PSV-1021 discharge line bypass interlock.'
    }
  ]
};

// Make accessible globally
window.ProjectFlowData = ProjectFlowData;
