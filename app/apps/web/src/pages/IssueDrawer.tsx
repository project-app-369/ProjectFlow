import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText, request, type IssueDetail, type IssueLogEntry } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useToast } from '../state';
import { Badge, Btn, Confirm, Field, Modal } from '../ui';
import { DisciplinePicker, IconChoice } from './governance';

export const ISSUE_STATUSES = ['Not started', 'In progress', 'Pending', 'Completed'] as const;
export const ISSUE_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const PRIORITY_ICON: Record<string, string> = { Critical: 'urgency-urgent', High: 'urgency-high', Medium: 'urgency-normal', Low: 'urgency-low' };
const STATUS_ICON: Record<string, string> = { 'Not started': 'status-backlog', Pending: 'status-planned', 'In progress': 'status-ongoing', Completed: 'status-completed' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const describe = (l: IssueLogEntry) => [l.field && `${l.field}: ${l.fromValue ?? '—'} → ${l.toValue ?? '—'}`, !l.field && l.fromValue && `${l.fromValue}`, !l.field && l.toValue && `${l.toValue}`, l.note].filter(Boolean).join(' · ');
const LOG_TONE: Record<string, 'green' | 'amber' | 'indigo' | 'red' | undefined> = { Created: 'indigo', 'Status changed': 'amber', 'Sub-task done': 'green', 'Reminder sent': 'red' };

/** The people in charge, as chips: type an email, press Enter or Add. Several people can share an issue. */
function PicEditor({ value, onChange, suggestions, disabled }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const add = () => {
    const e = text.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL.test(e)) { setBad(true); return; }
    setBad(false); setText('');
    if (!value.includes(e)) onChange([...value, e]);
  };
  return (
    <div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {value.map(e => (
          <span key={e} className="chip pic-chip">{e}{!disabled && <button type="button" aria-label={`Remove ${e}`} title="Remove" onClick={() => onChange(value.filter(x => x !== e))}>×</button>}</span>
        ))}
        {!value.length && <span className="tiny muted">Nobody assigned yet</span>}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="email" placeholder="name@company.com" list="issue-pic-suggestions" value={text} aria-invalid={bad} aria-label="Add a person in charge by email"
            onChange={e => { setText(e.target.value); setBad(false); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <datalist id="issue-pic-suggestions">{suggestions.filter(s => !value.includes(s)).map(s => <option key={s} value={s} />)}</datalist>
          <Btn kind="small" icon="plus" onClick={add}>Add</Btn>
        </div>
      )}
      {bad && <p className="negative tiny" role="alert">Enter a valid email address.</p>}
    </div>
  );
}

/** One issue in a panel from the right: details, people in charge, sub-tasks, a note box and the history log. */
export function IssueDrawer({ base, id, canWrite, canManage, suggestions, defaults, onClose }: {
  base: string; id: string | null; canWrite: boolean; canManage: boolean; suggestions: string[]; defaults?: Partial<Record<string, string>>; onClose: () => void;
}) {
  const detail = useQuery({ queryKey: ['issue', base, id], enabled: !!id, queryFn: () => request<IssueDetail>(`${base}/${id}`) });
  const loaded = id ? detail.data : undefined;

  if (id && !loaded) {
    return <Modal title={id} size="xl" onClose={onClose} actions={<Btn onClick={onClose}>Close</Btn>}><div className="dialog-body">{detail.error ? <p className="negative">{errorText(detail.error)}</p> : <p className="muted">Loading…</p>}</div></Modal>;
  }
  return <IssueForm key={loaded?.updatedAt ?? 'new'} issue={loaded} base={base} canWrite={canWrite} canManage={canManage} suggestions={suggestions} defaults={defaults} onClose={onClose} />;
}

