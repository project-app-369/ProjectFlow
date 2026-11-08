/**
 * ProjectFlow - Dashboard Module (v3_gemini)
 * §6.1 DASH-01..03, §5.1..5.3 Rules of Credit & KPIs
 */

const DashboardModule = {
  render() {
    const data = window.ProjectFlowData;
    const project = data.projects.find(p => p.id === data.state.currentProjectId);
    const isClient = data.users.find(u => u.id === data.state.currentPersonaId)?.isClient;

    const container = document.getElementById('view-dashboard');
    if (!container) return;

    // Calculate dynamic stats
    const openTasks = data.tasks.filter(t => t.projectId === project.id && t.status !== 'Closed');
    const urgentTasks = openTasks.filter(t => t.priority === 'Urgent');
    const criticalRisks = data.risks.filter(r => r.inherentScore >= 15);
    const blockingPunches = data.punches.filter(p => p.category.includes('Cat A') && p.status !== 'Closed');
    const latePOs = data.purchaseOrders.filter(po => po.varianceDays > 0);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Project Controls Dashboard</h1>
          <p class="view-description">
            Reconciled physical progress, baseline curves, critical milestones, and accountable PIC actions for <strong>${project.title}</strong>.
          </p>
        </div>
        <div class="view-actions">
          ${isClient ? `
            <span class="badge badge-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Client Audited View (Internal Data Masked)
            </span>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.openSnapshotModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Freeze Snapshot
            </button>
            <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.publishSnapshotToClient()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              Publish to Client
            </button>
          `}
        </div>
      </div>

      <!-- KPI Metric Summary Cards (§5.3) -->
      <div class="metrics-strip">
        <div class="metric-card accent">
          <div class="metric-label">
            <span>Accepted Actual Progress</span>
            <span class="badge badge-brand">Baseline ${project.baselineRev.split(' ')[0]}</span>
          </div>
          <div class="metric-value-row">
            <span class="metric-value">${project.overallProgress.toFixed(1)}</span>
            <span class="metric-unit">%</span>
          </div>
          <div class="metric-trend ${project.varianceProgress < 0 ? 'negative' : 'positive'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${project.varianceProgress < 0 
                ? '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>' 
                : '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>'}
            </svg>
            <span>${project.varianceProgress.toFixed(1)}% vs Planned (${project.plannedProgress.toFixed(1)}%)</span>
          </div>
          <div class="metric-subtext">Authoritative rules of credit (Accepted only)</div>
        </div>

        <div class="metric-card ${latePOs.length > 0 ? 'warning' : 'success'}">
          <div class="metric-label">
            <span>Procurement & Expediting</span>
            <span class="badge ${latePOs.length > 0 ? 'badge-warning' : 'badge-success'}">${latePOs.length} Critical Lates</span>
          </div>
          <div class="metric-value-row">
            <span class="metric-value">${data.vendorProduction.acceptedExpeditorProgress.toFixed(1)}</span>
            <span class="metric-unit">%</span>
          </div>
          <div class="metric-trend negative">
            <span>+${data.vendorProduction.finishVarianceWorkingDays} working days</span>
          </div>
          <div class="metric-subtext">Compressor Skid (PO-4500128) Recovery Plan Active</div>
        </div>

        <div class="metric-card ${blockingPunches.length > 0 ? 'critical' : 'success'}">
          <div class="metric-label">
            <span>QAQC & Precom Readiness</span>
            <span class="badge ${blockingPunches.length > 0 ? 'badge-critical' : 'badge-success'}">Gatekeeper</span>
          </div>
          <div class="metric-value-row">
            <span class="metric-value">${blockingPunches.length}</span>
            <span class="metric-unit">Blocking Cat A</span>
          </div>
          <div class="metric-trend ${blockingPunches.length > 0 ? 'negative' : 'neutral'}">
            <span>${data.punches.length} total active punch items</span>
          </div>
          <div class="metric-subtext">Blocks Mechanical Completion & Loadout</div>
        </div>

        <div class="metric-card ${urgentTasks.length > 0 ? 'critical' : 'accent'}">
          <div class="metric-label">
            <span>Canonical Tasks & Actions</span>
            <span class="badge badge-neutral">${openTasks.length} Open</span>
          </div>
          <div class="metric-value-row">
            <span class="metric-value">${urgentTasks.length}</span>
            <span class="metric-unit">Urgent PIC</span>
          </div>
          <div class="metric-trend negative">
            <span>2 Overdue this week</span>
          </div>
          <div class="metric-subtext">Linked across MoM, CRS, and Expediting</div>
        </div>
      </div>

      <!-- Main S-Curve & Sched Rollup Section -->
      <div style="display: grid; grid-template-columns: 2fr 1.1fr; gap: 24px; align-items: start;">
        
        <!-- S-Curve Chart Card (§6.1 DASH-02, §5.1) -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Physical Progress S-Curve (Planned Baseline vs Accepted Actual)
              </h3>
              <span class="card-subtitle">Governed measurement basis. Cutoff Date: ${project.cutoffDate}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <span class="badge" style="background:#343c78; color:white;">Planned (Baseline)</span>
              <span class="badge" style="background:#00877d; color:white;">Accepted Actual</span>
              <span class="badge" style="background:#f4c46b; color:#172b3a;">Submitted Pending</span>
            </div>
          </div>
          <div class="card-body" style="padding: 16px;">
            ${this.renderSCurveSVG(data.sCurveData)}
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 11.5px; color: var(--pf-text-secondary); border-top: 1px solid var(--pf-border-subtle); padding-top: 8px;">
              <span><strong>DEC-03 Rule:</strong> Accepted actuals never count unapproved drafts or double-counted allocations.</span>
              <span><strong>Completeness:</strong> 100% reporting units submitted.</span>
            </div>
          </div>
        </div>

        <!-- Work Package Allocation Summary (§4.1, §6.2) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Discipline Work Packages
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.navigate('planning')">WBS Matrix</button>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Weight</th>
                  <th>Accepted</th>
                  <th>Var</th>
                </tr>
              </thead>
              <tbody>
                ${data.workPackages.map(wp => `
                  <tr onclick="ProjectFlowApp.openInspector('workPackage', '${wp.id}')">
                    <td>
                      <div style="font-weight: 600;">${wp.title}</div>
                      <div style="font-size: 11px; color: var(--pf-text-secondary);">${wp.code} • ${wp.owner}</div>
                    </td>
                    <td class="num">${wp.weight.toFixed(1)}%</td>
                    <td>
                      <div class="progress-bar-wrapper">
                        <div class="progress-track">
                          <div class="progress-fill" style="width: ${wp.actualPercent}%"></div>
                        </div>
                        <span class="progress-text">${wp.actualPercent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td class="num" style="color: ${wp.variance < 0 ? 'var(--pf-critical)' : 'var(--pf-success)'}; font-weight: 600;">
                      ${wp.variance > 0 ? '+' : ''}${wp.variance.toFixed(1)}%
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Action Items & Critical Bottlenecks Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        
        <!-- Urgent PIC Coordination Tasks (§6.7) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Urgent PIC Tasks & Escalations
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.navigate('tasks')">View All Tasks</button>
          </div>
          <div class="card-body" style="padding: 0;">
            <div style="display: flex; flex-direction: column;">
              ${data.tasks.slice(0, 4).map(t => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid var(--pf-border-subtle); cursor: pointer;" onclick="ProjectFlowApp.openInspector('task', '${t.id}')">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="badge ${t.priority === 'Urgent' ? 'badge-critical' : 'badge-warning'}">${t.priority}</span>
                      <span style="font-weight: 600; font-size: 13px;">${t.title}</span>
                    </div>
                    <div style="font-size: 11.5px; color: var(--pf-text-secondary);">
                      PIC: <strong>${t.pic}</strong> • Source: <strong>${t.sourceModule} (${t.sourceId})</strong> • Due: <strong>${t.dueDate}</strong>
                    </div>
                  </div>
                  <span class="badge badge-neutral">${t.status}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Vendor Production & Delivery Alerts (Rev 1.2 §7.2.1) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
              Vendor Manufacturing Critical Alerts
            </h3>
            <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.navigate('procurement')">Vendor Workspace</button>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="background-color: var(--pf-critical-bg); border: 1px solid var(--pf-critical-border); border-radius: var(--pf-radius-md); padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: var(--pf-critical); font-size: 13px;">PO-4500128: Siemens Gas Compressors (+30 Days Late)</strong>
                <span class="badge badge-critical">Critical Exposure</span>
              </div>
              <p style="font-size: 12.5px; color: var(--pf-text-main); margin-bottom: 6px;">
                Duisburg plant baseframe vibration resonance issue (CRS-043). Expeditor verified 76.5% accepted vs 88.0% planned.
              </p>
              <div style="display: flex; gap: 12px; font-size: 11.5px; color: var(--pf-text-secondary);">
                <span>Forecast Site Arrival: <strong>2027-01-14</strong></span>
                <span>Required On Site: <strong>2026-12-15</strong></span>
              </div>
            </div>

            <div style="background-color: var(--pf-warning-bg); border: 1px solid var(--pf-warning-border); border-radius: var(--pf-radius-md); padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: var(--pf-warning); font-size: 13px;">PO-4500142: Cameron Subsea Valves (+9 Days Late)</strong>
                <span class="badge badge-warning">FAT Pending</span>
              </div>
              <p style="font-size: 12.5px; color: var(--pf-text-main); margin-bottom: 6px;">
                Inconel 625 cladding hydrotest completed; FAT witness hold point scheduled for 2026-11-12.
              </p>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  // Generates interactive SVG S-Curve (§6.1, §3.3)
  renderSCurveSVG(dataPoints) {
    const width = 640;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const count = dataPoints.length;
    const xStep = chartW / (count - 1);

    // Coordinate mapping
    const getX = index => padding.left + index * xStep;
    const getY = val => padding.top + chartH - (val / 100) * chartH;

    // Planned path
    let plannedPath = '';
    dataPoints.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d.planned);
      plannedPath += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });

    // Actual path (up to cutoff)
    let actualPath = '';
    let cutoffX = 0;
    let cutoffY = 0;
    dataPoints.forEach((d, i) => {
      if (d.actual !== null) {
        const x = getX(i);
        const y = getY(d.actual);
        actualPath += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        cutoffX = x;
        cutoffY = y;
      }
    });

    // Grid lines
    let gridLines = '';
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = getY(pct);
      gridLines += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--pf-border-subtle)" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" fill="var(--pf-text-muted)" font-size="10" text-anchor="end">${pct}%</text>
      `;
    }

    // X-axis labels
    let xLabels = '';
    dataPoints.forEach((d, i) => {
      if (i % 2 === 0 || i === 9) { // sample labels
        const x = getX(i);
        xLabels += `
          <text x="${x}" y="${height - 12}" fill="var(--pf-text-muted)" font-size="9.5" text-anchor="middle">${d.period.split(' ')[0]}</text>
        `;
      }
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block; overflow: visible;">
        ${gridLines}
        ${xLabels}
        <!-- Planned Baseline Curve -->
        <path d="${plannedPath}" fill="none" stroke="#343c78" stroke-width="2.5" stroke-dasharray="4,2" />
        <!-- Actual Accepted Curve -->
        <path d="${actualPath}" fill="none" stroke="#00877d" stroke-width="3.5" />
        <!-- Cutoff marker -->
        <circle cx="${cutoffX}" cy="${cutoffY}" r="5" fill="#00877d" stroke="#ffffff" stroke-width="2" />
        <line x1="${cutoffX}" y1="${padding.top}" x2="${cutoffX}" y2="${height - padding.bottom}" stroke="#b42336" stroke-width="1.5" stroke-dasharray="2,2" />
        <text x="${cutoffX}" y="${padding.top - 6}" fill="#b42336" font-size="10" font-weight="700" text-anchor="middle">Week 45 Cutoff</text>
      </svg>
    `;
  }
};

window.DashboardModule = DashboardModule;
