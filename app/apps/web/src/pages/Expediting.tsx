import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { apiMode, downloadCsv, request, type ExpeditingPackage, type ExpeditingSummary, type Insights, type Page } from '../api';
import { RecordDrawer, suggest } from '../crud';
import { expeditingFields } from './procFields';
import { DataTable } from '../DataTable';
import { fmtDate, initials, signed } from '../format';
import { Icon } from '../icons';
import { Toolbar, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { ActualPlanBar, Badge, Btn, ErrorBox, Modal, PageHead, Pager, Stat } from '../ui';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown) => (v == null || v === '' ? undefined : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

function Progress({ p }: { p: ExpeditingPackage }) {
  if (p.actualPct == null) return <span className="tiny muted">No data</span>;
  return (
    <div className="progress-stack">
      <ActualPlanBar actual={p.actualPct} plan={p.planPct} compact />
    </div>
  );
}

function Pair({ label, plan, actual }: { label: string; plan?: number; actual?: number }) {
  if (plan == null && actual == null) return null;
  return <div><small>{label}</small><strong>{actual ?? '—'}% <span className="tiny muted">/ {plan ?? '—'}% plan</span></strong></div>;
}

function Detail({ p }: { p: ExpeditingPackage }) {
  if (p.discipline === 'Equipment') {
    const eta = text(p.etaSite);
    return (
      <>
        <div className="detail-grid">
          <div><small>Required on site (ROS)</small><strong>{fmtDate(p.rosDate)}</strong></div>
          <div><small>ETA at site</small><strong>{eta && isoDate.test(eta) ? fmtDate(eta) : eta ?? '—'}</strong></div>
          <Pair label="Engineering" plan={num(p.engPlan)} actual={num(p.engActual)} />
          <Pair label="Procurement" plan={num(p.procPlan)} actual={num(p.procActual)} />
          <Pair label="Fabrication" plan={num(p.fabPlan)} actual={num(p.fabActual)} />
          <Pair label="Testing" plan={num(p.testPlan)} actual={num(p.testActual)} />
          <Pair label="Delivery" plan={num(p.delPlan)} actual={num(p.delActual)} />
          <Pair label="Overall" plan={p.planPct ?? undefined} actual={p.actualPct ?? undefined} />
        </div>
        <h3>Highlight / area of concern</h3><p className="tiny muted" style={{ whiteSpace: 'pre-line' }}>{text(p.highlight) ?? 'None recorded.'}</p>
        <h3>Short-term action plan</h3><p className="tiny muted" style={{ whiteSpace: 'pre-line' }}>{text(p.actionPlan) ?? 'None recorded.'}</p>
      </>
    );
  }
  const delivery = text(p.deliveryDate);
  return (
    <>
      <div className="detail-grid">
        {text(p.poNo) && <div><small>PO number</small><strong>{text(p.poNo)}</strong></div>}
        {delivery && <div><small>PO delivery date</small><strong>{isoDate.test(delivery) ? fmtDate(delivery) : delivery}</strong></div>}
        <Pair label="Ex-works" plan={num(p.planExw)} actual={num(p.actExw)} />
        <Pair label="Arrival at site" plan={num(p.planArrival)} actual={num(p.actArrival)} />
        <Pair label="Cumulative progress" plan={p.planPct ?? undefined} actual={p.actualPct ?? undefined} />
        {p.variance != null && <div><small>Variance</small><strong>{signed(p.variance)}%</strong></div>}
      </div>
      {text(p.currentStatusText) && <><h3>Current status</h3><p className="tiny muted" style={{ whiteSpace: 'pre-line' }}>{text(p.currentStatusText)}</p></>}
    </>
  );
}

export default function Expediting() {
  const { project } = useApp();
  const toast = useToast();
  const access = useAccess();
  const canEdit = apiMode === 'sheets' && access.canWrite;
  const list = useListState();
  const [selectedId, setSelectedId] = useDeepLink();
  const setSelected = (v: ExpeditingPackage | null) => setSelectedId(v === null ? null : v.code);
  const [editing, setEditing] = useState<ExpeditingPackage | 'new' | null>(null);
  const base = `/projects/${project.id}/expediting`;

  const summary = useQuery({ queryKey: ['expediting-summary', project.id], queryFn: () => request<ExpeditingSummary>(`${base}/summary`) });
  const sheets = apiMode === 'sheets';
  const insights = useQuery({ queryKey: ['insights', 'expediting', project.id], enabled: sheets, queryFn: () => request<Insights>(`${base}/insights`) });
  const filter = usePick(list, { within: '' });
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, within: filter.extra.within });
  const page = useQuery({ queryKey: ['expediting-packages', project.id, query], queryFn: () => request<Page<ExpeditingPackage>>(`${base}/packages${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['expediting-packages', project.id, q], q => request<Page<ExpeditingPackage>>(`${base}/packages${q}`));
  const selected: ExpeditingPackage | null = (page.data?.items ?? []).find(r => r.code === selectedId) ?? null;

  const columns = useMemo<ColumnDef<ExpeditingPackage>[]>(() => [
    {
      id: 'package', header: 'PACKAGE', meta: { sortKey: 'code' },
      cell: ({ row: { original: p } }) => (
        <button className="link-button vendor" onClick={() => setSelected(p)}>
          <span className="vendor-logo">{initials(p.discipline)}</span>
          <span><strong>{p.code}</strong><small>{p.name}</small></span>
        </button>
      ),
    },
    { id: 'discipline', header: 'DISCIPLINE', meta: { sortKey: 'discipline' }, cell: ({ row: { original: p } }) => p.discipline },
    { id: 'vendor', header: 'VENDOR', meta: { sortKey: 'vendor' }, cell: ({ row: { original: p } }) => <span className="tiny">{p.vendor ?? '—'}</span> },
    { id: 'progress', header: 'CUMULATIVE PROGRESS', meta: { sortKey: 'actualPct' }, cell: ({ row: { original: p } }) => <Progress p={p} /> },
    { id: 'variance', header: 'VARIANCE', meta: { sortKey: 'variance' }, cell: ({ row: { original: p } }) => <span className={(p.variance ?? 0) < 0 ? 'negative' : 'positive'}>{p.variance == null ? '—' : `${signed(p.variance)}%`}</span> },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: p } }) => <Badge>{p.status}</Badge> },
    { id: 'open', header: '', cell: ({ row: { original: p } }) => <button className="icon-btn" aria-label={`Open ${p.code}`} onClick={() => setSelected(p)}><Icon name="arrow" /></button> },
  ], []);

  const s = summary.data;
  const csv = `${base}/packages.csv${list.query({ within: filter.extra.within })}`;

  return (
    <>
      <PageHead title="Vendor Overview" desc={`Equipment, Structural, Piping, Valves & Misc expediting status${s ? ` · ${s.total} packages` : ''}.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(csv, 'expediting-packages.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {canEdit && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New package</Btn>}
        </>} />
      {sheets ? <InsightsView data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} /> : <div className="stats">
        <Stat label="Total packages" value={s?.total ?? '—'} foot="Across 5 disciplines" icon="chart" />
        <Stat label="Delayed" value={s?.delayed ?? '—'} foot="ETA at site slipping past ROS" icon="clock" />
        <Stat label="At risk" value={s?.atRisk ?? '—'} foot="Watching forecast vs. plan" icon="risk" />
        <Stat label="Normal / on track" value={s?.normal ?? '—'} foot="No active flag" icon="check" />
        <Stat label="Flagged" value={s ? s.delayed + s.atRisk : '—'} foot="Delay or at-risk status" icon="flag" />
        <Stat label="Flag rate" value={s?.total ? Math.round(((s.delayed + s.atRisk) / s.total) * 100) : 0} unit="%" foot="Share requiring follow-up" icon="chart" />
      </div>}
      <div className="panel">
        <div className="panel-head"><div><h2>Expediting packages</h2><p>Select a package to review highlights and action plan</p></div><span className="tiny muted">{page.data?.total ?? '…'} packages</span></div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search code, vendor or description…" label="Search expediting packages" defaultSort="code" sorts={[['code', 'Package'], ['actualPct', 'Progress'], ['variance', 'Variance'], ['discipline', 'Discipline'], ['vendor', 'Vendor'], ['status', 'Status']]} />
        <FilterChips chips={filter.chips} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort} empty="No packages match. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {selected && (
        <Modal title={`${selected.code} · Expediting status`} onClose={() => setSelected(null)} actions={<>{canEdit && <Btn onClick={() => { setEditing(selected); setSelected(null); }}>Edit</Btn>}<Btn onClick={() => setSelected(null)}>Close</Btn></>}>
          <div className="dialog-body">
            <div className="drawer-intro">
              <div className="eyebrow">{selected.discipline}{selected.vendor ? ` · ${selected.vendor}` : ''}</div>
              <h1>{selected.name ?? selected.code}</h1>
              <Badge>{selected.status}</Badge>
            </div>
            <Detail p={selected} />
          </div>
        </Modal>
      )}
      {editing && (() => {
        const rows = (page.data?.items ?? []) as unknown as Record<string, unknown>[];
        return (
          <RecordDrawer title={editing === 'new' ? 'New expediting package' : `${editing.code} · Edit expediting status`} size="lg" base={base + '/packages'} id={editing === 'new' ? undefined : editing.id}
            record={editing === 'new' ? null : editing as never} defaults={editing === 'new' ? { status: 'Normal' } : undefined} canDelete={access.canManage}
            invalidate={['expediting-packages', 'expediting-summary', 'procurement-dashboard', 'dashboard', 'insights']}
            fields={expeditingFields({ discipline: page.data?.facets.disciplines ?? [], vendor: suggest(rows, 'vendor') })} onClose={() => setEditing(null)} />
        );
      })()}
    </>
  );
}
