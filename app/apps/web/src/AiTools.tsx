import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorText, request } from './api';
import { ACCEPT, fileToText } from './fileText';
import { Icon } from './icons';
import { useAccess, useApp, useToast } from './state';
import { Badge, Btn, DateInput, Field, Modal, StateTag, type StateTone } from './ui';

export type AiKind = 'issues' | 'risks' | 'concerns';
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const LABEL: Record<AiKind, { one: string; many: string; path: string }> = {
  issues: { one: 'issue', many: 'issues', path: 'issues' },
  risks: { one: 'risk', many: 'risks', path: 'risks' },
  concerns: { one: 'concern', many: 'concerns', path: 'procurement/concerns' },
};
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const ISSUE_STATUSES = ['Not started', 'In progress', 'Pending', 'Completed'];
const RISK_STATUSES = ['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed'];
const STRATEGIES = ['Avoid', 'Mitigate', 'Transfer', 'Accept', 'Escalate'];
const CONCERN_TYPES = ['Risk', 'Concern', 'Issue'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const AREAS = ['Schedule', 'Cost', 'Quality', 'Delivery', 'Documentation', 'Contractual', 'Other'];
const CONCERN_STATUSES = ['Open', 'Mitigating', 'Resolved', 'Closed'];

interface Analysis { summary: string; themes: { title: string; detail: string | null; ids: string[] }[]; priorities: { id: string; reason: string | null; action: string | null }[]; gaps: string[]; recommendations: string[] }
interface AnalysisReply { analysis: Analysis; model: string; itemsRead: number; itemsTotal: number }
interface ExtractReply { items: Row[]; notes: string | null; truncated: boolean; model: string }

/** The AI buttons of a register page: analysis of the register, and import of a minute, register or note after review. Hidden where the server has no AI. */
export function AiTools({ kind }: { kind: AiKind }) {
  const { project } = useApp();
  const access = useAccess();
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => request<{ enabled: boolean }>('/ai/status'), staleTime: 300_000, retry: false });
  const [open, setOpen] = useState<'analysis' | 'import' | 'minutes' | null>(null);
  if (!status.data?.enabled) return null;
  const name = LABEL[kind];
  return (
    <>
      <Btn kind="small" icon="chart" title={`Analyse the ${name.many} register with AI`} onClick={() => setOpen('analysis')}>AI analysis</Btn>
      <Btn kind="small" icon="people" title="Read minutes of meeting with AI: progress, concerns and risks of each subcontractor, vendor and party" onClick={() => setOpen('minutes')}>Meeting minutes</Btn>
      {access.canWrite && <Btn kind="small" icon="upload" title={`Read a minute, register or note with AI and add ${name.many} after review`} onClick={() => setOpen('import')}>Import document</Btn>}
      {open === 'analysis' && <AnalysisDialog kind={kind} projectId={project.id} onClose={() => setOpen(null)} />}
      {open === 'import' && <ImportDialog kind={kind} projectId={project.id} onClose={() => setOpen(null)} />}
      {open === 'minutes' && <MinutesDialog projectId={project.id} onClose={() => setOpen(null)} />}
    </>
  );
}

