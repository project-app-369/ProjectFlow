import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PERSONAL_KEY, request, type Workload, type WorkloadStat } from '../../api';
import { addDays, addMonths, fmtShort, hours, localToday, monthStart, weekStart } from '../../format';
import { useApp } from '../../state';
import { Btn, ErrorBox, PageHead, Stat, PageSkeleton } from '../../ui';
import { useProjectLabels } from './common';

// Projects are categories with no status meaning: the shared categorical palette (--cat-1..8), themed for light and dark.
const PALETTE = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `var(--cat-${n})`);
const PERIODS = { week: 12, month: 9 } as const;
const STEP = { week: 4, month: 3 } as const;

/** Task Management → Workload: tasks and estimated hours per week or month, by project. */
export default function TaskWorkload() {
  const { me } = useApp();
  const label = useProjectLabels();
  const today = localToday();
  const [by, setBy] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0); // in periods, relative to the default window
  const [openOnly, setOpenOnly] = useState(false);

  const first = by === 'week' ? addDays(weekStart(today), (offset - 4) * 7) : addMonths(monthStart(today), offset - 2);
  const last = by === 'week' ? addDays(first, (PERIODS.week - 1) * 7) : addMonths(first, PERIODS.month - 1);
  const q = useQuery({
    queryKey: ['ptask-workload', me?.id, by, first, last, today],
    queryFn: () => request<Workload>(`/tasks/workload?by=${by}&from=${first}&to=${last}&today=${today}`),
  });

  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const w = q.data;
  const hrs = (s: WorkloadStat) => (openOnly ? s.openHours : s.hours);
  const cnt = (s: WorkloadStat) => (openOnly ? s.open : s.tasks);
  const colour = (id: string) => PALETTE[Math.max(0, w.projects.indexOf(id)) % PALETTE.length];
  const maxHours = Math.max(1, ...w.periods.map(p => hrs(p.total)));
  const periodLabel = (p: Workload['periods'][number]) => (by === 'week' ? `${fmtShort(p.start)} – ${fmtShort(p.end)}` : new Date(`${p.start}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }));
  const noData = w.totals.total.tasks === 0;

  return (
    <>
      <PageHead title="Workload" desc="Estimated hours and task counts per period, by project. A task counts in the period of its deadline (else plan finish, else plan start)." />
      <div className="stats">
        <Stat label={`Tasks in view`} value={cnt(w.totals.total)} foot={openOnly ? 'Open tasks only' : 'All statuses'} icon="check" />
        <Stat label="Hours in view" value={hours(hrs(w.totals.total))} foot={`${w.periods.length} ${by}s`} icon="clock" />
        <Stat label="Unscheduled" value={cnt(w.unscheduled)} foot={`${hours(hrs(w.unscheduled))} · no date set`} icon="calendar" />
        <Stat label="Outside this range" value={w.outside.tasks} foot={`${hours(w.outside.hours)} · use ‹ › to look further`} icon="layers" />
        <Stat label="Total assigned" value={w.totals.total.tasks} foot="All statuses across periods" icon="box" />
        <Stat label="Open assigned" value={w.totals.total.open} foot="Tasks still to complete" icon="flag" />
      </div>
      <div className="panel">
        <div className="panel-head">
          <div><h2>Per {by}</h2><p>{fmtShort(w.from)} – {fmtShort(w.to)}</p></div>
          <div className="actions">
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />Open tasks only</label>
            <Btn kind="small" aria-label="Earlier" onClick={() => setOffset(o => o - STEP[by])}>‹</Btn>
            <Btn kind="small" onClick={() => setOffset(0)}>Today</Btn>
            <Btn kind="small" aria-label="Later" onClick={() => setOffset(o => o + STEP[by])}>›</Btn>
            <Btn kind={`small ${by === 'week' ? 'primary' : ''}`} onClick={() => { setBy('week'); setOffset(0); }}>Week</Btn>
            <Btn kind={`small ${by === 'month' ? 'primary' : ''}`} onClick={() => { setBy('month'); setOffset(0); }}>Month</Btn>
          </div>
        </div>
        {noData ? <div className="empty">No dated tasks in this range.</div> : (
          <>
            <div className="legend panel-body">
              {w.projects.map(id => <span key={id}><span className="dot" style={{ background: colour(id) }} />{label(id)}</span>)}
            </div>
            <div className="table-wrap">
              <table className="workload">
                <thead><tr><th>{by === 'week' ? 'WEEK' : 'MONTH'}</th><th>HOURS (stacked by project)</th>{w.projects.map(id => <th key={id}>{label(id).toUpperCase()}</th>)}<th>TOTAL</th></tr></thead>
                <tbody>
                  {w.periods.map(p => {
                    const current = by === 'week' ? p.start === weekStart(today) : p.start === monthStart(today);
                    return (
                      <tr key={p.start} className={current ? 'current-period' : ''}>
                        <td><strong>{periodLabel(p)}</strong>{current && <span className="tiny muted"> · now</span>}</td>
                        <td style={{ minWidth: 220 }}>
                          <div className="stack">
                            {w.projects.map(id => {
                              const s = p.byProject[id];
                              return s && hrs(s) > 0 ? <span key={id} className="stack-seg" style={{ width: `${(hrs(s) / maxHours) * 100}%`, background: colour(id) }} title={`${label(id)}: ${hours(hrs(s))}`} /> : null;
                            })}
                          </div>
                        </td>
                        {w.projects.map(id => {
                          const s = p.byProject[id];
                          return <td key={id}>{s && cnt(s) > 0 ? <span><strong>{hours(hrs(s))}</strong> <span className="muted tiny">{cnt(s)} task{cnt(s) === 1 ? '' : 's'}</span></span> : <span className="tiny muted">—</span>}</td>;
                        })}
                        <td><strong>{hours(hrs(p.total))}</strong> <span className="muted tiny">{cnt(p.total)} task{cnt(p.total) === 1 ? '' : 's'}</span></td>
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td><strong>Total</strong></td><td />
                    {w.projects.map(id => { const s = w.totals.byProject[id]; return <td key={id}>{s ? <><strong>{hours(hrs(s))}</strong> <span className="muted tiny">{cnt(s)}</span></> : '—'}</td>; })}
                    <td><strong>{hours(hrs(w.totals.total))}</strong> <span className="muted tiny">{cnt(w.totals.total)} unique</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="tiny muted panel-body">
              A task linked to several projects counts in each of them, so project columns can add up to more than the total, which counts each task once.
              {w.projects.includes(PERSONAL_KEY) && ' “No project” holds tasks that are not linked to any project.'}
            </p>
          </>
        )}
      </div>
    </>
  );
}
