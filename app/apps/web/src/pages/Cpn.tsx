import { useQuery } from '@tanstack/react-query';
import { request, type CpnData } from '../api';
import { fmtDate, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { milestoneAt } from '../Timeline';
import { ErrorBox, PageHead, Stat, PageSkeleton } from '../ui';

const pct = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
const tone = (v: number | null) => (v == null ? '' : v < -0.05 ? 'negative' : v > 0.05 ? 'positive' : '');

/**
 * Critical path network: the progress of the CPN plan (work-package weights re-based on the critical path) beside the baseline plan.
 */
export function CriticalPathNetwork() {
  const { project } = useApp();
  const q = useQuery({ queryKey: ['cpn', project.id], queryFn: () => request<CpnData>(`/projects/${project.id}/cpn`) });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const o = d.overall;
  const next = d.milestones.filter(m => m.status !== 'Done').sort((a, b) => String(milestoneAt(a)).localeCompare(String(milestoneAt(b))))[0];

  return (
    <>
      <PageHead title="Critical path network" desc="Progress of the CPN plan by work package." />
      <div className="stats">
        <Stat label="CPN actual" value={o?.actual ?? '—'} unit="%" foot={o ? `${pct(o.baseActual)}% on the baseline weights` : '—'} icon="chart" tone="overall" />
        <Stat label="CPN plan" value={o?.plan ?? '—'} unit="%" foot={d.asOf ? `At the week of ${fmtDate(d.asOf)}` : '—'} icon="calendar" tone="overall" />
        <Stat label="CPN variance" value={o?.variance != null ? signed(o.variance) : '—'} unit="%" foot={<span className={tone(o?.variance ?? null)}>{o?.variance == null ? '—' : o.variance < 0 ? 'Behind the CPN plan' : 'On or ahead of the CPN plan'}</span>} icon="risk" tone="overall" />
        <Stat label="In-week actual" value={o?.actual != null && o.lastActual != null ? signed(o.actual - o.lastActual) : '—'} unit="%" foot={o?.plan != null && o.lastPlan != null ? `Plan ${signed(o.plan - o.lastPlan)}%` : '—'} icon="clock" tone="week" />
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
    </>
  );
}
