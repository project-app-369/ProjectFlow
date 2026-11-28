import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { apiMode, errorText, request, type ModuleInfo, type OperationState, type WorkspaceId } from '../api';
import { Icon } from '../icons';
import { fmtDate } from '../format';
import { pathOf, topModules } from '../nav';
import { CrumbContext, useAccess, useApp, usePrefs, useToast } from '../state';
import { InstallButton, useInstall } from '../pwa';
import { Badge, Btn, Breadcrumb, PageHead } from '../ui';
import ProjectsTab from './SettingsProjects';
import UsersTab from './SettingsUsers';
import AccessTab from './SettingsAccess';
import ProjectAccessTab from './SettingsProjectAccess';
import AccessLogTab from './SettingsAccessLog';

type TabId = 'projects' | 'users' | 'access' | 'project-access' | 'log' | 'modules' | 'general' | 'data';
const ALL_TABS: [TabId, string][] = [['projects', 'Projects'], ['users', 'Users'], ['access', 'Party access'], ['project-access', 'Project access'], ['log', 'Access log'], ['modules', 'Modules'], ['general', 'General'], ['data', 'Data sources']];
const isOn = (s: OperationState) => s === 'Enabled' || s === 'Pilot' || s === 'Locked' || s === 'Read-only';

export default function Settings() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { project, me } = useApp();
  // Keep admin sections discoverable while guarding their contents for other roles.
  const TABS = ALL_TABS.filter(([id]) => id !== 'projects' || !!me);
  const current = TABS.find(([id]) => id === tab);
  if (!current) return <Navigate to={`/settings/${me ? 'projects' : 'modules'}`} replace />;
  const needsProject = (tab === 'modules' || tab === 'data' || tab === 'project-access') && !project.id;
  const adminOnly = (tab === 'users' || tab === 'access') && !me?.isAdmin;

  return (
    <CrumbContext.Provider value={['Settings', current[1]]}>
      <PageHead title="Settings" desc={me ? 'Choose your project, manage projects and users, turn modules on or off, and set your display preferences.' : 'Turn modules on or off, set your display preferences, and see where the data comes from.'} />
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} role="tab" aria-selected={tab === id} title={(id === 'users' || id === 'access') && !me?.isAdmin ? 'Administrator access' : undefined} onClick={() => navigate(`/settings/${id}`)}>{label}{(id === 'users' || id === 'access') && !me?.isAdmin ? <Icon name="shield" /> : null}</button>
        ))}
      </div>
      {adminOnly ? <div className="panel empty">This section is available to administrators.{apiMode === 'sheets' ? ' Select Admin (demo) from the profile menu to review it.' : ''}</div>
        : needsProject ? <div className="panel empty">Select a project first. <Btn kind="small" onClick={() => navigate('/settings/projects')}>Open projects</Btn></div>
        : tab === 'projects' ? <ProjectsTab /> : tab === 'users' ? <UsersTab /> : tab === 'access' ? <AccessTab /> : tab === 'project-access' ? <ProjectAccessTab /> : tab === 'log' ? <AccessLogTab /> : tab === 'modules' ? <ModulesTab /> : tab === 'general' ? <GeneralTab /> : <DataTab />}
    </CrumbContext.Provider>
  );
}

