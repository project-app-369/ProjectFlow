import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { downloadCsv, request, type Milestone, type MilestoneStatus, type MilestoneSummary, type Page } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { Icon } from '../icons';
import { Toolbar, useListState } from '../Register';
import { useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Pager, Stat } from '../ui';

const PAGE_SIZE = 50;
const TONE: Record<MilestoneStatus, Tone> = { Done: 'green', Overdue: 'red', 'Due soon': 'amber', Planned: 'indigo' };

const slip = (days: number | null) => (days == null ? '—' : days === 0 ? 'On plan' : `${days > 0 ? '+' : ''}${days} d`);

/** Key milestones loaded from the project's Key Milestones workbook (reference data, read-only). */
export default function Milestones() {
  const { project } = useApp();
  const toast = useToast();
  const list = useListState();
  const base = `/projects/${project.id}/milestones`;

  const summary = useQuery({ queryKey: ['milestone-summary', project.id], queryFn: () => request<MilestoneSummary>(`${base}/summary`) });
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE });
  const page = useQuery({ queryKey: ['milestones', project.id, query], queryFn: () => request<Page<Milestone>>(`${base}${query}`), placeholderData: keepPreviousData });

  const columns = useMemo<ColumnDef<Milestone>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: m } }) => <span className="mono">{m.id}</span> },
    { id: 'description', header: 'KEY DATE', meta: { sortKey: 'description' }, cell: ({ row: { original: m } }) => <span><strong>{m.description}</strong>{m.comment && <small className="muted" style={{ display: 'block', whiteSpace: 'normal', maxWidth: 360 }}>{m.comment}</small>}</span> },
    { id: 'sub', header: 'SUB', meta: { sortKey: 'subName' }, cell: ({ row: { original: m } }) => m.subName ?? '—' },
    { id: 'baseline', header: 'BASELINE', meta: { sortKey: 'planBaseline' }, cell: ({ row: { original: m } }) => fmtDate(m.planBaseline) },
    { id: 'forecast', header: 'FORECAST', meta: { sortKey: 'forecast' }, cell: ({ row: { original: m } }) => fmtDate(m.forecast) },
    { id: 'actual', header: 'ACTUAL', meta: { sortKey: 'actual' }, cell: ({ row: { original: m } }) => fmtDate(m.actual) },
    { id: 'variance', header: 'VARIANCE', meta: { sortKey: 'variance' }, cell: ({ row: { original: m } }) => <span className={m.variance && m.variance > 0 ? 'warning' : ''}>{slip(m.variance)}</span> },
    { id: 'status', header: 'STATUS', cell: ({ row: { original: m } }) => <Badge tone={TONE[m.status]}>{m.status}</Badge> },
  ], []);

  const s = summary.data;
  return (
    <>
      <PageHead title="Milestones" desc={`Key contract dates from the project workbook · status is derived against the cut-off${s ? ` (${fmtDate(s.cutoff)})` : ''}.`}
        actions={<Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query()}`, 'milestones.csv').catch(e => toast(e.message))}>Export CSV</Btn>} />
      <div className="stats">
        <Stat label="Milestones" value={s?.total ?? '—'} foot={`Across ${s ? Object.keys(s.bySub).length : '—'} subcontract areas`} icon="flag" />
        <Stat label="Achieved" value={s?.done ?? '—'} foot="Actual date recorded" icon="check" />
        <Stat label="Overdue" value={s?.overdue ?? '—'} foot={<span className={s?.overdue ? 'negative' : ''}>Forecast before the cut-off</span>} icon="risk" />
        <Stat label="Due in 30 days" value={s?.dueSoon ?? '—'} foot="Not yet achieved" icon="clock" />
      </div>
      {s && s.next.length > 0 && (
        <div className="panel" style={{ marginBottom: 22 }}>
          <div className="panel-head"><div><h2>Next up</h2><p>The five earliest milestones not yet achieved</p></div></div>
          {s.next.map(m => (
            <div className="list-card" key={m.id}>
              <Icon name="flag" />
              <div className="grow"><p>{m.description}</p><small>{m.id} · {m.subName ?? '—'} · {fmtDate(m.forecast ?? m.planBaseline)}</small></div>
              <Badge tone={TONE[m.status]}>{m.status}</Badge>
            </div>
          ))}
        </div>
      )}
      <div className="panel">
        <div className="panel-head"><div><h2>Milestone register</h2><p>Reference data · read-only</p></div><span className="tiny muted">{page.data?.total ?? '…'} milestones</span></div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search id, key date or comment…" label="Search milestones" disciplineLabel="subcontract areas" />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort} empty="No milestones match." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
    </>
  );
}