function AnalysisDialog({ kind, projectId, onClose }: { kind: AiKind; projectId: string; onClose: () => void }) {
  const run = useMutation({ mutationFn: () => request<AnalysisReply>(`/projects/${projectId}/ai/analyse`, { method: 'POST', body: JSON.stringify({ kind }) }) });
  const started = useRef(false);
  if (!started.current) { started.current = true; run.mutate(); }
  const a = run.data?.analysis;
  return (
    <Modal title={`AI analysis · ${LABEL[kind].many}`} size="lg" onClose={onClose}
      actions={<><Btn onClick={onClose}>Close</Btn><Btn kind="primary" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Analysing…' : 'Run again'}</Btn></>}>
      <div className="dialog-body ai-body">
        {run.isPending && <p className="muted" role="status">Reading the register and asking the AI. This takes up to a minute.</p>}
        {run.error && <p className="negative" role="alert">{errorText(run.error)}</p>}
        {a && (
          <>
            {a.summary && <p>{a.summary}</p>}
            {a.priorities.length > 0 && (
              <section><h4>Attend to first</h4>
                <ul className="ai-list">{a.priorities.map(p => <li key={p.id}><span className="mono">{p.id}</span> {p.reason}{p.action && <> <strong>→ {p.action}</strong></>}</li>)}</ul>
              </section>
            )}
            {a.themes.length > 0 && (
              <section><h4>Themes</h4>
                <ul className="ai-list">{a.themes.map(t => <li key={t.title}><strong>{t.title}</strong>{t.detail && <> — {t.detail}</>}{t.ids.length > 0 && <small className="muted"> ({t.ids.join(', ')})</small>}</li>)}</ul>
              </section>
            )}
            {a.gaps.length > 0 && <section><h4>Gaps in the register</h4><ul className="ai-list">{a.gaps.map(g => <li key={g}>{g}</li>)}</ul></section>}
            {a.recommendations.length > 0 && <section><h4>Recommendations</h4><ul className="ai-list">{a.recommendations.map(g => <li key={g}>{g}</li>)}</ul></section>}
            <p className="tiny muted">Written by an AI model ({run.data?.model}) from {run.data?.itemsRead} of {run.data?.itemsTotal} {LABEL[kind].many}. Check it against the register before acting on it.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

const blank = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim());

/** What the register's create route takes, from a reviewed row. */
function bodyOf(kind: AiKind, r: Row): Row {
  const t = (k: string) => blank(r[k]);
  if (kind === 'issues') {
    return { title: r.title.trim(), description: t('description'), priority: r.priority, discipline: t('discipline'), status: r.status, startDate: t('startDate'), dueDate: t('dueDate'), nextAction: t('nextAction'), remarks: t('remarks'), packageCode: t('packageCode'), subcontract: t('subcontract'), pics: String(r.pics ?? '').split(/\s*[,;]\s*/).map(e => e.trim()).filter(Boolean) };
  }
  if (kind === 'risks') {
    return { title: r.title.trim(), description: t('description'), cause: t('cause'), effect: t('effect'), owner: String(r.owner ?? '').trim(), status: r.status, rbs: r.rbs, strategy: t('strategy'), mitigationCause: t('mitigationCause'), mitigationEffect: t('mitigationEffect'), planDate: t('planDate'), remark: t('remark') };
  }
  return { title: r.title.trim(), description: t('description'), type: r.type, severity: r.severity, area: r.area, packageCode: t('packageCode'), owner: t('owner'), raisedDate: t('raisedDate'), dueDate: t('dueDate'), status: r.status, action: t('action') };
}

/** Why a reviewed row cannot be imported yet, or ''. */
const problem = (kind: AiKind, r: Row) => (!String(r.title ?? '').trim() ? 'A title is needed.' : kind === 'risks' && !String(r.owner ?? '').trim() ? 'An owner is needed.' : kind === 'risks' && !r.rbs ? 'Pick the risk breakdown code.' : '');

function ImportDialog({ kind, projectId, onClose }: { kind: AiKind; projectId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const name = LABEL[kind];
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [fileError, setFileError] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const options = useQuery({ queryKey: ['risks-options-ai', projectId], enabled: kind === 'risks', queryFn: () => request<{ breakdown: { code: string; categoryName?: string; category?: string }[] }>(`/projects/${projectId}/risks/options`) });

  const read = useMutation({
    mutationFn: () => request<ExtractReply>(`/projects/${projectId}/ai/extract`, { method: 'POST', body: JSON.stringify({ kind, text, filename: filename || undefined }) }),
    onSuccess: r => {
      setNotes(r.notes);
      // an item that looks like one already in the register, or that the AI is unsure about, starts unticked
      setRows(r.items.map((x, i) => ({ ...x, _key: i, _pick: !x.duplicateOf && (x.confidence ?? 1) >= 0.5, _state: 'idle', pics: Array.isArray(x.pics) ? x.pics.join(', ') : x.pics })));
    },
  });

  const onFile = async (file: File | undefined) => {
    setFileError('');
    if (!file) return;
    try { setText(await fileToText(file)); setFilename(file.name); setRows(null); }
    catch (e) { setFileError(e instanceof Error ? e.message : 'The file could not be read.'); }
  };

  const picked = useMemo(() => (rows ?? []).filter(r => r._pick && r._state !== 'ok'), [rows]);
  const blocked = picked.filter(r => problem(kind, r));
  const patch = (key: number, p: Row) => setRows(rs => rs?.map(r => (r._key === key ? { ...r, ...p, _state: p._state ?? (r._state === 'error' ? 'idle' : r._state) } : r)) ?? null);

  const importAll = async () => {
    setImporting(true);
    let done = 0;
    for (const r of picked) {
      try {
        await request(`/projects/${projectId}/${name.path}`, { method: 'POST', body: JSON.stringify(bodyOf(kind, r)) });
        done++;
        patch(r._key, { _state: 'ok', _pick: false });
      } catch (e) { patch(r._key, { _state: 'error', _error: errorText(e) }); }
    }
    setImporting(false);
    qc.invalidateQueries();
    toast(done === picked.length ? `${done} ${done === 1 ? name.one : name.many} added.` : `${done} of ${picked.length} added; the others need attention.`);
    if (done === picked.length) onClose();
  };

  return (
    <Modal title={`Import ${name.many} from a document`} size="xl" onClose={onClose}
      actions={<>
        <Btn onClick={onClose}>{rows ? 'Close' : 'Cancel'}</Btn>
        {!rows && <Btn kind="primary" disabled={read.isPending || text.trim().length < 20} onClick={() => read.mutate()}>{read.isPending ? 'Reading…' : 'Read with AI'}</Btn>}
        {rows && <Btn onClick={() => { setRows(null); setNotes(null); }}>Back</Btn>}
        {rows && <Btn kind="primary" disabled={importing || !picked.length || !!blocked.length} onClick={importAll}>{importing ? 'Adding…' : `Add ${picked.length} ${picked.length === 1 ? name.one : name.many}`}</Btn>}
      </>}>
      <div className="dialog-body ai-body">
        {!rows && (
          <>
            <p className="muted">Minutes of a meeting, a register or notes. The AI picks out the {name.many} in it and you review them before anything is added. The text is sent to the AI service.</p>
            <Field label="File" hint="Word (.docx), Excel (.xlsx), text, CSV or Markdown. For a PDF, paste its text below.">
              <input type="file" accept={ACCEPT} onChange={e => onFile(e.target.files?.[0])} />
            </Field>
            {fileError && <p className="negative" role="alert">{fileError}</p>}
            <Field label={filename ? `Text read from ${filename} (you can edit it)` : 'Or paste the text'} full>
              <textarea className="ai-text" rows={12} value={text} onChange={e => { setText(e.target.value); setFilename(''); }} placeholder="Paste meeting minutes, action lists or notes here…" />
            </Field>
            <p className="tiny muted">{text.length.toLocaleString('en-US')} characters{text.length > 60_000 ? ' — only the first 60,000 will be read' : ''}.</p>
            {read.error && <p className="negative" role="alert">{errorText(read.error)}</p>}
          </>
        )}
        {rows && (
          <>
            <p>{rows.length ? <>The AI found <strong>{rows.length}</strong> {rows.length === 1 ? name.one : name.many}. Untick any you do not want, and correct what is wrong; nothing is added until you press Add.</> : <>The AI found no {name.many} in this document.</>}</p>
            {notes && <p className="tiny muted">{notes}</p>}
            {rows.map(r => <CandidateCard key={r._key} kind={kind} row={r} rbs={options.data?.breakdown ?? []} onChange={p => patch(r._key, p)} />)}
          </>
        )}
      </div>
    </Modal>
  );
}

function CandidateCard({ kind, row: r, rbs, onChange }: { kind: AiKind; row: Row; rbs: { code: string; categoryName?: string; category?: string }[]; onChange: (p: Row) => void }) {
  const why = r._pick ? problem(kind, r) : '';
  const sel = (k: string, list: string[], allowNone = false) => (
    <select value={r[k] ?? ''} onChange={e => onChange({ [k]: e.target.value || null })}>{allowNone && <option value="">—</option>}{list.map(o => <option key={o}>{o}</option>)}</select>
  );
  const txt = (k: string, max = 200) => <input value={r[k] ?? ''} maxLength={max} onChange={e => onChange({ [k]: e.target.value })} />;
  const date = (k: string) => <DateInput value={r[k] ?? ''} onChange={e => onChange({ [k]: e.target.value || null })} />;
  const area = (k: string, rows = 2) => <textarea rows={rows} value={r[k] ?? ''} onChange={e => onChange({ [k]: e.target.value })} />;
  return (
    <div className={`ai-card ${r._state === 'ok' ? 'done' : ''} ${r._pick ? '' : 'off'}`}>
      <label className="ai-pick">
        <input type="checkbox" checked={!!r._pick} disabled={r._state === 'ok'} onChange={e => onChange({ _pick: e.target.checked })} />
        <span>{r._state === 'ok' ? 'Added' : 'Add'}</span>
        {r.duplicateOf && <Badge tone="amber">Looks like {r.duplicateOf}</Badge>}
        {typeof r.confidence === 'number' && r.confidence < 0.5 && <Badge tone="amber">Unsure</Badge>}
      </label>
      <div className="ai-grid">
        <Field label="Title *" full>{txt('title')}</Field>
        {kind === 'issues' && <>
          <Field label="Priority">{sel('priority', PRIORITIES)}</Field>
          <Field label="Status">{sel('status', ISSUE_STATUSES)}</Field>
          <Field label="Discipline">{txt('discipline', 60)}</Field>
          <Field label="Due date">{date('dueDate')}</Field>
          <Field label="Package">{txt('packageCode', 60)}</Field>
          <Field label="Service subcontract">{txt('subcontract', 80)}</Field>
          <Field label="Persons in charge (names, separated by commas)" full>{txt('pics', 400)}</Field>
          <Field label="Description" full>{area('description')}</Field>
          <Field label="Next action" full>{area('nextAction')}</Field>
        </>}
        {kind === 'risks' && <>
          <Field label="Owner *">{txt('owner', 120)}</Field>
          <Field label="Breakdown code *">
            <select value={r.rbs ?? ''} onChange={e => onChange({ rbs: e.target.value || null })}>
              <option value="">Pick…</option>{rbs.map(b => <option key={b.code} value={b.code}>{b.code} {b.categoryName ?? b.category ?? ''}</option>)}
            </select>
          </Field>
          <Field label="Status">{sel('status', RISK_STATUSES)}</Field>
          <Field label="Strategy">{sel('strategy', STRATEGIES, true)}</Field>
          <Field label="Response due">{date('planDate')}</Field>
          <Field label="Description" full>{area('description')}</Field>
          <Field label="Cause" full>{area('cause')}</Field>
          <Field label="Effect" full>{area('effect')}</Field>
          <Field label="Mitigation against the cause" full>{area('mitigationCause')}</Field>
        </>}
        {kind === 'concerns' && <>
          <Field label="Type">{sel('type', CONCERN_TYPES)}</Field>
          <Field label="Severity">{sel('severity', SEVERITIES)}</Field>
          <Field label="Area">{sel('area', AREAS)}</Field>
          <Field label="Status">{sel('status', CONCERN_STATUSES)}</Field>
          <Field label="Package">{txt('packageCode', 60)}</Field>
          <Field label="Owner">{txt('owner', 80)}</Field>
          <Field label="Raised">{date('raisedDate')}</Field>
          <Field label="Due date">{date('dueDate')}</Field>
          <Field label="Description" full>{area('description')}</Field>
          <Field label="Action" full>{area('action')}</Field>
        </>}
      </div>
      {r.source && <p className="tiny muted ai-source"><Icon name="doc" /> “{r.source}”</p>}
      {why && <p className="tiny negative" role="alert">{why}</p>}
      {r._state === 'error' && <p className="tiny negative" role="alert">{r._error}</p>}
    </div>
  );
}

/* ============================== minutes of meeting ============================== */

interface Party {
  name: string; code: string | null; role: string; status: string; progress: string | null; planPct: number | null; actualPct: number | null;
  packages: string[]; keyDates: { what: string; date: string; kind: string }[]; concerns: string[]; risks: string[];
}
interface Digest {
  model: string; meeting: { title: string | null; date: string | null; kind: string | null; attendees: string[] }; summary: string; parties: Party[];
  decisions: string[]; actions: { action: string; owner: string | null; party: string | null; due: string | null }[];
  items: Row[]; writable: AiKind[]; notes: string | null; truncated: boolean;
}
const PARTY_TONE: Record<string, StateTone> = { 'On track': 'ok', 'Minor delay': 'warn', Delayed: 'warn', Critical: 'crit', Unknown: 'neutral' };
const PARTY_ICON: Record<string, string> = { 'On track': 'status-completed', 'Minor delay': 'clock', Delayed: 'clock', Critical: 'risk', Unknown: 'status-backlog' };
const ROLE_ICON: Record<string, string> = { Subcontractor: 'building', Vendor: 'box', Client: 'flag', 'EPCIC contractor': 'anchor', Other: 'people' };
const ROLES = ['Subcontractor', 'Vendor', 'EPCIC contractor', 'Client', 'Other'];
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** The digest as Markdown, to file with the minutes or paste in a report. */
function digestMarkdown(d: Digest): string {
  const out: string[] = [`# ${d.meeting.title ?? 'Minutes of meeting'}`, ''];
  const meta = [d.meeting.date, d.meeting.kind, d.meeting.attendees.length ? `Attendees: ${d.meeting.attendees.join(', ')}` : null].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '), '');
  if (d.summary) out.push('## Summary', '', d.summary, '');
  for (const p of d.parties) {
    out.push(`## ${p.name}${p.code && p.code !== p.name ? ` (${p.code})` : ''}: ${p.role}, ${p.status}`, '');
    if (p.planPct != null || p.actualPct != null) out.push(`Progress: ${p.actualPct ?? '–'}% actual against ${p.planPct ?? '–'}% planned`, '');
    if (p.progress) out.push(p.progress, '');
    if (p.packages.length) out.push(`Packages: ${p.packages.join(', ')}`, '');
    if (p.keyDates.length) out.push('Key dates:', ...p.keyDates.map(k => `- ${k.date} ${k.what} (${k.kind})`), '');
    if (p.concerns.length) out.push('Concerns:', ...p.concerns.map(c => `- ${c}`), '');
    if (p.risks.length) out.push('Risks:', ...p.risks.map(c => `- ${c}`), '');
  }
  if (d.decisions.length) out.push('## Decisions', '', ...d.decisions.map(x => `- ${x}`), '');
  if (d.actions.length) out.push('## Actions', '', '| Action | Owner | Party | Due |', '|---|---|---|---|', ...d.actions.map(a => `| ${a.action.replace(/\|/g, '/')} | ${a.owner ?? ''} | ${a.party ?? ''} | ${a.due ?? ''} |`), '');
  out.push(`_Summarised by an AI model (${d.model}). Check it against the minutes._`);
  return out.join('\n');
}

/** Minutes of meeting read by AI: where each subcontractor, vendor and party stands, and the issues, risks and concerns to add after review. */
function MinutesDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [fileError, setFileError] = useState('');
  const [digest, setDigest] = useState<Digest | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState('');
  const [tab, setTab] = useState<'parties' | 'actions' | 'entries'>('parties');
  const [importing, setImporting] = useState(false);
  const riskOptions = useQuery({ queryKey: ['risks-options-ai', projectId], enabled: !!digest?.writable.includes('risks'), queryFn: () => request<{ breakdown: { code: string; categoryName?: string; category?: string }[] }>(`/projects/${projectId}/risks/options`) });

  const read = useMutation({
    mutationFn: () => request<Digest>(`/projects/${projectId}/ai/digest`, { method: 'POST', body: JSON.stringify({ text, filename: filename || undefined }) }),
    onSuccess: d => {
      setDigest(d);
      setRows(d.items.map((x, i) => ({ ...x, _key: i, _pick: !x.duplicateOf && (x.confidence ?? 1) >= 0.5, _state: 'idle', pics: Array.isArray(x.pics) ? x.pics.join(', ') : x.pics })));
      setTab('parties'); setRole('');
    },
  });
  const onFile = async (file: File | undefined) => {
    setFileError('');
    if (!file) return;
    try { setText(await fileToText(file)); setFilename(file.name); setDigest(null); }
    catch (e) { setFileError(e instanceof Error ? e.message : 'The file could not be read.'); }
  };
  const patch = (key: number, p: Row) => setRows(rs => rs.map(r => (r._key === key ? { ...r, ...p, _state: p._state ?? (r._state === 'error' ? 'idle' : r._state) } : r)));
  const picked = rows.filter(r => r._pick && r._state !== 'ok');
  const blocked = picked.filter(r => problem(r.register, r));
  const parties = (digest?.parties ?? []).filter(p => !role || p.role === role);
  const roles = ROLES.filter(r => digest?.parties.some(p => p.role === r));
  const counts = (digest?.parties ?? []).reduce<Record<string, number>>((m, p) => ({ ...m, [p.status]: (m[p.status] ?? 0) + 1 }), {});

  const importAll = async () => {
    setImporting(true);
    let done = 0;
    for (const r of picked) {
      const kind = r.register as AiKind;
      try {
        await request(`/projects/${projectId}/${LABEL[kind].path}`, { method: 'POST', body: JSON.stringify(bodyOf(kind, r)) });
        done++;
        patch(r._key, { _state: 'ok', _pick: false });
      } catch (e) { patch(r._key, { _state: 'error', _error: errorText(e) }); }
    }
    setImporting(false);
    qc.invalidateQueries();
    toast(done === picked.length ? `${done} ${done === 1 ? 'entry' : 'entries'} added to the registers.` : `${done} of ${picked.length} added; the others need attention.`);
  };
  const download = () => {
    if (!digest) return;
    const url = URL.createObjectURL(new Blob([digestMarkdown(digest)], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(filename || digest.meeting.title || 'minutes').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-')}-summary.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const tabBtn = (id: typeof tab, label: string) => <button type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>;

  return (
    <Modal title="Meeting minutes · AI summary" size="xl" onClose={onClose}
      actions={<>
        <Btn onClick={onClose}>{digest ? 'Close' : 'Cancel'}</Btn>
        {!digest && <Btn kind="primary" disabled={read.isPending || text.trim().length < 20} onClick={() => read.mutate()}>{read.isPending ? 'Reading…' : 'Summarise with AI'}</Btn>}
        {digest && <Btn onClick={() => setDigest(null)}>Back</Btn>}
        {digest && <Btn icon="down" onClick={download}>Download summary</Btn>}
        {digest && tab === 'entries' && rows.length > 0 && <Btn kind="primary" disabled={importing || !picked.length || !!blocked.length} onClick={importAll}>{importing ? 'Adding…' : `Add ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}`}</Btn>}
      </>}>
      <div className="dialog-body ai-body">
        {!digest && (
          <>
            <p className="muted">Minutes of a progress meeting with a subcontractor, a vendor meeting, a client meeting or an internal EPCIC meeting. The AI sums up where each party stands (progress against plan, key dates, concerns and risks) and proposes issues, risks and concerns that you review before anything is added. The text is sent to the AI service.</p>
            <Field label="File" hint="Word (.docx), Excel (.xlsx), text, CSV or Markdown. For a PDF, paste its text below.">
              <input type="file" accept={ACCEPT} onChange={e => onFile(e.target.files?.[0])} />
            </Field>
            {fileError && <p className="negative" role="alert">{fileError}</p>}
            <Field label={filename ? `Text read from ${filename} (you can edit it)` : 'Or paste the minutes'} full>
              <textarea className="ai-text" rows={12} value={text} onChange={e => { setText(e.target.value); setFilename(''); }} placeholder="Paste the minutes of meeting here…" />
            </Field>
            <p className="tiny muted">{text.length.toLocaleString('en-US')} characters{text.length > 60_000 ? ' (only the first 60,000 will be read)' : ''}.</p>
            {read.isPending && <p className="muted" role="status">Reading the minutes against the project's parties, packages and key dates. This takes up to a minute.</p>}
            {read.error && <p className="negative" role="alert">{errorText(read.error)}</p>}
          </>
        )}
        {digest && (
          <>
            <section className="mom-head">
              <div>
                <span className="eyebrow">{[digest.meeting.kind, digest.meeting.date && fmtDay(digest.meeting.date)].filter(Boolean).join(' · ') || 'Minutes of meeting'}</span>
                <h3>{digest.meeting.title ?? (filename || 'Minutes of meeting')}</h3>
                {digest.meeting.attendees.length > 0 && <p className="tiny muted">Attendees: {digest.meeting.attendees.join(', ')}</p>}
              </div>
              <div className="mom-counts" aria-label="Parties by status">
                {Object.keys(PARTY_TONE).filter(k => counts[k]).map(k => <StateTag key={k} icon={PARTY_ICON[k]} label={`${counts[k]} ${k.toLowerCase()}`} tone={PARTY_TONE[k]} />)}
              </div>
            </section>
            {digest.summary && <p className="mom-summary">{digest.summary}</p>}
            {digest.decisions.length > 0 && <section><h4>Decisions</h4><ul className="ai-list">{digest.decisions.map(d => <li key={d}>{d}</li>)}</ul></section>}
            <div className="mom-bar-row">
              <div className="seg" role="group" aria-label="Show">
                {tabBtn('parties', `Parties (${digest.parties.length})`)}{tabBtn('actions', `Actions (${digest.actions.length})`)}{tabBtn('entries', `Register entries (${rows.length})`)}
              </div>
              {tab === 'parties' && roles.length > 1 && (
                <select className="filter" aria-label="Filter parties by role" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="">All parties</option>{roles.map(r => <option key={r}>{r}</option>)}
                </select>
              )}
            </div>
            {tab === 'parties' && (parties.length ? <div className="mom-parties">{parties.map((p, i) => <PartyCard key={`${p.name}-${i}`} p={p} />)}</div> : <p className="muted">The minutes name no party.</p>)}
            {tab === 'actions' && (digest.actions.length ? (
              <div className="table-wrap">
                <table className="mom-actions">
                  <thead><tr><th>Action</th><th>Owner</th><th>Party</th><th>Due</th></tr></thead>
                  <tbody>{digest.actions.map((a, i) => <tr key={i}><td>{a.action}</td><td>{a.owner ?? '—'}</td><td>{a.party ?? '—'}</td><td className="mono">{a.due ? fmtDay(a.due) : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="muted">The minutes record no action.</p>)}
            {tab === 'entries' && (
              <>
                <p className="tiny muted">{digest.writable.length
                  ? <>Proposed for {digest.writable.map(k => LABEL[k].many).join(', ')}. Untick any you do not want and correct what is wrong; nothing is added until you press Add.</>
                  : <>You can read these registers but not add to them, so no entries are proposed.</>}</p>
                {rows.length === 0 && digest.writable.length > 0 && <p className="muted">The AI found nothing to add to the registers.</p>}
                {rows.map(r => (
                  <div key={r._key} className="mom-entry">
                    <div className="mom-entry-head">
                      <Badge tone={r.register === 'risks' ? 'red' : r.register === 'issues' ? 'amber' : 'indigo'}>{LABEL[r.register as AiKind].one}</Badge>
                      {r.party && <span className="tiny muted">{r.party}</span>}
                      {r.packageKnown === false && <Badge tone="amber">{`Package ${r.packageCode} is not in the registers`}</Badge>}
                    </div>
                    <CandidateCard kind={r.register} row={r} rbs={riskOptions.data?.breakdown ?? []} onChange={p => patch(r._key, p)} />
                  </div>
                ))}
              </>
            )}
            {digest.notes && <p className="tiny muted">{digest.notes}</p>}
            <p className="tiny muted">Summarised by an AI model ({digest.model}). Check it against the minutes before acting on it.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function PartyCard({ p }: { p: Party }) {
  const gap = p.planPct != null && p.actualPct != null ? Math.round((p.actualPct - p.planPct) * 10) / 10 : null;
  const tone = PARTY_TONE[p.status] ?? 'neutral';
  return (
    <article className={`mom-party s-${tone}`}>
      <header>
        <span className="mom-role" title={p.role}><Icon name={ROLE_ICON[p.role] ?? 'people'} /></span>
        <div className="mom-party-name"><strong>{p.name}</strong><small className="muted">{[p.role, p.code && p.code !== p.name ? p.code : null].filter(Boolean).join(' · ')}</small></div>
        <StateTag icon={PARTY_ICON[p.status] ?? 'status-backlog'} label={p.status} tone={tone} />
      </header>
      {(p.planPct != null || p.actualPct != null) && (
        <div className="mom-progress" title={`${p.actualPct ?? '–'}% actual against ${p.planPct ?? '–'}% planned`}>
          <div className="mom-track"><span className="plan" style={{ width: `${p.planPct ?? 0}%` }} /><span className="actual" style={{ width: `${p.actualPct ?? 0}%` }} /></div>
          <span className="tiny"><strong>{p.actualPct ?? '–'}%</strong> <span className="muted">of {p.planPct ?? '–'}% planned</span>{gap != null && gap !== 0 && <span className={gap < 0 ? 'negative' : 'positive'}> {gap > 0 ? '+' : ''}{gap} pts</span>}</span>
        </div>
      )}
      {p.progress && <p className="mom-text">{p.progress}</p>}
      {p.keyDates.length > 0 && <ul className="mom-dates">{p.keyDates.map((k, i) => <li key={i}><span className="mono">{fmtDay(k.date)}</span><span>{k.what}</span><small className="muted">{k.kind}</small></li>)}</ul>}
      {p.concerns.length > 0 && <div className="mom-list"><h5>Concerns</h5><ul>{p.concerns.map(c => <li key={c}>{c}</li>)}</ul></div>}
      {p.risks.length > 0 && <div className="mom-list risk"><h5>Risks</h5><ul>{p.risks.map(c => <li key={c}>{c}</li>)}</ul></div>}
      {p.packages.length > 0 && <footer>{p.packages.map(c => <Link key={c} className="chip" to={`/m/procurement.concerns?package=${encodeURIComponent(c)}`} title="Open the package's concerns">{c}</Link>)}</footer>}
    </article>
  );
}
