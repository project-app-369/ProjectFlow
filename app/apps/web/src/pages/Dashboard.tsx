import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type Dashboard as DashboardData } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { ActualPlanBar, Badge, ErrorBox, Loading, PageHead, Stat } from '../ui';


const Unavailable = ({ label }: { label: string }) => (
  <div className="panel empty">{label} is turned off. <Link className="btn text" to="/settings/modules">Open module settings</Link></div>
);

export default function Dashboard() {
  const { project } = useApp();
  const { data, error, isPending } = useQuery({ queryKey: ['dashboard', project.id], queryFn: () => request<DashboardData>(`/projects/${project.id}/dashboard`) });
  if (isPending) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const { overallProgress: op, workPackages: wp } = data;
  const latest = op?.latest;
  const behind = wp ? wp.items.filter(w => (w.thisWeekActual ?? 0) < (w.thisWeekPlan ?? 0)).length : 0;
  const move = op?.lastWeek ? op.thisWeek.actual - op.lastWeek.actual : null;
  const ms = data.milestones;

  return (
    <>
      <PageHead title="Project overview" desc={`${project.name} — EPCIC progress${op?.reportDate ? ` at ${fmtDate(op.reportDate)}` : ''}, by work package and phase.`} />
      <div className="stats">
        <Stat label="EPCIC progress" value={op ? latest?.actual ?? 0 : '—'} unit={op ? '%' : undefined}
          foot={op && latest ? <ActualPlanBar actual={latest.actual} plan={latest.plan} compact hideActual /> : 'Overall Progress is off'} icon="chart" />
        <Stat label="Progress this period" value={move != null ? `${move > 0 ? '+' : ''}${move.toFixed(1)}` : '—'} unit={move != null ? 'pp' : undefined} foot="Change in actual since last week" icon="calendar" />
        <Stat label="Work packages" value={wp?.items.length ?? '—'} foot={wp ? <span className={behind ? 'warning' : 'positive'}>{behind} behind plan · {wp.items.length - behind} on or ahead</span> : 'Work Packages is off'} icon="layers" />
        <Stat label="Milestones overdue" value={ms?.overdue ?? '—'} foot={ms ? `${ms.dueSoon} due in 30 days · ${ms.done} of ${ms.total} achieved` : 'Milestones are off'} icon="flag" />
      </div>

      <div className="grid-main">
        {op ? (
          <SCurvePanel points={op.scurve} sub="Cumulative weighted progress of the whole scope, plan vs. actual, with the major milestones" />
        ) : <Unavailable label="Overall Progress" />}

        {ms ? (
          <div className="panel">
            <div className="panel-head"><div><h2>Next milestones</h2><p>The earliest key dates not yet achieved</p></div><Icon name="flag" /></div>
            {ms.next.slice(0, 5).map(m => (
              <div className="list-card" key={m.id}>
                <Icon name="flag" />
                <div className="grow"><p>{m.description}</p><small>{m.facility ?? m.subName ?? m.id} · {fmtDate(m.forecast ?? m.planBaseline)}</small></div>
                <Badge tone={m.status === 'Overdue' ? 'red' : m.status === 'Due soon' ? 'amber' : 'indigo'}>{m.status}</Badge>
              </div>
            ))}
            {!ms.next.length && <div className="empty">Every milestone is achieved.</div>}
            <div className="panel-foot"><Link className="btn text" to="/m/planning.milestones">Open milestones →</Link></div>
          </div>
        ) : <Unavailable label="Milestones" />}
      </div>

      <div className="bottom-grid">
        {wp ? (
          <div className="panel">
            <div className="panel-head"><div><h2>Work package progress</h2><p>This week · planned vs. actual</p></div></div>
            <div style={{ padding: '5px 24px 22px' }}>
              {wp.items.map(w => (
                <div style={{ margin: '14px 0' }} key={w.code}>
                  <ActualPlanBar label={w.name} actual={w.thisWeekActual} plan={w.thisWeekPlan} />
                </div>
              ))}
            </div>
            <div className="panel-foot"><Link className="btn text" to="/m/planning.work-packages">Open work packages →</Link></div>
          </div>
        ) : <Unavailable label="Work Packages" />}

        {op?.phases?.length ? (
          <div className="panel">
            <div className="panel-head"><div><h2>Progress by phase</h2><p>Actual (bar) against plan (tick){op.reportDate ? ` · ${fmtDate(op.reportDate)}` : ''}</p></div></div>
            <div style={{ padding: '5px 24px 22px' }}>
              {op.phases.map(p => <div style={{ margin: '14px 0' }} key={p.id}><ActualPlanBar label={p.phase} actual={p.actual} plan={p.plan} /></div>)}
            </div>
            <div className="panel-foot"><Link className="btn text" to="/m/planning.overall-progress">Open overall progress →</Link></div>
          </div>
        ) : null}
      </div>
    </>
  );
}
