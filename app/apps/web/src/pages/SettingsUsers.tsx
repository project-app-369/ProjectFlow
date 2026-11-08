import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ACCOUNT_STATES, errorText, request, type AccountState, type UserRow } from '../api';
import { fmtDate, initials, type Tone } from '../format';
import { useApp, useToast } from '../state';
import { Badge, Btn, ErrorBox, Field, Loading, Modal } from '../ui';

const STATE_TONE: Record<AccountState, Tone> = { Active: 'green', Invited: 'indigo', Suspended: 'amber', Deactivated: 'red' };

/** Settings → Users (admin mode): accounts, administrator flag and account state (spec AUTH-02). Project roles are set under Projects → Members. */
export default function UsersTab() {
  const { me } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<UserRow | 'new' | null>(null);
  const users = useQuery({ queryKey: ['users', me?.id], queryFn: () => request<UserRow[]>('/users'), enabled: !!me?.isAdmin });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['directory'] }), qc.invalidateQueries({ queryKey: ['projects'] })]);
  const quick = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: AccountState; isAdmin?: boolean }) => request<UserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { refresh(); toast('User updated.'); }, onError: (e: Error) => toast(errorText(e)),
  });

  if (!me?.isAdmin) return <div className="panel empty">User management is limited to administrators.</div>;

  return (
    <>
      <p className="page-sub" style={{ margin: '-6px 0 16px' }}>
        Accounts for everyone who can sign in. An administrator manages users and projects but sees a project's business data only after being added to it as a member.
        This pre-build has no passwords: “sign in” is choosing a name.
      </p>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Users</h2><p>{users.data ? `${users.data.length} accounts · ${users.data.filter(u => u.isAdmin && u.status === 'Active').length} active administrators` : '…'}</p></div>
          <Btn kind="small primary" icon="plus" onClick={() => setForm('new')}>New user</Btn>
        </div>
        {users.isPending ? <Loading /> : users.error ? <ErrorBox error={users.error} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PERSON</th><th>ACCOUNT</th><th>ADMIN</th><th>PROJECT ROLES</th><th>CREATED</th><th /></tr></thead>
              <tbody>
                {users.data.map(u => (
                  <tr key={u.id}>
                    <td><div className="vendor"><span className="avatar teal">{initials(u.name)}</span><span><strong>{u.name}{u.id === me.id ? ' (you)' : ''}</strong><small>{u.email}</small></span></div></td>
                    <td>
                      <select className="filter" aria-label={`Account state of ${u.name}`} value={u.status} onChange={e => quick.mutate({ id: u.id, status: e.target.value as AccountState })}>
                        {ACCOUNT_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input className="switch" type="checkbox" checked={u.isAdmin} aria-label={`${u.name} is an administrator`} onChange={e => quick.mutate({ id: u.id, isAdmin: e.target.checked })} /></td>
                    <td style={{ whiteSpace: 'normal' }}>{u.memberships.length ? u.memberships.map(m => <span key={m.projectId} style={{ marginRight: 6 }}><Badge tone="indigo">{m.projectCode} · {m.role}</Badge></span>) : <span className="tiny muted">None</span>}</td>
                    <td>{u.createdAt ? fmtDate(u.createdAt.slice(0, 10)) : '—'}</td>
                    <td><div className="actions" style={{ minWidth: 220 }}><Badge tone={STATE_TONE[u.status]}>{u.status}</Badge><Btn kind="small" onClick={() => setForm(u)}>Edit</Btn></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form && <UserForm user={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={created => { setForm(null); refresh(); toast(created ? 'User created.' : 'User updated.'); }} />}
    </>
  );
}

function UserForm({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: (created: boolean) => void }) {
  const [v, setV] = useState({ name: user?.name ?? '', email: user?.email ?? '', isAdmin: user?.isAdmin ?? false, status: (user?.status ?? 'Active') as AccountState });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => (user
      ? request<UserRow>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(v) })
      : request<UserRow>('/users', { method: 'POST', body: JSON.stringify(v) })),
    onSuccess: () => onSaved(!user), onError: (e: Error) => setError(errorText(e)),
  });
  return (
    <Modal title={user ? `Edit ${user.name}` : 'New user'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !v.name.trim() || !v.email.trim()} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Full name" full><input value={v.name} maxLength={120} onChange={e => setV(s => ({ ...s, name: e.target.value }))} autoFocus /></Field>
          <Field label="Email" full><input type="email" value={v.email} maxLength={160} onChange={e => setV(s => ({ ...s, email: e.target.value }))} /></Field>
          <Field label="Account state"><select value={v.status} onChange={e => setV(s => ({ ...s, status: e.target.value as AccountState }))}>{ACCOUNT_STATES.map(s => <option key={s}>{s}</option>)}</select></Field>
          <label className="field" style={{ justifyContent: 'flex-end' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input className="switch" type="checkbox" checked={v.isAdmin} onChange={e => setV(s => ({ ...s, isAdmin: e.target.checked }))} />Organization administrator</span>
          </label>
        </div>
        <p className="tiny muted" style={{ marginTop: 14 }}>Only Active accounts can be chosen at sign-in. Assign project roles under Projects → Members.</p>
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
