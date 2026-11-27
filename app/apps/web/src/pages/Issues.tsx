import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadCsv, errorText, request, type Insights, type Issue, type IssueOptions, type Page } from '../api';
import { DataTable } from '../DataTable';
import { AiTools } from '../AiTools';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { SortBy, useListState, usePrefetchNext } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Btn, ErrorBox, PageHead, Pager } from '../ui';
import { initialsOf } from './people';
import { IssueDrawer, ISSUE_PRIORITIES, ISSUE_STATUSES } from './IssueDrawer';
import { useDeepLink } from '../deepLink';
import { MultiFilter } from './governance';

const PAGE_SIZE = 50;
const PRIORITY_ICON: Record<string, string> = { Critical: 'urgency-urgent', High: 'urgency-high', Medium: 'urgency-normal', Low: 'urgency-low' };
import { StateTag, type StateTone } from '../ui';
const PRIORITY_TONE: Record<string, StateTone> = { Critical: 'crit', High: 'warn', Medium: 'info', Low: 'neutral' };
const STATUS_TONE: Record<string, StateTone> = { 'Not started': 'neutral', Pending: 'info', 'In progress': 'warn', Completed: 'ok' };
const STATUS_ICON: Record<string, string> = { 'Not started': 'status-backlog', Pending: 'status-planned', 'In progress': 'status-ongoing', Completed: 'status-completed' };
const WINDOWS: [string, string][] = [['overdue', 'Overdue'], ['30', 'Due within 30 days'], ['45', 'Due within 45 days'], ['60', 'Due within 60 days'], ['none', 'No due date']];

const SORTS: [string, string][] = [['dueDate', 'Due date'], ['packageCode', 'Package'], ['subcontract', 'Subcontract'], ['startDate', 'Start date'], ['updatedAt', 'Last updated'], ['priorityRank', 'Priority'], ['discipline', 'Discipline'], ['status', 'Status'], ['title', 'Title'], ['id', 'Issue no.']];

interface IssuePage extends Page<Issue> { facets: Page<Issue>['facets'] & { priorities: string[]; pics: string[]; picPeople?: { email: string; name: string }[]; packages?: string[]; subcontracts?: string[] } }


