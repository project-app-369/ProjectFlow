import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { downloadCsv, errorText, request, RISK_STATUSES, type Insights, type Milestone, type Page, type Risk, type RiskHeatmap, type RiskMatrix, type RiskOptions } from '../api';
import { DataTable } from '../DataTable';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { FilterChips, InsightsView, usePick } from '../Insights';
import { useListState } from '../Register';
import { useAccess, useApp, useToast } from '../state';
import { Btn, Confirm, ErrorBox, Field, Modal, PageHead, Pager } from '../ui';
import { Detail, IconFilter, LevelPill, People } from './governance';

const PAGE_SIZE = 50;
const STATUS_ICON: Record<string, string> = { New: 'status-backlog', Firmed: 'status-planned', 'Under assessment': 'search', 'Under resolving': 'status-ongoing', Monitor: 'shield', Closed: 'status-completed' };
const FLAGS: [string, string][] = [['active', 'Active only'], ['response-overdue', 'Response overdue'], ['review-overdue', 'Review overdue'], ['awaiting-post', 'Awaiting post-mitigation'], ['unrated', 'Not rated'], ['external', 'External']];
const DIMENSIONS = ['Schedule', 'Cost', 'Scope', 'Quality'] as const;

interface RiskPage extends Page<Risk> { facets: Page<Risk>['facets'] & { levels: string[]; owners: string[]; categories: string[]; strategies: string[] } }

/** Level of a probability x severity cell on the project's matrix, used to preview a rating while typing. */
const levelAt = (m: RiskMatrix | undefined, p: number | null, s: number | null) => (m && p && s ? m.cells[p - 1]?.[s - 1] ?? null : null);

