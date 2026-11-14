import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiMode, request, type ExpeditingSummary, type ModuleInfo, type WorkspaceId } from './api';
import { CutoffControl } from './CutoffControl';
import { fmtDate, initials } from './format';
import { Icon } from './icons';
import { defaultKey, kidsOf, landing, within } from './nav';
import { useAccess, useApp, usePrefs } from './state';
import { startMobileTables } from './mobileTables';
import { Btn, ErrorBoundary, Modal } from './ui';

const WS_ICON: Record<WorkspaceId, string> = { personal: 'user', epcic: 'building', governance: 'shield', reports: 'book' };
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

interface NavCtl { isOpen: (m: ModuleInfo, active: boolean) => boolean; toggle: (key: string, open: boolean) => void; rail: boolean }

/** One menu entry. An entry with submenus shows an arrow: right when closed, down when open. */
function NavNode({ m, depth, current, go, ctl }: { m: ModuleInfo; depth: number; current?: string; go: (key: string) => void; ctl: NavCtl }) {
  const { modules } = useApp();
  const active = within(modules.modules, current, m);
  const kids = kidsOf(modules.modules, m.key);
  const open = kids.length > 0 && ctl.isOpen(m, active);
  const cls = depth === 0 ? '' : depth === 1 ? 'sub' : 'sub sub2';
  const click = () => {
    // in the icon rail there is no submenu to open, so the entry just goes to its first page
    if (!kids.length || ctl.rail) return go(m.key);
    ctl.toggle(m.key, !open);
    if (!open && !active) go(m.key);
  };
  return (
    <>
      <button className={`nav-item ${cls} ${active ? 'active' : ''}`} aria-current={current === m.key ? 'page' : undefined} aria-expanded={kids.length ? open : undefined} title={m.label} onClick={click}>
        {depth === 0 && <Icon name={m.icon} />}
        <span className="nav-label">{m.label}</span>
        {kids.length > 0 && <span className={`nav-chev ${open ? 'open' : ''}`} aria-hidden="true"><Icon name="chevron-right" /></span>}
      </button>
      {open && kids.map(k => <NavNode key={k.key} m={k} depth={depth + 1} current={current} go={go} ctl={ctl} />)}
    </>
  );
}

function Sidebar({ current, open, close }: { current?: string; open: boolean; close: () => void }) {
  const { project, modules } = useApp();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mods = modules.modules;
  const ws = mods.find(m => m.key === current)?.workspace ?? prefs.workspace;
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  // arriving at a page opens the menus above it, even if they were closed by hand
  useEffect(() => {
    setOpenMap(map => {
      const next = { ...map };
      for (const m of mods) if (within(mods, current, m)) delete next[m.key];
      return next;
    });
  }, [current, mods]);
  const ctl: NavCtl = {
    isOpen: (m, active) => openMap[m.key] ?? active,
    toggle: (key, open) => setOpenMap(map => ({ ...map, [key]: open })),
    rail: prefs.navCollapsed,
  };

  const goModule = (key: string) => { navigate(`/m/${landing(mods, key)}`); close(); };
  const goWorkspace = (id: WorkspaceId) => {
    prefs.setWorkspace(id);
    const key = defaultKey(mods, id);
    navigate(key ? `/m/${key}` : '/');
    close();
  };

  const tops = mods.filter(m => m.workspace === ws && !m.parent && m.effective);
  let lastGroup: string | undefined;
  const items = tops.map(m => {
    const header = m.group && m.group !== lastGroup ? <div key={`g-${m.group}`} className="side-label">{m.group}</div> : null;
    lastGroup = m.group;
    return [header, <NavNode key={m.key} m={m} depth={0} current={current} go={goModule} ctl={ctl} />];
  });
  const wsLabel = modules.workspaces.find(w => w.id === ws)?.label;
  const noProject = !project.id;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar" aria-label="Main navigation">
      <div className="brand"><span className="brandmark" /><span className="brand-text">Project Flow</span></div>
      {!noProject && <div className="workspace-switch" role="tablist">
        {modules.workspaces.map(w => (
          <button key={w.id} className={`ws-tab ${ws === w.id ? 'active' : ''}`} role="tab" aria-selected={ws === w.id} title={w.label} aria-label={w.label} onClick={() => goWorkspace(w.id)}><Icon name={WS_ICON[w.id]} /><span className="ws-label">{w.label}</span></button>
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
        <button className={`nav-item ${pathname.startsWith('/settings') ? 'active' : ''}`} title="Settings" onClick={() => { navigate(noProject && apiMode === 'sheets' ? '/settings/projects' : '/settings/modules'); close(); }}><Icon name="gear" /><span className="nav-label">Settings</span></button>
      </div>
    </aside>
  );
}

function Header({ toggleMenu, menuOpen }: { toggleMenu: () => void; menuOpen: boolean }) {
  const { project, modules, me, projects, selectProject, signOut } = useApp();
  const prefs = usePrefs();
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const expediting = modules.modules.find(m => m.key === 'procurement.expediting.vendor-overview')?.effective;
  const summary = useQuery({ queryKey: ['expediting-summary', project.id], queryFn: () => request<ExpeditingSummary>(`/projects/${project.id}/expediting/summary`), enabled: !!expediting });
  const flags = summary.data ? summary.data.delayed + summary.data.atRisk : 0;

  return (
    <header id="header" className="topbar glass-top">
      <div className="project-switch">
        <button className="icon-btn nav-toggle" aria-controls="sidebar" aria-expanded={isDesktop() ? !prefs.navCollapsed : menuOpen}
          aria-label={prefs.navCollapsed ? 'Expand the navigation bar' : 'Collapse the navigation bar'} title={prefs.navCollapsed ? 'Expand the navigation bar' : 'Collapse the navigation bar'} onClick={toggleMenu}><Icon name="panel" /></button>
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
        <button className="icon-btn round" aria-label={prefs.dark ? 'Switch to light mode' : 'Switch to dark mode'} title={prefs.dark ? 'Light mode' : 'Dark mode'} onClick={() => prefs.setDark(!prefs.dark)}><Icon name={prefs.dark ? 'sun' : 'moon'} /></button>
        <button className="icon-btn round bell" aria-label="Notifications" onClick={() => setOpen(true)}><Icon name="bell" />{flags > 0 && <b className="bell-dot">{flags}</b>}</button>
        <div className="identity">
          <span className="avatar teal" title={me?.name ?? 'Project team'}>{initials(me?.name ?? 'Project Team')}</span>
          <div className="identity-text">
            <strong>{me?.name ?? 'Project team'}</strong>
            <span className="muted">{me ? `${me.isAdmin ? 'Administrator · ' : ''}${access.role ?? 'No project role'}` : expediting ? `${flags} open flags` : 'Demo user'}</span>
          </div>
          {me && <button className="icon-btn round" onClick={signOut} aria-label="Switch user" title="Switch user (sign out)"><Icon name="switch" /></button>}
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
  const prefs = usePrefs();
  useEffect(() => { const main = document.getElementById('main'); return main ? startMobileTables(main) : undefined; }, []);
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
      <div className="workspace lintel">
        <Header toggleMenu={() => (isDesktop() ? prefs.setNavCollapsed(!prefs.navCollapsed) : setMenu(m => !m))} menuOpen={menu} />
        <main id="main" tabIndex={-1}><div className="fade" key={pathname}><NotMember /><SnapshotBanner /><ErrorBoundary><Outlet /></ErrorBoundary></div></main>
      </div>
    </>
  );
}
