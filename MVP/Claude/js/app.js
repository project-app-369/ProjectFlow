'use strict';
/* Project Flow — Claude MVP. Scaffold & visual style follow v2_codex.
   Data is read-only, extracted from /data (Procurement Plan + Expediting Report). */

const $ = s => document.querySelector(s);
const PREFS_KEY = 'projectflow-claude-mvp-2';
const PROJECT = RAW.project;
const SCHEDULE = RAW.schedule;
const PROCUREMENT = RAW.procurement;
const EXPEDITING = RAW.expediting;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const paths = {
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 brief:'M3 7h18v13H3z M8 7V4h8v3 M3 12h18 M10 12v3h4v-3',
 check:'M9 11l3 3 8-9 M20 12v8H4V4h10',
 gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
 bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4',
 search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
 arrow:'M4 12h16 M15 7l5 5-5 5',
 down:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
 plus:'M12 5v14 M5 12h14',
 risk:'M12 3L2 21h20z M12 9v5 M12 17v1',
 chart:'M4 3v17h17 M7 15l4-5 4 2 6-7',
 calendar:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18',
 box:'M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M7 5l10 5',
 close:'M6 6l12 12 M18 6L6 18',
 menu:'M4 6h16 M4 12h16 M4 18h16',
 layers:'M12 3L2 8l10 5 10-5z M2 12l10 5 10-5 M2 16l10 5 10-5',
 shield:'M12 2l8 3v7c0 5-8 10-8 10S4 17 4 12V5z M8 11l3 3 5-6',
 building:'M4 21V7l8-4 8 4v14 M9 21v-6h6v6 M9 10h.01 M15 10h.01 M9 14h.01 M15 14h.01',
 anchor:'M12 2v6 M12 22v-8 M5 12H2a10 10 0 0 0 20 0h-3 M9 5a3 3 0 1 0 6 0',
 flag:'M5 22V3 M5 4h13l-3 4.5L18 13H5',
 doc:'M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h8',
 people:'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M19 14a5 5 0 0 1 3 4v3',
 link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'
};
const icon = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.grid}"/></svg>`;

/* Module catalog from the final spec §3.1 navigation: workspace -> module -> submodule (-> sub-submodule).
   Node ids for submodules are generated as "<parent>.<slug>". Only the nodes listed in WIRED have real
   pages today; every other node is a toggleable placeholder. `group` only drives sidebar headers: T&I is
   kept apart from HUC, and HUC is grouped with Onshore Precom-Commissioning. */
const WORKSPACES = [
  { id: 'personal', label: 'Personal', modules: [
    { id: 'my-workspace', label: 'My Workspace', icon: 'brief', desc: 'Personal home across projects', subs: ['My Day', 'Inbox', 'Assigned to Me', 'Assigned by Me', 'Approvals'] },
    { id: 'task-management', label: 'Task Management', icon: 'check', desc: 'Tasks, assignments and PIC coordination', subs: ['Project Tasks', 'Board', 'Calendar', 'Workload'] },
  ] },
  { id: 'epcic', label: 'EPCIC', modules: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', desc: 'Project overview widgets', locked: true },
    { id: 'engineering', label: 'Engineering', icon: 'layers', desc: 'Work packages, deliverables and review queue', subs: ['Work Packages', 'Deliverables', 'Review Queue'] },
    { id: 'procurement', label: 'Procurement', icon: 'box', desc: 'Supply chain from plan to materials', subs: [
      'Procurement Plan',
      { label: 'Expediting', subs: ['Vendor Overview', 'Production Schedule Monitoring'] },
      'Logistics', 'Materials'] },
    { id: 'planning', label: 'Planning & Progress', icon: 'calendar', desc: 'Overall progress, work packages and milestones', subs: ['Overall Progress', 'Work Packages', 'Milestones'] },
    { id: 'construction', group: 'Yard Execution', label: 'Construction', icon: 'building', desc: 'Yard and facility construction', subs: ['Yard Layout', 'Facility Layout', 'Workfront', 'Construction Sequence', 'Progress & KPI', 'Productivity'] },
    { id: 'fabrication', group: 'Yard Execution', label: 'Fabrication Subcontracting', icon: 'people', desc: 'Subcontractor fabrication tracking', subs: ['Progress', 'Concerns & Highlights'] },
    { id: 'qaqc', group: 'Yard Execution', label: 'QAQC', icon: 'shield', desc: 'Quality assurance and control' },
    { id: 'hse', group: 'Yard Execution', label: 'HSE', icon: 'risk', desc: 'Health, safety and environment' },
    { id: 'ti', group: 'Installation', label: 'T&I', icon: 'anchor', desc: 'Transportation and installation', subs: ['Workpacks', 'Timeline & Schedule', 'Sequence', 'Progress'] },
    { id: 'precom', group: 'Commissioning', label: 'Onshore Precom-Commissioning', icon: 'check', desc: 'Onshore precommissioning and commissioning', subs: ['Systems & Subsystems', 'Sequence', 'Handover Schedule', 'Check Sheets', 'Punches'] },
    { id: 'huc', group: 'Commissioning', label: 'Offshore HUC', icon: 'flag', desc: 'Offshore hook-up and commissioning', subs: ['Marine Spread', 'Timeline & Schedule', 'Progress'] },
  ] },
  { id: 'governance', label: 'Governance', modules: [
    { id: 'management', label: 'Management', icon: 'risk', desc: 'Management registers (MGT-01 to MGT-05)', subs: ['Risks', 'Issues', 'Lessons Learned', 'Management of Change (MOC)', 'Stakeholders'] },
    { id: 'interface', label: 'Interface Management', icon: 'link', desc: 'Interface register, matrix and points', subs: ['Register', 'Matrix', 'Points'] },
    { id: 'document-control', label: 'Document Control', icon: 'doc', desc: 'Controlled documents, reviews and transmittals', subs: ['MDR', 'Package/Engineering Registers', 'Vendor Registers', 'Transmittals', 'Reviews', 'CRS', 'Correspondence', 'Dossiers'] },
    { id: 'events', label: 'Event Management', icon: 'calendar', desc: 'Calendar of meetings and events' },
  ] },
  { id: 'reports', label: 'Reports', modules: [
    { id: 'minutes', label: 'Minutes of Meetings', icon: 'doc', desc: 'Agenda, decisions and shared actions' },
    { id: 'documents', label: 'Documents', icon: 'layers', desc: 'Authorized view of Document Control' },
    { id: 'analytics', label: 'Analytics', icon: 'chart', desc: 'Cross-module analytics' },
    { id: 'periodic', label: 'Periodic Reports', icon: 'calendar', desc: 'Predefined weekly and monthly reports', subs: ['Weekly Progress', 'Monthly Progress', 'Milestones', 'Engineering', 'Procurement', 'Risk & Issue', 'Interface', 'Actions'] },
  ] },
];

