import { useMemo, useState } from 'react';
import type { PTask } from '../../api';
import { addDays, addMonths, fmtDate, fmtDay, fmtMonth, fmtShort, hours, monthStart, weekStart } from '../../format';
import { Icon } from '../../icons';
import { Btn, ErrorBox, PageHead, PageSkeleton } from '../../ui';
import { applyFilter, emptyFilter, StatusBadges, TaskFilters, TaskForm, UrgencyBadge, useTasks, type TaskFilter } from './common';

type Mode = 'day' | 'week' | 'month';
const MODES: [Mode, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']];

interface Entry { task: PTask; kind: 'plan' | 'due' }

/** What a task puts on a given date: its plan span (start to finish, or the start alone) and its deadline. */
function entriesOn(tasks: PTask[], d: string): Entry[] {
  const out: Entry[] = [];
  for (const t of tasks) {
    const start = t.planStart ?? (t.planFinish ? t.planFinish : null);
    const end = t.planFinish ?? t.planStart;
    if (start && end && start <= d && d <= end) out.push({ task: t, kind: 'plan' });
    if (t.due === d) out.push({ task: t, kind: 'due' });
  }
  return out;
}

function Chip({ e, onOpen }: { e: Entry; onOpen: (t: PTask) => void }) {
  const t = e.task;
  return (
    <button type="button" className={`cal-chip u-${t.urgency.toLowerCase()} ${e.kind} ${t.status === 'Completed' ? 'done' : ''} ${t.overdue ? 'late' : ''}`}
      onClick={() => onOpen(t)} title={`${t.taskNo} · ${t.title} · ${e.kind === 'due' ? 'deadline' : 'planned'}`}>
      {e.kind === 'due' && <Icon name="flag" />}{t.title}
    </button>
  );
}

/** Task Management → Calendar: the same tasks laid out by day, week or month. */
export default function TaskCalendar() {
  const { tasks, today, error, isPending } = useTasks();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(today);
  const [filter, setFilter] = useState<TaskFilter>(emptyFilter);
  const [editing, setEditing] = useState<PTask | { due: string } | null>(null);
  const shown = useMemo(() => applyFilter(tasks, filter), [tasks, filter]);

  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;

  const move = (dir: -1 | 1) => setAnchor(a => (mode === 'day' ? addDays(a, dir) : mode === 'week' ? addDays(a, 7 * dir) : addMonths(monthStart(a), dir)));
  const title = mode === 'day' ? fmtDate(anchor) : mode === 'week' ? `${fmtShort(weekStart(anchor))} – ${fmtDate(addDays(weekStart(anchor), 6))}` : fmtMonth(anchor);
  const open = (t: PTask) => setEditing(t);
  const isTask = (x: PTask | { due: string }): x is PTask => 'id' in x;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i));
  const gridStart = weekStart(monthStart(anchor));
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthKey = anchor.slice(0, 7);

  const dayEntries = entriesOn(shown, anchor);

  return (
    <>
      <PageHead title="Calendar" desc="Planned spans and deadlines of your tasks by day, week or month."
        actions={<Btn kind="small primary" icon="plus" onClick={() => setEditing({ due: anchor })}>New task</Btn>} />
      <div className="panel">
        <div className="panel-head">
          <div><h2>{title}</h2><p>Bars show the plan start to finish; the flag marks the deadline</p></div>
          <div className="actions">
            <span className="period-nav">
              <Btn kind="small" icon="chevron-left" iconOnly aria-label={`Previous ${mode}`} onClick={() => move(-1)} />
              <Btn kind="small" onClick={() => setAnchor(today)}>Today</Btn>
              <Btn kind="small" icon="chevron-right" iconOnly aria-label={`Next ${mode}`} onClick={() => move(1)} />
            </span>
            <span className="seg" role="group" aria-label="Calendar scale">{MODES.map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</span>
          </div>
        </div>
        <TaskFilters value={filter} onChange={setFilter} />

        {mode === 'month' && (
          <div className="cal-month" role="grid" aria-label={title}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
            {monthDays.map(d => {
              const list = entriesOn(shown, d);
              return (
                <div key={d} role="gridcell" className={`cal-cell ${d.startsWith(monthKey) ? '' : 'outside'} ${d === today ? 'today' : ''}`}>
                  <button type="button" className="cal-date" onClick={() => { setAnchor(d); setMode('day'); }} aria-label={fmtDay(d)}>{Number(d.slice(8))}</button>
                  {list.slice(0, 3).map(e => <Chip key={e.task.id + e.kind} e={e} onOpen={open} />)}
                  {list.length > 3 && <button type="button" className="cal-more" onClick={() => { setAnchor(d); setMode('day'); }}>+{list.length - 3} more</button>}
                </div>
              );
            })}
          </div>
        )}

        {mode === 'week' && (
          <div className="cal-week">
            {weekDays.map(d => {
              const list = entriesOn(shown, d);
              return (
                <div key={d} className={`cal-col ${d === today ? 'today' : ''}`}>
                  <button type="button" className="cal-col-head" onClick={() => { setAnchor(d); setMode('day'); }}>{fmtDay(d)}</button>
                  {list.map(e => <Chip key={e.task.id + e.kind} e={e} onOpen={open} />)}
                  {!list.length && <span className="tiny muted">Nothing planned</span>}
                </div>
              );
            })}
          </div>
        )}

        {mode === 'day' && (
          <div className="panel-body">
            {dayEntries.length ? (
              <div className="table-wrap"><table>
                <thead><tr><th>TASK NO</th><th>TASK</th><th>ON THIS DAY</th><th>URGENCY</th><th>STATUS</th><th>EFFORT</th></tr></thead>
                <tbody>{dayEntries.map(e => (
                  <tr key={e.task.id + e.kind}>
                    <td className="mono">{e.task.taskNo}</td>
                    <td><button className="link-button" onClick={() => open(e.task)}><strong>{e.task.title}</strong></button></td>
                    <td><span className="task-meta-item"><Icon name={e.kind === 'due' ? 'flag' : 'calendar'} />{e.kind === 'due' ? 'Deadline' : `${fmtShort(e.task.planStart ?? anchor)} → ${fmtShort(e.task.planFinish ?? e.task.planStart ?? anchor)}`}</span></td>
                    <td><UrgencyBadge urgency={e.task.urgency} text /></td>
                    <td><StatusBadges task={e.task} text /></td>
                    <td>{e.task.effort != null ? hours(e.task.effort) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <div className="empty">Nothing planned or due on {fmtDate(anchor)}.</div>}
          </div>
        )}
      </div>
      {editing && <TaskForm task={isTask(editing) ? editing : null} defaults={isTask(editing) ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