/** Governance → Management → Risks: the project's register on its own matrix, rated per impact before and after mitigation. */
export default function Risks() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const list = useListState();
  const filter = usePick(list, { level: '', owner: '', flag: '', within: '', cell: '', basis: '', category: '' });
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [basis, setBasis] = useState<'current' | 'pre'>('current');
  const base = `/projects/${project.id}/risks`;

  const insights = useQuery({ queryKey: ['insights', 'risks', project.id], queryFn: () => request<Insights>(`${base}/insights`) });
  const heat = useQuery({ queryKey: ['risk-heatmap', project.id], queryFn: () => request<RiskHeatmap>(`${base}/heatmap`) });
  const extra = { ...filter.extra };
  const query = list.query({ page: list.state.page, pageSize: PAGE_SIZE, ...extra });
  const page = useQuery({ queryKey: ['risks', project.id, query], queryFn: () => request<RiskPage>(`${base}${query}`), placeholderData: keepPreviousData });
  const facets = page.data?.facets;
  const setExtra = (k: keyof typeof extra, v: string) => { filter.setExtra(s => ({ ...s, [k]: v })); list.set({}); };
  const pickCell = (p: number, s: number) => {
    const cell = `${p}-${s}`;
    const on = filter.extra.cell === cell && filter.extra.basis === basis;
    filter.setExtra(x => ({ ...x, cell: on ? '' : cell, basis: on ? '' : basis }));
    list.set({});
  };

  const columns = useMemo<ColumnDef<Risk>[]>(() => [
    {
      id: 'title', header: 'RISK', meta: { sortKey: 'no' },
      cell: ({ row: { original: r } }) => (
        <button className="link-button" onClick={() => setOpen(r.id)}>
          <strong style={{ display: 'block', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</strong>
          <small className="muted"><span className="mono">{r.id}</span>{r.discipline ? ` · ${r.discipline}` : ''}{r.external ? ' · External' : ''}</small>
        </button>
      ),
    },
    {
      id: 'level', header: 'LEVEL', meta: { sortKey: 'currentRank' },
      cell: ({ row: { original: r } }) => (
        <span className="risk-shift" title={`Before mitigation: ${r.preLevel ?? 'not rated'}${r.preScore ? ` (${r.preScore})` : ''}${r.preWorst.length ? `, worst on ${r.preWorst.join(', ').toLowerCase()}` : ''}\nNow: ${r.currentLevel ?? 'not rated'}${r.currentScore ? ` (${r.currentScore})` : ''}`}>
          {r.postLevel ? <><LevelPill level={r.preLevel} /><span className="muted">→</span><LevelPill level={r.postLevel} score={r.postScore} /></> : <LevelPill level={r.preLevel} score={r.preScore} />}
        </span>
      ),
    },
    { id: 'owner', header: 'OWNER', meta: { sortKey: 'owner' }, cell: ({ row: { original: r } }) => <People names={r.owners} empty="No owner" /> },
    {
      id: 'response', header: 'RESPONSE', meta: { sortKey: 'planDate' },
      cell: ({ row: { original: r } }) => r.actualDate
        ? <span className="task-meta-item positive" title={`Actions taken ${fmtDate(r.actualDate)}`}><Icon name="tick" />{fmtDate(r.actualDate)}</span>
        : r.planDate ? <span className={`task-meta-item ${r.responseOverdue ? 'negative' : ''}`} title={r.responseOverdue ? 'Plan action date passed' : 'Plan action date'}><Icon name="calendar" />{fmtDate(r.planDate)}</span>
        : <span className="muted">—</span>,
    },
    { id: 'actions', header: '', cell: ({ row: { original: r } }) => (r.actionsTotal ? <span className={`issue-sub ${r.actionsOverdue ? 'negative' : ''}`} title={`${r.actionsDone} of ${r.actionsTotal} actions done${r.actionsOverdue ? `, ${r.actionsOverdue} overdue` : ''}`}><Icon name="status-completed" />{r.actionsDone}/{r.actionsTotal}</span> : null) },
    { id: 'status', header: 'STATUS', meta: { sortKey: 'status' }, cell: ({ row: { original: r } }) => <span className="issue-icon" title={r.status}><Icon name={STATUS_ICON[r.status] ?? 'status-backlog'} /><span className="sr-only">{r.status}</span></span> },
  ], []);

  return (
    <>
      <PageHead title="Risk register" desc={`${heat.data?.matrix.version ?? 'Project matrix'}: probability × worst impact (schedule, cost, scope, quality). The post-mitigation rating, once recorded, is the current one.`}
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv${list.query(extra)}`, 'risk-register.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpen('new')}>New risk</Btn>}
        </>} />
      <InsightsView compact data={insights.data} error={insights.error} onFilter={filter.pick} active={filter.isOn} />

      <section className="panel ins-panel compact">
        <div className="panel-head">
          <div><h2 title="Active risks by probability and worst impact. Select a cell to filter the register.">Heatmap · {basis === 'current' ? 'now' : 'before mitigation'}</h2></div>
          <div className="seg" role="group" aria-label="Heatmap basis">
            <button type="button" className={basis === 'current' ? 'on' : ''} aria-pressed={basis === 'current'} onClick={() => setBasis('current')}>Now</button>
            <button type="button" className={basis === 'pre' ? 'on' : ''} aria-pressed={basis === 'pre'} onClick={() => setBasis('pre')}>Before</button>
          </div>
        </div>
        {heat.error ? <ErrorBox error={heat.error} /> : heat.data ? <Heatmap data={heat.data} basis={basis} active={filter.extra.basis === basis ? filter.extra.cell : ''} onPick={pickCell} /> : <div className="empty">Loading…</div>}
      </section>

      <div className="panel">
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search id, title, cause, effect, owner, mitigation…" value={list.state.q} onChange={e => list.set({ q: e.target.value })} aria-label="Search risks" /></label>
          <div className="filter-group">
            <IconFilter icon={STATUS_ICON[list.state.status] ?? 'status-ongoing'} label="Filter by status" value={list.state.status} onChange={v => list.set({ status: v })}>
              <option value="">All statuses</option>{RISK_STATUSES.map(s => <option key={s}>{s}</option>)}
            </IconFilter>
            <IconFilter icon="flag" label="Filter by current level" value={filter.extra.level} onChange={v => setExtra('level', v)}>
              <option value="">All levels</option>{(facets?.levels ?? []).map(l => <option key={l}>{l}</option>)}
            </IconFilter>
            <IconFilter icon="layers" label="Filter by discipline (RBS)" value={list.state.discipline} onChange={v => list.set({ discipline: v })}>
              <option value="">All disciplines</option>{(facets?.disciplines ?? []).map(d => <option key={d}>{d}</option>)}
            </IconFilter>
            <IconFilter icon="people" label="Filter by owner" value={filter.extra.owner} onChange={v => setExtra('owner', v)}>
              <option value="">Every owner</option><option value="none">No owner</option>{(facets?.owners ?? []).map(o => <option key={o}>{o}</option>)}
            </IconFilter>
            <IconFilter icon="clock" label="Show risks that need attention" value={filter.extra.flag} onChange={v => setExtra('flag', v)}>
              <option value="">Any</option>{FLAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </IconFilter>
            <Btn kind="small" onClick={filter.reset}>Clear</Btn>
            <span className="tiny muted" aria-live="polite">{page.data?.total ?? '…'} risks</span>
          </div>
        </div>
        <FilterChips chips={filter.chips.filter(([k]) => !['level', 'owner', 'flag', 'basis'].includes(k)).map(([k, v]) => (k === 'cell' ? [k, cellLabel(heat.data?.matrix, v, filter.extra.basis)] : [k, v]))} onClear={filter.reset} />
        {page.error ? <ErrorBox error={page.error} /> : (
          <>
            <DataTable columns={columns} data={page.data?.items ?? []} state={list.state} onSort={list.toggleSort} empty="No risk matches. Change the search or filters." />
            <Pager page={list.state.page} pageSize={PAGE_SIZE} total={page.data?.total ?? 0} onPage={p => list.set({ page: p })} />
          </>
        )}
      </div>
      {open && <RiskDrawer base={base} id={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </>
  );
}

const cellLabel = (m: RiskMatrix | undefined, cell: string, basis: string) => {
  const [p, s] = cell.split('-').map(Number);
  return m ? `${m.probabilityLabels[p - 1]} × ${m.severityLabels[s - 1]}${basis === 'pre' ? ' (before)' : ''}` : cell;
};

/** The project's matrix with the number of active risks per cell; rows run from the most to the least probable. */
function Heatmap({ data, basis, active, onPick }: { data: RiskHeatmap; basis: 'current' | 'pre'; active: string; onPick: (p: number, s: number) => void }) {
  const m = data.matrix;
  const grid = basis === 'current' ? data.current : data.pre;
  const cols = { gridTemplateColumns: `7.5rem repeat(${m.severityLabels.length}, minmax(3rem, 1fr))` };
  const ps = m.probabilityLabels.map((_, i) => m.probabilityLabels.length - i);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap compact" role="table" aria-label="Risk heatmap">
        {ps.map(p => (
          <div className="heat-row" role="row" key={p} style={cols}>
            <div className="heat-axis" role="rowheader">{p} · {m.probabilityLabels[p - 1]}</div>
            {m.severityLabels.map((_, i) => {
              const s = i + 1, level = m.cells[p - 1][i], n = grid[p - 1][i];
              const on = active === `${p}-${s}`;
              return (
                <button key={s} type="button" role="cell" disabled={!n} aria-pressed={on} onClick={() => onPick(p, s)}
                  className={`heat-cell level-${level.toLowerCase()} ${n ? 'has' : ''} ${on ? 'on' : ''}`}
                  title={`${m.probabilityLabels[p - 1]} × ${m.severityLabels[i]} = ${p * s} (${level}): ${n} active risk${n === 1 ? '' : 's'}`}>{n || ''}</button>
              );
            })}
          </div>
        ))}
        <div className="heat-row" style={cols}>
          <div className="heat-axis" />
          {m.severityLabels.map((l, i) => <div key={l} className="heat-axis heat-col">{i + 1} · {l}</div>)}
        </div>
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        {[...m.levels].reverse().map(l => <span key={l}><span className={`dot level-${l.toLowerCase()}`} />{l}</span>)}
        <span className="tiny muted">Probability ↑ · worst impact →{data.unrated ? ` · ${data.unrated} active not rated` : ''}</span>
      </div>
    </div>
  );
}

/* ============================ drawer ============================ */
type Form = Record<string, string | number | boolean | null>;
const blank = (r?: Risk): Form => ({
  title: r?.title ?? '', rbs: r?.rbs ?? '', owner: r?.owner ?? '', status: r?.status ?? 'New', recordDate: r?.recordDate ?? '', external: r?.external ?? false,
  description: r?.description ?? '', cause: r?.cause ?? '', effect: r?.effect ?? '', strategy: r?.strategy ?? '',
  mitigationCause: r?.mitigationCause ?? '', mitigationEffect: r?.mitigationEffect ?? '', planDate: r?.planDate ?? '', actualActions: r?.actualActions ?? '', actualDate: r?.actualDate ?? '',
  reviewDate: r?.reviewDate ?? '', milestoneId: r?.milestoneId ?? '', remark: r?.remark ?? '',
  ...Object.fromEntries((['pre', 'post'] as const).flatMap(p => [[`${p}Probability`, r?.[`${p}Probability`] ?? null], ...DIMENSIONS.map(d => [`${p}${d}`, (r?.[`${p}${d}` as keyof Risk] as number | null) ?? null])])),
});

/** One risk in a panel from the right: identification, ratings before and after mitigation, the response and its actions. */
function RiskDrawer({ base, id, onClose }: { base: string; id: string | null; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['risk', base, id], enabled: !!id, queryFn: () => request<Risk>(`${base}/${id}`) });
  if (id && !detail.data) {
    return <Modal title={id} size="lg" onClose={onClose} actions={<Btn onClick={onClose}>Close</Btn>}><div className="dialog-body">{detail.error ? <p className="negative">{errorText(detail.error)}</p> : <p className="muted">Loading…</p>}</div></Modal>;
  }
  return <RiskForm key={detail.data?.updatedAt ?? 'new'} risk={id ? detail.data : undefined} base={base} onClose={onClose} />;
}

function RiskForm({ risk, base, onClose }: { risk?: Risk; base: string; onClose: () => void }) {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState<Form>(() => blank(risk));
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const opts = useQuery({ queryKey: ['risk-options', project.id], queryFn: () => request<RiskOptions>(`${base}/options`), staleTime: 60_000 });
  const milestones = useQuery({ queryKey: ['milestone-options', project.id], queryFn: () => request<Page<Milestone>>(`/projects/${project.id}/milestones?pageSize=200`), staleTime: 60_000 });
  const m = opts.data?.matrix;
  const up = (k: string, val: Form[string]) => setV(s => ({ ...s, [k]: val }));
  const readOnly = !access.canWrite;
  const refresh = () => Promise.all(['risks', 'risk', 'insights', 'risk-heatmap', 'dashboard'].map(k => qc.invalidateQueries({ queryKey: [k] })));

  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? null : val]));
      return risk ? request<Risk>(`${base}/${risk.id}`, { method: 'PATCH', body: JSON.stringify(body) }) : request<Risk>(base, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: r => { refresh(); toast(risk ? 'Risk saved.' : `Risk ${r.id} created.`); if (!risk) onClose(); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/${risk!.id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast('Risk deleted.'); onClose(); }, onError: (e: Error) => { setRemoving(false); setError(errorText(e)); },
  });

  const rating = (p: 'pre' | 'post') => {
    const prob = v[`${p}Probability`] as number | null;
    const dims = DIMENSIONS.map(d => v[`${p}${d}`] as number | null).filter((n): n is number => n != null);
    const sev = dims.length ? Math.max(...dims) : null;
    return { level: levelAt(m, prob, sev), score: prob && sev ? prob * sev : null };
  };
  const groups = useMemo(() => {
    const g = new Map<string, RiskOptions['breakdown']>();
    for (const b of opts.data?.breakdown ?? []) g.set(b.categoryName, [...(g.get(b.categoryName) ?? []), b]);
    return [...g.entries()];
  }, [opts.data]);

  return (
    <>
      <Modal title={risk ? `${risk.id} · Risk` : 'New risk'} size="lg" onClose={onClose}
        actions={<>
          {risk && access.canManage && <Btn kind="text" onClick={() => setRemoving(true)}>Delete</Btn>}
          <Btn onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Btn>
          {!readOnly && <Btn kind="primary" disabled={save.isPending || !String(v.title).trim() || !v.rbs || !String(v.owner).trim()} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>}
        </>}>
        <div className="dialog-body">
          {risk && (
            <div className="drawer-intro">
              <div className="eyebrow">{risk.category}{risk.discipline ? ` · ${risk.discipline}` : ''}</div>
              <h1>{risk.title}</h1>
              <span className="risk-shift"><LevelPill level={risk.preLevel} score={risk.preScore} title="Before mitigation" />{risk.postLevel && <><span className="muted">→</span><LevelPill level={risk.postLevel} score={risk.postScore} title="After mitigation" /></>}</span>
              {' '}<span className="tiny muted">{risk.status}{risk.responseOverdue ? ' · response overdue' : ''}{risk.reviewOverdue ? ' · review overdue' : ''}</span>
            </div>
          )}
          <fieldset disabled={readOnly} className="plain-fieldset">
            <h3>Identification</h3>
            <div className="form-grid">
              <Field label="Title" full><input value={String(v.title)} maxLength={200} onChange={e => up('title', e.target.value)} autoFocus={!risk} /></Field>
              <Field label="RBS discipline" hint="Category and discipline of the risk breakdown structure">
                <select value={String(v.rbs)} onChange={e => up('rbs', e.target.value)}>
                  <option value="">Choose…</option>
                  {groups.map(([cat, items]) => <optgroup key={cat} label={cat}>{items.map(b => <option key={b.code} value={b.code}>{b.code} · {b.disciplineName}</option>)}</optgroup>)}
                  {v.rbs && !opts.data?.breakdown.some(b => b.code === v.rbs) && <option value={String(v.rbs)}>{String(v.rbs)}</option>}
                </select>
              </Field>
              <Field label="Owner" hint="Several owners: separate with /"><input value={String(v.owner)} maxLength={120} list="risk-owners" onChange={e => up('owner', e.target.value)} /><datalist id="risk-owners">{opts.data?.owners.map(o => <option key={o} value={o} />)}</datalist></Field>
              <Field label="Status"><select value={String(v.status)} onChange={e => up('status', e.target.value)}>{RISK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Record date"><input type="date" value={String(v.recordDate ?? '')} onChange={e => up('recordDate', e.target.value)} /></Field>
              <Field label="Description" full><textarea value={String(v.description)} maxLength={3000} onChange={e => up('description', e.target.value)} /></Field>
              <Field label="Possible cause"><textarea value={String(v.cause)} maxLength={3000} onChange={e => up('cause', e.target.value)} /></Field>
              <Field label="Possible effect"><textarea value={String(v.effect)} maxLength={3000} onChange={e => up('effect', e.target.value)} /></Field>
              <label className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!v.external} onChange={e => up('external', e.target.checked)} />External risk (raised to the client)</label>
            </div>

            <h3>Assessment</h3>
            <div className="rating-grid">
              {(['pre', 'post'] as const).map(p => {
                const r = rating(p);
                return (
                  <div key={p} className="rating-card">
                    <div className="rating-head"><strong>{p === 'pre' ? 'Before mitigation' : 'After mitigation'}</strong><LevelPill level={r.level} score={r.score} /></div>
                    <Field label="Probability">
                      <select value={String(v[`${p}Probability`] ?? '')} onChange={e => up(`${p}Probability`, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Not rated</option>{m?.probabilityLabels.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
                      </select>
                    </Field>
                    {DIMENSIONS.map(d => (
                      <Field key={d} label={`${d} impact`}>
                        <select value={String(v[`${p}${d}`] ?? '')} onChange={e => up(`${p}${d}`, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">Not rated</option>{m?.severityLabels.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
                        </select>
                      </Field>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="tiny muted">The worst of the four impacts is the severity; probability × severity places the risk on the {m?.version ?? 'matrix'}.</p>

            <h3>Response</h3>
            <div className="form-grid">
              <Field label="Strategy"><select value={String(v.strategy ?? '')} onChange={e => up('strategy', e.target.value)}><option value="">Not chosen</option>{opts.data?.strategies.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Plan action date"><input type="date" value={String(v.planDate ?? '')} onChange={e => up('planDate', e.target.value)} /></Field>
              <Field label="Mitigation of cause"><textarea value={String(v.mitigationCause)} maxLength={3000} onChange={e => up('mitigationCause', e.target.value)} /></Field>
              <Field label="Mitigation of effect"><textarea value={String(v.mitigationEffect)} maxLength={3000} onChange={e => up('mitigationEffect', e.target.value)} /></Field>
              <Field label="Actual actions"><textarea value={String(v.actualActions)} maxLength={3000} onChange={e => up('actualActions', e.target.value)} /></Field>
              <Field label="Actual action date"><input type="date" value={String(v.actualDate ?? '')} onChange={e => up('actualDate', e.target.value)} /></Field>
              <Field label="Next review"><input type="date" value={String(v.reviewDate ?? '')} onChange={e => up('reviewDate', e.target.value)} /></Field>
              <Field label="Linked milestone">
                <select value={String(v.milestoneId ?? '')} onChange={e => up('milestoneId', e.target.value)}>
                  <option value="">None</option>{milestones.data?.items.map(ms => <option key={ms.id} value={ms.id}>{ms.id} · {ms.description}</option>)}
                </select>
              </Field>
              <Field label="Remark" full hint="Required to close a risk without recorded actions"><textarea value={String(v.remark)} maxLength={2000} onChange={e => up('remark', e.target.value)} /></Field>
            </div>
          </fieldset>
          {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          {risk && <RiskActions risk={risk} base={base} canWrite={access.canWrite} onChange={refresh} />}
          {risk && readOnly && <div className="detail-grid"><Detail label="Created by">{risk.createdBy}</Detail><Detail label="Milestone">{risk.milestone}</Detail></div>}
        </div>
      </Modal>
      {removing && risk && (
        <Confirm title={`Delete ${risk.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setRemoving(false)}>
          <p>“{risk.title}” and its actions will be removed from the register. This cannot be undone. Consider setting its status to Closed instead.</p>
        </Confirm>
      )}
    </>
  );
}

