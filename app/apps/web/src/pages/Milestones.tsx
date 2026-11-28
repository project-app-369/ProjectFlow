import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiMode, downloadCsv, request, type Insights, type ExpeditingPackage, type FacilityTimeline, type Milestone, type Shipment, type MilestoneStatus, type Page } from '../api';
import { RecordDrawer, suggest, type FieldDef } from '../crud';
import { DataTable } from '../DataTable';
import { LoadMore, useInfiniteList } from '../lazyList';
import { fmtDate, type Tone } from '../format';
import { Timeline, laneSub, type TimelineRow } from '../Timeline';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { Toolbar, useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Deferred } from '../ui';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const TONE: Record<MilestoneStatus, Tone> = { Done: 'green', Overdue: 'red', 'Due soon': 'amber', Planned: 'indigo' };
const STATUS_ORDER: MilestoneStatus[] = ['Done', 'Overdue', 'Due soon', 'Planned'];
type Group = 'none' | 'facility' | 'sub';
const GROUPS: { key: Group; label: string }[] = [{ key: 'none', label: 'No grouping' }, { key: 'facility', label: 'By facility' }, { key: 'sub', label: 'By subcontractor' }];

const rowTone = (m: Milestone) => `ms-${m.status.toLowerCase().replace(' ', '-')}`;
const slip = (days: number | null) => (days == null ? '—' : days === 0 ? 'On plan' : `${days > 0 ? '+' : ''}${days} d`);

const milestoneFields = (sug: { facility: string[]; sub: string[]; pkg: string[]; pkgLabels: Record<string, string> }, creating: boolean): FieldDef[] => [
  ...(creating ? [{ key: 'id', label: 'Milestone ID', max: 40, hint: 'Optional. Leave blank to number it automatically (KM-001).' } as FieldDef] : []),
  { key: 'description', label: 'Key date', required: true, max: 200, full: true },
  { key: 'facility', label: 'Facility', suggestions: sug.facility, max: 60, hint: 'Groups the milestone, e.g. CGF Topsides' },
  { key: 'subName', label: 'Subcontractor / area', suggestions: sug.sub, max: 40 },
  { key: 'package', label: 'Expediting package', kind: 'select', startBlank: true, options: sug.pkg, optionLabels: sug.pkgLabels, full: true, hint: 'Code of the package in the Expediting report; the ETA column follows it' },
  { key: 'planBaseline', label: 'Baseline date', kind: 'date' },
  { key: 'planSub', label: 'Subcontractor plan date', kind: 'date' },
  { key: 'forecast', label: 'Forecast date', kind: 'date' },
  { key: 'actual', label: 'Actual date', kind: 'date', hint: 'With an actual date the milestone counts as achieved' },
  { key: 'comment', label: 'Comment', kind: 'textarea', max: 500 },
];

