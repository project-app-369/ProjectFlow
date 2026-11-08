/* Project Flow — v1_claude MVP demo application logic.
   Vanilla JS, no build step, no framework. Renders views into #view-root
   from the mock data in data.js. All actions are client-side only. */

(() => {
  'use strict';

  /* ---------------- Icon sprite (inline SVG strokes) ---------------- */
  const ICONS = {
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/>',
    'shopping-cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    'git-merge': '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v6a6 6 0 0 0 6 6h3"/><path d="M18 9V6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'bar-chart-2': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="8" y2="6.01"/><line x1="16" y1="6" x2="16" y2="6.01"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/>',
    alertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  };
  function icon(name, cls) {
    return `<span class="icon ${cls || ''}"><svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg></span>`;
  }

  /* ---------------- State ---------------- */
  const state = {
    user: null,
    projectId: null,
    route: 'dashboard',
    sidebarCollapsed: false,
    taskView: 'list',
    docFilter: '',
    engTab: 'deliverables',
    procTab: 'plan',
    mgmtTab: 'risk',
    evtTab: 'events',
    workspaceTab: 'myday',
  };

  /* ---------------- Helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function h(strings, ...values) { return strings.reduce((out, s, i) => out + s + (values[i] ?? ''), ''); }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(d) {
    if (!d || d === '—') return '—';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function initialsColor(name) {
    const u = DEMO.users.find(u => u.name === name);
    return u ? { initials: u.initials, color: u.color } : { initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(), color: '#526477' };
  }
  function avatar(name, size) {
    const { initials, color } = initialsColor(name);
    return `<span class="avatar ${size === 'lg' ? 'avatar-lg' : ''}" style="background:${color}" title="${escapeHtml(name)}">${initials}</span>`;
  }
  function statusTone(status) {
    const s = status.toLowerCase();
    if (/(late|overdue|rejected|blocked|critical|revision required|slipping)/.test(s)) return 'critical';
    if (/(review|pending|submitted|draft|evaluation|inquiry|under review|awaiting|assigned)/.test(s)) return 'warning';
    if (/(ahead|closed|complete|accepted|approved|agreed|authorized|issued|awarded|published|on track)/.test(s)) return 'success';
    return 'info';
  }
  function badge(text, tone) {
    tone = tone || statusTone(text);
    return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
  }
  function toast(msg) {
    const stack = $('#toast-stack');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function closeMenus() { $$('.menu.open').forEach(m => m.classList.remove('open')); }

  /* ---------------- Theme ---------------- */
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
    localStorage.setItem('pf_theme', mode);
    $$('.theme-toggle button').forEach(b => b.classList.toggle('active', b.dataset.theme === mode));
  }
  function initTheme() {
    const saved = localStorage.getItem('pf_theme') || 'system';
    applyTheme(saved);
  }

  /* ---------------- Auth / project selection ---------------- */
  function renderLogin() {
    const screen = $('#login-screen');
    screen.innerHTML = h`
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark">${icon('git-merge')}</span>
          <div>
            <div class="brand-name">Project Flow</div>
            <div class="brand-tagline">Connected modules. Coordinated delivery.</div>
          </div>
        </div>
        <h1 style="font-size:22px;margin-bottom:6px;">Start focused. Build connected.</h1>
        <p class="auth-tagline">Sign in to continue to your organization's projects.</p>
        <form id="login-form">
          <div class="field"><label for="login-email">Email</label><input class="input" id="login-email" type="email" placeholder="you@company.com" value="alvaro.reyes@projectflow.demo" required></div>
          <div class="field"><label for="login-pass">Password</label><input class="input" id="login-pass" type="password" placeholder="••••••••••••••" value="demo-password"></div>
          <button class="btn btn-primary w-full" type="submit" style="justify-content:center;">Sign in ${icon('arrowRight')}</button>
        </form>
        <p class="auth-tagline" style="margin:var(--space-5) 0 6px;">Or continue as a demo user</p>
        <div class="auth-demo-users">
          ${DEMO.users.slice(0, 5).map(u => h`
            <button class="auth-demo-user" data-user="${u.id}">
              ${avatar(u.name)} <span>${u.name} — <span class="muted">${u.title}</span></span>
            </button>`).join('')}
        </div>
        <p class="auth-footer-note">MVP demo build · v1_claude · all data is sample data</p>
      </div>`;

    $('#login-form').addEventListener('submit', e => { e.preventDefault(); signIn(DEMO.currentUser.id); });
    $$('.auth-demo-user', screen).forEach(btn => btn.addEventListener('click', () => signIn(btn.dataset.user)));
  }

  function signIn(userId) {
    state.user = DEMO.users.find(u => u.id === userId) || DEMO.currentUser;
    $('#login-screen').classList.add('hidden');
    renderProjectSelector();
  }

  function renderProjectSelector() {
    const screen = $('#selector-screen');
    screen.classList.remove('hidden');
    screen.innerHTML = h`
      <div class="selector-header">
        <div>
          <h1 class="page-title">My Projects</h1>
          <p class="page-subtitle">Signed in as ${state.user.name} — ${state.user.title}</p>
        </div>
        <button class="btn" id="selector-signout">Sign out</button>
      </div>
      <div class="selector-grid">
        ${DEMO.projects.map(p => h`
          <div class="card project-card" data-project="${p.id}">
            <div class="flex items-center gap-3">
              <span class="brand-mark" style="width:36px;height:36px;">${icon('building')}</span>
              <div>
                <div style="font-weight:800;font-family:var(--font-heading);font-size:16px;">${p.title}</div>
                <div class="muted text-sm">${p.code} · ${p.client}</div>
              </div>
              <span class="pill stage-pill">${p.stage}</span>
            </div>
            <div class="project-card-meta">
              <div><b>Type:</b> ${p.type} · <b>Location:</b> ${p.location}</div>
              <div><b>PM:</b> ${p.pm} · <b>Modules enabled:</b> ${p.modules}</div>
              <div><b>Window:</b> ${fmtDate(p.start)} – ${fmtDate(p.finish)}</div>
            </div>
            <button class="btn btn-primary" style="width:100%;justify-content:center;">Open project ${icon('arrowRight')}</button>
          </div>`).join('')}
      </div>`;

    $$('.project-card', screen).forEach(card => card.addEventListener('click', () => enterProject(card.dataset.project)));
    $('#selector-signout').addEventListener('click', signOut);
  }

  function enterProject(projectId) {
    state.projectId = projectId;
    DEMO.setCurrentProject(projectId);
    $('#selector-screen').classList.add('hidden');
    $('#app').classList.add('active');
    buildShell();
    navigate('dashboard');
  }

  function signOut() {
    state.user = null; state.projectId = null;
    $('#app').classList.remove('active');
    $('#selector-screen').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
    renderLogin();
  }

  /* ---------------- App shell ---------------- */
  function currentProject() { return DEMO.projects.find(p => p.id === state.projectId); }

  function buildShell() {
    let lastGroup = null;
    const navHtml = DEMO.nav.map(item => {
      const groupLabel = (item.group && item.group !== lastGroup) ? `<div class="nav-group-label">${item.group}</div>` : '';
      lastGroup = item.group;
      return h`
        ${groupLabel}
        <a href="#${item.id}" class="nav-item" data-route="${item.id}">
          ${icon(item.icon)}<span class="nav-text">${item.label}</span>
          ${item.id === 'tasks' ? `<span class="nav-badge">${DEMO.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Closed').length}</span>` : ''}
        </a>`;
    }).join('');

    $('#sidebar').innerHTML = h`
      <div class="brand-lockup">
        <span class="brand-mark">${icon('git-merge')}</span>
        <div>
          <div class="brand-name">Project Flow</div>
          <div class="brand-tagline">Connected modules.</div>
        </div>
      </div>
      <nav class="nav-scroll">${navHtml}</nav>
      <div class="sidebar-footer">
        <button class="nav-item" id="collapse-btn" style="width:100%;">${icon('menu')}<span class="nav-text">Collapse</span></button>
      </div>`;

    $$('.nav-item[data-route]', $('#sidebar')).forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); navigate(a.dataset.route); closeMobileNav();
    }));
    $('#collapse-btn').addEventListener('click', () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      $('#sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    });

    renderTopbar();
  }

  function renderTopbar() {
    const p = currentProject();
    $('#topbar').innerHTML = h`
      <button class="icon-btn mobile-nav-toggle" id="mobile-nav-toggle" aria-label="Open navigation menu">${icon('menu')}</button>
      <div class="menu-anchor" id="project-menu-anchor">
        <button class="project-switcher" id="project-switcher-btn">
          ${icon('building')} ${p.code} — ${p.short} ${icon('chevronDown')}
        </button>
        <div class="menu" id="project-menu">
          <div class="menu-section-label">Switch project</div>
          ${DEMO.projects.map(pr => h`<button class="menu-item" data-switch-project="${pr.id}">${icon('building')} ${pr.code} — ${pr.short}</button>`).join('')}
          <div class="menu-divider"></div>
          <button class="menu-item" id="goto-my-projects">${icon('grid')} My Projects</button>
        </div>
      </div>
      <div class="search-box" style="width:320px;">
        ${icon('search')}<input class="input" placeholder="Search records, documents, tasks… (demo)">
      </div>
      <div class="topbar-spacer"></div>
      <div class="theme-toggle" id="theme-toggle">
        <button data-theme="light" title="Light">${icon('sun')}</button>
        <button data-theme="dark" title="Dark">${icon('moon')}</button>
        <button data-theme="system" title="System">${icon('monitor')}</button>
      </div>
      <div class="menu-anchor" id="notif-anchor">
        <button class="icon-btn" id="notif-btn" aria-label="Notifications">${icon('bell')}<span class="dot"></span></button>
        <div class="menu" id="notif-menu" style="width:320px;">
          <div class="menu-section-label">Notifications</div>
          ${DEMO.notifications.map(n => h`
            <div class="notif-item">
              <span class="notif-dot" style="background:var(--${n.tone})"></span>
              <div><div class="notif-title">${n.title}</div><div class="notif-time">${n.time}</div></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="menu-anchor" id="profile-anchor">
        <button class="icon-btn" id="profile-btn" style="width:auto;padding:4px;">${avatar(state.user.name)}</button>
        <div class="menu" id="profile-menu">
          <div class="menu-section-label">${state.user.name}</div>
          <button class="menu-item" data-route="profile">${icon('settings')} Profile</button>
          <button class="menu-item" data-route="settings">${icon('settings')} Settings</button>
          <div class="menu-divider"></div>
          <button class="menu-item" id="menu-signout">${icon('x')} Sign out</button>
        </div>
      </div>`;

    $('#mobile-nav-toggle').addEventListener('click', () => {
      $('#sidebar').classList.add('mobile-open');
      $('#sidebar-overlay').classList.add('open');
    });
    $('#project-switcher-btn').addEventListener('click', e => { e.stopPropagation(); toggleMenu('#project-menu'); });
    $$('[data-switch-project]').forEach(b => b.addEventListener('click', () => {
      enterProject(b.dataset.switchProject); toast(`Switched to ${currentProject().short}`);
    }));
    $('#goto-my-projects').addEventListener('click', () => {
      $('#app').classList.remove('active'); renderProjectSelector();
    });
    $('#notif-btn').addEventListener('click', e => { e.stopPropagation(); toggleMenu('#notif-menu'); });
    $('#profile-btn').addEventListener('click', e => { e.stopPropagation(); toggleMenu('#profile-menu'); });
    $('#menu-signout').addEventListener('click', signOut);
    $$('#profile-menu [data-route]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.route)));
    $$('#theme-toggle button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
    applyTheme(localStorage.getItem('pf_theme') || 'system');
  }
  function toggleMenu(sel) { const m = $(sel); const was = m.classList.contains('open'); closeMenus(); if (!was) m.classList.add('open'); }
  function closeMobileNav() { $('#sidebar').classList.remove('mobile-open'); $('#sidebar-overlay').classList.remove('open'); }
  document.addEventListener('click', closeMenus);

  /* ---------------- Router ---------------- */
  const VIEWS = {
    workspace: viewWorkspace, dashboard: viewDashboard, tasks: viewTasks,
    documents: viewDocuments, engineering: viewEngineering, procurement: viewProcurement,
    planning: viewPlanning, management: viewManagement, interfaces: viewInterfaces,
    events: viewEvents, reports: viewReports, settings: viewSettings, profile: viewProfile,
  };
  const LABELS = Object.fromEntries(DEMO.nav.map(n => [n.id, n.label]));
  LABELS.profile = 'Profile';

  function navigate(route) {
    if (!VIEWS[route]) route = 'dashboard';
    state.route = route;
    $$('.nav-item[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    $('#breadcrumb-text').textContent = LABELS[route] || route;
    $('#view-root').innerHTML = VIEWS[route]();
    wireView(route);
    $('.content-scroll').scrollTop = 0;
  }

  /* ---------------- Shared render bits ---------------- */
  function pageHeader(title, subtitle, actionsHtml) {
    return h`<div class="page-header">
      <div><h1 class="page-title">${title}</h1>${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}</div>
      <div class="page-actions">${actionsHtml || ''}</div>
    </div>`;
  }
  function registerToolbar(placeholder, extraHtml) {
    return h`<div class="register-toolbar">
      <div class="search-box" style="width:280px;">${icon('search')}<input class="input" placeholder="${placeholder}"></div>
      ${extraHtml || ''}
      <div class="toolbar-spacer"></div>
      <button class="btn btn-sm">${icon('filter')} Filters</button>
      <button class="btn btn-sm">${icon('download')} Export</button>
    </div>`;
  }
  function tableFooter(count) {
    return h`<div class="table-footer"><span>Showing ${count} of ${count} records</span><span>Page 1 of 1</span></div>`;
  }

  /* ---------------- Dashboard ---------------- */
  function donutChart(value, size) {
    const r = 46, c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return h`<div class="donut">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${r}" stroke="var(--border)"></circle>
        <circle cx="60" cy="60" r="${r}" stroke="var(--accent)" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"></circle>
      </svg>
      <div class="donut-value"><span class="n">${pct.toFixed(1)}%</span><span class="l">accepted</span></div>
    </div>`;
  }
  function sCurveSvg(d) {
    const W = 560, H = 170, pad = 28;
    const max = 100;
    const xStep = (W - pad * 2) / (d.weeks.length - 1);
    const pts = arr => arr.map((v, i) => `${pad + i * xStep},${H - pad - (v / max) * (H - pad * 2)}`).join(' ');
    const gridLines = [0, 25, 50, 75, 100].map(v => {
      const y = H - pad - (v / max) * (H - pad * 2);
      return `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    }).join('');
    const labels = d.weeks.map((w, i) => `<text x="${pad + i * xStep}" y="${H - 6}" font-size="10" fill="var(--text-secondary)" text-anchor="middle">${w}</text>`).join('');
    return h`<div class="scurve"><svg viewBox="0 0 ${W} ${H}">
        ${gridLines}
        <polyline points="${pts(d.planned)}" fill="none" stroke="var(--border)" stroke-width="2.5" stroke-dasharray="5,4"/>
        <polyline points="${pts(d.actual)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
        ${d.actual.map((v, i) => `<circle cx="${pad + i * xStep}" cy="${H - pad - (v / max) * (H - pad * 2)}" r="3" fill="var(--accent)"/>`).join('')}
        ${labels}
      </svg></div>
      <div class="scurve-legend">
        <span><span style="display:inline-block;width:10px;height:2px;background:var(--border);margin-right:6px;"></span>Planned</span>
        <span><span style="display:inline-block;width:10px;height:2px;background:var(--accent);margin-right:6px;"></span>Actual accepted</span>
      </div>`;
  }

  function viewDashboard() {
    const d = DEMO.dashboard;
    return h`
    ${pageHeader('Dashboard', `${currentProject().title} · Cutoff ${fmtDate(d.overallProgress.cutoff)} · ${d.overallProgress.baseline}`,
      `<button class="btn btn-sm">${icon('download')} Export snapshot</button><button class="btn btn-primary btn-sm">${icon('plus')} Customize layout</button>`)}

    <div class="grid grid-cols-4 mb-4">
      ${d.kpis.map(k => h`<div class="card kpi-card"><span class="kpi-label">${k.label}</span><span class="kpi-value ${k.tone}">${k.value}</span></div>`).join('')}
    </div>

    <div class="grid grid-cols-3 mb-4">
      <div class="card grid-span-2">
        <div class="card-header"><h3>Overall EPCIC Progress — S-curve</h3><span class="pill">Weekly</span></div>
        ${sCurveSvg(d.sCurve)}
      </div>
      <div class="card">
        <div class="card-header"><h3>Overall Progress</h3></div>
        <div class="donut-wrap">
          ${donutChart(d.overallProgress.accepted)}
          <div class="legend">
            <div class="legend-item"><span class="legend-swatch" style="background:var(--accent)"></span>Accepted ${d.overallProgress.accepted}%</div>
            <div class="legend-item"><span class="legend-swatch" style="background:var(--border)"></span>Planned ${d.overallProgress.planned}%</div>
          </div>
        </div>
        <p class="text-sm muted" style="margin-top:var(--space-3);">Variance ${(d.overallProgress.accepted - d.overallProgress.planned).toFixed(1)} pp vs. plan at cutoff.</p>
      </div>
    </div>

    <div class="grid grid-cols-3">
      <div class="card">
        <div class="card-header"><h3>Milestone trend</h3><a href="#" data-route-link="planning">View all ${icon('arrowRight')}</a></div>
        ${d.milestones.map(m => h`
          <div class="stat-row">
            <div><div style="font-weight:600;">${m.name}</div><div class="muted text-sm">Baseline ${fmtDate(m.baseline)} → Forecast ${fmtDate(m.forecast)}</div></div>
            ${badge(m.status)}
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-header"><h3>Overdue actions</h3><a href="#" data-route-link="tasks">View all ${icon('arrowRight')}</a></div>
        ${d.overdue.map(o => h`
          <div class="stat-row">
            <div><div style="font-weight:600;">${o.title}</div><div class="muted text-sm">Due ${fmtDate(o.due)} · ${o.owner}</div></div>
            ${avatar(o.owner)}
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-header"><h3>Document review queue</h3><a href="#" data-route-link="documents">View all ${icon('arrowRight')}</a></div>
        ${d.reviewQueue.map(r => h`
          <div class="stat-row">
            <div><div style="font-weight:600;">${r.doc}</div><div class="muted text-sm">${r.type}</div></div>
            ${badge(r.days + 'd left', r.days <= 1 ? 'critical' : r.days <= 3 ? 'warning' : 'info')}
          </div>`).join('')}
      </div>
    </div>

    <div class="grid grid-cols-2" style="margin-top:var(--space-5);">
      <div class="card">
        <div class="card-header"><h3>Reporting completeness</h3></div>
        <div class="progress-bar" style="margin-bottom:8px;"><span style="width:${d.reportingCompleteness * 100}%"></span></div>
        <p class="text-sm muted">${Math.round(d.reportingCompleteness * 100)}% of required reporting units submitted valid updates for this period.</p>
      </div>
      <div class="card">
        <div class="card-header"><h3>Engineering discipline summary</h3></div>
        ${DEMO.workPackages.map(w => h`
          <div class="stat-row">
            <div style="flex:1;"><div style="font-weight:600;">${w.discipline}</div>
              <div class="progress-bar sm" style="margin-top:4px;"><span style="width:${w.progress}%"></span></div>
            </div>
            <span style="margin-left:var(--space-3);font-weight:700;">${w.progress}%</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------- My Workspace ---------------- */
  function viewWorkspace() {
    const tabs = [
      ['myday', 'My Day'], ['inbox', 'Inbox'], ['assigned', 'Assigned to Me'],
      ['byme', 'Assigned by Me'], ['approvals', 'My Approvals'],
    ];
    const active = state.workspaceTab;
    let body = '';
    if (active === 'myday' || active === 'assigned') {
      const list = active === 'myday' ? DEMO.myDay : DEMO.tasks;
      body = h`<div class="table-wrap"><table class="register"><thead><tr>
          <th>Task</th><th>Source</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th>
        </tr></thead><tbody>
        ${list.map(t => h`<tr data-task="${t.id}">
          <td class="cell-primary">${t.title}</td><td class="cell-muted">${t.source}</td>
          <td>${avatar(t.assignee)} ${t.assignee}</td><td>${badge(t.priority, t.priority === 'Urgent' ? 'critical' : t.priority === 'High' ? 'warning' : 'info')}</td>
          <td>${badge(t.status)}</td><td class="cell-muted">${fmtDate(t.due)}</td>
        </tr>`).join('')}
        </tbody></table></div>${tableFooter(list.length)}`;
    } else if (active === 'inbox') {
      body = h`<div class="card">${DEMO.inbox.map(i => h`
        <div class="stat-row"><div><div style="font-weight:600;">${i.title}</div></div><span class="muted text-sm">${i.time}</span></div>`).join('')}</div>`;
    } else if (active === 'byme') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Due</th></tr></thead><tbody>
        ${DEMO.tasks.filter(t => t.assignee !== state.user.name).slice(0, 5).map(t => h`
          <tr><td class="cell-primary">${t.title}</td><td>${avatar(t.assignee)} ${t.assignee}</td><td>${badge(t.status)}</td><td class="cell-muted">${fmtDate(t.due)}</td></tr>`).join('')}
        </tbody></table></div>`;
    } else if (active === 'approvals') {
      body = h`<div class="card">
        ${DEMO.tasks.filter(t => t.status === 'Submitted for review' || t.status === 'Under review').map(t => h`
          <div class="stat-row"><div><div style="font-weight:600;">${t.title}</div><div class="muted text-sm">${t.source}</div></div>
            <div class="flex gap-2"><button class="btn btn-sm">Return</button><button class="btn btn-primary btn-sm">Approve</button></div></div>`).join('')
          || `<div class="empty-state">${icon('check-square')}<div>No approvals waiting on you right now.</div></div>`}
        </div>`;
    }
    return h`${pageHeader('My Workspace', 'A private, cross-project view of your work. Source workflows keep authority over approvals and completion.')}
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${active === id ? 'active' : ''}" data-wtab="${id}">${label}</button>`).join('')}</div>
      <div id="workspace-body">${body}</div>`;
  }

  /* ---------------- Tasks Management ---------------- */
  function viewTasks() {
    const cols = ['Draft', 'Assigned', 'In progress', 'Submitted for review', 'Blocked', 'Completed'];
    return h`${pageHeader('Tasks Management', 'Project Tasks · Board · Calendar · Workload',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New task</button>`)}
      <div class="tabs">
        <button class="tab ${state.taskView === 'list' ? 'active' : ''}" data-tview="list">List</button>
        <button class="tab ${state.taskView === 'board' ? 'active' : ''}" data-tview="board">Board</button>
        <button class="tab ${state.taskView === 'workload' ? 'active' : ''}" data-tview="workload">Workload</button>
      </div>
      <div id="tasks-body">${state.taskView === 'board' ? tasksBoard(cols) : state.taskView === 'workload' ? tasksWorkload() : tasksList()}</div>`;
  }
  function tasksList() {
    return h`${registerToolbar('Search tasks by title, ID, or assignee…')}
      <div class="table-wrap"><table class="register"><thead><tr>
        <th>ID</th><th>Title</th><th>Source</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th>
      </tr></thead><tbody>
      ${DEMO.tasks.map(t => h`<tr data-task="${t.id}">
        <td class="cell-mono">${t.id}</td><td class="cell-primary">${t.title}</td><td class="cell-muted">${t.source}</td>
        <td>${avatar(t.assignee)} ${t.assignee}</td>
        <td>${badge(t.priority, t.priority === 'Urgent' ? 'critical' : t.priority === 'High' ? 'warning' : 'info')}</td>
        <td>${badge(t.status)}</td><td class="cell-muted">${fmtDate(t.due)}</td>
      </tr>`).join('')}
      </tbody></table></div>${tableFooter(DEMO.tasks.length)}`;
  }
  function tasksBoard(cols) {
    return h`<div class="board">${cols.map(col => h`
      <div class="board-col"><div class="board-col-header"><span>${col}</span><span class="pill">${DEMO.tasks.filter(t => t.status === col).length}</span></div>
        ${DEMO.tasks.filter(t => t.status === col).map(t => h`
          <div class="board-card" data-task="${t.id}">
            <div class="title">${t.title}</div>
            <div class="meta"><span>${badge(t.priority, t.priority === 'Urgent' ? 'critical' : t.priority === 'High' ? 'warning' : 'info')}</span>${avatar(t.assignee)}</div>
          </div>`).join('') || `<div class="muted text-sm" style="padding:var(--space-2);">No tasks</div>`}
      </div>`).join('')}</div>`;
  }
  function tasksWorkload() {
    const byAssignee = {};
    DEMO.tasks.forEach(t => { (byAssignee[t.assignee] = byAssignee[t.assignee] || []).push(t); });
    return h`<div class="card"><div class="card-header"><h3>Workload by assignee</h3><span class="muted text-sm">Authorized project tasks only</span></div>
      ${Object.entries(byAssignee).map(([name, list]) => h`
        <div class="stat-row"><div class="flex items-center gap-3">${avatar(name)}<div><div style="font-weight:600;">${name}</div><div class="muted text-sm">${list.length} open task${list.length > 1 ? 's' : ''}</div></div></div>
          <div class="progress-bar" style="width:160px;"><span style="width:${Math.min(100, list.length * 22)}%"></span></div>
        </div>`).join('')}
      </div>`;
  }

  /* ---------------- Document Control ---------------- */
  function viewDocuments() {
    const items = DEMO.documents.filter(d => !state.docFilter || d.discipline === state.docFilter);
    const disciplines = [...new Set(DEMO.documents.map(d => d.discipline))];
    return h`${pageHeader('Document Control', 'Master Document Register (MDR) · Reviews · Transmittals · CRS',
      `<button class="btn btn-sm">${icon('plus')} New transmittal</button><button class="btn btn-primary btn-sm">${icon('plus')} Register document</button>`)}
      <div class="summary-strip">
        <div class="summary-chip"><strong>${DEMO.documents.length}</strong>documents in MDR</div>
        <div class="summary-chip"><strong>${DEMO.documents.filter(d => /review/i.test(d.status)).length}</strong>in review</div>
        <div class="summary-chip"><strong>${DEMO.documents.filter(d => d.status === 'Revision required').length}</strong>revision required</div>
        <div class="summary-chip"><strong>91%</strong>on-time response rate</div>
      </div>
      <div class="register-toolbar">
        <div class="search-box" style="width:280px;">${icon('search')}<input class="input" placeholder="Search by number or title…"></div>
        <select class="input" id="doc-discipline-filter" style="width:200px;">
          <option value="">All disciplines</option>
          ${disciplines.map(d => `<option value="${d}" ${state.docFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-sm">${icon('filter')} Filters</button>
        <button class="btn btn-sm">${icon('download')} Export</button>
      </div>
      <div class="table-wrap"><table class="register"><thead><tr>
        <th>Document No.</th><th>Title</th><th>Discipline</th><th>Rev</th><th>Purpose</th><th>Status</th><th>Review due</th><th>PIC</th>
      </tr></thead><tbody>
      ${items.map(d => h`<tr data-doc="${d.no}">
        <td class="cell-mono">${d.no}</td><td class="cell-primary">${d.title}</td><td class="cell-muted">${d.discipline}</td>
        <td><span class="pill">Rev ${d.rev}</span></td><td>${badge(d.purpose, 'neutral')}</td><td>${badge(d.status)}</td>
        <td class="cell-muted">${fmtDate(d.due)}</td><td>${avatar(d.owner)}</td>
      </tr>`).join('')}
      </tbody></table></div>${tableFooter(items.length)}`;
  }

  function documentDrawerContent(no) {
    const d = DEMO.documents.find(x => x.no === no);
    if (!d) return '';
    return h`
      <div class="drawer-header">
        <div><div class="muted text-sm">${d.discipline}</div><h3 style="font-size:17px;">${d.no}</h3><div class="text-sm">${d.title}</div></div>
        <button class="icon-btn" id="drawer-close" aria-label="Close panel">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section">
          <dl class="kv">
            <dt>Revision</dt><dd>Rev ${d.rev}</dd>
            <dt>Purpose</dt><dd>${badge(d.purpose, 'neutral')}</dd>
            <dt>Status</dt><dd>${badge(d.status)}</dd>
            <dt>Review due</dt><dd>${fmtDate(d.due)}</dd>
            <dt>PIC</dt><dd>${d.owner}</dd>
            <dt>Register</dt><dd>MDR — Engineering Package Register</dd>
          </dl>
        </div>
        <div class="drawer-section">
          <h4>Review status by party</h4>
          <div class="stat-row"><span>Internal</span>${badge('Approved', 'success')}</div>
          <div class="stat-row"><span>Client (COMPANY)</span>${badge('Under review', 'warning')}</div>
          <div class="stat-row"><span>MWS</span>${badge('Not required', 'neutral')}</div>
        </div>
        <div class="drawer-section">
          <h4>Revision history</h4>
          <ul class="timeline">
            <li><div class="t-title">Rev ${d.rev} transmitted for review</div><div class="t-meta">${fmtDate(d.due)} · ${d.owner}</div></li>
            <li><div class="t-title">Rev ${String.fromCharCode(d.rev.charCodeAt(0) - 1)} — Review comments closed</div><div class="t-meta">Sofia Hernandez</div></li>
            <li><div class="t-title">Rev A — Initial issue (IDC)</div><div class="t-meta">${d.owner}</div></li>
          </ul>
        </div>
        <div class="drawer-section">
          <h4>Linked records</h4>
          <div class="stat-row"><span>${icon('cpu')} Engineering deliverable</span><span class="pill">Open</span></div>
          <div class="stat-row"><span>${icon('check-square')} Review task — Sofia Hernandez</span><span class="pill">Open</span></div>
        </div>
      </div>`;
  }

  /* ---------------- Engineering ---------------- */
  function viewEngineering() {
    const tabs = [['deliverables', 'Deliverables'], ['packages', 'Work Packages'], ['review', 'Review Queue']];
    let body;
    if (state.engTab === 'packages') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>Package</th><th>Scope</th><th>Discipline</th><th>Weight</th><th>Progress</th></tr></thead><tbody>
        ${DEMO.workPackages.map(w => h`<tr><td class="cell-mono">${w.code}</td><td class="cell-primary">${w.scope}</td><td class="cell-muted">${w.discipline}</td><td>${w.weight}%</td>
          <td><div class="flex items-center gap-3"><div class="progress-bar" style="width:120px;"><span style="width:${w.progress}%"></span></div>${w.progress}%</div></td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.workPackages.length)}`;
    } else if (state.engTab === 'review') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>Document</th><th>Discipline</th><th>Reviewer</th><th>Days left</th></tr></thead><tbody>
        ${DEMO.dashboard.reviewQueue.map(r => h`<tr><td class="cell-mono">${r.doc}</td><td class="cell-muted">Process</td><td>${avatar('Minh Tran')} Minh Tran</td>
          <td>${badge(r.days + 'd', r.days <= 1 ? 'critical' : 'warning')}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.dashboard.reviewQueue.length)}`;
    } else {
      body = h`${registerToolbar('Search deliverables by number or title…')}
        <div class="table-wrap"><table class="register"><thead><tr>
          <th>Document No.</th><th>Title</th><th>Discipline</th><th>Responsible</th><th>Stage / Credit</th><th>Planned</th><th>Forecast</th>
        </tr></thead><tbody>
        ${DEMO.deliverables.map(d => h`<tr data-doc="${d.no}">
          <td class="cell-mono">${d.no}</td><td class="cell-primary">${d.title}</td><td class="cell-muted">${d.discipline}</td>
          <td>${avatar(d.responsible)} ${d.responsible}</td><td>${badge(d.stage, d.stage.includes('100') ? 'success' : 'info')}</td>
          <td class="cell-muted">${fmtDate(d.planned)}</td>
          <td class="${d.forecast > d.planned ? 'cell-muted' : 'cell-muted'}">${fmtDate(d.forecast)} ${d.forecast !== d.planned ? badge(d.forecast > d.planned ? 'Slipping' : 'Ahead', d.forecast > d.planned ? 'critical' : 'success') : ''}</td>
        </tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.deliverables.length)}`;
    }
    return h`${pageHeader('Engineering', 'Work packages, deliverables, and the discipline review queue.',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New deliverable</button>`)}
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.engTab === id ? 'active' : ''}" data-etab="${id}">${label}</button>`).join('')}</div>
      <div id="eng-body">${body}</div>`;
  }

  /* ---------------- Procurement ---------------- */
  function viewProcurement() {
    const tabs = [['plan', 'Procurement Plan'], ['expediting', 'Expediting'], ['logistics', 'Logistics'], ['materials', 'Materials']];
    let body;
    if (state.procTab === 'expediting') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>Package</th><th>Milestone</th><th>Baseline</th><th>Forecast</th><th>Status</th><th>Note</th></tr></thead><tbody>
        ${DEMO.expediting.map(e => h`<tr><td class="cell-mono">${e.pkg}</td><td class="cell-primary">${e.milestone}</td><td class="cell-muted">${fmtDate(e.baseline)}</td>
          <td class="cell-muted">${fmtDate(e.forecast)}</td><td>${badge(e.status)}</td><td class="cell-muted">${e.note}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.expediting.length)}`;
    } else if (state.procTab === 'logistics') {
      body = `<div class="empty-state">${icon('shopping-cart')}<div>Logistics module activates in P2. Shown here as a scope placeholder.</div></div>`;
    } else if (state.procTab === 'materials') {
      body = `<div class="empty-state">${icon('shopping-cart')}<div>Materials module activates in P2. Shown here as a scope placeholder.</div></div>`;
    } else {
      body = h`${registerToolbar('Search procurement packages…')}
        <div class="table-wrap"><table class="register"><thead><tr>
          <th>Package</th><th>Title</th><th>Buyer</th><th>Criticality</th><th>Stage</th><th>Required on site</th><th>Forecast</th>
        </tr></thead><tbody>
        ${DEMO.procurement.map(p => h`<tr>
          <td class="cell-mono">${p.pkg}</td><td class="cell-primary">${p.title}</td><td>${avatar(p.buyer)} ${p.buyer}</td>
          <td>${badge(p.criticality, p.criticality === 'Critical' ? 'critical' : p.criticality === 'High' ? 'warning' : 'info')}</td>
          <td>${badge(p.stage)}</td><td class="cell-muted">${fmtDate(p.ros)}</td>
          <td class="cell-muted">${fmtDate(p.forecast)} ${p.forecast !== p.ros ? badge('Slipping', 'critical') : ''}</td>
        </tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.procurement.length)}`;
    }
    return h`${pageHeader('Procurement', 'Procurement plan, expediting, logistics, and materials.',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New package</button>`)}
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.procTab === id ? 'active' : ''}" data-ptab="${id}">${label}</button>`).join('')}</div>
      <div id="proc-body">${body}</div>`;
  }

  /* ---------------- Planning & Progress ---------------- */
  function viewPlanning() {
    return h`${pageHeader('Planning & Progress', 'Overall progress, milestones, and the work-package progress grid.')}
      <div class="grid grid-cols-3 mb-4">
        <div class="card"><span class="kpi-label">Planned (cutoff)</span><span class="kpi-value info">${DEMO.dashboard.overallProgress.planned}%</span></div>
        <div class="card"><span class="kpi-label">Accepted (cutoff)</span><span class="kpi-value success">${DEMO.dashboard.overallProgress.accepted}%</span></div>
        <div class="card"><span class="kpi-label">Variance</span><span class="kpi-value critical">${(DEMO.dashboard.overallProgress.accepted - DEMO.dashboard.overallProgress.planned).toFixed(1)} pp</span></div>
      </div>
      <div class="card mb-4">
        <div class="card-header"><h3>Milestones</h3></div>
        <div class="table-wrap"><table class="register"><thead><tr><th>Milestone</th><th>Baseline</th><th>Forecast</th><th>Variance</th><th>Status</th></tr></thead><tbody>
        ${DEMO.milestones.map(m => h`<tr><td class="cell-primary">${m.name}</td><td class="cell-muted">${fmtDate(m.baseline)}</td><td class="cell-muted">${fmtDate(m.forecast)}</td>
          <td class="cell-muted">${m.variance > 0 ? '+' : ''}${m.variance}d</td><td>${badge(m.status)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Progress grid — WBS rollup</h3><span class="muted text-sm">Accepted totals distinct from pending values</span></div>
        <div class="table-wrap"><table class="register"><thead><tr><th>WBS</th><th>Budget qty.</th><th>Planned %</th><th>Accepted %</th><th></th></tr></thead><tbody>
        ${DEMO.progressGrid.map(r => h`<tr><td class="cell-primary">${r.wbs}</td><td class="cell-muted">${r.budget}</td><td class="cell-muted">${r.planned}%</td><td>${r.accepted}%</td>
          <td style="width:160px;"><div class="progress-bar"><span style="width:${r.accepted}%"></span></div></td></tr>`).join('')}
        </tbody></table></div>
      </div>`;
  }

  /* ---------------- Management ---------------- */
  function viewManagement() {
    const tabs = [['risk', 'Risks'], ['issue', 'Issues'], ['lessons', 'Lessons Learned'], ['moc', 'MOC'], ['stakeholders', 'Stakeholders']];
    let body;
    if (state.mgmtTab === 'issue') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Owner</th><th>Target</th><th>Status</th></tr></thead><tbody>
        ${DEMO.issues.map(i => h`<tr><td class="cell-mono">${i.id}</td><td class="cell-primary">${i.title}</td>
          <td>${badge(i.severity, i.severity === 'High' ? 'critical' : 'warning')}</td><td>${avatar(i.owner)} ${i.owner}</td>
          <td class="cell-muted">${fmtDate(i.target)}</td><td>${badge(i.status)}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.issues.length)}`;
    } else if (state.mgmtTab === 'lessons') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>ID</th><th>Context</th><th>Recommendation</th><th>Status</th></tr></thead><tbody>
        ${DEMO.lessons.map(l => h`<tr><td class="cell-mono">${l.id}</td><td class="cell-primary">${l.context}</td><td class="cell-muted">${l.recommendation}</td><td>${badge(l.status)}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.lessons.length)}`;
    } else if (state.mgmtTab === 'moc') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>ID</th><th>Title</th><th>Impact</th><th>Status</th></tr></thead><tbody>
        ${DEMO.moc.map(m => h`<tr><td class="cell-mono">${m.id}</td><td class="cell-primary">${m.title}</td><td class="cell-muted">${m.impact}</td><td>${badge(m.status)}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.moc.length)}`;
    } else if (state.mgmtTab === 'stakeholders') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>Name</th><th>Party</th><th>Role</th><th>Influence</th><th>Interest</th></tr></thead><tbody>
        ${DEMO.stakeholders.map(s => h`<tr><td class="cell-primary">${avatar(s.name)} ${s.name}</td><td class="cell-muted">${s.party}</td><td class="cell-muted">${s.role}</td>
          <td>${badge(s.influence, s.influence === 'High' ? 'critical' : 'info')}</td><td>${badge(s.interest, s.interest === 'High' ? 'warning' : 'info')}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.stakeholders.length)}`;
    } else {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Likelihood</th><th>Impact</th><th>Score</th><th>Owner</th><th>Status</th></tr></thead><tbody>
        ${DEMO.risks.map(r => h`<tr><td class="cell-mono">${r.id}</td><td class="cell-primary">${r.title}</td><td class="cell-muted">${r.category}</td>
          <td class="cell-muted">${r.likelihood}</td><td class="cell-muted">${r.impact}</td>
          <td>${badge(r.score, r.score >= 10 ? 'critical' : r.score >= 7 ? 'warning' : 'success')}</td>
          <td>${avatar(r.owner)} ${r.owner}</td><td>${badge(r.status)}</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.risks.length)}`;
    }
    return h`${pageHeader('Management', 'Risks, issues, lessons learned, management of change, and stakeholders.',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New record</button>`)}
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.mgmtTab === id ? 'active' : ''}" data-mtab="${id}">${label}</button>`).join('')}</div>
      <div id="mgmt-body">${body}</div>`;
  }

  /* ---------------- Interface Management ---------------- */
  function viewInterfaces() {
    return h`${pageHeader('Interface Management', 'Register, matrix, and interface points.',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New interface</button>`)}
      <div class="table-wrap"><table class="register"><thead><tr>
        <th>ID</th><th>Boundary</th><th>Originator</th><th>Receiver</th><th>Need date</th><th>Status</th>
      </tr></thead><tbody>
      ${DEMO.interfaces.map(i => h`<tr><td class="cell-mono">${i.id}</td><td class="cell-primary">${i.boundary}</td>
        <td>${avatar(i.originator)} ${i.originator}</td><td>${avatar(i.receiver)} ${i.receiver}</td>
        <td class="cell-muted">${fmtDate(i.need)}</td><td>${badge(i.status)}</td></tr>`).join('')}
      </tbody></table></div>${tableFooter(DEMO.interfaces.length)}`;
  }

  /* ---------------- Events / MoM ---------------- */
  function viewEvents() {
    const tabs = [['events', 'Calendar'], ['mom', 'Minutes of Meetings']];
    let body;
    if (state.evtTab === 'mom') {
      body = h`<div class="table-wrap"><table class="register"><thead><tr><th>ID</th><th>Title</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${DEMO.mom.map(m => h`<tr><td class="cell-mono">${m.id}</td><td class="cell-primary">${m.title}</td><td class="cell-muted">${fmtDate(m.date)}</td>
          <td>${badge(m.status)}</td><td class="cell-muted">${m.actions} shared actions</td></tr>`).join('')}
        </tbody></table></div>${tableFooter(DEMO.mom.length)}`;
    } else {
      body = h`<div class="card">${DEMO.events.map(e => h`
        <div class="stat-row"><div class="flex items-center gap-3">${icon('calendar')}<div><div style="font-weight:600;">${e.title}</div>
          <div class="muted text-sm">${fmtDate(e.date)} · ${e.time} · Organized by ${e.organizer}</div></div></div>
          <button class="btn btn-sm">Open</button></div>`).join('')}</div>`;
    }
    return h`${pageHeader('Event Management', 'Meetings, workshops, and minutes.',
      `<button class="btn btn-primary btn-sm">${icon('plus')} New event</button>`)}
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.evtTab === id ? 'active' : ''}" data-xtab="${id}">${label}</button>`).join('')}</div>
      <div id="evt-body">${body}</div>`;
  }

  /* ---------------- Reports ---------------- */
  function viewReports() {
    return h`${pageHeader('Reports', 'Predefined weekly/monthly reports, minutes, and documents.')}
      <div class="grid grid-cols-3">
        ${DEMO.reports.map(r => h`
          <div class="card">
            <div class="card-header"><h3>${r.name}</h3>${icon('bar-chart-2')}</div>
            <div class="stat-row"><span class="muted text-sm">Cadence</span><span>${r.cadence}</span></div>
            <div class="stat-row"><span class="muted text-sm">Audience</span><span>${r.audience}</span></div>
            <div class="stat-row"><span class="muted text-sm">Last issued</span><span>${fmtDate(r.last)}</span></div>
            <button class="btn btn-sm w-full" style="margin-top:var(--space-3);justify-content:center;">${icon('download')} Generate</button>
          </div>`).join('')}
      </div>`;
  }

  /* ---------------- Settings / Profile ---------------- */
  function viewSettings() {
    const areas = [
      ['Organization and security', 'Identity, branding, domains, sessions/MFA, retention'],
      ['Project', 'Code, client, locations, lifecycle, timezone/calendar'],
      ['Project organization', 'Levels, positions, membership, directory/RACI, PIC lookup'],
      ['Access assignments', 'By-level/person/module matrices, exceptions, policy preview'],
      ['Document Control', 'Numbering, register semantics, review bodies/routes/codes'],
      ['Modules', 'Catalog, install/upgrade, enable/disable, dependencies, health'],
      ['Structure and progress', 'WBS/package types, units, tags/systems, weights, rules'],
      ['Reminders and reports', 'Templates, thresholds, channels, calendars, distribution'],
    ];
    return h`${pageHeader('Settings', 'Master, Current Project, and Access configuration areas.')}
      <div class="grid grid-cols-3">
        ${areas.map(([t, d]) => h`<div class="card"><div class="flex items-center gap-3 mb-2">${icon('settings')}<h3 style="font-size:15px;">${t}</h3></div><p class="muted text-sm">${d}</p></div>`).join('')}
      </div>`;
  }

  function viewProfile() {
    const u = state.user;
    return h`${pageHeader('Profile', 'Your identity, preferences, and sessions.')}
      <div class="grid grid-cols-3">
        <div class="card" style="text-align:center;">
          ${avatar(u.name, 'lg')}
          <h3 style="margin-top:var(--space-3);">${u.name}</h3>
          <p class="muted text-sm">${u.title} · ${u.level}</p>
        </div>
        <div class="card grid-span-2">
          <div class="card-header"><h3>Preferences</h3></div>
          <div class="field"><label>Theme</label>
            <div class="theme-toggle" style="width:fit-content;">
              <button data-theme="light">${icon('sun')}</button><button data-theme="dark">${icon('moon')}</button><button data-theme="system">${icon('monitor')}</button>
            </div>
          </div>
          <div class="field"><label>Language</label><select class="input"><option>English</option></select></div>
          <div class="field"><label>Timezone</label><select class="input"><option>Asia/Jakarta (UTC+7)</option></select></div>
          <button class="btn">Revoke all other sessions</button>
        </div>
      </div>`;
  }

  /* ---------------- View wiring (event delegation per route) ---------------- */
  function openDocDrawer(no) {
    $('#drawer').innerHTML = documentDrawerContent(no);
    $('#drawer').classList.add('open');
    $('#drawer-overlay').classList.add('open');
    $('#drawer-close').addEventListener('click', closeDrawer);
  }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer-overlay').classList.remove('open'); }

  function openTaskDrawer(id) {
    const t = DEMO.tasks.find(x => x.id === id);
    if (!t) return;
    $('#drawer').innerHTML = h`
      <div class="drawer-header">
        <div><div class="muted text-sm">${t.source}</div><h3 style="font-size:17px;">${t.id}</h3><div class="text-sm">${t.title}</div></div>
        <button class="icon-btn" id="drawer-close" aria-label="Close panel">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-section"><dl class="kv">
          <dt>Assignee</dt><dd>${t.assignee}</dd>
          <dt>Priority</dt><dd>${badge(t.priority, t.priority === 'Urgent' ? 'critical' : t.priority === 'High' ? 'warning' : 'info')}</dd>
          <dt>Status</dt><dd>${badge(t.status)}</dd>
          <dt>Due</dt><dd>${fmtDate(t.due)}</dd>
          <dt>Source</dt><dd>${t.source}</dd>
        </dl></div>
        <div class="drawer-section"><h4>Evidence & comments</h4>
          <p class="muted text-sm">This source-linked task keeps its due date and status read-only here; status changes flow through its owning module's workflow.</p>
        </div>
      </div>`;
    $('#drawer').classList.add('open'); $('#drawer-overlay').classList.add('open');
    $('#drawer-close').addEventListener('click', closeDrawer);
  }

  function wireView(route) {
    $$('[data-route-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.routeLink); }));
    $$('tr[data-doc]').forEach(r => r.addEventListener('click', () => openDocDrawer(r.dataset.doc)));
    $$('tr[data-task]').forEach(r => r.addEventListener('click', () => openTaskDrawer(r.dataset.task)));
    $$('.board-card[data-task]').forEach(r => r.addEventListener('click', () => openTaskDrawer(r.dataset.task)));

    if (route === 'workspace') {
      $$('[data-wtab]').forEach(b => b.addEventListener('click', () => { state.workspaceTab = b.dataset.wtab; navigate('workspace'); }));
    }
    if (route === 'tasks') {
      $$('[data-tview]').forEach(b => b.addEventListener('click', () => { state.taskView = b.dataset.tview; navigate('tasks'); }));
    }
    if (route === 'documents') {
      const sel = $('#doc-discipline-filter');
      if (sel) sel.addEventListener('change', () => { state.docFilter = sel.value; navigate('documents'); });
    }
    if (route === 'engineering') {
      $$('[data-etab]').forEach(b => b.addEventListener('click', () => { state.engTab = b.dataset.etab; navigate('engineering'); }));
    }
    if (route === 'procurement') {
      $$('[data-ptab]').forEach(b => b.addEventListener('click', () => { state.procTab = b.dataset.ptab; navigate('procurement'); }));
    }
    if (route === 'management') {
      $$('[data-mtab]').forEach(b => b.addEventListener('click', () => { state.mgmtTab = b.dataset.mtab; navigate('management'); }));
    }
    if (route === 'events') {
      $$('[data-xtab]').forEach(b => b.addEventListener('click', () => { state.evtTab = b.dataset.xtab; navigate('events'); }));
    }
    if (route === 'profile') {
      $$('#view-root .theme-toggle button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
    }
    $$('.btn').forEach(b => {
      if (!b.dataset.wired) {
        b.dataset.wired = '1';
        b.addEventListener('click', (e) => {
          const label = b.textContent.trim();
          if (/New|Register|Generate|Approve|Return|Export|Customize|Revoke/.test(label) && !b.closest('.auth-card')) {
            toast(`${label.replace(/\s+/g, ' ')} — demo action (no backend connected).`);
          }
        });
      }
    });
  }

  /* ---------------- Drawer overlay close ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderLogin();
    $('#drawer-overlay').addEventListener('click', closeDrawer);
    $('#sidebar-overlay').addEventListener('click', closeMobileNav);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  });
})();
