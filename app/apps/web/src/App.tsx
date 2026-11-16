import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiMode, getUserId, request, requestBatch, setCurrentAsOf, setUserId, type DirectoryUser, type Me, type ModulesResponse, type Project } from './api';
import { Layout } from './Layout';
import { defaultKey, landing, pathOf, SHEETS_KEYS } from './nav';
import Dashboard from './pages/Dashboard';
import Expediting from './pages/Expediting';
import { InterfaceMatrixPage, InterfacePointsPage, InterfaceRegister } from './pages/Interfaces';
import ConstructionBudget from './pages/ConstructionBudget';
import Knowledge from './pages/Knowledge';
import Milestones from './pages/Milestones';
import Placeholder from './pages/Placeholder';
import Concerns from './pages/Concerns';
import Logistics from './pages/Logistics';
import Materials from './pages/Materials';
import Procurement from './pages/Procurement';
import ProcurementDashboard from './pages/ProcurementDashboard';
import Issues from './pages/Issues';
import Risks from './pages/Risks';
import { ProgressOverall, WorkPackages } from './pages/Schedule';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import TaskCalendar from './pages/tasks/TaskCalendar';
import TaskManagement from './pages/tasks/TaskManagement';
import Profile from './pages/Profile';
import { FacilityProgressPage, FacilitySchedulePage } from './pages/Facilities';
import TaskWorkload from './pages/tasks/TaskWorkload';
import { AppDataProvider, CrumbContext, NO_PROJECT, SheetContext, useApp, usePrefs } from './state';
import { ErrorBox, Loading, PageHead } from './ui';

const PAGES: Record<string, () => ReactNode> = {
  dashboard: () => <Dashboard />,
  'task-management.board': () => (apiMode === 'sheets' ? <TaskManagement /> : <Tasks />),
  'task-management.calendar': () => <TaskCalendar />,
  'task-management.workload': () => <TaskWorkload />,
  'planning.overall-progress': () => <ProgressOverall />,
  'planning.schedule': () => <FacilitySchedulePage />,
  'planning.progress': () => <FacilityProgressPage />,
  'planning.work-packages': () => <WorkPackages />,
  'planning.milestones': () => <Milestones />,
  'procurement.dashboard': () => <ProcurementDashboard />,
  'procurement.concerns': () => <Concerns />,
  'procurement.logistics': () => <Logistics />,
  'procurement.materials': () => <Materials />,
  'procurement.procurement-plan': () => <Procurement />,
  'procurement.expediting.vendor-overview': () => <Expediting />,
  'construction.budget': () => <ConstructionBudget />,
  'knowledge.overview': () => <Knowledge />,
  'knowledge.engineering': () => <Knowledge domain="engineering" />,
  'knowledge.procurement': () => <Knowledge domain="procurement" />,
  'knowledge.services': () => <Knowledge domain="services" />,
  'knowledge.quality': () => <Knowledge domain="quality" />,
  'knowledge.hse': () => <Knowledge domain="hse" />,
  'knowledge.construction': () => <Knowledge domain="construction" />,
  'knowledge.precom': () => <Knowledge domain="precom" />,
  'knowledge.ti': () => <Knowledge domain="ti" />,
  'knowledge.huc': () => <Knowledge domain="huc" />,
  'management.risks': () => <Risks />,
  'management.issues': () => <Issues />,
  'interface.register': () => <InterfaceRegister />,
  'interface.matrix': () => <InterfaceMatrixPage />,
  'interface.points': () => <InterfacePointsPage />,
};
const sheetsOnly = new Set<string>(SHEETS_KEYS);

function ModuleRoute() {
  const { key = '' } = useParams();
  const { modules } = useApp();
  const { setWorkspace } = usePrefs();
  const m = modules.modules.find(x => x.key === key);

  useEffect(() => { if (m?.effective) setWorkspace(m.workspace); }, [m, setWorkspace]);

  if (!m || !m.effective) return <Navigate to="/" replace />;
  const target = landing(modules.modules, key);
  if (target !== key) return <Navigate to={`/m/${target}`} replace />;
  const page = PAGES[key] && (apiMode === 'sheets' || !sheetsOnly.has(key)) ? PAGES[key] : null;

  return (
    <CrumbContext.Provider value={pathOf(modules, key)}>
      <SheetContext.Provider value={m.sheet ?? null}>
        {page ? page() : <Placeholder moduleKey={key} />}
      </SheetContext.Provider>
    </CrumbContext.Provider>
  );
}

function Home() {
  const { modules } = useApp();
  const { workspace } = usePrefs();
  const key = defaultKey(modules.modules, workspace);
  if (key) return <Navigate to={`/m/${key}`} replace />;
  const label = modules.workspaces.find(w => w.id === workspace)?.label;
  return (
    <CrumbContext.Provider value={[label ?? '']}>
      <PageHead title={label ?? 'Workspace'} desc={`No ${label} modules are enabled.`} />
      <div className="panel empty"><Link className="btn small" to="/settings/modules">Open module settings</Link></div>
    </CrumbContext.Provider>
  );
}

