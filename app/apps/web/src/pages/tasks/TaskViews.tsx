import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TASK_STATUSES, type PTask, type TaskStatus } from '../../api';
import { DataTable } from '../../DataTable';
import { LoadMore, useProgressive } from '../../lazyList';
import { addDays, diffDays, fmtDate, fmtShort, hours, monthStart, addMonths, weekStart } from '../../format';
import { Icon } from '../../icons';
import { ZoomSlider, useZoomAnchor } from '../../zoom';
import { IconSelect, ProjectChips, StatusBadges, statusOptions, SubtaskProgress, UrgencyBadge, useTaskMutations } from './common';

interface ViewProps { tasks: PTask[]; onOpen: (t: PTask) => void; today: string }

/* ============================ List ============================ */
const URGENCY_RANK = { Low: 0, Normal: 1, High: 2, Urgent: 3 } as const;
const STATUS_RANK = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i])) as Record<TaskStatus, number>;
const sortValue: Record<string, (t: PTask) => string | number> = {
  taskNo: t => t.taskNo, title: t => t.title.toLowerCase(), urgency: t => URGENCY_RANK[t.urgency], status: t => STATUS_RANK[t.status],
  assigner: t => (t.assigner ?? '').toLowerCase(), due: t => t.due ?? '9999', effort: t => t.effort ?? -1, planStart: t => t.planStart ?? '9999',
};

