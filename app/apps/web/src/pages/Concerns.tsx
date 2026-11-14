import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CONCERN_AREAS, CONCERN_STATUSES, CONCERN_TYPES, downloadCsv, request, SEVERITIES, type Concern, type ConcernSummary, type Page } from '../api';
import { RecordDrawer, suggest } from '../crud';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { Icon } from '../icons';
import { useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { InsightsView, useInsights } from '../Insights';
import { Badge, Btn, ErrorBox, PageHead, Pager } from '../ui';
import { concernFields } from './procFields';
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
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, type: filters.type, severity: filters.severity, area: filters.area, owner: filters.owner, within: filters.within, packageCode: pkg, active: filters.activeOnly && !list.state.status ? 'true' : undefined });
  const page = useQuery({ queryKey: ['concerns', project.id, query], queryFn: () => request<Page<Concern>>(`${base}${query}`), placeholderData: keepPreviousData });
  const editing: Concern | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);
  // codes for the package picker come from the registers themselves
  const codes = useQuery({ queryKey: ['package-codes', project.id], staleTime: 60_000, queryFn: async () => {
    const [a, b] = await Promise.all([
      request<Page<{ code: string }>>(`/projects/${project.id}/procurement/packages?pageSize=200`).catch(() => null),
      request<Page<{ code: string }>>(`/projects/${project.id}/expediting/packages?pageSize=200`).catch(() => null),
    ]);
    return suggest([...(a?.items ?? []), ...(b?.items ?? [])], 'code');
  } });

  const columns = useMemo<ColumnDef<Concern>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: c } }) => <span className="mono">{c.id}</span> },
    {
      id: 'title', header: 'CONCERN',
      cell: ({ row: { original: c } }) => (
        <button className="link-button" onClick={() => setEditing(c)}>
          <strong style={{ whiteSpace: 'normal', display: 'block', maxWidth: 360 }}>{c.title}</strong>
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
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New concern</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} />
      <div className="panel">
        <div className="panel-head"><div><h2>Register</h2><p>Select a row to review or update it</p></div><span className="tiny muted">{page.data?.total ?? '…'} records</span></div>
        {pkg && <div className="banner" style={{ margin: '0 22px 14px' }}>Showing concerns for <strong>{pkg}</strong>. <button className="btn text" onClick={() => setParams({})}>Show all</button></div>}
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search title, package, owner or action…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search concerns" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by type" value={filters.type} onChange={e => set({ type: e.target.value })}><option value="">All types</option>{CONCERN_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by severity" value={filters.severity} onChange={e => set({ severity: e.target.value })}><option value="">All severities</option>{[...SEVERITIES].reverse().map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by area" value={filters.area} onChange={e => set({ area: e.target.value })}><option value="">All areas</option>{CONCERN_AREAS.map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by status" value={list.state.status} onChange={e => list.set({ status: e.target.value })}><option value="">All statuses</option>{CONCERN_STATUSES.map(t => <option key={t}>{t}</option>)}</select>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={filters.activeOnly && !list.state.status} disabled={!!list.state.status} onChange={e => set({ activeOnly: e.target.checked })} />Open only</label>
            <Btn kind="small" onClick={() => { list.clear(); setFilters({ type: '', severity: '', area: '', owner: '', within: '', activeOnly: true }); setParams({}); }}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort}
              empty={page.data && !page.data.total && !s?.total ? 'No risks or concerns recorded yet.' : 'No record matches. Change the search or filters.'} />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {editing && (
        <RecordDrawer title={editing === 'new' ? 'New risk, concern or issue' : `${editing.id} · ${editing.type}`} fields={concernFields(codes.data ?? [])} record={editing === 'new' ? null : editing as never}
          defaults={editing === 'new' ? { packageCode: pkg || null, type: 'Risk', severity: 'Medium', area: 'Delivery', status: 'Open' } : undefined}
          base={base} id={editing === 'new' ? undefined : editing.id} canDelete={access.canManage} invalidate={['concerns', 'concern-summary', 'procurement-dashboard', 'insights']} onClose={() => setEditing(null)}>
          {editing !== 'new' && (editing.source !== 'Manual') && <p className="banner">Raised from {editing.source === 'Expediting' ? 'the expediting register' : 'the weekly logistics report'}{editing.sourceRef ? ` (${editing.sourceRef})` : ''}. Change it here as the situation changes.</p>}
        </RecordDrawer>
      )}
    </>
  );
}
