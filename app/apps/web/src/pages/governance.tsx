import type { ReactNode } from 'react';
import { Icon } from '../icons';

/** A filter that shows only an icon and its current choice; the label is the tooltip and the accessible name. */
export function IconFilter({ icon, label, value, onChange, children }: { icon: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="task-filter" title={label}>
      <Icon name={icon} />
      <select className="filter" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

/** A risk level as a coloured pill; the level names come from the project's matrix. */
export function LevelPill({ level, score, title }: { level: string | null; score?: number | null; title?: string }) {
  if (!level) return <span className="tiny muted" title={title ?? 'Not rated'}>—</span>;
  return <span className={`pill level-${level.toLowerCase()}`} title={title}>{level}{score != null ? ` · ${score}` : ''}</span>;
}

export const initials = (name: string) => name.replace(/@.*/, '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

/** People as small initials discs, the full names in the tooltip. */
export function People({ names, empty = 'Nobody assigned' }: { names: string[]; empty?: string }) {
  if (!names.length) return <span className="tiny warning" title={empty}><Icon name="people" /></span>;
  return (
    <span className="avatars" title={names.join('\n')}>
      {names.slice(0, 3).map(n => <span key={n} className="avatar">{initials(n)}</span>)}
      {names.length > 3 && <span className="avatar more">+{names.length - 3}</span>}
    </span>
  );
}

/** Read-only text block for drawers: label above, value kept with its line breaks. */
export function Detail({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <div style={full ? { gridColumn: '1 / -1' } : undefined}><small>{label}</small><strong style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{children || '—'}</strong></div>;
}