/* ---------------- demo sign-in (sheets pre-build only) ---------------- */
function SignIn({ onSignIn }: { onSignIn: (id: string) => void }) {
  const dir = useQuery({ queryKey: ['directory'], queryFn: () => request<DirectoryUser[]>('/directory') });
  return (
    <div className="signin">
      <div className="panel signin-card">
        <div className="brand" style={{ padding: '0 0 18px' }}><span className="brandmark" />Project Flow</div>
        <h1>Who are you?</h1>
        <p className="page-sub" style={{ marginBottom: 18 }}>Pre-build demo: pick a person to act as. This is not authentication — roles are enforced, but anyone can choose any name.</p>
        {dir.isPending ? <Loading /> : dir.error ? <ErrorBox error={dir.error} /> : (
          <div className="signin-list">
            {dir.data.map(u => (
              <button key={u.id} className="btn signin-user" onClick={() => onSignIn(u.id)}>
                <span className="avatar teal">{u.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>{u.name}
              </button>
            ))}
            {!dir.data.length && <div className="empty">No active users. Run the sheets setup function first.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const PROJECT_KEY = 'projectflow.project';
const loadProject = () => { try { return localStorage.getItem(PROJECT_KEY); } catch { return null; } };
const saveProject = (id: string | null) => { try { if (id) localStorage.setItem(PROJECT_KEY, id); else localStorage.removeItem(PROJECT_KEY); } catch { /* storage unavailable */ } };

/** Signed-in session: resolves the user, the visible projects and the selected project, then its module registry. */
function Session({ userId, signOut, switchUser }: { userId: string | null; signOut: () => void; switchUser: (id: string) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(loadProject);
  const [asOf, setAsOfState] = useState<string | null>(null);

  // Phase 1: batch /me + /projects in a single HTTP round trip (sheets mode).
  const bootstrap = useQuery({
    queryKey: ['bootstrap', userId],
    queryFn: async () => {
      if (apiMode === 'sheets') {
        const [me, projects] = await requestBatch<[Me, Project[]]>('/me', '/projects');
        return { me, projects };
      }
      const projects = await request<Project[]>('/projects');
      return { me: null as Me | null, projects };
    },
  });
  const meData = bootstrap.data?.me ?? null;
  const list = bootstrap.data?.projects;
  const project = list?.find(p => p.id === selected) ?? list?.find(p => p.myRole) ?? list?.[0] ?? null;

  // Phase 2: once we know the project, load modules (only one more request).
  const modules = useQuery({ queryKey: ['modules', project?.id], queryFn: () => request<ModulesResponse>(`/projects/${project!.id}/modules`), enabled: !!project });

  /** Switches between the current data and a saved cut-off snapshot; every project data query is refetched. */
  const setAsOf = useCallback((cutoff: string | null) => {
    setCurrentAsOf(cutoff);
    setAsOfState(cutoff);
    const keep = new Set(['bootstrap', 'me', 'projects', 'directory', 'modules', 'users', 'members', 'snapshots', 'ptasks', 'ptask-workload', 'health']);
    qc.invalidateQueries({ predicate: q => !keep.has(String(q.queryKey[0])) });
  }, [qc]);
  const selectProject = useCallback((id: string) => { setAsOf(null); saveProject(id); setSelected(id); navigate('/'); }, [navigate, setAsOf]);
  // Screens that the person's party is not given (Settings -> Party access) behave as switched off for them.
  const visibleModules = useMemo<ModulesResponse>(() => {
    const data = modules.data ?? { workspaces: [], modules: [] };
    const hidden = new Set(meData?.hiddenModules ?? []);
    return hidden.size ? { ...data, modules: data.modules.map(m => (hidden.has(m.key) ? { ...m, effective: false } : m)) } : data;
  }, [modules.data, meData]);
  const value = useMemo(() => ({
    project: project ?? NO_PROJECT,
    modules: visibleModules,
    me: meData, projects: list ?? [], selectProject, signOut, switchUser, asOf, setAsOf,
  }), [project, visibleModules, meData, list, selectProject, signOut, switchUser, asOf, setAsOf]);

  if (bootstrap.error) return <div style={{ padding: 40 }}><ErrorBox error={bootstrap.error} />{apiMode === 'sheets' && <button className="btn" style={{ margin: 16 }} onClick={signOut}>Choose another user</button>}</div>;
  if (!list || (apiMode === 'sheets' && !meData)) return <div style={{ padding: 40 }}><Loading label="Loading…" /></div>;
  if (project && modules.error) return <div style={{ padding: 40 }}><ErrorBox error={modules.error} /><button className="btn" style={{ margin: 16 }} onClick={signOut}>Choose another user</button></div>;
  if (project && !modules.data) return <div style={{ padding: 40 }}><Loading label="Loading project…" /></div>;

  const home = apiMode === 'sheets' ? 'projects' : 'modules';
  return (
    <AppDataProvider value={value}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={project ? <Home /> : <Navigate to="/settings/projects" replace />} />
          <Route path="m/:key" element={project ? <ModuleRoute /> : <Navigate to="/settings/projects" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Navigate to={`/settings/${project ? 'modules' : home}`} replace />} />
          <Route path="settings/:tab" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}

export function App() {
  const qc = useQueryClient();
  const [userId, setUser] = useState<string | null>(getUserId);
  const signOut = useCallback(() => { setCurrentAsOf(null); setUserId(null); setUser(null); qc.clear(); }, [qc]);
  const signIn = (id: string) => { qc.clear(); setCurrentAsOf(null); setUserId(id); setUser(id); };
  useEffect(() => {
    window.addEventListener('projectflow:signed-out', signOut);
    return () => window.removeEventListener('projectflow:signed-out', signOut);
  }, [signOut]);

  if (apiMode === 'sheets' && !userId) return <SignIn onSignIn={signIn} />;
  return <Session key={userId ?? 'none'} userId={userId} signOut={signOut} switchUser={signIn} />;
}
