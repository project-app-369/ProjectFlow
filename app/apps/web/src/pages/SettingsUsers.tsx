import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ACCOUNT_STATES, PARTIES, errorText, request, type AccountState, type Party, type UserRow } from '../api';
import { initials, type Tone } from '../format';
import { useApp, useToast } from '../state';
import { Icon } from '../icons';
import { Badge, Btn, ErrorBox, Field, Loading, Modal } from '../ui';

const STATE_TONE: Record<AccountState, Tone> = { Active: 'green', Invited: 'indigo', Suspended: 'amber', Deactivated: 'red' };
const PARTY_TONE: Record<Party, Tone> = { Contractor: 'indigo', Client: 'green', Subcontractor: 'amber' };

/** Settings → Users (admin mode): accounts, administrator flag and account state (spec AUTH-02). Project roles are set under Projects → Members. */
export default function UsersTab() {
  const { me } = useApp();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<UserRow | 'new' | null>(null);
  const [reset, setReset] = useState<UserRow | null>(null);
  const [find, setFind] = useState('');
  const [party, setParty] = useState<Party | 'none' | ''>('');
  const users = useQuery({ queryKey: ['users', me?.id], queryFn: () => request<UserRow[]>('/users'), enabled: !!me?.isAdmin });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['directory'] }), qc.invalidateQueries({ queryKey: ['projects'] })]);
  const quick = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: AccountState; isAdmin?: boolean; party?: Party | null }) => request<UserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { refresh(); toast('User updated.'); }, onError: (e: Error) => toast(errorText(e)),
  });

  if (!me?.isAdmin) return <div className="panel empty">User management is limited to administrators.</div>;
  const needle = find.trim().toLowerCase();
  const shown = (users.data ?? []).filter(u => (!party || (party === 'none' ? !u.party : u.party === party))
    && (!needle || [u.name, u.email, u.title, u.company].some(t => String(t ?? '').toLowerCase().includes(needle))));
  const count = (p: Party | 'none') => (users.data ?? []).filter(u => (p === 'none' ? !u.party : u.party === p)).length;

  return (
    <>
      <p className="page-sub">
        Accounts for everyone who can sign in. An administrator manages users and projects but sees a project's business data only after being added to it as a member.
        Each person belongs to a party (Contractor, Client or Subcontractor); what each party sees is set under Party access, and what each person may do in a project under Project access.
        Where the deployment requires passwords, set or reset a person's password here; where it does not, sign-in is still choosing a name.
      </p>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Users</h2><p>{users.data ? `${users.data.length} accounts · ${users.data.filter(u => u.isAdmin && u.status === 'Active').length} active administrators` : '…'}</p></div>
          <Btn kind="small primary" icon="plus" onClick={() => setForm('new')}>New user</Btn>
        </div>
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input placeholder="Search name, email, title, company…" value={find} onChange={e => setFind(e.target.value)} aria-label="Search users" /></label>
          <div className="seg" role="group" aria-label="Filter by party">
            <button type="button" className={party === '' ? 'on' : ''} aria-pressed={party === ''} onClick={() => setParty('')}>All</button>
            {PARTIES.map(p => <button key={p} type="button" className={party === p ? 'on' : ''} aria-pressed={party === p} onClick={() => setParty(party === p ? '' : p)}>{p} · {count(p)}</button>)}
            {count('none') > 0 && <button type="button" className={party === 'none' ? 'on' : ''} aria-pressed={party === 'none'} onClick={() => setParty(party === 'none' ? '' : 'none')}>No party · {count('none')}</button>}
          </div>
        </div>
        {users.isPending ? <Loading /> : users.error ? <ErrorBox error={users.error} /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PERSON</th><th>TITLE · COMPANY</th><th>PARTY</th><th>ACCOUNT</th><th>ADMIN</th><th>SIGN-IN</th><th>PROJECT ROLES</th><th /></tr></thead>
              <tbody>
                {shown.map(u => (
                  <tr key={u.id}>
                    <td><div className="vendor"><span className="avatar teal">{initials(u.name)}</span><span><strong>{u.name}{u.id === me.id ? ' (you)' : ''}</strong><small>{u.email}</small></span></div></td>
                    <td>{u.title || u.company ? <span className="stack"><strong>{u.title ?? '—'}</strong><small>{u.company ?? ''}</small></span> : <span className="muted">—</span>}</td>
                    <td>
                      <select className="filter" aria-label={`Party of ${u.name}`} value={u.party ?? ''} onChange={e => quick.mutate({ id: u.id, party: (e.target.value || null) as Party | null })}>
                        <option value="">Not set</option>{PARTIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="filter" aria-label={`Account state of ${u.name}`} value={u.status} onChange={e => quick.mutate({ id: u.id, status: e.target.value as AccountState })}>
                        {ACCOUNT_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input className="switch" type="checkbox" checked={u.isAdmin} aria-label={`${u.name} is an administrator`} onChange={e => quick.mutate({ id: u.id, isAdmin: e.target.checked })} /></td>
                    <td data-label="Sign-in" style={{ whiteSpace: 'normal' }}>
                      <span className="stack">
                        {u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now() ? <Badge tone="red">Locked</Badge> : !u.hasPassword ? <Badge tone="amber">No password</Badge> : <small>{u.lastLoginAt ? `Last ${new Date(u.lastLoginAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Never signed in'}</small>}
                        <button type="button" className="link-button" onClick={() => setReset(u)}>{u.hasPassword ? 'Reset password' : 'Set password'}</button>
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>{u.memberships.length ? u.memberships.map(m => <span key={m.projectId} className="badge-gap"><Badge tone="indigo">{m.projectCode} · {m.role}</Badge></span>) : <span className="tiny muted">None</span>}</td>
                    <td><div className="actions">{u.party && <Badge tone={PARTY_TONE[u.party]}>{u.party}</Badge>}<Badge tone={STATE_TONE[u.status]}>{u.status}</Badge><Btn kind="small" onClick={() => setForm(u)}>Edit</Btn></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {reset && <PasswordForm user={reset} onClose={() => setReset(null)} onSaved={() => { setReset(null); refresh(); qc.invalidateQueries({ queryKey: ['access-log'] }); toast('Password saved. Sessions signed in with the old one have ended and the lock is lifted.'); }} />}
      {form && <UserForm user={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={created => { setForm(null); refresh(); toast(created ? 'User created.' : 'User updated.'); }} />}
    </>
  );
}

function PasswordForm({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => request(`/users/${user.id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
    onSuccess: onSaved, onError: (e: Error) => setError(errorText(e)),
  });
  return (
    <Modal title={`${user.hasPassword ? 'Reset' : 'Set'} password · ${user.name}`} size="sm" popout={false} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || password.length < 8} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save password'}</Btn></>}>
      <div className="dialog-body">
        <Field label="New password" hint="At least 8 characters. Tell the person in person or by phone, not in a shared channel; they can change it in their profile."><input type="password" value={password} autoComplete="new-password" autoFocus onChange={e => setPassword(e.target.value)} /></Field>
        {error && <p className="negative mt-3" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function UserForm({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: (created: boolean) => void }) {
  const [v, setV] = useState({ name: user?.name ?? '', email: user?.email ?? '', title: user?.title ?? '', company: user?.company ?? '', party: (user?.party ?? '') as Party | '', password: '', isAdmin: user?.isAdmin ?? false, status: (user?.status ?? 'Active') as AccountState });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const { password, party, ...rest } = v;
      const body = { ...rest, party: party || null, ...(!user && password ? { password } : {}) };
      return user
        ? request<UserRow>(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : request<UserRow>('/users', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => onSaved(!user), onError: (e: Error) => setError(errorText(e)),
  });
  return (
    <Modal title={user ? `Edit ${user.name}` : 'New user'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !v.name.trim() || !v.email.trim() || (!user && v.password !== '' && v.password.length < 8)} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Full name" full><input value={v.name} maxLength={120} onChange={e => setV(s => ({ ...s, name: e.target.value }))} autoFocus /></Field>
          <Field label="Email" full><input type="email" value={v.email} maxLength={160} onChange={e => setV(s => ({ ...s, email: e.target.value }))} /></Field>
          <Field label="Job title"><input value={v.title} maxLength={120} onChange={e => setV(s => ({ ...s, title: e.target.value }))} /></Field>
          <Field label="Company"><input value={v.company} maxLength={120} onChange={e => setV(s => ({ ...s, company: e.target.value }))} /></Field>
          <Field label="Party" hint="Decides which screens this person sees."><select value={v.party} onChange={e => setV(s => ({ ...s, party: e.target.value as Party | '' }))}><option value="">Not set (sees everything)</option>{PARTIES.map(p => <option key={p}>{p}</option>)}</select></Field>
          {!user && <Field label="Initial password" hint="Optional, at least 8 characters. The person can change it in their profile."><input type="password" value={v.password} autoComplete="new-password" onChange={e => setV(s => ({ ...s, password: e.target.value }))} /></Field>}
          <Field label="Account state"><select value={v.status} onChange={e => setV(s => ({ ...s, status: e.target.value as AccountState }))}>{ACCOUNT_STATES.map(s => <option key={s}>{s}</option>)}</select></Field>
          <label className="field" style={{ justifyContent: 'flex-end' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input className="switch" type="checkbox" checked={v.isAdmin} onChange={e => setV(s => ({ ...s, isAdmin: e.target.checked }))} />Organization administrator</span>
          </label>
        </div>
        <p className="tiny muted mt-3">Only Active accounts can be chosen at sign-in. Assign project roles under Projects → Members.</p>
        {error && <p className="negative mt-3" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
