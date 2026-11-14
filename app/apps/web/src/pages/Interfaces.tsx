import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  downloadCsv, errorText, INTERFACE_TYPES, POINT_STATUSES, qs, request,
  type Insights, type InterfaceMatrix, type InterfaceParty, type InterfacePoint, type InterfaceRecord, type InterfaceStatus, type InterfaceSummary,
  type Milestone, type Page, type PointStatus, type RasciMatrices, type ResponsibilityMatrix,
} from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { Icon } from '../icons';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, Confirm, ErrorBox, Field, Modal, PageHead, Pager, Stat, useDebounced } from '../ui';
import { Detail, IconFilter, People } from './governance';

const PAGE_SIZE = 50;
const STATUS_TONE: Record<InterfaceStatus, Tone> = {
  Identified: 'indigo', Assigned: 'indigo', 'Information requested': 'amber', Responded: 'amber', 'Under review': 'amber', Agreed: 'green', Closed: 'green',
};
const POINT_TONE: Record<PointStatus, Tone> = { Open: 'amber', Responded: 'indigo', Resolved: 'green', Closed: 'green' };
const POINT_ICON: Record<PointStatus, string> = { Open: 'status-planned', Responded: 'status-ongoing', Resolved: 'tick', Closed: 'status-completed' };
const POINT_HELP: Record<PointStatus, string> = {
  Open: 'Raised and waiting for an answer from the target party',
  Responded: 'Answered by the target party, waiting for the originator to accept',
  Resolved: 'Answer accepted; the resolved date is recorded',
  Closed: 'Closed out and no longer tracked',
};

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(['interfaces', 'interface-summary', 'interface-matrix', 'interface-points', 'interface-point', 'interface', 'insights', 'dashboard'].map(k => qc.invalidateQueries({ queryKey: [k] })));
}
const useParties = (projectId: string) => useQuery({ queryKey: ['interface-parties', projectId], queryFn: () => request<InterfaceParty[]>(`/projects/${projectId}/interfaces/parties`), staleTime: 300_000 });
const partyName = (parties: InterfaceParty[] | undefined, code: string | null) => (code ? parties?.find(p => p.code === code)?.name ?? code : '—');

/* ====================== interface points (the working register) ====================== */
interface PointPage extends Page<InterfacePoint> { facets: Page<InterfacePoint>['facets'] & { parties: string[]; owners: string[] } }