/** Governance → Management → Issues: monitor issues, their people in charge, sub-tasks and history, with due-date reminders. */
export default function Issues() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useListState();
  const [params, setParams] = useSearchParams();
  const pkg = params.get('package') ?? '';
  const filter = usePick(list, { priority: '', pic: '', within: '', subcontract: '' });
  const [openOnly, setOpenOnly] = useState(true);
  const [open, setOpen] = useDeepLink();
  const base = `/projects/${project.id}/issues`;

  const insights = useQuery({ queryKey: ['insights', 'issues', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const options = useQuery({ queryKey: ['issue-options', project.id], staleTime: 60_000, queryFn: () => request<IssueOptions>(`${base}/options`) });
  const extra = { priority: filter.extra.priority, pic: filter.extra.pic, within: filter.extra.within, subcontract: filter.extra.subcontract, packageCode: pkg, active: openOnly && !list.state.status ? 'true' : undefined };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['issues', project.id, query], queryFn: () => request<IssuePage>(`${base}${query}`), placeholderData: keepPreviousData });
  usePrefetchNext(list.state.page, page.data?.total, PAGE_SIZE, query, q => ['issues', project.id, q], q => request<IssuePage>(`${base}${q}`));
  const facets = page.data?.facets;
  const setExtra = (k: 'priority' | 'pic' | 'within' | 'subcontract', v: string) => { filter.setExtra(s => ({ ...s, [k]: v })); list.set({}); };
  /** A package in the summary opens the register for that package, like Risks & Concerns; anything else filters as usual. */
  const pick = (f: Record<string, string>) => {
    const [k, v] = Object.entries(f)[0];
    if (k === 'packageCode') { setParams(pkg === v ? {} : { package: v }); list.set({}); return; }
    filter.pick(f);
  };
  const isOn = (f: Record<string, string>) => ('packageCode' in f ? pkg === f.packageCode : filter.isOn(f));
  const clearAll = () => { filter.reset(); setOpenOnly(true); setParams({}); };
  const pkgLabel = (code: string) => options.data?.packages.find(p => p.code === code)?.label;
  const subLabel = (code: string) => options.data?.subcontracts.find(p => p.code === code)?.label;

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
        <button className="link-button register-title" onClick={() => setOpen(i.id)}>
          <strong title={i.title}>{i.title}</strong>
          <small className="muted">{[i.packageCode ?? null, i.subcontract ?? null, i.discipline].filter(Boolean).join(' · ') || 'No package or subcontract'}</small>
        </button>
      ),
    },
    { id: 'priority', header: 'PRIORITY', meta: { sortKey: 'priorityRank' }, cell: ({ row: { original: i } }) => <StateTag icon={PRIORITY_ICON[i.priority]} label={i.priority} tone={PRIORITY_TONE[i.priority] ?? 'neutral'} title={`${i.priority} priority`} /> },
    {
      id: 'pic', header: 'PIC',
      cell: ({ row: { original: i } }) => (i.pics.length
        ? <span className="avatars" title={(i.people ?? []).map(p => p.name).join('\n') || i.pics.join('\n')}>{(i.people ?? i.pics.map(e => ({ email: e, name: e }))).slice(0, 3).map(p => <span key={p.email} className="avatar" title={p.name}>{initialsOf(p.name)}</span>)}{i.pics.length > 3 && <span className="avatar more">+{i.pics.length - 3}</span>}</span>
        : <span className="tiny warning" title="Nobody assigned"><Icon name="people" /></span>),
    },
    { id: 'due', header: 'DUE', meta: { sortKey: 'dueDate' }, cell: ({ row: { original: i } }) => <span className={i.overdue ? 'negative' : ''}>{i.dueDate ? fmtDate(i.dueDate) : '—'}{i.overdue ? ' · overdue' : ''}</span> },
    { id: 'subtasks', header: 'SUB-TASKS', cell: ({ row: { original: i } }) => (i.subtasksTotal ? <span className="issue-sub" title={`${i.subtasksDone} of ${i.subtasksTotal} sub-tasks done`}><Icon name="status-completed" />{i.subtasksDone}/{i.subtasksTotal}</span> : <span className="tiny muted">—</span>) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: i } }) => <StateTag icon={STATUS_ICON[i.status]} label={i.status} tone={STATUS_TONE[i.status] ?? 'neutral'} /> },
    { id: 'open', header: '', cell: ({ row: { original: i } }) => <button className="icon-btn" aria-label={`Open ${i.id}`} onClick={() => setOpen(i.id)}><Icon name="arrow" /></button> },
  ], []);

  return (
    <>
      <PageHead title="Issue management" desc="Issues already hurting the work, linked to a procurement package or a service subcontract, with people in charge, sub-tasks, history and due-date reminders."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query(extra)}`, 'issues.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          <AiTools kind="issues" />
          {access.canWrite && <Btn kind="small" iconOnly icon="bell" aria-label="Send due reminders now" title="Send due reminders now" disabled={remindAll.isPending} onClick={() => remindAll.mutate()}>Send due reminders</Btn>}
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpen('new')}>New issue</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} pair twoCol />
      <div className="panel">
        <div className="panel-head"><div><h2>Register</h2><p>Select a row to review or update it</p></div><span className="tiny muted" aria-live="polite">{page.data?.total ?? '…'} issues</span></div>
        {pkg && <div className="banner">Showing issues for <strong>{pkg === 'none' ? 'no package' : pkg}</strong>{pkgLabel(pkg) ? ` · ${pkgLabel(pkg)}` : ''}. <button className="btn text" onClick={() => setParams({})}>Show all</button></div>}
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search title, package, subcontract, team, person…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search issues" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by status" value={list.state.status} onChange={e => list.set({ status: e.target.value })}><option value="">All statuses</option>{ISSUE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            <select className="filter" aria-label="Filter by priority" value={filter.extra.priority} onChange={e => setExtra('priority', e.target.value)}><option value="">All priorities</option>{ISSUE_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
            <select className="filter" aria-label="Filter by procurement package" value={pkg} onChange={e => { setParams(e.target.value ? { package: e.target.value } : {}); list.set({}); }}>
              <option value="">All packages</option><option value="none">No package</option>
              {(facets?.packages ?? []).map(c => <option key={c} value={c}>{c}{pkgLabel(c) ? ` · ${pkgLabel(c)}` : ''}</option>)}
            </select>
            <select className="filter" aria-label="Filter by service subcontract" value={filter.extra.subcontract} onChange={e => setExtra('subcontract', e.target.value)}>
              <option value="">All subcontracts</option><option value="none">No subcontract</option>
              {(facets?.subcontracts ?? []).map(c => <option key={c} value={c}>{c}{subLabel(c) && subLabel(c) !== c ? ` · ${subLabel(c)}` : ''}</option>)}
            </select>
            <MultiFilter icon="layers" label="Filter by team (tick one or more)" allLabel="All teams" options={facets?.disciplines ?? []} value={list.state.discipline} onChange={v => list.set({ discipline: v })} />
            <select className="filter" aria-label="Filter by person in charge" value={filter.extra.pic} onChange={e => setExtra('pic', e.target.value)}><option value="">Everyone</option><option value="none">Nobody assigned</option>{(facets?.picPeople ?? (facets?.pics ?? []).map(e => ({ email: e, name: e }))).map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select>
            <select className="filter" aria-label="Filter by due date" value={filter.extra.within} onChange={e => setExtra('within', e.target.value)}><option value="">Any due date</option>{WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <label className="check-inline tiny"><input type="checkbox" checked={openOnly && !list.state.status} disabled={!!list.state.status} onChange={e => { setOpenOnly(e.target.checked); list.set({}); }} />Open only</label>
            <SortBy options={SORTS} sort={list.state.sort} order={list.state.order} fallback="dueDate" onChange={list.setSort} />
            <Btn kind="small" onClick={clearAll}>Clear</Btn>
          </div>
        </div>
        <FilterChips chips={filter.chips.filter(([k]) => k === 'within' || k === 'pic')} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} loading={page.isPending} state={list.state} onSort={list.toggleSort} empty="No issue matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {open && <IssueDrawer base={base} id={open === 'new' ? null : open} canWrite={access.canWrite} canManage={access.canManage} options={options.data} defaultPackage={pkg && pkg !== 'none' ? pkg : null} onClose={() => setOpen(null)} />}
    </>
  );
}
