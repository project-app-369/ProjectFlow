import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { request } from '../api';
import { Icon } from '../icons';
import { useApp } from '../state';
import { Btn } from '../ui';

/** A member of the current project, as Settings → Projects → Members lists them. */
export interface Member { userId: string; name: string; email: string | null; status: string; role: string; title: string | null }
export interface PersonCard { email: string; name: string; userId?: string | null }

/** The project's active members: who an issue, a sub-task or a risk can be given to. */
export function useMembers() {
  const { project } = useApp();
  const q = useQuery({
    queryKey: ['members', project.id], enabled: !!project.id, staleTime: 120_000, retry: false,
    queryFn: () => request<Member[]>(`/projects/${project.id}/members`),
  });
  return useMemo(() => (q.data ?? []).filter(m => m.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)), [q.data]);
}

/** Name for an e-mail, from the cards the server sent or from the members list; the e-mail itself when nobody has it. */
export function nameOf(email: string | null | undefined, members: Member[], cards: PersonCard[] = []) {
  if (!email) return '';
  const e = email.toLowerCase();
  return cards.find(c => c.email === e)?.name ?? members.find(m => m.email?.toLowerCase() === e)?.name ?? email;
}

/** What is sent for a typed person: the member's e-mail when the name (or e-mail) matches one, else the text as typed (the server resolves names or refuses). */
export function personRef(text: string, members: Member[]) {
  const t = text.trim();
  if (!t) return '';
  const k = t.toLowerCase();
  const m = members.find(x => x.name.toLowerCase() === k || x.email?.toLowerCase() === k || x.userId.toLowerCase() === k);
  return m?.email?.toLowerCase() ?? t;
}

export const initialsOf = (name: string) => {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : words[0]?.[1] ?? '')).toUpperCase() || '?';
};

/** The members as datalist options: the name to pick, with role and title as the hint. */
export function MemberOptions({ id, members, exclude = [] }: { id: string; members: Member[]; exclude?: string[] }) {
  return <datalist id={id}>{members.filter(m => !exclude.includes(m.email?.toLowerCase() ?? '')).map(m => <option key={m.userId} value={m.name}>{[m.title, m.role].filter(Boolean).join(' · ')}</option>)}</datalist>;
}

/** One person typed by name, picked from the project's members. */
export function PersonInput({ value, onChange, members, placeholder = 'Person', label, className, disabled }: {
  value: string; onChange: (v: string) => void; members: Member[]; placeholder?: string; label: string; className?: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <>
      <input className={className} list={id} placeholder={placeholder} aria-label={label} value={value} maxLength={120} disabled={disabled} autoComplete="off" onChange={e => onChange(e.target.value)} />
      <MemberOptions id={id} members={members} />
    </>
  );
}

/** Several people as chips with their names: pick a member by name, press Enter or Add. The value is their e-mails, which reminders go to. */
export function PeoplePicker({ value, onChange, members, cards = [], disabled, label = 'Add a person in charge' }: {
  value: string[]; onChange: (v: string[]) => void; members: Member[]; cards?: PersonCard[]; disabled?: boolean; label?: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const add = () => {
    const ref = personRef(text, members);
    if (!ref) return;
    setText('');
    const key = ref.includes('@') ? ref.toLowerCase() : ref;
    if (!value.includes(key)) onChange([...value, key]);
  };
  return (
    <div className="people-picker">
      <div className="people-chips">
        {value.map(e => {
          const name = nameOf(e, members, cards);
          const known = name !== e || !e.includes('@');
          return (
            <span key={e} className="person-chip" title={e.includes('@') ? e : undefined}>
              <span className="avatar sm" aria-hidden="true">{initialsOf(name)}</span>
              <span className="person-name">{name}</span>
              {!known && <small className="muted">no account</small>}
              {!disabled && <button type="button" aria-label={`Remove ${name}`} title="Remove" onClick={() => onChange(value.filter(x => x !== e))}><Icon name="close" /></button>}
            </span>
          );
        })}
        {!value.length && <span className="tiny muted">Nobody assigned yet</span>}
      </div>
      {!disabled && (
        <div className="people-add">
          <input list={id} placeholder="Type a name…" value={text} aria-label={label} autoComplete="off"
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <MemberOptions id={id} members={members} exclude={value} />
          <Btn kind="small" icon="plus" disabled={!text.trim()} onClick={add}>Add</Btn>
        </div>
      )}
    </div>
  );
}
