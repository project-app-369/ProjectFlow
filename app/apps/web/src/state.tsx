import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Me, ModulesResponse, Project, Role, SheetInfo, WorkspaceId } from './api';

/* ---------------- personal UI preferences (browser-local) ---------------- */
const PREFS_KEY = 'projectflow.prefs';
interface Prefs { dark: boolean; workspace: WorkspaceId; /** Sidebar shown as an icon rail (desktop). */ navCollapsed: boolean }
const defaults: Prefs = { dark: false, workspace: 'epcic', navCollapsed: false };

function loadPrefs(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

interface PrefsCtx extends Prefs { setDark: (v: boolean) => void; setWorkspace: (w: WorkspaceId) => void; setNavCollapsed: (v: boolean) => void; reset: () => void }
const PrefsContext = createContext<PrefsCtx>(null as never);
export const usePrefs = () => useContext(PrefsContext);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useLayoutEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
    document.body.classList.toggle('dark', prefs.dark);
    document.documentElement.dataset.nav = prefs.navCollapsed ? 'collapsed' : 'expanded';
  }, [prefs]);
  const value = useMemo<PrefsCtx>(() => ({
    ...prefs,
    setDark: dark => setPrefs(p => ({ ...p, dark })),
    setWorkspace: workspace => setPrefs(p => (p.workspace === workspace ? p : { ...p, workspace })),
    setNavCollapsed: navCollapsed => setPrefs(p => ({ ...p, navCollapsed })),
    reset: () => setPrefs(defaults),
  }), [prefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

/* ---------------- project + module registry data ---------------- */
export interface AppData {
  /** The selected project; when none is selected this is a placeholder with an empty id. */
  project: Project;
  modules: ModulesResponse;
  /** Signed-in demo user. Null when the backend has no users (the NestJS API). */
  me: Me | null;
  projects: Project[];
  selectProject: (id: string) => void;
  signOut: () => void;
  /** Acts as another person straight away (the pre-build has no sign-in). */
  switchUser: (id: string) => void;
  /** Cut-off date of the snapshot being viewed, or null for the current data. */
  asOf: string | null;
  setAsOf: (cutoff: string | null) => void;
}
const AppContext = createContext<AppData>(null as never);
export const AppDataProvider = AppContext.Provider;
export const useApp = () => useContext(AppContext);

export const NO_PROJECT: Project = { id: '', code: '—', name: 'No project selected', contract: '', cutoff: new Date().toISOString().slice(0, 10) };

/** What the current user may do in the selected project; mirrors the backend rules (spec 2.1). Without users, everything is allowed. */
export function useAccess() {
  const { me, project, asOf } = useApp();
  const role: Role | null = me ? me.memberships.find(m => m.projectId === project.id)?.role ?? null : 'Project Manager';
  const isAdmin = !me || me.isAdmin;
  const live = !asOf; // a snapshot is read-only for everyone
  const key = useContext(ModuleKeyContext);
  // a role or personal setting can make this one screen read-only for the person, whatever their role allows elsewhere
  const readOnlyHere = !!me && !!key && !!me.moduleAccess?.[project.id]?.readOnly.includes(key);
  return {
    isAdmin, role, hasUsers: !!me, readOnly: !live || readOnlyHere,
    canWrite: live && !readOnlyHere && !!role && role !== 'Client',
    canManage: live && !readOnlyHere && (role === 'Project Manager' || role === 'Manager'),
    canConfigure: live && (isAdmin || role === 'Project Manager'),
  };
}

/* ---------------- breadcrumb ---------------- */
/** One step of the breadcrumb; a step with `to` is a link. */
export type Crumb = string | { label: string; to?: string };
export const CrumbContext = createContext<Crumb[]>([]);

/** The spreadsheet sheet behind the current screen, when the backend keeps data in Google Sheets. */
export const SheetContext = createContext<SheetInfo | null>(null);
/** The module the screen belongs to, so permission checks can be about this screen and not only the project role. */
export const ModuleKeyContext = createContext<string | null>(null);

/* ---------------- toast ---------------- */
const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 3500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="toast" role="status" aria-live="polite" className={show ? 'show' : ''}>{msg}</div>
    </ToastContext.Provider>
  );
}