function ModulesTab() {
  const { project, modules } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const prefs = usePrefs();
  const access = useAccess();
  const [ws, setWs] = useState<WorkspaceId>(prefs.workspace);

  const change = useMutation({
    mutationFn: ({ key, state }: { key: string; state: OperationState }) => request<ModuleInfo>(`/projects/${project.id}/modules/${key}`, { method: 'PUT', body: JSON.stringify({ state }) }),
    onSuccess: (m) => qc.invalidateQueries({ queryKey: ['modules', project.id] }).then(() =>
      toast(m.sheetsCreated?.length ? `Modules updated. Records set up: ${m.sheetsCreated.map(s => s.name).join(', ')}` : 'Modules updated.')),
    onError: (e: Error) => toast(errorText(e)),
  });

  const byKey = new Map(modules.modules.map(m => [m.key, m]));
  const wsModules = modules.modules.filter(m => m.workspace === ws);
  const count = (id: WorkspaceId) => {
    const all = modules.modules.filter(m => m.workspace === id);
    return `${all.filter(m => isOn(m.state)).length}/${all.length}`;
  };
  const tone = { Available: 'green', 'In development': 'amber', Planned: 'indigo' } as const;

  return (
    <>
      <p className="page-sub">
        Enable or disable each module and submodule. A disabled module hides its submodules and rejects data requests; later-phase modules can be switched on
        early and show a placeholder until they ship.{!access.canConfigure && ' Only an administrator or the Project Manager can change modules.'}
      </p>
      <div className="actions mb-4">
        {modules.workspaces.map(w => (
          <Btn key={w.id} kind={w.id === ws ? 'primary' : ''} onClick={() => setWs(w.id)}>{w.label} <span className="tiny">{count(w.id)}</span></Btn>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head"><div><h2>{modules.workspaces.find(w => w.id === ws)?.label} workspace</h2><p>{topModules(modules.modules, ws).length} modules</p></div></div>
        {wsModules.map(m => {
          const parentOn = !m.parent || !!byKey.get(m.parent)?.effective;
          return (
            <div key={m.key} className={`setting-row ${parentOn ? '' : 'is-off'}`} style={{ paddingLeft: `calc(var(--card-px) + ${m.depth} * var(--sp-6))` }}>
              <div>
                <Breadcrumb parts={pathOf(modules, m.key)} />
                <small>
                  {m.description && <>{m.description} </>}
                  <Badge tone={tone[m.availability]}>{m.availability}</Badge> <Badge tone="indigo">{m.phase}</Badge>
                  {m.core && ' · core, always on'}
                  
                  {!['Enabled', 'Disabled'].includes(m.state) && ` · ${m.state}`}
                </small>
              </div>
              <input
                className="switch" type="checkbox" checked={isOn(m.state)} disabled={m.core || !parentOn || change.isPending || !access.canConfigure}
                aria-label={pathOf(modules, m.key).join(' / ')}
                onChange={e => change.mutate({ key: m.key, state: e.target.checked ? 'Enabled' : 'Disabled' })}
              />
            </div>
          );
        })}
      </section>
    </>
  );
}

function GeneralTab() {
  const prefs = usePrefs();
  const { modules } = useApp();
  const install = useInstall();
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head"><h2>Display</h2></div>
        <div className="setting-row"><div><strong>Dark appearance</strong><small>Saved in this browser.</small></div>
          <input className="switch" type="checkbox" checked={prefs.dark} onChange={e => prefs.setDark(e.target.checked)} aria-label="Dark appearance" /></div>
        <div className="setting-row"><div><strong>Default workspace</strong><small>The workspace shown when the app opens.</small></div>
          <select className="filter" value={prefs.workspace} onChange={e => prefs.setWorkspace(e.target.value as WorkspaceId)} aria-label="Default workspace">
            {modules.workspaces.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select></div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>App</h2></div>
        <div className="setting-row">
          <div>
            <strong>Install Project Flow</strong>
            <small>{install.state === 'installed' ? 'Installed: you are using the app.' : install.state === 'unavailable' ? 'Your browser does not offer installing from here. In Chrome or Edge use the install icon in the address bar.' : 'Opens in its own window with its own icon, and starts faster.'}</small>
          </div>
          {install.state === 'installed' ? <Badge tone="green">Installed</Badge> : <InstallButton labelled />}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Reset</h2></div>
        <div className="setting-row"><div><strong>Reset display preferences</strong><small>Module states are project settings and are not affected.</small></div><Btn kind="small" onClick={prefs.reset}>Reset</Btn></div>
      </section>
    </div>
  );
}

function DataTab() {
  const { project } = useApp();
  const health = useQuery({ queryKey: ['health'], queryFn: () => request<{ status: string; database: string }>('/health') });
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>Data sources</h2></div>
        <div className="panel-body">
          <p className="tiny muted">{apiMode === 'sheets'
            ? 'The app reads and writes Supabase (PostgreSQL) through the Project Flow edge function. Reference data was loaded once from the project workbooks in /data; after that Supabase is the source of truth.'
            : 'Reference data was extracted once from the project workbooks in /data and loaded into the database. The API serves it read-only; nothing writes back to the source files.'}</p>
          <div className="detail-grid">
            <div><small>Project</small><strong>{project.name}</strong></div>
            <div><small>Contract</small><strong>{project.contract}</strong></div>
            <div><small>Schedule source</small><strong>Procurement Plan workbook · S-CURVES (M), Progress Table (W)</strong></div>
            <div><small>Procurement source</small><strong>Expediting Report · pgk_gen_info</strong></div>
            <div><small>Expediting source</small><strong>Expediting Report · Equipment / Structural / Pipe-Fitting / Valves / Misc summaries</strong></div>
            <div><small>Cut-off date</small><strong>{fmtDate(project.cutoff)}</strong></div>
            <div><small>API status</small><strong>{health.data ? `${health.data.status} · ${health.data.database === 'supabase' ? 'Supabase (PostgreSQL)' : health.data.database === 'memory' ? 'local simulator (in memory)' : health.data.database === 'pglite' ? 'embedded PGlite' : 'PostgreSQL'}` : '…'}</strong></div>
          </div>
        </div>
      </section>
    </>
  );
}
