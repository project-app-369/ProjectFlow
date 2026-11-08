import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiMode, request, type ExpeditingSummary, type ModuleInfo, type WorkspaceId } from './api';
import { CutoffControl } from './CutoffControl';
import { fmtDate, initials } from './format';
import { Icon } from './icons';
import { defaultKey, kidsOf, landing, within } from './nav';
import { useAccess, useApp, usePrefs } from './state';
import { Btn, ErrorBoundary, Modal } from './ui';

function NavNode({ m, depth, current, go }: { m: ModuleInfo; depth: number; current?: string; go: (key: string) => void }) {
  const { modules } = useApp();
  const active = within(modules.modules, current, m);
  const kids = kidsOf(modules.modules, m.key);
  const cls = depth === 0 ? '' : depth === 1 ? 'sub' : 'sub sub2';
  return (
    <>
      <button className={`nav-item ${cls} ${active ? 'active' : ''}`} aria-current={current === m.key ? 'page' : undefined} onClick={() => go(m.key)}>
        {depth === 0 && <Icon name={m.icon} />}{m.label}
      </button>
      {active && kids.map(k => <NavNode key={k.key} m={k} depth={depth + 1} current={current} go={go} />)}
    </>
  );
}

function Sidebar({ current, open, close }: { current?: string; open: boolean; close: () => void }) {
  const { project, modules } = useApp();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mods = modules.modules;

  const goModule = (key: string) => { navigate(`/m/${landing(mods, key)}`); close(); };
  const goWorkspace = (id: WorkspaceId) => {
    prefs.setWorkspace(id);
    const key = defaultKey(mods, id);
    navigate(key ? `/m/${key}` : '/');
    close();
  };

  const tops = mods.filter(m => m.workspace === prefs.workspace && !m.parent && m.effective);
  let lastGroup: string | undefined;
  const items = tops.map(m => {
    const header = m.group && m.group !== lastGroup ? <div key={`g-${m.group}`} className="side-label">{m.group}</div> : null;
    lastGroup = m.group;
    return [header, <NavNode key={m.key} m={m} depth={0} current={current} go={goModule} />];
  });
  const wsLabel = modules.workspaces.find(w => w.id === prefs.workspace)?.label;
  const noProject = !project.id;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar" aria-label="Main navigation">
      <div className="brand"><span className="brandmark" />Project Flow</div>
      {!noProject && <div className="workspace-switch" role="tablist">
        {modules.workspaces.map(w => (
          <button key={w.id} className={`ws-tab ${prefs.workspace === w.id ? 'active' : ''}`} role="tab" aria-selected={prefs.workspace === w.id} onClick={() => goWorkspace(w.id)}>{w.label}</button>
        ))}
      </div>}
      <nav className="side-nav" aria-label={`${wsLabel} modules`}>
        {noProject ? <div className="tiny muted" style={{ padding: 14 }}>No project selected. Choose or create one in Settings.</div> : items.length ? items : (
          <div className="tiny muted" style={{ padding: 14 }}>
            No {wsLabel} modules enabled. <button className="btn text" onClick={() => { navigate('/settings/modules'); close(); }}>Open module settings</button>
          </div>
        )}
      </nav>
      <div className="side-bottom">
        <button className={`nav-item ${pathname.startsWith('/settings') ? 'active' : ''}`} onClick={() => { navigate(noProject && apiMode === 'sheets' ? '/settings/projects' : '/settings/modules'); close(); }}><Icon name="gear" />Settings</button>
      </div>
    </aside>
  );
}

