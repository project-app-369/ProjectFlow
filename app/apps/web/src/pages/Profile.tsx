import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { errorText, request, type Me } from '../api';
import { fmtDate, initials, type Tone } from '../format';
import { Icon } from '../icons';
import { CrumbContext, useApp, useToast } from '../state';
import { Badge, Btn, Field, PageHead } from '../ui';

const STATE_TONE: Record<string, Tone> = { Active: 'green', Invited: 'indigo', Suspended: 'amber', Deactivated: 'red' };

/** Your own profile: name, title, company, e-mail and password. Party, account state and administrator rights are set by an administrator. */
export default function Profile() {
  const { me, projects } = useApp();
  if (!me) return <div className="panel empty">There is no profile without a signed-in user.</div>;
  return (
    <CrumbContext.Provider value={['Account', 'Profile']}>
      <PageHead title="My profile" desc="Your details as the project team sees them, and your password." />
      <section className="panel profile-card">
        <span className="avatar teal big">{initials(me.name)}</span>
        <div className="profile-card-text">
          <h2>{me.name}</h2>
          <p className="muted">{[me.title, me.company].filter(Boolean).join(' · ') || 'Add your title and company below.'}</p>
        </div>
        <div className="profile-card-tags">
          {me.party && <Badge tone="indigo">{me.party}</Badge>}
          <Badge tone={STATE_TONE[me.status] ?? 'green'}>{me.status}</Badge>
          {me.isAdmin && <Badge tone="amber">Administrator</Badge>}
        </div>
      </section>
      <div className="profile-grid">
        <DetailsForm me={me} />
        <PasswordForm me={me} />
        <section className="panel profile-access">
          <div className="panel-head"><div><h2>Your access</h2><p>Set by an administrator.</p></div></div>
          <dl className="profile-facts">
            <div><dt>Type of user</dt><dd>{me.party ?? <span className="muted">Not set</span>}</dd></div>
            <div><dt>Account</dt><dd>{me.status}</dd></div>
            <div><dt>Screens</dt><dd>{me.isAdmin ? 'Everything (administrator)' : me.hiddenModules?.length ? `${me.hiddenModules?.length} screens are not shared with ${me.party ?? 'you'}` : 'All screens enabled for the project'}</dd></div>
            <div>
              <dt>Project roles</dt>
              <dd>{me.memberships.length
                ? me.memberships.map(m => <span key={m.projectId} className="profile-role"><Badge tone="indigo">{projects.find(p => p.id === m.projectId)?.code ?? m.projectId} · {m.role}</Badge></span>)
                : <span className="muted">None yet</span>}</dd>
            </div>
          </dl>
        </section>
      </div>
    </CrumbContext.Provider>
  );
}

function useRefreshMe() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['bootstrap'] }), qc.invalidateQueries({ queryKey: ['directory'] }), qc.invalidateQueries({ queryKey: ['users'] })]);
}

function DetailsForm({ me }: { me: Me }) {
  const toast = useToast();
  const refresh = useRefreshMe();
  const initial = { name: me.name, email: me.email ?? '', title: me.title ?? '', company: me.company ?? '' };
  const [v, setV] = useState(initial);
  const [error, setError] = useState('');
  useEffect(() => { setV({ name: me.name, email: me.email ?? '', title: me.title ?? '', company: me.company ?? '' }); }, [me.name, me.email, me.title, me.company]);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(k => v[k] !== initial[k]);
  const save = useMutation({
    mutationFn: () => request<Me>('/me', { method: 'PATCH', body: JSON.stringify({ name: v.name, email: v.email, title: v.title, company: v.company }) }),
    onSuccess: () => { setError(''); refresh(); toast('Profile saved.'); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); if (dirty && v.name.trim() && v.email.trim()) save.mutate(); };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV(s => ({ ...s, [k]: e.target.value }));
  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-head"><div><h2>Details</h2><p>Shown next to your work and in assignments.</p></div></div>
      <div className="form-grid">
        <Field label="Full name"><input value={v.name} maxLength={120} onChange={set('name')} autoComplete="name" /></Field>
        <Field label="Job title"><input value={v.title} maxLength={120} onChange={set('title')} placeholder="e.g. Procurement lead" autoComplete="organization-title" /></Field>
        <Field label="Company"><input value={v.company} maxLength={120} onChange={set('company')} autoComplete="organization" /></Field>
        <Field label="Email"><input type="email" value={v.email} maxLength={160} onChange={set('email')} autoComplete="email" /></Field>
      </div>
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="form-actions">
        <Btn iconOnly={false} onClick={() => { setV(initial); setError(""); }} disabled={!dirty}>Reset</Btn>
        <Btn kind="primary" icon="tick" iconOnly={false} type="submit" disabled={!dirty || save.isPending || !v.name.trim() || !v.email.trim()}>{save.isPending ? 'Saving…' : 'Save changes'}</Btn>
      </div>
    </form>
  );
}

function PasswordForm({ me }: { me: Me }) {
  const toast = useToast();
  const refresh = useRefreshMe();
  const [v, setV] = useState({ current: '', next: '', again: '' });
  const [error, setError] = useState('');
  const mismatch = v.again !== '' && v.next !== v.again;
  const short = v.next !== '' && v.next.length < 8;
  const save = useMutation({
    mutationFn: () => request<{ changedAt: string }>('/me/password', { method: 'POST', body: JSON.stringify({ current: v.current || undefined, password: v.next }) }),
    onSuccess: () => { setV({ current: '', next: '', again: '' }); setError(''); refresh(); toast('Password changed.'); },
    onError: (e: Error) => setError(errorText(e)),
  });
  const ready = v.next.length >= 8 && v.next === v.again && (!me.hasPassword || v.current !== '');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV(s => ({ ...s, [k]: e.target.value }));
  return (
    <form className="panel" onSubmit={e => { e.preventDefault(); if (ready) save.mutate(); }}>
      <div className="panel-head">
        <div><h2>Password</h2><p>{me.hasPassword ? (me.passwordChangedAt ? `Last changed ${fmtDate(me.passwordChangedAt.slice(0, 10))}.` : 'A password is set.') : 'No password is set yet.'}</p></div>
        <Icon name="shield" />
      </div>
      <div className="form-grid">
        {me.hasPassword && <Field label="Current password" full><input type="password" value={v.current} onChange={set('current')} autoComplete="current-password" /></Field>}
        <Field label="New password" hint={short ? 'Use at least 8 characters.' : 'At least 8 characters.'}><input type="password" value={v.next} onChange={set('next')} autoComplete="new-password" aria-invalid={short} /></Field>
        <Field label="Repeat new password" hint={mismatch ? 'The two passwords differ.' : undefined}><input type="password" value={v.again} onChange={set('again')} autoComplete="new-password" aria-invalid={mismatch} /></Field>
      </div>
      <p className="tiny muted">This pre-build has no sign-in yet, so the password is stored (hashed) for when it does.</p>
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="form-actions">
        <Btn kind="primary" icon="shield" iconOnly={false} type="submit" disabled={!ready || save.isPending}>{save.isPending ? 'Saving…' : me.hasPassword ? 'Change password' : 'Set password'}</Btn>
      </div>
    </form>
  );
}
