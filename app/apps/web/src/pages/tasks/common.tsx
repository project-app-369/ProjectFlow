import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  errorText, PERSONAL_KEY, request, TASK_STATUSES, URGENCIES, type DirectoryUser, type PTask, type TaskInput, type TaskStatus, type Urgency,
} from '../../api';
import { fmtDate, localToday, type Tone } from '../../format';
import { useApp, useToast } from '../../state';
import { ActualPlanBar, Badge, Btn, Confirm, Field, Modal } from '../../ui';

export const urgencyTone: Record<Urgency, Tone> = { Low: 'indigo', Normal: 'green', High: 'amber', Urgent: 'red' };
export const statusTone: Record<TaskStatus, Tone> = { Backlog: 'indigo', Planned: 'indigo', Ongoing: 'amber', Completed: 'green' };

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
  if (!ids.length) return <span className="tiny muted">Personal</span>;
  return <>{ids.map(id => <span key={id} className="chip">{label(id)}</span>)}</>;
}

export function StatusBadges({ task }: { task: PTask }) {
  return <><Badge tone={statusTone[task.status]}>{task.status}</Badge>{task.overdue && <> <Badge tone="red">Overdue</Badge></>}</>;
}

export function SubtaskProgress({ task }: { task: PTask }) {
  if (!task.subtasksTotal) return <span className="tiny muted">—</span>;
  const pct = Math.round((task.subtasksDone / task.subtasksTotal) * 100);
  return (
    <div className="subprogress" title={`${task.subtasksDone} of ${task.subtasksTotal} sub-tasks done`}>
      <ActualPlanBar actual={pct} plan={null} compact />
      <span className="tiny muted">{task.subtasksDone}/{task.subtasksTotal} sub-tasks complete</span>
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

export function TaskFilters({ value, onChange }: { value: TaskFilter; onChange: (f: TaskFilter) => void }) {
  const { projects } = useApp();
  const set = (patch: Partial<TaskFilter>) => onChange({ ...value, ...patch });
  return (
    <div className="toolbar">
      <label className="search">
        <input placeholder="Search number, title, assigner or sub-task…" value={value.q} onChange={e => set({ q: e.target.value })} aria-label="Search tasks" />
      </label>
      <div className="filter-group">
        <select className="filter" aria-label="Filter by project" value={value.project} onChange={e => set({ project: e.target.value })}>
          <option value="">All projects</option>
          <option value={PERSONAL_KEY}>No project</option>
          {projects.filter(p => p.myRole).map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <select className="filter" aria-label="Filter by urgency" value={value.urgency} onChange={e => set({ urgency: e.target.value })}>
          <option value="">All urgencies</option>{URGENCIES.map(u => <option key={u}>{u}</option>)}
        </select>
        <select className="filter" aria-label="Filter by status" value={value.status} onChange={e => set({ status: e.target.value })}>
          <option value="">All statuses</option>{[...TASK_STATUSES, 'Overdue'].map(s => <option key={s}>{s}</option>)}
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
      <Modal title={task ? `${task.taskNo} · Edit task` : 'New task'} onClose={onClose}
        actions={<>
          {task && <Btn kind="text" onClick={() => setConfirming(true)}>Delete</Btn>}
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" disabled={busy || !v.title.trim() || badRange} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn>
        </>}>
        <div className="dialog-body">
          <div className="form-grid">
            <Field label="Title" full><input value={v.title} maxLength={160} onChange={e => up('title', e.target.value)} autoFocus /></Field>
            <Field label="Description" full><textarea value={v.description} maxLength={2000} onChange={e => up('description', e.target.value)} /></Field>
            <Field label="Urgency"><select value={v.urgency} onChange={e => up('urgency', e.target.value as Urgency)}>{URGENCIES.map(u => <option key={u}>{u}</option>)}</select></Field>
            <Field label="Status" hint={task?.overdue ? 'Overdue: the deadline has passed' : 'Overdue is set automatically from the deadline'}>
              <select value={v.status} onChange={e => up('status', e.target.value as TaskStatus)}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Assigner" hint="Who gave you this task">
              <input list="task-assigners" value={v.assigner} maxLength={120} onChange={e => up('assigner', e.target.value)} />
              <datalist id="task-assigners">{directory.data?.map(u => <option key={u.id} value={u.name} />)}</datalist>
            </Field>
            <Field label="Estimated effort (hours)"><input type="number" min={0} step="0.5" value={v.effort} onChange={e => up('effort', e.target.value)} /></Field>
            <div className="field full">
              Projects
              <div className="check-row">
                {mine.length ? mine.map(p => (
                  <label key={p.id} className="check-chip">
                    <input type="checkbox" checked={v.projects.includes(p.id)} onChange={e => up('projects', e.target.checked ? [...v.projects, p.id] : v.projects.filter(x => x !== p.id))} />{p.code}
                  </label>
                )) : <span className="tiny muted">You are not a member of any project.</span>}
              </div>
              <small className="muted">A personal task can belong to several projects, or none.</small>
            </div>
            <Field label="Plan start"><input type="date" value={v.planStart} onChange={e => up('planStart', e.target.value)} /></Field>
            <Field label="Plan finish"><input type="date" value={v.planFinish} min={v.planStart || undefined} onChange={e => up('planFinish', e.target.value)} /></Field>
            <Field label="Due date (deadline)" hint="Plan start, plan finish and deadline together put the task on the Gantt"><input type="date" value={v.due} onChange={e => up('due', e.target.value)} /></Field>
            {badRange && <p className="negative tiny" style={{ gridColumn: '1/-1' }}>Plan finish cannot be before plan start.</p>}
            <div className="field full">
              Sub-tasks {v.subtasks.length > 0 && <span className="tiny muted">{v.subtasks.filter(s => s.done).length}/{v.subtasks.length} done</span>}
              <div className="subtask-edit">
                {v.subtasks.map((s, i) => (
                  <div className="subtask-row" key={s.id ?? `n${i}`}>
                    <input type="checkbox" className="switch" checked={s.done} aria-label={`Done: ${s.title}`} onChange={e => up('subtasks', v.subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                    <input value={s.title} maxLength={160} aria-label={`Sub-task ${i + 1}`} className={s.done ? 'done' : ''} onChange={e => up('subtasks', v.subtasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <button type="button" className="icon-btn" aria-label={`Remove ${s.title}`} onClick={() => up('subtasks', v.subtasks.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <div className="subtask-row">
                  <span />
                  <input value={newSub} maxLength={160} placeholder="Add a sub-task and press Enter" aria-label="New sub-task" onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
                  <Btn kind="small" onClick={addSub} disabled={!newSub.trim()}>Add</Btn>
                </div>
              </div>
            </div>
            <Field label="Remarks" full><textarea value={v.remarks} maxLength={2000} onChange={e => up('remarks', e.target.value)} /></Field>
          </div>
          {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
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
