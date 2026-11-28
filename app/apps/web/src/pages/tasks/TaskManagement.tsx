import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeepLinkItem } from '../../deepLink';
import type { PTask } from '../../api';
import { hours } from '../../format';
import { Icon } from '../../icons';
import { useApp } from '../../state';
import { Btn, ErrorBox, PageHead, Stat, PageSkeleton } from '../../ui';
import { applyFilter, emptyFilter, TaskFilters, TaskForm, useTasks, type TaskFilter } from './common';
import { TaskCards, TaskGantt, TaskKanban, TaskList } from './TaskViews';

const VIEWS = [['list', 'List', 'sheet'], ['card', 'Cards', 'grid'], ['kanban', 'Kanban', 'panel'], ['gantt', 'Gantt', 'chart']] as const;
type View = (typeof VIEWS)[number][0];

/**
 * Personal → Task Management → Tasks: one task set, four views (list, cards, kanban, gantt).
 * With `scope="project"` it is Project Tasks: the same tasks limited to the open project, and new tasks are linked to it.
 */
export default function TaskManagement({ scope }: { scope?: 'project' }) {
  const { project } = useApp();
  const scoped = scope === 'project' && !!project.id;
  const { tasks: all, today, error, isPending } = useTasks();
  const tasks = useMemo(() => (scoped ? all.filter(t => t.projects.includes(project.id)) : all), [all, scoped, project.id]);
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(([id]) => id === params.get('view'))?.[0] ?? 'list') as View;
  const [filter, setFilter] = useState<TaskFilter>(emptyFilter);
  const [editing, setEditing] = useDeepLinkItem(tasks, t => t.id);

  const shown = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);
  const stats = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'Completed');
    return { open: open.length, overdue: tasks.filter(t => t.overdue).length, hours: open.reduce((n, t) => n + (t.effort ?? 0), 0), done: tasks.length - open.length };
  }, [tasks]);

  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;

  const open = (t: PTask) => setEditing(t);
  const label = VIEWS.find(([id]) => id === view)?.[1];
  return (
    <>
      <PageHead title={scoped ? 'Project tasks' : 'Tasks'}
        desc={scoped ? `Your tasks linked to ${project.code || project.name}: list, cards, kanban and gantt.` : 'Your personal tasks across projects: list, cards, kanban and gantt.'}
        actions={<Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New task</Btn>} />
      <div className="stats">
        <Stat label="Open tasks" value={stats.open} foot="Backlog, planned and ongoing" icon="status-ongoing" />
        <Stat label="Overdue" value={stats.overdue} foot={<span className={stats.overdue ? 'negative' : ''}>Deadline passed, not completed</span>} icon="clock" />
        <Stat label="Open effort" value={hours(stats.hours)} foot="Estimated hours of open tasks" icon="hourglass" />
        <Stat label="Completed" value={stats.done} foot="Marked completed" icon="status-completed" />
        <Stat label={scoped ? 'Project tasks' : 'All tasks'} value={tasks.length} foot={scoped ? 'Linked to this project' : 'Across your projects'} icon="layers" />
        <Stat label="Completion" value={tasks.length ? Math.round(stats.done / tasks.length * 100) : 0} unit="%" foot="Share of tasks completed" icon="chart" />
      </div>
      <div className="panel">
        <div className="panel-head">
          <div><h2>{label}</h2><p>{shown.length} of {tasks.length} tasks{view === 'kanban' ? ' · drag a card to change its status' : ''}</p></div>
          <div className="seg task-views" role="group" aria-label="Task view">
            {VIEWS.map(([id, text, icon]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => setParams(id === 'list' ? {} : { view: id }, { replace: true })}><Icon name={icon} /><span>{text}</span></button>
            ))}
          </div>
        </div>
        <TaskFilters value={filter} onChange={setFilter} hideProject={scoped} />
        <div className="task-view" key={view}>
          {view === 'list' ? <TaskList tasks={shown} onOpen={open} today={today} />
            : view === 'card' ? <div className="task-cards-wrap"><TaskCards tasks={shown} onOpen={open} today={today} /></div>
            : view === 'kanban' ? <div className="task-cards-wrap"><TaskKanban tasks={shown} onOpen={open} today={today} /></div>
            : <TaskGantt tasks={shown} onOpen={open} today={today} />}
        </div>
      </div>
      {editing && <TaskForm task={editing === 'new' ? null : editing} defaults={scoped ? { projects: [project.id] } : undefined} onClose={() => setEditing(null)} />}
    </>
  );
}
