/**
 * ProjectFlow - Settings, Module Catalog & Access Matrix Module (v3_gemini)
 * §11.2 MOD-01..10 Module Lifecycle 4-Axes, §2.6 Personnel Levels, RACI & §2.3/ACCESS Preview
 */

const SettingsModule = {
  activeTab: 'modules', // 'modules' | 'raci' | 'access-matrix' | 'audit'

  render() {
    const data = window.ProjectFlowData;

    const container = document.getElementById('view-settings');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Administration & Project Configuration</h1>
          <p class="view-description">
            Governed 4-axis module lifecycle states, project personnel levels, tabular RACI directory, and effective access policy simulation.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.openPreviewModal()">
            👁️ Preview as Person / Level (ACL-04)
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeTab === 'modules' ? 'active' : ''}" onclick="SettingsModule.switchTab('modules')">
          🧩 4-Axis Module Catalog (MOD-02)
        </div>
        <div class="inspector-tab ${this.activeTab === 'raci' ? 'active' : ''}" onclick="SettingsModule.switchTab('raci')">
          👥 Personnel Levels & Tabular RACI (PEOPLE-03)
        </div>
        <div class="inspector-tab ${this.activeTab === 'access-matrix' ? 'active' : ''}" onclick="SettingsModule.switchTab('access-matrix')">
          🛡️ Access Control Matrix (ACCESS-01)
        </div>
        <div class="inspector-tab ${this.activeTab === 'audit' ? 'active' : ''}" onclick="SettingsModule.switchTab('audit')">
          📜 Append-Only Audit Log (CORE-08)
        </div>
      </div>

      <div id="settings-subcontent" style="margin-top: 16px;">
        ${this.renderSubContent(data)}
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  renderSubContent(data) {
    if (this.activeTab === 'modules') {
      return this.renderModuleCatalog(data.modules);
    } else if (this.activeTab === 'raci') {
      return this.renderRACIDirectory(data.users, data.personnelLevels);
    } else if (this.activeTab === 'access-matrix') {
      return this.renderAccessMatrix(data.modules, data.personnelLevels);
    } else if (this.activeTab === 'audit') {
      return this.renderAuditLog(data.auditLogs);
    }
  },

  // §11.2 MOD-02 & MOD-07 4-Axis Independent Module State
  renderModuleCatalog(modules) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Module Manifest & 4-Axis Lifecycle State (§11.2 MOD-02)</h3>
            <span class="card-subtitle">
              Independent axes: Catalog Availability × Deployment Status × Project Operational State × User Assignment Grant.
            </span>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Module Key & Name</th>
                <th>Phase</th>
                <th>Axis 1: Catalog</th>
                <th>Axis 2: Deployment</th>
                <th>Axis 3: Project State</th>
                <th>Axis 4: User Grant</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${modules.map(m => `
                <tr>
                  <td>
                    <div style="font-weight: 700;">${m.name}</div>
                    <div style="font-family: monospace; font-size: 11px; color: var(--pf-text-secondary);">${m.id}</div>
                    <div style="font-size: 11px; color: var(--pf-text-muted);">${m.description}</div>
                  </td>
                  <td><span class="badge badge-brand">${m.phase}</span></td>
                  <td>
                    <span class="badge ${m.catalogState === 'Available' ? 'badge-success' : 'badge-neutral'}">
                      ${m.catalogState}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${m.deploymentState === 'Installed' ? 'badge-success' : 'badge-neutral'}">
                      ${m.deploymentState}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${m.projectState === 'Enabled' ? 'badge-success' : (m.projectState === 'Pilot' ? 'badge-brand' : 'badge-neutral')}">
                      ${m.projectState}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${m.userGrant === 'Allowed' ? 'badge-info' : 'badge-neutral'}">
                      ${m.userGrant}
                    </span>
                  </td>
                  <td>
                    ${m.isCore ? `
                      <span style="font-size: 11px; color: var(--pf-text-muted);">Core Locked</span>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.showToast('Module configuration updated', 'info')">Configure</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §2.6 PEOPLE-01..03 Personnel Levels & RACI
  renderRACIDirectory(users, levels) {
    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Project Levels Definitions -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Project Personnel Levels (§2.6 PEOPLE-02)</h3>
              <span class="card-subtitle">Level supplies template; role supplies capabilities; position identifies responsibility slot.</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Level ID</th>
                  <th>Standard Position Title</th>
                  <th>Responsibility & Authorization Boundary</th>
                </tr>
              </thead>
              <tbody>
                ${levels.map(l => `
                  <tr>
                    <td class="code-col" style="font-weight: 700;">${l.level}</td>
                    <td style="font-weight: 600;">${l.title}</td>
                    <td style="font-size: 12.5px; color: var(--pf-text-secondary);">${l.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Project Directory & RACI Table -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Project Directory & Functional RACI (PEOPLE-03)</h3>
              <span class="card-subtitle">R = Responsible (Executes), A = Accountable (Approves), C = Consulted (Review), I = Informed (Read).</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Member / Name</th>
                  <th>Level</th>
                  <th>Project Position</th>
                  <th>Planning / Baseline</th>
                  <th>Document Control</th>
                  <th>Expediting</th>
                  <th>QAQC / Yard</th>
                  <th>Client Publication</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>
                      <div style="font-weight: 700;">${u.name}</div>
                      <div style="font-size: 11px; color: var(--pf-text-secondary);">${u.company}</div>
                    </td>
                    <td><span class="badge badge-brand">${u.personnelLevel}</span></td>
                    <td style="font-weight: 600; font-size: 12px;">${u.projectRole}</td>
                    <td><span class="badge ${u.role === 'Project Manager' || u.discipline === 'Project Controls' ? 'badge-success' : 'badge-neutral'}">${u.discipline === 'Project Controls' ? 'R' : (u.role === 'Project Manager' ? 'A' : 'I')}</span></td>
                    <td><span class="badge ${u.discipline === 'Document Control' ? 'badge-success' : 'badge-neutral'}">${u.discipline === 'Document Control' ? 'R / A' : 'C'}</span></td>
                    <td><span class="badge ${u.discipline === 'Procurement' ? 'badge-success' : 'badge-neutral'}">${u.discipline === 'Procurement' ? 'R / A' : 'I'}</span></td>
                    <td><span class="badge ${u.discipline === 'QAQC / Yard' ? 'badge-success' : 'badge-neutral'}">${u.discipline === 'QAQC / Yard' ? 'R' : 'I'}</span></td>
                    <td><span class="badge ${u.role === 'Project Manager' ? 'badge-critical' : (u.isClient ? 'badge-info' : 'badge-neutral')}">${u.role === 'Project Manager' ? 'A' : (u.isClient ? 'I' : '—')}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  // §2.3 & ACCESS-01 Access Control Matrix
  renderAccessMatrix(modules, levels) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Role / Action / Scope Matrix (ACCESS-01)</h3>
            <span class="card-subtitle">Explicit grants across project operational boundaries. Denies override allows.</span>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Module</th>
                <th>L1 Director</th>
                <th>L2 PM & Controls</th>
                <th>L3 Discipline Lead</th>
                <th>L4 Field Engineer</th>
                <th>L5 Client (External)</th>
              </tr>
            </thead>
            <tbody>
              ${modules.map(m => `
                <tr>
                  <td>
                    <strong>${m.name}</strong>
                    <div style="font-size: 10.5px; color: var(--pf-text-secondary);">${m.id}</div>
                  </td>
                  <td><span class="badge badge-brand">Manage</span></td>
                  <td><span class="badge badge-brand">Manage</span></td>
                  <td><span class="badge badge-info">Contribute</span></td>
                  <td><span class="badge badge-neutral">View / Field</span></td>
                  <td>
                    <span class="badge ${m.id === 'MOD-CORE-ID' || m.id === 'MOD-YARD-EXEC' ? 'badge-neutral' : 'badge-info'}">
                      ${m.id === 'MOD-CORE-ID' ? 'Hidden' : 'View Released'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §4.2 CORE-08 Append-Only Audit Log
  renderAuditLog(logs) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Immutable Audit Trail (CORE-08)</h3>
            <span class="card-subtitle">Restricted append-only audit covering material configuration, approvals, and publication decisions.</span>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>Attributable Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td class="tabular-nums" style="font-size: 11.5px;">${log.timestamp}</td>
                  <td style="font-weight: 600;">${log.actor}</td>
                  <td><span class="badge badge-brand">${log.action}</span></td>
                  <td class="code-col">${log.entity}</td>
                  <td style="font-size: 12.5px; color: var(--pf-text-secondary);">${log.details}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §2.3 ACL-04 & ACCESS-04 "Preview as Person / Level" Simulator
  openPreviewModal() {
    const data = window.ProjectFlowData;

    const modalHTML = `
      <div class="modal-backdrop active" id="preview-user-modal">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Read-Only Policy Preview (ACL-04 / ACCESS-04)</h3>
            <button class="btn btn-icon" onclick="document.getElementById('preview-user-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 13px; color: var(--pf-text-secondary);">
              Preview the entire application using actual effective policy evaluation as a specific person or level. A visible top banner is displayed and no business writes are permitted.
            </p>

            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Select Person to Preview As:</label>
              <select id="preview-persona-select" class="filter-select" style="width: 100%;">
                ${data.users.map(u => `
                  <option value="${u.id}">${u.name} — ${u.projectRole} (${u.personnelLevel}${u.isClient ? ' • CLIENT' : ''})</option>
                `).join('')}
              </select>
            </div>

            <div style="background: var(--pf-warning-bg); border: 1px solid var(--pf-warning-border); padding: 12px; border-radius: 6px; font-size: 12px; color: var(--pf-warning); margin-top: 12px;">
              <strong>Notice:</strong> Selecting <em>Johan Vries (Client Representative)</em> masks internal comments, commercial rates, unapproved drafts, and limits view to released revisions.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('preview-user-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="SettingsModule.activatePreview()">Start Preview</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  activatePreview() {
    const selectedId = document.getElementById('preview-persona-select').value;
    document.getElementById('preview-user-modal').remove();

    ProjectFlowApp.startPreviewAs(selectedId);
  }
};

window.SettingsModule = SettingsModule;
