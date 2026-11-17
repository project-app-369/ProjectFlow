import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, type ReactNode } from 'react';
import { downloadCsv, errorText, request, type Insights, type Issue, type Page } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { SortBy, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Btn, ErrorBox, PageHead, Pager } from '../ui';
import { IssueDrawer, ISSUE_PRIORITIES, ISSUE_STATUSES } from './IssueDrawer';
import { useDeepLink } from '../deepLink';
import { disciplineTitle } from '../disciplines';
import { MultiFilter } from './governance';

const PAGE_SIZE = 50;
const PRIORITY_ICON: Record<string, string> = { Critical: 'urgency-urgent', High: 'urgency-high', Medium: 'urgency-normal', Low: 'urgency-low' };
const STATUS_ICON: Record<string, string> = { 'Not started': 'status-backlog', Pending: 'status-planned', 'In progress': 'status-ongoing', Completed: 'status-completed' };
const WINDOWS: [string, string][] = [['overdue', 'Overdue'], ['30', 'Due within 30 days'], ['45', 'Due within 45 days'], ['60', 'Due within 60 days'], ['none', 'No due date']];

const SORTS: [string, string][] = [['dueDate', 'Due date'], ['startDate', 'Start date'], ['updatedAt', 'Last updated'], ['priorityRank', 'Priority'], ['discipline', 'Discipline'], ['status', 'Status'], ['title', 'Title'], ['id', 'Issue no.']];

interface IssuePage extends Page<Issue> { facets: Page<Issue>['facets'] & { priorities: string[]; pics: string[] } }

