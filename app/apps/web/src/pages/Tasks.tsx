import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { request, type Task } from '../api';
import { fmtDate } from '../format';
import { useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, Loading, Modal, PageHead, Stat } from '../ui';

const COLUMNS: Task['status'][] = ['To do', 'In progress', 'Done'];
const priorityTone = { High: 'red', Normal: 'amber', Low: 'indigo' } as const;

export default function Tasks() {
  const { project } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const { data, error, isPending } = useQuery({ queryKey: ['tasks'], queryFn: () => request<{ items: Task[] }>('/tasks') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] });
  const fail = (e: Error) => toast(e.message);

  const create = useMutation({
    mutationFn: (body: Partial<Task>) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { refresh(); setCreating(false); toast('Task created.'); }, onError: fail,
  });
  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Task>) => request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { refresh(); toast('Task updated.'); }, onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Task removed.'); }, onError: fail,
  });

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const tasks = data.items;
  const open = tasks.filter(t => t.status !== 'Done').length;
  const overdue = tasks.filter(t => t.status !== 'Done' && t.due < project.cutoff).length;

  return (
    <>
      <PageHead title="Task management" desc="Personal workspace — your own follow-ups and reminders."
        actions={<Btn kind="small" icon="plus" onClick={() => setCreating(true)}>New task</Btn>} />
      <div className="stats">
        <Stat label="Open tasks" value={open} foot="To do + in progress" icon="check" />
        <Stat label="Overdue" value={overdue} foot="Due date before the project cut-off" icon="clock" />
        <Stat label="Completed" value={tasks.length - open} foot="Marked done" icon="risk" />
        <Stat label="All tasks" value={tasks.length} foot="In this workspace" icon="layers" />
        <Stat label="To do" value={tasks.filter(t => t.status === 'To do').length} foot="Not yet started" icon="calendar" />
        <Stat label="In progress" value={tasks.filter(t => t.status === 'In progress').length} foot="Work under way" icon="chart" />
      </div>
      <div className="board">
        {COLUMNS.map(col => {
          const cards = tasks.filter(t => t.status === col);
          return (
            <section className="board-column" key={col}>
              <h3>{col} <span className="count">{cards.length}</span></h3>
              {cards.map(t => (
                <article className="task-card" key={t.id}>
                  <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                  <h3>{t.title}</h3>
                  <p>{t.note}</p>
                  <div className="task-bottom">
                    <span className="tiny muted">Due {fmtDate(t.due)}</span>
                    {col !== 'Done' && <Btn kind="small" onClick={() => patch.mutate({ id: t.id, status: col === 'To do' ? 'In progress' : 'Done' })}>{col === 'To do' ? 'Start' : 'Complete'}</Btn>}
                  </div>
                  <div style={{ marginTop: 10 }}><Btn kind="text" icon="close" onClick={() => remove.mutate(t.id)}>Remove</Btn></div>
                </article>
              ))}
              {!cards.length && <div className="tiny muted">No tasks in this column.</div>}
            </section>
          );
        })}
      </div>
      {creating && (
        <Modal title="Create task" onClose={() => setCreating(false)}>
          <form onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({ title: String(f.get('title')), due: String(f.get('due')), priority: String(f.get('priority')) as Task['priority'], note: String(f.get('note') ?? '') || null });
          }}>
            <div className="dialog-body">
              <div className="form-grid">
                <label className="field full">Task title<input name="title" required maxLength={120} placeholder="Describe the next action" autoFocus /></label>
                <label className="field">Due date<input type="date" name="due" defaultValue={project.cutoff} required /></label>
                <label className="field">Priority<select name="priority" defaultValue="Normal"><option>Normal</option><option>High</option><option>Low</option></select></label>
                <label className="field full">Notes<textarea name="note" placeholder="Optional context" maxLength={500} /></label>
              </div>
            </div>
            <div className="dialog-actions"><Btn onClick={() => setCreating(false)}>Cancel</Btn><button className="btn primary" type="submit" disabled={create.isPending}>Create task</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
