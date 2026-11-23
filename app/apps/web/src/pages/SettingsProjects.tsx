import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText, LIFECYCLE_NEXT, request, ROLES, type DirectoryUser, type Lifecycle, type Member, type Project, type Role } from '../api';
import { fmtDate, type Tone } from '../format';
import { useApp, useToast } from '../state';
import { Badge, Btn, Confirm, ErrorBox, Field, Loading, Modal, ModalSkeleton, DateInput } from '../ui';

const LIFE_TONE: Record<Lifecycle, Tone> = { Draft: 'indigo', Setup: 'indigo', Active: 'green', 'On hold': 'amber', Closing: 'amber', Archived: 'red' };
const LIFE_HELP: Record<Lifecycle, string> = {
  Draft: 'Being prepared; can still be deleted if empty.', Setup: 'Configuring modules and members.', Active: 'Running; modules in use.',
  'On hold': 'Paused.', Closing: 'Finishing and handing over.', Archived: 'Closed and hidden from normal lists; restoring needs a reason.',
};

/** Settings → Projects: choose the working project; administrators create, edit, move through the lifecycle and delete (spec PRJ-01..06). */
export default function ProjectsTab() {
  const { me, project: current, selectProject } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<Project | 'new' | null>(null);
  const [life, setLife] = useState<Project | null>(null);
  const [members, setMembers] = useState<Project | null>(null);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [removeError, setRemoveError] = useState('');

  const list = useQuery({ queryKey: ['projects', 'settings', me?.id, showArchived], queryFn: () => request<Project[]>(`/projects${showArchived ? '?includeArchived=true' : ''}`) });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['projects'] }), qc.invalidateQueries({ queryKey: ['me'] })]);
  const remove = useMutation({
    mutationFn: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setRemoving(null); refresh(); toast('Project deleted.'); },
    onError: (e: Error) => setRemoveError(errorText(e)),
  });

  const isAdmin = !!me?.isAdmin;
  const canEdit = (p: Project) => isAdmin || p.myRole === 'Project Manager';

  return (
    <>
      <p className="page-sub" style={{ margin: '-6px 0 16px' }}>
        Pick the project you are working in. Records, modules and dashboards always belong to one project. {isAdmin ? 'As an administrator you can also create and manage projects.' : 'Only an administrator can create projects.'}
      </p>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Projects</h2><p>{list.data ? `${list.data.length} visible to you` : '…'}</p></div>
          <div className="actions">
            {isAdmin && <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Show archived</label>}
            {isAdmin && <Btn kind="small primary" icon="plus" onClick={() => setForm('new')}>New project</Btn>}
          </div>
        </div>
        {list.isPending ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PROJECT</th><th>CLIENT</th><th>STATUS</th><th>YOUR ROLE</th><th>MEMBERS</th><th>CUT-OFF</th><th /></tr></thead>
              <tbody>
                {list.data.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><small className="muted" style={{ display: 'block' }}>{p.code}{p.location ? ` · ${p.location}` : ''}{p.id === current.id ? ' · current' : ''}</small></td>
                    <td>{p.client ?? '—'}</td>
                    <td><Badge tone={LIFE_TONE[p.lifecycle ?? 'Active']}>{p.lifecycle ?? 'Active'}</Badge></td>
                    <td>{p.myRole ?? <span className="tiny muted">Not a member</span>}</td>
                    <td>{p.memberCount ?? 0}</td>
                    <td>{fmtDate(p.cutoff)}</td>
                    <td>
                      <div className="actions" style={{ minWidth: 220 }}>
                        <Btn kind={`small ${p.id === current.id ? '' : 'primary'}`} disabled={p.id === current.id} onClick={() => selectProject(p.id)}>{p.id === current.id ? 'Selected' : 'Open'}</Btn>
                        <Btn kind="small" onClick={() => setMembers(p)}>Members</Btn>
                        {canEdit(p) && <Btn kind="small" onClick={() => setForm(p)}>Edit</Btn>}
                        {canEdit(p) && <Btn kind="small" onClick={() => setLife(p)}>Status</Btn>}
                        {isAdmin && <Btn kind="small" onClick={() => { setRemoveError(''); setRemoving(p); }}>Delete</Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!list.data.length && <tr><td colSpan={7} className="empty">{isAdmin ? 'No projects yet. Create the first one.' : 'You are not a member of any project yet. Ask an administrator to add you.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && <ProjectForm project={form === 'new' ? null : form} isAdmin={isAdmin} onClose={() => setForm(null)} onSaved={(p, created) => { setForm(null); refresh(); toast(created ? `Project ${p.code} created.` : 'Project updated.'); if (created) selectProject(p.id); }} />}
      {life && <LifecycleModal project={life} onClose={() => setLife(null)} onDone={() => { setLife(null); refresh(); toast('Project status updated.'); }} />}
      {members && <MembersModal project={members} canEdit={canEdit(members)} onClose={() => { setMembers(null); refresh(); }} />}
      {removing && (
        <Confirm title={`Delete ${removing.code}?`} busy={remove.isPending} onConfirm={() => remove.mutate(removing.id)} onClose={() => setRemoving(null)}>
          <p>Only an empty project that has never been activated can be deleted. Anything else must be archived instead. This cannot be undone.</p>
          {removeError && <p className="negative" role="alert" style={{ marginTop: 12 }}>{removeError}</p>}
        </Confirm>
      )}
    </>
  );
}

function ProjectForm({ project, isAdmin, onClose, onSaved }: { project: Project | null; isAdmin: boolean; onClose: () => void; onSaved: (p: Project, created: boolean) => void }) {
  const [v, setV] = useState({
    code: project?.code ?? '', name: project?.name ?? '', shortName: project?.shortName ?? '', client: project?.client ?? '', contract: project?.contract ?? '',
    location: project?.location ?? '', cutoff: project?.cutoff ?? new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');
  const up = (k: keyof typeof v, val: string) => setV(s => ({ ...s, [k]: val }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, shortName: v.shortName || null, client: v.client || null, contract: v.contract || null, location: v.location || null };
      return project
        ? request<Project>(`/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(isAdmin ? body : { ...body, code: undefined }) })
        : request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: p => onSaved(p, !project),
    onError: (e: Error) => setError(errorText(e)),
  });
  return (
    <Modal title={project ? `Edit ${project.code}` : 'New project'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || v.code.trim().length < 2 || !v.name.trim()} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : project ? 'Save' : 'Create project'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Project code" hint={project && !isAdmin ? 'Only an administrator can rename the code' : 'Unique, e.g. STTP2B-26'}><input value={v.code} maxLength={30} disabled={!!project && !isAdmin} onChange={e => up('code', e.target.value)} autoFocus /></Field>
          <Field label="Short name"><input value={v.shortName} maxLength={40} onChange={e => up('shortName', e.target.value)} /></Field>
          <Field label="Project name" full><input value={v.name} maxLength={160} onChange={e => up('name', e.target.value)} /></Field>
          <Field label="Client"><input value={v.client} maxLength={120} onChange={e => up('client', e.target.value)} /></Field>
          <Field label="Location"><input value={v.location} maxLength={120} onChange={e => up('location', e.target.value)} /></Field>
          <Field label="Contract" full><input value={v.contract} maxLength={160} onChange={e => up('contract', e.target.value)} /></Field>
          <Field label="Reporting cut-off" hint="Treated as “today” for overdue and due-soon statuses"><DateInput value={v.cutoff} onChange={e => up('cutoff', e.target.value)} /></Field>
        </div>
        {!project && <p className="tiny muted" style={{ marginTop: 14 }}>The new project starts in Setup with you as Project Manager and the default modules switched on.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}

function LifecycleModal({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: () => void }) {
  const from = project.lifecycle ?? 'Active';
  const options = LIFECYCLE_NEXT[from];
  const [to, setTo] = useState<Lifecycle>(options[0]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const needsReason = from === 'Archived';
  const go = useMutation({
    mutationFn: () => request<Project>(`/projects/${project.id}/lifecycle`, { method: 'POST', body: JSON.stringify({ to, reason: reason.trim() || undefined }) }),
    onSuccess: onDone, onError: (e: Error) => setError(errorText(e)),
  });
  return (
    <Modal title={`${project.code} · Project status`} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={go.isPending || (needsReason && !reason.trim())} onClick={() => { setError(''); go.mutate(); }}>{go.isPending ? 'Saving…' : 'Change status'}</Btn></>}>
      <div className="dialog-body">
        <p>Currently <Badge tone={LIFE_TONE[from]}>{from}</Badge> <span className="tiny muted">{LIFE_HELP[from]}</span></p>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <Field label="Move to" full>
            <select value={to} onChange={e => setTo(e.target.value as Lifecycle)}>{options.map(o => <option key={o} value={o}>{o} — {LIFE_HELP[o]}</option>)}</select>
          </Field>
          <Field label={needsReason ? 'Reason for restoring (required)' : 'Reason (optional)'} full><textarea value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></Field>
        </div>
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}

function MembersModal({ project, canEdit, onClose }: { project: Project; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['members', project.id];
  const members = useQuery({ queryKey: key, queryFn: () => request<Member[]>(`/projects/${project.id}/members`) });
  const directory = useQuery({ queryKey: ['directory', 'members'], queryFn: () => request<DirectoryUser[]>('/directory'), enabled: canEdit });
  const [add, setAdd] = useState({ userId: '', role: 'Team Member' as Role, title: '' });
  const [error, setError] = useState('');
  const done = () => { setError(''); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['me'] }); };

  const put = useMutation({
    mutationFn: (b: { userId: string; role: Role; title: string | null }) => request<Member>(`/projects/${project.id}/members/${b.userId}`, { method: 'PUT', body: JSON.stringify({ role: b.role, title: b.title }) }),
    onSuccess: () => { done(); setAdd({ userId: '', role: 'Team Member', title: '' }); toast('Members updated.'); }, onError: (e: Error) => setError(errorText(e)),
  });
  const drop = useMutation({
    mutationFn: (userId: string) => request<void>(`/projects/${project.id}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => { done(); toast('Member removed.'); }, onError: (e: Error) => setError(errorText(e)),
  });
  const taken = new Set(members.data?.map(m => m.userId));

  return (
    <Modal title={`${project.code} · Members`} onClose={onClose} actions={<Btn onClick={onClose}>Close</Btn>}>
      {members.isPending ? <ModalSkeleton /> : <div className="dialog-body">
        {members.error ? <ErrorBox error={members.error} /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>PERSON</th><th>ROLE</th><th>TITLE</th>{canEdit && <th />}</tr></thead>
            <tbody>{members.data.map(m => (
              <tr key={m.userId}>
                <td><strong>{m.name}</strong><small className="muted" style={{ display: 'block' }}>{m.email}{m.status !== 'Active' ? ` · ${m.status}` : ''}</small></td>
                <td>{canEdit
                  ? <select className="filter" aria-label={`Role of ${m.name}`} value={m.role} onChange={e => put.mutate({ userId: m.userId, role: e.target.value as Role, title: m.title })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                  : m.role}</td>
                <td>{m.title ?? '—'}</td>
                {canEdit && <td><Btn kind="small" onClick={() => drop.mutate(m.userId)}>Remove</Btn></td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {canEdit && (
          <form className="form-grid" style={{ marginTop: 18 }} onSubmit={e => { e.preventDefault(); setError(''); put.mutate({ userId: add.userId, role: add.role, title: add.title.trim() || null }); }}>
            <Field label="Add a person" full>
              <select value={add.userId} onChange={e => setAdd(a => ({ ...a, userId: e.target.value }))}>
                <option value="">Choose…</option>
                {directory.data?.filter(u => !taken.has(u.id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Role"><select value={add.role} onChange={e => setAdd(a => ({ ...a, role: e.target.value as Role }))}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Title (optional)"><input value={add.title} maxLength={120} onChange={e => setAdd(a => ({ ...a, title: e.target.value }))} /></Field>
            <div className="field full"><button className="btn small primary" type="submit" disabled={!add.userId || put.isPending}>Add member</button></div>
          </form>
        )}
        {!canEdit && <p className="tiny muted" style={{ marginTop: 14 }}>Only an administrator or the project's Project Manager can change members.</p>}
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>}
    </Modal>
  );
}
