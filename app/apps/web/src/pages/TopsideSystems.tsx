import { useMemo, useState } from 'react';
import { Icon } from '../icons';

export interface Discipline { id: string; name: string; color: string; triangles: number }
export interface LevelEntry { n: number; disc: string; group: string; item: string | null; triangles: number; decks: string[] }
/** What is highlighted inside a discipline (Level 2): a whole group, one entry of it (a pipe line), or one listed equipment. */
export type EntryPick = { kind: 'group'; group: string } | { kind: 'level'; n: number } | { kind: 'tag'; tag: string } | null;
export const EQUIPMENT_GROUP = 'Equipment';
/** Not a group of the model: the hand-operated valves of every line of a piping discipline, each also an item of its own line. */
export const MANUAL_VALVES = 'Manual valves';

const k = (t: number) => (t >= 1000 ? `${(t / 1000).toFixed(t >= 100000 ? 0 : 1)}k` : String(t));

interface Props {
  disciplines: Discipline[];
  levels: LevelEntry[];
  /** The listed equipment that is modelled: Level 2 of Mechanical. */
  equipment: { tag: string; name: string | null; deck: string }[];
  disc: string | null;
  pick: EntryPick;
  onDisc: (id: string | null) => void;
  onPick: (p: EntryPick) => void;
}

/** The second level of the system highlight: what a discipline is made of (the kinds of item, the service and line of a pipe, the equipment tags). */
export function TopsideSystems({ disciplines, levels, equipment, disc, pick, onDisc, onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const current = disciplines.find(d => d.id === disc) ?? null;
  const groups = useMemo(() => {
    if (!disc) return [];
    const m = new Map<string, { group: string; items: { key: string; label: string; sub: string; pick: EntryPick; tri: number }[]; tri: number }>();
    const add = (group: string) => m.get(group) ?? (m.set(group, { group, items: [], tri: 0 }), m.get(group)!);
    for (const l of levels) {
      if (l.disc !== disc) continue;
      const g = add(l.group);
      g.tri += l.triangles;
      if (l.item) g.items.push({ key: `n${l.n}`, label: l.item, sub: l.decks.length > 1 ? `${l.decks.length} decks` : '', pick: { kind: 'level', n: l.n }, tri: l.triangles });
    }
    if (disc === 'steel_piping' || disc === 'frp_piping') add(MANUAL_VALVES);
    if (disc === 'mechanical') {
      const g = add(EQUIPMENT_GROUP);
      for (const e of equipment) g.items.push({ key: e.tag, label: e.tag, sub: e.name ?? '', pick: { kind: 'tag', tag: e.tag }, tri: 0 });
    }
    return [...m.values()].sort((a, b) => (a.group === EQUIPMENT_GROUP || a.group === MANUAL_VALVES ? -1 : b.group === EQUIPMENT_GROUP || b.group === MANUAL_VALVES ? 1 : a.group.localeCompare(b.group, undefined, { numeric: true })));
  }, [levels, equipment, disc]);
  const needle = q.trim().toLowerCase();
  const toggle = (g: string) => setOpen(o => { const n = new Set(o); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  const isOn = (p: EntryPick) => !!pick && !!p && JSON.stringify(pick) === JSON.stringify(p);

  if (!current) {
    return (
      <div className="fl-groups">
        <p className="tiny muted fl-sys-hint">Pick a discipline here or in the chips above the model to highlight it in every deck; then pick what it is made of.</p>
        <ul className="fl-sys-list">
          {disciplines.map(d => (
            <li key={d.id}>
              <button type="button" className="fl-sys-row" onClick={() => { onDisc(d.id); onPick(null); }}>
                <i className="fl-dot" style={{ background: d.color }} aria-hidden="true" /><span className="fl-sys-name">{d.name}</span>
                <span className="muted tiny">{levels.filter(l => l.disc === d.id).length || (d.id === 'mechanical' ? equipment.length : 1)} · {k(d.triangles)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="fl-groups">
      <div className="fl-sys-head">
        <button type="button" className="link-button" onClick={() => { onDisc(null); onPick(null); }}><Icon name="chevron-left" />All disciplines</button>
        <strong><i className="fl-dot" style={{ background: current.color }} aria-hidden="true" /> {current.name}</strong>
        {pick && <button type="button" className="link-button tiny" onClick={() => onPick(null)}>Show the whole discipline</button>}
      </div>
      <label className="search fl-sys-search"><Icon name="search" /><input placeholder="Search line, group or tag…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search inside the discipline" /></label>
      <ul className="fl-sys-list">
        {groups.map(g => {
          const hits = needle ? g.items.filter(i => i.label.toLowerCase().includes(needle) || i.sub.toLowerCase().includes(needle)) : g.items;
          if (needle && !hits.length && !g.group.toLowerCase().includes(needle)) return null;
          const expandable = g.items.length > 0;
          const isOpen = expandable && (open.has(g.group) || !!needle);
          const gp: EntryPick = { kind: 'group', group: g.group };
          return (
            <li key={g.group}>
              <div className={`fl-sys-row${isOn(gp) ? ' selected' : ''}`}>
                {expandable ? <button type="button" className="icon-btn" aria-expanded={isOpen} aria-label={`${isOpen ? 'Fold' : 'Unfold'} ${g.group}`} onClick={() => toggle(g.group)}><Icon name={isOpen ? 'chevron-down' : 'chevron-right'} /></button> : <span className="fl-sys-gap" />}
                <button type="button" className="fl-sys-name" onClick={() => onPick(isOn(gp) ? null : gp)} aria-pressed={isOn(gp)}>{g.group}</button>
                <span className="muted tiny">{expandable ? `${g.items.length} · ` : ''}{g.tri ? k(g.tri) : ''}</span>
              </div>
              {isOpen && (
                <ul className="fl-sys-items">
                  {hits.map(i => (
                    <li key={i.key}>
                      <button type="button" className={`fl-sys-item${isOn(i.pick) ? ' selected' : ''}`} aria-pressed={isOn(i.pick)} onClick={() => onPick(isOn(i.pick) ? null : i.pick)}>
                        <span>{i.label}</span><span className="muted tiny">{i.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
