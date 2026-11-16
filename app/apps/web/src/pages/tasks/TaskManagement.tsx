import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeepLinkItem } from '../../deepLink';
import type { PTask } from '../../api';
import { hours } from '../../format';
import { Icon } from '../../icons';
import { Btn, ErrorBox, Loading, PageHead, Stat } from '../../ui';
import { applyFilter, emptyFilter, TaskFilters, TaskForm, useTasks, type TaskFilter } from './common';
import { TaskCards, TaskGantt, TaskKanban, TaskList } from './TaskViews';

const VIEWS = [['list', 'List', 'sheet'], ['card', 'Card', 'grid'], ['kanban', 'Kanban', 'panel'], ['gantt', 'Gantt', 'chart']] as const;
type View = (typeof VIEWS)[number][0];

/** Personal → Task Management → Tasks: one task set, four views (list, card, kanban, gantt). */
export default function TaskManagement() {
  const { tasks, today, error, isPending } = useTasks();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(([id]) => id === params.get('view'))?.[0] ?? 'list') as View;
  const [filter, setFilter] = useState<TaskFilter>(emptyFilter);
  const [editing, setEditing] = useDeepLinkItem(tasks, t => t.id);

  const shown = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);
  const stats = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'Completed');
    return { open: open.length, overdue: tasks.filter(t => t.overdue).length, hours: open.reduce((n, t) => n + (t.effort ?? 0), 0), done: tasks.length - open.length };
  }, [tasks]);

  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const open = (t: PTask) => setEditing(t);
  return (
    <>
      <PageHead title="Tasks" desc="Your personal tasks across projects — switch between list, cards, kanban and gantt."
        actions={<Btn kind="small primary" icon="plus" iconOnly aria-label="New task" onClick={() => setEditing('new')} />} />
      <div className="stats">
        <Stat label="Open tasks" value={stats.open} foot="Backlog, planned and ongoing" icon="check" />
        <Stat label="Overdue" value={stats.overdue} foot={<span className={stats.overdue ? 'negative' : ''}>Deadline passed, not completed</span>} icon="clock" />
        <Stat label="Open effort" value={hours(stats.hours)} foot="Estimated, open tasks" icon="chart" />
        <Stat label="Completed" value={stats.done} foot="Marked completed" icon="flag" />
        <Stat label="All tasks" value={tasks.length} foot="Across your projects" icon="layers" />
        <Stat label="Completion" value={tasks.length ? Math.round(stats.done / tasks.length * 100) : 0} unit="%" foot="Share of all tasks completed" icon="chart" />
      </div>
      <div className="tabs" role="tablist" aria-label="Task views">
        {VIEWS.map(([id, label, icon]) => (
          <button key={id} className={`tab task-view-tab ${view === id ? 'active' : ''}`} role="tab" aria-label={`${label} view`} title={`${label} view`} aria-selected={view === id} onClick={() => setParams(id === 'list' ? {} : { view: id }, { replace: true })}><Icon name={icon} /></button>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>{VIEWS.find(([id]) => id === view)?.[1]}</h2><p>{shown.length} of {tasks.length} tasks{view === 'kanban' ? ' · drag a card to change its status' : ''}</p></div></div>
        <TaskFilters value={filter} onChange={setFilter} />
        {view === 'list' ? <TaskList tasks={shown} onOpen={open} today={today} />
          : view === 'card' ? <div className="task-cards-wrap"><TaskCards tasks={shown} onOpen={open} today={today} /></div>
          : view === 'kanban' ? <div className="task-cards-wrap"><TaskKanban tasks={shown} onOpen={open} today={today} /></div>
          : <TaskGantt tasks={shown} onOpen={open} today={today} />}
      </div>
      {editing && <TaskForm task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
