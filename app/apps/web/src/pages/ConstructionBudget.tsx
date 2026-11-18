import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useMemo, useState } from 'react';
import { downloadCsv, errorText, request, type BudgetHistogram, type BudgetInput, type BudgetResponse, type WbsNode } from '../api';
import { fmtDate, fmtShort } from '../format';
import { Icon } from '../icons';
import { useAccess, useApp, useToast } from '../state';
import { Btn, Confirm, ErrorBox, Field, Loading, Modal, PageHead, Stat } from '../ui';
import { parseBudgetImport } from './budgetImport';
import { lazyPage } from '../lazyPage';

const BudgetHistogramChart = lazyPage(() => import('../BudgetHistogramChart'));
const hrs = (n: number) => `${n.toLocaleString('en-GB', { maximumFractionDigits: 1 })} h`;

/** Construction → Budget: manhour budget per WBS activity, and when those hours fall. */
export default function ConstructionBudget() {
  const { project } = useApp();
  const access = useAccess();
  const toast = useToast();
  const base = `/projects/${project.id}/construction/budget`;
  const [by, setBy] = useState<'week' | 'month'>('week');
  const [group, setGroup] = useState<'wbs' | 'discipline'>('wbs');
  const [editing, setEditing] = useState<{ node: WbsNode | null; parent?: string | null } | null>(null);
  const [removing, setRemoving] = useState<WbsNode | null>(null);
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const budget = useQuery({ queryKey: ['budget', project.id], queryFn: () => request<BudgetResponse>(base) });
  const histogram = useQuery({ queryKey: ['budget-histogram', project.id, by, group], queryFn: () => request<BudgetHistogram>(`${base}/histogram?by=${by}&group=${group}`) });
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['budget', project.id] }), qc.invalidateQueries({ queryKey: ['budget-histogram', project.id] })]);
  const remove = useMutation({
    mutationFn: (wbs: string) => request<void>(`${base}/${encodeURIComponent(wbs)}`, { method: 'DELETE' }),
    onSuccess: () => { setRemoving(null); refresh(); toast('Activity removed.'); },
    onError: (e: Error) => { setRemoving(null); toast(errorText(e)); },
  });

  const items = budget.data?.items ?? [];
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q) return items.filter(n => [n.wbs, n.name, n.discipline].some(x => x?.toLowerCase().includes(q)));
    const out: WbsNode[] = [];
    let hideBelow = Infinity;
    for (const n of items) {
      if (n.level > hideBelow) continue;
      hideBelow = Infinity;
      out.push(n);
      if (collapsed.has(n.wbs)) hideBelow = n.level;
    }
    return out;
  }, [items, collapsed, filter]);

  const s = budget.data?.summary;
  const h = histogram.data;
  const total = s?.totalHours || 1;
  const toggle = (wbs: string) => setCollapsed(c => { const n = new Set(c); if (n.has(wbs)) n.delete(wbs); else n.add(wbs); return n; });

  return (
    <>
      <PageHead title="Construction budget" desc="Manhours budgeted per activity of the work breakdown structure (WBS), rolled up to each level, and spread over the planned dates."
        actions={<>
          <Btn kind="small" icon="down" onClick={() => downloadCsv(`${base}.csv`, 'construction-budget.csv').catch(e => toast(e.message))}>Export CSV</Btn>
          {access.canWrite && <Btn kind="small" onClick={() => setImporting(true)}>Import WBS</Btn>}
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setEditing({ node: null })}>Add activity</Btn>}
        </>} />
      <div className="stats">
        <Stat label="Budget" value={s ? hrs(s.totalHours) : '—'} foot={`${s?.activities ?? '—'} activities`} icon="layers" />
        <Stat label="Scheduled" value={s ? hrs(s.scheduledHours) : '—'} foot="Activities with start and finish" icon="calendar" />
        <Stat label="Not scheduled" value={s ? hrs(s.unscheduledHours) : '—'} foot={<span className={s?.unscheduledHours ? 'warning' : ''}>Add dates to see these in the histogram</span>} icon="clock" />
        <Stat label="Peak" value={h?.peak ? hrs(h.peak.hours) : '—'} foot={h?.peak ? `${by === 'week' ? 'Week' : 'Month'} of ${fmtShort(h.peak.start)}` : 'No scheduled hours yet'} icon="chart" />
        <Stat label="Spent" value={s?.actualHours != null ? hrs(s.actualHours) : '—'} foot={s?.progressPct != null ? `${s.progressPct}% of the budget earned` : 'No hours reported yet'} icon="clock" />
        <Stat label="Cost performance" value={s?.cpi ?? '—'} foot={s?.cpi == null ? 'Needs spent hours' : <span className={s.cpi >= 1 ? 'positive' : s.cpi >= 0.95 ? 'warning' : 'negative'}>Earned ÷ spent · {s.cpi >= 1 ? 'on or under budget' : 'over budget'}</span>} icon="chart" />
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <div><h2>Manhour histogram</h2><p>Each activity's hours are spread evenly across its planned start to finish{h && h.from ? ` · ${fmtShort(h.from)} – ${fmtDate(h.to)}` : ''}</p></div>
          <div className="actions">
            <Btn kind={`small ${by === 'week' ? 'primary' : ''}`} onClick={() => setBy('week')}>Week</Btn>
            <Btn kind={`small ${by === 'month' ? 'primary' : ''}`} onClick={() => setBy('month')}>Month</Btn>
            <select className="filter" aria-label="Stack by" value={group} onChange={e => setGroup(e.target.value as 'wbs' | 'discipline')}>
              <option value="wbs">Stack by WBS area</option><option value="discipline">Stack by discipline</option>
            </select>
          </div>
        </div>
        {histogram.error ? <ErrorBox error={histogram.error} /> : !h ? <Loading /> : !h.periods.length ? (
          <div className="empty">{s?.activities ? 'No activity has both a plan start and a plan finish yet, so there is nothing to spread over time.' : 'No budget yet. Add activities or import a WBS to see the histogram.'}</div>
        ) : (
          <>
            <Suspense fallback={<Loading label="Loading chart…" />}><BudgetHistogramChart data={h} /></Suspense>
            {(h.truncated || h.outsideHours > 0 || h.unscheduledHours > 0) && (
              <p className="tiny muted" style={{ padding: '0 22px 16px' }}>
                {h.unscheduledHours > 0 && `${hrs(h.unscheduledHours)} have no dates and are not shown. `}
                {h.truncated && 'The range is too long to show every period. '}
              </p>
            )}
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><h2>Work breakdown structure</h2><p>{s ? `${s.nodes} rows · ${s.activities} activities` : '…'}</p></div>
          <div className="actions">
            {!filter && items.some(n => !n.leaf) && <>
              <Btn kind="small" onClick={() => setCollapsed(new Set(items.filter(n => !n.leaf).map(n => n.wbs)))}>Collapse all</Btn>
              <Btn kind="small" onClick={() => setCollapsed(new Set())}>Expand all</Btn>
            </>}
          </div>
        </div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search WBS, activity or discipline…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Search the WBS" /></label>
        </div>
        {budget.error ? <ErrorBox error={budget.error} /> : budget.isPending ? <Loading /> : (
          <div className="table-wrap">
            <table className="wbs">
              <thead><tr><th>WBS</th><th>ACTIVITY</th><th>DISCIPLINE</th><th>PLAN</th><th style={{ textAlign: 'right' }}>BUDGET</th><th style={{ textAlign: 'right' }}>SPENT</th><th style={{ textAlign: 'right' }}>CPI</th><th>SHARE</th>{(access.canWrite || access.canManage) && <th />}</tr></thead>
              <tbody>
                {visible.map(n => (
                  <tr key={n.wbs} className={n.leaf ? '' : 'wbs-parent'}>
                    <td className="mono"><span style={{ paddingLeft: filter ? 0 : (n.level - 1) * 18 }}>
                      {!n.leaf && !filter ? <button type="button" className="tree-toggle" aria-label={`${collapsed.has(n.wbs) ? 'Expand' : 'Collapse'} ${n.wbs}`} aria-expanded={!collapsed.has(n.wbs)} onClick={() => toggle(n.wbs)}>{collapsed.has(n.wbs) ? '▸' : '▾'}</button> : <span className="tree-toggle" />}
                      {n.wbs}</span></td>
                    <td><strong style={{ fontWeight: n.leaf ? 500 : 700 }}>{n.name}</strong>{n.notes && <small className="muted" style={{ display: 'block', whiteSpace: 'normal' }}>{n.notes}</small>}</td>
                    <td>{n.discipline ?? <span className="tiny muted">—</span>}</td>
                    <td>{n.start || n.finish ? `${n.start ? fmtShort(n.start) : '…'} → ${n.finish ? fmtShort(n.finish) : '…'}` : <span className="tiny muted">—</span>}{n.leaf && n.ownHours > 0 && !(n.planStart && n.planFinish) && <span className="warning tiny"> · not in histogram</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono"><strong>{n.hours.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</strong>{!n.leaf && n.ownHours > 0 && <small className="warning" style={{ display: 'block' }} title="Hours typed on a row that has activities below it are ignored">own {n.ownHours} ignored</small>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{n.actualHours != null ? n.actualHours.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : <span className="tiny muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{n.actualHours && n.earnedHours != null ? <span className={n.earnedHours / n.actualHours >= 1 ? 'positive' : n.earnedHours / n.actualHours >= 0.95 ? '' : 'negative'}>{(n.earnedHours / n.actualHours).toFixed(2)}</span> : <span className="tiny muted">—</span>}</td>
                    <td style={{ minWidth: 110 }}><div className="progress-line"><div className="progress-fill" style={{ width: `${Math.min(100, (n.hours / total) * 100)}%` }} /></div><span className="tiny muted">{((n.hours / total) * 100).toFixed(1)}%</span></td>
                    {(access.canWrite || access.canManage) && (
                      <td><div className="actions" style={{ flexWrap: 'nowrap' }}>
                        {access.canWrite && <Btn kind="small" aria-label={`Add under ${n.wbs}`} title="Add a sub-activity" onClick={() => setEditing({ node: null, parent: n.wbs })}>+</Btn>}
                        {access.canWrite && <Btn kind="small" onClick={() => setEditing({ node: n })}>Edit</Btn>}
                        {access.canManage && <Btn kind="small" onClick={() => setRemoving(n)}>Delete</Btn>}
                      </div></td>
                    )}
                  </tr>
                ))}
                {!visible.length && <tr><td colSpan={9} className="empty">{items.length ? 'Nothing matches the search.' : 'No budget yet. Add activities one by one, or paste a WBS from a spreadsheet with Import WBS.'}</td></tr>}
              </tbody>
              {items.length > 0 && !filter && <tfoot><tr><td colSpan={4}><strong>Total budget</strong></td><td style={{ textAlign: 'right' }} className="mono"><strong>{s!.totalHours.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</strong></td><td style={{ textAlign: 'right' }} className="mono"><strong>{s!.actualHours != null ? s!.actualHours.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : ''}</strong></td><td style={{ textAlign: 'right' }} className="mono"><strong>{s!.cpi != null ? s!.cpi.toFixed(2) : ''}</strong></td><td colSpan={2} /></tr></tfoot>}
            </table>
          </div>
        )}
      </div>

      {editing && <ActivityForm node={editing.node} parent={editing.parent ?? null} nodes={items} base={base} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {importing && <ImportDialog base={base} canReplace={access.canManage} hasData={items.length > 0} onClose={() => setImporting(false)} onDone={() => { setImporting(false); refresh(); }} />}
      {removing && (
        <Confirm title={`Delete ${removing.wbs}?`} busy={remove.isPending} onConfirm={() => remove.mutate(removing.wbs)} onClose={() => setRemoving(null)}>
          <p>“{removing.name}” and its {hrs(removing.hours)} will be removed from the budget. An activity that still has sub-activities cannot be deleted. This cannot be undone.</p>
        </Confirm>
      )}
    </>
  );
}

function ActivityForm({ node, parent, nodes, base, onClose, onSaved }: { node: WbsNode | null; parent: string | null; nodes: WbsNode[]; base: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    wbs: node?.wbs ?? '', name: node?.name ?? '', parentWbs: node ? node.parentWbs ?? '' : parent ?? '', discipline: node?.discipline ?? '',
    manhours: node ? String(node.ownHours || '') : '', actualHours: node?.ownActual != null ? String(node.ownActual) : '', earnedHours: node?.ownEarned != null ? String(node.ownEarned) : '', planStart: node?.planStart ?? '', planFinish: node?.planFinish ?? '', notes: node?.notes ?? '',
  });
  const [error, setError] = useState('');
  const up = (k: keyof typeof v, val: string) => setV(s => ({ ...s, [k]: val }));
  const hasChildren = !!node && !node.leaf;
  const bad = !!v.planStart && !!v.planFinish && v.planFinish < v.planStart;
  const disciplines = [...new Set(nodes.map(n => n.discipline).filter((d): d is string => !!d))].sort();
  // a row cannot move under itself or its own children
  const descendants = new Set<string>();
  if (node) { let inside = false; for (const n of nodes) { if (n.wbs === node.wbs) { inside = true; descendants.add(n.wbs); } else if (inside && n.level > node.level) descendants.add(n.wbs); else if (inside) break; } }

  const save = useMutation({
    mutationFn: () => {
      const body: BudgetInput = { name: v.name, parentWbs: v.parentWbs || null, discipline: v.discipline || null, manhours: v.manhours === '' ? null : Number(v.manhours), actualHours: v.actualHours === '' ? null : Number(v.actualHours), earnedHours: v.earnedHours === '' ? null : Number(v.earnedHours), planStart: v.planStart || null, planFinish: v.planFinish || null, notes: v.notes || null };
      return node ? request(`${base}/${encodeURIComponent(node.wbs)}`, { method: 'PATCH', body: JSON.stringify(body) }) : request(base, { method: 'POST', body: JSON.stringify({ ...body, wbs: v.wbs }) });
    },
    onSuccess: () => { toast(node ? 'Activity updated.' : 'Activity added.'); onSaved(); },
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal title={node ? `${node.wbs} · Edit activity` : 'Add activity'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !v.name.trim() || (!node && !v.wbs.trim()) || bad} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="WBS code" hint={node ? 'The code cannot be changed' : 'Unique in the project, e.g. 1.2.3'}><input value={v.wbs} disabled={!!node} maxLength={40} onChange={e => up('wbs', e.target.value)} autoFocus={!node} /></Field>
          <Field label="Parent WBS">
            <select value={v.parentWbs} onChange={e => up('parentWbs', e.target.value)}>
              <option value="">None (top level)</option>
              {nodes.filter(n => !descendants.has(n.wbs)).map(n => <option key={n.wbs} value={n.wbs}>{n.wbs} · {n.name}</option>)}
            </select>
          </Field>
          <Field label="Activity" full><input value={v.name} maxLength={160} onChange={e => up('name', e.target.value)} autoFocus={!!node} /></Field>
          <Field label="Discipline"><input list="budget-disciplines" value={v.discipline} maxLength={60} onChange={e => up('discipline', e.target.value)} /><datalist id="budget-disciplines">{disciplines.map(d => <option key={d} value={d} />)}</datalist></Field>
          <Field label="Budget manhours" hint={hasChildren ? 'This row has activities below it: its budget is their sum, so hours typed here are ignored' : undefined}>
            <input type="number" min={0} step="any" value={v.manhours} disabled={hasChildren} onChange={e => up('manhours', e.target.value)} />
          </Field>
          <Field label="Spent manhours" hint={hasChildren ? 'Summed from the activities below' : 'Hours worked so far'}>
            <input type="number" min={0} step="any" value={v.actualHours} disabled={hasChildren} onChange={e => up('actualHours', e.target.value)} />
          </Field>
          <Field label="Earned manhours" hint={hasChildren ? 'Summed from the activities below' : 'Budget × progress achieved; earned ÷ spent is the cost performance index'}>
            <input type="number" min={0} step="any" value={v.earnedHours} disabled={hasChildren} onChange={e => up('earnedHours', e.target.value)} />
          </Field>
          <Field label="Plan start"><input type="date" value={v.planStart} onChange={e => up('planStart', e.target.value)} /></Field>
          <Field label="Plan finish" hint="With a start date, this spreads the hours over time"><input type="date" value={v.planFinish} min={v.planStart || undefined} onChange={e => up('planFinish', e.target.value)} /></Field>
          {bad && <p className="negative tiny" style={{ gridColumn: '1/-1' }}>Plan finish cannot be before plan start.</p>}
          <Field label="Notes" full><textarea value={v.notes} maxLength={500} onChange={e => up('notes', e.target.value)} /></Field>
        </div>
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}

function ImportDialog({ base, canReplace, hasData, onClose, onDone }: { base: string; canReplace: boolean; hasData: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [error, setError] = useState('');
  const parsed = useMemo(() => parseBudgetImport(text), [text]);
  const send = useMutation({
    mutationFn: () => request<{ imported: number }>(`${base}/import`, { method: 'POST', body: JSON.stringify({ mode, rows: parsed.rows }) }),
    onSuccess: r => { toast(`${r.imported} rows imported.`); onDone(); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const ready = parsed.rows.length > 0 && parsed.errors.length === 0;
  return (
    <Modal popout={false} title="Import WBS" onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!ready || send.isPending} onClick={() => { setError(''); send.mutate(); }}>{send.isPending ? 'Importing…' : mode === 'replace' ? 'Replace budget' : `Import ${parsed.rows.length || ''} rows`}</Btn></>}>
      <div className="dialog-body">
        <p style={{ marginBottom: 12 }}>Paste rows copied from a spreadsheet (or CSV text). The first row is a header with these columns, in any order: <strong>WBS, Name</strong>, and optionally <strong>Parent, Discipline, Manhours, Start, Finish, Notes</strong>. Dates may be yyyy-mm-dd or dd/mm/yyyy. Nothing is imported unless every row is valid.</p>
        <div className="form-grid">
          <Field label="Pasted rows" full>
            <textarea value={text} rows={9} spellCheck={false} placeholder={'WBS\tName\tParent\tDiscipline\tManhours\tStart\tFinish\n1\tJacket\n1.1\tRoll up\t1\tStructural\t4200\t02/11/2026\t15/11/2026'} onChange={e => setText(e.target.value)} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
          </Field>
          {hasData && (
            <Field label="If the project already has a budget" full>
              <select value={mode} onChange={e => setMode(e.target.value as 'append' | 'replace')}>
                <option value="append">Add these rows to it (codes must be new)</option>
                <option value="replace" disabled={!canReplace}>Replace it with these rows{canReplace ? '' : ' (Project Manager or Manager only)'}</option>
              </select>
            </Field>
          )}
        </div>
        {text.trim() && (
          <p className={parsed.errors.length ? 'negative' : 'positive'} style={{ marginTop: 14 }}>
            {parsed.errors.length ? `${parsed.errors.length} problem${parsed.errors.length === 1 ? '' : 's'} found.` : `${parsed.rows.length} rows ready · ${hrs(parsed.rows.reduce((n, r) => n + (r.manhours ?? 0), 0))} typed in total.`}
          </p>
        )}
        {parsed.errors.length > 0 && <ul className="tiny negative" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{parsed.errors.slice(0, 8).map(e => <li key={e}>{e}</li>)}{parsed.errors.length > 8 && <li>…and {parsed.errors.length - 8} more</li>}</ul>}
        {mode === 'replace' && ready && <p className="warning" style={{ marginTop: 12 }}>This deletes the current budget and cannot be undone.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
