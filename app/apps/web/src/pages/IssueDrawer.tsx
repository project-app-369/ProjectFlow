import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText, request, type IssueDetail, type IssueLogEntry, type IssueOptions } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useToast } from '../state';
import { Badge, Btn, Confirm, Field, Modal, ModalSkeleton, DateInput } from '../ui';
import { PeoplePicker, PersonInput, nameOf, personRef, useMembers } from './people';
import { DisciplinePicker, ISSUE_PRIORITY_TONE, ISSUE_STATUS_TONE, StateSelect } from './governance';

export const ISSUE_STATUSES = ['Not started', 'In progress', 'Pending', 'Completed'] as const;
export const ISSUE_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const PRIORITY_ICON: Record<string, string> = { Critical: 'urgency-urgent', High: 'urgency-high', Medium: 'urgency-normal', Low: 'urgency-low' };
const STATUS_ICON: Record<string, string> = { 'Not started': 'status-backlog', Pending: 'status-planned', 'In progress': 'status-ongoing', Completed: 'status-completed' };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const describe = (l: IssueLogEntry) => [l.field && `${l.field}: ${l.fromValue ?? '—'} → ${l.toValue ?? '—'}`, !l.field && l.fromValue && `${l.fromValue}`, !l.field && l.toValue && `${l.toValue}`, l.note].filter(Boolean).join(' · ');
const LOG_TONE: Record<string, 'green' | 'amber' | 'indigo' | 'red' | undefined> = { Created: 'indigo', 'Status changed': 'amber', 'Sub-task done': 'green', 'Reminder sent': 'red' };

/** One issue in a panel from the right: details, people in charge, sub-tasks, a note box and the history log. */
export function IssueDrawer({ base, id, canWrite, canManage, defaults, options, defaultPackage, onClose }: {
  base: string; id: string | null; canWrite: boolean; canManage: boolean; defaults?: Partial<Record<string, string>>;
  /** Packages and service subcontracts the issue can be linked to. */ options?: IssueOptions; defaultPackage?: string | null; onClose: () => void;
}) {
  const detail = useQuery({ queryKey: ['issue', base, id], enabled: !!id, queryFn: () => request<IssueDetail>(`${base}/${id}`) });
  const loaded = id ? detail.data : undefined;

  if (id && !loaded) {
    return <Modal title={id} size="xl" onClose={onClose} actions={<Btn onClick={onClose}>Close</Btn>}>{detail.error ? <div className="dialog-body"><p className="negative">{errorText(detail.error)}</p></div> : <ModalSkeleton />}</Modal>;
  }
  return <IssueForm key={loaded?.updatedAt ?? 'new'} issue={loaded} base={base} canWrite={canWrite} canManage={canManage} defaults={{ ...defaults, ...(defaultPackage ? { packageCode: defaultPackage } : {}) }} options={options} onClose={onClose} />;
}

