/**
 * ProjectFlow - Document Control & CRS Module (v3_gemini)
 * §6.8 DOC-01..17: MDR Registers, Transmittals, Multi-Party Reviews, CRS & Release-for-Use
 */

const DocumentsModule = {
  activeSubTab: 'mdr', // 'mdr' | 'crs' | 'transmittals' | 'reviews'

  render() {
    const data = window.ProjectFlowData;
    const isClient = data.users.find(u => u.id === data.state.currentPersonaId)?.isClient;

    const container = document.getElementById('view-documents');
    if (!container) return;

    // Filter documents: if Client, show ONLY released to client (§2.4 PUB-01..04)
    const displayedDocs = isClient 
      ? data.documents.filter(d => d.releasedToClient) 
      : data.documents;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Document Control & Review Queue</h1>
          <p class="view-description">
            Canonical MDR and VDR registers, multi-party reviews (Client, CA, MWS), structured CRS comments, and release-for-use governance.
          </p>
        </div>
        <div class="view-actions">
          ${isClient ? `
            <span class="badge badge-info">Client Audited Access (Public Revisions Only)</span>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="DocumentsModule.openNewTransmittalModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              Issue Transmittal
            </button>
            <button class="btn btn-primary btn-sm" onclick="DocumentsModule.openNewDocModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Register Document
            </button>
          `}
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeSubTab === 'mdr' ? 'active' : ''}" onclick="DocumentsModule.switchTab('mdr')">
          📄 Master Document Register (MDR) (${displayedDocs.length})
        </div>
        <div class="inspector-tab ${this.activeSubTab === 'crs' ? 'active' : ''}" onclick="DocumentsModule.switchTab('crs')">
          💬 Comment Resolution Sheets (CRS) (${data.crsComments.length})
        </div>
        <div class="inspector-tab ${this.activeSubTab === 'transmittals' ? 'active' : ''}" onclick="DocumentsModule.switchTab('transmittals')">
          📤 Transmittals Ledger (${data.transmittals.length})
        </div>
        <div class="inspector-tab ${this.activeSubTab === 'reviews' ? 'active' : ''}" onclick="DocumentsModule.switchTab('reviews')">
          🏛️ Multi-Party Review Matrix (Client / CA / MWS)
        </div>
      </div>

      <!-- Sub-view content -->
      <div id="docs-content-area" style="margin-top: 16px;">
        ${this.renderSubContent(displayedDocs, isClient)}
      </div>
    `;
  },

  switchTab(tabKey) {
    this.activeSubTab = tabKey;
    this.render();
  },

  renderSubContent(docs, isClient) {
    if (this.activeSubTab === 'mdr') {
      return this.renderMDRTable(docs);
    } else if (this.activeSubTab === 'crs') {
      return this.renderCRSTable(isClient);
    } else if (this.activeSubTab === 'transmittals') {
      return this.renderTransmittalsTable();
    } else if (this.activeSubTab === 'reviews') {
      return this.renderReviewsMatrix(docs);
    }
  },

  // §6.8 DOC-01..06 MDR Register
  renderMDRTable(docs) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <div class="search-input-wrapper">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="search-input" placeholder="Search doc number, title..." onkeyup="DocumentsModule.filterDocs(this.value)">
            </div>
            <select class="filter-select" onchange="DocumentsModule.filterRegisterType(this.value)">
              <option value="ALL">All Registers (MDR & VDR)</option>
              <option value="Engineering MDR">Engineering MDR Only</option>
              <option value="Vendor VDR / SDRL">Vendor VDR / SDRL Only</option>
            </select>
            <select class="filter-select" onchange="DocumentsModule.filterDiscipline(this.value)">
              <option value="ALL">All Disciplines</option>
              <option value="Structural">Structural</option>
              <option value="Process">Process</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Marine & T&I">Marine & T&I</option>
              <option value="QAQC">QAQC</option>
            </select>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.exportCSV('documents')">Export XLSX / CSV</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" id="mdr-table">
            <thead>
              <tr>
                <th>Document Number</th>
                <th>Title</th>
                <th>Register Type</th>
                <th>Rev</th>
                <th>Purpose</th>
                <th>Client Status</th>
                <th>CA / MWS Status</th>
                <th>Release for Use</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map(doc => {
                const isReleasedForUse = doc.status === 'Released for Use';
                const hasBlockers = doc.hasBlockingCrs;

                return `
                  <tr onclick="ProjectFlowApp.openInspector('document', '${doc.id}')">
                    <td class="code-col">${doc.docNumber}</td>
                    <td>
                      <div style="font-weight: 600;">${doc.title}</div>
                      <div style="font-size: 11px; color: var(--pf-text-secondary);">${doc.discipline} • Owning: ${doc.owningParty}</div>
                    </td>
                    <td>
                      <span class="badge ${doc.registerType === 'MDR' ? 'badge-brand' : 'badge-neutral'}">${doc.semanticRegister}</span>
                    </td>
                    <td style="font-weight: 700;">${doc.rev}</td>
                    <td>
                      <span class="badge badge-neutral">${doc.purpose}</span>
                    </td>
                    <td>
                      <span class="badge ${doc.clientStatus.includes('Code 1') ? 'badge-success' : (doc.clientStatus.includes('Code 2') ? 'badge-info' : 'badge-critical')}">
                        ${doc.clientStatus}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 11.5px;">
                        <div>CA: <strong>${doc.caStatus}</strong></div>
                        <div>MWS: <strong>${doc.mwsStatus}</strong></div>
                      </div>
                    </td>
                    <td>
                      ${isReleasedForUse ? `
                        <span class="badge badge-success" title="All mandatory reviews, Class, and MWS CoA satisfied.">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Released (IFC)
                        </span>
                      ` : `
                        <span class="badge ${hasBlockers ? 'badge-critical' : 'badge-warning'}" title="${hasBlockers ? 'Blocked by open CRS comment' : 'Pending review completion'}">
                          ${hasBlockers ? '🚫 Blocked (CRS)' : '⏳ Hold / In Review'}
                        </span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §6.8 DOC-11 Comment Resolution Sheet (CRS)
  renderCRSTable(isClient) {
    const data = window.ProjectFlowData;

    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Structured Comment Resolution Sheet (DOC-11)</h3>
            <span class="badge badge-neutral">${data.crsComments.length} Comments Tracked</span>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-sm" onclick="DocumentsModule.openAddCRSCommentModal()">+ Add Comment</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>CRS ID</th>
                <th>Doc & Rev</th>
                <th>Reviewer / Party</th>
                <th>Location / Category</th>
                <th>Comment Text</th>
                <th>Contractor Response</th>
                <th>Disposition / Action</th>
              </tr>
            </thead>
            <tbody>
              ${data.crsComments.map(c => `
                <tr>
                  <td class="code-col">${c.id}</td>
                  <td>
                    <div style="font-weight: 600; font-size: 12.5px;">${c.docNumber}</div>
                    <span class="badge badge-neutral" style="font-size: 10px;">${c.docRev}</span>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${c.reviewerName}</div>
                    <div style="font-size: 11px; color: var(--pf-text-secondary);">${c.reviewerParty}</div>
                  </td>
                  <td>
                    <div style="font-size: 12px; font-weight: 500;">${c.sheetPage}</div>
                    <span class="badge ${c.category.includes('Safety') || c.category.includes('Verification') ? 'badge-critical' : 'badge-neutral'}">
                      ${c.category}
                    </span>
                  </td>
                  <td style="max-width: 260px; font-size: 12.5px;">
                    ${c.commentText}
                  </td>
                  <td style="max-width: 260px; font-size: 12px; color: var(--pf-text-secondary); background: var(--pf-surface-subtle); padding: 8px 12px;">
                    ${c.contractorResponse || '<em>Pending contractor PIC response</em>'}
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <span class="badge ${c.isBlocking ? 'badge-critical' : 'badge-success'}">
                        ${c.isBlocking ? 'Blocking Gate' : 'Non-Blocking'}
                      </span>
                      <button class="btn btn-secondary btn-sm" onclick="DocumentsModule.openRespondCRSModal('${c.id}')" style="margin-top: 4px;">
                        ${c.status}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §6.8 DOC-07 Transmittals Ledger
  renderTransmittalsTable() {
    const data = window.ProjectFlowData;

    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <h3 style="font-size: 14px; font-weight: 700;">Formal Transmittals Ledger (DOC-07)</h3>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-sm" onclick="DocumentsModule.openNewTransmittalModal()">+ New Transmittal</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Transmittal Number</th>
                <th>Direction</th>
                <th>Recipient / Organization</th>
                <th>Purpose</th>
                <th>Doc Count</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.transmittals.map(t => `
                <tr onclick="DocumentsModule.previewTransmittalPDF('${t.id}')">
                  <td class="code-col">${t.number}</td>
                  <td>
                    <span class="badge ${t.direction.includes('Outgoing') ? 'badge-brand' : 'badge-info'}">${t.direction}</span>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${t.recipient}</div>
                    <div style="font-size: 11px; color: var(--pf-text-secondary);">Attn: ${t.attn}</div>
                  </td>
                  <td>${t.purpose}</td>
                  <td class="num">${t.documentsCount} docs</td>
                  <td class="tabular-nums">${t.issueDate}</td>
                  <td class="tabular-nums" style="color: var(--pf-critical); font-weight: 600;">${t.dueDate}</td>
                  <td>
                    <span class="badge badge-neutral">${t.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §6.8 DOC-09..13 Multi-Party Review Matrix
  renderReviewsMatrix(docs) {
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Multi-Party Independent Review Matrix (§6.8 DOC-09)</h3>
            <span class="card-subtitle">Separate client (COMPANY), CA, and Marine Warranty Surveyor (MWS) decision channels. Internal approval does not imply MWS acceptance.</span>
          </div>
        </div>
        <div class="card-body">
          <table class="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Rev</th>
                <th>Internal Check</th>
                <th>Client (Equinor)</th>
                <th>CA (DNV Maritime)</th>
                <th>MWS (Warranty Surveyor)</th>
                <th>Readiness Status</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map(d => `
                <tr>
                  <td>
                    <strong>${d.docNumber}</strong>
                    <div style="font-size: 11px; color: var(--pf-text-secondary);">${d.title}</div>
                  </td>
                  <td style="font-weight: 700;">${d.rev}</td>
                  <td><span class="badge badge-success">Approved</span></td>
                  <td><span class="badge ${d.clientStatus.includes('Code 1') ? 'badge-success' : 'badge-info'}">${d.clientStatus}</span></td>
                  <td><span class="badge ${d.caStatus.includes('Code 1') ? 'badge-success' : 'badge-warning'}">${d.caStatus}</span></td>
                  <td><span class="badge ${d.mwsStatus.includes('CoA Issued') ? 'badge-success' : (d.mwsStatus === 'Not Required' ? 'badge-neutral' : 'badge-critical')}">${d.mwsStatus}</span></td>
                  <td>
                    <span class="badge ${d.status === 'Released for Use' ? 'badge-success' : 'badge-warning'}">
                      ${d.status}
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

  // Transmittal Cover PDF Preview Modal
  previewTransmittalPDF(transmittalId) {
    const t = window.ProjectFlowData.transmittals.find(trn => trn.id === transmittalId);
    if (!t) return;

    const modalHTML = `
      <div class="modal-backdrop active" id="trn-pdf-modal">
        <div class="modal-dialog" style="max-width: 680px;">
          <div class="modal-header">
            <h3 class="modal-title">Formal Transmittal Cover Sheet Preview</h3>
            <button class="btn btn-icon" onclick="document.getElementById('trn-pdf-modal').remove()">✕</button>
          </div>
          <div class="modal-body" style="background: white; color: #172b3a; font-family: 'Inter', sans-serif; padding: 24px; border: 1px solid #d8e1ea; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #343c78; padding-bottom: 12px; margin-bottom: 16px;">
              <div>
                <h2 style="color: #343c78; font-size: 20px; font-weight: 800;">PROJECT FLOW</h2>
                <div style="font-size: 11px; color: #526477;">StageLink Controlled Document Transmittal</div>
              </div>
              <div style="text-align: right;">
                <div style="font-family: monospace; font-weight: 700; font-size: 14px;">${t.number}</div>
                <div style="font-size: 11px; color: #526477;">Date: ${t.issueDate}</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 12px;">
              <div>
                <strong>TO (RECIPIENT):</strong><br>
                ${t.recipient}<br>
                Attn: ${t.attn}
              </div>
              <div>
                <strong>FROM (ORIGINATOR):</strong><br>
                Project Flow Document Control<br>
                Sender: ${t.sender}
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #d8e1ea; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 16px;">
              <strong>PURPOSE OF ISSUE:</strong> ${t.purpose} | <strong>REQUIRED RESPONSE DUE:</strong> ${t.dueDate}
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="padding: 6px 8px; border: 1px solid #d8e1ea;">Doc Number</th>
                  <th style="padding: 6px 8px; border: 1px solid #d8e1ea;">Title</th>
                  <th style="padding: 6px 8px; border: 1px solid #d8e1ea;">Rev</th>
                  <th style="padding: 6px 8px; border: 1px solid #d8e1ea;">Checksum</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-family: monospace;">GLD-ENG-DWG-0014</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea;">Topsides Module M10 Structural Framing</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-weight: bold;">Rev 0</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-family: monospace;">e3b0c442...</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-family: monospace;">GLD-M10-PID-0021</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea;">P&ID High Pressure Separation Train A</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-weight: bold;">Rev C</td>
                  <td style="padding: 6px 8px; border: 1px solid #d8e1ea; font-family: monospace;">9f86d081...</td>
                </tr>
              </tbody>
            </table>

            <div style="font-size: 10.5px; color: #526477; border-top: 1px solid #d8e1ea; padding-top: 8px;">
              <strong>NOTICE:</strong> Transmitted files are immutable revisions with verification checksums. Electronic receipt must be acknowledged within 48 hours.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('trn-pdf-modal').remove()">Close Preview</button>
            <button class="btn btn-primary" onclick="ProjectFlowApp.showToast('Downloaded Transmittal PDF Manifest', 'success'); document.getElementById('trn-pdf-modal').remove();">Download PDF</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  openRespondCRSModal(crsId) {
    const crs = window.ProjectFlowData.crsComments.find(c => c.id === crsId);
    if (!crs) return;

    const responseText = prompt(`Enter contractor PIC response for [${crs.id}]:`, crs.contractorResponse || '');
    if (responseText !== null) {
      crs.contractorResponse = responseText;
      crs.status = 'Responded / Awaiting Signoff';
      ProjectFlowApp.showToast(`Updated CRS response for ${crs.id}`, 'success');
      DocumentsModule.render();
    }
  },

  filterDocs(q) {
    const val = q.toLowerCase();
    const rows = document.querySelectorAll('#mdr-table tbody tr');
    rows.forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
  },

  filterRegisterType(type) {
    const rows = document.querySelectorAll('#mdr-table tbody tr');
    rows.forEach(r => {
      if (type === 'ALL') {
        r.style.display = '';
      } else {
        r.style.display = r.innerText.includes(type) ? '' : 'none';
      }
    });
  },

  filterDiscipline(disc) {
    const rows = document.querySelectorAll('#mdr-table tbody tr');
    rows.forEach(r => {
      if (disc === 'ALL') {
        r.style.display = '';
      } else {
        r.style.display = r.innerText.includes(disc) ? '' : 'none';
      }
    });
  }
};

window.DocumentsModule = DocumentsModule;