/** Interface → Points: every query between parties, who owes the next move, and how long it has waited. */
export function InterfacePointsPage() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const list = useListState();
  const filter = usePick(list, { target: params.get('target') ?? '', originator: params.get('originator') ?? '', owner: '', within: '', age: '', flag: '' });
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const parties = useParties(project.id);
  const base = `/projects/${project.id}/interface-points`;

  const insights = useQuery({ queryKey: ['insights', 'interface-points', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const { flag, ...rest } = filter.extra;
  const extra = { ...rest, overdue: flag === 'overdue' ? 'true' : undefined, open: flag === 'open' ? 'true' : undefined };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['interface-points', project.id, query], queryFn: () => request<PointPage>(`${base}${query}`), placeholderData: keepPreviousData });
  const facets = page.data?.facets;
  const setExtra = (k: keyof typeof filter.extra, v: string) => { filter.setExtra(s => ({ ...s, [k]: v })); list.set({}); };
  const reset = () => { filter.reset(); setParams({}); };

  const columns = useMemo<ColumnDef<InterfacePoint>[]>(() => [
    {
      id: 'title', header: 'POINT', meta: { sortKey: 'id' },
      cell: ({ row: { original: p } }) => (
        <button className="link-button" onClick={() => setOpen(p.id)}>
          <strong style={{ display: 'block', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description}>{p.title}</strong>
          <small className="muted"><span className="mono">{p.id}</span>{p.workPackage ? ` · ${p.workPackage}` : ''}{p.interfaceId ? ` · ${p.interfaceId}` : ''}</small>
        </button>
      ),
    },
    {
      id: 'parties', header: 'FROM → TO', meta: { sortKey: 'target' },
      cell: ({ row: { original: p } }) => <span className="tiny" title={`${partyName(parties.data, p.originator)} asks ${partyName(parties.data, p.target)}`}><span className="muted">{p.originator}</span> → <strong>{p.target}</strong></span>,
    },
    { id: 'owner', header: 'OWNER', cell: ({ row: { original: p } }) => <People names={p.owner ? [p.owner] : []} empty="No IP owner" /> },
    {
      id: 'target', header: 'TARGET', meta: { sortKey: 'targetDate' },
      cell: ({ row: { original: p } }) => p.settled
        ? <span className="task-meta-item positive" title={p.resolvedDate ? `Resolved ${fmtDate(p.resolvedDate)}` : 'Settled'}><Icon name="tick" />{p.resolvedDate ? fmtDate(p.resolvedDate) : 'Settled'}</span>
        : p.targetDate ? <span className={`task-meta-item ${p.overdue ? 'negative' : ''}`} title={p.overdue ? `${p.daysLate} days past the target date` : 'Target date'}><Icon name="calendar" />{fmtDate(p.targetDate)}</span>
        : <span className="tiny warning" title="No target date">No date</span>,
    },
    { id: 'age', header: 'AGE', meta: { sortKey: 'ageDays' }, cell: ({ row: { original: p } }) => (p.ageDays == null ? <span className="muted">—</span> : <span className="mono tiny" title={p.settled ? 'Days from query to resolution' : 'Days open since the query date'}>{p.ageDays} d</span>) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: p } }) => <span className="issue-icon" title={`${p.status}: ${POINT_HELP[p.status]}`}><Icon name={POINT_ICON[p.status]} /><span className="sr-only">{p.status}</span></span> },
  ], [parties.data]);

  const chips = filter.chips.filter(([k]) => !['owner', 'flag'].includes(k)).map(([k, v]) => [k, k === 'target' || k === 'originator' ? partyName(parties.data, v) : v] as [string, string]);
  return (
    <>
      <PageHead title="Interface points" desc="Each point is a query from one party to another. Status moves Open → Responded → Resolved → Closed; a response is needed to move it on."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query(extra)}`, 'interface-points.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpen('new')}>New point</Btn>}
        </>} />
      <InsightsView compact data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} />
      <div className="panel">
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, subject, description, action, resolution, reference…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search interface points" /></label>
          <div className="filter-group">
            <IconFilter icon={POINT_ICON[list.state.status as PointStatus] ?? 'status-ongoing'} label="Filter by status" value={list.state.status} onChange={v => list.set({ status: v })}>
              <option value="">All statuses</option>{POINT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </IconFilter>
            <IconFilter icon="layers" label="Filter by discipline" value={list.state.discipline} onChange={v => list.set({ discipline: v })}>
              <option value="">All disciplines</option>{(facets?.disciplines ?? []).map(d => <option key={d}>{d}</option>)}
            </IconFilter>
            <IconFilter icon="link" label="Filter by target party" value={filter.extra.target} onChange={v => setExtra('target', v)}>
              <option value="">Any target party</option>{(facets?.parties ?? []).map(p => <option key={p} value={p}>{partyName(parties.data, p)}</option>)}
            </IconFilter>
            <IconFilter icon="people" label="Filter by IP owner" value={filter.extra.owner} onChange={v => setExtra('owner', v)}>
              <option value="">Every owner</option>{(facets?.owners ?? []).map(o => <option key={o}>{o}</option>)}
            </IconFilter>
            <IconFilter icon="clock" label="Show points that need attention" value={filter.extra.flag} onChange={v => setExtra('flag', v)}>
              <option value="">Any</option><option value="open">Not settled</option><option value="overdue">Overdue</option>
            </IconFilter>
            <Btn kind="small" onClick={reset}>Clear</Btn>
            <span className="tiny muted" aria-live="polite">{page.data?.total ?? '…'} points</span>
          </div>
        </div>
        <FilterChips chips={chips} onClear={reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort} empty="No interface point matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {open && <PointDrawer id={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** One point from the right: what was asked, of whom, the answer, and the workflow buttons. */
function PointDrawer({ id, onClose, interfaceId }: { id: string | null; onClose: () => void; interfaceId?: string }) {
  const { project } = useApp();
  const detail = useQuery({ queryKey: ['interface-point', project.id, id], enabled: !!id, queryFn: () => request<InterfacePoint>(`/projects/${project.id}/interface-points/${id}`) });
  if (id && !detail.data) {
    return <Modal title={id} size="lg" onClose={onClose} actions={<Btn onClick={onClose}>Close</Btn>}><div className="dialog-body">{detail.error ? <p className="negative">{errorText(detail.error)}</p> : <p className="muted">Loading…</p>}</div></Modal>;
  }
  return <PointForm key={detail.data?.updatedAt ?? 'new'} point={id ? detail.data : undefined} interfaceId={interfaceId} onClose={onClose} />;
}

type PointDraft = Record<'title' | 'description' | 'owner' | 'workPackage' | 'discipline' | 'originator' | 'target' | 'action' | 'queryDate' | 'targetDate' | 'reference' | 'resolution' | 'resolvedDocument' | 'remarks' | 'interfaceId', string>;
const pointDraft = (p?: InterfacePoint, interfaceId?: string): PointDraft => ({
  title: p?.title ?? '', description: p?.description ?? '', owner: p?.owner ?? '', workPackage: p?.workPackage ?? '', discipline: p?.discipline ?? '',
  originator: p?.originator ?? '', target: p?.target ?? '', action: p?.action ?? '', queryDate: p?.queryDate ?? '', targetDate: p?.targetDate ?? '',
  reference: p?.reference ?? '', resolution: p?.resolution ?? '', resolvedDocument: p?.resolvedDocument ?? '', remarks: p?.remarks ?? '', interfaceId: p?.interfaceId ?? interfaceId ?? '',
});

function PointForm({ point, interfaceId, onClose }: { point?: InterfacePoint; interfaceId?: string; onClose: () => void }) {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const refresh = useRefresh();
  const parties = useParties(project.id);
  const base = `/projects/${project.id}/interface-points`;
  const [v, setV] = useState<PointDraft>(() => pointDraft(point, interfaceId));
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const up = (k: keyof PointDraft, val: string) => setV(s => ({ ...s, [k]: val }));
  const readOnly = !access.canWrite;
  const same = !!v.originator && v.originator.trim().toLowerCase() === v.target.trim().toLowerCase();
  const body = () => Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.trim() === '' ? null : val]));

  const save = useMutation({
    mutationFn: () => (point ? request<InterfacePoint>(`${base}/${point.id}`, { method: 'PATCH', body: JSON.stringify(body()) }) : request<InterfacePoint>(base, { method: 'POST', body: JSON.stringify(body()) })),
    onSuccess: r => { refresh(); toast(point ? 'Point saved.' : `Point ${r.id} raised.`); if (!point) onClose(); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const move = useMutation({
    mutationFn: (to: PointStatus) => request<InterfacePoint>(`${base}/${point!.id}/transition`, { method: 'POST', body: JSON.stringify({ to, resolution: v.resolution.trim() || undefined }) }),
    onSuccess: r => { refresh(); toast(`${r.id} is now ${r.status}.`); }, onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/${point!.id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Point deleted.'); onClose(); }, onError: (e: Error) => { setRemoving(false); setError(errorText(e)); },
  });
  const needsAnswer = (to: PointStatus) => (to === 'Responded' || to === 'Resolved') && !v.resolution.trim();

  return (
    <>
      <Modal title={point ? `${point.id} · Interface point` : 'New interface point'} size="lg" onClose={onClose}
        actions={<>
          {point && access.canManage && <Btn kind="text" onClick={() => setRemoving(true)}>Delete</Btn>}
          <Btn onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Btn>
          {!readOnly && <Btn kind="primary" disabled={save.isPending || !v.description.trim() || !v.originator.trim() || !v.target.trim() || same} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>}
        </>}>
        <div className="dialog-body">
          {point && (
            <div className="drawer-intro">
              <div className="eyebrow">{point.discipline ?? 'Unclassified'}{point.workPackage ? ` · ${point.workPackage}` : ''}</div>
              <h1>{point.title}</h1>
              <Badge tone={POINT_TONE[point.status]}>{point.status}</Badge> {point.overdue && <Badge tone="red">{point.daysLate} d late</Badge>}{' '}
              <span className="tiny muted">{partyName(parties.data, point.originator)} → {partyName(parties.data, point.target)}{point.ageDays != null ? ` · ${point.ageDays} days ${point.settled ? 'to resolve' : 'open'}` : ''}</span>
            </div>
          )}
          {point && access.canWrite && point.allowedNext.length > 0 && (
            <div style={{ margin: '0 0 16px' }}>
              <div className="tiny muted" style={{ marginBottom: 6 }}>{POINT_HELP[point.status]}. Move to</div>
              <div className="actions">
                {point.allowedNext.map(n => (
                  <Btn key={n} kind="small" disabled={move.isPending || needsAnswer(n)} title={needsAnswer(n) ? 'Write the response below first' : POINT_HELP[n]} onClick={() => { setError(''); move.mutate(n); }}>{n === 'Open' ? 'Reopen' : n}</Btn>
                ))}
              </div>
            </div>
          )}
          <fieldset disabled={readOnly} className="plain-fieldset">
            <h3>Query</h3>
            <div className="form-grid">
              <Field label="Subject" full hint="Short title; the first line of the description is used when empty"><input value={v.title} maxLength={200} onChange={e => up('title', e.target.value)} autoFocus={!point} /></Field>
              <Field label="Originating party" hint="Who raises the query">
                <input value={v.originator} maxLength={120} list="ip-parties" onChange={e => up('originator', e.target.value)} />
              </Field>
              <Field label="Target party" hint="Who must answer">
                <input value={v.target} maxLength={120} list="ip-parties" onChange={e => up('target', e.target.value)} />
              </Field>
              <datalist id="ip-parties">{parties.data?.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</datalist>
              {same && <p className="negative tiny" style={{ gridColumn: '1/-1' }}>Originating and target party must be different.</p>}
              <Field label="Discipline" hint={point ? undefined : 'Used in the point number, e.g. IP-PI-0035'}><input value={v.discipline} maxLength={40} onChange={e => up('discipline', e.target.value)} /></Field>
              <Field label="Work package"><input value={v.workPackage} maxLength={60} onChange={e => up('workPackage', e.target.value)} /></Field>
              <Field label="IP owner"><input value={v.owner} maxLength={120} onChange={e => up('owner', e.target.value)} /></Field>
              <Field label="Linked interface" hint="Optional, from the interface register"><input value={v.interfaceId} maxLength={40} placeholder="INT-…" onChange={e => up('interfaceId', e.target.value)} /></Field>
              <Field label="Description" full><textarea value={v.description} maxLength={3000} rows={4} onChange={e => up('description', e.target.value)} /></Field>
              <Field label="Recommended action" full><textarea value={v.action} maxLength={3000} onChange={e => up('action', e.target.value)} /></Field>
              <Field label="Query date"><input type="date" value={v.queryDate} onChange={e => up('queryDate', e.target.value)} /></Field>
              <Field label="Target date"><input type="date" value={v.targetDate} onChange={e => up('targetDate', e.target.value)} /></Field>
              <Field label="Reference document" full><input value={v.reference} maxLength={500} onChange={e => up('reference', e.target.value)} /></Field>
            </div>
            {point && <>
              <h3>Response</h3>
              <div className="form-grid">
                <Field label="Resolution" full hint="Required to mark the point responded or resolved"><textarea value={v.resolution} maxLength={3000} rows={4} onChange={e => up('resolution', e.target.value)} /></Field>
                <Field label="Resolved document"><input value={v.resolvedDocument} maxLength={300} onChange={e => up('resolvedDocument', e.target.value)} /></Field>
                <Detail label="Resolved date">{point.resolvedDate ? fmtDate(point.resolvedDate) : null}</Detail>
                <Field label="Remarks" full><textarea value={v.remarks} maxLength={1500} onChange={e => up('remarks', e.target.value)} /></Field>
              </div>
            </>}
          </fieldset>
          {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
        </div>
      </Modal>
      {removing && point && (
        <Confirm title={`Delete ${point.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setRemoving(false)}>
          <p>“{point.title}” will be removed from the register. This cannot be undone. Consider closing it instead.</p>
        </Confirm>
      )}
    </>
  );
}

