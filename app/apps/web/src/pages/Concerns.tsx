import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CONCERN_AREAS, CONCERN_STATUSES, CONCERN_TYPES, downloadCsv, request, SEVERITIES, type Concern, type ConcernSummary, type Page } from '../api';
import { DataTable } from '../DataTable';
import { LoadMore, useInfiniteList } from '../lazyList';
import { AiTools } from '../AiTools';
import { fmtDate, type Tone } from '../format';
import { Icon } from '../icons';
import { SortBy, useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { InsightsView, useInsights } from '../Insights';
import { Badge, Btn, ErrorBox, PageHead } from '../ui';
import { ConcernDrawer } from './ConcernDrawer';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 25;
const SEV_TONE: Record<string, Tone> = { Critical: 'red', High: 'red', Medium: 'amber', Low: 'green' };

/** Procurement → Risks & Concerns: what could go wrong, or has, for each package. */
export default function Concerns() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const pkg = params.get('package') ?? '';
  const list = useListState();
  const [filters, setFilters] = useState({ type: '', severity: '', area: '', owner: '', within: '', activeOnly: true });
  const [editingId, setEditingId] = useDeepLink();
  const setEditing = (v: Concern | 'new' | null) => setEditingId(v === null ? null : v === 'new' ? 'new' : v.id);
  const base = `/projects/${project.id}/procurement/concerns`;

  const summary = useQuery({ queryKey: ['concern-summary', project.id], queryFn: () => request<ConcernSummary>(`${base}/summary`) });
  const query = list.query({ type: filters.type, severity: filters.severity, area: filters.area, owner: filters.owner, within: filters.within, packageCode: pkg, active: filters.activeOnly && !list.state.status ? 'true' : undefined });
  const page = useInfiniteList({ key: ['concerns', project.id], query, pageSize: PAGE_SIZE, fetch: q => request<Page<Concern>>(`${base}${q}`) });
  const editing: Concern | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);

  const columns = useMemo<ColumnDef<Concern>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: c } }) => <span className="mono">{c.id}</span> },
    {
      id: 'title', header: 'CONCERN',
      cell: ({ row: { original: c } }) => (
        <button className="link-button register-title" onClick={() => setEditing(c)}>
          <strong>{c.title}</strong>
          <small className="muted">{c.packageCode ?? 'No package'} · {c.type} · {c.area}</small>
        </button>
      ),
    },
    { id: 'severity', header: 'SEVERITY', meta: { sortKey: 'severity' }, cell: ({ row: { original: c } }) => <Badge tone={SEV_TONE[c.severity]}>{c.severity}</Badge> },
    { id: 'owner', header: 'OWNER', meta: { sortKey: 'owner' }, cell: ({ row: { original: c } }) => c.owner ?? <span className="tiny muted">—</span> },
    { id: 'due', header: 'ACTION DUE', meta: { sortKey: 'dueDate' }, cell: ({ row: { original: c } }) => <span className={c.overdue ? 'negative' : ''}>{c.dueDate ? fmtDate(c.dueDate) : '—'}{c.overdue ? ' · overdue' : ''}</span> },
    { id: 'age', header: 'OPEN FOR', meta: { sortKey: 'raisedDate' }, cell: ({ row: { original: c } }) => (c.ageDays != null ? `${c.ageDays} d` : '—') },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: c } }) => <Badge>{c.status}</Badge> },
    { id: 'open', header: '', cell: ({ row: { original: c } }) => <button className="icon-btn" aria-label={`Open ${c.id}`} onClick={() => setEditing(c)}><Icon name="arrow" /></button> },
  ], []);

  const s = summary.data;
  const insights = useInsights('concerns', project.id, `${base}/insights`);
  /** A box or bar in the summary filters the register; a package opens the register for that package. */
  const pick = (f: Record<string, string>) => {
    const [k, v] = Object.entries(f)[0];
    if (k === 'packageCode') { setParams(pkg === v ? {} : { package: v }); list.set({}); return; }
    set({ [k]: (filters as Record<string, unknown>)[k] === v ? '' : v } as Partial<typeof filters>);
  };
  const isOn = (f: Record<string, string>) => Object.entries(f).every(([k, v]) => (k === 'packageCode' ? pkg === v : (filters as Record<string, unknown>)[k] === v));
  const set = (patch: Partial<typeof filters>) => { setFilters(f => ({ ...f, ...patch })); list.set({}); };

  return (
    <>
      <PageHead title="Risks & Concerns" desc="Risks that may happen, concerns that are building, and issues already hurting a package, each with an owner and an action."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query({ type: filters.type, severity: filters.severity, area: filters.area, packageCode: pkg })}`, 'procurement-concerns.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          <AiTools kind="concerns" />
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New concern</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} pair twoCol />
      <div className="panel">
        <div className="panel-head"><div><h2>Register</h2><p>Select a row to review or update it</p></div><span className="tiny muted">{page.data?.total ?? '…'} records</span></div>
        {pkg && <div className="banner">Showing concerns for <strong>{pkg}</strong>. <button className="btn text" onClick={() => setParams({})}>Show all</button></div>}
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search title, package, owner or action…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search concerns" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by type" value={filters.type} onChange={e => set({ type: e.target.value })}><option value="">All types</option>{CONCERN_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by severity" value={filters.severity} onChange={e => set({ severity: e.target.value })}><option value="">All severities</option>{[...SEVERITIES].reverse().map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by area" value={filters.area} onChange={e => set({ area: e.target.value })}><option value="">All areas</option>{CONCERN_AREAS.map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by status" value={list.state.status} onChange={e => list.set({ status: e.target.value })}><option value="">All statuses</option>{CONCERN_STATUSES.map(t => <option key={t}>{t}</option>)}</select>
            <label className="check-inline tiny"><input type="checkbox" checked={filters.activeOnly && !list.state.status} disabled={!!list.state.status} onChange={e => set({ activeOnly: e.target.checked })} />Open only</label>
            <SortBy options={[['id', 'ID'], ['dueDate', 'Action due'], ['raisedDate', 'Date raised'], ['severity', 'Severity'], ['status', 'Status'], ['owner', 'Owner'], ['packageCode', 'Package']]} sort={list.state.sort} order={list.state.order} fallback="id" onChange={list.setSort} />
            <Btn kind="small" onClick={() => { list.clear(); setFilters({ type: '', severity: '', area: '', owner: '', within: '', activeOnly: true }); setParams({}); }}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable revealFrom={page.revealFrom} columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort}
              empty={page.data && !page.data.total && !s?.total ? 'No risks or concerns recorded yet.' : 'No record matches. Change the search or filters.'} />
            <LoadMore source={page.lazy} noun="concerns" />
          </>
        )}
      </div>
      {editing && (
        <ConcernDrawer key={editing === 'new' ? 'new' : `${editing.id}-${editing.updatedAt ?? ''}`} base={base} concern={editing === 'new' ? null : editing}
          defaults={editing === 'new' ? { packageCode: pkg || null, type: 'Risk', severity: 'Medium', area: 'Delivery', status: 'Open' } : undefined}
          canWrite={access.canWrite} canManage={access.canManage} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
