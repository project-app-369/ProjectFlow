import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { request, type FacilityHead, type FacilityList, type FacilityProgress, type FacilityTimeline, type Milestone } from '../api';
import { fmtDate, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { Timeline, milestoneAt, type TimelineRow } from '../Timeline';
import { useApp } from '../state';
import { ActualPlanBar, Badge, ErrorBox, Loading, PageHead, Stat, PageSkeleton } from '../ui';

const pct = (n: number | null | undefined, digits = 1) => (n == null ? '—' : `${n.toFixed(digits)}`);
const varTone = (v: number | null) => (v == null ? '' : v < -0.05 ? 'negative' : v > 0.05 ? 'positive' : '');
const MS_TONE = { Done: 'green', Overdue: 'red', 'Due soon': 'amber', Planned: 'indigo' } as const;

/** The facility chosen in the address (?facility=), so every facility has its own link. */
function useFacility(list: FacilityList | undefined): [FacilityHead | null, (id: string) => void] {
  const [params, setParams] = useSearchParams();
  const wanted = params.get('facility');
  const facility = list?.facilities.find(f => f.id === wanted) ?? list?.facilities.find(f => !f.later) ?? null;
  return [facility, (id: string) => setParams(p => { const next = new URLSearchParams(p); next.set('facility', id); return next; }, { replace: true })];
}

function useFacilities() {
  const { project } = useApp();
  return useQuery({ queryKey: ['facilities', project.id], queryFn: () => request<FacilityList>(`/projects/${project.id}/facilities`) });
}

function FacilityTabs({ list, value, onChange }: { list: FacilityList; value: string; onChange: (id: string) => void }) {
  return (
    <div className="facility-tabs" role="tablist" aria-label="Facility">
      {list.facilities.map(f => (
        <button key={f.id} type="button" role="tab" aria-selected={f.id === value} className={`facility-tab ${f.id === value ? 'on' : ''}`} onClick={() => onChange(f.id)}>
          <span className="facility-tab-name">{f.label}</span>
          <small>{f.later ? 'Later' : f.headline?.actual != null ? `${pct(f.headline.actual)}%` : '—'}</small>
        </button>
      ))}
    </div>
  );
}

function Later({ facility }: { facility: FacilityHead }) {
  return <div className="panel empty">{facility.label} has no schedule or progress data yet. It will appear here when the workbooks for it are added.</div>;
}

/* ============================ Progress ============================ */
export function FacilityProgressPage() {
  const { project } = useApp();
  const list = useFacilities();
  const [facility, pick] = useFacility(list.data);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const progress = useQuery({
    queryKey: ['facility-progress', project.id, facility?.id], enabled: !!facility && !facility.later,
    queryFn: () => request<FacilityProgress>(`/projects/${project.id}/facilities/${facility!.id}/progress`),
  });

  if (list.isPending) return <PageSkeleton />;
  if (list.error) return <ErrorBox error={list.error} />;
  if (!facility) return null;

  const data = progress.data;
  const scope = data ? data.scopes.find(s => s.scope === scopeId) ?? data.scopes.find(s => s.headline) ?? data.scopes[0] : null;
  const head = data?.scopes.find(s => s.headline) ?? null;

  return (
    <>
      <PageHead title="Progress by facility" desc="Cumulative progress against plan for each facility, from the progress-monitoring workbooks." />
      <FacilityTabs list={list.data} value={facility.id} onChange={id => { setScopeId(null); pick(id); }} />
      {facility.later ? <Later facility={facility} /> : progress.error ? <ErrorBox error={progress.error} /> : !data || !scope ? <Loading /> : (
        <>
          <div className="stats">
            <Stat label="Actual" value={head?.actual ?? '—'} unit="%" foot={head ? <ActualPlanBar actual={head.actual} plan={head.plan} compact hideActual /> : '—'} icon="chart" />
            <Stat label="Plan" value={head?.plan ?? '—'} unit="%" foot={head?.asOf ? `At the week of ${fmtDate(head.asOf)}` : '—'} icon="calendar" />
            <Stat label="Variance" value={head?.variance != null ? signed(head.variance) : '—'} unit="%" foot={<span className={varTone(head?.variance ?? null)}>{head?.variance == null ? '—' : head.variance < 0 ? 'Behind plan' : 'On or ahead of plan'}</span>} icon="risk" />
            <Stat label="Forecast" value={head?.forecast ?? '—'} unit={head?.forecast != null ? '%' : undefined} foot={head?.forecast != null ? 'At the same week' : 'No forecast in the workbook yet'} icon="clock" />
            <Stat label="Milestones" value={`${data.facility.milestones.done}/${data.facility.milestones.total}`} foot={`${data.facility.milestones.overdue} overdue`} icon="flag" />
          </div>

          <SCurvePanel
            title={`${facility.label} S-curve`} points={scope.points} milestones={data.milestones} cutoff={scope.asOf}
            schedule={data.scheduleCheck && data.scheduleCheck.scope === scope.scope ? data.scheduleCheck.curve : null}
            sub={`${scope.label} · cumulative progress by cut-off${data.milestones.length ? ', with the facility milestones' : ''}${data.scheduleCheck && data.scheduleCheck.scope === scope.scope ? ', checked against the working schedule' : ''}`}
            controls={data.scopes.length > 1 ? (
              <select className="filter" aria-label="Curve" value={scope.scope} onChange={e => setScopeId(e.target.value)}>
                {data.scopes.map(s => <option key={s.scope} value={s.scope}>{s.label}</option>)}
              </select>
            ) : undefined}
          />

          {data.scheduleCheck && <ScheduleCheckPanel check={data.scheduleCheck} />}

          <section className="panel">
            <div className="panel-head"><div><h2>Progress by scope</h2><p>Actual (bar) against plan (tick) in the reporting week{head?.asOf ? ` of ${fmtDate(head.asOf)}` : ''}</p></div></div>
            <div className="fac-scopes">
              {data.scopes.map(s => (
                <div key={s.scope} className="fac-scope">
                  <ActualPlanBar label={<>{s.label}{s.weight != null && <small className="muted"> · weight {pct(s.weight, 0)}%</small>}</>} actual={s.actual} plan={s.plan} />
                  <span className={`tiny ${varTone(s.variance)}`}>{s.variance == null ? '—' : `${signed(s.variance)}%`}</span>
                </div>
              ))}
            </div>
          </section>

          <MilestoneList title="Facility milestones" items={data.milestones} cutoff={data.cutoff} />
        </>
      )}
    </>
  );
}

function MilestoneList({ title, items, cutoff }: { title: string; items: Milestone[]; cutoff: string }) {
  const rows = [...items].sort((a, b) => String(a.actual ?? a.forecast ?? a.planBaseline).localeCompare(String(b.actual ?? b.forecast ?? b.planBaseline)));
  return (
    <section className="panel">
      <div className="panel-head"><div><h2>{title}</h2><p>{items.filter(m => m.status === 'Done').length} of {items.length} achieved · cut-off {fmtDate(cutoff)}</p></div></div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>KEY DATE</th><th>BASELINE</th><th>FORECAST</th><th>ACTUAL</th><th>STATUS</th></tr></thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.id}>
                  <td className="mono">{m.id}</td>
                  <td data-label="Key date"><strong>{m.description}</strong></td>
                  <td data-label="Baseline">{fmtDate(m.planBaseline)}</td>
                  <td data-label="Forecast">{fmtDate(m.forecast)}</td>
                  <td data-label="Actual">{fmtDate(m.actual)}</td>
                  <td data-label="Status"><Badge tone={MS_TONE[m.status]}>{m.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">No key milestone is recorded for this facility.</div>}
    </section>
  );
}

/** The S-curve plan beside the progress the baseline and the working schedule imply at the same week. */
function ScheduleCheckPanel({ check }: { check: NonNullable<FacilityProgress['scheduleCheck']> }) {
  const gap = check.plan != null && check.working != null ? check.working - check.plan : null;
  return (
    <section className="panel">
      <div className="panel-head"><div><h2>Plan checked against the working schedule</h2><p>{check.label}{check.asOf ? ` · week of ${fmtDate(check.asOf)}` : ''} · each activity advances evenly between its start and finish, weighted by its duration</p></div></div>
      <div className="stats">
        <Stat label="S-curve plan" value={check.plan ?? '—'} unit={check.plan != null ? '%' : undefined} foot="Manhour-weighted plan" icon="chart" />
        <Stat label="Baseline schedule" value={check.baseline ?? '—'} unit={check.baseline != null ? '%' : undefined} foot="Duration-weighted, baseline dates" icon="calendar" />
        <Stat label="Working schedule" value={check.working ?? '—'} unit={check.working != null ? '%' : undefined} foot="Duration-weighted, working dates" icon="clock" />
        <Stat label="Working vs plan" value={gap != null ? signed(gap) : '—'} unit={gap != null ? '%' : undefined} foot={gap == null ? '—' : gap > 0 ? 'The working schedule runs ahead of the plan' : 'The working schedule is behind the plan'} icon="risk" />
      </div>
    </section>
  );
}

/* ============================ Schedule ============================ */
export function FacilitySchedulePage() {
  const { project } = useApp();
  const timeline = useQuery({ queryKey: ['facility-timeline', project.id], queryFn: () => request<FacilityTimeline>(`/projects/${project.id}/facility-timeline`) });
  if (timeline.isPending) return <PageSkeleton />;
  if (timeline.error) return <ErrorBox error={timeline.error} />;
  const data = timeline.data;
  const dated = (m: { actual: string | null; forecast: string | null; working: string | null; baseline: string | null }) => String(milestoneAt(m as never));
  const rows: TimelineRow[] = data.facilities.map(f => {
    const todo = f.milestones.filter(m => m.status !== 'Done').sort((x, y) => dated(x).localeCompare(dated(y)))[0];
    const finished = f.milestones.filter(m => m.status === 'Done').length;
    const schedule = f.start && f.finish ? `Schedule ${fmtDate(f.start)} → ${fmtDate(f.finish)}` : null;
    const progress = f.actual != null ? `${f.basis ?? 'Progress'} ${pct(f.actual)}%${f.plan != null ? ` of ${pct(f.plan)}% plan` : ''}` : null;
    const ms = f.milestones.length ? `Milestones ${finished}/${f.milestones.length}${todo ? ` · next ${fmtDate(milestoneAt(todo))}` : ' · all achieved'}` : null;
    return {
      id: f.id, label: f.label, later: f.later && !f.milestones.length, start: f.start, finish: f.finish, workStart: f.workStart, workFinish: f.workFinish, actual: f.actual, milestones: f.milestones,
      sub: [schedule, progress, ms].filter(Boolean) as string[],
    };
  });
  return (
    <>
      <PageHead title="Schedule" desc="Every facility on one timeline: its planned span (the Primavera schedule; for CGF Jacket the fabrication subcontractor's schedule), its overall progress, and its key milestones." />
      <section className="panel">
        <div className="panel-head"><div><h2>Facility timeline</h2><p>Bar: planned span, filled by overall progress · diamonds: key milestones, at their achieved, forecast or working-schedule date · cut-off {fmtDate(data.cutoff)}</p></div></div>
        <div className="panel-content"><Timeline rows={rows} cutoff={data.cutoff} label="Facility schedule timeline with milestones" /></div>
      </section>
    </>
  );
}
