import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { errorText, request } from './api';
import { ACCEPT, fileToText } from './fileText';
import { Icon } from './icons';
import { useAccess, useApp, useToast } from './state';
import { Badge, Btn, DateInput, Field, Modal } from './ui';

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
  const [open, setOpen] = useState<'analysis' | 'import' | null>(null);
  if (!status.data?.enabled) return null;
  const name = LABEL[kind];
  return (
    <>
      <Btn kind="small" icon="chart" title={`Analyse the ${name.many} register with AI`} onClick={() => setOpen('analysis')}>AI analysis</Btn>
      {access.canWrite && <Btn kind="small" icon="upload" title={`Read a minute, register or note with AI and add ${name.many} after review`} onClick={() => setOpen('import')}>Import document</Btn>}
      {open === 'analysis' && <AnalysisDialog kind={kind} projectId={project.id} onClose={() => setOpen(null)} />}
      {open === 'import' && <ImportDialog kind={kind} projectId={project.id} onClose={() => setOpen(null)} />}
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
    return { title: r.title.trim(), description: t('description'), priority: r.priority, discipline: t('discipline'), status: r.status, startDate: t('startDate'), dueDate: t('dueDate'), nextAction: t('nextAction'), remarks: t('remarks'), pics: String(r.pics ?? '').split(/[\s,;]+/).filter(e => e.includes('@')) };
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
  const patch = (key: number, p: Row) => setRows(rs => rs?.map(r => (r._key === key ? { ...r, ...p, _state: r._state === 'error' ? 'idle' : r._state } : r)) ?? null);

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
          <Field label="Persons in charge (e-mails)" full>{txt('pics', 400)}</Field>
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
