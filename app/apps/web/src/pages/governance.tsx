import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DISCIPLINE_NAME, DISCIPLINES, disciplineList } from '../disciplines';
import { Icon } from '../icons';
import type { StateTone } from '../ui';

/** A filter that shows only an icon and its current choice; the label is the tooltip and the accessible name. */
export function IconFilter({ icon, label, value, onChange, children }: { icon: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="task-filter" title={label}>
      <Icon name={icon} />
      <select className="filter" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

/** Several values can be ticked: the chosen ones travel as one string joined with `|`, which the registers' API reads as "any of". */
export const pickedOf = (value: string) => (value ? value.split('|') : []);

/** A dropdown with a checkbox per option: each reads "CODE - Full name" with the code in bold; the summary shows the codes only. */
function DisciplineDropdown({ icon, label, allLabel, options, value, onChange, disabled, form }: { icon?: string; label: string; allLabel: string; options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean; form?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const picked = pickedOf(value);
  useEffect(() => {
    const close = (e: Event) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const toggle = (o: string) => onChange(options.filter(k => (k === o ? !picked.includes(k) : picked.includes(k))).join('|'));
  return (
    <details className={`task-filter multi-filter${form ? ' multi-form' : ''}`} ref={ref} title={label} onClick={e => { if (disabled) e.preventDefault(); }}>
      <summary className="filter" aria-label={label}>{icon && <Icon name={icon} />}<span>{picked.length === 0 ? allLabel : picked.join(', ')}</span></summary>
      <div className="multi-pop" role="group" aria-label={label}>
        <button type="button" className="btn text small" disabled={!picked.length} onClick={() => onChange('')}>Clear selection</button>
        {options.map(o => (
          <label key={o} className="multi-opt"><input type="checkbox" checked={picked.includes(o)} onChange={() => toggle(o)} /><span><strong>{o}</strong>{DISCIPLINE_NAME[o] ? ` - ${DISCIPLINE_NAME[o]}` : ''}</span></label>
        ))}
      </div>
    </details>
  );
}

/** The filter of a register: tick one or more; the chosen codes travel as one string joined with `|`, which the API reads as "any of". */
export function MultiFilter(props: { icon: string; label: string; allLabel: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return <DisciplineDropdown {...props} />;
}

/** The discipline codes of one item, picked from the standard list in a dropdown; saved as the codes joined with ", ". */
export function DisciplinePicker({ value, onChange, disabled, label = 'Discipline' }: { value: string; onChange: (v: string) => void; disabled?: boolean; label?: string }) {
  return <DisciplineDropdown form label={label} allLabel="Select…" disabled={disabled} options={DISCIPLINES.map(([c]) => c)} value={disciplineList(value).join('|')} onChange={v => onChange(pickedOf(v).join(', '))} />;
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

/** Tones of the states shown in the drawers (the same colour language as the registers: grey, blue, amber, green, red). */
export const ISSUE_PRIORITY_TONE: Record<string, StateTone> = { Critical: 'crit', High: 'warn', Medium: 'info', Low: 'neutral' };
export const ISSUE_STATUS_TONE: Record<string, StateTone> = { 'Not started': 'neutral', Pending: 'info', 'In progress': 'warn', Completed: 'ok' };

/**
 * A dropdown of choices, each written as icon + text in its own full colour. The current one is shown on the button; in the open
 * list it is highlighted in mild green. `clearable` adds an empty choice.
 */
export function StateSelect({ label, value, options, onChange, clearable, disabled, empty = 'Not set' }: {
  label: string; value: string | null; options: { value: string; label: string; icon: string; tone: StateTone }[]; onChange: (v: string | null) => void; clearable?: boolean; disabled?: boolean; empty?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const current = options.find(o => o.value === value);
  const choose = (v: string | null) => { setOpen(false); if (v !== value) onChange(v); };
  return (
    <div className="state-select" ref={box}>
      <button type="button" className={`state-select-btn${current ? ` t-${current.tone}` : ''}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current?.label ?? empty}`} title={label} onClick={() => setOpen(o => !o)}>
        {current ? <><Icon name={current.icon} /><span>{current.label}</span></> : <span className="muted">{empty}</span>}
        <Icon name="chevron-down" />
      </button>
      {open && (
        <ul className="state-select-menu" role="listbox" aria-label={label}>
          {clearable && <li><button type="button" role="option" aria-selected={!value} className={`state-opt${!value ? ' on' : ''}`} onClick={() => choose(null)}><span className="muted">{empty}</span></button></li>}
          {options.map(o => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === value} className={`state-opt t-${o.tone}${o.value === value ? ' on' : ''}`} onClick={() => choose(o.value)}>
                <Icon name={o.icon} /><span>{o.label}</span>{o.value === value && <Icon name="tick" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A short fixed choice as a row of icon buttons; the label is the tooltip and the accessible name. Choosing the current one clears it when `clearable`. */
export function IconChoice<T extends string | number>({ label, value, options, onChange, clearable, disabled }: {
  label: string; value: T | null | ''; options: { value: T; label: string; icon?: string; text?: string }[]; onChange: (v: T | null) => void; clearable?: boolean; disabled?: boolean;
}) {
  return (
    <div className="icon-choice" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} type="button" disabled={disabled} className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} title={o.label} aria-label={o.label}
          onClick={() => onChange(clearable && value === o.value ? null : o.value)}>
          {o.icon ? <Icon name={o.icon} /> : <span>{o.text ?? o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/** A select led by an icon, for long lists that cannot be buttons. The label is the tooltip and the accessible name. */
export function IconSelect({ icon, label, value, onChange, disabled, children }: { icon: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className="icon-select" title={label}>
      <Icon name={icon} />
      <select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

/** One labelled row of a form: a small icon and caption on the left, the control on the right. */
export function Row({ icon, label, children, hint }: { icon: string; label: string; children: ReactNode; hint?: string }) {
  return <div className="gov-row" title={hint}><span className="gov-row-label"><Icon name={icon} />{label}</span><div className="gov-row-body">{children}</div></div>;
}

/** Text kept as one item per line in a single cell. A leading "1." typed in the workbook is dropped: the list numbers itself. */
export const toItems = (s: string | null | undefined) => String(s ?? '').split(/\r?\n/).map(x => x.trim().replace(/^\d{1,2}[.)]\s+/, '')).filter(Boolean);
export const fromItems = (items: string[]) => items.join('\n');

/**
 * A list of text items you can add to, edit, remove and re-order (arrows or drag). Every item shows in full.
 * The value is stored as one item per line, so it stays readable in the sheet.
 */
export function ItemList({ label, icon, value, onChange, disabled, max = 3000, placeholder = 'Add an item' }: { label: string; icon: string; value: string; onChange: (v: string) => void; disabled?: boolean; max?: number; placeholder?: string }) {
  const items = toItems(value);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const commit = (next: string[]) => onChange(fromItems(next));
  const room = max - fromItems(items).length;
  const add = () => { const t = draft.trim().replace(/\s*\n\s*/g, ' '); if (!t || t.length + 1 > room) return; commit([...items, t]); setDraft(''); };
  const move = (from: number, to: number) => { if (to < 0 || to >= items.length || from === to) return; const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); commit(next); };
  const save = () => { if (editing == null) return; const t = text.trim().replace(/\s*\n\s*/g, ' '); commit(t ? items.map((x, i) => (i === editing ? t : x)) : items.filter((_, i) => i !== editing)); setEditing(null); };
  return (
    <section className="item-list" aria-label={label}>
      <h4><Icon name={icon} />{label}<span className="count">{items.length || ''}</span></h4>
      {items.length > 0 && (
        <ol>
          {items.map((it, i) => (
            <li key={`${i}-${it}`} className={drag === i ? 'dragging' : ''} draggable={!disabled && editing == null}
              onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} onDragOver={e => { if (drag != null) e.preventDefault(); }} onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }}>
              <span className="item-no">{i + 1}</span>
              {editing === i ? (
                <textarea className="item-edit" autoFocus rows={Math.max(2, Math.ceil(text.length / 70))} value={text} maxLength={max} aria-label={`Edit ${label} ${i + 1}`} onChange={e => setText(e.target.value)} onBlur={save}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
              ) : (
                <span className="item-text" onDoubleClick={() => { if (!disabled) { setText(it); setEditing(i); } }}>{it}</span>
              )}
              {!disabled && editing !== i && (
                <span className="item-tools">
                  <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${label} ${i + 1}`} onClick={() => { setText(it); setEditing(i); }}><Icon name="edit" /></button>
                  <button type="button" className="icon-btn" title="Move up" aria-label={`Move ${label} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="chevron-up" /></button>
                  <button type="button" className="icon-btn" title="Move down" aria-label={`Move ${label} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><Icon name="chevron-down" /></button>
                  <button type="button" className="icon-btn" title="Remove" aria-label={`Remove ${label} ${i + 1}`} onClick={() => commit(items.filter((_, j) => j !== i))}><Icon name="trash" /></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {!items.length && disabled && <p className="tiny muted">None recorded.</p>}
      {!disabled && (
        <div className="item-add">
          <input value={draft} placeholder={placeholder} aria-label={`New ${label}`} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button type="button" className="icon-btn" title="Add" aria-label={`Add ${label}`} disabled={!draft.trim() || draft.trim().length + 1 > room} onClick={add}><Icon name="plus" /></button>
        </div>
      )}
    </section>
  );
}
