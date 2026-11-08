/* Project Flow — mock data layer for the v1_claude MVP demo.
   Everything here is static, in-memory sample data standing in for the
   backend described in the specification. No network calls are made. */

const DEMO = (() => {

  const users = [
    { id: 'u1', name: 'Alvaro Reyes', title: 'Project Manager', level: 'L1 — Project Manager', initials: 'AR', color: '#343C78' },
    { id: 'u2', name: 'Minh Tran', title: 'Engineering Manager', level: 'L2 — Manager', initials: 'MT', color: '#00877D' },
    { id: 'u3', name: 'Sofia Hernandez', title: 'Document Controller', level: 'L3 — Leader', initials: 'SH', color: '#245BA5' },
    { id: 'u4', name: 'Josh Okafor', title: 'Planning Engineer', level: 'L3 — Leader', initials: 'JO', color: '#8C5700' },
    { id: 'u5', name: 'Priya Nair', title: 'Procurement Lead', level: 'L3 — Leader', initials: 'PN', color: '#B42336' },
    { id: 'u6', name: 'Liam Carter', title: 'QA/QC Engineer', level: 'L4 — Team Member', initials: 'LC', color: '#176B45' },
    { id: 'u7', name: 'Grace Lindqvist', title: 'Client Representative', level: 'Client', initials: 'GL', color: '#526477' },
  ];

  const currentUser = users[0];

  const projects = [
    {
      id: 'p1', code: 'PF-2201', title: 'Keystone FPSO Topside EPCIC', short: 'Keystone FPSO',
      client: 'Meridian Energy Partners', type: 'FPSO Topside', location: 'Batam Yard, Indonesia',
      pm: 'Alvaro Reyes', stage: 'Active', lifecycle: 'Active', modules: 14,
      start: '2025-02-10', finish: '2027-01-15',
    },
    {
      id: 'p2', code: 'PF-2305', title: 'Nautilus Platform Jacket', short: 'Nautilus Jacket',
      client: 'Northwind Offshore', type: 'Fixed Jacket', location: 'Vung Tau Yard, Vietnam',
      pm: 'Alvaro Reyes', stage: 'Setup', lifecycle: 'Setup', modules: 9,
      start: '2026-05-01', finish: '2027-11-30',
    },
  ];

  let currentProjectId = 'p1';

  const nav = [
    { id: 'workspace', label: 'My Workspace', icon: 'inbox', group: null },
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', group: null },
    { id: 'tasks', label: 'Tasks Management', icon: 'check-square', group: null },
    { id: 'documents', label: 'Document Control', icon: 'file-text', group: null },
    { id: 'engineering', label: 'Engineering', icon: 'cpu', group: 'EPCIC' },
    { id: 'procurement', label: 'Procurement', icon: 'shopping-cart', group: 'EPCIC' },
    { id: 'planning', label: 'Planning & Progress', icon: 'trending-up', group: 'EPCIC' },
    { id: 'management', label: 'Management', icon: 'shield', group: null },
    { id: 'interfaces', label: 'Interface Management', icon: 'git-merge', group: null },
    { id: 'events', label: 'Event Management', icon: 'calendar', group: null },
    { id: 'reports', label: 'Reports', icon: 'bar-chart-2', group: null },
    { id: 'settings', label: 'Settings', icon: 'settings', group: null },
  ];

  // ---- Dashboard ----
  const dashboard = {
    overallProgress: { planned: 61.4, accepted: 57.8, cutoff: '2026-11-06', baseline: 'Baseline Rev C' },
    sCurve: {
      weeks: ['W40', 'W41', 'W42', 'W43', 'W44', 'W45', 'W46'],
      planned: [49, 52, 54, 56, 58, 60, 61.4],
      actual: [47, 49, 51, 53, 54.5, 56, 57.8],
    },
    milestones: [
      { name: 'Hull Mechanical Completion', baseline: '2026-10-20', forecast: '2026-11-18', status: 'Late', variance: -29 },
      { name: 'Topside Module 3 Lift', baseline: '2026-12-02', forecast: '2026-12-02', status: 'On track', variance: 0 },
      { name: 'Living Quarters HVAC FAT', baseline: '2026-11-25', forecast: '2026-11-22', status: 'Ahead', variance: 3 },
      { name: 'First Gas Readiness Review', baseline: '2027-03-10', forecast: '2027-03-10', status: 'On track', variance: 0 },
    ],
    overdue: [
      { title: 'Approve CRS-0042 — Firewater Pump Skid P&ID', due: '2026-11-02', owner: 'Minh Tran' },
      { title: 'Respond to INT-018 — Structural/Piping tie-in boundary', due: '2026-11-04', owner: 'Josh Okafor' },
      { title: 'Close NCR-2026-071 — Weld repair verification', due: '2026-11-05', owner: 'Liam Carter' },
    ],
    reviewQueue: [
      { doc: 'PF2201-E-PID-0031 Rev C', type: 'IFA', days: 2 },
      { doc: 'PF2201-M-DS-0088 Rev A', type: 'IFR', days: 5 },
      { doc: 'PF2201-V-GAD-0012 Rev B', type: 'IFC', days: 1 },
    ],
    reportingCompleteness: 0.87,
    kpis: [
      { label: 'Progress variance', value: '-3.6 pp', tone: 'critical' },
      { label: 'Reporting completeness', value: '87%', tone: 'warning' },
      { label: 'On-time delivery', value: '91%', tone: 'success' },
      { label: 'Open interfaces', value: '12', tone: 'info' },
    ],
  };

  // ---- Tasks ----
  const tasks = [
    { id: 'T-1042', title: 'Approve CRS-0042 — Firewater Pump Skid P&ID', source: 'Document Control', assignee: 'Minh Tran', priority: 'Urgent', status: 'In progress', due: '2026-11-02' },
    { id: 'T-1043', title: 'Respond to INT-018 structural/piping boundary', source: 'Interface Management', assignee: 'Josh Okafor', priority: 'High', status: 'Submitted for review', due: '2026-11-04' },
    { id: 'T-1044', title: 'Close NCR-2026-071 weld repair verification', source: 'QAQC', assignee: 'Liam Carter', priority: 'High', status: 'Blocked', due: '2026-11-05' },
    { id: 'T-1045', title: 'Prepare weekly progress report draft', source: 'Reports', assignee: 'Josh Okafor', priority: 'Normal', status: 'Draft', due: '2026-11-10' },
    { id: 'T-1046', title: 'Review vendor data for PO-4471 pump package', source: 'Procurement', assignee: 'Priya Nair', priority: 'Normal', status: 'Assigned', due: '2026-11-12' },
    { id: 'T-1047', title: 'Update engineering look-ahead for Piping discipline', source: 'Engineering', assignee: 'Minh Tran', priority: 'Low', status: 'Completed', due: '2026-10-28' },
    { id: 'T-1048', title: 'Validate MOC-009 HVAC capacity change', source: 'Management', assignee: 'Alvaro Reyes', priority: 'High', status: 'Under review', due: '2026-11-14' },
  ];

  const myDay = tasks.slice(0, 4);
  const inbox = [
    { title: 'Minh Tran mentioned you in CRS-0042', time: '09:14' },
    { title: 'New transmittal TR-0231 received for review', time: 'Yesterday' },
    { title: 'INT-018 escalated to Manager level', time: 'Yesterday' },
    { title: 'Weekly reporting cutoff in 2 days', time: '2 days ago' },
  ];

  // ---- Document Control ----
  const documents = [
    { no: 'PF2201-E-PID-0031', title: 'Firewater System P&ID — Module 2', discipline: 'Process', rev: 'C', purpose: 'IFA', status: 'Review in progress', due: '2026-11-09', owner: 'Minh Tran' },
    { no: 'PF2201-M-DS-0088', title: 'Pump Skid Datasheet — Firewater', discipline: 'Mechanical', rev: 'A', purpose: 'IFR', status: 'Response received', due: '2026-11-14', owner: 'Priya Nair' },
    { no: 'PF2201-V-GAD-0012', title: 'Living Quarters General Arrangement', discipline: 'Naval/Outfitting', rev: 'B', purpose: 'IFC', status: 'Authorized for issue', due: '2026-11-07', owner: 'Sofia Hernandez' },
    { no: 'PF2201-S-DRW-0147', title: 'Topside Module 3 Structural Steel Drawing', discipline: 'Structural', rev: 'D', purpose: 'AFC', status: 'Cycle closed', due: '—', owner: 'Josh Okafor' },
    { no: 'PF2201-I-LOG-0005', title: 'Cause & Effect Matrix — Fire & Gas', discipline: 'Instrumentation', rev: 'B', purpose: 'IFA', status: 'Revision required', due: '2026-11-11', owner: 'Minh Tran' },
    { no: 'PF2201-Q-PRC-0003', title: 'Weld Procedure Specification — WPS-07', discipline: 'QAQC', rev: 'A', purpose: 'IFC', status: 'Transmitted', due: '2026-11-13', owner: 'Liam Carter' },
    { no: 'PF2201-E-DS-0019', title: 'Switchgear Datasheet — MCC-02', discipline: 'Electrical', rev: 'A', purpose: 'IDC', status: 'Draft', due: '—', owner: 'Minh Tran' },
  ];

  // ---- Engineering ----
  const deliverables = [
    { no: 'PF2201-E-PID-0031', title: 'Firewater System P&ID — Module 2', discipline: 'Process', responsible: 'Minh Tran', stage: 'IFA — 70%', planned: '2026-11-05', forecast: '2026-11-09' },
    { no: 'PF2201-S-DRW-0147', title: 'Topside Module 3 Structural Steel Drawing', discipline: 'Structural', responsible: 'Josh Okafor', stage: 'AFC — 100%', planned: '2026-10-30', forecast: '2026-10-30' },
    { no: 'PF2201-I-LOG-0005', title: 'Cause & Effect Matrix — Fire & Gas', discipline: 'Instrumentation', responsible: 'Minh Tran', stage: 'IFA — 70%', planned: '2026-11-04', forecast: '2026-11-11' },
    { no: 'PF2201-E-DS-0019', title: 'Switchgear Datasheet — MCC-02', discipline: 'Electrical', responsible: 'Minh Tran', stage: 'IDC — 10%', planned: '2026-11-20', forecast: '2026-11-20' },
    { no: 'PF2201-M-DS-0088', title: 'Pump Skid Datasheet — Firewater', discipline: 'Mechanical', responsible: 'Priya Nair', stage: 'IFR — 40%', planned: '2026-11-08', forecast: '2026-11-14' },
  ];

  const workPackages = [
    { code: 'WP-PRO-010', scope: 'Process Design — Fire & Gas System', discipline: 'Process', weight: 8, progress: 74 },
    { code: 'WP-STR-022', scope: 'Topside Module 3 Primary Steel', discipline: 'Structural', weight: 14, progress: 91 },
    { code: 'WP-ELE-015', scope: 'LV/MV Distribution', discipline: 'Electrical', weight: 10, progress: 38 },
    { code: 'WP-INS-008', scope: 'Fire & Gas Detection Loop Wiring', discipline: 'Instrumentation', weight: 7, progress: 52 },
  ];

  // ---- Procurement ----
  const procurement = [
    { pkg: 'PO-4471', title: 'Firewater Pump Package', buyer: 'Priya Nair', criticality: 'Critical', stage: 'In execution', ros: '2026-12-15', forecast: '2026-12-22' },
    { pkg: 'PO-4488', title: 'Switchgear & MCC Panels', buyer: 'Priya Nair', criticality: 'High', stage: 'Awarded', ros: '2027-01-10', forecast: '2027-01-10' },
    { pkg: 'PO-4502', title: 'Fire & Gas Detectors', buyer: 'Priya Nair', criticality: 'High', stage: 'Evaluation', ros: '2027-01-20', forecast: '2027-02-02' },
    { pkg: 'PO-4519', title: 'HVAC Air Handling Units', buyer: 'Priya Nair', criticality: 'Medium', stage: 'Inquiry', ros: '2027-02-05', forecast: '2027-02-05' },
    { pkg: 'PO-4527', title: 'Structural Bolting Consumables', buyer: 'Priya Nair', criticality: 'Low', stage: 'PO issued', ros: '2026-11-25', forecast: '2026-11-25' },
  ];

  const expediting = [
    { pkg: 'PO-4471', milestone: 'FAT', baseline: '2026-12-01', forecast: '2026-12-08', status: 'Slipping', note: 'Vendor shop capacity constraint' },
    { pkg: 'PO-4488', milestone: 'Manufacture release', baseline: '2026-11-20', forecast: '2026-11-18', status: 'Ahead', note: 'Material received early' },
    { pkg: 'PO-4502', milestone: 'Vendor engineering', baseline: '2026-11-15', forecast: '2026-11-15', status: 'On track', note: '—' },
  ];

  // ---- Planning & Progress ----
  const milestones = dashboard.milestones;

  const progressGrid = [
    { wbs: '1.2 Engineering', budget: 100, planned: 82, accepted: 79 },
    { wbs: '1.3 Procurement', budget: 100, planned: 70, accepted: 66 },
    { wbs: '1.4 Construction', budget: 100, planned: 45, accepted: 41 },
    { wbs: '1.5 QAQC', budget: 100, planned: 38, accepted: 35 },
  ];

  // ---- Management registers ----
  const risks = [
    { id: 'RSK-014', title: 'Vendor shop capacity shortfall — pump packages', category: 'Procurement', likelihood: 'Possible', impact: 'High', score: 12, owner: 'Priya Nair', status: 'Open' },
    { id: 'RSK-019', title: 'Structural steel price escalation', category: 'Commercial', likelihood: 'Likely', impact: 'Medium', score: 9, owner: 'Alvaro Reyes', status: 'Mitigating' },
    { id: 'RSK-022', title: 'Yard congestion delaying Module 3 lift', category: 'Construction', likelihood: 'Unlikely', impact: 'High', score: 6, owner: 'Josh Okafor', status: 'Open' },
  ];

  const issues = [
    { id: 'ISS-071', title: 'Weld repair verification delay — Module 2 deck plate', severity: 'High', owner: 'Liam Carter', target: '2026-11-05', status: 'In progress' },
    { id: 'ISS-073', title: 'Firewater skid datasheet discrepancy vs. vendor drawing', severity: 'Medium', owner: 'Minh Tran', target: '2026-11-12', status: 'Open' },
  ];

  const lessons = [
    { id: 'LL-008', context: 'Vendor data submission', recommendation: 'Require native CAD + PDF at IFR to cut comment cycles by one revision', status: 'Published' },
  ];

  const moc = [
    { id: 'MOC-009', title: 'HVAC capacity increase — Living Quarters', status: 'Review', impact: 'Schedule +4d, Cost +$18k' },
  ];

  const stakeholders = [
    { name: 'Grace Lindqvist', party: 'Meridian Energy Partners', role: 'Client Rep.', influence: 'High', interest: 'High' },
    { name: 'DNV Marine Warranty', party: 'MWS', role: 'Surveyor', influence: 'High', interest: 'Medium' },
  ];

  // ---- Interfaces ----
  const interfaces = [
    { id: 'INT-018', boundary: 'Structural / Piping tie-in — Module 2', originator: 'Josh Okafor', receiver: 'Minh Tran', need: '2026-11-04', status: 'Under review' },
    { id: 'INT-021', boundary: 'Electrical / Instrumentation — F&G panel power', originator: 'Minh Tran', receiver: 'Minh Tran', need: '2026-11-18', status: 'Agreed' },
    { id: 'INT-024', boundary: 'Hull / Topside — module seafastening loads', originator: 'Josh Okafor', receiver: 'Josh Okafor', need: '2026-12-01', status: 'Identified' },
  ];

  // ---- Events / MoM ----
  const events = [
    { title: 'Weekly EPCIC Progress Review', date: '2026-11-10', time: '09:00', organizer: 'Alvaro Reyes' },
    { title: 'Interface Workshop — Module 2/3 Boundary', date: '2026-11-11', time: '14:00', organizer: 'Josh Okafor' },
    { title: 'Client Monthly Steering Call', date: '2026-11-14', time: '10:00', organizer: 'Alvaro Reyes' },
  ];

  const mom = [
    { id: 'MOM-0044', title: 'Weekly EPCIC Progress Review — Wk45', date: '2026-11-03', status: 'Issued', actions: 6 },
    { id: 'MOM-0045', title: 'Interface Workshop Minutes', date: '2026-11-04', status: 'Review', actions: 3 },
  ];

  // ---- Reports ----
  const reports = [
    { name: 'Weekly Progress Report', cadence: 'Weekly', audience: 'PM, Client', last: '2026-11-03' },
    { name: 'Milestone Trend Report', cadence: 'Weekly', audience: 'PM, Manager', last: '2026-11-03' },
    { name: 'Engineering Deliverables Status', cadence: 'Weekly', audience: 'Engineering', last: '2026-11-03' },
    { name: 'Procurement Exceptions', cadence: 'Weekly', audience: 'PM, Procurement', last: '2026-11-03' },
    { name: 'Risk & Issue Summary', cadence: 'Monthly', audience: 'PM, Client', last: '2026-10-31' },
    { name: 'Interface Status Report', cadence: 'Weekly', audience: 'Discipline Leads', last: '2026-11-03' },
  ];

  const notifications = [
    { title: 'CRS-0042 approval is overdue', time: '2h ago', tone: 'critical' },
    { title: 'New transmittal TR-0231 awaiting your review', time: '4h ago', tone: 'info' },
    { title: 'Milestone "Hull Mechanical Completion" forecast slipped', time: '1d ago', tone: 'warning' },
    { title: 'Weekly reporting cutoff in 2 days', time: '1d ago', tone: 'info' },
  ];

  return {
    users, currentUser, projects, get currentProjectId() { return currentProjectId; },
    setCurrentProject(id) { currentProjectId = id; },
    nav, dashboard, tasks, myDay, inbox, documents, deliverables, workPackages,
    procurement, expediting, milestones, progressGrid, risks, issues, lessons,
    moc, stakeholders, interfaces, events, mom, reports, notifications,
  };
})();
