/**
 * ProjectFlow - Tasks & PIC Coordination Module (v3_gemini)
 * §6.7 TASK-01..12: My Workspace vs Project Tasks, Private Tasks, PIC Synchronization
 */

const TasksModule = {
  activeTab: 'my-workspace', // 'my-workspace' | 'project-tasks' | 'kanban' | 'workload'

  render() {
    const data = window.ProjectFlowData;
    const project = data.projects.find(p => p.id === data.state.currentProjectId);
    const currentUser = data.users.find(u => u.id === data.state.currentPersonaId);

    const container = document.getElementById('view-tasks');
    if (!container) return;

    // Filter tasks
    const allProjectTasks = data.tasks.filter(t => t.projectId === project.id);
    const assignedToMe = allProjectTasks.filter(t => t.pic === currentUser.name);
    const privateTasks = data.privateTasks.filter(pt => pt.ownerId === currentUser.id);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1 class="view-title">Task & Action Workspaces</h1>
          <p class="view-description">
            Canonical PIC tasks linked to source reviews, expediting concerns, risks, and punch verifications, plus private personal organizer.
          </p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="TasksModule.openNewPrivateTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            + Private Task
          </button>
          <button class="btn btn-primary btn-sm" onclick="TasksModule.openNewProjectTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            + Project Task
          </button>
        </div>
      </div>

      <!-- Navigation Tabs (TASK-01, TASK-04) -->
      <div class="inspector-tabs" style="background: var(--pf-surface); border-radius: var(--pf-radius-md); padding: 0 8px; border: 1px solid var(--pf-border);">
        <div class="inspector-tab ${this.activeTab === 'my-workspace' ? 'active' : ''}" onclick="TasksModule.switchTab('my-workspace')">
          👤 My Workspace & Private (${assignedToMe.length + privateTasks.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'project-tasks' ? 'active' : ''}" onclick="TasksModule.switchTab('project-tasks')">
          📋 Project Tasks Register (${allProjectTasks.length})
        </div>
        <div class="inspector-tab ${this.activeTab === 'kanban' ? 'active' : ''}" onclick="TasksModule.switchTab('kanban')">
          📊 Kanban Board
        </div>
        <div class="inspector-tab ${this.activeTab === 'workload' ? 'active' : ''}" onclick="TasksModule.switchTab('workload')">
          👥 Workload by Assignee
        </div>
      </div>

      <!-- Dynamic Sub-view Render -->
      <div id="tasks-content-area">
        ${this.renderSubTabContent(currentUser, project, assignedToMe, privateTasks, allProjectTasks)}
      </div>
    `;
  },

  switchTab(tabKey) {
    this.activeTab = tabKey;
    this.render();
  },

  renderSubTabContent(currentUser, project, assignedToMe, privateTasks, allProjectTasks) {
    if (this.activeTab === 'my-workspace') {
      return this.renderMyWorkspace(currentUser, assignedToMe, privateTasks);
    } else if (this.activeTab === 'project-tasks') {
      return this.renderProjectTasksTable(allProjectTasks);
    } else if (this.activeTab === 'kanban') {
      return this.renderKanbanBoard(allProjectTasks);
    } else if (this.activeTab === 'workload') {
      return this.renderWorkload(allProjectTasks);
    }
  },

  // §6.7 TASK-01..03 My Workspace & Private Organizer
  renderMyWorkspace(currentUser, assignedToMe, privateTasks) {
    return `
      <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: start;">
        
        <!-- Assigned To Me (Canonical Tasks) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Assigned to Me (${currentUser.name})
            </h3>
            <span class="badge badge-brand">${assignedToMe.length} Canonical Tasks</span>
          </div>
          <div class="card-body" style="padding: 0;">
            ${assignedToMe.length === 0 ? `
              <div style="padding: 32px; text-align: center; color: var(--pf-text-secondary);">
                No actions currently assigned to you in ${window.ProjectFlowData.state.currentProjectId}.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column;">
                ${assignedToMe.map(t => `
                  <div style="padding: 14px 18px; border-bottom: 1px solid var(--pf-border-subtle); display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="ProjectFlowApp.openInspector('task', '${t.id}')">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${t.priority === 'Urgent' ? 'badge-critical' : 'badge-warning'}">${t.priority}</span>
                        <strong style="font-size: 13.5px;">${t.title}</strong>
                      </div>
                      <div style="font-size: 11.5px; color: var(--pf-text-secondary);">
                        Source: <span class="badge badge-neutral">${t.sourceModule} (${t.sourceId})</span> • Due: <strong>${t.dueDate}</strong> • Assigned by ${t.assignedBy}
                      </div>
                    </div>
                    <span class="badge badge-info">${t.status}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Private Personal Tasks (§6.7 TASK-02 & TASK-03) -->
        <div class="card" style="border: 1px solid rgba(52, 60, 120, 0.3);">
          <div class="card-header" style="background-color: var(--pf-brand-subtle);">
            <div>
              <h3 class="card-title" style="color: var(--pf-brand);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Private Personal Organizer
              </h3>
              <span class="card-subtitle">Confidential to you. Excluded from PM reports & analytics (TASK-02).</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="TasksModule.openNewPrivateTaskModal()">+ Add</button>
          </div>
          <div class="card-body" style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
            ${privateTasks.length === 0 ? `
              <div style="padding: 24px; text-align: center; color: var(--pf-text-secondary);">
                Your private list is empty. Add personal notes or checklists.
              </div>
            ` : `
              ${privateTasks.map(pt => `
                <div style="background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                    <div>
                      <span class="badge ${pt.priority === 'Urgent' ? 'badge-critical' : 'badge-neutral'}" style="font-size: 10px;">${pt.priority}</span>
                      <strong style="font-size: 13px; display: block; margin-top: 4px;">${pt.title}</strong>
                    </div>
                    <button class="btn btn-outline-brand btn-sm" onclick="TasksModule.openConvertModal('${pt.id}')" title="Convert to Canonical Project Task (TASK-03)">
                      Convert ↗
                    </button>
                  </div>
                  <p style="font-size: 12px; color: var(--pf-text-secondary);">${pt.notes}</p>
                  ${pt.checklist.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; border-top: 1px dashed var(--pf-border-subtle); padding-top: 6px;">
                      ${pt.checklist.map(ci => `
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                          <input type="checkbox" ${ci.done ? 'checked' : ''} onchange="TasksModule.toggleChecklist('${pt.id}', '${ci.text}')">
                          <span style="${ci.done ? 'text-decoration: line-through; color: var(--pf-text-muted);' : ''}">${ci.text}</span>
                        </label>
                      `).join('')}
                    </div>
                  ` : ''}
                  <div style="font-size: 11px; color: var(--pf-text-muted); text-align: right;">Due: ${pt.dueDate}</div>
                </div>
              `).join('')}
            `}
          </div>
        </div>

      </div>
    `;
  },

  // §6.7 TASK-04 Project Tasks Table View
  renderProjectTasksTable(tasks) {
    return `
      <div class="register-container">
        <div class="register-toolbar">
          <div class="toolbar-left">
            <div class="search-input-wrapper">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" class="search-input" placeholder="Search tasks, PIC, code..." onkeyup="TasksModule.filterTable(this.value)">
            </div>
            <select class="filter-select" onchange="TasksModule.filterPriority(this.value)">
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
            </select>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-secondary btn-sm" onclick="ProjectFlowApp.exportCSV('tasks')">Export CSV</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table" id="tasks-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Task Title</th>
                <th>Source Module</th>
                <th>PIC (Person in Charge)</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(t => `
                <tr onclick="ProjectFlowApp.openInspector('task', '${t.id}')">
                  <td class="code-col">${t.code}</td>
                  <td>
                    <div style="font-weight: 600;">${t.title}</div>
                    <div style="font-size: 11px; color: var(--pf-text-secondary);">${t.description.substring(0, 75)}...</div>
                  </td>
                  <td>
                    <span class="badge badge-brand">${t.sourceModule}</span>
                    <span style="font-size: 11px; color: var(--pf-text-muted);">#${t.sourceId}</span>
                  </td>
                  <td>
                    <span style="font-weight: 600;">${t.pic}</span>
                  </td>
                  <td>
                    <span class="badge ${t.priority === 'Urgent' ? 'badge-critical' : (t.priority === 'High' ? 'badge-warning' : 'badge-neutral')}">${t.priority}</span>
                  </td>
                  <td class="tabular-nums" style="font-size: 12px;">${t.dueDate}</td>
                  <td>
                    <span class="badge badge-info">${t.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // §6.7 TASK-04 Kanban Board View
  renderKanbanBoard(tasks) {
    const columns = [
      { id: 'Assigned', title: 'Assigned', count: 0 },
      { id: 'In progress', title: 'In Progress', count: 0 },
      { id: 'Submitted for review', title: 'Under Review', count: 0 },
      { id: 'Completed', title: 'Verified / Closed', count: 0 }
    ];

    return `
      <div class="kanban-board">
        ${columns.map(col => {
          const colTasks = tasks.filter(t => {
            if (col.id === 'Completed') return t.status === 'Completed' || t.status === 'Closed';
            return t.status === col.id;
          });

          return `
            <div class="kanban-col">
              <div class="kanban-col-header">
                <span class="kanban-col-title">${col.title}</span>
                <span class="badge-count">${colTasks.length}</span>
              </div>
              <div class="kanban-cards-wrapper">
                ${colTasks.map(t => `
                  <div class="kanban-card" onclick="ProjectFlowApp.openInspector('task', '${t.id}')">
                    <div class="kanban-card-header">
                      <span class="code-col" style="font-size: 11px;">${t.code}</span>
                      <span class="badge ${t.priority === 'Urgent' ? 'badge-critical' : 'badge-warning'}" style="font-size: 10px;">${t.priority}</span>
                    </div>
                    <div class="kanban-card-title">${t.title}</div>
                    <div class="kanban-card-meta">
                      <span>PIC: <strong>${t.pic.split(' ')[0]}</strong></span>
                      <span class="tabular-nums">📅 ${t.dueDate.substring(5)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // §6.7 TASK-12 Workload by Assignee
  renderWorkload(tasks) {
    const data = window.ProjectFlowData;
    const projectUsers = data.users.filter(u => !u.isClient);

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">PIC Workload & Capacity Analysis</h3>
            <span class="card-subtitle">Excludes private personal tasks per TASK-02. Based on 40h weekly calendar.</span>
          </div>
        </div>
        <div class="card-body">
          <div style="display: flex; flex-direction: column; gap: 18px;">
            ${projectUsers.map(u => {
              const uTasks = tasks.filter(t => t.pic === u.name && t.status !== 'Closed');
              const totalHours = uTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
              const percent = Math.min(100, Math.round((totalHours / 40) * 100));

              return `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13.5px;">
                    <div>
                      <strong>${u.name}</strong> 
                      <span style="font-size: 11.5px; color: var(--pf-text-secondary); margin-left: 6px;">${u.projectRole}</span>
                    </div>
                    <div>
                      <span class="badge ${percent > 85 ? 'badge-critical' : 'badge-brand'}">${uTasks.length} active tasks • ${totalHours}h estimated</span>
                    </div>
                  </div>
                  <div class="progress-track" style="height: 8px;">
                    <div class="progress-fill ${percent > 85 ? 'overrun' : ''}" style="width: ${percent}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // Modal: Convert Private Task to Project Task (§6.7 TASK-03)
  openConvertModal(privateTaskId) {
    const pvt = window.ProjectFlowData.privateTasks.find(p => p.id === privateTaskId);
    if (!pvt) return;

    const modalHTML = `
      <div class="modal-backdrop active" id="convert-task-modal">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Convert Private Task to Project Task (TASK-03)</h3>
            <button class="btn btn-icon" onclick="document.getElementById('convert-task-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background-color: var(--pf-info-bg); border: 1px solid var(--pf-info-border); border-radius: var(--pf-radius-md); padding: 12px; font-size: 12.5px; color: var(--pf-info);">
              <strong>Governed Audit Rule:</strong> Conversion creates a canonical project task. Private notes and checklists are NOT shared by default unless explicitly checked.
            </div>

            <div class="form-group">
              <label class="form-label">Project Task Title</label>
              <input type="text" id="convert-title" value="${pvt.title}">
            </div>

            <div class="form-group">
              <label class="form-label">Destination Work Package</label>
              <select id="convert-wp">
                ${window.ProjectFlowData.workPackages.map(wp => `
                  <option value="${wp.id}">${wp.code} - ${wp.title}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Assignee / PIC</label>
              <select id="convert-pic">
                ${window.ProjectFlowData.users.filter(u => !u.isClient).map(u => `
                  <option value="${u.name}">${u.name} (${u.role})</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="convert-priority">
                <option value="Urgent" ${pvt.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
                <option value="High" ${pvt.priority === 'High' ? 'selected' : ''}>High</option>
                <option value="Normal" ${pvt.priority === 'Normal' ? 'selected' : ''}>Normal</option>
              </select>
            </div>

            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                <input type="checkbox" id="convert-share-notes" checked>
                <span>Include private notes in project description</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('convert-task-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="TasksModule.executeConversion('${pvt.id}')">Publish to Project</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  executeConversion(privateTaskId) {
    const data = window.ProjectFlowData;
    const pvtIndex = data.privateTasks.findIndex(p => p.id === privateTaskId);
    if (pvtIndex === -1) return;
    const pvt = data.privateTasks[pvtIndex];

    const title = document.getElementById('convert-title').value;
    const pic = document.getElementById('convert-pic').value;
    const priority = document.getElementById('convert-priority').value;
    const shareNotes = document.getElementById('convert-share-notes').checked;

    const newCode = 'TSK-0' + (data.tasks.length + 25);
    const newId = 'TSK-084-0' + (data.tasks.length + 25);

    const newTask = {
      id: newId,
      code: newCode,
      title: title,
      projectId: data.state.currentProjectId,
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Personal Organizer',
      sourceEntity: 'Converted Task',
      sourceId: pvt.id,
      pic: pic,
      assignedBy: data.users.find(u => u.id === data.state.currentPersonaId).name,
      priority: priority,
      status: 'Assigned',
      dueDate: pvt.dueDate,
      estimatedHours: 4,
      actualHours: 0,
      isPrivate: false,
      isClientVisible: false,
      description: shareNotes ? pvt.notes : 'Task converted from personal organizer.'
    };

    data.tasks.push(newTask);
    // Remove private task after conversion
    data.privateTasks.splice(pvtIndex, 1);

    document.getElementById('convert-task-modal').remove();
    ProjectFlowApp.showToast(`Converted to Canonical Project Task ${newCode}`, 'success');
    TasksModule.render();
  },

  openNewPrivateTaskModal() {
    const title = prompt('Enter Private Task Title:');
    if (!title) return;
    const newTask = {
      id: 'PVT-00' + (window.ProjectFlowData.privateTasks.length + 4),
      title: title,
      ownerId: window.ProjectFlowData.state.currentPersonaId,
      priority: 'Normal',
      dueDate: '2026-11-18',
      isCompleted: false,
      notes: 'Private personal reminder.',
      checklist: []
    };
    window.ProjectFlowData.privateTasks.push(newTask);
    ProjectFlowApp.showToast('Private task created', 'info');
    TasksModule.render();
  },

  openNewProjectTaskModal() {
    const title = prompt('Enter Project Task Title:');
    if (!title) return;
    const data = window.ProjectFlowData;
    const newCode = 'TSK-0' + (data.tasks.length + 26);
    const newTask = {
      id: 'TSK-084-0' + (data.tasks.length + 26),
      code: newCode,
      title: title,
      projectId: data.state.currentProjectId,
      projectName: 'Golden Ray Topsides',
      sourceModule: 'Manual Entry',
      sourceEntity: 'Project Task',
      sourceId: newCode,
      pic: 'Sarah Jenkins',
      assignedBy: 'Sarah Jenkins',
      priority: 'Normal',
      status: 'Assigned',
      dueDate: '2026-11-20',
      estimatedHours: 4,
      actualHours: 0,
      isPrivate: false,
      isClientVisible: true,
      description: 'Newly created project task.'
    };
    data.tasks.push(newTask);
    ProjectFlowApp.showToast(`Project Task ${newCode} created`, 'success');
    TasksModule.render();
  },

  toggleChecklist(pvtId, itemText) {
    const pvt = window.ProjectFlowData.privateTasks.find(p => p.id === pvtId);
    if (!pvt) return;
    const item = pvt.checklist.find(i => i.text === itemText);
    if (item) item.done = !item.done;
    TasksModule.render();
  },

  filterTable(query) {
    const q = query.toLowerCase();
    const rows = document.querySelectorAll('#tasks-table tbody tr');
    rows.forEach(r => {
      const text = r.innerText.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  },

  filterPriority(priority) {
    const rows = document.querySelectorAll('#tasks-table tbody tr');
    rows.forEach(r => {
      if (priority === 'ALL') {
        r.style.display = '';
      } else {
        const text = r.innerText;
        r.style.display = text.includes(priority) ? '' : 'none';
      }
    });
  }
};

window.TasksModule = TasksModule;
