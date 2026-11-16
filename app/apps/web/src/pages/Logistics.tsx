import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, request, type Page, type Shipment } from '../api';
import { RecordDrawer, suggest } from '../crud';
import { DataTable } from '../DataTable';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { SortBy, useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { InsightsView, useInsights } from '../Insights';
import { Badge, Btn, ErrorBox, PageHead, Pager } from '../ui';
import { shipmentFields, SHIPMENT_STATUSES } from './procFields';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const NONE = { source: '', deliveryYard: '', yard: '', month: '', within: '', late: false };

/** Procurement → Logistics: every shipment from vendor to yard, from the PTSC weekly report and the client's own shipments. */
export default function Logistics() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const list = useListState();
  const [filters, setFilters] = useState(NONE);
  const [editingId, setEditingId] = useDeepLink();
  const setEditing = (v: Shipment | 'new' | null) => setEditingId(v === null ? null : v === 'new' ? 'new' : v.id);
  const base = `/projects/${project.id}/logistics/shipments`;

  const filterQuery = { source: filters.source, deliveryYard: filters.deliveryYard, yard: filters.yard, month: filters.month, within: filters.within, late: filters.late ? 'true' : undefined };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...filterQuery });
  const page = useQuery({ queryKey: ['shipments', project.id, query], queryFn: () => request<Page<Shipment>>(`${base}${query}`), placeholderData: keepPreviousData });
  const editing: Shipment | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);
  const insights = useInsights('logistics', project.id, `/projects/${project.id}/logistics/insights`);
  const rows = page.data?.items ?? [];
  /** A box or bar in the summary sets one filter on the register: a status, a month, a yard or a look-ahead window. */
  const pick = (f: Record<string, string>) => {
    if ('status' in f) list.set({ status: list.state.status === f.status ? '' : f.status });
    else { const [k, v] = Object.entries(f)[0]; setFilters(s => ({ ...s, [k]: s[k as 'month'] === v ? '' : v })); list.set({}); }
  };
  const isOn = (f: Record<string, string>) => ('status' in f ? list.state.status === f.status : Object.entries(f).every(([k, v]) => filters[k as 'month'] === v));

  const columns = useMemo<ColumnDef<Shipment>[]>(() => [
    {
      id: 'shipment', header: 'SHIPMENT', meta: { sortKey: 'shipmentNo' },
      cell: ({ row: { original: r } }) => (
        <button className="link-button" onClick={() => setEditing(r)}>
          <strong>{r.shipmentNo ?? r.id}</strong>
          <small className="muted" style={{ display: 'block', whiteSpace: 'normal', maxWidth: 320 }}>{r.packageNo}{r.shipmentDescription ? ` · ${r.shipmentDescription}` : ''}</small>
        </button>
      ),
    },
    { id: 'source', header: 'SUPPLY', cell: ({ row: { original: r } }) => <span className="tiny">{r.source}</span> },
    { id: 'etd', header: 'ETD / ETA PORT', meta: { sortKey: 'etaPod' }, cell: ({ row: { original: r } }) => <span className="tiny">{r.etdPol ? fmtDate(r.etdPol) : '—'} → {r.etaPod ? fmtDate(r.etaPod) : '—'}</span> },
    { id: 'forecast', header: 'FORECAST ON SITE', meta: { sortKey: 'forecastOnSite' }, cell: ({ row: { original: r } }) => <span className={r.overdue ? 'negative' : ''}>{r.forecastOnSite ? fmtDate(r.forecastOnSite) : 'TBA'}{r.overdue ? ` · ${r.daysLate} d late` : ''}</span> },
    { id: 'actual', header: 'ACTUAL', meta: { sortKey: 'actualOnSite' }, cell: ({ row: { original: r } }) => (r.actualOnSite ? fmtDate(r.actualOnSite) : '—') },
    { id: 'weight', header: 'WEIGHT', meta: { sortKey: 'grossWeightKg' }, cell: ({ row: { original: r } }) => (r.grossWeightKg != null ? `${r.grossWeightKg.toLocaleString('en-GB')} kg` : '—') },
    { id: 'yard', header: 'YARD', cell: ({ row: { original: r } }) => r.deliveryYard ?? '—' },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: r } }) => <><Badge>{r.status}</Badge>{r.issue && r.status !== 'Received' && <> <Badge tone="amber">Held</Badge></>}</> },
    { id: 'open', header: '', cell: ({ row: { original: r } }) => <button className="icon-btn" aria-label={`Open ${r.shipmentNo ?? r.id}`} onClick={() => setEditing(r)}><Icon name="arrow" /></button> },
  ], []);

  const shown = page.data?.items ?? [];
  const yards = page.data?.facets.deliveryYard ?? [];

  return (
    <>
      <PageHead title="Logistics" desc="Shipments from vendor to yard: where each one is, when it is due on site, and what is holding it."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query(filterQuery)}`, 'logistics-shipments.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New shipment</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} />
      <div className="panel">
        <div className="panel-head"><div><h2>Shipments</h2><p>Select a shipment to update its dates and status</p></div><span className="tiny muted">{page.data?.total ?? '…'} shipments</span></div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search package, PO, shipment, vessel or note…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search shipments" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by supply" value={filters.source} onChange={e => { setFilters(f => ({ ...f, source: e.target.value })); list.set({}); }}><option value="">All supply</option><option>PTSC</option><option>Client</option></select>
            <select className="filter" aria-label="Filter by status" value={list.state.status} onChange={e => list.set({ status: e.target.value })}><option value="">All statuses</option>{SHIPMENT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            <select className="filter" aria-label="Filter by yard" value={filters.deliveryYard} onChange={e => { setFilters(f => ({ ...f, deliveryYard: e.target.value, yard: '' })); list.set({}); }}><option value="">All yards</option>{yards.map(y => <option key={y}>{y}</option>)}</select>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={filters.late} onChange={e => setFilters(f => ({ ...f, late: e.target.checked }))} />Late or held only</label>
            <SortBy options={[['forecastOnSite', 'Forecast on site'], ['etaPod', 'ETA port'], ['actualOnSite', 'Actual on site'], ['shipmentNo', 'Shipment'], ['packageNo', 'Package'], ['grossWeightKg', 'Weight'], ['status', 'Status']]} sort={list.state.sort} order={list.state.order} fallback="forecastOnSite" onChange={list.setSort} />
            <Btn kind="small" onClick={() => { list.clear(); setFilters(NONE); }}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={shown} state={list.state} onSort={list.toggleSort} empty="No shipment matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {editing && (
        <RecordDrawer title={editing === 'new' ? 'New shipment' : `${editing.shipmentNo ?? editing.id} · Shipment`} fields={shipmentFields({ yard: suggest(rows as never, 'deliveryYard'), transport: suggest(rows as never, 'transport') })}
          record={editing === 'new' ? null : editing as never} defaults={editing === 'new' ? { source: 'PTSC', status: 'Planned' } : undefined} base={base} id={editing === 'new' ? undefined : editing.id}
          canDelete={access.canManage} size="lg" invalidate={['shipments', 'insights', 'procurement-dashboard']} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
