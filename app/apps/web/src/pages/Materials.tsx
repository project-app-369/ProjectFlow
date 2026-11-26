import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, request, type MaterialWeight, type Page, type StockLine } from '../api';
import { RecordDrawer } from '../crud';
import { DataTable } from '../DataTable';
import { Icon } from '../icons';
import { SortBy, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { InsightsView, useInsights } from '../Insights';
import { ActualPlanBar, Badge, Btn, ErrorBox, Loading, PageHead, Pager } from '../ui';
import { stockFields, weightFields } from './procFields';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const t = (kg: number | null) => (kg == null ? '—' : `${(kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`);

/** Procurement → Materials: how much material has arrived against what is needed, and the stock still on hand. */
export default function Materials() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const list = useListState();
  const [filters, setFilters] = useState({ facility: '', supply: '', category: '', yard: '' });
  const [stockId, setStockId] = useDeepLink();
  const setStock = (v: StockLine | 'new' | null) => setStockId(v === null ? null : v === 'new' ? 'new' : v.id);
  const [weight, setWeight] = useState<MaterialWeight | 'new' | null>(null);
  const base = `/projects/${project.id}/materials`;

  const weights = useQuery({ queryKey: ['material-weights', project.id], queryFn: () => request<Page<MaterialWeight>>(`${base}/summary?pageSize=200`) });
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...filters });
  const page = useQuery({ queryKey: ['material-balance', project.id, query], queryFn: () => request<Page<StockLine>>(`${base}/balance${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['material-balance', project.id, q], q => request<Page<StockLine>>(`${base}/balance${q}`));
  const stock: StockLine | 'new' | null = stockId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === stockId) ?? null);
  const facets = page.data?.facets;

  const w = weights.data?.items ?? [];
  const insights = useInsights('materials', project.id, `/projects/${project.id}/materials/insights`);
  const pick = (f: Record<string, string>) => { const [k, v] = Object.entries(f)[0]; setFilters(s => ({ ...s, [k]: s[k as 'yard'] === v ? '' : v })); list.set({}); };
  const isOn = (f: Record<string, string>) => Object.entries(f).every(([k, v]) => filters[k as 'yard'] === v);

  const columns = useMemo<ColumnDef<StockLine>[]>(() => [
    {
      id: 'item', header: 'MATERIAL', meta: { sortKey: 'materialCode' },
      cell: ({ row: { original: r } }) => (
        <button className="link-button" onClick={() => setStock(r)}>
          <strong>{r.materialCode ?? r.id}</strong>
          <small className="muted" style={{ display: 'block', whiteSpace: 'normal', maxWidth: 380 }}>{r.description}</small>
        </button>
      ),
    },
    { id: 'facility', header: 'FACILITY', meta: { sortKey: 'facility' }, cell: ({ row: { original: r } }) => <span className="tiny">{r.facility ?? '—'}<span className="muted"> · {r.supply ?? '—'}</span></span> },
    { id: 'category', header: 'CATEGORY', meta: { sortKey: 'category' }, cell: ({ row: { original: r } }) => r.category ?? '—' },
    { id: 'balance', header: 'BALANCE', meta: { sortKey: 'balance' }, cell: ({ row: { original: r } }) => <strong className="mono">{r.balance != null ? r.balance.toLocaleString('en-GB') : '—'} <span className="muted tiny">{r.unit ?? ''}</span></strong> },
    { id: 'where', header: 'WHERE', meta: { sortKey: 'yard' }, cell: ({ row: { original: r } }) => <span className="tiny">{r.yard ?? '—'}{r.location ? <span className="muted"> · {r.location}</span> : ''}</span> },
    { id: 'source', header: 'PO / MRIR', cell: ({ row: { original: r } }) => <span className="tiny">{r.poNo ?? '—'}<span className="muted"> · {r.mrirNo ?? '—'}</span></span> },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: r } }) => (r.status ? <Badge>{r.status}</Badge> : <span className="tiny muted">—</span>) },
    { id: 'open', header: '', cell: ({ row: { original: r } }) => <button className="icon-btn" aria-label={`Open ${r.materialCode ?? r.id}`} onClick={() => setStock(r)}><Icon name="arrow" /></button> },
  ], []);

  const sel = (key: keyof typeof filters, label: string, options: string[] | undefined) => (
    <select className="filter" aria-label={`Filter by ${label}`} value={filters[key]} onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); list.set({}); }}>
      <option value="">All {label}</option>{(options ?? []).map(o => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <>
      <PageHead title="Materials" desc="Weight of material arrived against the weight needed for purchase, and the stock still on hand in the yards."
        actions={<Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}/balance.csv${list.query(filters)}`, 'material-balance.csv').catch(e => toast(e.message))}>Export CSV</Btn>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} pair twoCol />

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <div><h2>Weights by facility</h2><p>Needed for purchase, arrived and on the yards</p></div>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setWeight('new')}>Add line</Btn>}
        </div>
        {weights.error ? <ErrorBox error={weights.error} /> : weights.isPending ? <Loading /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SUPPLY</th><th>FACILITY</th><th style={{ textAlign: 'right' }}>NEEDED</th><th style={{ textAlign: 'right' }}>ARRIVED</th><th>ARRIVED SHARE</th><th style={{ textAlign: 'right' }}>ON VSP YARD</th><th style={{ textAlign: 'right' }}>ON MC YARD</th><th /></tr></thead>
              <tbody>
                {w.map(r => (
                  <tr key={r.id}>
                    <td>{r.supply}</td><td><strong>{r.facility}</strong></td>
                    <td style={{ textAlign: 'right' }} className="mono">{t(r.mtoKg)}</td><td style={{ textAlign: 'right' }} className="mono">{t(r.arrivedKg)}</td>
                    <td style={{ minWidth: 220 }}>{r.arrivedPct != null ? <ActualPlanBar actual={r.arrivedPct} plan={null} compact /> : <span className="tiny muted">no target</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{t(r.vspYardKg)}</td><td style={{ textAlign: 'right' }} className="mono">{t(r.mcYardKg)}</td>
                    <td>{access.canWrite && <Btn kind="small" onClick={() => setWeight(r)}>Edit</Btn>}</td>
                  </tr>
                ))}
                {!w.length && <tr><td colSpan={8} className="empty">No weights recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><h2>Stock on hand</h2><p>Material still in the yards and warehouses</p></div>
          <div className="actions"><span className="tiny muted">{page.data?.total ?? '…'} lines</span>{access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setStock('new')}>Add stock line</Btn>}</div>
        </div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search code, description, PO, supplier, MRIR or heat no…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search stock" /></label>
          <div className="filter-group">
            {sel('facility', 'facilities', facets?.facility)}{sel('supply', 'supply', facets?.supply)}{sel('category', 'categories', facets?.category)}{sel('yard', 'yards', facets?.yard)}
            <SortBy options={[['facility', 'Facility'], ['discipline', 'Discipline'], ['category', 'Category'], ['materialCode', 'Material'], ['balance', 'Balance'], ['yard', 'Yard'], ['status', 'Status']]} sort={list.state.sort} order={list.state.order} fallback="facility" onChange={list.setSort} />
            <Btn kind="small" onClick={() => { list.clear(); setFilters({ facility: '', supply: '', category: '', yard: '' }); }}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort} empty="No stock line matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>

      {stock && (
        <RecordDrawer title={stock === 'new' ? 'New stock line' : `${stock.materialCode ?? stock.id} · Stock`} size="lg" base={`${base}/balance`} id={stock === 'new' ? undefined : stock.id} record={stock === 'new' ? null : stock as never}
          fields={stockFields({ facility: facets?.facility ?? [], supply: facets?.supply ?? [], discipline: facets?.disciplines ?? [], category: facets?.category ?? [], yard: facets?.yard ?? [] })}
          canDelete={access.canManage} invalidate={['material-balance', 'procurement-dashboard', 'insights']} onClose={() => setStock(null)} />
      )}
      {weight && (
        <RecordDrawer title={weight === 'new' ? 'New weight line' : `${weight.facility} · Weights`} size="sm" base={`${base}/summary`} id={weight === 'new' ? undefined : weight.id} record={weight === 'new' ? null : weight as never}
          fields={weightFields} defaults={weight === 'new' ? { supply: 'Client' } : undefined} canDelete={access.canManage} invalidate={['material-weights', 'procurement-dashboard', 'insights']} onClose={() => setWeight(null)} />
      )}
    </>
  );
}
