import { useQuery } from '@tanstack/react-query';
import { request, type OverallProgressResponse, type WorkPackagesResponse } from '../api';
import { fmtDate, signed } from '../format';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { ActualPlanBar, ErrorBox, Loading, PageHead, Stat } from '../ui';


function useProgress() {
  const { project } = useApp();
  const overall = useQuery({ queryKey: ['overall-progress', project.id], queryFn: () => request<OverallProgressResponse>(`/projects/${project.id}/schedule/overall-progress`) });
  return overall;
}

export function ProgressOverall() {
  const { data, error, isPending } = useProgress();
  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const wk = data.thisWeek.actual - data.thisWeek.plan;
  return (
    <>
      <PageHead title="Overall Progress" desc={`Cumulative progress of the whole EPCIC scope${data.reportDate ? ` at ${fmtDate(data.reportDate)}` : ''}, with progress by phase.`} />
      <div className="stats">
        <Stat label="Cumulative actual" value={data.latest?.actual ?? 0} unit="%" foot={`vs ${data.latest?.plan ?? 0}% planned`} icon="chart" />
        <Stat label="Achieved this week" value={data.thisWeek.actual} unit="%" foot={<><span className={wk < 0 ? 'warning' : 'positive'}>{signed(wk)} pp</span> vs. {data.thisWeek.plan}% plan</>} icon="calendar" />
        <Stat label="Work packages" value={data.workPackageCount} foot="WP2 – WP6" icon="layers" />
        <Stat label="Overall variance" value={signed(wk)} unit="pp" foot="Achieved vs. planned, this week" icon="risk" />
        <Stat label="Cumulative plan" value={data.latest?.plan ?? '—'} unit="%" foot="At latest reported period" icon="flag" />
        <Stat label="Forecast" value={data.latest?.forecast ?? '—'} unit="%" foot="At latest reported period" icon="clock" />
      </div>
      <SCurvePanel points={data.scurve} sub="Cumulative weighted progress · monthly cut-offs, with the major milestones" />
      {data.phases?.length ? (
        <div className="panel" style={{ marginTop: 22 }}>
          <div className="panel-head"><div><h2>Progress by phase</h2><p>Actual (bar) against plan (tick)</p></div></div>
          <div style={{ padding: '5px 24px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,18rem),1fr))', gap: '14px 28px' }}>
            {data.phases.map(p => <ActualPlanBar key={p.id} label={p.phase} actual={p.actual} plan={p.plan} />)}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WorkPackages() {
  const { project } = useApp();
  const { data, error, isPending } = useQuery({ queryKey: ['work-packages', project.id], queryFn: () => request<WorkPackagesResponse>(`/projects/${project.id}/schedule/work-packages`) });
  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const { items, overall } = data;
  const wk = overall.thisWeekActual - overall.thisWeekPlan;
  return (
    <>
      <PageHead title="Work Packages" desc="Weekly progress by work package (WP2 – WP6)." />
      <div className="stats">
        <Stat label="Achieved this week" value={overall.thisWeekActual} unit="%" foot={<><span className={wk < 0 ? 'warning' : 'positive'}>{signed(wk)} pp</span> vs. {overall.thisWeekPlan}% plan</>} icon="calendar" />
        <Stat label="Last week" value={overall.lastWeekActual} unit="%" foot={`vs ${overall.lastWeekPlan}% planned`} icon="clock" />
        <Stat label="Work packages" value={items.length} foot="Weighted into overall progress" icon="layers" />
        <Stat label="This-week plan" value={overall.thisWeekPlan} unit="%" foot="Cumulative plan, all work packages" icon="chart" />
        <Stat label="Variance" value={signed(wk)} unit="pp" foot="Actual less plan this week" icon="risk" />
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
                    <td className={v < 0 ? 'negative' : 'positive'}>{signed(v)} pp</td>
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