function Header({ toggleMenu, menuOpen }: { toggleMenu: () => void; menuOpen: boolean }) {
  const { project, modules, me, projects, selectProject, signOut } = useApp();
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const expediting = modules.modules.find(m => m.key === 'procurement.expediting.vendor-overview')?.effective;
  const summary = useQuery({ queryKey: ['expediting-summary', project.id], queryFn: () => request<ExpeditingSummary>(`/projects/${project.id}/expediting/summary`), enabled: !!expediting });
  const flags = summary.data ? summary.data.delayed + summary.data.atRisk : 0;

  return (
    <header id="header" className="topbar">
      <div className="project-switch">
        <button className="icon-btn mobile-menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded={menuOpen} onClick={toggleMenu}><Icon name="menu" /></button>
        <span className="mini-icon"><Icon name="brief" /></span>
        <div>
          <div className="tiny muted" style={{ paddingLeft: 4 }}>PROJECT{project.lifecycle && project.lifecycle !== 'Active' ? ` · ${project.lifecycle.toUpperCase()}` : ''}</div>
          {projects.length > 1 || (projects.length === 1 && !project.id) ? (
            <select aria-label="Select project" value={project.id} onChange={e => selectProject(e.target.value)}>
              {!project.id && <option value="">Select a project…</option>}
              {projects.map(p => <option key={p.id} value={p.id} title={p.name}>{p.shortName || p.code}</option>)}
            </select>
          ) : <strong style={{ paddingLeft: 4 }} title={project.name}>{project.shortName || project.code}</strong>}
        </div>
      </div>
      <CutoffControl />
      <div className="top-actions">
        <span className="tag">{apiMode === 'sheets' ? 'PRE-BUILD · SHEETS' : 'DEMO WORKSPACE'}</span>
        <button className="icon-btn bell" aria-label="Notifications" onClick={() => setOpen(true)}><Icon name="bell" /></button>
        <div className="identity">
          <span className="avatar teal" title={me?.name ?? 'Project team'}>{initials(me?.name ?? 'Project Team')}</span>
          <div className="identity-text">
            <strong>{me?.name ?? 'Project team'}</strong>
            <span className="muted">{me ? `${me.isAdmin ? 'Administrator · ' : ''}${access.role ?? 'No project role'}` : expediting ? `${flags} open flags` : 'Demo user'}</span>
          </div>
          {me && <button className="btn text" onClick={signOut} title="Choose another user">Switch</button>}
        </div>
      </div>
      {open && (
        <Modal title="Notification center" onClose={() => setOpen(false)} actions={<Btn onClick={() => setOpen(false)}>Close</Btn>}>
          <div className="dialog-body">
            {summary.data?.flags.length
              ? summary.data.flags.map(f => <div key={f.id} className="timeline-event"><strong>{f.name || f.code}</strong><small>{f.vendor || f.code} · {f.status}</small></div>)
              : <p>No open flags.</p>}
          </div>
        </Modal>
      )}
    </header>
  );
}

/** An administrator can configure any project but sees its business data only as a member (spec 2.1). */
/** Shown over project data while a saved cut-off report is open instead of the current data. */
function SnapshotBanner() {
  const { asOf, setAsOf } = useApp();
  const { pathname } = useLocation();
  const personal = pathname.startsWith('/m/task-management') || pathname.startsWith('/m/my-workspace');
  if (!asOf || !pathname.startsWith('/m/') || personal) return null;
  return (
    <div className="banner snapshot-banner" role="status">
      Viewing the saved cut-off report of <strong>{fmtDate(asOf)}</strong>. It is read-only.{' '}
      <button className="btn text" onClick={() => setAsOf(null)}>Back to current data</button>
    </div>
  );
}

function NotMember() {
  const { project, me } = useApp();
  const { pathname } = useLocation();
  if (!me || !project.id || project.myRole || pathname.startsWith('/settings')) return null;
  return <div className="banner">You are not a member of {project.name}. Add yourself under Settings → Projects → Members to see its data.</div>;
}

export function Layout() {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  const { pathname } = useLocation();
  const current = pathname.startsWith('/m/') ? decodeURIComponent(pathname.slice(3)) : undefined;
  return (
    <>
      <Sidebar current={current} open={menu} close={() => setMenu(false)} />
      {menu && <div className="scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
      <div className="workspace">
        <Header toggleMenu={() => setMenu(m => !m)} menuOpen={menu} />
        <main id="main" tabIndex={-1}><div className="fade" key={pathname}><NotMember /><SnapshotBanner /><ErrorBoundary><Outlet /></ErrorBoundary></div></main>
        <footer>Project Flow <span>{apiMode === 'sheets' ? 'v0.2 · Google Sheets pre-build · STTP2B reference data' : 'v0.1 · NestJS API · PostgreSQL · STTP2B reference data'}</span></footer>
      </div>
    </>
  );
}
