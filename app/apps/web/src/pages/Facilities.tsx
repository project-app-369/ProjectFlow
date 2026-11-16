import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { request, type FacilityHead, type FacilityList, type FacilityProgress, type FacilitySchedule, type FacilityWbsRow, type Milestone } from '../api';
import { addDays, addMonths, diffDays, fmtDate, monthStart, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { ZoomSlider, useZoomAnchor } from '../zoom';
import { ActualPlanBar, Badge, ErrorBox, Loading, PageHead, Stat } from '../ui';

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

  if (list.isPending) return <Loading />;
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
            <Stat label="Variance" value={head?.variance != null ? signed(head.variance) : '—'} unit="pp" foot={<span className={varTone(head?.variance ?? null)}>{head?.variance == null ? '—' : head.variance < 0 ? 'Behind plan' : 'On or ahead of plan'}</span>} icon="risk" />
            <Stat label="Forecast" value={head?.forecast ?? '—'} unit={head?.forecast != null ? '%' : undefined} foot={head?.forecast != null ? 'At the same week' : 'No forecast in the workbook yet'} icon="clock" />
            <Stat label="Milestones" value={`${data.facility.milestones.done}/${data.facility.milestones.total}`} foot={`${data.facility.milestones.overdue} overdue`} icon="flag" />
          </div>

          <SCurvePanel
            title={`${facility.label} S-curve`} points={scope.points} milestones={data.milestones} cutoff={scope.asOf}
            sub={`${scope.label} · cumulative progress, weekly${data.milestones.length ? ', with the facility milestones' : ''}`}
            controls={data.scopes.length > 1 ? (
              <select className="filter" aria-label="Curve" value={scope.scope} onChange={e => setScopeId(e.target.value)}>
                {data.scopes.map(s => <option key={s.scope} value={s.scope}>{s.label}</option>)}
              </select>
            ) : undefined}
          />

          <section className="panel">
            <div className="panel-head"><div><h2>Progress by scope</h2><p>Actual (bar) against plan (tick) in the reporting week{head?.asOf ? ` of ${fmtDate(head.asOf)}` : ''}</p></div></div>
            <div className="fac-scopes">
              {data.scopes.map(s => (
                <div key={s.scope} className="fac-scope">
                  <ActualPlanBar label={<>{s.label}{s.weight != null && <small className="muted"> · weight {pct(s.weight, 0)}%</small>}</>} actual={s.actual} plan={s.plan} />
                  <span className={`tiny ${varTone(s.variance)}`}>{s.variance == null ? '—' : `${signed(s.variance)} pp`}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><h2>WBS progress</h2><p>Cumulative this week against plan, by work breakdown node</p></div></div>
            {data.wbs.length ? <WbsProgress rows={data.wbs} /> : <div className="empty">No WBS progress for this facility.</div>}
          </section>

          <MilestoneList title="Facility milestones" items={data.milestones} cutoff={data.cutoff} />
        </>
      )}
    </>
  );
}

