import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, type DirectoryUser } from './api';
import { initials } from './format';
import { Icon } from './icons';
import { useAccess, useApp } from './state';

/**
 * The person in the header. Opens a menu with the profile, the demo "switch user" list (this is how the user type is
 * changed in the pre-build, since there is no sign-in) and sign out.
 */
export function ProfileMenu({ flags }: { flags?: number }) {
  const { me, switchUser, signOut } = useApp();
  const access = useAccess();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const directory = useQuery({ queryKey: ['directory'], queryFn: () => request<DirectoryUser[]>('/directory'), enabled: open && !!me });

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const name = me?.name ?? 'Project team';
  const sub = me ? [me.isAdmin ? 'Administrator' : null, access.role ?? 'No project role'].filter(Boolean).join(' · ') : flags ? `${flags} open flags` : 'Demo user';
  const go = (to: string) => { setOpen(false); navigate(to); };

  return (
    <div className="profile-menu" ref={box}>
      <button type="button" className="identity profile-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={`${name}: open the profile menu`} onClick={() => setOpen(o => !o)}>
        <span className="avatar teal" title={name}>{initials(name)}</span>
        <span className="identity-text">
          <strong>{name}</strong>
          <span className="muted">{sub}</span>
        </span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div className="profile-pop" role="menu" aria-label="Profile menu">
          <div className="profile-pop-head">
            <span className="avatar teal big">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              {me?.email && <small>{me.email}</small>}
              <div className="profile-pop-tags">
                {me?.party && <span className="chip-tag">{me.party}</span>}
                {me?.title && <span className="chip-tag soft">{me.title}</span>}
              </div>
            </div>
          </div>
          {me && <button type="button" role="menuitem" className="pop-item" onClick={() => go('/profile')}><Icon name="user" />My profile</button>}
          {me && (
            <div className="pop-section" role="group" aria-label="Switch user type">
              <div className="pop-label">Switch user type</div>
              {directory.isPending ? <div className="pop-note">Loading…</div> : (directory.data ?? []).map(u => (
                <button key={u.id} type="button" role="menuitemradio" aria-checked={u.id === me.id} className={`pop-item ${u.id === me.id ? 'on' : ''}`}
                  onClick={() => { setOpen(false); if (u.id !== me.id) { switchUser(u.id); navigate('/'); } }}>
                  <span className="avatar mini">{initials(u.name)}</span>
                  <span className="pop-user"><span>{u.name}</span>{(u.party || u.title) && <small>{[u.party, u.title].filter(Boolean).join(' · ')}</small>}</span>
                  {u.id === me.id && <Icon name="tick" />}
                </button>
              ))}
            </div>
          )}
          {me && <button type="button" role="menuitem" className="pop-item danger" onClick={() => { setOpen(false); signOut(); }}><Icon name="switch" />Sign out</button>}
        </div>
      )}
    </div>
  );
}
