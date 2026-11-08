import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  downloadCsv, errorText, INTERFACE_TYPES, POINT_STATUSES, qs, request,
  type InterfaceMatrix, type InterfacePoint, type InterfaceRecord, type InterfaceStatus, type InterfaceSummary, type Milestone, type Page, type PointStatus,
} from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { Icon } from '../icons';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, Confirm, ErrorBox, Field, Modal, PageHead, Pager, Stat, useDebounced } from '../ui';

const PAGE_SIZE = 25;
const STATUS_TONE: Record<InterfaceStatus, Tone> = {
  Identified: 'indigo', Assigned: 'indigo', 'Information requested': 'amber', Responded: 'amber', 'Under review': 'amber', Agreed: 'green', Closed: 'green',
};
const POINT_TONE: Record<PointStatus, Tone> = { Open: 'amber', 'In progress': 'indigo', Accepted: 'green', Closed: 'green' };

function useRefresh() {
  const { project } = useApp();
  const qc = useQueryClient();
  return () => Promise.all(['interfaces', 'interface-summary', 'interface-matrix', 'interface-points', 'interface'].map(k => qc.invalidateQueries({ queryKey: [k, project.id] })).concat(qc.invalidateQueries({ queryKey: ['dashboard', project.id] })));
}

/* ====================== register ====================== */
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
  const query = qs({ ...filterQs, sort: f.sort, order: f.order, page: f.page, pageSize: PAGE_SIZE });
  const page = useQuery({ queryKey: ['interfaces', project.id, query], queryFn: () => request<Page<InterfaceRecord>>(`${base}${query}`), placeholderData: keepPreviousData });

  const sortBy = (key: string) => setF(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));
  const columns = useMemo<ColumnDef<InterfaceRecord>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: i } }) => <span className="mono">{i.id}</span> },
    {
      id: 'title', header: 'INTERFACE', meta: { sortKey: 'title' },
      cell: ({ row: { original: i } }) => (
        <button className="link-button" onClick={() => setOpenId(i.id)}>
          <strong>{i.title}</strong><small className="muted" style={{ display: 'block' }}>{i.originator} → {i.receiver}</small>
        </button>
      ),
    },
    { id: 'type', header: 'TYPE', cell: ({ row: { original: i } }) => i.type },
    { id: 'coordinator', header: 'COORDINATOR', cell: ({ row: { original: i } }) => i.coordinator ?? <span className="tiny muted">Not assigned</span> },
    { id: 'need', header: 'NEEDED BY', meta: { sortKey: 'needDate' }, cell: ({ row: { original: i } }) => <span className={i.overdue ? 'negative' : ''}>{fmtDate(i.needDate)}{i.overdue ? ' · overdue' : ''}</span> },
    { id: 'points', header: 'POINTS', cell: ({ row: { original: i } }) => (i.pointsTotal ? <span>{i.pointsOpen} open <span className="muted">/ {i.pointsTotal}</span></span> : <span className="tiny muted">None</span>) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: i } }) => <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge> },
    { id: 'open', header: '', cell: ({ row: { original: i } }) => <button className="icon-btn" aria-label={`Open ${i.id}`} onClick={() => setOpenId(i.id)}><Icon name="arrow" /></button> },
  ], []);

  const s = summary.data;
  const filtered = !!(originator || receiver);
  return (
    <>
      <PageHead title="Interface register" desc="Who needs what from whom, who is accountable, and how each interface moves to agreement and closure."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${qs(filterQs)}`, 'interface-register.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New interface</Btn>}
        </>} />
      <div className="stats">
        <Stat label="Interfaces" value={s?.total ?? '—'} foot="In the register" icon="link" />
        <Stat label="Open" value={s?.open ?? '—'} foot="Not yet agreed or closed" icon="clock" />
        <Stat label="Overdue" value={s?.overdue ?? '—'} foot={<span className={s?.overdue ? 'negative' : ''}>Need date before the cut-off</span>} icon="risk" />
        <Stat label="Open points" value={s?.pointsOpen ?? '—'} foot="Blocking closure" icon="check" />
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Interfaces</h2><p>Select an interface to see its points and move it through the workflow</p></div><span className="tiny muted">{page.data?.total ?? '…'} interfaces</span></div>
        {filtered && (
          <div className="banner" style={{ margin: '0 22px 14px' }}>
            Showing {originator || 'any party'} → {receiver || 'any party'}. <button className="btn text" onClick={() => setParams({})}>Clear</button>
          </div>
        )}
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, title, party or coordinator…" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search interfaces" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by type" value={f.type} onChange={e => set({ type: e.target.value })}><option value="">All types</option>{INTERFACE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select className="filter" aria-label="Filter by status" value={f.status} onChange={e => set({ status: e.target.value })}><option value="">All statuses</option>{page.data?.facets.statuses.map(x => <option key={x}>{x}</option>)}</select>
            <select className="filter" aria-label="Filter by party" value={f.party} onChange={e => set({ party: e.target.value })}><option value="">All parties</option>{page.data?.facets.parties?.map(x => <option key={x}>{x}</option>)}</select>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={f.overdue} onChange={e => set({ overdue: e.target.checked })} />Overdue only</label>
            <Btn kind="small" onClick={() => { set({ q: '', type: '', status: '', party: '', overdue: false }); setParams({}); }}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={f} onSort={sortBy} empty={page.data && !page.data.total && !s?.total ? 'No interfaces recorded yet.' : 'No interfaces match. Change the search or filters.'} />
            <Pager page={f.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => set({ page: p })} />
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
          <Field label="Originating party" hint="Who needs something"><input value={v.originator} maxLength={120} onChange={e => up('originator', e.target.value)} /></Field>
          <Field label="Receiving party" hint="Who provides it"><input value={v.receiver} maxLength={120} onChange={e => up('receiver', e.target.value)} /></Field>
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
  const [point, setPoint] = useState({ title: '', owner: '', due: '' });
  const done = () => { setError(''); refresh(); };

  const move = useMutation({
    mutationFn: (to: InterfaceStatus) => request<InterfaceRecord>(`${base}/interfaces/${id}/transition`, { method: 'POST', body: JSON.stringify({ to }) }),
    onSuccess: r => { done(); toast(`Interface is now ${r.status}.`); }, onError: (e: Error) => setError(errorText(e)),
  });
  const addPoint = useMutation({
    mutationFn: () => request<InterfacePoint>(`${base}/interface-points`, { method: 'POST', body: JSON.stringify({ interfaceId: id, title: point.title, owner: point.owner, due: point.due || null }) }),
    onSuccess: () => { setPoint({ title: '', owner: '', due: '' }); done(); toast('Point added.'); }, onError: (e: Error) => setError(errorText(e)),
  });
  const setPointStatus = useMutation({
    mutationFn: ({ pid, status }: { pid: string; status: PointStatus }) => request<InterfacePoint>(`${base}/interface-points/${pid}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: done, onError: (e: Error) => setError(errorText(e)),
  });
  const removePoint = useMutation({
    mutationFn: (pid: string) => request<void>(`${base}/interface-points/${pid}`, { method: 'DELETE' }),
    onSuccess: () => { done(); toast('Point removed.'); }, onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/interfaces/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Interface deleted.'); onClose(); }, onError: (e: Error) => { setRemoving(false); setError(errorText(e)); },
  });

  const i = q.data;
  return (
    <>
      <Modal title={i ? `${i.id} · Interface` : 'Interface'} onClose={onClose} actions={<>
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
                {([
                  ['Coordinator', i.coordinator], ['Needed by', i.needDate ? fmtDate(i.needDate) : null], ['Boundary', i.boundary], ['Milestone', i.milestone],
                  ['Required input', i.requiredInput], ['Required output', i.requiredOutput], ['Response', i.response], ['Acceptance criteria', i.acceptance], ['Evidence', i.evidence],
                ] as const).map(([k, val]) => <div key={k}><small>{k}</small><strong style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{val || '—'}</strong></div>)}
              </div>
              <h3>Interface points <span className="count">{i.pointsOpen} open / {i.pointsTotal}</span></h3>
              {i.points?.length ? (
                <div className="table-wrap"><table>
                  <thead><tr><th>ID</th><th>POINT</th><th>OWNER</th><th>DUE</th><th>STATUS</th>{access.canManage && <th />}</tr></thead>
                  <tbody>{i.points.map(p => (
                    <tr key={p.id}>
                      <td className="mono">{p.id}</td><td style={{ whiteSpace: 'normal' }}>{p.title}</td><td>{p.owner}</td>
                      <td className={p.overdue ? 'negative' : ''}>{fmtDate(p.due)}</td>
                      <td>{access.canWrite
                        ? <select className="filter" aria-label={`Status of ${p.id}`} value={p.status} onChange={e => setPointStatus.mutate({ pid: p.id, status: e.target.value as PointStatus })}>{POINT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                        : <Badge tone={POINT_TONE[p.status]}>{p.status}</Badge>}</td>
                      {access.canManage && <td><button className="icon-btn" aria-label={`Remove ${p.id}`} onClick={() => removePoint.mutate(p.id)}><Icon name="close" /></button></td>}
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <p className="tiny muted">No points yet. Points are the concrete items that must be accepted before the interface can close.</p>}
              {access.canWrite && i.status !== 'Closed' && (
                <form className="form-grid" style={{ marginTop: 14 }} onSubmit={e => { e.preventDefault(); setError(''); addPoint.mutate(); }}>
                  <Field label="New point" full><input value={point.title} maxLength={160} onChange={e => setPoint(p => ({ ...p, title: e.target.value }))} /></Field>
                  <Field label="Owner"><input value={point.owner} maxLength={120} onChange={e => setPoint(p => ({ ...p, owner: e.target.value }))} /></Field>
                  <Field label="Due"><input type="date" value={point.due} onChange={e => setPoint(p => ({ ...p, due: e.target.value }))} /></Field>
                  <div className="field full"><button className="btn small" type="submit" disabled={addPoint.isPending || !point.title.trim() || !point.owner.trim()}>Add point</button></div>
                </form>
              )}
              {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            </>
          )}
        </div>
      </Modal>
      {removing && i && (
        <Confirm title={`Delete ${i.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setRemoving(false)}>
          <p>“{i.title}” will be removed from the register. An interface with points cannot be deleted. This cannot be undone.</p>
        </Confirm>
      )}
    </>
  );
}

/* ====================== matrix ====================== */
export function InterfaceMatrixPage() {
  const { project } = useApp();
  const m = useQuery({ queryKey: ['interface-matrix', project.id], queryFn: () => request<InterfaceMatrix>(`/projects/${project.id}/interfaces/matrix`) });
  const cell = (o: string, r: string) => m.data?.cells.find(c => c.originator === o && c.receiver === r);
  return (
    <>
      <PageHead title="Interface matrix" desc="Derived from the register: rows are the party that needs something, columns the party that provides it." />
      {m.isPending ? <div className="panel empty">Loading…</div> : m.error ? <ErrorBox error={m.error} /> : !m.data.parties.length ? (
        <div className="panel empty">No interfaces yet. <Link className="btn small" to="/m/interface.register">Open the register</Link></div>
      ) : (
        <div className="panel">
          <div className="panel-head"><div><h2>Party × party</h2><p>{m.data.total} interfaces · counts show open (total), red marks overdue</p></div></div>
          <div className="table-wrap">
            <table className="matrix">
              <thead><tr><th>NEEDS ↓ / PROVIDES →</th>{m.data.parties.map(p => <th key={p}>{p}</th>)}</tr></thead>
              <tbody>{m.data.parties.map(o => (
                <tr key={o}>
                  <th scope="row" style={{ background: 'var(--surface)' }}>{o}</th>
                  {m.data.parties.map(r => {
                    const c = cell(o, r);
                    if (o === r) return <td key={r} className="matrix-self">—</td>;
                    if (!c) return <td key={r} className="matrix-empty" />;
                    return (
                      <td key={r} className={c.overdue ? 'matrix-hot' : c.open ? 'matrix-open' : 'matrix-done'}>
                        <Link to={`/m/interface.register?${new URLSearchParams({ originator: o, receiver: r })}`}>
                          <strong>{c.open}</strong> <span className="muted">({c.total})</span>{c.overdue > 0 && <span className="negative"> · {c.overdue} overdue</span>}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/* ====================== points ====================== */
export function InterfacePointsPage() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const refresh = useRefresh();
  const base = `/projects/${project.id}/interface-points`;
  const [f, setF] = useState({ q: '', status: '', overdue: false, sort: 'due' as string | undefined, order: 'asc' as 'asc' | 'desc', page: 1 });
  const q = useDebounced(f.q);
  const set = (patch: Partial<typeof f>) => setF(s => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const query = qs({ q, status: f.status, overdue: f.overdue ? 'true' : undefined, sort: f.sort, order: f.order, page: f.page, pageSize: PAGE_SIZE });
  const page = useQuery({ queryKey: ['interface-points', project.id, query], queryFn: () => request<Page<InterfacePoint>>(`${base}${query}`), placeholderData: keepPreviousData });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PointStatus }) => request<InterfacePoint>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { refresh(); toast('Point updated.'); }, onError: (e: Error) => toast(errorText(e)),
  });
  const sortBy = (key: string) => setF(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));

  const columns = useMemo<ColumnDef<InterfacePoint>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: p } }) => <span className="mono">{p.id}</span> },
    { id: 'title', header: 'POINT', meta: { sortKey: 'title' }, cell: ({ row: { original: p } }) => <span><strong>{p.title}</strong><small className="muted" style={{ display: 'block' }}>{p.interfaceId}{p.interfaceTitle ? ` · ${p.interfaceTitle}` : ''}</small></span> },
    { id: 'owner', header: 'OWNER', meta: { sortKey: 'owner' }, cell: ({ row: { original: p } }) => p.owner },
    { id: 'due', header: 'DUE', meta: { sortKey: 'due' }, cell: ({ row: { original: p } }) => <span className={p.overdue ? 'negative' : ''}>{fmtDate(p.due)}{p.overdue ? ' · overdue' : ''}</span> },
    {
      id: 'status', header: 'STATUS', meta: { sortKey: 'status' },
      cell: ({ row: { original: p } }) => access.canWrite
        ? <select className="filter" aria-label={`Status of ${p.id}`} value={p.status} onChange={e => setStatus.mutate({ id: p.id, status: e.target.value as PointStatus })}>{POINT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        : <Badge tone={POINT_TONE[p.status]}>{p.status}</Badge>,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [access.canWrite]);

  return (
    <>
      <PageHead title="Interface points" desc="Concrete items under each interface. All points must be accepted or closed before an interface can close." />
      <div className="panel">
        <div className="panel-head"><div><h2>Points</h2><p>Add points from an interface in the register</p></div><span className="tiny muted">{page.data?.total ?? '…'} points</span></div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, point, owner or interface…" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search interface points" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by status" value={f.status} onChange={e => set({ status: e.target.value })}><option value="">All statuses</option>{POINT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={f.overdue} onChange={e => set({ overdue: e.target.checked })} />Overdue only</label>
            <Btn kind="small" onClick={() => set({ q: '', status: '', overdue: false })}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={f} onSort={sortBy} empty="No interface points match." />
            <Pager page={f.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => set({ page: p })} />
          </>
        )}
      </div>
    </>
  );
}