/** Every milestone of the project on one time axis, a lane per facility; the facility filter narrows it to one lane. */
function ProjectRoadmap({ base, projectId, cutoff, detail }: { base: string; projectId: string; cutoff: string; detail: (m: Milestone, close: () => void) => ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [facility, setFacility] = useState('');
  const [equipment, setEquipment] = useState(false);
  const all = useQuery({ queryKey: ['milestones-roadmap', projectId], queryFn: () => request<Page<Milestone>>(`${base}?pageSize=200&sort=planBaseline&order=asc`) });
  // the same facility lanes as the Schedule page: planned span, progress and the order of the facilities
  const lanesInfo = useQuery({ queryKey: ['facility-timeline', projectId], retry: false, queryFn: () => request<FacilityTimeline>(`/projects/${projectId}/facility-timeline`) });
  const items = all.data?.items ?? [];
  // a register facility name ("LQ Module #2", "Pile") is mapped to the Schedule's facility ("LQM#2", "Pile & Conductor") through the milestones they share
  const laneOf = useMemo(() => {
    const owner = new Map<string, string>();
    for (const f of lanesInfo.data?.facilities ?? []) for (const m of f.milestones) owner.set(m.id, f.label);
    const out = new Map<string, string>();
    for (const name of new Set(items.map(m => m.facility ?? 'Project'))) {
      const votes = new Map<string, number>();
      for (const m of items) if ((m.facility ?? 'Project') === name && owner.has(m.id)) votes.set(owner.get(m.id)!, (votes.get(owner.get(m.id)!) ?? 0) + 1);
      out.set(name, [...votes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? name);
    }
    return out;
  }, [items, lanesInfo.data]);
  const facilities = useMemo(() => {
    const order = new Map((lanesInfo.data?.facilities ?? []).map((f, i) => [f.label, i]));
    return [...new Set(laneOf.values())].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b));
  }, [laneOf, lanesInfo.data]);
  const rows = useMemo<TimelineRow[]>(() => {
    const keep = items.filter(m => (equipment || m.kind !== 'Equipment') && (!facility || laneOf.get(m.facility ?? 'Project') === facility));
    const lanes = new Map<string, Milestone[]>();
    for (const m of keep) { const k = laneOf.get(m.facility ?? 'Project') ?? 'Project'; lanes.set(k, [...(lanes.get(k) ?? []), m]); }
    const info = new Map((lanesInfo.data?.facilities ?? []).map(f => [f.label, f]));
    const order = new Map((lanesInfo.data?.facilities ?? []).map((f, i) => [f.label, i]));
    const first = (ms: Milestone[]) => ms.map(m => m.actual ?? m.forecast ?? m.planSub ?? m.planBaseline ?? '9').sort()[0];
    const byDate = ([an, a]: [string, Milestone[]], [bn, b]: [string, Milestone[]]) => (order.get(an) ?? 99) - (order.get(bn) ?? 99) || first(a).localeCompare(first(b));
    return [...lanes.entries()].sort(byDate).map(([name, ms]) => {
      const f = info.get(name);
      const milestones = ms.map(m => ({ id: m.id, description: m.description, baseline: m.planBaseline, working: m.planSub, forecast: m.forecast, actual: m.actual, status: m.status, major: !!(m as { major?: boolean }).major }));
      return { id: name, label: name, sub: laneSub(f, milestones), start: f?.start, finish: f?.finish, workStart: f?.workStart, workFinish: f?.workFinish, actual: f?.actual, milestones };
    });
  }, [items, facility, equipment, lanesInfo.data, laneOf]);
  const count = rows.reduce((n, r) => n + r.milestones.length, 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Project roadmap</h2><p>Bar: planned span, filled by overall progress · diamonds: {count} milestones, at their achieved, forecast or working-schedule date · cut-off {fmtDate(cutoff)}</p></div>
        <div className="roadmap-tools">
          <select className="filter" aria-label="Facility" value={facility} onChange={e => setFacility(e.target.value)}>
            <option value="">All facilities</option>
            {facilities.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={equipment} onChange={e => setEquipment(e.target.checked)} /> Equipment installation</label>
        </div>
      </div>
      <div className="panel-content">
        {all.error ? <ErrorBox error={all.error} /> : all.isPending ? <div className="empty">Loading…</div> : rows.length ? <Timeline rows={rows} cutoff={cutoff} label="Project roadmap of milestones by facility" onPick={id => setPicked(p => (p === id ? null : id))} /> : <div className="empty">No milestone for this selection.</div>}
        {picked && items.find(m => m.id === picked) && detail(items.find(m => m.id === picked)!, () => setPicked(null))}
      </div>
    </section>
  );
}

/** Key milestones: loaded from the project's Key Milestones workbook, then kept up to date here and on the sheet. */
export default function Milestones() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const canEdit = apiMode === 'sheets' && access.canWrite;
  const list = useListState({ sort: 'planSub', order: 'asc' });
  const [group, setGroup] = useState<Group>('facility');
  const [editingId, setEditingId] = useDeepLink();
  const setEditing = (v: Milestone | 'new' | null) => setEditingId(v === null ? null : v === 'new' ? 'new' : v.id);
  const filter = usePick(list, { within: '', facility: '' });
  const base = `/projects/${project.id}/milestones`;

  // ETA at site of an equipment milestone comes from its expediting package (named in the milestone's Package field), which the date links to
  const expediting = useQuery({ queryKey: ['expediting-ros', project.id], retry: false, queryFn: () => request<Page<ExpeditingPackage>>(`/projects/${project.id}/expediting/packages?pageSize=200`) });
  const byCode = useMemo(() => new Map((expediting.data?.items ?? []).filter(p => p.discipline === 'Equipment').map(p => [p.code, p])), [expediting.data]);

  // arrival at site from the Logistics report: the last shipment of the package (actual date once received, else forecast)
  const shipments = useQuery({ queryKey: ['logistics-arrival', project.id], retry: false, queryFn: () => request<Page<Shipment>>(`/projects/${project.id}/logistics/shipments?pageSize=200`) });
  const arrivals = useMemo(() => {
    const by = new Map<string, { s: Shipment; date: string; n: number; done: boolean }>();
    for (const s of shipments.data?.items ?? []) {
      const date = s.actualOnSite ?? s.forecastOnSite ?? s.etaPod;
      if (!date) continue;
      const cur = by.get(s.packageNo);
      const n = (cur?.n ?? 0) + 1;
      if (!cur || date > cur.date) by.set(s.packageNo, { s, date, n, done: !!s.actualOnSite });
      else cur.n = n;
    }
    return by;
  }, [shipments.data]);

  const insights = useQuery({ queryKey: ['insights', 'milestones', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const grouped = group !== 'none';
  const extra = { within: filter.extra.within, facility: filter.extra.facility };
  const query = list.query(extra);
  // grouped views need every row to group; 200 is the server's largest page, and more load as you scroll
  const page = useInfiniteList({ key: ['milestones', project.id], query, pageSize: grouped ? 200 : PAGE_SIZE, fetch: q => request<Page<Milestone>>(`${base}${q}`) });
  const editing: Milestone | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);
  const items = page.data?.items ?? [];

  /** The sub filter in the summary is the register's "subcontract area" filter. */
  const pick = (f: Record<string, string>) => filter.pick('sub' in f ? { discipline: f.sub } : f);
  const isOn = (f: Record<string, string>) => filter.isOn('sub' in f ? { discipline: f.sub } : f);

  /** The fuller detail of a milestone picked on the roadmap, shown inside the roadmap card itself. */
  const milestoneCard = (card: Milestone, close: () => void) => {
    const p = card.package ? byCode.get(card.package) : undefined;
    const a = card.package ? arrivals.get(card.package) : undefined;
    const eta = p && typeof p.etaSite === 'string' ? p.etaSite : '';
    const row = (k: string, v: ReactNode) => <div key={k}><small>{k}</small><strong>{v ?? '—'}</strong></div>;
    return (
      <div className="tl-detail" role="region" aria-label={`${card.description} detail`}>
        <div className="tl-detail-head">
          <div>
            <div className="eyebrow">{card.facility ?? 'Project'}{card.subName ? ` · ${card.subName}` : ''}</div>
            <h3>{card.description}</h3>
          </div>
          <Badge tone={TONE[card.status]}>{card.status}</Badge>
          <button type="button" className="icon-btn" aria-label="Close detail" onClick={close}>×</button>
        </div>
        <div className="detail-grid">
          {row('Baseline', fmtDate(card.planBaseline))}
          {row('Working / subctr schedule', fmtDate(card.planSub))}
          {row('Forecast', fmtDate(card.forecast))}
          {row('Actual', fmtDate(card.actual))}
          {row('Variance', slip(card.variance))}
          {row('Days to go', card.daysToGo == null ? '—' : `${card.daysToGo} d`)}
          {card.package && row('Expediting package', p ? <Link className="link-button" to={`/m/procurement.expediting.vendor-overview?id=${encodeURIComponent(p.id)}`}>{card.package}</Link> : card.package)}
          {card.package && row('Package ETA', /^\d{4}-\d{2}-\d{2}$/.test(eta) ? fmtDate(eta) : eta || '—')}
          {card.package && row('Arrival (Logistics)', a ? <Link className="link-button" to={`/m/procurement.logistics?id=${encodeURIComponent(a.s.id)}`}>{fmtDate(a.date)}{a.n > 1 ? ` (${a.n} shipments)` : ''}{a.done ? '' : ' forecast'}</Link> : '—')}
          {card.tagNo && row('Tag', card.tagNo)}
          {card.location && row('Location', card.location)}
          {card.deck && row('Deck', card.deck)}
        </div>
        {card.comment && <p className="tiny muted mt-3" style={{ whiteSpace: 'pre-line' }}>{card.comment}</p>}
      </div>
    );
  };

  const columns = useMemo<ColumnDef<Milestone>[]>(() => [
    {
      id: 'description', header: 'KEY DATE', meta: { sortKey: 'description' },
      cell: ({ row: { original: m } }) => (
        <button className="link-button" onClick={() => setEditing(m)}>
          <strong>{m.description}</strong>
          {m.comment && <small className="muted" style={{ display: 'block', whiteSpace: 'normal' }}>{m.comment}</small>}
        </button>
      ),
    },
    { id: 'facility', header: 'FACILITY', cell: ({ row: { original: m } }) => <span className="tiny">{m.facility ?? '—'}</span> },
    { id: 'sub', header: 'SUB', meta: { sortKey: 'subName' }, cell: ({ row: { original: m } }) => m.subName ?? '—' },
    { id: 'baseline', header: 'BASELINE', meta: { sortKey: 'planBaseline' }, cell: ({ row: { original: m } }) => fmtDate(m.planBaseline) },
    { id: 'planSub', header: 'WORKING SCH.', meta: { sortKey: 'planSub' }, cell: ({ row: { original: m } }) => fmtDate((m as { planSub?: string | null }).planSub ?? null) },
    { id: 'forecast', header: 'FORECAST', meta: { sortKey: 'forecast' }, cell: ({ row: { original: m } }) => fmtDate(m.forecast) },
    {
      id: 'eta', header: 'ETA',
      cell: ({ row: { original: m } }) => {
        const p = m.package ? byCode.get(m.package) : undefined;
        if (!p) return '—';
        const eta = typeof p.etaSite === 'string' ? p.etaSite : '';
        return <Link className="link-button" to={`/m/procurement.expediting.vendor-overview?id=${encodeURIComponent(p.id)}`} title={`${p.code} in the Expediting report`}>{/^\d{4}-\d{2}-\d{2}$/.test(eta) ? fmtDate(eta) : eta || '—'}</Link>;
      },
    },
    {
      id: 'arrival', header: 'ARRIVAL',
      cell: ({ row: { original: m } }) => {
        const a = m.package ? arrivals.get(m.package) : undefined;
        if (!a) return '—';
        return <Link className="link-button" to={`/m/procurement.logistics?id=${encodeURIComponent(a.s.id)}`} title={`${a.n} shipment${a.n === 1 ? '' : 's'} of ${m.package}; ${a.done ? 'received' : 'forecast on site'}`}>{fmtDate(a.date)}{a.n > 1 ? ` (${a.n})` : ''}{a.done ? '' : ' fcst'}</Link>;
      },
    },
    { id: 'actual', header: 'ACTUAL', meta: { sortKey: 'actual' }, cell: ({ row: { original: m } }) => fmtDate(m.actual) },
    { id: 'variance', header: 'VARIANCE', meta: { sortKey: 'variance' }, cell: ({ row: { original: m } }) => <span className={m.variance && m.variance > 0 ? 'warning' : ''}>{slip(m.variance)}</span> },
    { id: 'status', header: 'STATUS', cell: ({ row: { original: m } }) => <Badge tone={TONE[m.status]}>{m.status}</Badge> },
  ], [byCode, arrivals]);

  /** Groups keep the server's order; the groups themselves are ordered by name, with "Unassigned" last. */
  const groups = useMemo(() => {
    if (!grouped) return [];
    const by = new Map<string, Milestone[]>();
    for (const m of items) { const k = (group === 'facility' ? m.facility : m.subName) ?? 'Unassigned'; by.set(k, [...(by.get(k) ?? []), m]); }
    return [...by.entries()].sort(([a], [b]) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)));
  }, [items, group, grouped]);

  const drawerSuggestions = { facility: page.data?.facets.facilities ?? suggest(items as never, 'facility'), sub: page.data?.facets.disciplines ?? [], pkg: [...byCode.keys()].sort(), pkgLabels: Object.fromEntries([...byCode.values()].map(p => [p.code, p.name ? `${p.code} — ${p.name}` : p.code])) };
  const csvQuery = list.query(extra);

  return (
    <>
      <PageHead title="Milestones" desc={`Key contract dates · status is derived against the cut-off (${fmtDate(project.cutoff)}). Edits are written to the sheet.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${csvQuery}`, 'milestones.csv').catch(e => toast(e.message))}>Export CSV</Btn>
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} pair twoCol />
      <Deferred height="24rem"><ProjectRoadmap base={base} projectId={project.id} cutoff={project.cutoff} detail={milestoneCard} /></Deferred>
      <div className="panel">
        <div className="panel-head">
          <div><h2>Milestone register</h2><p>{canEdit ? 'Select a milestone to update its dates, or add one' : 'Select a milestone to see its dates'}</p></div>
          <div className="actions">
            <div className="seg" role="group" aria-label="Group milestones">
              {GROUPS.map(g => <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>{g.label}</button>)}
            </div>
            <span className="tiny muted">{page.data?.total ?? '…'} milestones</span>
            {canEdit && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New milestone</Btn>}
          </div>
        </div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search id, key date, facility or comment…" label="Search milestones" disciplineLabel="subcontract areas" defaultSort="planSub" sorts={[['planSub', 'Working schedule'], ['id', 'ID'], ['planBaseline', 'Baseline date'], ['forecast', 'Forecast date'], ['actual', 'Actual date'], ['variance', 'Variance'], ['subName', 'Sub-contractor'], ['description', 'Key date']]} />
        <FilterChips chips={filter.chips} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : grouped ? (
          groups.length ? groups.map(([name, rows]) => {
            const count = (s: MilestoneStatus) => rows.filter(r => r.status === s).length;
            const done = count('Done');
            return (
              <details className="ms-group" key={name} open>
                <summary>
                  <strong>{name}</strong>
                  <span className="tiny muted">{rows.length} milestone{rows.length === 1 ? '' : 's'} · {Math.round((done / rows.length) * 100)}% achieved</span>
                  <span className="ms-badges">{STATUS_ORDER.filter(s => count(s)).map(s => <Badge key={s} tone={TONE[s]}>{count(s)} {s}</Badge>)}</span>
                </summary>
                <DataTable tableClass="ms-table" rowClassName={rowTone} columns={columns} data={rows} state={list.state} onSort={list.toggleSort} empty="No milestones match." />
              </details>
            );
          }).concat(<LoadMore key="more" source={page.lazy} noun="milestones" />) : <div className="empty">No milestones match.</div>
        ) : (
          <>
            <DataTable tableClass="ms-table" rowClassName={rowTone} revealFrom={page.revealFrom} columns={columns} data={items} state={list.state} onSort={list.toggleSort} loading={page.isPending} empty="No milestones match." />
            <LoadMore source={page.lazy} noun="milestones" />
          </>
        )}
      </div>
      {editing && (
        <RecordDrawer title={editing === 'new' ? 'New milestone' : `${editing.id} · Milestone`} size="md" base={base} id={editing === 'new' ? undefined : editing.id}
          record={editing === 'new' ? null : editing as never} fields={milestoneFields(drawerSuggestions, editing === 'new')} canDelete={access.canManage && apiMode === 'sheets'}
          deleteNote="The milestone leaves the register and the sheet. A milestone that a risk or interface is linked to cannot be deleted until it is unlinked."
          invalidate={['milestones', 'milestones-roadmap', 'milestone-summary', 'insights', 'dashboard', 'risks', 'interfaces']} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