/** Mitigation actions: each with an owner and a due date, ticked off when done. */
function RiskActions({ risk, base, canWrite, onChange }: { risk: Risk; base: string; canWrite: boolean; onChange: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({ action: '', owner: '', dueDate: '' });
  const path = `${base}/${risk.id}/actions`;
  const run = useMutation({
    mutationFn: ({ method, url, body }: { method: string; url: string; body?: unknown }) => request<Risk>(url, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => onChange(), onError: (e: Error) => toast(errorText(e)),
  });
  const actions = risk.actions ?? [];
  return (
    <section style={{ marginTop: 18 }}>
      <h3>Actions <span className="count">{risk.actionsDone}/{risk.actionsTotal} done</span></h3>
      {actions.length ? (
        <ul className="subtask-list">
          {actions.map(a => (
            <li key={a.id} className={`subtask ${a.done ? "done" : ""}`}>
              <input type="checkbox" checked={a.done} disabled={!canWrite || run.isPending} aria-label={`Mark "${a.action}" ${a.done ? 'not done' : 'done'}`} onChange={e => run.mutate({ method: 'PATCH', url: `${path}/${a.id}`, body: { done: e.target.checked } })} />
              <span className="grow"><strong style={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>{a.action}</strong></span>
              {a.owner && <span className="tiny muted" title="Owner">{a.owner}</span>}
              {a.dueDate && <span className={`tiny ${a.overdue ? 'negative' : 'muted'}`} title={a.done && a.doneDate ? `Done ${fmtDate(a.doneDate)}` : 'Due'}><Icon name="calendar" /> {fmtDate(a.dueDate)}</span>}
              {canWrite && <button className="icon-btn" aria-label={`Remove action ${a.id}`} title="Remove" onClick={() => run.mutate({ method: 'DELETE', url: `${path}/${a.id}` })}><Icon name="close" /></button>}
            </li>
          ))}
        </ul>
      ) : <p className="tiny muted">No actions yet. Break the response into actions with an owner and a due date to track it.</p>}
      {canWrite && (
        <form className="subtask-add" onSubmit={e => { e.preventDefault(); run.mutate({ method: 'POST', url: path, body: { action: draft.action, owner: draft.owner || null, dueDate: draft.dueDate || null } }, { onSuccess: () => setDraft({ action: '', owner: '', dueDate: '' }) }); }}>
          <input placeholder="New action" aria-label="New action" value={draft.action} maxLength={1000} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} />
          <input placeholder="Owner" aria-label="Action owner" value={draft.owner} maxLength={120} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} style={{ maxWidth: 160 }} />
          <input type="date" aria-label="Action due date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={{ maxWidth: 160 }} />
          <Btn kind="small" icon="plus" type="submit" disabled={!draft.action.trim() || run.isPending}>Add</Btn>
        </form>
      )}
    </section>
  );
}