/* ====================== matrices ====================== */
const MATRIX_TABS = [['parties', 'Party × party'], ['responsibility', 'Responsibility'], ['rasci', 'RASCI']] as const;

/** Interface → Matrix: who asks whom (from the points), who does what per facility, and the RASCI per activity. */
export function InterfaceMatrixPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('view') ?? 'parties') as (typeof MATRIX_TABS)[number][0];
  return (
    <>
      <PageHead title="Interface matrix" desc="Party × party counts the points and interfaces between parties. The responsibility and RASCI matrices are the project's agreed split of scope." />
      <div className="tabs" role="tablist" aria-label="Matrix views">
        {MATRIX_TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'active' : ''}`} role="tab" aria-selected={tab === id} onClick={() => setParams({ view: id })}>{label}</button>)}
      </div>
      {tab === 'responsibility' ? <ResponsibilityView /> : tab === 'rasci' ? <RasciView /> : <PartyMatrix />}
    </>
  );
}

function PartyMatrix() {
  const { project } = useApp();
  const navigate = useNavigate();
  const m = useQuery({ queryKey: ['interface-matrix', project.id], queryFn: () => request<InterfaceMatrix>(`/projects/${project.id}/interfaces/matrix`) });
  if (m.isPending) return <div className="panel empty">Loading…</div>;
  if (m.error) return <ErrorBox error={m.error} />;
  const d = m.data;
  if (!d.parties.length) return <div className="panel empty">No interface points or interfaces yet. <Link className="btn small" to="/m/interface.points">Open the points</Link></div>;
  const cell = (o: string, r: string) => d.cells.find(c => c.originator === o && c.receiver === r);
  const name = (c: string) => d.names[c] ?? c;
  return (
    <div className="panel">
      <div className="panel-head"><div><h2>Who asks whom</h2><p>{d.total} points · {d.interfaces} interfaces. Rows raise, columns answer. Open count first, total in brackets; select a cell for its points.</p></div></div>
      <div className="table-wrap">
        <table className="matrix">
          <thead><tr><th>RAISES ↓ / ANSWERS →</th>{d.parties.map(p => <th key={p} title={name(p)}>{p}</th>)}</tr></thead>
          <tbody>{d.parties.map(o => (
            <tr key={o}>
              <th scope="row" style={{ background: 'var(--surface)' }} title={name(o)}>{o}</th>
              {d.parties.map(r => {
                const c = cell(o, r);
                if (o === r) return <td key={r} className="matrix-self">—</td>;
                if (!c) return <td key={r} className="matrix-empty" />;
                const label = `${name(o)} → ${name(r)}: ${c.open} open of ${c.total} points${c.overdue ? `, ${c.overdue} overdue` : ''}${c.interfaces ? `; ${c.interfaces} interfaces` : ''}`;
                return (
                  <td key={r} className={c.overdue ? 'matrix-hot' : c.open ? 'matrix-open' : 'matrix-done'}>
                    <button className="link-button" title={label} aria-label={label} onClick={() => navigate(`/m/interface.points?${new URLSearchParams({ originator: o, target: r })}`)}>
                      <strong>{c.open}</strong> <span className="muted">({c.total})</span>{c.overdue > 0 && <span className="negative"> · {c.overdue}!</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="legend" style={{ padding: '0 22px 18px' }}>
        <span><span className="dot" style={{ background: 'var(--negative, #b23a52)' }} />Has overdue points</span>
        <span><span className="dot" style={{ background: '#b9801f' }} />Open points</span>
        <span><span className="dot" style={{ background: '#3f8f6b' }} />All settled</span>
      </div>
    </div>
  );
}

/** Scope × facility → responsible party, as agreed in the contract's responsibility matrix. */
function ResponsibilityView() {
  const { project } = useApp();
  const [party, setParty] = useState('');
  const [q, setQ] = useState('');
  const needle = useDebounced(q).toLowerCase();
  const m = useQuery({ queryKey: ['interface-matrix', 'responsibility', project.id], queryFn: () => request<ResponsibilityMatrix>(`/projects/${project.id}/interfaces/responsibility`) });
  if (m.isPending) return <div className="panel empty">Loading…</div>;
  if (m.error) return <ErrorBox error={m.error} />;
  const d = m.data;
  if (!d.rows.length) return <div className="panel empty">No responsibility matrix loaded for this project.</div>;
  const rows = d.rows.filter(r => (!needle || `${r.ref ?? ''} ${r.activity} ${r.section}`.toLowerCase().includes(needle)) && (!party || Object.values(r.cells).includes(party)));
  let section = '';
  return (
    <>
      <div className="stats">
        {d.parties.slice(0, 6).map(p => <Stat key={p.code} label={p.code} value={p.cells} foot={p.name} icon="people" />)}
      </div>
      <div className="panel">
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search activity or reference…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the responsibility matrix" /></label>
          <div className="filter-group">
            <IconFilter icon="people" label="Highlight a party" value={party} onChange={setParty}>
              <option value="">Every party</option>{d.parties.map(p => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
            </IconFilter>
            <span className="tiny muted">{rows.length} of {d.rows.length} activities</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="matrix resp">
            <thead><tr><th>ACTIVITY</th>{d.facilities.map(f => <th key={f.facility} title={f.workPackage ?? undefined}>{f.facility}</th>)}</tr></thead>
            <tbody>{rows.flatMap(r => {
              const head = r.section !== section ? (section = r.section, [<tr key={`s-${r.order}`} className="matrix-section"><th colSpan={d.facilities.length + 1}>{r.section}</th></tr>]) : [];
              return [...head, (
                <tr key={r.order}>
                  <th scope="row" style={{ paddingLeft: 12 + (r.level - 1) * 14 }} title={r.remark ?? undefined}>{r.ref && <span className="mono muted">{r.ref} </span>}{r.activity}</th>
                  {d.facilities.map(f => {
                    const v = r.cells[f.facility];
                    return <td key={f.facility} className={v && party === v ? 'matrix-open' : v ? '' : 'matrix-empty'} title={v ? `${f.facility}: ${partyLabel(d.parties, v)}` : undefined}>{v ?? ''}</td>;
                  })}
                </tr>
              )];
            })}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
const partyLabel = (parties: { code: string; name: string }[], code: string) => parties.find(p => p.code === code)?.name ?? code;

/** RASCI per activity: Responsible, Accountable, Supports, Consulted, Informed. */
function RasciView() {
  const { project } = useApp();
  const m = useQuery({ queryKey: ['interface-matrix', 'rasci', project.id], queryFn: () => request<RasciMatrices>(`/projects/${project.id}/interfaces/rasci`) });
  const [pick, setPick] = useState(0);
  if (m.isPending) return <div className="panel empty">Loading…</div>;
  if (m.error) return <ErrorBox error={m.error} />;
  const d = m.data;
  if (!d.matrices.length) return <div className="panel empty">No RASCI matrix loaded for this project.</div>;
  const mx = d.matrices[Math.min(pick, d.matrices.length - 1)];
  const role = (code: string) => d.roles.find(r => r.code === code)?.label ?? code;
  let section = '';
  return (
    <div className="panel">
      <div className="panel-head">
        <div><h2>{mx.name}</h2><p>{d.roles.map(r => `${r.code} = ${r.label}`).join(' · ')}</p></div>
        {d.matrices.length > 1 && (
          <div className="seg" role="group" aria-label="RASCI matrix">
            {d.matrices.map((x, i) => <button key={x.name} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>{x.name}</button>)}
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="matrix resp">
          <thead><tr><th>ACTIVITY</th>{mx.parties.map(p => <th key={`${p.phase}-${p.party}`} title={p.phase ?? undefined}>{p.party}{p.phase && <small className="muted" style={{ display: 'block', fontWeight: 400 }}>{p.phase}</small>}</th>)}</tr></thead>
          <tbody>{mx.rows.flatMap(r => {
            const head = r.section !== section ? (section = r.section, [<tr key={`s-${r.order}`} className="matrix-section"><th colSpan={mx.parties.length + 1}>{r.section}</th></tr>]) : [];
            return [...head, (
              <tr key={r.order}>
                <th scope="row" title={r.remark ?? undefined}>{r.ref && <span className="mono muted">{r.ref} </span>}{r.activity}</th>
                {mx.parties.map(p => {
                  const v = r.roles[`${p.phase ?? ''}|${p.party}`] ?? r.roles[p.party] ?? '';
                  return <td key={`${p.phase}-${p.party}`} className={`rasci rasci-${v.slice(0, 1).toLowerCase()}`} title={v ? v.split('/').map(role).join(', ') : undefined}>{v}</td>;
                })}
              </tr>
            )];
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ====================== interface register (INT-04 workflow) ====================== */
interface Filters { q: string; type: string; status: string; party: string; overdue: boolean; sort?: string; order: 'asc' | 'desc'; page: number }

export function InterfaceRegister() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const refresh = useRefresh();
  const [params, setParams] = useSearchParams();
  const originator = params.get('originator') ?? '';
  const receiver = params.get('receiver') ?? '';
  const base = `/projects/${project.id}/interfaces`;
  const [f, setF] = useState<Filters>({ q: '', type: '', status: '', party: '', overdue: false, sort: 'id', order: 'asc', page: 1 });
  const [editing, setEditing] = useState<InterfaceRecord | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(f.q);
  const set = (patch: Partial<Filters>) => setF(s => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const filterQs = { q, type: f.type, status: f.status, party: f.party, originator, receiver, overdue: f.overdue ? 'true' : undefined };

  const summary = useQuery({ queryKey: ['interface-summary', project.id], queryFn: () => request<InterfaceSummary>(`${base}/summary`) });
  const query = qs({ ...filterQs, sort: f.sort, order: f.order, page: f.page, pageSize: 25 });
  const page = useQuery({ queryKey: ['interfaces', project.id, query], queryFn: () => request<Page<InterfaceRecord>>(`${base}${query}`), placeholderData: keepPreviousData });

  const sortBy = (key: string) => setF(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));
  const columns = useMemo<ColumnDef<InterfaceRecord>[]>(() => [
    {
      id: 'title', header: 'INTERFACE', meta: { sortKey: 'id' },
      cell: ({ row: { original: i } }) => (
        <button className="link-button" onClick={() => setOpenId(i.id)}>
          <strong>{i.title}</strong><small className="muted" style={{ display: 'block' }}><span className="mono">{i.id}</span> · {i.type} · {i.originator} → {i.receiver}</small>
        </button>
      ),
    },
    { id: 'coordinator', header: 'COORDINATOR', cell: ({ row: { original: i } }) => <People names={i.coordinator ? [i.coordinator] : []} empty="No coordinator" /> },
    { id: 'need', header: 'NEEDED BY', meta: { sortKey: 'needDate' }, cell: ({ row: { original: i } }) => (i.needDate ? <span className={`task-meta-item ${i.overdue ? 'negative' : ''}`}><Icon name="calendar" />{fmtDate(i.needDate)}</span> : <span className="muted">—</span>) },
    { id: 'points', header: 'POINTS', cell: ({ row: { original: i } }) => (i.pointsTotal ? <span className="issue-sub" title={`${i.pointsOpen} of ${i.pointsTotal} points still open`}><Icon name="link" />{i.pointsTotal - i.pointsOpen}/{i.pointsTotal}</span> : <span className="tiny muted">None</span>) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: i } }) => <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge> },
  ], []);

  const s = summary.data;
  const filtered = !!(originator || receiver);
  return (
    <>
      <PageHead title="Interface register" desc="Formal interfaces between parties (INT-04): what is needed, who coordinates it, and how it moves to agreement. Day-to-day queries live in Interface points."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${qs(filterQs)}`, 'interface-register.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New interface</Btn>}
        </>} />
      <div className="stats">
        <Stat label="Interfaces" value={s?.total ?? '—'} foot="In the register" icon="link" />
        <Stat label="Open" value={s?.open ?? '—'} foot="Not yet agreed or closed" icon="clock" />
        <Stat label="Overdue" value={s?.overdue ?? '—'} foot={<span className={s?.overdue ? 'negative' : ''}>Need date before the cut-off</span>} icon="risk" />
        <Stat label="Open points" value={s?.pointsOpen ?? '—'} foot={<Link to="/m/interface.points">Across all parties</Link>} icon="check" />
        <Stat label="Overdue points" value={s?.pointsOverdue ?? '—'} foot="Past their target date" icon="calendar" />
        <Stat label="Agreed or closed" value={s ? (s.byStatus.Agreed ?? 0) + (s.byStatus.Closed ?? 0) : '—'} foot="Settled interfaces" icon="shield" />
      </div>
      <div className="panel">
        {filtered && (
          <div className="banner" style={{ margin: '14px 22px' }}>
            Showing {originator || 'any party'} → {receiver || 'any party'}. <button className="btn text" onClick={() => setParams({})}>Clear</button>
          </div>
        )}
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, title, party or coordinator…" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search interfaces" /></label>
          <div className="filter-group">
            <IconFilter icon="layers" label="Filter by type" value={f.type} onChange={v => set({ type: v })}><option value="">All types</option>{INTERFACE_TYPES.map(t => <option key={t}>{t}</option>)}</IconFilter>
            <IconFilter icon="status-ongoing" label="Filter by status" value={f.status} onChange={v => set({ status: v })}><option value="">All statuses</option>{page.data?.facets.statuses.map(x => <option key={x}>{x}</option>)}</IconFilter>
            <IconFilter icon="people" label="Filter by party" value={f.party} onChange={v => set({ party: v })}><option value="">All parties</option>{page.data?.facets.parties?.map(x => <option key={x}>{x}</option>)}</IconFilter>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={f.overdue} onChange={e => set({ overdue: e.target.checked })} />Overdue only</label>
            <Btn kind="small" onClick={() => { set({ q: '', type: '', status: '', party: '', overdue: false }); setParams({}); }}>Clear</Btn>
            <span className="tiny muted">{page.data?.total ?? '…'} interfaces</span>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={f} onSort={sortBy} empty={page.data && !page.data.total && !s?.total ? 'No formal interfaces recorded yet. Raise day-to-day queries as interface points.' : 'No interfaces match. Change the search or filters.'} />
            <Pager page={f.page} pageSize={25} total={page.data?.total ?? 0} onPage={p => set({ page: p })} />
          </>
        )}
      </div>
      {editing && <InterfaceForm item={editing === 'new' ? null : editing} base={base} onClose={() => setEditing(null)} onSaved={id => { setEditing(null); refresh(); if (id) setOpenId(id); }} />}
      {openId && <InterfaceDetail id={openId} onClose={() => setOpenId(null)} onEdit={i => { setOpenId(null); setEditing(i); }} />}
    </>
  );
}

