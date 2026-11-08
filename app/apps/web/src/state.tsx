import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Me, ModulesResponse, Project, Role, SheetInfo, WorkspaceId } from './api';

/* ---------------- personal UI preferences (browser-local) ---------------- */
const PREFS_KEY = 'projectflow.prefs';
interface Prefs { dark: boolean; workspace: WorkspaceId }
const defaults: Prefs = { dark: false, workspace: 'epcic' };

function loadPrefs(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

interface PrefsCtx extends Prefs { setDark: (v: boolean) => void; setWorkspace: (w: WorkspaceId) => void; reset: () => void }
const PrefsContext = createContext<PrefsCtx>(null as never);
export const usePrefs = () => useContext(PrefsContext);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
    document.body.classList.toggle('dark', prefs.dark);
  }, [prefs]);
  const value = useMemo<PrefsCtx>(() => ({
    ...prefs,
    setDark: dark => setPrefs(p => ({ ...p, dark })),
    setWorkspace: workspace => setPrefs(p => (p.workspace === workspace ? p : { ...p, workspace })),
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
}
const AppContext = createContext<AppData>(null as never);
export const AppDataProvider = AppContext.Provider;
export const useApp = () => useContext(AppContext);

export const NO_PROJECT: Project = { id: '', code: '—', name: 'No project selected', contract: '', cutoff: new Date().toISOString().slice(0, 10) };

/** What the current user may do in the selected project; mirrors the backend rules (spec 2.1). Without users, everything is allowed. */
export function useAccess() {
  const { me, project } = useApp();
  const role: Role | null = me ? me.memberships.find(m => m.projectId === project.id)?.role ?? null : 'Project Manager';
  const isAdmin = !me || me.isAdmin;
  return {
    isAdmin, role, hasUsers: !!me,
    canWrite: !!role && role !== 'Client',
    canManage: role === 'Project Manager' || role === 'Manager',
    canConfigure: isAdmin || role === 'Project Manager',
  };
}

/* ---------------- breadcrumb ---------------- */
export const CrumbContext = createContext<string[]>([]);

/** The spreadsheet sheet behind the current screen, when the backend keeps data in Google Sheets. */
export const SheetContext = createContext<SheetInfo | null>(null);

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
