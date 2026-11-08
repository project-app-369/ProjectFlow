/**
 * ProjectFlow - Yard Execution, Layout & QAQC Module (v3_gemini)
 * §8.1 CON-01..06 Yard Layout 2D, Workfront Gates & §9.1 COM-01..03 Check Sheets & Punches
 */

const ExecutionModule = {
  activeTab: 'yard-layout', // 'yard-layout' | 'workfronts' | 'punches'

  render() {
    const data = window.ProjectFlowData;

    const container = document.getElementById('view-execution');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Yard Execution & Quality Control (P2 Foundation)</h1>
          <p class="view-description">
            2D revision-controlled yard layout, workfront readiness gatekeeper (Engineering, Material, QAQC, HSE), and punch lifecycle.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="ExecutionModule.switchTab('punches')">
            Punches (${data.punches.length})
          </button>
          <button class="btn btn-primary btn-sm" onclick="ExecutionModule.switchTab('yard-layout')">
            🗺️ 2D Interactive Yard Map
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeTab === 'yard-layout' ? 'active' : ''}" onclick="ExecutionModule.switchTab('yard-layout')">
          🗺️ 2D Yard Layout & Spatial Pins (CON-01)
        </div>
        <div class="inspector-tab ${this.activeTab === 'workfronts' ? 'active' : ''}" onclick="ExecutionModule.switchTab('workfronts')">
          🚧 Workfront Readiness Gates (CON-03)
        </div>
        <div class="inspector-tab ${this.activeTab === 'punches' ? 'active' : ''}" onclick="ExecutionModule.switchTab('punches')">
          🔍 QAQC Punches & Check Sheets (COM-03)
        </div>
      </div>

      <div id="execution-subcontent" style="margin-top: 16px;">
        ${this.activeTab === 'yard-layout' 
          ? this.renderYardLayout(data.yardZones) 
          : (this.activeTab === 'workfronts' ? this.renderWorkfrontsGates(data.yardZones) : this.renderPunches(data.punches))}
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  // §8.1 CON-01 & DEC-08 2D Interactive Yard Layout
  renderYardLayout(zones) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Batam Fabrication Yard — 2D Interactive Layout Plan (Rev 2)</h3>
            <span class="card-subtitle">Click any pin or zone to inspect readiness gates, material stage, or blocking punch items.</span>
          </div>
          <span class="badge badge-brand">Scale 1:500 • GPS Calibrated</span>
        </div>
        <div class="card-body" style="padding: 12px;">
          
          <div class="yard-canvas-wrapper">
            <svg class="yard-svg" viewBox="0 0 700 480">
              <!-- Yard Background Grid -->
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--pf-border-subtle)" stroke-width="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <!-- Seawall / Quayside edge -->
              <path d="M 360,0 L 360,480" stroke="#245ba5" stroke-width="3" stroke-dasharray="6,4" />
              <text x="370" y="30" fill="#245ba5" font-size="11" font-weight="700">BERTH BASIN / SEA ACCESS</text>

              <!-- Zones -->
              ${zones.map(z => `
                <g class="yard-zone-group">
                  <rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" 
                        fill="${z.color}" stroke="${z.borderColor}" stroke-width="2" rx="8" />
                  <text x="${z.x + 12}" y="${z.y + 22}" fill="var(--pf-text-main)" font-size="12" font-weight="700">
                    ${z.name}
                  </text>
                  <text x="${z.x + 12}" y="${z.y + 38}" fill="var(--pf-text-secondary)" font-size="10.5">
                    ${z.activeModule}
                  </text>

                  <!-- Pins inside zone -->
                  ${z.pins.map(pin => {
                    const isWorkfront = pin.type === 'workfront';
                    const isPunch = pin.type === 'punch';
                    const pinColor = isWorkfront ? '#00877d' : (isPunch ? '#b42336' : '#245ba5');

                    return `
                      <g class="yard-pin" onclick="ProjectFlowApp.openInspector('${pin.type}', '${pin.code}')" transform="translate(${pin.x}, ${pin.y})">
                        <circle cx="0" cy="0" r="14" fill="${pinColor}" stroke="#ffffff" stroke-width="2.5" />
                        <text x="0" y="4" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">
                          ${isWorkfront ? 'WF' : (isPunch ? 'P!' : 'PT')}
                        </text>
                        <rect x="-40" y="18" width="80" height="18" fill="rgba(0,0,0,0.75)" rx="4" />
                        <text x="0" y="30" fill="#ffffff" font-size="9" text-anchor="middle">${pin.code}</text>
                      </g>
                    `;
                  }).join('')}
                </g>
              `).join('')}
            </svg>

            <!-- Legend Overlay -->
            <div class="yard-legend">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="width:10px; height:10px; border-radius:50%; background:#00877d;"></span> Workfront Pin
              </span>
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="width:10px; height:10px; border-radius:50%; background:#b42336;"></span> Blocking Punch (Cat A)
              </span>
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="width:10px; height:10px; border-radius:50%; background:#245ba5;"></span> Marine / T&I Pin
              </span>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  // §8.1 CON-03 Workfront Readiness Gates
  renderWorkfrontsGates(zones) {
    const allPins = zones.flatMap(z => z.pins.filter(p => p.type === 'workfront'));

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Workfront Execution Readiness Gatekeeper (CON-03)</h3>
            <span class="card-subtitle">Non-waivable gates. All mandatory criteria must be certified before physical release.</span>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Workfront Code</th>
                <th>Scope Description</th>
                <th>Gate 1: Engineering IFC</th>
                <th>Gate 2: Materials in Yard</th>
                <th>Gate 3: QAQC Inspection Holds</th>
                <th>Gate 4: HSE Permit to Work</th>
                <th>Release Decision</th>
              </tr>
            </thead>
            <tbody>
              ${allPins.map(wf => `
                <tr onclick="ProjectFlowApp.openInspector('workfront', '${wf.code}')">
                  <td class="code-col">${wf.code}</td>
                  <td style="font-weight: 600;">${wf.label}</td>
                  <td><span class="badge badge-success">${wf.gateEngineering}</span></td>
                  <td><span class="badge badge-success">${wf.gateMaterials}</span></td>
                  <td>
                    <span class="badge ${wf.gateQAQC.includes('Hold') ? 'badge-critical' : 'badge-success'}">
                      ${wf.gateQAQC}
                    </span>
                  </td>
                  <td><span class="badge badge-success">${wf.gateHSE}</span></td>
                  <td>
                    <span class="badge ${wf.status.includes('Released') ? 'badge-success' : 'badge-warning'}">
                      ${wf.status}
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

  // §9.1 COM-03 Punches Register & Balance Calculator
  renderPunches(punches) {
    // Punch balance fixture calculation (§14.2):
    // Opening 20 + Raised 5 + Reopened 2 - Closed 8 = 19 open
    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Punch Balance KPI Banner (§14.2) -->
        <div class="card" style="background: var(--pf-surface-subtle); border: 1px solid var(--pf-border);">
          <div class="card-body" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--pf-text-muted);">
                Punch Balance Formula (§14.2 Fixture)
              </div>
              <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">
                Opening (20) + Raised (5) + Reopened (2) − Verified Closed (8) = <span style="color: var(--pf-critical);">19 Active Punches</span>
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <span class="badge badge-critical" style="font-size: 13px;">2 Cat A (Blocking Handover)</span>
              <span class="badge badge-neutral" style="font-size: 13px;">17 Cat B (Non-Blocking)</span>
            </div>
          </div>
        </div>

        <div class="register-container">
          <div class="register-toolbar">
            <div class="toolbar-left">
              <h3 style="font-size: 14px; font-weight: 700;">Punch Master Register (COM-03)</h3>
            </div>
            <div class="toolbar-right">
              <button class="btn btn-primary btn-sm" onclick="ProjectFlowApp.showToast('Punch creation modal opened', 'info')">+ Raise Punch</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Punch Code</th>
                  <th>Category</th>
                  <th>Tag / Equipment</th>
                  <th>System</th>
                  <th>Description</th>
                  <th>Owner</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${punches.map(p => `
                  <tr onclick="ProjectFlowApp.openInspector('punch', '${p.id}')">
                    <td class="code-col">${p.code}</td>
                    <td>
                      <span class="badge ${p.category.includes('Cat A') ? 'badge-critical' : 'badge-neutral'}">
                        ${p.category}
                      </span>
                    </td>
                    <td style="font-weight: 700; font-family: monospace;">${p.tag}</td>
                    <td>${p.system}</td>
                    <td style="max-width: 260px;">${p.description}</td>
                    <td>${p.owner}</td>
                    <td class="tabular-nums">${p.dueDate}</td>
                    <td>
                      <span class="badge ${p.status.includes('Blocker') ? 'badge-critical' : 'badge-warning'}">
                        ${p.status}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }
};

window.ExecutionModule = ExecutionModule;
