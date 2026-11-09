import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { request, type AttentionItem, type ExpeditingBrief, type ProcurementCurve, type ProcurementDashboard as Dash, type Severity, type Shipment } from '../api';
import { fmtDate, fmtShort, signed, type Tone } from '../format';
import { Icon } from '../icons';
import { progressTableValues } from '../procurementProgress';
import { useApp } from '../state';
import { ActualPlanBar, Badge, ErrorBox, Loading, PageHead, Stat } from '../ui';

const SCurve = lazy(() => import('../ProcurementSCurveChart'));
const SCOPE_LABEL = { OVR: 'All', LS: 'Lump sum', PS: 'Reimbursable' } as const;
const FACILITY_LABEL = (f: string) => (f === 'OVERALL' ? 'All facilities' : f.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a: string, b: string) => (b.length > 2 ? a + b.toLowerCase() : a + b)).replace('Cgf', 'CGF').replace('Lq', 'LQ'));

const LEVEL_TONE: Record<AttentionItem['level'], Tone> = { Critical: 'red', High: 'amber', Medium: 'indigo' };
const SEV_COLOR: Record<Severity, string> = { Critical: 'var(--red)', High: 'var(--chart-orange)', Medium: 'var(--amber)', Low: 'var(--green)' };
const STAGE_COLOR: Record<string, string> = { Planned: 'var(--chart-neutral)', 'In tendering': 'var(--chart-plan)', 'LOA issued': 'var(--amber)', 'PO placed': 'var(--green)' };
const kg = (n: number) => `${(n / 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`;

/** One horizontal bar made of coloured parts. */
function Bar({ parts, total, height = 10 }: { parts: { value: number; color: string; label: string }[]; total: number; height?: number }) {
  return (
    <div className="stackbar" style={{ height }} role="img" aria-label={parts.filter(p => p.value).map(p => `${p.label}: ${p.value}`).join(', ')}>
      {parts.filter(p => p.value > 0).map(p => <span key={p.label} style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />)}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <div className="legend panel-legend">{items.map(i => <span key={i.label}><span className="dot" style={{ background: i.color }} />{i.label}</span>)}</div>;
}

function Panel({ title, sub, foot, children, wide }: { title: string; sub?: ReactNode; foot?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`panel ${wide ? 'span-2' : ''}`}>
      <div className="panel-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>
      {children}
      {foot && <div className="panel-foot">{foot}</div>}
    </section>
  );
}

const Off = ({ label }: { label: string }) => <div className="panel empty">{label} is turned off. <Link className="btn text" to="/settings/modules">Open module settings</Link></div>;

function BriefRow({ r, note }: { r: ExpeditingBrief; note: ReactNode }) {
  return (
    <div className="list-card">
      <div className="grow"><p><strong>{r.name ?? r.code}</strong></p><small>{r.code} · {r.vendor ?? 'vendor tbc'}</small></div>
      <div className="brief-note">{note}</div>
    </div>
  );
}

function ShipmentRow({ r, note }: { r: Shipment; note: ReactNode }) {
  return (
    <div className="list-card">
      <div className="grow"><p><strong>{r.packageDescription ?? r.packageNo}</strong></p><small>{r.shipmentNo ?? r.packageNo} · {r.status}{r.issue ? ` · ${r.issue}` : ''}</small></div>
      <div className="brief-note">{note}</div>
    </div>
  );
}