/** A filter that shows only an icon and its current choice; the label is the tooltip and the accessible name. */
function IconFilter({ icon, label, value, onChange, children }: { icon: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="task-filter" title={label}>
      <Icon name={icon} />
      <select className="filter" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

const initials = (email: string) => email.split('@')[0].replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?';

/** Governance → Management → Issues: monitor issues, their people in charge, sub-tasks and history, with due-date reminders. */
export default function Issues() {
  const { project, me } = useApp();
  const access = useAccess();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useListState();
  const filter = usePick(list, { priority: '', pic: '', within: '' });
  const [open, setOpen] = useDeepLink();
  const base = `/projects/${project.id}/issues`;

  const insights = useQuery({ queryKey: ['insights', 'issues', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const extra = { priority: filter.extra.priority, pic: filter.extra.pic, within: filter.extra.within };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['issues', project.id, query], queryFn: () => request<IssuePage>(`${base}${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['issues', project.id, q], q => request<IssuePage>(`${base}${q}`));
  const facets = page.data?.facets;
  const suggestions = useMemo(() => [...new Set([...(facets?.pics ?? []), ...(me?.email ? [String(me.email).toLowerCase()] : [])])].sort(), [facets, me]);
  const setExtra = (k: 'priority' | 'pic' | 'within', v: string) => { filter.setExtra(s => ({ ...s, [k]: v })); list.set({}); };

  const remindAll = useMutation({
    mutationFn: () => request<{ emails: number; items: number; issues: number }>(`${base}/remind-due`, { method: 'POST' }),
    onSuccess: r => { qc.invalidateQueries({ queryKey: ['issue'] }); toast(r.emails ? `Reminders sent to ${r.emails} ${r.emails === 1 ? 'person' : 'people'} for ${r.items} item${r.items === 1 ? '' : 's'}.` : 'Nothing is due or overdue for anyone with an email, or everyone was already reminded today.'); },
    onError: (e: Error) => toast(errorText(e)),
  });

  const columns = useMemo<ColumnDef<Issue>[]>(() => [
    {
      id: 'title', header: 'ISSUE', meta: { sortKey: 'title' },
      cell: ({ row: { original: i } }) => (
        <button className="link-button" onClick={() => setOpen(i.id)}>
          <strong style={{ display: 'block', maxWidth: 560, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.title}>{i.title}</strong>
          <small className="muted"><span className="mono">{i.id}</span></small>
        </button>
      ),
    },
    { id: 'discipline', header: 'DISCIPLINE', meta: { sortKey: 'discipline' }, cell: ({ row: { original: i } }) => (i.discipline ? <span className="discipline-cell" title={disciplineTitle(i.discipline)}>{i.discipline}</span> : <span className="muted">—</span>) },
    { id: 'priority', header: 'PRI', meta: { sortKey: 'priorityRank' }, cell: ({ row: { original: i } }) => <span className="issue-icon" title={`${i.priority} priority`}><Icon name={PRIORITY_ICON[i.priority]} /><span className="sr-only">{i.priority}</span></span> },
    {
      id: 'pic', header: 'PIC',
      cell: ({ row: { original: i } }) => (i.pics.length
        ? <span className="avatars" title={i.pics.join('\n')}>{i.pics.slice(0, 3).map(e => <span key={e} className="avatar">{initials(e)}</span>)}{i.pics.length > 3 && <span className="avatar more">+{i.pics.length - 3}</span>}</span>
        : <span className="tiny warning" title="Nobody assigned"><Icon name="people" /></span>),
    },
    { id: 'due', header: 'DUE', meta: { sortKey: 'dueDate' }, cell: ({ row: { original: i } }) => <span className={`task-meta-item ${i.overdue ? 'negative' : ''}`} title={i.overdue ? 'Overdue' : undefined}>{i.dueDate ? <><Icon name="calendar" />{fmtDate(i.dueDate)}</> : <span className="muted">—</span>}</span> },
    { id: 'subtasks', header: '', cell: ({ row: { original: i } }) => (i.subtasksTotal ? <span className="issue-sub" title={`${i.subtasksDone} of ${i.subtasksTotal} sub-tasks done`}><Icon name="status-completed" />{i.subtasksDone}/{i.subtasksTotal}</span> : null) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: i } }) => <span className="issue-icon" title={i.status}><Icon name={STATUS_ICON[i.status]} /><span className="sr-only">{i.status}</span></span> },
  ], []);

  return (
    <>
      <PageHead title="Issue management" desc="Persons in charge, sub-tasks, history and due-date reminders."
        actions={<>
          <Btn kind="small" onClick={() => downloadCsv(`${base}.csv${list.query(extra)}`, 'issues.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small" iconOnly icon="bell" aria-label="Send due reminders now" title="Send due reminders now" disabled={remindAll.isPending} onClick={() => remindAll.mutate()}>Send due reminders</Btn>}
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpen('new')}>New issue</Btn>}
        </>} />
      <InsightsView compact data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} />
      <div className="panel">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input placeholder="Search title, description, team, person…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search issues" />
          </label>
          <div className="filter-group">
            <IconFilter icon={STATUS_ICON[list.state.status] ?? 'status-ongoing'} label="Filter by status" value={list.state.status} onChange={v => list.set({ status: v })}>
              <option value="">All statuses</option>{ISSUE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </IconFilter>
            <IconFilter icon={PRIORITY_ICON[filter.extra.priority] ?? 'urgency-normal'} label="Filter by priority" value={filter.extra.priority} onChange={v => setExtra('priority', v)}>
              <option value="">All priorities</option>{ISSUE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </IconFilter>
            <MultiFilter icon="layers" label="Filter by discipline (tick one or more)" allLabel="All disciplines" options={facets?.disciplines ?? []} value={list.state.discipline} onChange={v => list.set({ discipline: v })} />
            <IconFilter icon="people" label="Filter by person in charge" value={filter.extra.pic} onChange={v => setExtra('pic', v)}>
              <option value="">Everyone</option><option value="none">Nobody assigned</option>{(facets?.pics ?? []).map(p => <option key={p}>{p}</option>)}
            </IconFilter>
            <IconFilter icon="calendar" label="Filter by due date" value={filter.extra.within} onChange={v => setExtra('within', v)}>
              <option value="">Any due date</option>{WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </IconFilter>
            <SortBy options={SORTS} sort={list.state.sort} order={list.state.order} fallback="dueDate" onChange={list.setSort} />
            <Btn kind="small" onClick={filter.reset}>Clear</Btn>
            <span className="tiny muted" aria-live="polite">{page.data?.total ?? '…'} issues</span>
          </div>
        </div>
        <FilterChips chips={filter.chips.filter(([k]) => k !== 'priority' && k !== 'pic' && k !== 'within')} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort} empty="No issue matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {open && <IssueDrawer base={base} id={open === 'new' ? null : open} canWrite={access.canWrite} canManage={access.canManage} suggestions={suggestions} onClose={() => setOpen(null)} />}
    </>
  );
}