function IssueForm({ issue, base, canWrite, canManage, suggestions, defaults, onClose }: {
  issue?: IssueDetail; base: string; canWrite: boolean; canManage: boolean; suggestions: string[]; defaults?: Partial<Record<string, string>>; onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [sub, setSub] = useState({ title: '', pic: '', dueDate: '' });
  {
    const [v, setV] = useState(() => ({
      title: issue?.title ?? '', description: issue?.description ?? '', priority: issue?.priority ?? defaults?.priority ?? 'Medium', discipline: issue?.discipline ?? defaults?.discipline ?? '',
      status: issue?.status ?? 'Not started', startDate: issue?.startDate ?? '', dueDate: issue?.dueDate ?? '', nextAction: issue?.nextAction ?? '', remarks: issue?.remarks ?? '',
    }));
    const [pics, setPics] = useState<string[]>(issue?.pics ?? []);
    const set = (k: keyof typeof v, val: string) => setV(s => ({ ...s, [k]: val }));
    const refresh = () => Promise.all(['issues', 'insights', 'dashboard'].map(k => qc.invalidateQueries({ queryKey: [k] })));
    const after = (res: IssueDetail, msg: string) => { qc.setQueryData(['issue', base, res.id], res); refresh(); toast(msg); };
    const fail = (e: Error) => setError(errorText(e));
    const body = () => ({ ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() === '' ? null : x.trim()])), priority: v.priority, status: v.status, title: v.title.trim(), pics });

    const save = useMutation({
      mutationFn: () => (issue ? request<IssueDetail>(`${base}/${issue.id}`, { method: 'PATCH', body: JSON.stringify(body()) }) : request<IssueDetail>(base, { method: 'POST', body: JSON.stringify(body()) })),
      onSuccess: r => { after(r, issue ? 'Saved.' : 'Issue created.'); if (!issue) onClose(); }, onError: fail,
    });
    const act = useMutation({
      mutationFn: (a: { path: string; method: string; body?: unknown; msg: string }) => request<IssueDetail>(`${base}/${issue!.id}${a.path}`, { method: a.method, body: a.body === undefined ? undefined : JSON.stringify(a.body) }).then(r => ({ r, msg: a.msg })),
      onSuccess: ({ r, msg }) => { after(r, msg); setError(''); }, onError: fail,
    });
    const remove = useMutation({
      mutationFn: () => request<void>(`${base}/${issue!.id}`, { method: 'DELETE' }),
      onSuccess: () => { refresh(); toast('Issue deleted.'); onClose(); }, onError: (e: Error) => { setConfirming(false); fail(e); },
    });
    const off = !canWrite;
    const dirty = !issue || JSON.stringify(body()) !== JSON.stringify({ ...Object.fromEntries(Object.entries({ title: issue.title, description: issue.description, priority: issue.priority, discipline: issue.discipline, status: issue.status, startDate: issue.startDate, dueDate: issue.dueDate, nextAction: issue.nextAction, remarks: issue.remarks }).map(([k, x]) => [k, x == null || x === '' ? null : x])), pics: issue.pics });

    const addSub = () => {
      if (!sub.title.trim()) return;
      if (sub.pic && !EMAIL.test(sub.pic.trim())) { setError('The sub-task person must be an email address.'); return; }
      act.mutate({ path: '/subtasks', method: 'POST', body: { title: sub.title.trim(), pic: sub.pic.trim() || null, dueDate: sub.dueDate || null }, msg: 'Sub-task added.' });
      setSub({ title: '', pic: '', dueDate: '' });
    };

    return (
      <>
        <Modal title={issue ? `${issue.id} · ${issue.title}` : 'New issue'} size="xl" onClose={onClose}
          actions={<>
            {issue && canManage && <Btn onClick={() => setConfirming(true)}>Delete</Btn>}
            {issue && canWrite && <Btn iconOnly icon="bell" aria-label="Remind the persons in charge by email" title="Remind the persons in charge by email" onClick={() => { setError(''); act.mutate({ path: '/remind', method: 'POST', msg: 'Reminder emailed.' }); }}>Remind PICs</Btn>}
            <Btn onClick={onClose}>Close</Btn>
            {canWrite && <Btn kind="primary" disabled={save.isPending || !v.title.trim() || !dirty} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn>}
          </>}>
          <div className="dialog-body drawer-tight">
            {issue && (
              <div className="drawer-intro">
                <Badge>{issue.status}</Badge> <Badge tone={issue.priority === 'Critical' || issue.priority === 'High' ? 'red' : 'amber'}>{issue.priority}</Badge>{' '}
                {issue.overdue && <Badge tone="red">Overdue</Badge>} <span className="tiny muted">{issue.source ?? ''}{issue.completedDate ? ` · completed ${fmtDate(issue.completedDate)}` : ''}</span>
              </div>
            )}
            <Field label="Title *" full><input value={v.title} maxLength={200} disabled={off} onChange={e => set('title', e.target.value)} /></Field>
            <div className="gov-meta">
              <span className="meta-item" title="Priority"><IconChoice label="Priority" disabled={off} value={v.priority} options={ISSUE_PRIORITIES.map(p => ({ value: p, label: `${p} priority`, icon: PRIORITY_ICON[p] }))} onChange={x => set('priority', x ?? 'Medium')} /></span>
              <span className="meta-item" title="Status"><IconChoice label="Status" disabled={off} value={v.status} options={ISSUE_STATUSES.map(p => ({ value: p, label: p, icon: STATUS_ICON[p] }))} onChange={x => set('status', x ?? 'Not started')} /></span>
              <span className="meta-item" title="Disciplines (tick one or more)"><Icon name="layers" /><DisciplinePicker value={v.discipline} disabled={off} onChange={x => set('discipline', x)} /></span>
              <label className="meta-item" title="Start date"><Icon name="flag" /><input type="date" className="meta-input" aria-label="Start date" value={v.startDate} disabled={off} onChange={e => set('startDate', e.target.value)} /></label>
              <label className="meta-item" title="Due date: the people in charge are emailed when it is within 3 days or passed"><Icon name="calendar" /><input type="date" className="meta-input" aria-label="Due date" value={v.dueDate} disabled={off} onChange={e => set('dueDate', e.target.value)} /></label>
            </div>
            <div className="gov-cols">
              <div>
                <h3><Icon name="doc" />Description</h3>
                <textarea className="gov-text" rows={5} aria-label="Description" value={v.description} maxLength={2000} disabled={off} onChange={e => set('description', e.target.value)} />
                <h3><Icon name="arrow" />Next action / update</h3>
                <textarea className="gov-text" rows={3} aria-label="Next action" value={v.nextAction} maxLength={1500} disabled={off} onChange={e => set('nextAction', e.target.value)} />
                <h3><Icon name="edit" />Remarks</h3>
                <textarea className="gov-text" rows={3} aria-label="Remarks" value={v.remarks} maxLength={1500} disabled={off} onChange={e => set('remarks', e.target.value)} />
                <h3><Icon name="people" />Persons in charge <span className="tiny muted">up to 10, each new person is emailed on save</span></h3>
                <PicEditor value={pics} onChange={setPics} suggestions={suggestions} disabled={off} />
              </div>
              <div>
            {issue && (
              <>
                <h3 style={{ marginTop: 16 }}><Icon name="status-completed" /> Sub-tasks <span className="tiny muted">{issue.subtasksDone} of {issue.subtasksTotal} done</span></h3>
                <div className="subtask-list">
                  {issue.subtasks.map(s => (
                    <div key={s.id} className={`subtask ${s.done ? 'done' : ''}`}>
                      <input type="checkbox" checked={s.done} disabled={off} aria-label={`Done: ${s.title}`} onChange={e => act.mutate({ path: `/subtasks/${s.id}`, method: 'PATCH', body: { done: e.target.checked }, msg: e.target.checked ? 'Sub-task done.' : 'Sub-task reopened.' })} />
                      <div className="grow"><strong>{s.title}</strong><small className="muted">{[s.pic, s.dueDate && `due ${fmtDate(s.dueDate)}`].filter(Boolean).join(' · ') || 'No PIC or date'}</small></div>
                      {canWrite && <Btn kind="small" iconOnly icon="trash" aria-label={`Remove ${s.title}`} title="Remove" onClick={() => act.mutate({ path: `/subtasks/${s.id}`, method: 'DELETE', msg: 'Sub-task removed.' })} />}
                    </div>
                  ))}
                  {!issue.subtasks.length && <p className="tiny muted">Break the issue into steps, each with its own person and date.</p>}
                </div>
                {canWrite && (
                  <div className="subtask-add">
                    <input placeholder="New sub-task" value={sub.title} maxLength={200} aria-label="Sub-task title" onChange={e => setSub(s => ({ ...s, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
                    <input type="email" placeholder="PIC email" list="issue-pic-suggestions" value={sub.pic} aria-label="Sub-task person by email" onChange={e => setSub(s => ({ ...s, pic: e.target.value }))} />
                    <input type="date" value={sub.dueDate} aria-label="Sub-task due date" onChange={e => setSub(s => ({ ...s, dueDate: e.target.value }))} />
                    <Btn kind="small" icon="plus" disabled={!sub.title.trim() || act.isPending} onClick={addSub}>Add</Btn>
                  </div>
                )}

                <h3 style={{ marginTop: 16 }}><Icon name="clock" /> History</h3>
                {canWrite && (
                  <div className="note-add">
                    <input placeholder="Add a note to the history" value={note} maxLength={1500} aria-label="Note" onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { act.mutate({ path: '/comments', method: 'POST', body: { note: note.trim() }, msg: 'Note added.' }); setNote(''); } }} />
                    <Btn kind="small" iconOnly icon="plus" aria-label="Add note" disabled={!note.trim() || act.isPending} onClick={() => { act.mutate({ path: '/comments', method: 'POST', body: { note: note.trim() }, msg: 'Note added.' }); setNote(''); }}>Add note</Btn>
                  </div>
                )}
                <ol className="timeline tight">
                  {issue.log.map(l => (
                    <li key={l.id}>
                      <span className="tiny muted">{when(l.at)} · {l.actor}</span>
                      <div><Badge tone={LOG_TONE[l.action]}>{l.action}</Badge> <span className="tiny">{describe(l)}</span></div>
                    </li>
                  ))}
                </ol>
              </>
            )}
              </div>
            </div>
            {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          </div>
        </Modal>
        {confirming && issue && (
          <Confirm title={`Delete ${issue.id}?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirming(false)}>
            <p>The issue, its sub-tasks and its history log are removed. This cannot be undone.</p>
          </Confirm>
        )}
      </>
    );
  }
}