function IssueForm({ issue, base, canWrite, canManage, defaults, options, onClose }: {
  issue?: IssueDetail; base: string; canWrite: boolean; canManage: boolean; defaults?: Partial<Record<string, string>>; options?: IssueOptions; onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [sub, setSub] = useState({ title: '', pic: '', dueDate: '' });
  const [editSub, setEditSub] = useState<{ id: string; title: string; pic: string; dueDate: string } | null>(null);
  {
    const [v, setV] = useState(() => ({
      title: issue?.title ?? '', description: issue?.description ?? '', priority: issue?.priority ?? defaults?.priority ?? 'Medium', discipline: issue?.discipline ?? defaults?.discipline ?? '',
      status: issue?.status ?? 'Not started', startDate: issue?.startDate ?? '', dueDate: issue?.dueDate ?? '', nextAction: issue?.nextAction ?? '', remarks: issue?.remarks ?? '',
      packageCode: issue?.packageCode ?? defaults?.packageCode ?? '', subcontract: issue?.subcontract ?? defaults?.subcontract ?? '',
    }));
    const [pics, setPics] = useState<string[]>(issue?.pics ?? []);
    const members = useMembers();
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
    const pkgInfo = options?.packages.find(p => p.code === v.packageCode.trim());
    const dirty = !issue || JSON.stringify(body()) !== JSON.stringify({ ...Object.fromEntries(Object.entries({ title: issue.title, description: issue.description, priority: issue.priority, discipline: issue.discipline, status: issue.status, startDate: issue.startDate, dueDate: issue.dueDate, nextAction: issue.nextAction, remarks: issue.remarks, packageCode: issue.packageCode ?? null, subcontract: issue.subcontract ?? null }).map(([k, x]) => [k, x == null || x === '' ? null : x])), pics: issue.pics });

    const addSub = () => {
      if (!sub.title.trim()) return;
      act.mutate({ path: '/subtasks', method: 'POST', body: { title: sub.title.trim(), pic: personRef(sub.pic, members) || null, dueDate: sub.dueDate || null }, msg: 'Sub-task added.' });
      setSub({ title: '', pic: '', dueDate: '' });
    };

    const saveSub = () => {
      if (!editSub || !issue) return;
      if (!editSub.title.trim()) { setError('A sub-task needs a title.'); return; }
      act.mutate({ path: `/subtasks/${editSub.id}`, method: 'PATCH', body: { title: editSub.title.trim(), pic: personRef(editSub.pic, members) || null, dueDate: editSub.dueDate || null }, msg: 'Sub-task saved.' });
      setEditSub(null);
    };

    return (
      <>
        <Modal title={issue ? `${issue.id} · ${issue.title}` : 'New issue'} size="xl" onClose={onClose}
          actions={<>
            {issue && canManage && <Btn onClick={() => setConfirming(true)}>Delete</Btn>}
            {issue && canWrite && !canManage && <span className="tiny muted delete-hint">Only a Project Manager or Manager can delete issues.</span>}
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
              <div className="meta-group"><span className="meta-title">Classification</span><div className="meta-row">
                <span className="meta-item" title="Priority"><StateSelect label="Priority" disabled={off} value={v.priority} options={ISSUE_PRIORITIES.map(p => ({ value: p, label: p, icon: PRIORITY_ICON[p], tone: ISSUE_PRIORITY_TONE[p] }))} onChange={x => set('priority', x ?? 'Medium')} /></span>
                <span className="meta-item" title="Status"><StateSelect label="Status" disabled={off} value={v.status} options={ISSUE_STATUSES.map(p => ({ value: p, label: p, icon: STATUS_ICON[p], tone: ISSUE_STATUS_TONE[p] }))} onChange={x => set('status', x ?? 'Not started')} /></span>
                <span className="meta-item" title="Disciplines (tick one or more)"><Icon name="layers" /><DisciplinePicker value={v.discipline} disabled={off} onChange={x => set('discipline', x)} /></span>
              </div></div>
              <div className="meta-group"><span className="meta-title">Schedule</span><div className="meta-row">
                <label className="meta-item" title="Start date"><Icon name="flag" /><DateInput className="meta-input" aria-label="Start date" value={v.startDate} disabled={off} onChange={e => set('startDate', e.target.value)} /></label>
                <label className="meta-item" title="Due date: the people in charge are emailed when it is within 3 days or passed"><Icon name="calendar" /><DateInput className="meta-input" aria-label="Due date" value={v.dueDate} disabled={off} onChange={e => set('dueDate', e.target.value)} /></label>
              </div></div>
              <div className="meta-group"><span className="meta-title">Linked to</span><div className="meta-row">
                <label className="meta-item meta-wide" title="Procurement or expediting package"><Icon name="box" /><input className="meta-input" list="issue-packages" placeholder="Procurement package" aria-label="Procurement package" value={v.packageCode} maxLength={60} disabled={off} onChange={e => set('packageCode', e.target.value)} /></label>
                <datalist id="issue-packages">{options?.packages.map(p => <option key={p.code} value={p.code}>{[p.label, p.vendor].filter(Boolean).join(' · ')}</option>)}</datalist>
                <label className="meta-item meta-wide" title="Service subcontract: the subcontractor or service package"><Icon name="building" /><input className="meta-input" list="issue-subcontracts" placeholder="Service subcontract" aria-label="Service subcontract" value={v.subcontract} maxLength={80} disabled={off} onChange={e => set('subcontract', e.target.value)} /></label>
                <datalist id="issue-subcontracts">{options?.subcontracts.map(p => <option key={p.code} value={p.code}>{p.label !== p.code ? p.label : ''}</option>)}</datalist>
                {pkgInfo && <span className="tiny muted meta-note">{[pkgInfo.label, pkgInfo.vendor].filter(Boolean).join(' · ')}</span>}
              </div></div>
            </div>
            <div className="gov-cols">
              <div>
                <h3><Icon name="doc" />Description</h3>
                <textarea className="gov-text" rows={5} aria-label="Description" value={v.description} maxLength={2000} disabled={off} onChange={e => set('description', e.target.value)} />
                <h3><Icon name="arrow" />Next action / update</h3>
                <textarea className="gov-text" rows={3} aria-label="Next action" value={v.nextAction} maxLength={1500} disabled={off} onChange={e => set('nextAction', e.target.value)} />
                <h3><Icon name="edit" />Remarks</h3>
                <textarea className="gov-text" rows={3} aria-label="Remarks" value={v.remarks} maxLength={1500} disabled={off} onChange={e => set('remarks', e.target.value)} />
              </div>
              <div>
                <h3><Icon name="people" />Persons in charge <span className="tiny muted">project members, up to 10; each new person is notified on save</span></h3>
                <PeoplePicker value={pics} onChange={setPics} members={members} cards={issue?.people} disabled={off} />
            {issue && (
              <>
                <h3 className="mt-4"><Icon name="status-completed" /> Sub-tasks <span className="tiny muted">{issue.subtasksDone} of {issue.subtasksTotal} done</span></h3>
                <div className="subtask-list">
                  {issue.subtasks.map(s => editSub?.id === s.id ? (
                    <div key={s.id} className="subtask editing">
                      <input className="subtask-edit-title" value={editSub.title} maxLength={200} autoFocus aria-label="Sub-task title" onChange={e => setEditSub(x => x && ({ ...x, title: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSub(); } else if (e.key === 'Escape') { e.stopPropagation(); setEditSub(null); } }} />
                      <PersonInput placeholder="Person in charge" label="Sub-task person in charge" members={members} value={editSub.pic} onChange={pic => setEditSub(x => x && ({ ...x, pic }))} />
                      <DateInput value={editSub.dueDate} aria-label="Sub-task due date" onChange={e => setEditSub(x => x && ({ ...x, dueDate: e.target.value }))} />
                      <div className="subtask-edit-actions">
                        <Btn kind="small" iconOnly icon="tick" aria-label="Save sub-task" title="Save" disabled={!editSub.title.trim() || act.isPending} onClick={saveSub}>Save</Btn>
                        <Btn kind="small" iconOnly icon="close" aria-label="Cancel editing" title="Cancel" onClick={() => setEditSub(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div key={s.id} className={`subtask ${s.done ? 'done' : ''}`}>
                      <input type="checkbox" checked={s.done} disabled={off} aria-label={`Done: ${s.title}`} onChange={e => act.mutate({ path: `/subtasks/${s.id}`, method: 'PATCH', body: { done: e.target.checked }, msg: e.target.checked ? 'Sub-task done.' : 'Sub-task reopened.' })} />
                      <div className="grow"><strong>{s.title}</strong><small className="muted">{[s.pic && (s.picName ?? nameOf(s.pic, members, issue.people)), s.dueDate && `due ${fmtDate(s.dueDate)}`].filter(Boolean).join(' · ') || 'No PIC or date'}</small></div>
                      {canWrite && <Btn kind="small" iconOnly icon="edit" aria-label={`Edit ${s.title}`} title="Edit" onClick={() => { setError(''); setEditSub({ id: s.id, title: s.title, pic: s.pic ? (s.picName ?? nameOf(s.pic, members, issue.people)) : '', dueDate: s.dueDate ?? '' }); }}>Edit</Btn>}
                      {canWrite && <Btn kind="small" iconOnly icon="trash" aria-label={`Remove ${s.title}`} title="Remove" onClick={() => act.mutate({ path: `/subtasks/${s.id}`, method: 'DELETE', msg: 'Sub-task removed.' })}>Remove</Btn>}
                    </div>
                  ))}
                  {!issue.subtasks.length && <p className="tiny muted">Break the issue into steps, each with its own person and date.</p>}
                </div>
                {canWrite && (
                  <div className="subtask-add">
                    <input placeholder="New sub-task" value={sub.title} maxLength={200} aria-label="Sub-task title" onChange={e => setSub(s => ({ ...s, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
                    <PersonInput placeholder="Person in charge" label="Sub-task person in charge" members={members} value={sub.pic} onChange={pic => setSub(s => ({ ...s, pic }))} />
                    <DateInput value={sub.dueDate} aria-label="Sub-task due date" onChange={e => setSub(s => ({ ...s, dueDate: e.target.value }))} />
                    <Btn kind="small" icon="plus" disabled={!sub.title.trim() || act.isPending} onClick={addSub}>Add</Btn>
                  </div>
                )}

                <h3 className="mt-4"><Icon name="clock" /> History</h3>
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
            {error && <p className="negative mt-3" role="alert">{error}</p>}
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
