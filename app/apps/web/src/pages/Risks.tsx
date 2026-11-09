import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, errorText, qs, request, RISK_CATEGORIES, RISK_STATUSES, type Milestone, type Page, type Risk, type RiskLevel, type RiskStatus, type RiskSummary } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate, type Tone } from '../format';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, Confirm, ErrorBox, Field, Modal, PageHead, Pager, Stat, useDebounced } from '../ui';
import { Icon } from '../icons';

const PAGE_SIZE = 25;
const LEVEL_TONE: Record<RiskLevel, Tone> = { Low: 'green', Medium: 'amber', High: 'red', Extreme: 'red' };

/** Mirrors the backend's 5x5 matrix (spec MGT-01, matrix v1): used only to preview a score while typing. */
const levelOf = (score: number | null): RiskLevel | null => (score == null ? null : score >= 17 ? 'Extreme' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low');
const scoreOf = (l: number | null, i: number | null) => (l && i ? l * i : null);

const LevelBadge = ({ level, score }: { level: RiskLevel | null; score: number | null }) =>
  level ? <span className={`pill ${LEVEL_TONE[level]} level-${level.toLowerCase()}`}>{level} · {score}</span> : <span className="tiny muted">—</span>;

interface Filters { q: string; category: string; level: string; status: string; sort?: string; order: 'asc' | 'desc'; page: number }

export default function Risks() {
  const { project } = useApp();
  const access = useAccess();
  const qc = useQueryClient();
  const toast = useToast();
  const base = `/projects/${project.id}/risks`;
  const [f, setF] = useState<Filters>({ q: '', category: '', level: '', status: '', sort: 'score', order: 'desc', page: 1 });
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);
  const [removing, setRemoving] = useState<Risk | null>(null);
  const [view, setView] = useState<'current' | 'inherent'>('current');
  const q = useDebounced(f.q);
  const set = (patch: Partial<Filters>) => setF(s => ({ ...s, ...patch, page: patch.page ?? 1 }));

  const query = qs({ q, category: f.category, level: f.level, status: f.status, sort: f.sort, order: f.order, page: f.page, pageSize: PAGE_SIZE });
  const summary = useQuery({ queryKey: ['risk-summary', project.id], queryFn: () => request<RiskSummary>(`${base}/summary`) });
  const page = useQuery({ queryKey: ['risks', project.id, query], queryFn: () => request<Page<Risk>>(`${base}${query}`), placeholderData: keepPreviousData });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['risks', project.id] }), qc.invalidateQueries({ queryKey: ['risk-summary', project.id] }), qc.invalidateQueries({ queryKey: ['dashboard', project.id] })]);

  const remove = useMutation({
    mutationFn: (id: string) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setRemoving(null); refresh(); toast('Risk deleted.'); },
    onError: (e: Error) => toast(errorText(e)),
  });

  const sortBy = (key: string) => setF(s => ({ ...s, sort: key, order: s.sort === key && s.order === 'asc' ? 'desc' : 'asc', page: 1 }));
  const columns = useMemo<ColumnDef<Risk>[]>(() => [
    { id: 'id', header: 'ID', meta: { sortKey: 'id' }, cell: ({ row: { original: r } }) => <span className="mono">{r.id}</span> },
    {
      id: 'title', header: 'RISK', meta: { sortKey: 'title' },
      cell: ({ row: { original: r } }) => (
        <button className="link-button" onClick={() => setEditing(r)}>
          <strong>{r.title}</strong>
          <small className="muted" style={{ display: 'block' }}>{r.category} · {r.owner}{r.milestone ? ` · ${r.milestone}` : ''}</small>
        </button>
      ),
    },
    { id: 'inherent', header: 'INHERENT', cell: ({ row: { original: r } }) => <LevelBadge level={r.inherentLevel} score={r.inherentScore} /> },
    { id: 'residual', header: 'RESIDUAL', cell: ({ row: { original: r } }) => <LevelBadge level={r.residualLevel} score={r.residualScore} /> },
    { id: 'score', header: 'CURRENT', meta: { sortKey: 'score' }, cell: ({ row: { original: r } }) => <LevelBadge level={r.currentLevel} score={r.currentScore} /> },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: r } }) => <Badge tone={r.status === 'Closed' ? 'green' : r.status === 'Mitigating' ? 'amber' : 'indigo'}>{r.status}</Badge> },
    { id: 'review', header: 'REVIEW', meta: { sortKey: 'reviewDate' }, cell: ({ row: { original: r } }) => <span className={r.reviewOverdue ? 'negative' : ''}>{fmtDate(r.reviewDate)}{r.reviewOverdue ? ' · overdue' : ''}</span> },
    { id: 'open', header: '', cell: ({ row: { original: r } }) => <button className="icon-btn" aria-label={`Open ${r.id}`} onClick={() => setEditing(r)}><Icon name="arrow" /></button> },
  ], []);

  const s = summary.data;
  const hot = s ? s.byLevel.Extreme + s.byLevel.High : 0;
  return (
    <>
      <PageHead title="Risk register" desc={`Risks scored on the ${s?.heatmap.version ?? 'v1'} 5×5 matrix; residual scores replace inherent ones once recorded.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${qs({ q, category: f.category, level: f.level, status: f.status })}`, 'risk-register.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New risk</Btn>}
        </>} />
      <div className="stats">
        <Stat label="Active risks" value={s?.active ?? '—'} foot={`${s?.total ?? '—'} in the register`} icon="risk" />
        <Stat label="High or extreme" value={s ? hot : '—'} foot={<span className={hot ? 'negative' : ''}>{s?.byLevel.Extreme ?? 0} extreme · {s?.byLevel.High ?? 0} high</span>} icon="flag" />
        <Stat label="Mitigating" value={s?.byStatus.Mitigating ?? '—'} foot="Actions under way" icon="shield" />
        <Stat label="Reviews overdue" value={s?.reviewOverdue ?? '—'} foot="Review date before the cut-off" icon="clock" />
        <Stat label="Extreme" value={s?.byLevel.Extreme ?? '—'} foot="Highest current severity" icon="flag" />
        <Stat label="Closed" value={s?.byStatus.Closed ?? '—'} foot="Risks resolved in the register" icon="check" />
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <div><h2>Heatmap</h2><p>Active risks by likelihood and impact · {view === 'current' ? 'current (residual where set)' : 'inherent'}</p></div>
          <div className="actions"><Btn kind={`small ${view === 'current' ? 'primary' : ''}`} onClick={() => setView('current')}>Current</Btn><Btn kind={`small ${view === 'inherent' ? 'primary' : ''}`} onClick={() => setView('inherent')}>Inherent</Btn></div>
        </div>
        {s ? <Heatmap data={s.heatmap} grid={view === 'current' ? s.heatmap.current : s.heatmap.inherent} /> : <div className="empty">Loading…</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><div><h2>Risks</h2><p>Select a risk to review or edit it</p></div><span className="tiny muted">{page.data?.total ?? '…'} risks</span></div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, title, owner or text…" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search risks" /></label>
          <div className="filter-group">
            <select className="filter" aria-label="Filter by category" value={f.category} onChange={e => set({ category: e.target.value })}><option value="">All categories</option>{RISK_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            <select className="filter" aria-label="Filter by level" value={f.level} onChange={e => set({ level: e.target.value })}><option value="">All levels</option>{(['Extreme', 'High', 'Medium', 'Low'] as const).map(l => <option key={l}>{l}</option>)}</select>
            <select className="filter" aria-label="Filter by status" value={f.status} onChange={e => set({ status: e.target.value })}><option value="">All statuses</option>{RISK_STATUSES.map(x => <option key={x}>{x}</option>)}</select>
            <Btn kind="small" onClick={() => set({ q: '', category: '', level: '', status: '' })}>Clear</Btn>
          </div>
        </div>
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={f} onSort={sortBy} empty={page.data && !page.data.total && !s?.total ? 'No risks recorded yet.' : 'No risks match. Change the search or filters.'} />
            <Pager page={f.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => set({ page: p })} />
          </>
        )}
      </div>

      {editing && <RiskForm risk={editing === 'new' ? null : editing} base={base} canWrite={access.canWrite} canDelete={access.canManage} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} onDelete={r => { setEditing(null); setRemoving(r); }} />}
      {removing && (
        <Confirm title={`Delete ${removing.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate(removing.id)} onClose={() => setRemoving(null)}>
          <p>“{removing.title}” will be removed from the register. This cannot be undone. Consider setting its status to Closed instead.</p>
        </Confirm>
      )}
    </>
  );
}

function Heatmap({ data, grid }: { data: RiskSummary['heatmap']; grid: number[][] }) {
  // rows: likelihood 5 (top) .. 1; columns: impact 1 .. 5
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="table" aria-label="Risk heatmap">
        {[5, 4, 3, 2, 1].map(l => (
          <div className="heat-row" role="row" key={l}>
            <div className="heat-axis" role="rowheader">{l} · {data.likelihoodLabels[l - 1]}</div>
            {[1, 2, 3, 4, 5].map(i => {
              const level = levelOf(l * i)!;
              const n = grid[l - 1][i - 1];
              return <div key={i} role="cell" className={`heat-cell level-${level.toLowerCase()} ${n ? 'has' : ''}`} title={`Likelihood ${l} × impact ${i} = ${l * i} (${level}): ${n} risk${n === 1 ? '' : 's'}`}>{n || ''}</div>;
            })}
          </div>
        ))}
        <div className="heat-row">
          <div className="heat-axis" />
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="heat-axis heat-col">{i} · {data.impactLabels[i - 1]}</div>)}
        </div>
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {(['Low', 'Medium', 'High', 'Extreme'] as const).map(l => <span key={l}><span className={`dot level-${l.toLowerCase()}`} />{l}</span>)}
        <span className="tiny muted">Likelihood ↑ · impact →</span>
      </div>
    </div>
  );
}

const scoreOptions = [1, 2, 3, 4, 5];

function RiskForm({ risk, base, canWrite, canDelete, onClose, onSaved, onDelete }: {
  risk: Risk | null; base: string; canWrite: boolean; canDelete: boolean; onClose: () => void; onSaved: () => void; onDelete: (r: Risk) => void;
}) {
  const { project } = useApp();
  const toast = useToast();
  const [v, setV] = useState({
    title: risk?.title ?? '', category: risk?.category ?? 'Schedule', owner: risk?.owner ?? '',
    cause: risk?.cause ?? '', event: risk?.event ?? '', effect: risk?.effect ?? '',
    likelihood: risk?.likelihood ?? 3, impact: risk?.impact ?? 3,
    residualLikelihood: risk?.residualLikelihood ?? null as number | null, residualImpact: risk?.residualImpact ?? null as number | null,
    mitigation: risk?.mitigation ?? '', trigger: risk?.trigger ?? '', reviewDate: risk?.reviewDate ?? '', status: (risk?.status ?? 'Open') as RiskStatus, milestoneId: risk?.milestoneId ?? '',
  });
  const [error, setError] = useState('');
  const milestones = useQuery({ queryKey: ['milestone-options', project.id], queryFn: () => request<Page<Milestone>>(`/projects/${project.id}/milestones?pageSize=200`), staleTime: 60_000 });
  const up = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(s => ({ ...s, [k]: val }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...v, cause: v.cause || null, event: v.event || null, effect: v.effect || null, mitigation: v.mitigation || null, trigger: v.trigger || null,
        reviewDate: v.reviewDate || null, milestoneId: v.milestoneId || null,
      };
      return risk ? request<Risk>(`${base}/${risk.id}`, { method: 'PATCH', body: JSON.stringify(body) }) : request<Risk>(base, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => { toast(risk ? 'Risk updated.' : 'Risk created.'); onSaved(); },
    onError: (e: Error) => setError(errorText(e)),
  });

  const inherent = scoreOf(v.likelihood, v.impact);
  const residual = scoreOf(v.residualLikelihood, v.residualImpact);
  const readOnly = !canWrite;
  const half = (v.residualLikelihood == null) !== (v.residualImpact == null);

  return (
    <Modal title={risk ? `${risk.id} · Risk` : 'New risk'} onClose={onClose}
      actions={<>
        {risk && canDelete && <Btn kind="text" onClick={() => onDelete(risk)}>Delete</Btn>}
        <Btn onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Btn>
        {!readOnly && <Btn kind="primary" disabled={save.isPending || !v.title.trim() || !v.owner.trim() || half} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>}
      </>}>
      <div className="dialog-body">
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <Field label="Title" full><input value={v.title} maxLength={160} onChange={e => up('title', e.target.value)} autoFocus /></Field>
            <Field label="Category"><select value={v.category} onChange={e => up('category', e.target.value)}>{RISK_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Owner"><input value={v.owner} maxLength={120} onChange={e => up('owner', e.target.value)} /></Field>
            <Field label="Cause" full><textarea value={v.cause} maxLength={1000} onChange={e => up('cause', e.target.value)} /></Field>
            <Field label="Risk event" full><textarea value={v.event} maxLength={1000} onChange={e => up('event', e.target.value)} /></Field>
            <Field label="Effect" full><textarea value={v.effect} maxLength={1000} onChange={e => up('effect', e.target.value)} /></Field>
            <Field label="Likelihood (1–5)"><select value={v.likelihood} onChange={e => up('likelihood', Number(e.target.value))}>{scoreOptions.map(n => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Impact (1–5)"><select value={v.impact} onChange={e => up('impact', Number(e.target.value))}>{scoreOptions.map(n => <option key={n}>{n}</option>)}</select></Field>
            <div className="field full"><small className="muted">Inherent score</small><LevelBadge level={levelOf(inherent)} score={inherent} /></div>
            <Field label="Mitigation" full><textarea value={v.mitigation} maxLength={2000} onChange={e => up('mitigation', e.target.value)} /></Field>
            <Field label="Residual likelihood" hint="After mitigation; leave both blank until assessed">
              <select value={v.residualLikelihood ?? ''} onChange={e => up('residualLikelihood', e.target.value ? Number(e.target.value) : null)}><option value="">Not assessed</option>{scoreOptions.map(n => <option key={n}>{n}</option>)}</select>
            </Field>
            <Field label="Residual impact">
              <select value={v.residualImpact ?? ''} onChange={e => up('residualImpact', e.target.value ? Number(e.target.value) : null)}><option value="">Not assessed</option>{scoreOptions.map(n => <option key={n}>{n}</option>)}</select>
            </Field>
            {(residual != null || half) && <div className="field full"><small className="muted">Residual score</small>{half ? <span className="negative tiny">Give both residual values, or neither.</span> : <LevelBadge level={levelOf(residual)} score={residual} />}</div>}
            <Field label="Trigger" full hint="What would tell you the risk is about to happen"><input value={v.trigger} maxLength={500} onChange={e => up('trigger', e.target.value)} /></Field>
            <Field label="Next review"><input type="date" value={v.reviewDate} onChange={e => up('reviewDate', e.target.value)} /></Field>
            <Field label="Status"><select value={v.status} onChange={e => up('status', e.target.value as RiskStatus)}>{RISK_STATUSES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Linked milestone" full>
              <select value={v.milestoneId} onChange={e => up('milestoneId', e.target.value)}>
                <option value="">None</option>
                {milestones.data?.items.map(m => <option key={m.id} value={m.id}>{m.id} · {m.description}{m.subName ? ` (${m.subName})` : ''}</option>)}
              </select>
            </Field>
          </div>
        </fieldset>
        {readOnly && <p className="tiny muted" style={{ marginTop: 14 }}>Your role is read-only in this project.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
