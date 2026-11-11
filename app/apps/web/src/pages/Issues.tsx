import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, errorText, request, type Insights, type Issue, type Page } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { Toolbar, useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Pager } from '../ui';
import { IssueDrawer, ISSUE_PRIORITIES } from './IssueDrawer';

const PAGE_SIZE = 50;
const PRIORITY_TONE: Record<string, Tone> = { Critical: 'red', High: 'red', Medium: 'amber', Low: 'green' };
const STATUS_TONE: Record<string, Tone> = { Completed: 'green', Pending: 'amber', 'In progress': 'indigo', 'Not started': 'indigo' };

interface IssuePage extends Page<Issue> { facets: Page<Issue>['facets'] & { priorities: string[]; pics: string[] } }

/** Governance → Management → Issues: monitor issues, their people in charge, sub-tasks and history, with due-date reminders. */
export default function Issues() {
  const { project, me } = useApp();
  const access = useAccess();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useListState();
  const filter = usePick(list, { priority: '', pic: '', within: '' });
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const base = `/projects/${project.id}/issues`;

  const insights = useQuery({ queryKey: ['insights', 'issues', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const extra = { priority: filter.extra.priority, pic: filter.extra.pic, within: filter.extra.within };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['issues', project.id, query], queryFn: () => request<IssuePage>(`${base}${query}`), placeholderData: keepPreviousData });
  const facets = page.data?.facets;
  const suggestions = useMemo(() => [...new Set([...(facets?.pics ?? []), ...(me?.email ? [String(me.email).toLowerCase()] : [])])].sort(), [facets, me]);

  const remindAll = useMutation({
    mutationFn: () => request<{ emails: number; items: number; issues: number }>(`${base}/remind-due`, { method: 'POST' }),
    onSuccess: r => { qc.invalidateQueries({ queryKey: ['issue'] }); toast(r.emails ? `Reminders sent to ${r.emails} ${r.emails === 1 ? 'person' : 'people'} for ${r.items} item${r.items === 1 ? '' : 's'}.` : 'Nothing is due or overdue for anyone with an email, or everyone was already reminded today.'); },
    onError: (e: Error) => toast(errorText(e)),
  });

  const columns = useMemo<ColumnDef<Issue>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: i } }) => <span className="mono">{i.id}</span> },
    {
      id: 'title', header: 'ISSUE', meta: { sortKey: 'title' },
      cell: ({ row: { original: i } }) => (
        <button className="link-button" onClick={() => setOpen(i.id)}>
          <strong style={{ whiteSpace: 'normal', display: 'block', maxWidth: 420 }}>{i.title}</strong>
          <small className="muted">{i.discipline ?? 'No team'}{i.nextAction ? ` · ${i.nextAction.slice(0, 70)}${i.nextAction.length > 70 ? '…' : ''}` : ''}</small>
        </button>
      ),
    },
    { id: 'priority', header: 'PRIORITY', meta: { sortKey: 'priorityRank' }, cell: ({ row: { original: i } }) => <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge> },
    {
      id: 'pic', header: 'PERSONS IN CHARGE',
      cell: ({ row: { original: i } }) => (i.pics.length
        ? <span className="tiny" title={i.pics.join(', ')}>{i.pics[0]}{i.pics.length > 1 && <span className="muted"> +{i.pics.length - 1}</span>}</span>
        : <span className="tiny warning">Nobody assigned</span>),
    },
    { id: 'due', header: 'DUE', meta: { sortKey: 'dueDate' }, cell: ({ row: { original: i } }) => <span className={i.overdue ? 'negative' : ''}>{i.dueDate ? fmtDate(i.dueDate) : '—'}{i.overdue ? ' · overdue' : ''}</span> },
    { id: 'subtasks', header: 'SUB-TASKS', cell: ({ row: { original: i } }) => (i.subtasksTotal ? <span className="tiny">{i.subtasksDone}/{i.subtasksTotal} done</span> : <span className="tiny muted">—</span>) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: i } }) => <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge> },
  ], []);

  return (
    <>
      <PageHead title="Issue management" desc="Monitor issues with their persons in charge, sub-tasks and history. People in charge are emailed when a due date is near or passed."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query(extra)}`, 'issues.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small" icon="clock" disabled={remindAll.isPending} onClick={() => remindAll.mutate()}>{remindAll.isPending ? 'Sending…' : 'Send due reminders'}</Btn>}
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpen('new')}>New issue</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} />
      <div className="panel">
        <div className="panel-head"><div><h2>Issue register</h2><p>Select an issue to see its sub-tasks and history</p></div><span className="tiny muted">{page.data?.total ?? '…'} issues</span></div>
        <Toolbar list={list} facets={facets} placeholder="Search title, description, team, person or next action…" label="Search issues" disciplineLabel="teams" />
        <div className="toolbar" style={{ paddingTop: 0 }}>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by priority" value={filter.extra.priority} onChange={e => { filter.setExtra(s => ({ ...s, priority: e.target.value })); list.set({}); }}>
              <option value="">All priorities</option>{ISSUE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select className="filter" aria-label="Filter by person in charge" value={filter.extra.pic} onChange={e => { filter.setExtra(s => ({ ...s, pic: e.target.value })); list.set({}); }}>
              <option value="">All persons in charge</option><option value="none">Nobody assigned</option>{(facets?.pics ?? []).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <FilterChips chips={filter.chips} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort} empty="No issue matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {open && <IssueDrawer base={base} id={open === 'new' ? null : open} canWrite={access.canWrite} canManage={access.canManage} suggestions={suggestions} onClose={() => setOpen(null)} />}
    </>
  );
}