const PHONE = '(max-width: 720px)';
/** True on phones, where the list view shows the same cards as the card view instead of a table. */
function usePhone() {
  return useSyncExternalStore(
    cb => { const mq = window.matchMedia(PHONE); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

export function TaskList({ tasks, onOpen, today }: ViewProps) {
  const phone = usePhone();
  const [sort, setSort] = useState<{ sort?: string; order: 'asc' | 'desc' }>({ sort: 'taskNo', order: 'asc' });
  const rows = useMemo(() => {
    const get = sortValue[sort.sort ?? 'taskNo'];
    return [...tasks].sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (sort.order === 'asc' ? 1 : -1));
  }, [tasks, sort]);
  const columns = useMemo<ColumnDef<PTask>[]>(() => [
    { id: 'taskNo', header: 'TASK NO', meta: { sortKey: 'taskNo' }, cell: ({ row: { original: t } }) => <span className="mono">{t.taskNo}</span> },
    {
      id: 'title', header: 'TASK', meta: { sortKey: 'title' },
      cell: ({ row: { original: t } }) => <button className="link-button" onClick={() => onOpen(t)}><strong className={t.status === 'Completed' ? 'struck' : ''}>{t.title}</strong>{t.description && <small className="muted clamp">{t.description}</small>}</button>,
    },
    { id: 'urgency', header: 'URGENCY', meta: { sortKey: 'urgency' }, cell: ({ row: { original: t } }) => <UrgencyBadge urgency={t.urgency} text /> },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: t } }) => <StatusBadges task={t} text /> },
    { id: 'assigner', header: 'ASSIGNED BY', meta: { sortKey: 'assigner' }, cell: ({ row: { original: t } }) => t.assigner ?? '—' },
    { id: 'projects', header: 'PROJECTS', cell: ({ row: { original: t } }) => <ProjectChips ids={t.projects} /> },
    { id: 'plan', header: 'PLAN DATES', meta: { sortKey: 'planStart' }, cell: ({ row: { original: t } }) => (t.planStart || t.planFinish ? `${t.planStart ? fmtShort(t.planStart) : '…'} → ${t.planFinish ? fmtShort(t.planFinish) : '…'}` : '—') },
    { id: 'due', header: 'DUE DATE', meta: { sortKey: 'due' }, cell: ({ row: { original: t } }) => <span className={t.overdue ? 'negative' : ''}>{fmtDate(t.due)}</span> },
    { id: 'effort', header: 'EFFORT', meta: { sortKey: 'effort' }, cell: ({ row: { original: t } }) => (t.effort != null ? hours(t.effort) : '—') },
    { id: 'subs', header: 'SUBTASKS', cell: ({ row: { original: t } }) => <SubtaskProgress task={t} /> },
  ], [onOpen]);
  const view = useProgressive(rows, 60, `${sort.sort}:${sort.order}`);
  if (phone) return <div className="task-cards-wrap"><TaskCards tasks={rows} onOpen={onOpen} today={today} /></div>;
  return (
    <div className="task-list"><DataTable columns={columns} data={view.shown} revealFrom={view.revealFrom} state={sort}
      rowClassName={t => `task-row urgency-${t.urgency.toLowerCase()}`}
      onSort={key => setSort(s => ({ sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc' }))} empty="No tasks match. Change the filters or add a task." />
      {rows.length > 60 && <LoadMore source={view.lazy} noun="tasks" />}</div>
  );
}

/* ============================ Cards ============================ */
export function TaskCards({ tasks, onOpen }: ViewProps) {
  const { update, move } = useTaskMutations();
  const view = useProgressive(tasks, 36);
  if (!tasks.length) return <div className="empty">No tasks match. Change the filters or add a task.</div>;
  return (
    <>
    <div className="card-grid">
      {view.shown.map((t, i) => (
        <article className={`task-card urgency-${t.urgency.toLowerCase()} ${t.overdue ? 'is-overdue' : ''}${i >= view.revealFrom ? ' row-in' : ''}`} key={t.id} data-lazy-item="">
          <div className="task-top"><span className="mono tiny muted">{t.taskNo}</span><div className="task-top-actions"><UrgencyBadge urgency={t.urgency} />{t.overdue && <span className="task-symbol overdue" role="img" aria-label="Overdue" title="Overdue"><Icon name="clock" /></span>}<IconSelect className="status-picker" value={t.status} options={statusOptions} label={`Change ${t.taskNo} status`} onChange={status => move.mutate({ id: t.id, status: status as TaskStatus })} /></div></div>
          <h3 className={t.status === 'Completed' ? 'struck' : ''}><button className="link-button" onClick={() => onOpen(t)}>{t.title}</button></h3>
          {t.description && <p className="clamp">{t.description}</p>}
          <div className="chips"><ProjectChips ids={t.projects} /></div>
          <div className="task-meta tiny muted">
            {t.assigner && <span className="task-meta-item" title="Assigned by"><Icon name="user" />{t.assigner}</span>}
            {t.due && <span className={`task-meta-item ${t.overdue ? 'negative' : ''}`} title={t.overdue ? 'Overdue' : 'Due date'}><Icon name="flag" />{fmtDate(t.due)}</span>}
            {t.effort != null && <span className="task-meta-item" title="Estimated effort"><Icon name="hourglass" />{hours(t.effort)}</span>}
          </div>
          {t.subtasks.length > 0 && (
            <ul className="subtask-list">
              {t.subtasks.map(s => (
                <li key={s.id}>
                  <label className={s.done ? 'done' : ''}>
                    <input type="checkbox" className="switch" checked={s.done}
                      onChange={e => update.mutate({ id: t.id, subtasks: t.subtasks.map(x => (x.id === s.id ? { ...x, done: e.target.checked } : x)) })} />
                    {s.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {t.remarks && <p className="tiny muted remarks">{t.remarks}</p>}
        </article>
      ))}
    </div>
    {tasks.length > 36 && <LoadMore source={view.lazy} noun="tasks" />}
    </>
  );
}

/* ============================ Kanban ============================ */
export function TaskKanban({ tasks, onOpen }: ViewProps) {
  const { move } = useTaskMutations();
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drop = (status: TaskStatus, id: string) => {
    setOver(null); setDragging(null);
    const t = tasks.find(x => x.id === id);
    if (t && t.status !== status) move.mutate({ id, status });
  };
  return (
    <div className="board board-4" aria-label="Kanban board">
      {TASK_STATUSES.map(col => {
        const cards = tasks.filter(t => t.status === col);
        const h = cards.reduce((n, t) => n + (t.effort ?? 0), 0);
        return (
          <section
            key={col} className={`board-column ${over === col ? 'drop-target' : ''}`} aria-label={col}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== col) setOver(col); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={e => { e.preventDefault(); drop(col, e.dataTransfer.getData('text/plain')); }}
          >
            <h3><span className={`task-symbol status-${col.toLowerCase()}`} aria-hidden="true"><Icon name={`status-${col.toLowerCase()}`} /></span><span className="col-label">{col}</span><span className="count">{cards.length}</span>{h > 0 && <span className="tiny muted col-hours">{hours(h)}</span>}</h3>
            {cards.map(t => (
              <article
                key={t.id} draggable className={`task-card kanban-card urgency-${t.urgency.toLowerCase()} ${t.overdue ? 'is-overdue' : ''} ${dragging === t.id ? 'dragging' : ''}`}
                onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragging(t.id); }}
                onDragEnd={() => { setDragging(null); setOver(null); }}
              >
                <div className="task-top"><span className="mono tiny muted">{t.taskNo}</span><div className="task-top-actions"><UrgencyBadge urgency={t.urgency} />{t.overdue && <span className="task-symbol overdue" role="img" aria-label="Overdue" title="Overdue"><Icon name="clock" /></span>}<IconSelect className="status-picker kanban-move" value={t.status} options={statusOptions} label={`Change ${t.taskNo} status`} onChange={status => move.mutate({ id: t.id, status: status as TaskStatus })} /></div></div>
                <h3 className={t.status === 'Completed' ? 'struck' : ''}><button className="link-button" onClick={() => onOpen(t)}>{t.title}</button></h3>
                <div className="chips"><ProjectChips ids={t.projects} /></div>
                <div className="task-meta tiny muted">
                  {t.due && <span className={`task-meta-item ${t.overdue ? 'negative' : ''}`} title={t.overdue ? 'Overdue' : 'Due date'}><Icon name="flag" />{fmtShort(t.due)}</span>}
                  {t.effort != null && <span className="task-meta-item" title="Estimated effort"><Icon name="hourglass" />{hours(t.effort)}</span>}
                  {t.subtasksTotal > 0 && <span className="task-meta-item" title="Subtasks complete"><Icon name="status-completed" />{t.subtasksDone}/{t.subtasksTotal}</span>}
                </div>
              </article>
            ))}
            {!cards.length && <div className="tiny muted drop-hint">{over === col ? 'Drop to move here' : 'No tasks. Drag a card here.'}</div>}
          </section>
        );
      })}
    </div>
  );
}

/* ============================ Gantt ============================ */
const ZOOM = { Day: 30, Week: 12, Month: 4 } as const;
const ZOOM_MIN = 1.5, ZOOM_MAX = 48;

export function TaskGantt({ tasks, onOpen, today }: ViewProps) {
  const [px, setPx] = useState<number>(ZOOM.Week);
  const scroller = useRef<HTMLDivElement>(null);
  const zoomTo = useZoomAnchor(scroller, px, setPx, 240);
  const ready = tasks.filter(t => t.ganttReady);
  const hidden = tasks.length - ready.length;

  const range = useMemo(() => {
    if (!ready.length) return null;
    const all = ready.flatMap(t => [t.planStart!, t.planFinish!, t.due!]).concat(today);
    const min = weekStart(all.reduce((a, b) => (a < b ? a : b)));
    const max = addDays(all.reduce((a, b) => (a > b ? a : b)), 7);
    return { min, days: diffDays(min, max) + 1 };
  }, [ready, today]);

  if (!range) {
    return <div className="empty">{tasks.length ? 'No task has plan start, plan finish and a deadline yet.' : 'No tasks match.'}<br /><span className="tiny">Set all three dates on a task to see it here.</span></div>;
  }
  const x = (d: string) => diffDays(range.min, d) * px;
  const width = range.days * px;

  // header segments: months on top, weeks (or days) below
  const months: { label: string; left: number; width: number }[] = [];
  for (let m = monthStart(range.min); m <= addDays(range.min, range.days); m = addMonths(m, 1)) {
    const start = m < range.min ? range.min : m;
    const end = addDays(addMonths(m, 1), -1);
    const last = addDays(range.min, range.days - 1);
    months.push({ label: new Date(`${m}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }), left: x(start), width: (diffDays(start, end < last ? end : last) + 1) * px });
  }
  const ticks: { label: string; left: number }[] = [];
  const stepDays = px >= 20 ? 1 : px >= 8 ? 7 : 14;
  for (let d = range.min; d <= addDays(range.min, range.days - 1); d = addDays(d, stepDays)) ticks.push({ label: String(Number(d.slice(8))), left: x(d) });

  return (
    <div className="gantt">
      <div className="gantt-bar">
        <span className="tiny muted">{ready.length} of {tasks.length} tasks shown{hidden > 0 && ` · ${hidden} need plan start, plan finish and a deadline`}</span>
        <span className="actions">
          <ZoomSlider value={px} min={ZOOM_MIN} max={ZOOM_MAX} onChange={zoomTo} />
          <span className="seg" role="group" aria-label="Scale">{(Object.entries(ZOOM) as [string, number][]).map(([z, v]) => <button key={z} type="button" aria-pressed={Math.abs(px - v) < 0.5} onClick={() => zoomTo(v)}>{z}</button>)}</span>
        </span>
      </div>
      <div className="gantt-scroll" ref={scroller}>
        <div className="gantt-grid" style={{ width: 240 + width }}>
          <div className="gantt-head">
            <div className="gantt-name gantt-name-head">Task</div>
            <div className="gantt-track" style={{ width }}>
              {months.map(m => <span key={m.label + m.left} className="gantt-month" style={{ left: m.left, width: m.width }}>{m.label}</span>)}
              {ticks.map(t => <span key={t.left} className="gantt-tick" style={{ left: t.left }}>{t.label}</span>)}
            </div>
          </div>
          {ready.map(t => (
            <div className={`gantt-row urgency-${t.urgency.toLowerCase()}`} key={t.id}>
              <div className="gantt-name"><button className="link-button" onClick={() => onOpen(t)}><span className="mono tiny muted">{t.taskNo}</span> <strong>{t.title}</strong></button></div>
              <div className="gantt-track" style={{ width }}>
                <span className="gantt-today" style={{ left: x(today) + px / 2 }} title={`Today ${fmtDate(today)}`} />
                <span
                  className={`gantt-span s-${t.status.toLowerCase()} urgency-${t.urgency.toLowerCase()} ${t.overdue ? 'late' : ''}`}
                  style={{ left: x(t.planStart!), width: (diffDays(t.planStart!, t.planFinish!) + 1) * px }}
                  title={`${t.title}: ${fmtDate(t.planStart)} → ${fmtDate(t.planFinish)} · ${t.urgency} urgency · ${t.status}`}
                >
                  {t.subtasksTotal > 0 && <span className="gantt-fill" style={{ width: `${(t.subtasksDone / t.subtasksTotal) * 100}%` }} />}
                </span>
                <span className="gantt-due" style={{ left: x(t.due!) + px / 2 }} title={`Deadline ${fmtDate(t.due)}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="legend panel-body">
        <span><span className="dot" style={{ background: 'var(--teal)' }} />Plan start → finish</span>
        <span><span className="gantt-due-key" />Deadline</span>
        <span><span className="gantt-today-key" />Today</span>
        {(['Planned', 'Ongoing', 'Completed'] as const).map(s => <span key={s} className="legend-status"><span className={`task-symbol status-${s.toLowerCase()}`} aria-hidden="true"><Icon name={`status-${s.toLowerCase()}`} /></span>{s}</span>)}
      </div>
    </div>
  );
}
