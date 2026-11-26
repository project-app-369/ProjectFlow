import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiMode, downloadCsv, request, type Insights, type ExpeditingPackage, type Milestone, type Shipment, type MilestoneStatus, type Page } from '../api';
import { RecordDrawer, suggest, type FieldDef } from '../crud';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { Timeline, type TimelineRow } from '../Timeline';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { Toolbar, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Pager, Deferred } from '../ui';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const TONE: Record<MilestoneStatus, Tone> = { Done: 'green', Overdue: 'red', 'Due soon': 'amber', Planned: 'indigo' };
const STATUS_ORDER: MilestoneStatus[] = ['Done', 'Overdue', 'Due soon', 'Planned'];
type Group = 'none' | 'facility' | 'sub';
const GROUPS: { key: Group; label: string }[] = [{ key: 'none', label: 'No grouping' }, { key: 'facility', label: 'By facility' }, { key: 'sub', label: 'By subcontractor' }];

const slip = (days: number | null) => (days == null ? '—' : days === 0 ? 'On plan' : `${days > 0 ? '+' : ''}${days} d`);

const milestoneFields = (sug: { facility: string[]; sub: string[]; pkg: string[] }, creating: boolean): FieldDef[] => [
  ...(creating ? [{ key: 'id', label: 'Milestone ID', max: 40, hint: 'Optional. Leave blank to number it automatically (KM-001).' } as FieldDef] : []),
  { key: 'description', label: 'Key date', required: true, max: 200, full: true },
  { key: 'facility', label: 'Facility', suggestions: sug.facility, max: 60, hint: 'Groups the milestone, e.g. CGF Topsides' },
  { key: 'subName', label: 'Subcontractor / area', suggestions: sug.sub, max: 40 },
  { key: 'package', label: 'Expediting package', suggestions: sug.pkg, max: 60, hint: 'Code of the package in the Expediting report; the ETA column follows it' },
  { key: 'planBaseline', label: 'Baseline date', kind: 'date' },
  { key: 'planSub', label: 'Subcontractor plan date', kind: 'date' },
  { key: 'forecast', label: 'Forecast date', kind: 'date' },
  { key: 'actual', label: 'Actual date', kind: 'date', hint: 'With an actual date the milestone counts as achieved' },
  { key: 'comment', label: 'Comment', kind: 'textarea', max: 500 },
];

