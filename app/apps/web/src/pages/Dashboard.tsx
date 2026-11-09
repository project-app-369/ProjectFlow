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

  const { overallProgress: op, workPackages: wp, procurement: pr, expediting: ex } = data;
  const latest = op?.latest;
  const gap = latest ? (latest.actual ?? 0) - (latest.plan ?? 0) : 0;
  const poPlaced = pr?.byStatus['PO placed'] ?? 0;

  return (
    <>
      <PageHead title="Project overview" desc={`${project.name} — progress, procurement and delivery priorities.`} />
      <div className="stats">
        <Stat label="Work packages tracked" value={wp?.items.length ?? '—'} foot="WP2 – WP6 · EPCIC scope" icon="layers" />
        <Stat label="Cumulative procurement progress" value={op ? latest?.actual ?? 0 : '—'} unit={op ? '%' : undefined}
          foot={op ? <><span className={gap < 0 ? 'warning' : 'positive'}>{gap.toFixed(1)} pp</span> vs. {latest?.plan}% planned</> : 'Overall Progress is off'} icon="chart" />
        <Stat label="Procurement packages" value={pr?.total ?? '—'} foot={pr ? `${poPlaced} PO placed · ${pr.total - poPlaced} in progress` : 'Procurement Plan is off'} icon="box" />
        <Stat label="Expediting flags" value={ex ? ex.delayed + ex.atRisk : '—'} foot={ex ? <><span className="negative">{ex.delayed} delayed</span> · {ex.atRisk} at risk</> : 'Vendor Overview is off'} icon="calendar" />
        <Stat label="Milestones overdue" value={data.milestones?.overdue ?? '—'} foot={data.milestones ? `${data.milestones.dueSoon} due in 30 days` : 'Milestones unavailable'} icon="flag" />
        <Stat label="Active risks" value={data.risks?.active ?? '—'} foot={data.risks ? `${data.risks.reviewOverdue} reviews overdue` : 'Risk register unavailable'} icon="risk" />
      </div>

      <div className="grid-main">
        {op ? (
          <div className="panel">
            <div className="panel-head"><div><h2>Procurement S-curve</h2><p>Cumulative weighted progress, plan vs. actual</p></div></div>
            <Suspense fallback={<Loading label="Loading chart…" />}><SCurveChart points={op.scurve} /></Suspense>
          </div>
        ) : <Unavailable label="Overall Progress" />}

        {ex ? (
          <div className="panel">
            <div className="panel-head"><div><h2>Needs attention</h2><p>Open expediting flags with a recorded highlight</p></div><Icon name="risk" /></div>
            <div className="watchlist">
              {ex.flags.slice(0, 4).map(f => (
                <div className="watch-item" key={f.id}>
                  <span className={`watch-symbol ${f.status === 'Delay' ? 'red' : ''}`}><Icon name={f.status === 'Delay' ? 'clock' : 'risk'} /></span>
                  <div><h3>{f.name || f.code}</h3><p>{f.vendor || f.code} · <Badge>{f.status}</Badge></p></div>
                </div>
              ))}
              {!ex.flags.length && <div className="empty">No open flags.</div>}
            </div>
            <div className="panel-foot"><Link className="btn text" to="/m/procurement.expediting.vendor-overview">View expediting register →</Link></div>
          </div>
        ) : <Unavailable label="Vendor Overview" />}
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

        {pr ? (
          <div className="panel">
            <div className="panel-head"><h2>Procurement by discipline</h2></div>
            {Object.entries(pr.byDiscipline).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
              <div className="list-card" key={d}><Icon name="box" /><div className="grow"><p>{d}</p></div><span className="tiny muted">{n} packages</span></div>
            ))}
            <div className="panel-foot"><Link className="btn text" to="/m/procurement.procurement-plan">Open procurement →</Link></div>
          </div>
        ) : <Unavailable label="Procurement Plan" />}
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
