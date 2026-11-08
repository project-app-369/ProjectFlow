/**
 * ProjectFlow - Governance, Risks, MOC & Interfaces Module (v3_gemini)
 * §6.4 MGT-01..05 Registers, 5x5 Risk Heatmap, MOC Workflow & §6.5 INT-01..03 Interfaces
 */

const GovernanceModule = {
  activeTab: 'risks', // 'risks' | 'issues' | 'moc' | 'interfaces' | 'mom'

  render() {
    const data = window.ProjectFlowData;

    const container = document.getElementById('view-governance');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Governance & Management Registers</h1>
          <p class="view-description">
            Governed risk heatmaps, issue escalation, baseline change control (MOC), cross-party interface boundaries, and meeting minutes.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary btn-sm" onclick="GovernanceModule.openNewRiskModal()">
            + Log New Risk
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeTab === 'risks' ? 'active' : ''}" onclick="GovernanceModule.switchTab('risks')">
          🔥 Risks & 5x5 Heatmap (${data.risks.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'issues' ? 'active' : ''}" onclick="GovernanceModule.switchTab('issues')">
          ⚠️ Issues Register (${data.issues.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'moc' ? 'active' : ''}" onclick="GovernanceModule.switchTab('moc')">
          🔄 Management of Change (MOC) (${data.mocs.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'interfaces' ? 'active' : ''}" onclick="GovernanceModule.switchTab('interfaces')">
          🔗 Interface Management (${data.interfaces.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'mom' ? 'active' : ''}" onclick="GovernanceModule.switchTab('mom')">
          📝 Minutes of Meetings (MoM) (${data.meetings.length})
        </div>
      </div>

      <div id="gov-subcontent" style="margin-top: 16px;">
        ${this.renderSubContent(data)}
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  renderSubContent(data) {
    if (this.activeTab === 'risks') {
      return this.renderRisksAndHeatmap(data.risks);
    } else if (this.activeTab === 'issues') {
      return this.renderIssues(data.issues);
    } else if (this.activeTab === 'moc') {
      return this.renderMOC(data.mocs);
    } else if (this.activeTab === 'interfaces') {
      return this.renderInterfaces(data.interfaces);
    } else if (this.activeTab === 'mom') {
      return this.renderMoM(data.meetings);
    }
  },

  // §6.4 MGT-01 Risks & 5x5 Heatmap
  renderRisksAndHeatmap(risks) {
    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
        
        <!-- 5x5 Heatmap Matrix Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">5×5 Risk Scoring Heatmap Matrix (MGT-01)</h3>
              <span class="card-subtitle">Inherent score (outer circle) vs Residual score after mitigation (solid dot).</span>
            </div>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; align-items: center;">
            
            <div class="heatmap-5x5">
              <!-- Y-Axis labels (Likelihood 5 down to 1) -->
              <div style="display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">L5 Very High</div>
              <div class="heatmap-cell heatmap-yellow">5</div>
              <div class="heatmap-cell heatmap-amber">10</div>
              <div class="heatmap-cell heatmap-red">15</div>
              <div class="heatmap-cell heatmap-red">20</div>
              <div class="heatmap-cell heatmap-red">25</div>

              <div style="display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">L4 High</div>
              <div class="heatmap-cell heatmap-yellow">4</div>
              <div class="heatmap-cell heatmap-yellow">8</div>
              <div class="heatmap-cell heatmap-amber">12</div>
              <div class="heatmap-cell heatmap-red" style="position:relative; outline: 2px solid var(--pf-critical);">
                16
                <span style="position:absolute; top:2px; right:4px; font-size:10px; background:var(--pf-critical); color:white; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">1</span>
              </div>
              <div class="heatmap-cell heatmap-red">20</div>

              <div style="display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">L3 Medium</div>
              <div class="heatmap-cell heatmap-green">3</div>
              <div class="heatmap-cell heatmap-yellow">6</div>
              <div class="heatmap-cell heatmap-yellow">9</div>
              <div class="heatmap-cell heatmap-amber" style="position:relative; outline: 2px solid var(--pf-warning);">
                12
                <span style="position:absolute; top:2px; right:4px; font-size:10px; background:var(--pf-warning); color:white; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">1</span>
              </div>
              <div class="heatmap-cell heatmap-red">15</div>

              <div style="display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">L2 Low</div>
              <div class="heatmap-cell heatmap-green">2</div>
              <div class="heatmap-cell heatmap-green">4</div>
              <div class="heatmap-cell heatmap-yellow" style="position:relative;">
                6
                <span style="position:absolute; top:2px; right:4px; font-size:10px; background:var(--pf-brand); color:white; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">1</span>
              </div>
              <div class="heatmap-cell heatmap-yellow">8</div>
              <div class="heatmap-cell heatmap-amber">10</div>

              <div style="display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">L1 Rare</div>
              <div class="heatmap-cell heatmap-green">1</div>
              <div class="heatmap-cell heatmap-green">2</div>
              <div class="heatmap-cell heatmap-green">3</div>
              <div class="heatmap-cell heatmap-yellow">4</div>
              <div class="heatmap-cell heatmap-yellow">5</div>

              <!-- Bottom X-axis labels (Consequence 1 to 5) -->
              <div></div>
              <div style="text-align:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">C1 Low</div>
              <div style="text-align:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">C2 Minor</div>
              <div style="text-align:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">C3 Mod</div>
              <div style="text-align:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">C4 Maj</div>
              <div style="text-align:center; font-size:11px; font-weight:bold; color:var(--pf-text-secondary);">C5 Cat</div>
            </div>

            <div style="margin-top: 14px; font-size: 11.5px; color: var(--pf-text-secondary); text-align: center;">
              Axis: Likelihood (Vertical) × Consequence (Horizontal). Threshold ≥15 = Critical Red.
            </div>
          </div>
        </div>

        <!-- Risks Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Project Risk Register</h3>
            <span class="badge badge-critical">1 Critical Inherent</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <div style="display: flex; flex-direction: column;">
              ${risks.map(r => `
                <div style="padding: 14px 18px; border-bottom: 1px solid var(--pf-border-subtle); cursor: pointer;" onclick="ProjectFlowApp.openInspector('risk', '${r.id}')">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="font-weight: 700; font-size: 13.5px;">${r.title}</div>
                    <span class="badge ${r.inherentScore >= 15 ? 'badge-critical' : 'badge-warning'}">
                      Score: ${r.inherentScore} → ${r.residualScore}
                    </span>
                  </div>
                  <p style="font-size: 12px; color: var(--pf-text-secondary); margin-bottom: 6px;">
                    <strong>Cause/Effect:</strong> ${r.cause}
                  </p>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--pf-text-muted);">
                    <span>Owner: <strong>${r.owner}</strong> • ${r.category}</span>
                    <span>Review: <strong>${r.reviewDate}</strong></span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

      </div>
    `;
  },

  // §6.4 MGT-02 Issues
  renderIssues(issues) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Live Issues Register (MGT-02)</h3>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.showToast('Issue created', 'info')">+ Raise Issue</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Issue ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Containment Action</th>
                <th>Owner</th>
                <th>Target Date</th>
                <th>Linked Task</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${issues.map(iss => `
                <tr onclick="ProjectFlowApp.openInspector('issue', '${iss.id}')">
                  <td class="code-col">${iss.id}</td>
                  <td style="font-weight: 600;">${iss.title}</td>
                  <td><span class="badge badge-critical">${iss.severity}</span></td>
                  <td style="max-width: 240px; font-size: 12px;">${iss.containment}</td>
                  <td>${iss.owner}</td>
                  <td class="tabular-nums">${iss.targetDate}</td>
                  <td>
                    ${iss.actionTask ? `<a href="javascript:void(0)" onclick="ProjectFlowApp.openInspector('task', '${iss.actionTask}')"><strong>${iss.actionTask}</strong></a>` : '—'}
                  </td>
                  <td><span class="badge badge-warning">${iss.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §6.4 MGT-04 Management of Change (MOC)
  renderMOC(mocs) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Management of Change Register (MGT-04)</h3>
            <span class="card-subtitle">Approved MOC triggers controlled baseline revisions. Approval alone does not mean completion.</span>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.showToast('MOC proposal initiated', 'info')">+ Propose MOC</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>MOC Code</th>
                <th>Title & Description</th>
                <th>Schedule Impact</th>
                <th>Cost Impact</th>
                <th>Initiator</th>
                <th>Approver</th>
                <th>Client Approved</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${mocs.map(m => `
                <tr onclick="ProjectFlowApp.openInspector('moc', '${m.id}')">
                  <td class="code-col">${m.code}</td>
                  <td>
                    <div style="font-weight: 600;">${m.title}</div>
                    <div style="font-size: 11px; color: var(--pf-text-secondary);">${m.reason}</div>
                  </td>
                  <td style="font-size: 12px; font-weight: 600;">${m.scheduleImpact}</td>
                  <td class="num" style="font-weight: 700; color: var(--pf-brand);">${m.costImpact}</td>
                  <td>${m.initiator}</td>
                  <td>${m.approver}</td>
                  <td>
                    <span class="badge ${m.clientApproved ? 'badge-success' : 'badge-neutral'}">
                      ${m.clientApproved ? 'Yes (Signed)' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${m.status.includes('Approved') ? 'badge-success' : 'badge-warning'}">
                      ${m.status}
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

  // §6.5 INT-01..03 Interface Management
  renderInterfaces(interfaces) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Interface Agreement Register & Points (INT-01)</h3>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.showToast('Interface point added', 'info')">+ Add Point</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Interface Code</th>
                <th>Boundary Scope Title</th>
                <th>Originating Party</th>
                <th>Receiving Party</th>
                <th>Coordinator</th>
                <th>Need Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${interfaces.map(iface => `
                <tr>
                  <td class="code-col">${iface.code}</td>
                  <td style="font-weight: 600;">${iface.title}</td>
                  <td><span class="badge badge-brand">${iface.originatorParty}</span></td>
                  <td><span class="badge badge-info">${iface.receivingParty}</span></td>
                  <td>${iface.coordinator}</td>
                  <td class="tabular-nums">${iface.needDate}</td>
                  <td>
                    <span class="badge ${iface.status.includes('Agreed') ? 'badge-success' : 'badge-warning'}">
                      ${iface.status}
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

  // §6.6 REP-01 Minutes of Meeting
  renderMoM(meetings) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Formal Minutes of Meetings (REP-01)</h3>
            <span class="card-subtitle">Issued minutes preserve action states at issue. Generated actions link to canonical Tasks.</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.showToast('Downloaded MoM PDF with action items', 'info')">Export Signed MoM PDF</button>
        </div>
        <div class="card-body">
          ${meetings.map(m => `
            <div style="background: var(--pf-surface-subtle); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-md); padding: 16px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="font-size: 15px; font-weight: 800;">${m.title}</h4>
                  <div style="font-size: 12px; color: var(--pf-text-secondary); margin-top: 2px;">
                    📅 ${m.date} • 📍 ${m.location}
                  </div>
                </div>
                <span class="badge badge-success">${m.status}</span>
              </div>

              <div style="font-size: 12px; color: var(--pf-text-secondary);">
                <strong>Attendees:</strong> ${m.attendees}
              </div>

              <div style="border-top: 1px solid var(--pf-border-subtle); padding-top: 8px;">
                <strong style="font-size: 12.5px; display: block; margin-bottom: 6px;">Key Decisions Recorded:</strong>
                <ul style="padding-left: 18px; font-size: 12.5px; color: var(--pf-text-main); display: flex; flex-direction: column; gap: 4px;">
                  ${m.decisions.map(d => `<li>${d}</li>`).join('')}
                </ul>
              </div>

              <div style="border-top: 1px solid var(--pf-border-subtle); padding-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 12px;">
                <strong>Linked Canonical Tasks Generated:</strong>
                ${m.actionsGenerated.map(a => `
                  <a href="javascript:void(0)" onclick="ProjectFlowApp.openInspector('task', '${a}')" class="badge badge-brand">${a}</a>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  openNewRiskModal() {
    const title = prompt('Enter Risk Title:');
    if (!title) return;
    const newRisk = {
      id: 'RSK-084-00' + (window.ProjectFlowData.risks.length + 1),
      title: title,
      category: 'Schedule / Execution',
      cause: 'Identified during weekly controls review.',
      effect: 'Workfront readiness exposure.',
      owner: 'Sarah Jenkins',
      likelihood: 3,
      consequence: 3,
      inherentScore: 9,
      residualLikelihood: 2,
      residualConsequence: 2,
      residualScore: 4,
      mitigationPlan: 'Action assigned to lead engineer.',
      status: 'Active',
      reviewDate: '2026-11-25'
    };
    window.ProjectFlowData.risks.push(newRisk);
    ProjectFlowApp.showToast('Risk logged and placed on 5x5 heatmap', 'success');
    GovernanceModule.render();
  }
};

window.GovernanceModule = GovernanceModule;