function InterfaceForm({ item, base, onClose, onSaved }: { item: InterfaceRecord | null; base: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { project } = useApp();
  const toast = useToast();
  const parties = useParties(project.id);
  const [v, setV] = useState({
    title: item?.title ?? '', type: item?.type ?? 'Technical', originator: item?.originator ?? '', receiver: item?.receiver ?? '',
    coordinator: item?.coordinator ?? '', discipline: item?.discipline ?? '', boundary: item?.boundary ?? '', requiredInput: item?.requiredInput ?? '',
    requiredOutput: item?.requiredOutput ?? '', needDate: item?.needDate ?? '', response: item?.response ?? '', acceptance: item?.acceptance ?? '',
    evidence: item?.evidence ?? '', milestoneId: item?.milestoneId ?? '',
  });
  const [error, setError] = useState('');
  const milestones = useQuery({ queryKey: ['milestone-options', project.id], queryFn: () => request<Page<Milestone>>(`/projects/${project.id}/milestones?pageSize=200`), staleTime: 60_000 });
  const up = (k: keyof typeof v, val: string) => setV(s => ({ ...s, [k]: val }));
  const same = !!v.originator && v.originator.trim().toLowerCase() === v.receiver.trim().toLowerCase();

  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof val === 'string' && val.trim() === '' && !['title', 'originator', 'receiver'].includes(k) ? null : val]));
      return item ? request<InterfaceRecord>(`${base}/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) }) : request<InterfaceRecord>(base, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: r => { toast(item ? 'Interface updated.' : `Interface ${r.id} created.`); onSaved(r.id); },
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal title={item ? `${item.id} · Edit interface` : 'New interface'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !v.title.trim() || !v.originator.trim() || !v.receiver.trim() || same} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Title" full><input value={v.title} maxLength={160} onChange={e => up('title', e.target.value)} autoFocus /></Field>
          <Field label="Type"><select value={v.type} onChange={e => up('type', e.target.value)}>{INTERFACE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Discipline"><input value={v.discipline} maxLength={80} onChange={e => up('discipline', e.target.value)} /></Field>
          <Field label="Originating party" hint="Who needs something"><input value={v.originator} maxLength={120} list="int-parties" onChange={e => up('originator', e.target.value)} /></Field>
          <Field label="Receiving party" hint="Who provides it"><input value={v.receiver} maxLength={120} list="int-parties" onChange={e => up('receiver', e.target.value)} /></Field>
          <datalist id="int-parties">{parties.data?.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}</datalist>
          {same && <p className="negative tiny" style={{ gridColumn: '1/-1' }}>Originator and receiving party must be different.</p>}
          <Field label="Accountable coordinator" hint="Required before the interface can be assigned"><input value={v.coordinator} maxLength={120} onChange={e => up('coordinator', e.target.value)} /></Field>
          <Field label="Needed by"><input type="date" value={v.needDate} onChange={e => up('needDate', e.target.value)} /></Field>
          <Field label="Boundary" full><textarea value={v.boundary} maxLength={1000} onChange={e => up('boundary', e.target.value)} /></Field>
          <Field label="Required input"><textarea value={v.requiredInput} maxLength={1000} onChange={e => up('requiredInput', e.target.value)} /></Field>
          <Field label="Required output"><textarea value={v.requiredOutput} maxLength={1000} onChange={e => up('requiredOutput', e.target.value)} /></Field>
          <Field label="Response" full hint="Required before the interface can be marked as responded"><textarea value={v.response} maxLength={2000} onChange={e => up('response', e.target.value)} /></Field>
          <Field label="Acceptance criteria" full><textarea value={v.acceptance} maxLength={1000} onChange={e => up('acceptance', e.target.value)} /></Field>
          <Field label="Evidence" full><input value={v.evidence} maxLength={500} placeholder="Document number, transmittal or link" onChange={e => up('evidence', e.target.value)} /></Field>
          <Field label="Linked milestone" full>
            <select value={v.milestoneId} onChange={e => up('milestoneId', e.target.value)}>
              <option value="">None</option>
              {milestones.data?.items.map(m => <option key={m.id} value={m.id}>{m.id} · {m.description}{m.subName ? ` (${m.subName})` : ''}</option>)}
            </select>
          </Field>
        </div>
        {item && <p className="tiny muted" style={{ marginTop: 14 }}>Status changes happen from the interface detail, not here.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}

function InterfaceDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (i: InterfaceRecord) => void }) {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const refresh = useRefresh();
  const base = `/projects/${project.id}`;
  const q = useQuery({ queryKey: ['interface', project.id, id], queryFn: () => request<InterfaceRecord>(`${base}/interfaces/${id}`) });
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [point, setPoint] = useState<string | 'new' | null>(null);

  const move = useMutation({
    mutationFn: (to: InterfaceStatus) => request<InterfaceRecord>(`${base}/interfaces/${id}/transition`, { method: 'POST', body: JSON.stringify({ to }) }),
    onSuccess: r => { setError(''); refresh(); toast(`Interface is now ${r.status}.`); }, onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/interfaces/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Interface deleted.'); onClose(); }, onError: (e: Error) => { setRemoving(false); setError(errorText(e)); },
  });

  const i = q.data;
  return (
    <>
      <Modal title={i ? `${i.id} · Interface` : 'Interface'} size="lg" onClose={onClose} actions={<>
        {i && access.canManage && <Btn kind="text" onClick={() => setRemoving(true)}>Delete</Btn>}
        {i && access.canWrite && <Btn onClick={() => onEdit(i)}>Edit</Btn>}
        <Btn onClick={onClose}>Close</Btn>
      </>}>
        <div className="dialog-body">
          {q.error ? <ErrorBox error={q.error} /> : !i ? <div className="empty">Loading…</div> : (
            <>
              <div className="drawer-intro">
                <div className="eyebrow">{i.type}{i.discipline ? ` · ${i.discipline}` : ''}</div>
                <h1>{i.title}</h1>
                <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge> {i.overdue && <Badge tone="red">Overdue</Badge>} <span className="tiny muted">{i.originator} → {i.receiver}</span>
              </div>
              {access.canWrite && i.allowedNext.length > 0 && (
                <div style={{ margin: '16px 0' }}>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>Move to</div>
                  <div className="actions">{i.allowedNext.map(n => <Btn key={n} kind="small" disabled={move.isPending} onClick={() => { setError(''); move.mutate(n); }}>{n}</Btn>)}</div>
                </div>
              )}
              <div className="detail-grid">
                <Detail label="Coordinator">{i.coordinator}</Detail>
                <Detail label="Needed by">{i.needDate ? fmtDate(i.needDate) : null}</Detail>
                <Detail label="Milestone">{i.milestone}</Detail>
                <Detail label="Boundary">{i.boundary}</Detail>
                <Detail label="Required input">{i.requiredInput}</Detail>
                <Detail label="Required output">{i.requiredOutput}</Detail>
                <Detail label="Response" full>{i.response}</Detail>
                <Detail label="Acceptance criteria">{i.acceptance}</Detail>
                <Detail label="Evidence">{i.evidence}</Detail>
              </div>
              <h3>Interface points <span className="count">{i.pointsOpen} open / {i.pointsTotal}</span></h3>
              {i.points?.length ? (
                <ul className="subtask-list">
                  {i.points.map(p => (
                    <li key={p.id} className={`subtask ${p.settled ? "done" : ""}`}>
                      <span className="issue-icon" title={p.status}><Icon name={POINT_ICON[p.status]} /></span>
                      <button className="link-button grow" style={{ textAlign: 'left' }} onClick={() => setPoint(p.id)}><span className="mono tiny muted">{p.id}</span> {p.title}</button>
                      <span className="tiny muted">{p.originator} → {p.target}</span>
                      {p.targetDate && <span className={`tiny ${p.overdue ? 'negative' : 'muted'}`}><Icon name="calendar" /> {fmtDate(p.targetDate)}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="tiny muted">No points yet. All points must be resolved or closed before the interface can close.</p>}
              {access.canWrite && i.status !== 'Closed' && <Btn kind="small" icon="plus" onClick={() => setPoint('new')}>Raise a point</Btn>}
              {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            </>
          )}
        </div>
      </Modal>
      {point && <PointDrawer id={point === 'new' ? null : point} interfaceId={id} onClose={() => setPoint(null)} />}
      {removing && i && (
        <Confirm title={`Delete ${i.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setRemoving(false)}>
          <p>“{i.title}” will be removed from the register. An interface with points cannot be deleted. This cannot be undone.</p>
        </Confirm>
      )}
    </>
  );
}
