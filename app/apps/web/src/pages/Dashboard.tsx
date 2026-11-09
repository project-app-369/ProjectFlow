import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type Dashboard as DashboardData } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useApp } from '../state';
import { ActualPlanBar, Badge, ErrorBox, Loading, PageHead, Stat } from '../ui';

const SCurveChart = lazy(() => import('../SCurveChart'));

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
  const ms = data.milestones, rk = data.risks, itf = data.interfaces;
  const hot = rk ? (rk.byLevel.High ?? 0) + (rk.byLevel.Extreme ?? 0) : 0;

  return (
    <>
      <PageHead title="Project overview" desc={`${project.name} — EPCIC progress${op?.reportDate ? ` at ${fmtDate(op.reportDate)}` : ''}, by work package and phase.`} />
      <div className="stats">
        <Stat label="EPCIC progress" value={op ? latest?.actual ?? 0 : '—'} unit={op ? '%' : undefined}
          foot={op && latest ? <ActualPlanBar actual={latest.actual} plan={latest.plan} compact /> : 'Overall Progress is off'} icon="chart" />
        <Stat label="Progress this period" value={move != null ? `${move > 0 ? '+' : ''}${move.toFixed(1)}` : '—'} unit={move != null ? 'pp' : undefined} foot="Change in actual since last week" icon="calendar" />
        <Stat label="Work packages" value={wp?.items.length ?? '—'} foot={wp ? <span className={behind ? 'warning' : 'positive'}>{behind} behind plan · {wp.items.length - behind} on or ahead</span> : 'Work Packages is off'} icon="layers" />
        <Stat label="Milestones overdue" value={ms?.overdue ?? '—'} foot={ms ? `${ms.dueSoon} due in 30 days · ${ms.done} of ${ms.total} achieved` : 'Milestones are off'} icon="flag" />
        <Stat label="Active risks" value={rk?.active ?? '—'} foot={rk ? <span className={hot ? 'negative' : ''}>{hot} high or extreme · {rk.reviewOverdue} reviews overdue</span> : 'Risks are off'} icon="risk" />
        <Stat label="Open interfaces" value={itf?.open ?? '—'} foot={itf ? `${itf.overdue} overdue · ${itf.pointsOpen} open points` : 'Interfaces are off'} icon="link" />
      </div>

      <div className="grid-main">
        {op ? (
          <div className="panel">
            <div className="panel-head"><div><h2>EPCIC S-curve</h2><p>Cumulative weighted progress of the whole scope, plan vs. actual</p></div></div>
            <Suspense fallback={<Loading label="Loading chart…" />}><SCurveChart points={op.scurve} /></Suspense>
          </div>
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

      {(data.milestones !== undefined || data.risks !== undefined || data.interfaces !== undefined) && (
        <div className="bottom-grid dashboard-registers">
          {data.milestones === undefined ? null : data.milestones ? (
            <div className="panel">
              <div className="panel-head"><div><h2>Milestones</h2><p>{data.milestones.done} of {data.milestones.total} achieved</p></div><Icon name="flag" /></div>
              {data.milestones.next.slice(0, 3).map(m => (
                <div className="list-card" key={m.id}><div className="grow"><p>{m.description}</p><small>{m.subName ?? '—'} · {fmtDate(m.forecast ?? m.planBaseline)}</small></div><Badge>{m.status}</Badge></div>
              ))}
              <div className="list-card"><div className="grow"><small>{data.milestones.overdue} overdue · {data.milestones.dueSoon} due in 30 days</small></div></div>
              <div className="panel-foot"><Link className="btn text" to="/m/planning.milestones">Open milestones →</Link></div>
            </div>
          ) : <Unavailable label="Milestones" />}

          {data.risks === undefined ? null : data.risks ? (
            <div className="panel">
              <div className="panel-head"><div><h2>Risks</h2><p>{data.risks.active} active of {data.risks.total}</p></div><Icon name="risk" /></div>
              {(['Extreme', 'High', 'Medium', 'Low'] as const).map(l => (
                <div className="list-card" key={l}><span className={`dot level-${l.toLowerCase()}`} /><div className="grow"><p>{l}</p></div><span className="tiny muted">{data.risks!.byLevel[l]}</span></div>
              ))}
              <div className="list-card"><div className="grow"><small>{data.risks.reviewOverdue} reviews overdue</small></div></div>
              <div className="panel-foot"><Link className="btn text" to="/m/management.risks">Open risk register →</Link></div>
            </div>
          ) : <Unavailable label="Risks" />}

          {data.interfaces === undefined ? null : data.interfaces ? (
            <div className="panel">
              <div className="panel-head"><div><h2>Interfaces</h2><p>{data.interfaces.open} open of {data.interfaces.total}</p></div><Icon name="link" /></div>
              <div className="list-card"><div className="grow"><p>Overdue</p></div><span className={`tiny ${data.interfaces.overdue ? 'negative' : 'muted'}`}>{data.interfaces.overdue}</span></div>
              <div className="list-card"><div className="grow"><p>Open points</p></div><span className="tiny muted">{data.interfaces.pointsOpen}</span></div>
              {Object.entries(data.interfaces.byStatus).filter(([, n]) => n > 0).map(([st, n]) => (
                <div className="list-card" key={st}><div className="grow"><small>{st}</small></div><span className="tiny muted">{n}</span></div>
              ))}
              <div className="panel-foot"><Link className="btn text" to="/m/interface.register">Open register →</Link></div>
            </div>
          ) : <Unavailable label="Interface Management" />}
        </div>
      )}
    </>
  );
}