function WbsProgress({ rows }: { rows: FacilityWbsRow[] }) {
  return (
    <div className="table-wrap">
      <table className="fac-wbs">
        <thead><tr><th>WBS</th><th>WEIGHT %</th><th>PLAN %</th><th>ACTUAL %</th><th>VAR PP</th><th>START</th><th>FINISH</th></tr></thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.code} className={w.shared ? 'shared' : ''}>
              <td><span className="wbs-name" style={{ '--lvl': Math.max(0, w.level - 2) } as CSSProperties}><strong>{w.name}</strong><small className="muted mono">{w.code.replace('STTP2B-', '')}{w.shared ? ' · shared with the jacket and bridge' : ''}</small></span></td>
              <td data-label="Weight %">{pct(w.weight)}</td>
              <td data-label="Plan %">{pct(w.plan)}</td>
              <td data-label="Actual %">{pct(w.actual)}</td>
              <td data-label="Var pp" className={varTone(w.variance)}>{w.variance == null ? '—' : signed(w.variance)}</td>
              <td data-label="Start">{fmtDate(w.start)}</td>
              <td data-label="Finish">{fmtDate(w.finish)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

/* ============================ Schedule ============================ */
/** Pixels per day: the presets, and the range of the zoom slider. */
const ZOOM = { Quarter: 1.1, Month: 2.6, Week: 7 } as const;
const ZOOM_MIN = 0.4, ZOOM_MAX = 14;
const NAME_W = 15 * 16; // matches .gantt-name (15rem)

export function FacilitySchedulePage() {
  const { project } = useApp();
  const list = useFacilities();
  const [facility, pick] = useFacility(list.data);
  const [px, setPx] = useState<number>(ZOOM.Month);
  const [depth, setDepth] = useState(4);
  const schedule = useQuery({
    queryKey: ['facility-schedule', project.id, facility?.id], enabled: !!facility && !facility.later,
    queryFn: () => request<FacilitySchedule>(`/projects/${project.id}/facilities/${facility!.id}/schedule`),
  });

  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorBox error={list.error} />;
  if (!facility) return null;
  const data = schedule.data;

  return (
    <>
      <PageHead title="Schedule by facility" desc="The planned WBS of each facility from the Primavera schedule, with progress at the cut-off and the key milestones." />
      <FacilityTabs list={list.data} value={facility.id} onChange={pick} />
      {facility.later ? <Later facility={facility} /> : schedule.error ? <ErrorBox error={schedule.error} /> : !data ? <Loading /> : (
        <>
          <ScheduleStats data={data} />
          <Gantt data={data} px={px} setPx={setPx} depth={depth} setDepth={setDepth} />
          <MilestoneList title="Facility milestones" items={data.milestones} cutoff={data.cutoff} />
        </>
      )}
    </>
  );
}

function ScheduleStats({ data }: { data: FacilitySchedule }) {
  const { facility, cutoff } = data;
  const total = facility.start && facility.finish ? diffDays(facility.start, facility.finish) : null;
  const done = facility.start ? Math.max(0, diffDays(facility.start, cutoff)) : null;
  const left = facility.finish ? diffDays(cutoff, facility.finish) : null;
  const next = [...data.milestones].filter(m => m.status !== 'Done').sort((a, b) => String(a.forecast ?? a.planBaseline).localeCompare(String(b.forecast ?? b.planBaseline)))[0];
  return (
    <div className="stats">
      <Stat label="Planned start" value={facility.start ? fmtDate(facility.start) : '—'} foot="First WBS activity" icon="calendar" />
      <Stat label="Planned finish" value={facility.finish ? fmtDate(facility.finish) : '—'} foot={left == null ? '—' : left >= 0 ? `${left} days after the cut-off` : `${-left} days before the cut-off`} icon="flag" />
      <Stat label="Duration" value={total == null ? '—' : Math.round(total / 30.4)} unit={total == null ? undefined : 'months'} foot={total == null ? '—' : `${total} calendar days`} icon="clock" />
      <Stat label="Elapsed" value={total && done != null ? Math.min(100, Math.round((done / total) * 100)) : '—'} unit={total ? '%' : undefined} foot={`At the cut-off ${fmtDate(cutoff)}`} icon="chart" />
      <Stat label="Next milestone" value={next ? fmtDate(next.forecast ?? next.planBaseline) : '—'} foot={next ? next.description : 'All achieved'} icon="flag" />
    </div>
  );
}

function Gantt({ data, px, setPx, depth, setDepth }: { data: FacilitySchedule; px: number; setPx: (v: number) => void; depth: number; setDepth: (n: number) => void }) {
  const rows = useMemo(() => data.wbs.filter(w => w.start && w.finish && w.level <= depth), [data.wbs, depth]);
  const maxLevel = useMemo(() => data.wbs.reduce((m, w) => Math.max(m, w.level), 2), [data.wbs]);
  const msDate = (m: Milestone) => m.actual ?? m.forecast ?? m.planBaseline;
  const scroller = useRef<HTMLDivElement>(null);
  const zoomTo = useZoomAnchor(scroller, px, setPx, NAME_W);
  const pxNow = useRef(px);
  pxNow.current = px;

  const range = useMemo(() => {
    const all = [...rows.flatMap(w => [w.start!, w.finish!]), ...data.milestones.map(msDate).filter((d): d is string => !!d), data.cutoff];
    const min = monthStart(all.reduce((a, b) => (a < b ? a : b)));
    const max = addDays(all.reduce((a, b) => (a > b ? a : b)), 21);
    return { min, days: diffDays(min, max) + 1 };
  }, [rows, data.milestones, data.cutoff]);

  // open on the cut-off, a little to the right of the names column, instead of at the start of the project
  const hasRows = rows.length > 0;
  useEffect(() => {
    const el = scroller.current;
    if (el && hasRows) el.scrollLeft = Math.max(0, diffDays(range.min, data.cutoff) * pxNow.current - el.clientWidth * 0.3);
  }, [hasRows, range.min, data.cutoff]);

  if (!rows.length) return <div className="panel empty">No scheduled WBS is recorded for this facility.</div>;

  const x = (d: string) => diffDays(range.min, d) * px;
  const width = range.days * px;
  const months: { label: string; left: number; width: number }[] = [];
  for (let m = range.min; m <= addDays(range.min, range.days); m = addMonths(m, 1)) {
    const next = addMonths(m, 1);
    const end = next < addDays(range.min, range.days) ? next : addDays(range.min, range.days);
    months.push({ label: new Date(`${m}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: px < 2 ? '2-digit' : 'numeric', timeZone: 'UTC' }), left: x(m), width: diffDays(m, end) * px });
  }
  const ms = data.milestones.filter(m => msDate(m));

  return (
    <section className="panel fgantt">
      <div className="panel-head">
        <div><h2>{data.facility.label} schedule</h2><p>{rows.length} WBS nodes · bar fill is the progress at the cut-off</p></div>
        <div className="actions">
          <select className="filter" aria-label="WBS levels shown" value={depth} onChange={e => setDepth(Number(e.target.value))}>
            {Array.from({ length: Math.max(1, maxLevel - 2) }, (_, i) => i + 3).map(l => <option key={l} value={l}>{l === maxLevel ? 'All levels' : `To level ${l}`}</option>)}
          </select>
          <ZoomSlider value={px} min={ZOOM_MIN} max={ZOOM_MAX} onChange={zoomTo} />
          <div className="seg" role="group" aria-label="Time scale">
            {(Object.entries(ZOOM) as [string, number][]).map(([z, v]) => <button key={z} type="button" className={Math.abs(px - v) < 0.05 ? 'on' : ''} aria-pressed={Math.abs(px - v) < 0.05} onClick={() => zoomTo(v)}>{z}</button>)}
          </div>
        </div>
      </div>
      <div className="gantt-scroll" ref={scroller}>
        <div className="gantt-grid" style={{ width: NAME_W + width }}>
          <div className="gantt-head">
            <div className="gantt-name gantt-name-head">WBS</div>
            <div className="gantt-track" style={{ width }}>
              {months.map(m => <span key={m.left} className="gantt-month" style={{ left: m.left, width: m.width }}>{m.label}</span>)}
            </div>
          </div>
          {ms.length > 0 && (
            <div className="gantt-row fgantt-ms">
              <div className="gantt-name"><strong>Key milestones</strong></div>
              <div className="gantt-track" style={{ width }}>
                <span className="gantt-today" style={{ left: x(data.cutoff) }} title={`Cut-off ${fmtDate(data.cutoff)}`} />
                {ms.map(m => (
                  <span key={m.id} className={`fgantt-diamond ms-${m.status.replace(' ', '-').toLowerCase()}`} style={{ left: x(msDate(m)!) }}
                    title={`${m.description}\n${fmtDate(msDate(m))} · ${m.status}`} />
                ))}
              </div>
            </div>
          )}
          {rows.map(w => {
            const span = Math.max(1, diffDays(w.start!, w.finish!) + 1);
            const fill = w.actual != null ? Math.max(0, Math.min(100, w.actual)) : null;
            const late = w.variance != null && w.variance < -5;
            return (
              <div className={`gantt-row fgantt-l${Math.min(w.level, 5)}`} key={w.code}>
                <div className="gantt-name" style={{ paddingLeft: `calc(var(--sp-4) + ${Math.max(0, w.level - 2)} * var(--sp-3))` }} title={`${w.name}\n${w.code}`}>
                  <span className={w.level <= 3 ? 'fgantt-strong' : ''}>{w.name}</span>
                </div>
                <div className="gantt-track" style={{ width }}>
                  <span className="gantt-today" style={{ left: x(data.cutoff) }} />
                  <span className={`gantt-span fgantt-bar ${late ? 'late' : ''}`} style={{ left: x(w.start!), width: span * px }}
                    title={`${w.name}\n${fmtDate(w.start)} → ${fmtDate(w.finish)}${w.plan != null ? `\nPlan ${pct(w.plan)}%` : ''}${w.actual != null ? ` · Actual ${pct(w.actual)}%` : ''}`}>
                    {fill != null && <span className="gantt-fill" style={{ width: `${fill}%` }} />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="legend fgantt-legend">
        <span><span className="fgantt-key bar" />WBS node, filled to its progress</span>
        <span><span className="fgantt-key late" />More than 5 pp behind plan</span>
        <span><span className="gantt-today-key" />Cut-off</span>
        <span><span className="fgantt-diamond key ms-done" />Achieved</span>
        <span><span className="fgantt-diamond key ms-overdue" />Overdue</span>
        <span><span className="fgantt-diamond key ms-planned" />Planned</span>
      </div>
    </section>
  );
}
