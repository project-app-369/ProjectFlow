import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import {
  errorText, PERSONAL_KEY, request, TASK_STATUSES, URGENCIES, type DirectoryUser, type PTask, type TaskInput, type TaskStatus, type Urgency,
} from '../../api';
import { fmtDate, localToday, type Tone } from '../../format';
import { Icon } from '../../icons';
import { useApp, useToast } from '../../state';
import { ActualPlanBar, Btn, Confirm, DateInput, Modal, StateTag, type StateTone } from '../../ui';

export const urgencyTone: Record<Urgency, Tone> = { Low: 'indigo', Normal: 'green', High: 'amber', Urgent: 'red' };
export const statusTone: Record<TaskStatus, Tone> = { Backlog: 'indigo', Planned: 'indigo', Ongoing: 'amber', Completed: 'green' };

const urgencyHint: Record<Urgency, string> = {
  Low: 'Can wait', Normal: 'Standard priority', High: 'Needs attention', Urgent: 'Act now',
};
const statusHint: Record<TaskStatus, string> = {
  Backlog: 'Not scheduled', Planned: 'Ready to start', Ongoing: 'In progress', Completed: 'Finished',
};

function TaskField({ icon, label, hint, children, full = false }: { icon: string; label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <label className={`field task-field ${full ? 'full' : ''}`}><span className="task-field-label"><Icon name={icon} />{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}

/* ---------------- data ---------------- */
interface TaskList { items: PTask[]; today: string }

/** The signed-in user's personal tasks. Overdue is computed by the server against this browser's today. */
export function useTasks() {
  const { me } = useApp();
  const today = localToday();
  const q = useQuery({ queryKey: ['ptasks', me?.id, today], queryFn: () => request<TaskList>(`/tasks?today=${today}`) });
  return { ...q, tasks: q.data?.items ?? [], today };
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const toast = useToast();
  const today = localToday();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['ptasks'] }), qc.invalidateQueries({ queryKey: ['ptask-workload'] })]);
  const qs = `?today=${today}`;

  const create = useMutation({
    mutationFn: (body: TaskInput) => request<PTask>(`/tasks${qs}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: t => { refresh(); toast(`Task ${t.taskNo} created.`); },
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: TaskInput & { id: string }) => request<PTask>(`/tasks/${id}${qs}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { refresh(); },
  });
  /** Status change from a drag or a menu: the board moves at once and rolls back if the server refuses. */
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => request<PTask>(`/tasks/${id}${qs}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['ptasks'] });
      const snapshots = qc.getQueriesData<TaskList>({ queryKey: ['ptasks'] });
      qc.setQueriesData<TaskList>({ queryKey: ['ptasks'] }, old => old && { ...old, items: old.items.map(t => (t.id === id ? { ...t, status, overdue: status !== 'Completed' && !!t.due && t.due < old.today } : t)) });
      return { snapshots };
    },
    onError: (e, _v, ctx) => { ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)); toast(errorText(e)); },
    onSettled: () => { refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Task deleted.'); },
    onError: (e: Error) => toast(errorText(e)),
  });
  return { create, update, move, remove };
}

/* ---------------- small pieces ---------------- */
export function useProjectLabels() {
  const { projects } = useApp();
  return (id: string) => (id === PERSONAL_KEY ? 'No project' : projects.find(p => p.id === id)?.code ?? id);
}

export function ProjectChips({ ids = [] }: { ids?: string[] }) {
  const label = useProjectLabels();
  if (!ids.length) return <span className="task-meta-item tiny muted" title="Personal task"><Icon name="user" />Personal</span>;
  return <>{ids.map(id => <span key={id} className="chip task-project-chip"><Icon name="layers" />{label(id)}</span>)}</>;
}

const urgencyStateTone: Record<Urgency, StateTone> = { Low: 'ok', Normal: 'info', High: 'warn', Urgent: 'crit' };
const taskStateTone: Record<TaskStatus, StateTone> = { Backlog: 'neutral', Planned: 'info', Ongoing: 'warn', Completed: 'ok' };

/** `text` writes the word next to the icon (list and table views); cards keep the compact icon. */
export function UrgencyBadge({ urgency, text }: { urgency: Urgency; text?: boolean }) {
  if (text) return <StateTag icon={`prio-${urgency.toLowerCase()}`} label={urgency} tone={urgencyStateTone[urgency]} title={`Urgency: ${urgency}`} />;
  return <span className={`task-symbol urgency-${urgency.toLowerCase()}`} role="img" aria-label={`Urgency: ${urgency}`} title={`Urgency: ${urgency}`}><Icon name={`prio-${urgency.toLowerCase()}`} /></span>;
}

export function StatusBadges({ task, text }: { task: PTask; text?: boolean }) {
  if (text) return <span className="task-symbols"><StateTag icon={`status-${task.status.toLowerCase()}`} label={task.status} tone={taskStateTone[task.status]} title={`Status: ${task.status}`} />{task.overdue && <StateTag icon="clock" label="Overdue" tone="crit" />}</span>;
  return <span className="task-symbols"><span className={`task-symbol status-${task.status.toLowerCase()}`} role="img" aria-label={`Status: ${task.status}`} title={`Status: ${task.status}`}><Icon name={`status-${task.status.toLowerCase()}`} /></span>{task.overdue && <span className="task-symbol overdue" role="img" aria-label="Overdue" title="Overdue"><Icon name="clock" /></span>}</span>;
}

interface IconOption { value: string; label: string; icon: string }
export const statusOptions: IconOption[] = TASK_STATUSES.map(s => ({ value: s, label: s, icon: `status-${s.toLowerCase()}` }));

/** Compact selector for a card: the icon and word of the current value, a menu of named options. */
export function IconSelect({ value, options, onChange, label, className = '' }: { value: string; options: IconOption[]; onChange: (value: string) => void; label: string; className?: string }) {
  const selected = options.find(o => o.value === value) ?? options[0];
  return <details className={`task-icon-select value-${selected.value.toLowerCase()} ${className}`} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.open = false; }} onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label={`${label}: ${selected.label}`} title={`${label}: ${selected.label}`}><Icon name={selected.icon} /><span className="task-icon-select-text">{selected.label}</span></summary>
    <div className="task-icon-select-menu" role="group" aria-label={label}>
      {options.map(o => <button key={o.value} type="button" className={value === o.value ? 'selected' : ''} aria-label={o.label} title={o.label} aria-pressed={value === o.value} onClick={e => { onChange(o.value); e.currentTarget.closest('details')?.removeAttribute('open'); }}><Icon name={o.icon} /><span>{o.label}</span></button>)}
    </div>
  </details>;
}

export function SubtaskProgress({ task }: { task: PTask }) {
  if (!task.subtasksTotal) return <span className="tiny muted">—</span>;
  const pct = Math.round((task.subtasksDone / task.subtasksTotal) * 100);
  return (
    <div className="subprogress" title={`${task.subtasksDone} of ${task.subtasksTotal} sub-tasks done`}>
      <ActualPlanBar actual={pct} plan={null} compact />
      <span className="task-meta-item tiny muted" title={`${task.subtasksDone} of ${task.subtasksTotal} subtasks complete`}><Icon name="status-completed" />{task.subtasksDone}/{task.subtasksTotal}</span>
    </div>
  );
}

/* ---------------- filters ---------------- */
export interface TaskFilter { q: string; project: string; urgency: string; status: string }
export const emptyFilter: TaskFilter = { q: '', project: '', urgency: '', status: '' };

export function applyFilter(tasks: PTask[], f: TaskFilter): PTask[] {
  const q = f.q.trim().toLowerCase();
  return tasks.filter(t =>
    (!q || [t.taskNo, t.title, t.description, t.assigner, t.remarks, ...t.subtasks.map(s => s.title)].some(x => x?.toLowerCase().includes(q))) &&
    (!f.project || (f.project === PERSONAL_KEY ? !t.projects.length : t.projects.includes(f.project))) &&
    (!f.urgency || t.urgency === f.urgency) &&
    (!f.status || (f.status === 'Overdue' ? t.overdue : t.status === f.status)));
}

export function TaskFilters({ value, onChange, hideProject = false }: { value: TaskFilter; onChange: (f: TaskFilter) => void; /** Project Tasks fixes the project. */ hideProject?: boolean }) {
  const { projects } = useApp();
  const set = (patch: Partial<TaskFilter>) => onChange({ ...value, ...patch });
  return (
    <div className="toolbar">
      <label className="search">
        <Icon name="search" />
        <input placeholder="Search number, title, assigner or sub-task…" value={value.q} onChange={e => set({ q: e.target.value })} aria-label="Search tasks" />
      </label>
      <div className="filter-group">
        {!hideProject && (
          <select className="filter" aria-label="Filter by project" value={value.project} onChange={e => set({ project: e.target.value })}>
            <option value="">All projects</option>
            <option value={PERSONAL_KEY}>No project</option>
            {projects.filter(p => p.myRole).map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        )}
        <select className="filter" aria-label="Filter by urgency" value={value.urgency} onChange={e => set({ urgency: e.target.value })}>
          <option value="">All urgencies</option>{URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="filter" aria-label="Filter by status" value={value.status} onChange={e => set({ status: e.target.value })}>
          <option value="">All statuses</option>{TASK_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}<option value="Overdue">Overdue</option>
        </select>
        <Btn kind="small" onClick={() => onChange(emptyFilter)}>Clear</Btn>
      </div>
    </div>
  );
}

/* ---------------- create / edit form ---------------- */
export function TaskForm({ task, defaults, onClose }: { task: PTask | null; defaults?: TaskInput; onClose: () => void }) {
  const { me, projects } = useApp();
  const { create, update, remove } = useTaskMutations();
  const directory = useQuery({ queryKey: ['directory', 'tasks'], queryFn: () => request<DirectoryUser[]>('/directory'), staleTime: 60_000 });
  const mine = useMemo(() => projects.filter(p => p.myRole), [projects]);
  const [v, setV] = useState({
    title: task?.title ?? '', description: task?.description ?? '', urgency: (task?.urgency ?? 'Normal') as Urgency, assigner: task?.assigner ?? me?.name ?? '',
    status: (task?.status ?? 'Backlog') as TaskStatus, projects: task?.projects ?? defaults?.projects ?? [],
    planStart: task?.planStart ?? defaults?.planStart ?? '', planFinish: task?.planFinish ?? defaults?.planFinish ?? '', due: task?.due ?? defaults?.due ?? '',
    effort: task?.effort != null ? String(task.effort) : '', remarks: task?.remarks ?? '',
    subtasks: (task?.subtasks ?? []) as { id?: string; title: string; done: boolean }[],
  });
  const [newSub, setNewSub] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const up = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(s => ({ ...s, [k]: val }));
  const busy = create.isPending || update.isPending;
  const badRange = !!v.planStart && !!v.planFinish && v.planFinish < v.planStart;
  const [initial] = useState(() => JSON.stringify(v));
  const dirty = !task || JSON.stringify(v) !== initial;

  const save = () => {
    setError('');
    const body: TaskInput = {
      title: v.title, description: v.description || null, urgency: v.urgency, assigner: v.assigner || null, status: v.status, projects: v.projects,
      planStart: v.planStart || null, planFinish: v.planFinish || null, due: v.due || null, effort: v.effort === '' ? null : Number(v.effort),
      remarks: v.remarks || null, subtasks: v.subtasks,
    };
    const done = { onSuccess: onClose, onError: (e: Error) => setError(errorText(e)) };
    if (task) update.mutate({ id: task.id, ...body }, done); else create.mutate(body, done);
  };
  const addSub = () => { if (newSub.trim()) { up('subtasks', [...v.subtasks, { title: newSub.trim(), done: false }]); setNewSub(''); } };

  return (
    <>
      <Modal title={task ? `${task.taskNo} · Task details` : 'New task'} size="xl" onClose={onClose}
        actions={<>
          {task && <Btn kind="text task-delete-action" icon="trash" iconOnly aria-label="Delete task" title="Delete task" onClick={() => setConfirming(true)} />}
          <span className="task-action-spacer" />
          <Btn onClick={onClose}>{dirty ? 'Cancel' : 'Close'}</Btn>
          <Btn kind="primary" disabled={busy || !v.title.trim() || badRange || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn>
        </>}>
        <div className="dialog-body task-editor">
          <section className="task-editor-section" aria-label="Task content">
            <div className="form-grid">
              <TaskField icon="edit" label="Title" full><input value={v.title} maxLength={160} onChange={e => up('title', e.target.value)} autoFocus /></TaskField>
              <TaskField icon="doc" label="Description" full><textarea rows={4} value={v.description} maxLength={2000} onChange={e => up('description', e.target.value)} /></TaskField>
            </div>
          </section>

          <div className="task-editor-choices">
            <fieldset className="task-choice-group"><legend><Icon name="prio-high" />Urgency</legend>
              <div className="task-choice-grid">
                {URGENCIES.map(u => <button key={u} type="button" className={`task-choice urgency-${u.toLowerCase()} ${v.urgency === u ? 'selected' : ''}`} aria-pressed={v.urgency === u} onClick={() => up('urgency', u)} title={`${u} · ${urgencyHint[u]}`}><Icon name={`prio-${u.toLowerCase()}`} /><span className="task-choice-text">{u}</span></button>)}
              </div>
            </fieldset>
            <fieldset className="task-choice-group"><legend><Icon name="check" />Status</legend>
              <div className="task-choice-grid">
                {TASK_STATUSES.map(s => <button key={s} type="button" className={`task-choice status-${s.toLowerCase()} ${v.status === s ? 'selected' : ''}`} aria-pressed={v.status === s} onClick={() => up('status', s)} title={`${s} · ${statusHint[s]}`}><Icon name={`status-${s.toLowerCase()}`} /><span className="task-choice-text">{s}</span></button>)}
              </div>
              {task?.overdue && <small className="negative">Overdue until completed or rescheduled.</small>}
            </fieldset>
          </div>

          <section className="task-editor-section" aria-label="Plan and deadline">
            <div className="task-date-grid">
              <TaskField icon="calendar" label="Start"><DateInput value={v.planStart} onChange={e => up('planStart', e.target.value)} /></TaskField>
              <TaskField icon="calendar" label="Finish"><DateInput value={v.planFinish} min={v.planStart || undefined} onChange={e => up('planFinish', e.target.value)} /></TaskField>
              <TaskField icon="flag" label="Due"><DateInput value={v.due} onChange={e => up('due', e.target.value)} /></TaskField>
            </div>
            {badRange && <p className="negative tiny" role="alert">Plan finish cannot be before plan start.</p>}
          </section>

          <section className="task-editor-section" aria-label="Ownership and scope">
            <div className="form-grid task-context-grid">
              <TaskField icon="user" label="Assigned by"><input list="task-assigners" value={v.assigner} maxLength={120} onChange={e => up('assigner', e.target.value)} /><datalist id="task-assigners">{directory.data?.map(u => <option key={u.id} value={u.name} />)}</datalist></TaskField>
              <TaskField icon="hourglass" label="Effort (hours)"><input type="number" min={0} step="0.5" value={v.effort} onChange={e => up('effort', e.target.value)} /></TaskField>
              <div className="field full task-projects"><span className="task-field-label"><Icon name="layers" />Projects</span>
                <div className="check-row">{mine.length ? mine.map(p => <label key={p.id} className="check-chip"><input type="checkbox" checked={v.projects.includes(p.id)} onChange={e => up('projects', e.target.checked ? [...v.projects, p.id] : v.projects.filter(x => x !== p.id))} />{p.code}</label>) : <span className="tiny muted">No project memberships.</span>}</div>
              </div>
            </div>
          </section>

          <div className="task-editor-tail">
          <section className="task-editor-section" aria-label="Subtasks">
            <h3><Icon name="check" />Subtasks <span className="task-section-count">{v.subtasks.filter(s => s.done).length}/{v.subtasks.length}</span></h3>
            <div className="subtask-edit">
              {v.subtasks.map((s, i) => <div className="subtask-row" key={s.id ?? `n${i}`}><input type="checkbox" className="switch" checked={s.done} aria-label={`Done: ${s.title}`} onChange={e => up('subtasks', v.subtasks.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))} /><input value={s.title} maxLength={160} aria-label={`Subtask ${i + 1}`} className={s.done ? 'done' : ''} onChange={e => up('subtasks', v.subtasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /><Btn kind="text" icon="trash" iconOnly aria-label={`Remove ${s.title}`} onClick={() => up('subtasks', v.subtasks.filter((_, j) => j !== i))} /></div>)}
              <div className="subtask-row"><span className="subtask-new-icon"><Icon name="plus" /></span><input value={newSub} maxLength={160} placeholder="Add a subtask" aria-label="New subtask" onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} /><Btn kind="small" icon="plus" iconOnly aria-label="Add subtask" onClick={addSub} disabled={!newSub.trim()} /></div>
            </div>
          </section>

          <section className="task-editor-section" aria-label="Remarks"><TaskField icon="edit" label="Remarks"><textarea rows={3} value={v.remarks} maxLength={2000} onChange={e => up('remarks', e.target.value)} /></TaskField></section>
          </div>
          {error && <p className="negative mt-3" role="alert">{error}</p>}
        </div>
      </Modal>
      {confirming && task && (
        <Confirm title={`Delete ${task.taskNo}?`} busy={remove.isPending} onConfirm={() => remove.mutate(task.id, { onSuccess: onClose })} onClose={() => setConfirming(false)}>
          <p>“{task.title}” and its sub-tasks will be removed. This cannot be undone.</p>
        </Confirm>
      )}
    </>
  );
}

export { fmtDate };
