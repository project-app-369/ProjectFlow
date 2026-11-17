import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, type Dashboard as DashboardData } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { SCurvePanel } from '../SCurvePanel';
import { useApp } from '../state';
import { ActualPlanBar, Badge, ErrorBox, PageHead, Stat, PageSkeleton } from '../ui';


const Unavailable = ({ label }: { label: string }) => (
  <div className="panel empty">{label} is turned off. <Link className="btn text" to="/settings/modules">Open module settings</Link></div>
);

export default function Dashboard() {
  const { project } = useApp();
  const { data, error, isPending } = useQuery({ queryKey: ['dashboard', project.id], queryFn: () => request<DashboardData>(`/projects/${project.id}/dashboard`) });
  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorBox error={error} />;

  const { overallProgress: op, workPackages: wp } = data;
  const latest = op?.latest;
  const ms = data.milestones;
  const cum = latest && latest.actual != null && latest.plan != null ? { actual: latest.actual, plan: latest.plan } : null;
  const cumVar = cum ? cum.actual - cum.plan : null;
  // the work-package sheet holds cumulative figures per week, so the week's own progress is this week minus last week
  const gain = (now: number | null | undefined, before: number | null | undefined) => now != null && before != null ? Math.round((now - before) * 10) / 10 : null;
  const wk = op?.lastWeek ? { actual: gain(op.thisWeek.actual, op.lastWeek.actual), plan: gain(op.thisWeek.plan, op.lastWeek.plan) } : null;
  const wkVar = wk && wk.actual != null && wk.plan != null ? Math.round((wk.actual - wk.plan) * 10) / 10 : null;
  const varFoot = (v: number | null) => v == null ? 'Not available' : <span className={v < -0.05 ? 'negative' : v > 0.05 ? 'positive' : ''}>{v < -0.05 ? 'Behind plan' : v > 0.05 ? 'Ahead of plan' : 'On plan'}</span>;

  return (
    <>
      <PageHead title="Project overview" desc={`${project.name} — EPCIC progress${op?.reportDate ? ` at ${fmtDate(op.reportDate)}` : ''}, by work package and phase.`} />
      <div className="stats">
        <Stat tone="overall" label="Cumulative actual" value={cum ? cum.actual : '—'} unit={cum ? '%' : undefined} foot={op ? 'Overall, to the cut-off' : 'Overall Progress is off'} icon="chart" />
        <Stat tone="overall" label="Cumulative planned" value={cum ? cum.plan : '—'} unit={cum ? '%' : undefined} foot="Overall, to the cut-off" icon="chart" />
        <Stat tone="overall" label="Cumulative variance" value={cumVar != null ? `${cumVar > 0 ? '+' : ''}${cumVar.toFixed(1)}` : '—'} unit={cumVar != null ? '%' : undefined} foot={varFoot(cumVar)} icon="chart" />
        <Stat tone="week" label="In-week actual" value={wk?.actual ?? '—'} unit={wk?.actual != null ? '%' : undefined} foot={op ? 'Progress made this week' : 'Overall Progress is off'} icon="calendar" />
        <Stat tone="week" label="In-week planned" value={wk?.plan ?? '—'} unit={wk?.plan != null ? '%' : undefined} foot="Progress planned this week" icon="calendar" />
        <Stat tone="week" label="In-week variance" value={wkVar != null ? `${wkVar > 0 ? '+' : ''}${wkVar.toFixed(1)}` : '—'} unit={wkVar != null ? '%' : undefined} foot={varFoot(wkVar)} icon="calendar" />
      </div>

      <div className="grid-main">
        {op ? (
          <SCurvePanel points={op.scurveWeekly?.length ? op.scurveWeekly : op.scurve} monthly={op.scurve} defaultCut="monthly" sub="Cumulative weighted progress of the whole scope, plan vs. actual, with the major milestones" />
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
              {data.risks.levels.map(l => (
                <div className="list-card" key={l}><span className={`dot level-${l.toLowerCase()}`} /><div className="grow"><p>{l}</p></div><span className="tiny muted">{data.risks!.byLevel[l]}</span></div>
              ))}
              <div className="list-card"><div className="grow"><small>{data.risks.responseOverdue} responses overdue · {data.risks.reviewOverdue} reviews overdue</small></div></div>
              <div className="panel-foot"><Link className="btn text" to="/m/management.risks">Open risk register →</Link></div>
            </div>
          ) : <Unavailable label="Risks" />}

          {data.interfaces === undefined ? null : data.interfaces ? (
            <div className="panel">
              <div className="panel-head"><div><h2>Interfaces</h2><p>{data.interfaces.pointsOpen} open points of {data.interfaces.points} · {data.interfaces.open} open interfaces</p></div><Icon name="link" /></div>
              <div className="list-card"><div className="grow"><p>Points overdue</p></div><span className={`tiny ${data.interfaces.pointsOverdue ? 'negative' : 'muted'}`}>{data.interfaces.pointsOverdue}</span></div>
              <div className="list-card"><div className="grow"><p>Interfaces overdue</p></div><span className={`tiny ${data.interfaces.overdue ? 'negative' : 'muted'}`}>{data.interfaces.overdue}</span></div>
              {Object.entries(data.interfaces.byStatus).filter(([, n]) => n > 0).map(([st, n]) => (
                <div className="list-card" key={st}><div className="grow"><small>{st}</small></div><span className="tiny muted">{n}</span></div>
              ))}
              <div className="panel-foot"><Link className="btn text" to="/m/interface.points">Open interface points →</Link></div>
            </div>
          ) : <Unavailable label="Interface Management" />}
        </div>
      )}
    </>
  );
}