const NODE_DESC = {
  'task-management.board': 'Personal follow-ups board',
  'procurement.procurement-plan': `LOA / PO award register · ${PROCUREMENT.length} packages`,
  'procurement.expediting.vendor-overview': `Fabrication & delivery status · ${EXPEDITING.length} packages`,
  'planning.overall-progress': 'Procurement S-curve, plan vs. actual',
  'planning.work-packages': `Work package register · ${SCHEDULE.workPackages.length} work packages`,
  dashboard: 'Project overview widgets (always on)',
};
const NODES = {};
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function indexNode(def, base, parent, ws, id) {
  const n = typeof def === 'string' ? { label: def } : def;
  n.id = id || n.id; n.ws = ws; n.parent = parent; n.path = [...base, n.label]; n.desc = NODE_DESC[n.id] || n.desc || '';
  NODES[n.id] = n;
  n.subs = (n.subs || []).map(s => indexNode(s, n.path, n, ws, `${n.id}.${slug(typeof s === 'string' ? s : s.label)}`));
  return n;
}
WORKSPACES.forEach(ws => { ws.modules = ws.modules.map(m => indexNode(m, [ws.label, ...(m.group ? [m.group] : [])], null, ws.id, m.id)); });

const isOn = id => { for (let n = NODES[id]; n; n = n.parent) if (!prefs.modules[n.id]) return false; return !!NODES[id]; };
const hasChildren = n => n.subs.length > 0;
const onKids = n => n.subs.filter(s => prefs.modules[s.id]);

function seedPrefs() {
  const modules = {};
  Object.keys(NODES).forEach(id => modules[id] = true);
  return { workspace: 'epcic', modules, dark: false };
}
let prefs;
try {
  const saved = JSON.parse(localStorage.getItem(PREFS_KEY));
  prefs = (saved && saved.modules && saved.workspace) ? { ...seedPrefs(), ...saved, modules: { ...seedPrefs().modules, ...saved.modules } } : seedPrefs();
  if (!WORKSPACES.some(w => w.id === prefs.workspace)) prefs.workspace = 'epcic';
} catch { prefs = seedPrefs(); }
function savePrefs(){ try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }

let view = 'dashboard', query = '', disciplineFilter = 'all', statusFilter = 'all', settingsTab = 'modules', settingsWs = 'epcic';

const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const cls = s => {
  s = String(s || '');
  if (/^(Normal|PO placed|Arrived|On track)$/i.test(s)) return 'green';
  if (/^(Delay|At High Risk|Blocked)$/i.test(s)) return 'red';
  if (/^(At Risk|LOA issued|FAT|On sailing|Final inspection)$/i.test(s)) return 'amber';
  return 'indigo';
};
const badge = (s, c) => `<span class="pill ${c || cls(s)}">${esc(s ?? '—')}</span>`;
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const vendorCell = (name, sub) => `<span class="vendor"><span class="vendor-logo">${esc(initials(name))}</span><span><strong>${esc(name || 'Unassigned')}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span></span>`;
const button = (label, action, ico = '', kind = '', extra = '') => `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${ico ? icon(ico) : ''}${label}</button>`;