/** Every milestone of the project on one time axis, a lane per facility; the facility filter narrows it to one lane. */
function ProjectRoadmap({ base, projectId, cutoff }: { base: string; projectId: string; cutoff: string }) {
  const [facility, setFacility] = useState('');
  const [equipment, setEquipment] = useState(false);
  const all = useQuery({ queryKey: ['milestones-roadmap', projectId], queryFn: () => request<Page<Milestone>>(`${base}?pageSize=200&sort=planBaseline&order=asc`) });
  const items = all.data?.items ?? [];
  const facilities = useMemo(() => [...new Set(items.map(m => m.facility ?? 'Project'))].sort(), [items]);
  const rows = useMemo<TimelineRow[]>(() => {
    const keep = items.filter(m => (equipment || m.kind !== 'Equipment') && (!facility || (m.facility ?? 'Project') === facility));
    const lanes = new Map<string, Milestone[]>();
    for (const m of keep) lanes.set(m.facility ?? 'Project', [...(lanes.get(m.facility ?? 'Project') ?? []), m]);
    const first = (ms: Milestone[]) => ms.map(m => m.actual ?? m.forecast ?? m.planSub ?? m.planBaseline ?? '9').sort()[0];
    return [...lanes.entries()].sort(([, a], [, b]) => first(a).localeCompare(first(b))).map(([name, ms]) => ({
      id: name, label: name, sub: `${ms.filter(m => m.status === 'Done').length}/${ms.length} achieved${ms.some(m => m.status === 'Overdue') ? ` · ${ms.filter(m => m.status === 'Overdue').length} overdue` : ''}`,
      milestones: ms.map(m => ({ id: m.id, description: m.description, baseline: m.planBaseline, working: m.planSub, forecast: m.forecast, actual: m.actual, status: m.status, major: !!(m as { major?: boolean }).major })),
    }));
  }, [items, facility, equipment]);
  const count = rows.reduce((n, r) => n + r.milestones.length, 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Project roadmap</h2><p>{count} milestones, a lane per facility, at their achieved, forecast or working-schedule date · cut-off {fmtDate(cutoff)}</p></div>
        <div className="roadmap-tools">
          <select className="filter" aria-label="Facility" value={facility} onChange={e => setFacility(e.target.value)}>
            <option value="">All facilities</option>
            {facilities.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={equipment} onChange={e => setEquipment(e.target.checked)} /> Equipment installation</label>
        </div>
      </div>
      <div className="panel-content">
        {all.error ? <ErrorBox error={all.error} /> : all.isPending ? <div className="empty">Loading…</div> : rows.length ? <Timeline rows={rows} cutoff={cutoff} label="Project roadmap of milestones by facility" /> : <div className="empty">No milestone for this selection.</div>}
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
  const list = useListState();
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
  const query = list.query({ page: list.state.page, pageSize: grouped ? 200 : PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['milestones', project.id, query], queryFn: () => request<Page<Milestone>>(`${base}${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['milestones', project.id, q], q => request<Page<Milestone>>(`${base}${q}`));
  const editing: Milestone | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);
  const items = page.data?.items ?? [];

  /** The sub filter in the summary is the register's "subcontract area" filter. */
  const pick = (f: Record<string, string>) => filter.pick('sub' in f ? { discipline: f.sub } : f);
  const isOn = (f: Record<string, string>) => filter.isOn('sub' in f ? { discipline: f.sub } : f);

  const columns = useMemo<ColumnDef<Milestone>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: m } }) => <span className="mono">{m.id}</span> },
    {
      id: 'description', header: 'KEY DATE', meta: { sortKey: 'description' },
      cell: ({ row: { original: m } }) => (
        <button className="link-button" onClick={() => setEditing(m)}>
          <strong>{m.description}</strong>
          {m.comment && <small className="muted" style={{ display: 'block', whiteSpace: 'normal', maxWidth: 360 }}>{m.comment}</small>}
        </button>
      ),
    },
    { id: 'facility', header: 'FACILITY', cell: ({ row: { original: m } }) => <span className="tiny">{m.facility ?? '—'}</span> },
    { id: 'sub', header: 'SUB', meta: { sortKey: 'subName' }, cell: ({ row: { original: m } }) => m.subName ?? '—' },
    { id: 'baseline', header: 'BASELINE', meta: { sortKey: 'planBaseline' }, cell: ({ row: { original: m } }) => fmtDate(m.planBaseline) },
    { id: 'planSub', header: 'WORKING / SUBCTR SCHEDULE', cell: ({ row: { original: m } }) => fmtDate((m as { planSub?: string | null }).planSub ?? null) },
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
      id: 'arrival', header: 'ARRIVAL (LOGISTICS)',
      cell: ({ row: { original: m } }) => {
        const a = m.package ? arrivals.get(m.package) : undefined;
        if (!a) return '—';
        return <Link className="link-button" to={`/m/procurement.logistics?id=${encodeURIComponent(a.s.id)}`} title={`${a.n} shipment${a.n === 1 ? '' : 's'} of ${m.package}; ${a.done ? 'received' : 'forecast on site'}`}>{fmtDate(a.date)}{a.n > 1 ? ` (${a.n})` : ''}{a.done ? '' : ' fcst'}</Link>;
      },
    },
    { id: 'forecast', header: 'FORECAST', meta: { sortKey: 'forecast' }, cell: ({ row: { original: m } }) => fmtDate(m.forecast) },
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

  const drawerSuggestions = { facility: page.data?.facets.facilities ?? suggest(items as never, 'facility'), sub: page.data?.facets.disciplines ?? [], pkg: [...byCode.keys()].sort() };
  const csvQuery = list.query(extra);

  return (
    <>
      <PageHead title="Milestones" desc={`Key contract dates · status is derived against the cut-off (${fmtDate(project.cutoff)}). Edits are written to the sheet.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${csvQuery}`, 'milestones.csv').catch(e => toast(e.message))}>Export CSV</Btn>
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} pair twoCol />
      <Deferred height="24rem"><ProjectRoadmap base={base} projectId={project.id} cutoff={project.cutoff} /></Deferred>
      <div className="panel">
        <div className="panel-head">
          <div><h2>Milestone register</h2><p>{canEdit ? 'Select a milestone to update its dates, or add one' : 'Select a milestone to see its dates'}</p></div>
          <div className="actions">
            <div className="seg" role="group" aria-label="Group milestones">
              {GROUPS.map(g => <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>{g.label}</button>)}
            </div>
            <span className="tiny muted">{page.data?.total ?? '…'} milestones</span>
            {canEdit && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>Add milestone</Btn>}
          </div>
        </div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search id, key date, facility or comment…" label="Search milestones" disciplineLabel="subcontract areas" defaultSort="id" sorts={[['id', 'ID'], ['planBaseline', 'Baseline date'], ['forecast', 'Forecast date'], ['actual', 'Actual date'], ['variance', 'Variance'], ['subName', 'Sub-contractor'], ['description', 'Key date']]} />
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
                <DataTable columns={columns} data={rows} state={list.state} onSort={list.toggleSort} empty="No milestones match." />
              </details>
            );
          }) : <div className="empty">No milestones match.</div>
        ) : (
          <>
            <DataTable columns={columns} data={items} state={list.state} onSort={list.toggleSort} loading={page.isPending} empty="No milestones match." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
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
