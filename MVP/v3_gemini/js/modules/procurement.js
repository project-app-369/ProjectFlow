/**
 * ProjectFlow - Procurement & Expediting Module (v3_gemini)
 * §7.1 PROC-01..03 & §7.2.1 VPROD-01..10 Production Schedule Monitoring (Rev 1.2)
 */

const ProcurementModule = {
  activeTab: 'production-monitoring', // 'production-monitoring' | 'procurement-plan'

  render() {
    const data = window.ProjectFlowData;
    const isClient = data.users.find(u => u.id === data.state.currentPersonaId)?.isClient;

    const container = document.getElementById('view-procurement');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Procurement & Expediting Workspace</h1>
          <p class="view-description">
            Critical equipment manufacturing monitoring, PO delivery variance, shop visits, FAT witness hold points, and vendor recovery plans.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="ProcurementModule.switchTab('procurement-plan')">
            PO Register
          </button>
          <button class="btn btn-primary btn-sm" onclick="ProcurementModule.switchTab('production-monitoring')">
            🏭 Vendor Production Monitoring (Rev 1.2)
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeTab === 'production-monitoring' ? 'active' : ''}" onclick="ProcurementModule.switchTab('production-monitoring')">
          🏭 Production Schedule Monitoring (VPROD-01)
        </div>
        <div class="inspector-tab ${this.activeTab === 'procurement-plan' ? 'active' : ''}" onclick="ProcurementModule.switchTab('procurement-plan')">
          📦 Major Purchase Orders & Delivery Variance (${data.purchaseOrders.length})
        </div>
      </div>

      <div id="procurement-subcontent" style="margin-top: 16px;">
        ${this.activeTab === 'production-monitoring' 
          ? this.renderProductionMonitoring(data.vendorProduction, isClient) 
          : this.renderProcurementPlan(data.purchaseOrders, isClient)}
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  // §7.2.1 VPROD-01..10 Production Schedule Monitoring Workspace
  renderProductionMonitoring(vprod, isClient) {
    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Vendor Overview Banner (VPROD-01, VPROD-02) -->
        <div class="card" style="border-left: 4px solid var(--pf-accent);">
          <div class="card-body" style="padding: 16px 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <span class="badge badge-brand" style="font-family: monospace;">${vprod.poId}</span>
                  <h2 style="font-size: 18px; font-weight: 800;">${vprod.vendor} — ${vprod.equipment}</h2>
                </div>
                <div style="font-size: 12.5px; color: var(--pf-text-secondary);">
                  📍 Facility: <strong>${vprod.location}</strong> • Expeditor PIC: <strong>${vprod.expeditorPic}</strong> • Cutoff: <strong>${vprod.reportingCutoff}</strong>
                </div>
              </div>

              <!-- Governed Progress Reconciliation (VPROD-05) -->
              <div style="display: flex; gap: 20px; align-items: center;">
                <div style="text-align: right;">
                  <div style="font-size: 11px; text-transform: uppercase; color: var(--pf-text-muted); font-weight: 700;">Planned Baseline</div>
                  <div class="metric-value" style="font-size: 22px;">${vprod.plannedOverallProgress.toFixed(1)}%</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 11px; text-transform: uppercase; color: var(--pf-text-muted); font-weight: 700;">Reported Vendor</div>
                  <div class="metric-value" style="font-size: 22px; color: var(--pf-brand);">${vprod.reportedVendorProgress.toFixed(1)}%</div>
                </div>
                <div style="text-align: right; background: var(--pf-accent-subtle); padding: 8px 14px; border-radius: var(--pf-radius-md);">
                  <div style="font-size: 11px; text-transform: uppercase; color: var(--pf-accent); font-weight: 700;">Accepted Actual</div>
                  <div class="metric-value" style="font-size: 22px; color: var(--pf-accent);">${vprod.acceptedExpeditorProgress.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <!-- Transport & Exposure Disclaimer (VPROD-04) -->
            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--pf-border-subtle); display: flex; justify-content: space-between; font-size: 11.5px;">
              <span><strong>Site Arrival Exposure:</strong> <span style="color: var(--pf-critical); font-weight: 700;">${vprod.siteArrivalExposure}</span> (+${vprod.finishVarianceWorkingDays} working days)</span>
              <span><strong>Logistics Assumption:</strong> ${vprod.transportAssumption}</span>
            </div>
          </div>
        </div>

        <!-- Manufacturing Milestones Timeline (VPROD-03 Gantt / Stage Progress) -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Manufacturing Milestones & Inspection Points (VPROD-03)</h3>
              <span class="card-subtitle">Governed progress stages. Stage credits require attributable inspection evidence.</span>
            </div>
            <span class="badge badge-warning">Recovery Schedule V2.1</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Milestone Activity</th>
                    <th>Weight</th>
                    <th>Baseline Finish</th>
                    <th>Forecast Finish</th>
                    <th>Variance</th>
                    <th>Stage Earned</th>
                    <th>Status / Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${vprod.milestones.map(m => {
                    const isCompleted = m.status === 'Completed';
                    const isLate = m.status.includes('Late');

                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 600;">${m.activity}</div>
                          <div style="font-size: 11px; color: var(--pf-text-secondary);">${m.evidence}</div>
                        </td>
                        <td class="num">${m.weight}%</td>
                        <td class="tabular-nums" style="font-size: 12px;">${m.baselineFinish}</td>
                        <td class="tabular-nums" style="font-size: 12px; font-weight: 600; color: ${m.forecastFinish > m.baselineFinish ? 'var(--pf-critical)' : 'inherit'};">
                          ${m.forecastFinish}
                        </td>
                        <td class="num" style="color: ${m.forecastFinish > m.baselineFinish ? 'var(--pf-critical)' : 'var(--pf-success)'}; font-weight: 600;">
                          ${m.forecastFinish > m.baselineFinish ? '+22d' : '0d'}
                        </td>
                        <td>
                          <div class="progress-bar-wrapper">
                            <div class="progress-track">
                              <div class="progress-fill" style="width: ${m.acceptedPercent}%;"></div>
                            </div>
                            <span class="progress-text">${m.acceptedPercent}%</span>
                          </div>
                        </td>
                        <td>
                          <span class="badge ${isCompleted ? 'badge-success' : (isLate ? 'badge-critical' : 'badge-brand')}">
                            ${m.status}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Highlights & Concerns Section (VPROD-06, VPROD-07) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          
          <!-- Vendor Concerns & Action Tasks (VPROD-06, VPROD-08) -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Vendor Concerns & Recovery Plans (VPROD-06)
              </h3>
            </div>
            <div class="card-body" style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
              ${vprod.concerns.map(c => `
                <div style="background: var(--pf-surface-subtle); border-left: 3px solid var(--pf-critical); border-radius: var(--pf-radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <strong style="font-size: 13px;">${c.title}</strong>
                    <span class="badge ${c.severity === 'Critical' ? 'badge-critical' : 'badge-warning'}">${c.severity}</span>
                  </div>
                  <p style="font-size: 12px; color: var(--pf-text-secondary);">${c.consequence}</p>
                  <div style="background: var(--pf-surface); border: 1px solid var(--pf-border); padding: 6px 10px; border-radius: 4px; font-size: 11.5px;">
                    <strong>Recovery Action:</strong> ${c.recoveryPlan}
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--pf-text-muted); margin-top: 4px;">
                    <span>Linked Task: <a href="javascript:void(0)" onclick="ProjectFlowApp.openInspector('task', '${c.actionTask}')"><strong>${c.actionTask}</strong></a></span>
                    <span>Target: <strong>${c.targetClosure}</strong></span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Vendor Highlights & Achievements (VPROD-07) -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Weekly Production Highlights (VPROD-07)
              </h3>
            </div>
            <div class="card-body" style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
              ${vprod.highlights.map(hl => `
                <div style="background: var(--pf-surface-subtle); border-left: 3px solid var(--pf-accent); border-radius: var(--pf-radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span class="badge badge-brand" style="font-size: 10px;">${hl.category}</span>
                    <span style="font-size: 11px; color: var(--pf-text-muted);">${hl.date}</span>
                  </div>
                  <p style="font-size: 12.5px; color: var(--pf-text-main); margin-top: 4px;">${hl.text}</p>
                  <div style="font-size: 11px; color: var(--pf-text-secondary); text-align: right;">Author: ${hl.author}</div>
                </div>
              `).join('')}

              <div style="margin-top: 8px; text-align: center;">
                <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.showToast('Downloaded Vendor Production Scorecard PDF', 'info')">
                  📄 Export Vendor Scorecard (PDF / XLSX)
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  },

  // §7.1 PROC-01..03 Purchase Orders Register
  renderProcurementPlan(pos, isClient) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Major Equipment Purchase Order Register</h3>
          </div>
          <div class="toolbar-right">
            ${isClient ? `
              <span class="badge badge-info">Commercial Values Masked for Client (PUB-03)</span>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.exportCSV('procurement')">Export PO Ledger</button>
            `}
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Package / Equipment</th>
                <th>Vendor / Manufacturer</th>
                ${!isClient ? '<th>Contract Value</th>' : ''}
                <th>Required on Site</th>
                <th>Forecast Arrival</th>
                <th>Delivery Var</th>
                <th>Mfg Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pos.map(po => {
                const isLate = po.varianceDays > 0;

                return `
                  <tr onclick="ProjectFlowApp.openInspector('po', '${po.id}')">
                    <td class="code-col">${po.poNumber}</td>
                    <td>
                      <div style="font-weight: 600;">${po.title}</div>
                      <span class="badge ${po.criticality.includes('Critical') ? 'badge-critical' : 'badge-neutral'}">${po.criticality}</span>
                    </td>
                    <td>${po.vendor}</td>
                    ${!isClient ? `<td class="num" style="font-weight: 600;">${po.commercialValue}</td>` : ''}
                    <td class="tabular-nums">${po.requiredOnSite}</td>
                    <td class="tabular-nums" style="font-weight: 600; color: ${isLate ? 'var(--pf-critical)' : 'inherit'};">${po.forecastArrival}</td>
                    <td class="num" style="font-weight: 700; color: ${isLate ? 'var(--pf-critical)' : 'var(--pf-success)'};">
                      ${isLate ? `+${po.varianceDays}d late` : 'On Time'}
                    </td>
                    <td>
                      <div class="progress-bar-wrapper">
                        <div class="progress-track">
                          <div class="progress-fill" style="width: ${po.manufacturingProgress}%;"></div>
                        </div>
                        <span class="progress-text">${po.manufacturingProgress}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${isLate ? 'badge-critical' : 'badge-success'}">${po.status}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};

window.ProcurementModule = ProcurementModule;
