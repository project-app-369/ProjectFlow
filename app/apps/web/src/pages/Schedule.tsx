import { useQuery } from '@tanstack/react-query';
import { request, type OverallProgressResponse, type WorkPackagesResponse } from '../api';
import { SectionRisks } from '../SectionRisks';
import { fmtDate, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { ActualPlanBar, ErrorBox, PageHead, Stat, PageSkeleton, Deferred } from '../ui';


function useProgress() {
  const { project } = useApp();
  const overall = useQuery({ queryKey: ['overall-progress', project.id], queryFn: () => request<OverallProgressResponse>(`/projects/${project.id}/schedule/overall-progress`) });
  return overall;
}

export function ProgressOverall() {
  const { data, error, isPending } = useProgress();
  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;
  const cum = data.latest && data.latest.actual != null && data.latest.plan != null ? { actual: data.latest.actual, plan: data.latest.plan } : null;
  const cumVar = cum ? Math.round((cum.actual - cum.plan) * 10) / 10 : null;
  // the work-package sheet holds cumulative figures per week, so the week's own progress is this week minus last week
  const gain = (now: number | null | undefined, before: number | null | undefined) => now != null && before != null ? Math.round((now - before) * 10) / 10 : null;
  const wk = data.lastWeek ? { actual: gain(data.thisWeek.actual, data.lastWeek.actual), plan: gain(data.thisWeek.plan, data.lastWeek.plan) } : null;
  const wkVar = wk && wk.actual != null && wk.plan != null ? Math.round((wk.actual - wk.plan) * 10) / 10 : null;
  const varFoot = (v: number | null) => v == null ? 'Not available' : <span className={v < -0.05 ? 'negative' : v > 0.05 ? 'positive' : ''}>{v < -0.05 ? 'Behind plan' : v > 0.05 ? 'Ahead of plan' : 'On plan'}</span>;
  const pp = (v: number | null) => v == null ? '—' : signed(v);
  return (
    <>
      <PageHead title="Overall Progress" desc={`Cumulative progress of the whole EPCIC scope${data.reportDate ? ` at ${fmtDate(data.reportDate)}` : ''}, with progress by phase.`} />
      <div className="stats">
        <Stat tone="overall" label="Cumulative actual" value={cum ? cum.actual : '—'} unit={cum ? '%' : undefined} foot="Overall, to the cut-off" icon="chart" />
        <Stat tone="overall" label="Cumulative planned" value={cum ? cum.plan : '—'} unit={cum ? '%' : undefined} foot="Overall, to the cut-off" icon="chart" />
        <Stat tone="overall" label="Cumulative variance" value={pp(cumVar)} unit={cumVar != null ? '%' : undefined} foot={varFoot(cumVar)} icon="chart" />
        <Stat tone="week" label="In-week actual" value={pp(wk?.actual ?? null)} unit={wk?.actual != null ? '%' : undefined} foot="Progress made this week" icon="calendar" />
        <Stat tone="week" label="In-week planned" value={pp(wk?.plan ?? null)} unit={wk?.plan != null ? '%' : undefined} foot="Progress planned this week" icon="calendar" />
        <Stat tone="week" label="In-week variance" value={pp(wkVar)} unit={wkVar != null ? '%' : undefined} foot={varFoot(wkVar)} icon="calendar" />
      </div>
      <SCurvePanel points={data.scurveWeekly?.length ? data.scurveWeekly : data.scurve} monthly={data.scurve} defaultCut="monthly" sub="Cumulative weighted progress by weekly or monthly cut-off, with the major milestones" />
      {data.phases?.length ? (
        <div className="panel" style={{ marginTop: 'var(--gap)' }}>
          <div className="panel-head"><div><h2>Progress by phase</h2><p>Actual (bar) against plan (tick)</p></div></div>
          <div className="phase-row">
            {data.phases.map(p => <ActualPlanBar key={p.id} label={p.phase} actual={p.actual} plan={p.plan} />)}
          </div>
        </div>
      ) : null}
      <div style={{ marginTop: 'var(--gap)' }}>
        <Deferred height="20rem"><SectionRisks section="planning" /></Deferred>
      </div>
    </>
  );
}

export function WorkPackages() {
  const { project } = useApp();
  const { data, error, isPending } = useQuery({ queryKey: ['work-packages', project.id], queryFn: () => request<WorkPackagesResponse>(`/projects/${project.id}/schedule/work-packages`) });
  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;
  const { items, overall } = data;
  const wk = overall.thisWeekActual - overall.thisWeekPlan;
  return (
    <>
      <PageHead title="Work Packages" desc="Weekly progress by work package (WP2 – WP6)." />
      <div className="stats">
        <Stat label="Achieved this week" value={overall.thisWeekActual} unit="%" foot={<><span className={wk < 0 ? 'warning' : 'positive'}>{signed(wk)}%</span> vs. {overall.thisWeekPlan}% plan</>} icon="calendar" />
        <Stat label="Last week" value={overall.lastWeekActual} unit="%" foot={`vs ${overall.lastWeekPlan}% planned`} icon="clock" />
        <Stat label="Work packages" value={items.length} foot="Weighted into overall progress" icon="layers" />
        <Stat label="This-week plan" value={overall.thisWeekPlan} unit="%" foot="Cumulative plan, all work packages" icon="chart" />
        <Stat label="Variance" value={signed(wk)} unit="%" foot="Actual less plan this week" icon="risk" />
        <Stat label="Behind plan" value={items.filter(w => w.thisWeekActual != null && w.thisWeekPlan != null && w.thisWeekActual < w.thisWeekPlan).length} foot="Work packages needing recovery" icon="flag" />
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Work package register</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>WORK PACKAGE</th><th>WEIGHT</th><th>LAST WEEK</th><th>THIS WEEK</th><th>VARIANCE</th></tr></thead>
            <tbody>
              {items.map(w => {
                const v = (w.thisWeekActual ?? 0) - (w.thisWeekPlan ?? 0);
                return (
                  <tr key={w.code}>
                    <td><strong>{w.code}</strong><div className="tiny muted">{w.name}</div></td>
                    <td>{(w.weight ?? 0).toFixed(1)}%</td>
                    <td>{w.lastWeekActual ?? 0}% <span className="tiny muted">/ {w.lastWeekPlan ?? 0}% plan</span></td>
                    <td>{w.thisWeekActual ?? 0}% <span className="tiny muted">/ {w.thisWeekPlan ?? 0}% plan</span></td>
                    <td className={v < 0 ? 'negative' : 'positive'}>{signed(v)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
