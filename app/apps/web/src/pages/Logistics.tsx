import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, request, type Page, type Shipment } from '../api';
import { RecordDrawer, suggest } from '../crud';
import { DataTable } from '../DataTable';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Pager, Stat } from '../ui';
import { shipmentFields, SHIPMENT_STATUSES } from './procFields';

const PAGE_SIZE = 50;
const t = (kg: number) => `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`;

/** Procurement → Logistics: every shipment from vendor to yard, from the PTSC weekly report and the client's own shipments. */
export default function Logistics() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const list = useListState();
  const [filters, setFilters] = useState({ source: '', deliveryYard: '', late: false });
  const [editing, setEditing] = useState<Shipment | 'new' | null>(null);
  const base = `/projects/${project.id}/logistics/shipments`;

  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, source: filters.source, deliveryYard: filters.deliveryYard });
  const page = useQuery({ queryKey: ['shipments', project.id, query], queryFn: () => request<Page<Shipment>>(`${base}${query}`), placeholderData: keepPreviousData });
  const all = useQuery({ queryKey: ['shipments-all', project.id], queryFn: () => request<Page<Shipment>>(`${base}?pageSize=200`), staleTime: 30_000 });
  const rows = all.data?.items ?? [];

  const stats = useMemo(() => ({
    total: all.data?.total ?? 0,
    inTransit: rows.filter(r => !r.actualOnSite && r.status !== 'Received').length,
    overdue: rows.filter(r => r.overdue).length,
    held: rows.filter(r => r.issue && r.status !== 'Received').length,
    kg: rows.reduce((n, r) => n + (r.grossWeightKg ?? 0), 0),
    received: rows.filter(r => r.status === 'Received').reduce((n, r) => n + (r.grossWeightKg ?? 0), 0),
  }), [rows, all.data]);

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

  const shown = filters.late ? (page.data?.items ?? []).filter(r => r.overdue || (r.issue && r.status !== 'Received')) : (page.data?.items ?? []);
  const yards = page.data?.facets.deliveryYard ?? [];

  return (
    <>
      <PageHead title="Logistics" desc="Shipments from vendor to yard: where each one is, when it is due on site, and what is holding it."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query({ source: filters.source, deliveryYard: filters.deliveryYard })}`, 'logistics-shipments.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New shipment</Btn>}
        </>} />
      <div className="stats">
        <Stat label="Shipments" value={stats.total} foot={`${t(stats.received)} of ${t(stats.kg)} received`} icon="box" />
        <Stat label="Not yet on site" value={stats.inTransit} foot="On sailing, in customs, inland or planned" icon="calendar" />
        <Stat label="Overdue" value={stats.overdue} foot={<span className={stats.overdue ? 'negative' : ''}>Forecast date before the cut-off</span>} icon="clock" />
        <Stat label="Held" value={stats.held} foot="A pending or stuck note, not yet received" icon="risk" />
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Shipments</h2><p>Select a shipment to update its dates and status</p></div><span className="tiny muted">{page.data?.total ?? '…'} shipments</span></div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search package, PO, shipment, vessel or note…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search shipments" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by supply" value={filters.source} onChange={e => { setFilters(f => ({ ...f, source: e.target.value })); list.set({}); }}><option value="">All supply</option><option>PTSC</option><option>Client</option></select>
            <select className="filter" aria-label="Filter by status" value={list.state.status} onChange={e => list.set({ status: e.target.value })}><option value="">All statuses</option>{SHIPMENT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            <select className="filter" aria-label="Filter by yard" value={filters.deliveryYard} onChange={e => { setFilters(f => ({ ...f, deliveryYard: e.target.value })); list.set({}); }}><option value="">All yards</option>{yards.map(y => <option key={y}>{y}</option>)}</select>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={filters.late} onChange={e => setFilters(f => ({ ...f, late: e.target.checked }))} />Late or held only</label>
            <Btn kind="small" onClick={() => { list.clear(); setFilters({ source: '', deliveryYard: '', late: false }); }}>Clear</Btn>
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
          canDelete={access.canManage} size="lg" invalidate={['shipments', 'shipments-all', 'procurement-dashboard']} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
