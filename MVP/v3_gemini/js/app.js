/**
 * ProjectFlow - Application Core & Shell Orchestrator (v3_gemini)
 * Coordinates View Routing, Project Context, Roles/Impersonation,
 * Command Palette, Inspector Drawer & Toasts
 */

const ProjectFlowApp = {
  init() {
    this.setupEventListeners();
    this.applyTheme(window.ProjectFlowData.state.theme);
    this.updateHeaderContext();
    this.navigate('dashboard');
  },

  setupEventListeners() {
    // Keyboard shortcuts: Ctrl+K or Cmd+K for Command Palette
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      }
      if (e.key === 'Escape') {
        this.closeAllModals();
        this.closeInspector();
      }
    });

    // Close inspector when clicking overlay
    const overlay = document.getElementById('inspector-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeInspector());
    }
  },

  // Navigation & View Routing (§3.1)
  navigate(viewName) {
    window.ProjectFlowData.state.activeView = viewName;

    // Update active nav links in sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Hide all view sections, show target
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Render corresponding module
    switch (viewName) {
      case 'dashboard':
        window.DashboardModule?.render();
        break;
      case 'tasks':
        window.TasksModule?.render();
        break;
      case 'documents':
        window.DocumentsModule?.render();
        break;
      case 'procurement':
        window.ProcurementModule?.render();
        break;
      case 'planning':
        window.PlanningModule?.render();
        break;
      case 'execution':
        window.ExecutionModule?.render();
        break;
      case 'governance':
        window.GovernanceModule?.render();
        break;
      case 'settings':
        window.SettingsModule?.render();
        break;
    }

    // Scroll content to top
    const content = document.querySelector('.content-container');
    if (content) content.scrollTop = 0;
  },

  // Project Switching (PRJ-01..06)
  switchProject(projectId) {
    const data = window.ProjectFlowData;
    if (data.state.currentProjectId === projectId) return;

    data.state.currentProjectId = projectId;
    this.updateHeaderContext();
    this.showToast(`Switched project context to ${projectId}`, 'info');

    // Re-render current active view
    this.navigate(data.state.activeView);
  },

  // Persona / Role Switching (§2.1, §2.6)
  switchPersona(userId) {
    const data = window.ProjectFlowData;
    data.state.currentPersonaId = userId;
    data.state.previewMode = false;
    data.state.previewPersonaId = null;

    document.getElementById('preview-banner').classList.remove('active');
    this.updateHeaderContext();

    const user = data.users.find(u => u.id === userId);
    this.showToast(`Logged in as ${user.name} (${user.projectRole})`, 'success');
    this.navigate(data.state.activeView);
  },

  // Preview As Simulation (ACL-04, ACCESS-04)
  startPreviewAs(userId) {
    const data = window.ProjectFlowData;
    data.state.previewMode = true;
    data.state.previewPersonaId = userId;

    const previewUser = data.users.find(u => u.id === userId);
    const banner = document.getElementById('preview-banner');
    document.getElementById('preview-target-name').innerText = `${previewUser.name} (${previewUser.projectRole} - ${previewUser.personnelLevel})`;
    banner.classList.add('active');

    this.showToast(`Read-only preview active: ${previewUser.name}`, 'warning');
    this.navigate(data.state.activeView);
  },

  exitPreview() {
    const data = window.ProjectFlowData;
    data.state.previewMode = false;
    data.state.previewPersonaId = null;

    document.getElementById('preview-banner').classList.remove('active');
    this.showToast('Exited preview mode', 'info');
    this.navigate(data.state.activeView);
  },

  // Header UI Sync
  updateHeaderContext() {
    const data = window.ProjectFlowData;
    const project = data.projects.find(p => p.id === data.state.currentProjectId);
    const effectiveUserId = data.state.previewMode ? data.state.previewPersonaId : data.state.currentPersonaId;
    const user = data.users.find(u => u.id === effectiveUserId);

    // Update Project Badge in header
    document.getElementById('current-project-code').innerText = project.code;
    document.getElementById('current-project-title').innerText = project.title;

    // Update Persona Avatar & Text
    document.getElementById('user-avatar').innerText = user.avatar;
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-role').innerText = user.projectRole;

    // Client banner check (PUB-01..04)
    const clientBanner = document.getElementById('client-banner');
    if (user.isClient) {
      clientBanner.classList.add('active');
    } else {
      clientBanner.classList.remove('active');
    }
  },

  // Theme & Density Toggles (§3.2)
  toggleTheme() {
    const data = window.ProjectFlowData;
    data.state.theme = (data.state.theme === 'light') ? 'dark' : 'light';
    this.applyTheme(data.state.theme);
    this.showToast(`Switched to ${data.state.theme} mode`, 'info');
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleDensity() {
    const appEl = document.getElementById('app');
    if (appEl.classList.contains('density-compact')) {
      appEl.classList.remove('density-compact');
      this.showToast('Comfort density enabled', 'info');
    } else {
      appEl.classList.add('density-compact');
      this.showToast('Compact density enabled', 'info');
    }
  },

  // Inspector Slide-out Drawer (§3.3 UX-03)
  openInspector(type, entityId) {
    const data = window.ProjectFlowData;
    const effectiveUserId = data.state.previewMode ? data.state.previewPersonaId : data.state.currentPersonaId;
    const currentUser = data.users.find(u => u.id === effectiveUserId);
    const isClient = currentUser.isClient;

    const drawer = document.getElementById('inspector-drawer');
    const overlay = document.getElementById('inspector-overlay');
    if (!drawer || !overlay) return;

    let entity = null;
    let title = '';
    let code = '';
    let status = '';
    let overviewHTML = '';

    if (type === 'task') {
      entity = data.tasks.find(t => t.id === entityId) || data.tasks.find(t => t.code === entityId);
      if (!entity) return;
      code = entity.code;
      title = entity.title;
      status = entity.status;
      overviewHTML = `
        <div class="inspector-section">
          <span class="inspector-section-title">Task Specification</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Priority:</span>
            <span class="inspector-val"><span class="badge ${entity.priority === 'Urgent' ? 'badge-critical' : 'badge-warning'}">${entity.priority}</span></span>
            <span class="inspector-label">Lead PIC:</span>
            <span class="inspector-val">${entity.pic}</span>
            <span class="inspector-label">Assigned By:</span>
            <span class="inspector-val">${entity.assignedBy}</span>
            <span class="inspector-label">Due Date:</span>
            <span class="inspector-val tabular-nums">${entity.dueDate}</span>
            <span class="inspector-label">Source Module:</span>
            <span class="inspector-val"><span class="badge badge-brand">${entity.sourceModule}</span> (${entity.sourceId})</span>
            <span class="inspector-label">Effort:</span>
            <span class="inspector-val">${entity.actualHours}h logged / ${entity.estimatedHours}h est.</span>
          </div>
        </div>
        <div class="inspector-section">
          <span class="inspector-section-title">Description</span>
          <p style="font-size: 13px; color: var(--pf-text-main);">${entity.description}</p>
        </div>
      `;
    } else if (type === 'document') {
      entity = data.documents.find(d => d.id === entityId) || data.documents.find(d => d.docNumber === entityId);
      if (!entity) return;
      code = entity.docNumber;
      title = entity.title;
      status = entity.status;
      overviewHTML = `
        <div class="inspector-section">
          <span class="inspector-section-title">Document Metadata</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Current Revision:</span>
            <span class="inspector-val"><strong>${entity.rev}</strong></span>
            <span class="inspector-label">Issue Purpose:</span>
            <span class="inspector-val">${entity.purpose}</span>
            <span class="inspector-label">Register Type:</span>
            <span class="inspector-val">${entity.semanticRegister}</span>
            <span class="inspector-label">Owning Party:</span>
            <span class="inspector-val">${entity.owningParty}</span>
            <span class="inspector-label">Responsible PIC:</span>
            <span class="inspector-val">${entity.pic}</span>
            <span class="inspector-label">SHA-256 Hash:</span>
            <span class="inspector-val" style="font-family: monospace; font-size: 11px;">${entity.checksum}</span>
          </div>
        </div>
        <div class="inspector-section">
          <span class="inspector-section-title">Review Bodies & Release Status</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Client (COMPANY):</span>
            <span class="inspector-val"><span class="badge badge-info">${entity.clientStatus}</span></span>
            <span class="inspector-label">CA (Class DNV):</span>
            <span class="inspector-val"><span class="badge badge-warning">${entity.caStatus}</span></span>
            <span class="inspector-label">MWS Surveyor:</span>
            <span class="inspector-val"><span class="badge badge-brand">${entity.mwsStatus}</span></span>
          </div>
        </div>
      `;
    } else if (type === 'po') {
      entity = data.purchaseOrders.find(p => p.id === entityId);
      if (!entity) return;
      code = entity.poNumber;
      title = entity.title;
      status = entity.status;
      overviewHTML = `
        <div class="inspector-section">
          <span class="inspector-section-title">Purchase Order Details</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Vendor:</span>
            <span class="inspector-val">${entity.vendor}</span>
            ${!isClient ? `
              <span class="inspector-label">Contract Value:</span>
              <span class="inspector-val" style="color: var(--pf-brand); font-weight: 700;">${entity.commercialValue}</span>
            ` : ''}
            <span class="inspector-label">Required On Site:</span>
            <span class="inspector-val tabular-nums">${entity.requiredOnSite}</span>
            <span class="inspector-label">Forecast Arrival:</span>
            <span class="inspector-val tabular-nums" style="color: ${entity.varianceDays > 0 ? 'var(--pf-critical)' : 'inherit'}; font-weight: 700;">
              ${entity.forecastArrival} (+${entity.varianceDays}d)
            </span>
            <span class="inspector-label">Expeditor PIC:</span>
            <span class="inspector-val">${entity.expeditor}</span>
            <span class="inspector-label">Mfg Progress:</span>
            <span class="inspector-val">${entity.manufacturingProgress}%</span>
          </div>
        </div>
      `;
    } else if (type === 'workfront') {
      const pin = data.yardZones.flatMap(z => z.pins).find(p => p.code === entityId);
      if (!pin) return;
      code = pin.code;
      title = pin.label;
      status = pin.status;
      overviewHTML = `
        <div class="inspector-section">
          <span class="inspector-section-title">Workfront Readiness Gates (CON-03)</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Gate 1 (Eng IFC):</span>
            <span class="inspector-val"><span class="badge badge-success">${pin.gateEngineering}</span></span>
            <span class="inspector-label">Gate 2 (Materials):</span>
            <span class="inspector-val"><span class="badge badge-success">${pin.gateMaterials}</span></span>
            <span class="inspector-label">Gate 3 (QAQC):</span>
            <span class="inspector-val"><span class="badge ${pin.gateQAQC?.includes('Hold') ? 'badge-critical' : 'badge-success'}">${pin.gateQAQC}</span></span>
            <span class="inspector-label">Gate 4 (HSE PTW):</span>
            <span class="inspector-val"><span class="badge badge-success">${pin.gateHSE}</span></span>
          </div>
        </div>
      `;
    } else if (type === 'punch') {
      entity = data.punches.find(p => p.id === entityId) || data.punches.find(p => p.code === entityId);
      if (!entity) return;
      code = entity.code;
      title = entity.description;
      status = entity.status;
      overviewHTML = `
        <div class="inspector-section">
          <span class="inspector-section-title">Punch Particulars</span>
          <div class="inspector-field-grid">
            <span class="inspector-label">Category:</span>
            <span class="inspector-val"><span class="badge ${entity.category.includes('Cat A') ? 'badge-critical' : 'badge-neutral'}">${entity.category}</span></span>
            <span class="inspector-label">Equipment Tag:</span>
            <span class="inspector-val" style="font-family: monospace; font-weight: 700;">${entity.tag}</span>
            <span class="inspector-label">Subsystem:</span>
            <span class="inspector-val">${entity.system}</span>
            <span class="inspector-label">Location:</span>
            <span class="inspector-val">${entity.location}</span>
            <span class="inspector-label">Rectification Owner:</span>
            <span class="inspector-val">${entity.owner}</span>
            <span class="inspector-label">Target Due:</span>
            <span class="inspector-val tabular-nums">${entity.dueDate}</span>
          </div>
        </div>
      `;
    } else {
      code = entityId;
      title = `Inspecting Record [${entityId}]`;
      status = 'Active';
      overviewHTML = `<p style="font-size: 13px;">Selected record details for ${entityId}.</p>`;
    }

    // Populate drawer elements
    document.getElementById('inspector-code').innerText = code;
    document.getElementById('inspector-title').innerText = title;
    document.getElementById('inspector-status-badge').innerText = status;

    // Body content with tabs
    document.getElementById('inspector-body').innerHTML = `
      ${overviewHTML}

      <!-- Comments Stream (§2.4 PUB-03: Internal vs Shared separation) -->
      <div class="inspector-section" style="margin-top: 14px; border-top: 1px solid var(--pf-border-subtle); padding-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span class="inspector-section-title">Discussion & Commentary</span>
          <span class="badge ${isClient ? 'badge-info' : 'badge-brand'}">${isClient ? 'Shared with Client' : 'Internal & Client Stream'}</span>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${!isClient ? `
            <div class="comment-card internal">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--pf-brand);">
                <span>🔒 INTERNAL COMMENT (Main Contractor)</span>
                <span>2026-11-04 10:15 UTC</span>
              </div>
              <p>Siemens agreed verbally to absorb overtime costs on baseframe gusset welding. Do not disclose liquidated damage calculations to client.</p>
              <div style="font-size: 10.5px; color: var(--pf-text-muted);">Author: Sarah Jenkins (PM)</div>
            </div>
          ` : ''}

          <div class="comment-card shared">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--pf-accent);">
              <span>🌐 SHARED RECORD (Client & Partners)</span>
              <span>2026-11-05 14:30 UTC</span>
            </div>
            <p>Inspection test report scheduled for joint witness with DNV Class surveyor on Wednesday 10:00 AM.</p>
            <div style="font-size: 10.5px; color: var(--pf-text-muted);">Author: Elena Rostova (Document Lead)</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <input type="text" placeholder="Add comment..." style="flex: 1; font-size: 12.5px;">
          <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.showToast('Comment recorded to audit trail', 'success')">Post</button>
        </div>
      </div>
    `;

    drawer.classList.add('open');
    overlay.classList.add('active');
  },

  closeInspector() {
    const drawer = document.getElementById('inspector-drawer');
    const overlay = document.getElementById('inspector-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  // Command Palette Overlay (Ctrl+K)
  openCommandPalette() {
    const modal = document.getElementById('cmd-palette-modal');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('cmd-palette-input');
      if (input) {
        input.value = '';
        input.focus();
        this.filterCommandPalette('');
      }
    }
  },

  filterCommandPalette(q) {
    const query = q.toLowerCase();
    const items = [
      { label: '📊 Dashboard — S-Curves & Rollups', action: () => this.navigate('dashboard') },
      { label: '👤 My Workspace — Assigned to Me & Private Tasks', action: () => this.navigate('tasks') },
      { label: '📋 Project Tasks Register & Kanban', action: () => { this.navigate('tasks'); window.TasksModule?.switchTab('kanban'); } },
      { label: '📄 Document Control — MDR & Transmittals', action: () => this.navigate('documents') },
      { label: '💬 Comment Resolution Sheets (CRS)', action: () => { this.navigate('documents'); window.DocumentsModule?.switchTab('crs'); } },
      { label: '🏭 Vendor Production Schedule Monitoring (Rev 1.2)', action: () => { this.navigate('procurement'); window.ProcurementModule?.switchTab('production-monitoring'); } },
      { label: '📦 Major Purchase Orders & Delivery Variance', action: () => { this.navigate('procurement'); window.ProcurementModule?.switchTab('procurement-plan'); } },
      { label: '🗺️ 2D Interactive Yard Layout & Readiness Gates', action: () => this.navigate('execution') },
      { label: '🔥 5x5 Risk Heatmap & Issues Register', action: () => this.navigate('governance') },
      { label: '🧩 4-Axis Module Catalog & RACI Directory', action: () => this.navigate('settings') },
      { label: '👁️ Preview as Person / Level (ACL-04)', action: () => window.SettingsModule?.openPreviewModal() }
    ];

    const list = document.getElementById('cmd-palette-list');
    if (!list) return;

    const filtered = items.filter(i => i.label.toLowerCase().includes(query));
    list.innerHTML = filtered.map((item, idx) => `
      <div class="cmd-item" onclick="ProjectFlowApp.runCommand(${idx})">
        <span>${item.label}</span>
        <span class="cmd-key">Jump ↵</span>
      </div>
    `).join('');

    this._currentFilteredCommands = filtered;
  },

  runCommand(idx) {
    if (this._currentFilteredCommands && this._currentFilteredCommands[idx]) {
      this.closeAllModals();
      this._currentFilteredCommands[idx].action();
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('#convert-task-modal, #trn-pdf-modal, #preview-user-modal').forEach(e => e.remove());
  },

  // Snapshot Freeze & Publish Modals (PROG-07, PUB-02)
  openSnapshotModal() {
    const data = window.ProjectFlowData;
    const project = data.projects.find(p => p.id === data.state.currentProjectId);

    const modalHTML = `
      <div class="modal-backdrop active" id="snapshot-modal">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Freeze Reporting Snapshot (PROG-07)</h3>
            <button class="btn btn-icon" onclick="document.getElementById('snapshot-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--pf-info-bg); border: 1px solid var(--pf-info-border); padding: 12px; border-radius: 6px; font-size: 12.5px; color: var(--pf-info);">
              <strong>Governance Rule:</strong> Freezing locks the current cutoff state into an immutable reporting snapshot. Future baseline or actual changes do not rewrite issued history.
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Cutoff Reporting Period</label>
              <input type="text" id="snap-period" value="Week 45 - November 2026">
            </div>

            <div class="form-group">
              <label class="form-label">Cutoff Date</label>
              <input type="date" id="snap-date" value="${project.cutoffDate}">
            </div>

            <div style="background: var(--pf-surface-subtle); padding: 10px; border-radius: 6px; font-size: 12px;">
              <div>Overall Accepted Actual: <strong>${project.overallProgress.toFixed(1)}%</strong></div>
              <div>Planned Baseline: <strong>${project.plannedProgress.toFixed(1)}%</strong></div>
              <div>Schedule Variance: <strong style="color: var(--pf-critical);">${project.varianceProgress.toFixed(1)}%</strong></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('snapshot-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="ProjectFlowApp.executeFreezeSnapshot()">Freeze Immutable Snapshot</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  executeFreezeSnapshot() {
    const period = document.getElementById('snap-period').value;
    const date = document.getElementById('snap-date').value;
    const data = window.ProjectFlowData;

    const newSnap = {
      id: `SNP-2026-W${data.snapshots.length + 45}`,
      code: `Snapshot W${data.snapshots.length + 45} (${date})`,
      period: period,
      cutoffDate: date,
      overallProgress: 64.2,
      plannedProgress: 67.8,
      variance: -3.6,
      publishedBy: data.users.find(u => u.id === data.state.currentPersonaId).name,
      publishedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      status: 'Locked / Published to Client'
    };

    data.snapshots.unshift(newSnap);
    document.getElementById('snapshot-modal').remove();
    this.showToast(`Snapshot ${newSnap.id} successfully frozen and locked`, 'success');
    this.navigate('planning');
  },

  publishSnapshotToClient() {
    if (confirm('Publish latest snapshot to Equinor / Petrobras JV Client Portal (PUB-02)?\n\nInternal comments and commercial rates will remain masked.')) {
      this.showToast('Published official report snapshot to client audience', 'success');
    }
  },

  // Export utility (§3.3, §6.6 REP-03)
  exportCSV(moduleKey) {
    this.showToast(`Exported ${moduleKey} data to spreadsheet (CSV/XLSX)`, 'info');
  },

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : 
         (type === 'critical' ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' : 
         '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>')}
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
};

window.ProjectFlowApp = ProjectFlowApp;

// Auto-boot application on load
window.addEventListener('DOMContentLoaded', () => {
  ProjectFlowApp.init();
});