/** Procurement → Dashboard: where the packages stand, and which of them need someone's attention. */
export default function ProcurementDashboard() {
  const { project } = useApp();
  const q = useQuery({ queryKey: ['procurement-dashboard', project.id], queryFn: () => request<Dash>(`/projects/${project.id}/procurement/dashboard`) });
  const [pick, setPick] = useState<{ facility: string; scope: string }>({ facility: 'OVERALL', scope: 'OVR' });
  const curveQuery = (facility: string, scope: string) => ({
    queryKey: ['procurement-curve', project.id, facility, scope],
    queryFn: () => request<ProcurementCurve>(`/projects/${project.id}/procurement/s-curve?facility=${encodeURIComponent(facility)}&scope=${scope}`),
  });
  const overall = useQuery(curveQuery('OVERALL', 'OVR'));
  const curveQ = useQuery({ ...curveQuery(pick.facility, pick.scope), placeholderData: keepPreviousData });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const { pipeline: pl, expediting: ex, logistics: lg, materials: mt, concerns: cn, workPackages: wp } = d;
  const flags = ex ? ex.health.delay + ex.health.highRisk + ex.health.atRisk : null;
  const curve = curveQ.data;
  const ov = overall.data?.latest ?? null;

  return (
    <>
      <PageHead title="Procurement dashboard" desc={`Where procurement stands at the ${fmtDate(d.cutoff)} cut-off, and which packages need attention.`} />

      <div className="stats six">
        <Stat label="Procurement progress" value={ov ? `${(ov.actual ?? 0).toFixed(1)}%` : '—'} icon="chart"
          foot={ov ? <ActualPlanBar actual={ov.actual} plan={ov.plan} compact /> : overall.isPending ? 'Loading…' : 'No S-curve data'} />
        <Stat label="Packages placed" value={pl ? `${pl.byStatus['PO placed'] ?? 0}/${pl.total}` : '—'} icon="box"
          foot={pl ? <>{pl.placedPct != null ? `${pl.placedPct}% of the weight in PO` : 'PO placed'} · {pl.byStatus['LOA issued'] ?? 0} awaiting PO</> : 'Procurement Plan is off'} />
        <Stat label="Expediting flags" value={flags ?? '—'} icon="risk"
          foot={ex ? <><span className="negative">{ex.health.delay} delayed</span> · {ex.health.highRisk} high risk · {ex.health.atRisk} at risk</> : 'Vendor Overview is off'} />
        <Stat label="Shipments" value={lg ? lg.inTransit : '—'} icon="calendar"
          foot={lg ? <><span className={lg.overdueCount ? 'negative' : ''}>{lg.overdueCount} overdue</span> · {lg.heldCount} held · {lg.soonCount} due in 14 days</> : 'Logistics is off'} />
        <Stat label="Open risks & concerns" value={cn ? cn.open : '—'} icon="flag"
          foot={cn ? <><span className={cn.bySeverity.Critical + cn.bySeverity.High ? 'negative' : ''}>{cn.bySeverity.Critical} critical · {cn.bySeverity.High} high</span> · {cn.overdue} overdue</> : 'Risks & Concerns is off'} />
        <Stat label="Material arrived" value={mt?.totals[0]?.arrivedPct != null ? `${mt.totals[0].arrivedPct}%` : '—'} icon="layers"
          foot={mt ? <>PTSC MC supply · Client {mt.totals[1]?.arrivedPct != null ? `${mt.totals[1].arrivedPct}%` : '—'} · {mt.stockLines} stock lines</> : 'Materials is off'} />
      </div>

      <div className="dash-grid" style={{ marginTop: 0, marginBottom: 'var(--sp-5)' }}>
        <Panel title="Procurement S-curve" wide
          sub={curve?.latest ? <>Cumulative progress by week · at {fmtDate(curve.latest.date)} actual {(curve.latest.actual ?? 0).toFixed(1)}% against {(curve.latest.plan ?? 0).toFixed(1)}% plan{curve.latest.forecast != null ? ` · forecast ${curve.latest.forecast.toFixed(1)}%` : ''}</> : 'Cumulative progress by week'}>
          <div className="toolbar" style={{ paddingTop: 0 }}>
            <div className="curve-controls">
              <select className="filter" aria-label="Facility" value={curve?.facility ?? pick.facility} onChange={e => setPick({ facility: e.target.value, scope: 'OVR' })}>
                {(curve?.facilities ?? ['OVERALL']).map(f => <option key={f} value={f}>{FACILITY_LABEL(f)}</option>)}
              </select>
              <div className="seg" role="group" aria-label="Contract scope">
                {(curve?.scopes ?? ['OVR']).map(s => <button key={s} type="button" aria-pressed={(curve?.scope ?? pick.scope) === s} onClick={() => setPick(p => ({ ...p, scope: s }))}>{SCOPE_LABEL[s]}</button>)}
              </div>
            </div>
          </div>
          {curveQ.error ? <ErrorBox error={curveQ.error} /> : curve && curve.dates.length ? (
            <Suspense fallback={<Loading label="Loading chart…" />}><SCurve curve={curve} /></Suspense>
          ) : curveQ.isPending ? <Loading /> : <div className="empty">No S-curve is loaded for this selection.</div>}
        </Panel>

        {wp ? (
          <Panel title="Procurement progress by work package" wide sub="Progress Table (W) · cumulative this-week actual vs plan">
            <div className="panel-content progress-grid">
              <ActualPlanBar label="Overall procurement" {...progressTableValues(wp.overall)} />
              {wp.items.map(w => <ActualPlanBar key={w.code} label={`${w.code} · ${w.name}`} {...progressTableValues(w)} />)}
            </div>
          </Panel>
        ) : null}
      </div>

      <Panel title="Packages needing attention" wide
        sub={`${d.attentionCount} package${d.attentionCount === 1 ? '' : 's'} carry at least one signal: expediting status, days behind plan, required date passed, late or held shipments, open concerns, a PO still pending after an LOA`}
        foot={<Link className="btn text" to="/m/procurement.concerns">Open risks & concerns →</Link>}>
        {d.attention.length ? (
          <div className="table-wrap">
            <table className="attention">
              <thead><tr><th>LEVEL</th><th>PACKAGE</th><th>WHY</th><th /></tr></thead>
              <tbody>
                {d.attention.map(a => (
                  <tr key={a.code}>
                    <td><Badge tone={LEVEL_TONE[a.level]}>{a.level}</Badge><small className="muted" style={{ display: 'block' }}>score {a.score}</small></td>
                    <td><strong>{a.code}</strong><small className="muted clamp">{a.name ?? '—'}</small><small className="muted">{[a.discipline, a.vendor].filter(Boolean).join(' · ')}</small></td>
                    <td className="reasons">{a.reasons.map((r, i) => <span key={i} className="chip">{r}</span>)}</td>
                    <td><Link className="icon-btn" aria-label={`Concerns for ${a.code}`} title="Risks and concerns for this package" to={`/m/procurement.concerns?package=${encodeURIComponent(a.code)}`}><Icon name="arrow" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No package is flagged. Nothing needs attention right now.</div>}
      </Panel>

      <div className="dash-grid">
        {pl ? (
          <Panel title="Award pipeline" sub="Packages by stage and discipline" foot={<Link className="btn text" to="/m/procurement.procurement-plan">Open procurement plan →</Link>}>
            <Legend items={Object.entries(STAGE_COLOR).map(([label, color]) => ({ label, color }))} />
            <div className="panel-content">
              {pl.byDiscipline.map(r => (
                <div className="bar-row" key={r.discipline}>
                  <div className="bar-row-label"><span>{r.discipline}</span><span className="muted">{r.total}</span></div>
                  <Bar total={pl.byDiscipline.reduce((m, x) => Math.max(m, x.total), 1)} parts={Object.entries(STAGE_COLOR).map(([label, color]) => ({ label, color, value: Number(r[label] ?? 0) }))} />
                </div>
              ))}
              {pl.slowAwardCount > 0 && <p className="tiny warning" style={{ marginTop: 12 }}>{pl.slowAwardCount} package{pl.slowAwardCount === 1 ? '' : 's'} still without a PO more than 30 days after the LOA (oldest: {pl.slowAward[0].code}, {pl.slowAward[0].days} days).</p>}
            </div>
          </Panel>
        ) : <Off label="Procurement Plan" />}

        {ex ? (
          <Panel title="Expediting health" sub={`Average progress ${ex.avgActualPct ?? '—'}% against ${ex.avgPlanPct ?? '—'}% planned`} foot={<Link className="btn text" to="/m/procurement.expediting.vendor-overview">Open vendor overview →</Link>}>
            <Legend items={[{ label: 'Delay', color: 'var(--red)' }, { label: 'High risk', color: 'var(--chart-orange)' }, { label: 'At risk', color: 'var(--amber)' }, { label: 'On track', color: 'var(--green)' }]} />
            <div className="panel-content">
              {ex.byDiscipline.map(r => (
                <div className="bar-row" key={r.discipline}>
                  <div className="bar-row-label"><span>{r.discipline}</span><span className="muted">{r.delay + r.highRisk + r.atRisk} of {r.total} flagged{r.avgVariance != null ? ` · ${signed(r.avgVariance)} pp` : ''}</span></div>
                  <Bar total={r.total} parts={[{ label: 'Delay', color: 'var(--red)', value: r.delay }, { label: 'High risk', color: 'var(--chart-orange)', value: r.highRisk }, { label: 'At risk', color: 'var(--amber)', value: r.atRisk }, { label: 'On track', color: 'var(--green)', value: r.total - r.delay - r.highRisk - r.atRisk }]} />
                </div>
              ))}
            </div>
          </Panel>
        ) : <Off label="Vendor Overview" />}

        {cn ? (
          <Panel title="Risks, concerns and issues" sub={`${cn.open} open · ${cn.closed} resolved or closed`} foot={<Link className="btn text" to="/m/procurement.concerns">Open register →</Link>}>
            <div className="panel-content">
              {(['Critical', 'High', 'Medium', 'Low'] as const).map(s => (
                <div className="bar-row" key={s}>
                  <div className="bar-row-label"><span><span className="dot" style={{ background: SEV_COLOR[s], marginRight: 6 }} />{s}</span><span className="muted">{cn.bySeverity[s]}</span></div>
                  <Bar total={Math.max(1, cn.open)} parts={[{ label: s, color: SEV_COLOR[s], value: cn.bySeverity[s] }]} />
                </div>
              ))}
              <p className="tiny muted" style={{ marginTop: 10 }}>{Object.entries(cn.byType).map(([k, n]) => `${n} ${k.toLowerCase()}${n === 1 ? '' : 's'}`).join(' · ') || 'Nothing open'}</p>
            </div>
            {cn.top.slice(0, 5).map(c => (
              <div className="list-card" key={c.id}>
                <div className="grow"><p><strong>{c.title}</strong></p><small>{c.id} · {c.packageCode ?? 'no package'} · {c.owner ?? 'no owner'}{c.overdue ? ' · action overdue' : ''}</small></div>
                <Badge tone={c.severity === 'Critical' || c.severity === 'High' ? 'red' : 'amber'}>{c.severity}</Badge>
              </div>
            ))}
          </Panel>
        ) : <Off label="Risks & Concerns" />}

        {ex && (
          <Panel title="Behind plan" sub="The ten packages furthest below their planned progress">
            {ex.behind.length ? ex.behind.map(r => (
              <BriefRow key={r.id} r={r} note={<><span className="negative mono">{signed(r.variance ?? 0)} pp</span><small className="muted" style={{ display: 'block' }}>{r.actualPct ?? '—'}% of {r.planPct ?? '—'}%</small></>} />
            )) : <div className="empty">No package is behind plan.</div>}
          </Panel>
        )}

        {ex && (
          <Panel title="Required dates" sub={`${ex.rosPassedCount} passed without arrival · ${ex.rosSoonCount} in the next 30 days`}>
            {ex.rosPassed.map(r => <BriefRow key={r.id} r={r} note={<><span className="negative">{r.daysPast} d past</span><small className="muted" style={{ display: 'block' }}>{fmtShort(r.rosDate!)}</small></>} />)}
            {ex.rosSoon.slice(0, 6).map(r => <BriefRow key={r.id} r={r} note={<><span>in {r.daysToRos} d</span><small className="muted" style={{ display: 'block' }}>{fmtShort(r.rosDate!)} · {r.actualPct ?? '—'}%</small></>} />)}
            {!ex.rosPassed.length && !ex.rosSoon.length && <div className="empty">No required date in the next 30 days.</div>}
          </Panel>
        )}

        {lg ? (
          <Panel title="Shipments" sub={`${lg.total} shipments · ${kg(lg.receivedKg)} of ${kg(lg.weightKg)} received`} foot={<Link className="btn text" to="/m/procurement.logistics">Open logistics →</Link>}>
            <Legend items={Object.entries(lg.byStatus).map(([label, n]) => ({ label: `${label} ${n}`, color: label === 'Received' ? 'var(--green)' : label === 'Planned' ? 'var(--chart-neutral)' : 'var(--amber)' }))} />
            <div className="panel-content"><Bar height={12} total={lg.total} parts={Object.entries(lg.byStatus).map(([label, value]) => ({ label, value, color: label === 'Received' ? 'var(--green)' : label === 'Planned' ? 'var(--chart-neutral)' : 'var(--amber)' }))} /></div>
            {lg.overdue.slice(0, 4).map(r => <ShipmentRow key={r.id} r={r} note={<span className="negative">{r.daysLate} d late</span>} />)}
            {lg.held.slice(0, 5).map(r => <ShipmentRow key={r.id} r={r} note={<Badge tone="amber">Held</Badge>} />)}
            {lg.soon.slice(0, 4).map(r => <ShipmentRow key={r.id} r={r} note={<span>{fmtShort(r.forecastOnSite!)}</span>} />)}
            {!lg.overdue.length && !lg.held.length && !lg.soon.length && <div className="empty">Nothing late, held or due soon.</div>}
          </Panel>
        ) : <Off label="Logistics" />}

        {mt ? (
          <Panel title="Material arrival" sub="Weight arrived against the weight needed for purchase" foot={<Link className="btn text" to="/m/procurement.materials">Open materials →</Link>}>
            <div className="panel-content">
              {mt.totals.map(t => (
                <div className="bar-row" key={t.supply}>
                  <div className="bar-row-label"><strong>{t.supply} supply</strong><span className="muted">{kg(t.arrivedKg)} of {kg(t.mtoKg)}{t.arrivedPct != null ? ` · ${t.arrivedPct}%` : ''}</span></div>
                  <Bar height={12} total={Math.max(t.mtoKg, t.arrivedKg, 1)} parts={[{ label: 'Arrived', color: t.arrivedPct != null && t.arrivedPct >= 100 ? 'var(--green)' : 'var(--amber)', value: t.arrivedKg }]} />
                </div>
              ))}
              <div className="detail-grid" style={{ marginBottom: 0 }}>
                {mt.rows.filter(r => r.mtoKg).map(r => (
                  <div key={r.id}><small>{r.supply} · {r.facility}</small><strong className={r.arrivedPct != null && r.arrivedPct < 100 ? 'warning' : ''}>{r.arrivedPct != null ? `${r.arrivedPct}%` : '—'}</strong></div>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 12 }}>{mt.stockLines} stock lines on hand.</p>
            </div>
          </Panel>
        ) : <Off label="Materials" />}
      </div>
    </>
  );
}
