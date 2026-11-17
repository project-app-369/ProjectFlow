import { useQuery } from '@tanstack/react-query';
import { request, type CpnData } from '../api';
import { fmtDate, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { Timeline, milestoneAt, type TimelineRow } from '../Timeline';
import { Badge, ErrorBox, PageHead, Stat, PageSkeleton } from '../ui';

const pct = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
const tone = (v: number | null) => (v == null ? '' : v < -0.05 ? 'negative' : v > 0.05 ? 'positive' : '');
const FACILITIES = ['CGF Topsides', 'CGF Jacket', 'Pile', 'Conductor', 'Bridge', 'LQ Module #2', 'Pipeline', 'Project'];

/**
 * Critical path network: the progress of the CPN plan (work-package weights re-based on the critical path) beside the baseline plan,
 * the activities of the working schedule that have no float left against the baseline finish, and the key milestones as a chain
 * per facility, each with the float between its working-schedule date and its baseline date.
 */
export function CriticalPathNetwork() {
  const { project } = useApp();
  const q = useQuery({ queryKey: ['cpn', project.id], queryFn: () => request<CpnData>(`/projects/${project.id}/cpn`) });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const o = d.overall;
  const rows: TimelineRow[] = FACILITIES.map(f => {
    const ms = d.milestones.filter(m => m.facility === f || (f === 'Project' && !FACILITIES.slice(0, -1).includes(m.facility)));
    const dated = ms.map(milestoneAt).filter(Boolean).sort() as string[];
    return { id: f, label: f, sub: dated.length ? `${ms.length} key dates · ${fmtDate(dated[0])} → ${fmtDate(dated[dated.length - 1])}` : undefined, milestones: ms };
  }).filter(r => r.milestones.length);
  const next = d.milestones.filter(m => m.status !== 'Done').sort((a, b) => String(milestoneAt(a)).localeCompare(String(milestoneAt(b))))[0];

  return (
    <>
      <PageHead title="Critical path network" desc="Progress of the CPN plan by work package, the activities with no float left, and the chain of key milestones." />
      <div className="stats">
        <Stat label="CPN actual" value={o?.actual ?? '—'} unit="%" foot={o ? `${pct(o.baseActual)}% on the baseline weights` : '—'} icon="chart" tone="overall" />
        <Stat label="CPN plan" value={o?.plan ?? '—'} unit="%" foot={d.asOf ? `At the week of ${fmtDate(d.asOf)}` : '—'} icon="calendar" tone="overall" />
        <Stat label="CPN variance" value={o?.variance != null ? signed(o.variance) : '—'} unit="%" foot={<span className={tone(o?.variance ?? null)}>{o?.variance == null ? '—' : o.variance < 0 ? 'Behind the CPN plan' : 'On or ahead of the CPN plan'}</span>} icon="risk" tone="overall" />
        <Stat label="In-week actual" value={o?.actual != null && o.lastActual != null ? signed(o.actual - o.lastActual) : '—'} unit="%" foot={o?.plan != null && o.lastPlan != null ? `Plan ${signed(o.plan - o.lastPlan)}%` : '—'} icon="clock" tone="week" />
        <Stat label="Critical activities" value={d.critical.count} foot={`Float of ${d.critical.threshold} days or less, of ${d.critical.total} scheduled`} icon="risk" />
        <Stat label="Next key date" value={next ? fmtDate(milestoneAt(next)) : '—'} foot={next ? next.description : 'All achieved'} icon="flag" />
      </div>

      <SCurvePanel
        title="CPN S-curve" points={d.curve} milestones={[]} cutoff={d.asOf}
        sub={`Cumulative progress on the critical path network, by cut-off · cut-off ${fmtDate(d.cutoff)}`}
      />

      <section className="panel">
        <div className="panel-head"><div><h2>Progress by work package</h2><p>CPN plan and actual at the cut-off, beside the baseline plan; the CPN weight is the share of each package in the critical path network</p></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th rowSpan={2}>WORK PACKAGE</th><th colSpan={4} className="num">CPN</th><th colSpan={4} className="num">BASELINE</th></tr>
              <tr><th className="num">WEIGHT %</th><th className="num">PLAN %</th><th className="num">ACTUAL %</th><th className="num">VAR %</th><th className="num">WEIGHT %</th><th className="num">PLAN %</th><th className="num">ACTUAL %</th><th className="num">VAR %</th></tr>
            </thead>
            <tbody>
              {d.packages.map(w => (
                <tr key={w.code}>
                  <td data-label="Work package"><strong>{w.code}</strong> · {w.name}</td>
                  <td className="num" data-label="CPN weight">{pct(w.weight)}</td>
                  <td className="num" data-label="CPN plan">{pct(w.plan)}</td>
                  <td className="num" data-label="CPN actual">{pct(w.actual)}</td>
                  <td className={`num ${tone(w.variance)}`} data-label="CPN variance">{w.variance == null ? '—' : signed(w.variance)}</td>
                  <td className="num muted" data-label="Baseline weight">{pct(w.baseWeight)}</td>
                  <td className="num muted" data-label="Baseline plan">{pct(w.basePlan)}</td>
                  <td className="num muted" data-label="Baseline actual">{pct(w.baseActual)}</td>
                  <td className={`num ${tone(w.baseVariance)}`} data-label="Baseline variance">{w.baseVariance == null ? '—' : signed(w.baseVariance)}</td>
                </tr>
              ))}
              {o && (
                <tr className="total-row">
                  <td data-label="Work package"><strong>CPN overall</strong></td>
                  <td className="num" data-label="CPN weight">{pct(o.weight)}</td>
                  <td className="num" data-label="CPN plan"><strong>{pct(o.plan)}</strong></td>
                  <td className="num" data-label="CPN actual"><strong>{pct(o.actual)}</strong></td>
                  <td className={`num ${tone(o.variance)}`} data-label="CPN variance">{o.variance == null ? '—' : signed(o.variance)}</td>
                  <td className="num muted" data-label="Baseline weight">100.0</td>
                  <td className="num muted" data-label="Baseline plan">{pct(o.basePlan)}</td>
                  <td className="num muted" data-label="Baseline actual">{pct(o.baseActual)}</td>
                  <td className={`num ${tone(o.basePlan != null && o.baseActual != null ? o.baseActual - o.basePlan : null)}`} data-label="Baseline variance">{o.basePlan != null && o.baseActual != null ? signed(o.baseActual - o.basePlan) : '—'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Key-milestone network</h2><p>Each facility's key dates in order, drawn at their achieved, forecast or working-schedule date · hover a diamond for its baseline, working, forecast and achieved dates</p></div></div>
        <div className="panel-content"><Timeline rows={rows} cutoff={d.cutoff} chain label="Key milestone network by facility" /></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Critical activities</h2><p>CGF Topsides activities not yet finished whose working-schedule finish (or re-schedule, where there is one) leaves {d.critical.threshold} days or less before the baseline finish{d.critical.count > d.critical.items.length ? ` · the ${d.critical.items.length} with the least float of ${d.critical.count}` : ` · ${d.critical.count} in all`}</p></div></div>
        {d.critical.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ACTIVITY</th><th>NAME</th><th>SECTION</th><th>WORKING FINISH</th><th>BASELINE FINISH</th><th className="num">FLOAT (DAYS)</th></tr></thead>
              <tbody>
                {d.critical.items.map(a => (
                  <tr key={a.id + a.name}>
                    <td className="mono" data-label="Activity">{a.id}</td>
                    <td data-label="Name"><strong>{a.name}</strong></td>
                    <td data-label="Section">{a.top}</td>
                    <td data-label="Working finish">{fmtDate(a.finish)}{a.reFinish ? <small className="muted"> · re-scheduled</small> : null}</td>
                    <td data-label="Baseline finish">{fmtDate(a.baseFinish)}</td>
                    <td className="num" data-label="Float (days)"><Badge tone={a.float < 0 ? 'red' : a.float === 0 ? 'amber' : 'indigo'}>{a.float}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No unfinished activity is within {d.critical.threshold} days of its baseline finish.</div>}
      </section>
    </>
  );
}
