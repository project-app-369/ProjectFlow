import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { apiMode, downloadCsv, request, type Insights, type Page, type ProcurementPackage, type ProcurementSummary } from '../api';
import { RecordDrawer, suggest } from '../crud';
import { packageFields } from './procFields';
import { DataTable } from '../DataTable';
import { fmtDate, initials } from '../format';
import { Icon } from '../icons';
import { Toolbar, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { Badge, Btn, ErrorBox, Modal, PageHead, Pager, Stat } from '../ui';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;

export default function Procurement() {
  const { project } = useApp();
  const toast = useToast();
  const access = useAccess();
  const canEdit = apiMode === 'sheets' && access.canWrite;
  const list = useListState();
  const [selectedId, setSelectedId] = useDeepLink();
  const setSelected = (v: ProcurementPackage | null) => setSelectedId(v === null ? null : v.code);
  const [editing, setEditing] = useState<ProcurementPackage | 'new' | null>(null);
  const base = `/projects/${project.id}/procurement`;

  const summary = useQuery({ queryKey: ['procurement-summary', project.id], queryFn: () => request<ProcurementSummary>(`${base}/summary`) });
  const sheets = apiMode === 'sheets';
  const insights = useQuery({ queryKey: ['insights', 'plan', project.id], enabled: sheets, queryFn: () => request<Insights>(`${base}/insights`) });
  const filter = usePick(list, { workPackage: '', buyer: '' });
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, workPackage: filter.extra.workPackage, buyer: filter.extra.buyer });
  const page = useQuery({ queryKey: ['procurement-packages', project.id, query], queryFn: () => request<Page<ProcurementPackage>>(`${base}/packages${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['procurement-packages', project.id, q], q => request<Page<ProcurementPackage>>(`${base}/packages${q}`));
  const selected: ProcurementPackage | null = (page.data?.items ?? []).find(r => r.code === selectedId) ?? null;

  const columns = useMemo<ColumnDef<ProcurementPackage>[]>(() => [
    {
      id: 'package', header: 'PACKAGE', meta: { sortKey: 'code' },
      cell: ({ row: { original: p } }) => (
        <button className="link-button vendor" onClick={() => setSelected(p)}>
          <span className="vendor-logo">{initials(p.discipline)}</span>
          <span><strong>{p.code}</strong><small>{p.description}</small></span>
        </button>
      ),
    },
    { id: 'discipline', header: 'DISCIPLINE', meta: { sortKey: 'discipline' }, cell: ({ row: { original: p } }) => p.discipline ?? '—' },
    { id: 'vendor', header: 'VENDOR', meta: { sortKey: 'vendor' }, cell: ({ row: { original: p } }) => p.vendor ?? '—' },
    { id: 'loa', header: 'LOA', meta: { sortKey: 'loaDate' }, cell: ({ row: { original: p } }) => (p.loaNo ? fmtDate(p.loaDate) : <span className="tiny muted">Not issued</span>) },
    { id: 'po', header: 'PO', meta: { sortKey: 'poDate' }, cell: ({ row: { original: p } }) => (p.poNo ? (p.poDate ? fmtDate(p.poDate) : <span className="tiny muted">Date TBA</span>) : <span className="tiny muted">Not placed</span>) },
    { id: 'contacts', header: 'BUYER / EXPEDITOR', cell: ({ row: { original: p } }) => <span className="tiny">{p.buyer ?? '—'} <span className="muted">/ {p.expeditor ?? '—'}</span></span> },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: p } }) => <Badge>{p.status}</Badge> },
    { id: 'open', header: '', cell: ({ row: { original: p } }) => <button className="icon-btn" aria-label={`Open ${p.code}`} onClick={() => setSelected(p)}><Icon name="arrow" /></button> },
  ], []);

  const s = summary.data;
  const poPlaced = s?.byStatus['PO placed'] ?? 0;
  const csv = `${base}/packages.csv${list.query({ workPackage: filter.extra.workPackage, buyer: filter.extra.buyer })}`;

  return (
    <>
      <PageHead title="Procurement Plan" desc={`LOA and PO award register with buyer and expeditor ownership${s ? ` · ${s.total} packages` : ''}.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(csv, 'procurement-packages.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {canEdit && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New package</Btn>}
        </>} />
      {sheets ? <InsightsView data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} /> : <div className="stats">
        <Stat label="Total packages" value={s?.total ?? '—'} foot={`Across ${s ? Object.keys(s.byDiscipline).length : '—'} disciplines`} icon="box" />
        <Stat label="PO placed" value={poPlaced} foot={s ? `${Math.round((poPlaced / s.total) * 100)}% of register` : ''} icon="check" />
        <Stat label="LOA issued" value={s?.byStatus['LOA issued'] ?? 0} foot="Letter of award, PO pending" icon="clock" />
        <Stat label="Not yet awarded" value={(s?.byStatus['In tendering'] ?? 0) + (s?.byStatus['Planned'] ?? 0)} foot={`${s?.byStatus['Planned'] ?? 0} planned · ${s?.byStatus['In tendering'] ?? 0} in tendering`} icon="risk" />
        <Stat label="In tendering" value={s?.byStatus['In tendering'] ?? '—'} foot="Bid process under way" icon="calendar" />
        <Stat label="Planned" value={s?.byStatus['Planned'] ?? '—'} foot="Awaiting procurement start" icon="layers" />
      </div>}
      <div className="panel">
        <div className="panel-head"><div><h2>Procurement packages</h2><p>Select a package to review full award detail</p></div><span className="tiny muted">{page.data?.total ?? '…'} packages</span></div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search code, description, vendor or buyer…" label="Search procurement packages" defaultSort="code" sorts={[['code', 'Package'], ['loaDate', 'LOA date'], ['poDate', 'PO date'], ['discipline', 'Discipline'], ['vendor', 'Vendor'], ['status', 'Status']]} />
        <FilterChips chips={filter.chips} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort} empty="No packages match. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {selected && (
        <Modal title={`${selected.code} · Procurement package`} onClose={() => setSelected(null)} actions={<>{canEdit && <Btn onClick={() => { setEditing(selected); setSelected(null); }}>Edit</Btn>}<Btn onClick={() => setSelected(null)}>Close</Btn></>}>
          <div className="dialog-body">
            <div className="drawer-intro">
              <div className="eyebrow">{selected.discipline}</div>
              <h1>{selected.description ?? selected.code}</h1>
              <Badge>{selected.status}</Badge> <span className="tiny muted">{selected.vendor ?? 'Vendor not yet assigned'}</span>
            </div>
            <div className="detail-grid">
              {([
                ['Vendor code', selected.vendorCode], ['Manufacturers / origins', selected.origins],
                ['LOA number', selected.loaNo ?? 'Not issued'], ['LOA date', fmtDate(selected.loaDate)],
                ['PO number', selected.poNo ?? 'Not placed'], ['PO date', selected.poDate ? fmtDate(selected.poDate) : selected.poNo ? 'TBA' : '—'],
                ['Buyer', selected.buyer], ['Expeditor', selected.expeditor],
                ['Project engineer (PE)', selected.pe], ['VQC', selected.vqc],
                ['Work package', selected.workPackage], ['Contract type', selected.packageType], ['Weight in progress', selected.weightPct != null ? `${selected.weightPct.toFixed(2)}%` : null],
              ] as const).map(([k, v]) => <div key={k}><small>{k}</small><strong>{v || '—'}</strong></div>)}
            </div>
          </div>
        </Modal>
      )}
      {editing && (() => {
        const rows = (page.data?.items ?? []) as unknown as Record<string, unknown>[];
        return (
          <RecordDrawer title={editing === 'new' ? 'New procurement package' : `${editing.code} · Edit package`} size="lg" base={base + '/packages'} id={editing === 'new' ? undefined : editing.id}
            record={editing === 'new' ? null : editing as never} canDelete={access.canManage} invalidate={['procurement-packages', 'procurement-summary', 'procurement-dashboard', 'dashboard', 'insights']}
            fields={packageFields({ discipline: page.data?.facets.disciplines ?? [], vendor: suggest(rows, 'vendor'), buyer: suggest(rows, 'buyer'), expeditor: suggest(rows, 'expeditor'), workPackage: suggest(rows, 'workPackage') })}
            deleteNote="The package leaves the register. Concerns and shipments that name its code are kept." onClose={() => setEditing(null)} />
        );
      })()}
    </>
  );
}
