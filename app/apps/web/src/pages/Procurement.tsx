import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, request, type Page, type ProcurementPackage, type ProcurementSummary } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, initials } from '../format';
import { Icon } from '../icons';
import { Toolbar, useListState } from '../Register';
import { useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, Modal, PageHead, Pager, Stat } from '../ui';

const PAGE_SIZE = 50;

export default function Procurement() {
  const { project } = useApp();
  const toast = useToast();
  const list = useListState();
  const [selected, setSelected] = useState<ProcurementPackage | null>(null);
  const base = `/projects/${project.id}/procurement`;

  const summary = useQuery({ queryKey: ['procurement-summary', project.id], queryFn: () => request<ProcurementSummary>(`${base}/summary`) });
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE });
  const page = useQuery({ queryKey: ['procurement-packages', project.id, query], queryFn: () => request<Page<ProcurementPackage>>(`${base}/packages${query}`), placeholderData: keepPreviousData });

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
  const csv = `${base}/packages.csv${list.query()}`;

  return (
    <>
      <PageHead title="Procurement Plan" desc={`LOA and PO award register with buyer and expeditor ownership${s ? ` · ${s.total} packages` : ''}.`}
        actions={<Btn kind="small" icon="down" onClick={() => downloadCsv(csv, 'procurement-packages.csv').catch(e => toast(e.message))}>Export CSV</Btn>} />
      <div className="stats">
        <Stat label="Total packages" value={s?.total ?? '—'} foot={`Across ${s ? Object.keys(s.byDiscipline).length : '—'} disciplines`} icon="box" />
        <Stat label="PO placed" value={poPlaced} foot={s ? `${Math.round((poPlaced / s.total) * 100)}% of register` : ''} icon="check" />
        <Stat label="LOA issued" value={s?.byStatus['LOA issued'] ?? 0} foot="Letter of award, PO pending" icon="clock" />
        <Stat label="In tendering" value={s?.byStatus['In tendering'] ?? 0} foot="No LOA recorded yet" icon="risk" />
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Procurement packages</h2><p>Select a package to review full award detail</p></div><span className="tiny muted">{page.data?.total ?? '…'} packages</span></div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search code, description, vendor or buyer…" label="Search procurement packages" />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort} empty="No packages match. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {selected && (
        <Modal title={`${selected.code} · Procurement package`} onClose={() => setSelected(null)} actions={<Btn onClick={() => setSelected(null)}>Close</Btn>}>
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
              ] as const).map(([k, v]) => <div key={k}><small>{k}</small><strong>{v || '—'}</strong></div>)}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
