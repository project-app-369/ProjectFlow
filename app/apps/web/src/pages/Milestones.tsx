import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { apiMode, downloadCsv, request, type Insights, type Milestone, type MilestoneStatus, type Page } from '../api';
import { RecordDrawer, suggest, type FieldDef } from '../crud';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { Toolbar, useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, PageHead, Pager } from '../ui';
import { useDeepLink } from '../deepLink';

const PAGE_SIZE = 50;
const TONE: Record<MilestoneStatus, Tone> = { Done: 'green', Overdue: 'red', 'Due soon': 'amber', Planned: 'indigo' };
const STATUS_ORDER: MilestoneStatus[] = ['Done', 'Overdue', 'Due soon', 'Planned'];
type Group = 'none' | 'facility' | 'sub';
const GROUPS: { key: Group; label: string }[] = [{ key: 'none', label: 'No grouping' }, { key: 'facility', label: 'By facility' }, { key: 'sub', label: 'By subcontractor' }];

const slip = (days: number | null) => (days == null ? '—' : days === 0 ? 'On plan' : `${days > 0 ? '+' : ''}${days} d`);

const milestoneFields = (sug: { facility: string[]; sub: string[] }, creating: boolean): FieldDef[] => [
  ...(creating ? [{ key: 'id', label: 'Milestone ID', max: 40, hint: 'Optional. Leave blank to number it automatically (KM-001).' } as FieldDef] : []),
  { key: 'description', label: 'Key date', required: true, max: 200, full: true },
  { key: 'facility', label: 'Facility', suggestions: sug.facility, max: 60, hint: 'Groups the milestone, e.g. CGF Topsides' },
  { key: 'subName', label: 'Subcontractor / area', suggestions: sug.sub, max: 40 },
  { key: 'planBaseline', label: 'Baseline date', kind: 'date' },
  { key: 'planSub', label: 'Subcontractor plan date', kind: 'date' },
  { key: 'forecast', label: 'Forecast date', kind: 'date' },
  { key: 'actual', label: 'Actual date', kind: 'date', hint: 'With an actual date the milestone counts as achieved' },
  { key: 'comment', label: 'Comment', kind: 'textarea', max: 500 },
];