function toast(msg) { $('#toast').textContent = msg; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
function stat(label, value, foot, ico) { return `<div class="stat"><div class="stat-label">${label}${icon(ico)}</div><div class="stat-value mono">${value}</div><div class="stat-foot">${foot}</div></div>`; }
function crumbs() {
  if (view === 'settings') return ['Settings', { modules: 'Modules', general: 'General', data: 'Data sources' }[settingsTab]];
  return NODES[view] ? NODES[view].path : ['Project Flow'];
}
const crumbHTML = parts => parts.map((p, i) => i === parts.length - 1 ? `<strong>${esc(p)}</strong>` : `<span>${esc(p)}</span>`).join('<span class="sep">/</span>');
function head(title, desc, actionLabel, actionName, ico) {
  return `<div class="breadcrumb">${crumbHTML(crumbs())}</div>
  <div class="page-head"><div><div class="eyebrow">${esc(PROJECT.code)} · ${esc(PROJECT.contract)}</div><h1>${esc(title)}</h1><p class="page-sub">${desc}</p></div>
  <div class="actions">${actionLabel ? button(actionLabel, actionName, ico || 'down', 'small') : ''}</div></div>`;
}

/* ---------------- navigation / shell ---------------- */
const wsById = id => WORKSPACES.find(w => w.id === id);
const within = (id, n) => { for (let x = NODES[id]; x; x = x.parent) if (x === n) return true; return false; };
const isWired = n => !!WIRED[n.id] || onKids(n).some(isWired);
function landing(n) {
  const kids = onKids(n);
  if (!kids.length) return n.id;
  return landing(kids.find(isWired) || kids[0]);
}
function defaultView() {
  const on = wsById(prefs.workspace).modules.filter(m => prefs.modules[m.id]);
  const first = on.find(isWired) || on[0];
  return first ? landing(first) : 'ws-empty';
}

function navNode(n, depth) {
  const active = within(view, n), kids = onKids(n);
  const cls = depth === 0 ? '' : depth === 1 ? 'sub' : 'sub sub2';
  let html = `<button class="nav-item ${cls} ${active ? 'active' : ''}" data-nav="${n.id}" ${view === n.id ? 'aria-current="page"' : ''}>${depth === 0 ? icon(n.icon) : ''}${esc(n.label)}</button>`;
  if (active && kids.length) html += kids.map(k => navNode(k, depth + 1)).join('');
  return html;
}
function workspaceNavHTML() {
  const ws = wsById(prefs.workspace);
  let html = '', lastGroup;
  ws.modules.filter(m => prefs.modules[m.id]).forEach(m => {
    if (m.group !== lastGroup && m.group) html += `<div class="side-label">${esc(m.group)}</div>`;
    lastGroup = m.group;
    html += navNode(m, 0);
  });
  return html || `<div class="tiny muted" style="padding:14px">No ${esc(ws.label)} modules enabled. <button class="btn text" data-action="show-settings-modules">Open module settings</button></div>`;
}

function renderShell() {
  $('#sidebar').innerHTML = `<div class="brand"><span class="brandmark"></span>Project Flow</div>
    <div class="workspace-switch" role="tablist">${WORKSPACES.map(w => `<button class="ws-tab ${prefs.workspace === w.id ? 'active' : ''}" data-workspace="${w.id}" role="tab" aria-selected="${prefs.workspace === w.id}">${esc(w.label)}</button>`).join('')}</div>
    <nav class="side-nav" aria-label="${esc(wsById(prefs.workspace).label)} modules">${workspaceNavHTML()}</nav>
    <div class="side-bottom"><button class="nav-item ${view === 'settings' ? 'active' : ''}" data-nav="settings">${icon('gear')}Settings</button>
    <div class="project-mini"><span class="mini-icon">${icon('brief')}</span><div><strong class="tiny">${esc(PROJECT.code)}</strong><div class="tiny muted"><span class="live-dot"></span>Cut-off ${fmtDate(PROJECT.cutoff)}</div></div></div></div>`;
  const alerts = EXPEDITING.filter(x => /Delay|At Risk/i.test(x.status)).length;
  $('#header').innerHTML = `<div class="project-switch"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Toggle navigation">${icon('menu')}</button>
    <span class="mini-icon">${icon('brief')}</span><div><div class="tiny muted" style="padding-left:4px">PROJECT</div><strong style="padding-left:4px">${esc(PROJECT.name)}</strong></div></div>
    <div class="top-actions"><span class="date-label">${icon('calendar')} Cut-off ${fmtDate(PROJECT.cutoff)}</span><span class="tag">DEMO WORKSPACE</span>
    <button class="icon-btn bell" data-action="notifications" aria-label="Notifications">${icon('bell')}</button>
    <div class="identity"><span class="avatar teal" title="Project team">${initials('Project Team')}</span><div class="identity-text"><strong>Project team</strong><span class="muted">${alerts} open flags</span></div></div></div>`;
  document.title = `${PROJECT.code} · Project Flow`;
  document.body.classList.toggle('dark', prefs.dark);
}

function navigate(id) {
  if (id !== 'settings' && id !== 'ws-empty') {
    if (!NODES[id] || !isOn(id)) id = defaultView();
    else id = landing(NODES[id]);
  }
  if (NODES[id]) prefs.workspace = NODES[id].ws;
  view = id; query = ''; disciplineFilter = 'all'; statusFilter = 'all';
  render();
  $('#sidebar').classList.remove('open');
  window.scrollTo(0, 0);
}

/* ---------------- dashboard ---------------- */
function latestSCurvePoint() {
  const pts = SCHEDULE.scurve.filter(p => p.actual != null);
  return pts[pts.length - 1] || { plan: 0, actual: 0 };
}
function disabledPanel(label) {
  return `<div class="panel empty">${esc(label)} module is turned off. ${button('Open settings', 'show-settings', '', 'text')}</div>`;
}
function renderDashboard() {
  const latest = latestSCurvePoint();
  const poPlaced = PROCUREMENT.filter(p => p.status === 'PO placed').length;
  const delays = EXPEDITING.filter(x => x.status === 'Delay').length;
  const atRisk = EXPEDITING.filter(x => /At Risk/i.test(x.status)).length;
  const stats = [
    stat('Work packages tracked', SCHEDULE.workPackages.length, 'WP2 – WP6 · EPCIC scope', 'layers'),
  ];
  if (isOn('planning.overall-progress')) stats.push(stat('Cumulative procurement progress', `${latest.actual ?? 0}<small>%</small>`, `<span class="${latest.actual < latest.plan ? 'warning' : 'positive'}">${(latest.actual - latest.plan).toFixed(1)} pp</span> vs. ${latest.plan}% planned`, 'chart'));
  if (isOn('procurement.procurement-plan')) stats.push(stat('Procurement packages', PROCUREMENT.length, `${poPlaced} PO placed · ${PROCUREMENT.length - poPlaced} in progress`, 'box'));
  if (isOn('procurement.expediting.vendor-overview')) stats.push(stat('Expediting flags', delays + atRisk, `<span class="negative">${delays} delayed</span> · ${atRisk} at risk`, 'calendar'));

  const left = isOn('planning.overall-progress')
    ? `<div class="panel"><div class="panel-head"><div><h2>Procurement S-curve</h2><p>Cumulative weighted progress, plan vs. actual</p></div><div class="legend"><span><i class="plan"></i>Plan</span><span><i class="forecast"></i>Forecast</span><span><i></i>Actual</span></div></div>${sCurveChart()}</div>`
    : disabledPanel('Overall Progress');
  const right = isOn('procurement.expediting.vendor-overview') ? attentionPanel() : disabledPanel('Vendor Overview');

  const bottomLeft = isOn('planning.work-packages') ? workPackagePanel() : disabledPanel('Work Packages');
  const bottomRight = isOn('procurement.procurement-plan') ? procurementGlancePanel() : disabledPanel('Procurement Plan');

  return head('Project overview', `${esc(PROJECT.name)} — connected modules from the Procurement Plan and Expediting Report workbooks.`)
    + `<div class="stats">${stats.join('')}</div><div class="grid-main">${left}${right}</div><div class="bottom-grid">${bottomLeft}${bottomRight}</div>`;
}
function attentionPanel() {
  const flags = EXPEDITING.filter(x => /Delay|At Risk/i.test(x.status) && x.highlight && x.highlight !== 'No').slice(0, 4);
  return `<div class="panel"><div class="panel-head"><div><h2>Needs attention</h2><p>Open expediting flags with a recorded highlight</p></div>${icon('risk')}</div>
  <div class="watchlist">${flags.map(x => `<div class="watch-item"><span class="watch-symbol ${x.status === 'Delay' ? 'red' : ''}">${icon(x.status === 'Delay' ? 'clock' : 'risk')}</span><div><h3>${esc(x.name || x.code)}</h3><p>${esc(x.vendor || x.code)} · ${badge(x.status)}</p></div></div>`).join('') || '<div class="empty">No open flags in this view.</div>'}</div>
  <div class="panel-foot">${button('View expediting register →', 'show-expediting', '', 'text')}</div></div>`;
}
function workPackagePanel() {
  return `<div class="panel"><div class="panel-head"><div><h2>Work package progress</h2><p>This week · planned vs. actual</p></div></div>
  <div style="padding:5px 24px 22px">${SCHEDULE.workPackages.map(wp => `<div style="margin:14px 0"><div class="progress-numbers"><strong>${esc(wp.name)}</strong><span>${wp.thisWeekActual ?? 0}% actual / ${wp.thisWeekPlan ?? 0}% plan</span></div><div class="progress-line" style="height:7px;margin-bottom:4px"><div class="progress-fill ${wp.thisWeekActual < wp.thisWeekPlan ? 'behind' : ''}" style="width:${Math.min(100, wp.thisWeekActual ?? 0)}%"></div></div></div>`).join('')}</div>
  <div class="panel-foot">${button('Open work packages →', 'show-wp', '', 'text')}</div></div>`;
}
function procurementGlancePanel() {
  const byDiscipline = {};
  PROCUREMENT.forEach(p => { byDiscipline[p.discipline] = (byDiscipline[p.discipline] || 0) + 1; });
  return `<div class="panel"><div class="panel-head"><h2>Procurement by discipline</h2></div>
  ${Object.entries(byDiscipline).sort((a, b) => b[1] - a[1]).map(([d, n]) => `<div class="list-card">${icon('box')}<div class="grow"><p>${esc(d)}</p></div><span class="tiny muted">${n} packages</span></div>`).join('')}
  <div class="panel-foot">${button('Open procurement →', 'show-procurement', '', 'text')}</div></div>`;
}

/* ---------------- schedule ---------------- */
function sCurveChart() {
  const pts = SCHEDULE.scurve, n = pts.length, W = 720, H = 180, PAD = 26;
  const x = i => PAD + (i / (n - 1)) * (W - PAD);
  const y = v => H - (Math.min(100, Math.max(0, v)) / 100) * H;
  const line = key => pts.map((p, i) => p[key] == null ? null : [x(i), y(p[key])]).filter(Boolean).map(([a, b], i) => `${i === 0 ? 'M' : 'L'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const grid = [0, 25, 50, 75, 100].map(v => `<line class="chart-grid" x1="${PAD}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="0" y="${y(v) + 3}">${v}%</text>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W + 10} ${H + 14}">${grid}
    <path d="${line('plan')}" fill="none" stroke="#cbd1e5" stroke-width="2"/>
    <path d="${line('forecast')}" fill="none" stroke="#b8a4cf" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${line('actual')}" fill="none" stroke="var(--teal)" stroke-width="2.5"/>
  </svg></div>`;
}
function progressStats() {
  const o = SCHEDULE.overall, latest = latestSCurvePoint(), wk = (o.thisWeekActual ?? 0) - (o.thisWeekPlan ?? 0);
  return [
    stat('Cumulative actual', `${latest.actual ?? 0}<small>%</small>`, `vs ${latest.plan}% planned`, 'chart'),
    stat('Achieved this week', `${o.thisWeekActual ?? 0}<small>%</small>`, `<span class="${wk < 0 ? 'warning' : 'positive'}">${wk.toFixed(1)} pp</span> vs. ${o.thisWeekPlan}% plan`, 'calendar'),
    stat('Work packages', SCHEDULE.workPackages.length, 'WP2 – WP6', 'layers'),
    stat('Overall variance', `${wk.toFixed(1)}<small>pp</small>`, 'Achieved vs. planned, this week', 'risk'),
  ];
}
function renderProgressOverall() {
  return head('Overall Progress', 'Cumulative procurement progress from the Procurement Plan workbook.', 'Export CSV', 'export')
    + `<div class="stats">${progressStats().join('')}</div>
    <div class="panel"><div class="panel-head"><div><h2>Procurement S-curve</h2><p>Cumulative weighted progress · monthly cut-offs</p></div><div class="legend"><span><i class="plan"></i>Plan</span><span><i class="forecast"></i>Forecast</span><span><i></i>Actual</span></div></div>${sCurveChart()}</div>`;
}
function renderWorkPackages() {
  const wpRows = SCHEDULE.workPackages.map(wp => `<tr><td><strong>${esc(wp.code)}</strong><div class="tiny muted">${esc(wp.name)}</div></td><td>${wp.weight ?? 0}%</td>
    <td>${wp.lastWeekActual ?? 0}% <span class="tiny muted">/ ${wp.lastWeekPlan ?? 0}% plan</span></td>
    <td>${wp.thisWeekActual ?? 0}% <span class="tiny muted">/ ${wp.thisWeekPlan ?? 0}% plan</span></td>
    <td class="${(wp.thisWeekActual ?? 0) < (wp.thisWeekPlan ?? 0) ? 'negative' : 'positive'}">${((wp.thisWeekActual ?? 0) - (wp.thisWeekPlan ?? 0)).toFixed(1)} pp</td></tr>`).join('');
  return head('Work Packages', 'Weekly progress by work package (WP2 – WP6).', 'Export CSV', 'export')
    + `<div class="stats">${progressStats().join('')}</div>
    <div class="panel"><div class="panel-head"><h2>Work package register</h2></div><div class="table-wrap"><table><thead><tr><th>WORK PACKAGE</th><th>WEIGHT</th><th>LAST WEEK</th><th>THIS WEEK</th><th>VARIANCE</th></tr></thead><tbody>${wpRows}</tbody></table></div></div>`;
}

/* ---------------- procurement ---------------- */
function filteredProcurement() {
  return PROCUREMENT.filter(p => (disciplineFilter === 'all' || p.discipline === disciplineFilter) && (statusFilter === 'all' || p.status === statusFilter)
    && `${p.code} ${p.description} ${p.vendor} ${p.buyer}`.toLowerCase().includes(query.toLowerCase()));
}
function procurementTable(rows = filteredProcurement()) {
  return `<div class="table-wrap"><table><thead><tr><th>PACKAGE</th><th>DISCIPLINE</th><th>VENDOR</th><th>LOA</th><th>PO</th><th>BUYER / EXPEDITOR</th><th>STATUS</th><th></th></tr></thead><tbody>
  ${rows.map(p => `<tr><td><button class="link-button vendor" data-action="procurement-detail" data-id="${p.id}"><span class="vendor-logo">${esc(initials(p.discipline))}</span><span><strong>${esc(p.code)}</strong><small>${esc(p.description || '')}</small></span></button></td>
  <td>${esc(p.discipline || '—')}</td><td>${esc(p.vendor || '—')}</td>
  <td>${p.loaNo ? fmtDate(p.loaDate) : '<span class="tiny muted">Not issued</span>'}</td>
  <td>${p.poNo ? fmtDate(p.poDate) : '<span class="tiny muted">Not placed</span>'}</td>
  <td class="tiny">${esc(p.buyer || '—')} <span class="muted">/ ${esc(p.expeditor || '—')}</span></td>
  <td>${badge(p.status)}</td>
  <td><button class="icon-btn" data-action="procurement-detail" data-id="${p.id}" aria-label="Open ${esc(p.code)}">${icon('arrow')}</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No packages match. Change the search or filters.</td></tr>'}
  </tbody></table></div>`;
}
function renderProcurement() {
  const poPlaced = PROCUREMENT.filter(p => p.status === 'PO placed').length;
  const loa = PROCUREMENT.filter(p => p.status === 'LOA issued').length;
  const tendering = PROCUREMENT.length - poPlaced - loa;
  const disciplines = [...new Set(PROCUREMENT.map(p => p.discipline))].sort();
  const stats = [
    stat('Total packages', PROCUREMENT.length, `Across ${disciplines.length} disciplines`, 'box'),
    stat('PO placed', poPlaced, `${Math.round(poPlaced / PROCUREMENT.length * 100)}% of register`, 'check'),
    stat('LOA issued', loa, 'Letter of award, PO pending', 'clock'),
    stat('In tendering', tendering, 'No LOA recorded yet', 'risk'),
  ];
  return head('Procurement register', `Package general-information register — vendor, LOA, PO and contact ownership · ${PROCUREMENT.length} packages.`, 'Export CSV', 'export')
    + `<div class="stats">${stats.join('')}</div>
    <div class="panel"><div class="panel-head"><div><h2>Procurement packages</h2><p>Select a package to review full award detail</p></div><span class="tiny muted">${filteredProcurement().length} packages</span></div>
    <div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search code, description or vendor…" value="${esc(query)}" aria-label="Search procurement packages"></label>
    <div class="filter-group"><select class="filter" id="discipline-filter" aria-label="Filter by discipline">${['all', ...disciplines].map(d => `<option value="${d}" ${disciplineFilter === d ? 'selected' : ''}>${d === 'all' ? 'All disciplines' : d}</option>`).join('')}</select>
    <select class="filter" id="status-filter" aria-label="Filter by status">${['all', 'PO placed', 'LOA issued', 'In tendering'].map(s => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s === 'all' ? 'All statuses' : s}</option>`).join('')}</select>
    ${button('Clear', 'clear', '', 'small')}</div></div>
    <div id="procurement-rows">${procurementTable()}</div>
    <div class="table-footer"><span>Source: pgk_gen_info · data/Expediting</span><span>Cut-off: ${fmtDate(PROJECT.cutoff)}</span></div></div>`;
}
function procurementDetail(id) {
  const p = PROCUREMENT.find(p => p.id === id); if (!p) return;
  modal(p.code + ' · Procurement package', `<div class="dialog-body"><div class="drawer-intro"><div class="eyebrow">${esc(p.discipline || '')}</div><h1 style="font-size:21px">${esc(p.description || p.code)}</h1>${badge(p.status)} <span class="tiny muted">${esc(p.vendor || 'Vendor not yet assigned')}</span></div>
  <div class="detail-grid">
  <div><small>Vendor code</small><strong>${esc(p.vendorCode || '—')}</strong></div>
  <div><small>Manufacturers / origins</small><strong>${esc(p.origins || '—')}</strong></div>
  <div><small>LOA number</small><strong>${esc(p.loaNo || 'Not issued')}</strong></div>
  <div><small>LOA date</small><strong>${fmtDate(p.loaDate)}</strong></div>
  <div><small>PO number</small><strong>${esc(p.poNo || 'Not placed')}</strong></div>
  <div><small>PO date</small><strong>${fmtDate(p.poDate)}</strong></div>
  <div><small>Buyer</small><strong>${esc(p.buyer || '—')}</strong></div>
  <div><small>Expeditor</small><strong>${esc(p.expeditor || '—')}</strong></div>
  <div><small>Project engineer (PE)</small><strong>${esc(p.pe || '—')}</strong></div>
  <div><small>VQC</small><strong>${esc(p.vqc || '—')}</strong></div>
  </div></div>`, button('Close', 'close'));
}

/* ---------------- expediting ---------------- */
function filteredExpediting() {
  return EXPEDITING.filter(x => (disciplineFilter === 'all' || x.discipline === disciplineFilter) && (statusFilter === 'all' || x.status === statusFilter)
    && `${x.code} ${x.name} ${x.vendor}`.toLowerCase().includes(query.toLowerCase()));
}
function expeditingTable(rows = filteredExpediting()) {
  return `<div class="table-wrap"><table><thead><tr><th>PACKAGE</th><th>DISCIPLINE</th><th>VENDOR</th><th>CUMULATIVE PROGRESS</th><th>VARIANCE</th><th>STATUS</th><th></th></tr></thead><tbody>
  ${rows.map(x => `<tr><td><button class="link-button vendor" data-action="expediting-detail" data-id="${x.id}"><span class="vendor-logo">${esc(initials(x.discipline))}</span><span><strong>${esc(x.code)}</strong><small>${esc(x.name || '')}</small></span></button></td>
  <td>${esc(x.discipline)}</td><td class="tiny">${esc(x.vendor || '—')}</td>
  <td>${x.actualPct == null ? '<span class="tiny muted">No data</span>' : `<div class="progress-stack"><div class="progress-numbers"><strong>${x.actualPct}%</strong><span class="muted">Plan ${x.planPct ?? 0}%</span></div><div class="progress-line"><div class="progress-fill ${x.actualPct < (x.planPct ?? 0) ? 'behind' : ''}" style="width:${Math.min(100, x.actualPct)}%"></div></div></div>`}</td>
  <td class="${(x.variance ?? 0) < 0 ? 'negative' : 'positive'}">${x.variance == null ? '—' : (x.variance > 0 ? '+' : '') + x.variance + ' pp'}</td>
  <td>${badge(x.status)}</td>
  <td><button class="icon-btn" data-action="expediting-detail" data-id="${x.id}" aria-label="Open ${esc(x.code)}">${icon('arrow')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No packages match. Change the search or filters.</td></tr>'}
  </tbody></table></div>`;
}
function renderExpediting() {
  const delays = EXPEDITING.filter(x => x.status === 'Delay').length;
  const atRisk = EXPEDITING.filter(x => /At Risk/i.test(x.status)).length;
  const normal = EXPEDITING.filter(x => x.status === 'Normal').length;
  const disciplines = [...new Set(EXPEDITING.map(x => x.discipline))].sort();
  const statuses = [...new Set(EXPEDITING.map(x => x.status))].sort();
  const stats = [
    stat('Total packages', EXPEDITING.length, `Across ${disciplines.length} disciplines`, 'chart'),
    stat('Delayed', delays, 'ETA at site slipping past ROS', 'clock'),
    stat('At risk', atRisk, 'Watching forecast vs. plan', 'risk'),
    stat('Normal / on track', normal, 'No active flag', 'check'),
  ];
  return head('Expediting register', `Equipment, Structural, Piping, Valves &amp; Misc expediting status · ${EXPEDITING.length} packages.`, 'Export CSV', 'export')
    + `<div class="stats">${stats.join('')}</div>
    <div class="panel"><div class="panel-head"><div><h2>Expediting packages</h2><p>Select a package to review highlights and action plan</p></div><span class="tiny muted">${filteredExpediting().length} packages</span></div>
    <div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search code, vendor or description…" value="${esc(query)}" aria-label="Search expediting packages"></label>
    <div class="filter-group"><select class="filter" id="discipline-filter" aria-label="Filter by discipline">${['all', ...disciplines].map(d => `<option value="${d}" ${disciplineFilter === d ? 'selected' : ''}>${d === 'all' ? 'All disciplines' : d}</option>`).join('')}</select>
    <select class="filter" id="status-filter" aria-label="Filter by status">${['all', ...statuses].map(s => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s === 'all' ? 'All statuses' : s}</option>`).join('')}</select>
    ${button('Clear', 'clear', '', 'small')}</div></div>
    <div id="expediting-rows">${expeditingTable()}</div>
    <div class="table-footer"><span>Source: Equipment / Structural / Pipe-Fitting / Valves / Misc summaries</span><span>Cut-off: ${fmtDate(PROJECT.cutoff)}</span></div></div>`;
}
function expeditingDetail(id) {
  const x = EXPEDITING.find(x => x.id === id); if (!x) return;
  const rich = x.discipline === 'Equipment';
  const stageRow = (label, p, a) => (p == null && a == null) ? '' : `<div><small>${label}</small><strong>${a ?? '—'}% <span class="tiny muted">/ ${p ?? '—'}% plan</span></strong></div>`;
  modal(x.code + ' · Expediting status', `<div class="dialog-body"><div class="drawer-intro"><div class="eyebrow">${esc(x.discipline)}${x.vendor ? ' · ' + esc(x.vendor) : ''}</div><h1 style="font-size:21px">${esc(x.name || x.code)}</h1>${badge(x.status)}</div>
  ${rich ? `<div class="detail-grid">
    <div><small>Required on site (ROS)</small><strong>${fmtDate(x.rosDate)}</strong></div>
    <div><small>ETA at site</small><strong>${esc(/^\d{4}-\d{2}-\d{2}$/.test(x.etaSite) ? fmtDate(x.etaSite) : String(x.etaSite || '—'))}</strong></div>
    ${stageRow('Engineering', x.engPlan, x.engActual)}
    ${stageRow('Procurement', x.procPlan, x.procActual)}
    ${stageRow('Fabrication', x.fabPlan, x.fabActual)}
    ${stageRow('Testing', x.testPlan, x.testActual)}
    ${stageRow('Delivery', x.delPlan, x.delActual)}
    <div><small>Overall</small><strong>${x.actualPct ?? '—'}% <span class="tiny muted">/ ${x.planPct ?? '—'}% plan</span></strong></div>
  </div>
  <h3>Highlight / area of concern</h3><p class="tiny muted">${esc(x.highlight || 'None recorded.')}</p>
  <h3>Short-term action plan</h3><p class="tiny muted">${esc(x.actionPlan || 'None recorded.')}</p>`
  : `<div class="detail-grid">
    ${x.poNo ? `<div><small>PO number</small><strong>${esc(x.poNo)}</strong></div>` : ''}
    ${x.deliveryDate ? `<div><small>PO delivery date</small><strong>${fmtDate(x.deliveryDate)}</strong></div>` : ''}
    ${x.planExw != null ? `<div><small>Ex-works</small><strong>${x.actExw ?? '—'}% <span class="tiny muted">/ ${x.planExw ?? '—'}% plan</span></strong></div>` : ''}
    ${x.planArrival != null ? `<div><small>Arrival at site</small><strong>${x.actArrival ?? '—'}% <span class="tiny muted">/ ${x.planArrival ?? '—'}% plan</span></strong></div>` : ''}
    <div><small>Cumulative progress</small><strong>${x.actualPct ?? '—'}% <span class="tiny muted">/ ${x.planPct ?? '—'}% plan</span></strong></div>
    <div><small>Variance</small><strong>${x.variance ?? '—'} pp</strong></div>
  </div>${x.currentStatusText ? `<h3>Current status</h3><p class="tiny muted">${esc(x.currentStatusText)}</p>` : ''}`}
  </div>`, button('Close', 'close'));
}

/* ---------------- task management (personal workspace) ---------------- */
const TASKS_KEY = 'projectflow-claude-mvp-tasks-1';
function seedTasks() {
  const flagged = EXPEDITING.filter(x => /Delay|At Risk/i.test(x.status) && x.highlight && x.highlight !== 'No').slice(0, 3);
  const linked = flagged.map((x, i) => ({ id: 'TK' + (i + 1), title: `Follow up: ${x.name || x.code}`, note: `${x.discipline} · ${x.vendor || 'vendor tbc'} · ${esc(x.status)}`, due: PROJECT.cutoff, priority: x.status === 'Delay' ? 'High' : 'Normal', status: 'To do' }));
  return [...linked, { id: 'TK' + (linked.length + 1), title: 'Prepare weekly vendor review agenda', note: 'Personal · recurring', due: PROJECT.cutoff, priority: 'Normal', status: 'In progress' }];
}
let tasks;
try { const saved = JSON.parse(localStorage.getItem(TASKS_KEY)); tasks = Array.isArray(saved) && saved.length ? saved : seedTasks(); } catch { tasks = seedTasks(); }
function saveTasks() { try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {} }

function renderTasks() {
  const open = tasks.filter(t => t.status !== 'Done').length;
  const overdue = tasks.filter(t => t.status !== 'Done' && t.due < PROJECT.cutoff).length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const stats = [stat('Open tasks', open, 'To do + in progress', 'check'), stat('Overdue', overdue, 'Due date before the project cut-off', 'clock'), stat('Completed', done, 'Done in this browser', 'risk')];
  const cols = ['To do', 'In progress', 'Done'];
  const board = `<div class="board">${cols.map(col => `<section class="board-column"><h3>${col} <span class="count">${tasks.filter(t => t.status === col).length}</span></h3>
    ${tasks.filter(t => t.status === col).map(t => `<article class="task-card">${badge(t.priority, t.priority === 'High' ? 'red' : t.priority === 'Low' ? 'indigo' : 'amber')}<h3>${esc(t.title)}</h3><p>${esc(t.note || '')}</p>
      <div class="task-bottom"><span class="tiny muted">Due ${fmtDate(t.due)}</span>${col !== 'Done' ? button(col === 'To do' ? 'Start' : 'Complete', 'task-step', '', 'small', `data-id="${t.id}"`) : ''}</div>
      <div style="margin-top:10px">${button('Remove', 'task-remove', 'close', 'text', `data-id="${t.id}"`)}</div>
    </article>`).join('') || '<div class="tiny muted">No tasks in this column.</div>'}
  </section>`).join('')}</div>`;
  return head('Task management', 'Personal workspace — your own follow-ups and reminders, kept only in this browser.', 'New task', 'new-task', 'plus') + `<div class="stats">${stats.join('')}</div>${board}`;
}
function newTaskModal() {
  modal('Create task', `<form id="task-form"><div class="dialog-body"><div class="form-grid">
    <label class="field full">Task title<input name="title" required maxlength="120" placeholder="Describe the next action"></label>
    <label class="field">Due date<input type="date" name="due" value="${PROJECT.cutoff}" required></label>
    <label class="field">Priority<select name="priority"><option>Normal</option><option>High</option><option>Low</option></select></label>
    <label class="field full">Notes<textarea name="note" placeholder="Optional context"></textarea></label>
  </div></div><div class="dialog-actions">${button('Cancel', 'close')}<button class="btn primary" type="submit">Create task</button></div></form>`);
}

/* ---------------- settings ---------------- */
function renderSettings() {
  const tabs = [['modules', 'Modules'], ['general', 'General'], ['data', 'Data sources']];
  const tabsHTML = `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button class="tab ${settingsTab === id ? 'active' : ''}" data-settings-tab="${id}" role="tab" aria-selected="${settingsTab === id}">${label}</button>`).join('')}</div>`;
  const body = settingsTab === 'general' ? generalSettingsBody() : settingsTab === 'data' ? dataSourcesBody() : modulesSettingsBody();
  return head('Settings', 'Turn modules on or off, set your display preferences, and see where the demo data comes from.') + tabsHTML + body;
}
function moduleRows(n, depth = 0) {
  const parentOn = !n.parent || isOn(n.parent.id);
  const locked = !!n.locked;
  const anyWired = x => !!WIRED[x.id] || x.subs.some(anyWired);
  const wired = anyWired(n);
  let html = `<div class="setting-row ${parentOn ? '' : 'is-off'}" style="padding-left:${22 + depth * 28}px"><div><div class="breadcrumb ${depth === 0 ? 'top' : ''}">${crumbHTML(n.path)}</div>
    <small>${n.desc ? esc(n.desc) + ' ' : ''}${wired ? badge('Connected', 'green') : 'Not yet connected'}${locked ? ' · always on' : ''}</small></div>
    <input class="switch" type="checkbox" data-module-toggle="${n.id}" ${prefs.modules[n.id] ? 'checked' : ''} ${locked || !parentOn ? 'disabled' : ''} aria-label="${esc(n.path.join(' / '))}"></div>`;
  return html + n.subs.map(sn => moduleRows(sn, depth + 1)).join('');
}
function modulesSettingsBody() {
  const ws = wsById(settingsWs) || WORKSPACES[0];
  const count = w => { const ids = []; const walk = n => { ids.push(n.id); n.subs.forEach(walk); }; w.modules.forEach(walk); return `${ids.filter(i => prefs.modules[i]).length}/${ids.length}`; };
  return `<p class="page-sub" style="margin:-6px 0 16px">Enable or disable each module and submodule. A disabled module hides its submodules; only enabled items appear in the sidebar.</p>
  <div class="actions" style="margin-bottom:18px">${WORKSPACES.map(w => button(`${esc(w.label)} <span class="tiny">${count(w)}</span>`, 'settings-ws', '', w.id === ws.id ? 'primary' : '', `data-ws="${w.id}"`)).join('')}</div>
  <section class="panel"><div class="panel-head"><div><h2>${esc(ws.label)} workspace</h2><p>${ws.modules.length} modules</p></div></div>${ws.modules.map(m => moduleRows(m)).join('')}</section>`;
}
function generalSettingsBody() {
  return `<div class="settings-grid">
    <section class="panel"><div class="panel-head"><h2>Workspace preferences</h2></div>
      <div class="setting-row"><div><strong>Dark appearance</strong><small>Theme preference is saved in this browser.</small></div><input class="switch" id="theme" type="checkbox" ${prefs.dark ? 'checked' : ''} aria-label="Dark appearance"></div>
      <div class="setting-row"><div><strong>Default workspace</strong><small>Which side you land on when you open the app.</small></div><select class="filter" id="default-workspace">${WORKSPACES.map(w => `<option value="${w.id}" ${prefs.workspace === w.id ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}</select></div>
    </section>
    <section class="panel"><div class="panel-head"><h2>Reset</h2></div>
      <div class="setting-row"><div><strong>Reset preferences</strong><small>Restore default module visibility and theme.</small></div>${button('Reset', 'reset-prefs', '', 'small')}</div>
      <div class="setting-row"><div><strong>Reset tasks</strong><small>Restore the seeded personal task list.</small></div>${button('Reset', 'reset-tasks', '', 'small')}</div>
    </section></div>`;
}
function dataSourcesBody() {
  return `<div class="settings-grid"><section class="panel" style="grid-column:1/-1"><div class="panel-head"><h2>Data sources</h2></div>
      <div style="padding:0 22px 22px"><p class="tiny muted">This is a frontend-only demonstration built from two real EPCIC workbooks. Data is extracted once and is read-only — nothing here writes back to the source files.</p>
      <div class="detail-grid">
        <div><small>Project</small><strong>${esc(PROJECT.name)}</strong></div>
        <div><small>Contract</small><strong>${esc(PROJECT.contract)}</strong></div>
        <div><small>Schedule source</small><strong>Procurement Plan workbook · S-CURVES (M), Progress Table (W)</strong></div>
        <div><small>Procurement source</small><strong>Expediting Report · pgk_gen_info</strong></div>
        <div><small>Expediting source</small><strong>Expediting Report · Equipment / Structural / Pipe-Fitting / Valves / Misc summaries</strong></div>
        <div><small>Cut-off date</small><strong>${fmtDate(PROJECT.cutoff)}</strong></div>
      </div></div>
    </section></div>`;
}

function renderPlaceholder(m) {
  return head(m.label, `${esc(m.path.slice(0, -1).join(' / '))} · not yet connected to a data source.`)
    + `<div class="panel empty" style="padding:50px 30px;text-align:left">
      <h3 style="margin-bottom:8px">No data connected yet</h3>
      <p class="tiny muted" style="max-width:520px">This module is enabled in Settings so it shows up in the sidebar, but this MVP doesn't have a workbook wired to it yet. Once a ${esc(m.label)} source file is added to <code>/data</code>, this register can be built out the same way Overall Progress, Procurement Plan and Vendor Overview were.</p>
      <div style="margin-top:16px">${button('Open module settings', 'show-settings-modules', '', 'small')}</div>
    </div>`;
}

/* ---------------- render / events ---------------- */
const WIRED = {
  dashboard: () => renderDashboard(),
  'task-management.board': () => renderTasks(),
  'planning.overall-progress': () => renderProgressOverall(),
  'planning.work-packages': () => renderWorkPackages(),
  'procurement.procurement-plan': () => renderProcurement(),
  'procurement.expediting.vendor-overview': () => renderExpediting(),
};
function renderEmptyWorkspace() {
  const ws = wsById(prefs.workspace);
  return head(ws.label, `No ${esc(ws.label)} modules are enabled.`) + `<div class="panel empty">${button('Open module settings', 'show-settings-modules', '', 'small')}</div>`;
}
function render() {
  if (view !== 'settings' && view !== 'ws-empty' && (!NODES[view] || !isOn(view))) view = defaultView();
  renderShell();
  let content;
  if (view === 'settings') content = renderSettings();
  else if (view === 'ws-empty') content = renderEmptyWorkspace();
  else content = WIRED[view] ? WIRED[view]() : renderPlaceholder(NODES[view]);
  $('#main').innerHTML = `<div class="fade">${content}</div>`;
}

function modal(title, body, actions = '') {
  const d = $('#dialog');
  d.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>${body}${actions ? `<div class="dialog-actions">${actions}</div>` : ''}`;
  if (!d.open) d.showModal();
}

function exportCSV() {
  let rows;
  if (view === 'procurement.procurement-plan') rows = [['Code', 'Discipline', 'Description', 'Vendor', 'LOA No', 'LOA Date', 'PO No', 'PO Date', 'Buyer', 'Expeditor', 'Status'], ...filteredProcurement().map(p => [p.code, p.discipline, p.description, p.vendor, p.loaNo, p.loaDate, p.poNo, p.poDate, p.buyer, p.expeditor, p.status])];
  else if (view === 'procurement.expediting.vendor-overview') rows = [['Code', 'Discipline', 'Name', 'Vendor', 'Plan %', 'Actual %', 'Variance', 'Status'], ...filteredExpediting().map(x => [x.code, x.discipline, x.name, x.vendor, x.planPct, x.actualPct, x.variance, x.status])];
  else rows = [['Work Package', 'Name', 'Weight %', 'Last Week Plan', 'Last Week Actual', 'This Week Plan', 'This Week Actual'], ...SCHEDULE.workPackages.map(wp => [wp.code, wp.name, wp.weight, wp.lastWeekPlan, wp.lastWeekActual, wp.thisWeekPlan, wp.thisWeekActual])];
  const safe = v => { let s = String(v ?? ''); if (/^[=+@\-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const blob = new Blob(['﻿' + rows.map(r => r.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `ProjectFlow_${PROJECT.code}_${view}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Current view exported to CSV.');
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]'); if (nav) { navigate(nav.dataset.nav); return; }
  const ws = e.target.closest('[data-workspace]'); if (ws) { prefs.workspace = ws.dataset.workspace; savePrefs(); navigate(defaultView()); return; }
  const st = e.target.closest('[data-settings-tab]'); if (st) { settingsTab = st.dataset.settingsTab; render(); return; }
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id;
  if (a === 'close') $('#dialog').close();
  else if (a === 'menu') $('#sidebar').classList.toggle('open');
  else if (a === 'procurement-detail') procurementDetail(id);
  else if (a === 'expediting-detail') expeditingDetail(id);
  else if (a === 'export') exportCSV();
  else if (a === 'clear') { query = ''; disciplineFilter = 'all'; statusFilter = 'all'; render(); }
  else if (a === 'show-schedule') navigate('planning.overall-progress')
  else if (a === 'show-wp') navigate('planning.work-packages');
  else if (a === 'show-procurement') navigate('procurement.procurement-plan');
  else if (a === 'show-expediting') navigate('procurement.expediting.vendor-overview');
  else if (a === 'show-settings') navigate('settings');
  else if (a === 'show-settings-modules') { settingsTab = 'modules'; navigate('settings'); }
  else if (a === 'reset-prefs') { prefs = seedPrefs(); savePrefs(); render(); toast('Preferences reset.'); }
  else if (a === 'reset-tasks') { tasks = seedTasks(); saveTasks(); render(); toast('Tasks reset.'); }
  else if (a === 'settings-ws') { settingsWs = b.dataset.ws; render(); }
  else if (a === 'new-task') newTaskModal();
  else if (a === 'task-step') { const t = tasks.find(t => t.id === id); if (!t) return; t.status = t.status === 'To do' ? 'In progress' : 'Done'; saveTasks(); render(); toast('Task updated.'); }
  else if (a === 'task-remove') { tasks = tasks.filter(t => t.id !== id); saveTasks(); render(); toast('Task removed.'); }
  else if (a === 'notifications') {
    const flags = EXPEDITING.filter(x => /Delay|At Risk/i.test(x.status)).slice(0, 8);
    modal('Notification center', `<div class="dialog-body">${flags.map(x => `<div class="timeline-event"><strong>${esc(x.name || x.code)}</strong><small>${esc(x.vendor || x.code)} · ${esc(x.status)}</small></div>`).join('') || '<p>No open flags.</p>'}</div>`, button('Close', 'close'));
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'theme') { prefs.dark = e.target.checked; savePrefs(); render(); }
  else if (e.target.id === 'default-workspace') { prefs.workspace = e.target.value; savePrefs(); toast('Default workspace updated.'); }
  else if (e.target.matches('[data-module-toggle]')) {
    const id = e.target.dataset.moduleToggle;
    prefs.modules[id] = e.target.checked; savePrefs();
    render();
    toast('Modules updated.');
  }
  else if (e.target.id === 'discipline-filter') { disciplineFilter = e.target.value; render(); }
  else if (e.target.id === 'status-filter') { statusFilter = e.target.value; render(); }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'search') return;
  query = e.target.value;
  if (view === 'procurement.procurement-plan') $('#procurement-rows').innerHTML = procurementTable();
  else if (view === 'procurement.expediting.vendor-overview') $('#expediting-rows').innerHTML = expeditingTable();
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id !== 'task-form') return;
  const v = Object.fromEntries(new FormData(e.target));
  if (!e.target.reportValidity()) return;
  tasks.unshift({ id: 'TK' + Date.now(), title: v.title, due: v.due, priority: v.priority, note: v.note, status: 'To do' });
  saveTasks();
  $('#dialog').close();
  render();
  toast('Task created.');
});
$('#dialog').addEventListener('click', e => {
  if (e.target === $('#dialog')) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
  }
});

render();