/** Key milestones: loaded from the project's Key Milestones workbook, then kept up to date here and on the sheet. */
export default function Milestones() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const canEdit = apiMode === 'sheets' && access.canWrite;
  const list = useListState();
  const [group, setGroup] = useState<Group>('none');
  const [editingId, setEditingId] = useDeepLink();
  const setEditing = (v: Milestone | 'new' | null) => setEditingId(v === null ? null : v === 'new' ? 'new' : v.id);
  const filter = usePick(list, { within: '', facility: '' });
  const base = `/projects/${project.id}/milestones`;

  const insights = useQuery({ queryKey: ['insights', 'milestones', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const grouped = group !== 'none';
  const extra = { within: filter.extra.within, facility: filter.extra.facility };
  const query = list.query({ page: list.state.page, pageSize: grouped ? 200 : PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['milestones', project.id, query], queryFn: () => request<Page<Milestone>>(`${base}${query}`), placeholderData: keepPreviousData });
  const editing: Milestone | 'new' | null = editingId === 'new' ? 'new' : ((page.data?.items ?? []).find(r => r.id === editingId) ?? null);
  const items = page.data?.items ?? [];

  /** The sub filter in the summary is the register's "subcontract area" filter. */
  const pick = (f: Record<string, string>) => filter.pick('sub' in f ? { discipline: f.sub } : f);
  const isOn = (f: Record<string, string>) => filter.isOn('sub' in f ? { discipline: f.sub } : f);

  const columns = useMemo<ColumnDef<Milestone>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: m } }) => <span className="mono">{m.id}</span> },
    {
      id: 'description', header: 'KEY DATE', meta: { sortKey: 'description' },
      cell: ({ row: { original: m } }) => (
        <button className="link-button" onClick={() => setEditing(m)}>
          <strong>{m.description}</strong>
          {m.comment && <small className="muted" style={{ display: 'block', whiteSpace: 'normal', maxWidth: 360 }}>{m.comment}</small>}
        </button>
      ),
    },
    { id: 'facility', header: 'FACILITY', cell: ({ row: { original: m } }) => <span className="tiny">{m.facility ?? '—'}</span> },
    { id: 'sub', header: 'SUB', meta: { sortKey: 'subName' }, cell: ({ row: { original: m } }) => m.subName ?? '—' },
    { id: 'baseline', header: 'BASELINE', meta: { sortKey: 'planBaseline' }, cell: ({ row: { original: m } }) => fmtDate(m.planBaseline) },
    { id: 'forecast', header: 'FORECAST', meta: { sortKey: 'forecast' }, cell: ({ row: { original: m } }) => fmtDate(m.forecast) },
    { id: 'actual', header: 'ACTUAL', meta: { sortKey: 'actual' }, cell: ({ row: { original: m } }) => fmtDate(m.actual) },
    { id: 'variance', header: 'VARIANCE', meta: { sortKey: 'variance' }, cell: ({ row: { original: m } }) => <span className={m.variance && m.variance > 0 ? 'warning' : ''}>{slip(m.variance)}</span> },
    { id: 'status', header: 'STATUS', cell: ({ row: { original: m } }) => <Badge tone={TONE[m.status]}>{m.status}</Badge> },
  ], []);

  /** Groups keep the server's order; the groups themselves are ordered by name, with "Unassigned" last. */
  const groups = useMemo(() => {
    if (!grouped) return [];
    const by = new Map<string, Milestone[]>();
    for (const m of items) { const k = (group === 'facility' ? m.facility : m.subName) ?? 'Unassigned'; by.set(k, [...(by.get(k) ?? []), m]); }
    return [...by.entries()].sort(([a], [b]) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)));
  }, [items, group, grouped]);

  const drawerSuggestions = { facility: page.data?.facets.facilities ?? suggest(items as never, 'facility'), sub: page.data?.facets.disciplines ?? [] };
  const csvQuery = list.query(extra);

  return (
    <>
      <PageHead title="Milestones" desc={`Key contract dates · status is derived against the cut-off (${fmtDate(project.cutoff)}). Edits are written to the sheet.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${csvQuery}`, 'milestones.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {canEdit && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New milestone</Btn>}
        </>} />
      <InsightsView data={insights.data} error={insights.error} onFilter={pick} active={isOn} />
      <div className="panel">
        <div className="panel-head">
          <div><h2>Milestone register</h2><p>{canEdit ? 'Select a milestone to update its dates, or add one' : 'Select a milestone to see its dates'}</p></div>
          <div className="actions">
            <div className="seg" role="group" aria-label="Group milestones">
              {GROUPS.map(g => <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>{g.label}</button>)}
            </div>
            <span className="tiny muted">{page.data?.total ?? '…'} milestones</span>
          </div>
        </div>
        <Toolbar list={list} facets={page.data?.facets} placeholder="Search id, key date, facility or comment…" label="Search milestones" disciplineLabel="subcontract areas" defaultSort="id" sorts={[['id', 'ID'], ['planBaseline', 'Baseline date'], ['forecast', 'Forecast date'], ['actual', 'Actual date'], ['variance', 'Variance'], ['subName', 'Sub-contractor'], ['description', 'Key date']]} />
        <FilterChips chips={filter.chips} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : grouped ? (
          groups.length ? groups.map(([name, rows]) => {
            const count = (s: MilestoneStatus) => rows.filter(r => r.status === s).length;
            const done = count('Done');
            return (
              <details className="ms-group" key={name} open>
                <summary>
                  <strong>{name}</strong>
                  <span className="tiny muted">{rows.length} milestone{rows.length === 1 ? '' : 's'} · {Math.round((done / rows.length) * 100)}% achieved</span>
                  <span className="ms-badges">{STATUS_ORDER.filter(s => count(s)).map(s => <Badge key={s} tone={TONE[s]}>{count(s)} {s}</Badge>)}</span>
                </summary>
                <DataTable columns={columns} data={rows} state={list.state} onSort={list.toggleSort} empty="No milestones match." />
              </details>
            );
          }) : <div className="empty">No milestones match.</div>
        ) : (
          <>
            <DataTable columns={columns} data={items} state={list.state} onSort={list.toggleSort} empty="No milestones match." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {editing && (
        <RecordDrawer title={editing === 'new' ? 'New milestone' : `${editing.id} · Milestone`} size="md" base={base} id={editing === 'new' ? undefined : editing.id}
          record={editing === 'new' ? null : editing as never} fields={milestoneFields(drawerSuggestions, editing === 'new')} canDelete={access.canManage && apiMode === 'sheets'}
          deleteNote="The milestone leaves the register and the sheet. A milestone that a risk or interface is linked to cannot be deleted until it is unlinked."
          invalidate={['milestones', 'milestone-summary', 'insights', 'dashboard', 'risks', 'interfaces']} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
