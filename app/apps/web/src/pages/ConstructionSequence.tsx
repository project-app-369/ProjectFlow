import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ViewerControl } from '../FacilityViewer';
import { Icon } from '../icons';
import { lazyPage } from '../lazyPage';
import { usePrefs } from '../state';
import { Btn, ErrorBox, Loading, PageHead, Stat } from '../ui';

const FacilityViewer = lazyPage(() => import('../FacilityViewer'));

type Kind = 'fab' | 'lift' | 'upend' | 'static';
interface Action { deck: string; kind: Kind | 'rollup' | 'move'; label: string }
interface SeqStep { date?: string | null; from?: string | null; id?: string; equipment?: { tag: string; name: string; date: string | null }[] | null; no: number; sheet: number; title: string; items: string[]; actions: Action[] }
interface SeqDeck { fabShift?: Vec3; moveStep?: number; id: string; name: string; step: number | null; kind: Kind; follow: string | null; file: string; parts: Record<string, number>; pivot?: { p: [number, number, number]; dir: number }; rollStep?: number; fabOffset?: number }
interface SeqGroup { id: string; name: string; color: string }
interface Sequence { source: string; name?: string; upright?: boolean; groups: SeqGroup[]; decks: SeqDeck[]; steps: SeqStep[] }

/** The sequences of this page: the jacket is built lying on its side; the topside, its E-House and the DSF stand as built, parts fabricated in a yard are lifted into place. */
const SEQUENCES = [
  { id: 'jacket', label: 'ST-CGF Jacket', sheets: 22, desc: 'How the ST-CGF jacket is fabricated, step by step (drawing 2021-4589-65-4015, Rev 1). The model is split into the components the drawing builds, and they move as it does: the jacket is built lying on its side, each row fabricated face down on the launch cradle and rolled up, framing, pipework and tanks lifted in.' },
  { id: 'topside', label: 'ST-CGF Topside', sheets: 5, desc: 'How the ST-CGF topside is fabricated and assembled (drawing 2021-4591-65-1005, 28 stages): decks, E-House and deck support frame built in the yard and lifted into place, then equipment, E&I, piping and HVAC.' },
  { id: 'ehouse', label: 'E-House', sheets: 2, desc: 'How the E-House module is built (drawing 2021-4591-65-1022, 13 stages): deck levels, walls, supports, equipment and systems level by level.' },
  { id: 'dsf', label: 'DSF', sheets: 3, desc: 'How the deck support frame is fabricated and erected (drawing 261001 Rev B, 12 stages): lower, middle and upper box, cross girders, bracing, tubular frames and timbers.' },
] as const;

const OFFSHORE = 'offshore';
type Vec3 = [number, number, number];
const NO_TAGS: ReadonlySet<string> = new Set();
const NO_COLOURS: Readonly<Record<string, string>> = {};
const noop = () => undefined;
/** Seconds each motion takes at normal speed. */
const SECONDS: Record<Action['kind'], number> = { fab: 0.9, lift: 1.7, upend: 3.4, rollup: 4, move: 3, static: 0 };
const LIFT = 16; // metres a part is lifted from before it is set down
const GAP = 0.25;
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

type Mat = number[][];
const ident = (): Mat => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
const mul = (a: Mat, b: Mat): Mat => a.map((_, i) => b[0].map((__, j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j]));
const move = (x: number, y: number, z: number): Mat => { const m = ident(); m[0][3] = x; m[1][3] = y; m[2][3] = z; return m; };
/** About the model's vertical axis (the jacket's height). */
const turnY = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]; };
/** About the horizontal axis along the jacket's length: lays the jacket on its side (the leg row on the -X side, over the launch cradle, goes down). */
const turnZ = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]; };
/** Column-major, as the viewer wants it. */
const flat = (m: Mat) => [0, 1, 2, 3].flatMap(c => [m[0][c], m[1][c], m[2][c], m[3][c]]);

/** The step list of the drawing: top-level lines are numbered, "- " and "+ " lines are its sub-steps. */
function StepItems({ items }: { items: string[] }) {
  let n = 0;
  return (
    <ol className="seq-items">
      {items.map((raw, i) => {
        const level = raw.startsWith('+ ') ? 2 : raw.startsWith('- ') ? 1 : 0;
        const text = level ? raw.slice(2) : raw;
        const rev = /\(rev1(?::[^)]*)?\)\s*$/.test(text);
        const body = rev ? text.replace(/\s*\(rev1(?::\s*([^)]*))?\)\s*$/, (_m, why) => (why ? ` (${why})` : '')) : text;
        if (!level) n++;
        return (
          <li key={i} className={`seq-item l${level}`} value={level ? undefined : n}>
            <span>{body}</span>{rev && <em className="seq-rev" title="Changed in Rev 1 of the drawing">Rev 1</em>}
          </li>
        );
      })}
    </ol>
  );
}

interface Frame { visible: Set<string>; matrix: Map<string, number[] | null>; active: number }

/**
 * Where every component is at second `t` of step `step`: not yet there, lying on the ground, being lifted in, being rolled up or upended, or in place.
 * The whole jacket is built lying on its side, standing on its -X leg row, on the launch cradle (`lay` 1; 0 turns it upright, as installed). A row (and what rides on it) lies
 * face down on the launch cradle until its roll-up, which turns it about that leg row until its plane stands vertical.
 */
function snapshot(seq: Sequence, byId: Map<string, SeqDeck>, step: number, t: number, lay: number): Frame {
  const upright = !!seq.upright;
  const visible = new Set<string>();
  const matrix = new Map<string, number[] | null>();
  const timeline = new Map<string, { start: number; end: number }[]>(); // per step, action windows
  const windows = (s: SeqStep) => timeline.get(String(s.no)) ?? (() => { let at = 0; const w = s.actions.map(a => { const x = { start: at, end: at + SECONDS[a.kind] }; at = x.end + GAP; return x; }); timeline.set(String(s.no), w); return w; })();
  /** -1 not started, 0..1 running, 1 done, for the action of kind `kinds` on a deck. */
  const progress = (deck: string, kinds: Action['kind'][]) => {
    for (const s of seq.steps) {
      const k = s.actions.findIndex(a => a.deck === deck && kinds.includes(a.kind));
      if (k < 0) continue;
      if (s.no < step) return 1;
      if (s.no > step) return -1;
      const w = windows(s)[k];
      return t < w.start ? -1 : w.end <= w.start ? 1 : Math.min(1, (t - w.start) / (w.end - w.start));
    }
    return NaN; // no such action
  };
  /** How far (in model Y) a lying frame still is from its launch cradle: it is rolled up where it was built, then moved onto it. */
  const offset = (d: SeqDeck): number => {
    const owner = d.follow ? byId.get(d.follow)! : d;
    if (!owner.fabOffset) return 0;
    const p = progress(owner.id, ['move']);
    return owner.fabOffset * (Number.isNaN(p) || p < 0 ? 1 : 1 - ease(p));
  };
  const flatness = (d: SeqDeck): { f: number; pivot?: SeqDeck['pivot'] } => {
    const owner = d.follow ? byId.get(d.follow)! : d;
    if (!owner.pivot) return { f: 0 };
    const roll = progress(owner.id, ['rollup']);
    const done = Number.isNaN(roll) ? 0 : roll;
    return { f: done < 0 ? 1 : 1 - ease(done), pivot: owner.pivot };
  };
  for (const d of seq.decks) {
    const appear = d.kind === 'static' ? 1 : d.id === OFFSHORE ? -1 : progress(d.id, ['fab', 'lift']);
    if (Number.isNaN(appear) || appear < 0) continue;
    if ((d.id === 'ground' || d.id === 'skid') && lay < 0.5) continue; // the cradle is only drawn for the jacket lying on its side
    visible.add(d.id);
    const { f, pivot } = flatness(d);
    const lift = d.kind === 'lift' ? (1 - ease(appear)) * LIFT : 0;
    let m = upright ? move(0, lift, 0) : move(lift, 0, 0); // up, while lying on its side, is the model's +X (the cradle is under the -X leg row)
    if (pivot && f) {
      const [px, py, pz] = pivot.p;
      m = mul(mul(mul(move(px, py, pz), turnY(pivot.dir * (Math.PI / 2) * f)), move(-px, -py, -pz)), m);
    }
    const shift = upright ? 0 : offset(d); // the model's Y runs along the viewer's -Z
    if (shift) m = mul(move(0, 0, -shift), m);
    let yard = 0;
    if (upright && d.fabShift) { // fabricated in the yard, lifted and moved into place at its install step
      const p = progress(d.id, ['move']);
      yard = Number.isNaN(p) || p < 0 ? 1 : 1 - ease(p);
      if (yard) m = mul(move(d.fabShift[0] * yard, d.fabShift[1] * yard + Math.sin(Math.PI * (1 - yard)) * LIFT * 0.5, d.fabShift[2] * yard), m);
    }
    if (lay) m = mul(turnZ((Math.PI / 2) * lay), m);
    matrix.set(d.id, lay === 0 && !f && !lift && !shift && !yard ? null : flat(m));
  }
  const cur = seq.steps.find(s => s.no === step);
  const w = cur ? windows(cur) : [];
  const active = w.findIndex(x => t >= x.start && t <= x.end + GAP);
  return { visible, matrix, active };
}

const totalSeconds = (s: SeqStep | undefined) => (s && s.actions.length ? s.actions.reduce((a, x) => a + SECONDS[x.kind] + GAP, 0) : 0);

/** Construction → Construction Sequence: the fabrication sequence of the ST-CGF jacket (drawing 2021-4589-65-4015), step by step, with the components of the model moving as the drawing builds them. */
export default function ConstructionSequence() {
  const { dark } = usePrefs();
  const [params, setParams] = useSearchParams();
  const sid = SEQUENCES.find(x => x.id === params.get('sequence'))?.id ?? 'jacket';
  const info = SEQUENCES.find(x => x.id === sid)!;
  const seq = useQuery({
    queryKey: ['sequence', sid, 3],
    queryFn: async () => {
      const r = await fetch(`${import.meta.env.BASE_URL}sequence/${sid}/sequence.json`, { cache: 'no-cache' });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('The sequence files have not been built yet (data/3d-model/pipeline).');
      return (await r.json()) as Sequence;
    },
    staleTime: 60_000,
  });
  const data = seq.data;
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState(true);
  const [offshore, setOffshore] = useState(false);
  const [upright, setUpright] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLOListElement>(null);
  const control = useRef<ViewerControl | null>(null);
  const clock = useRef({ t: 0, running: false, dirty: true, fitted: false, last: 0, lay: 1, layTo: 1, refit: false });
  const live = useRef({ playing, speed, offshore });
  live.current = { playing, speed, offshore };

  const steps = data?.steps ?? [];
  const now = current ?? steps.find(s => s.actions.length)?.no ?? 1;
  const step = steps.find(s => s.no === now);
  const last = steps.length;
  const byId = useMemo(() => new Map((data?.decks ?? []).map(d => [d.id, d])), [data]);
  const decks = useMemo(() => (data?.decks ?? []).map(d => ({ id: d.id, name: d.name, url: new URL(`${import.meta.env.BASE_URL}sequence/${sid}/${d.file}`, document.baseURI).href })), [data, sid]);

  /** Starts the motion of a step from its beginning (or shows it finished). */
  const show = useCallback((n: number, animate: boolean) => {
    const s = steps.find(x => x.no === n);
    clock.current.t = animate ? 0 : totalSeconds(s);
    clock.current.running = animate && !!s?.actions.length;
    clock.current.dirty = true;
    setCurrent(n);
  }, [steps]);
  const go = (n: number) => { setPlaying(false); show(Math.min(Math.max(n, 1), last || 1), true); };

  // one loop moves everything: time advances, the components are placed, and the page hears of what appeared
  useEffect(() => {
    if (!data) return;
    let raf = 0;
    let prevControl: ViewerControl | null = null;
    const sent = new Map<string, string>();
    let shownKey = '';
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const c = clock.current;
      const dt = c.last ? Math.min(0.5, (ts - c.last) / 1000) : 0;
      c.last = ts;
      const stepNo = stepRef.current;
      const s = data.steps.find(x => x.no === stepNo);
      if (c.running) {
        c.t += dt * live.current.speed;
        c.dirty = true;
        if (c.t >= totalSeconds(s)) {
          c.t = totalSeconds(s); c.running = false;
          if (live.current.playing) setTimeout(() => { if (!live.current.playing) return; if (stepNo >= data.steps.length) setPlaying(false); else { stepRef.current = stepNo + 1; show(stepNo + 1, true); } }, 700 / live.current.speed);
        }
      }
      if (c.lay !== c.layTo) {
        const dir = Math.sign(c.layTo - c.lay);
        c.lay = Math.min(1, Math.max(0, c.lay + (dir * dt * live.current.speed) / 2.5));
        if (Math.abs(c.lay - c.layTo) < 1e-3) { c.lay = c.layTo; c.refit = true; }
        c.dirty = true;
      }
      const ctl = control.current;
      if (ctl !== prevControl) { prevControl = ctl; c.dirty = true; sent.clear(); }
      if (!c.dirty) return;
      c.dirty = false;
      const f = snapshot(data, byId, stepNo, c.t, ease(c.lay));
      const ids = [...f.visible].filter(id => id !== OFFSHORE).sort().join();
      if (ids !== shownKey) { shownKey = ids; setShown(new Set(f.visible)); }
      setActive(a => (a === f.active ? a : f.active));
      if (!ctl) return;
      for (const d of data.decks) {
        const m = f.matrix.get(d.id);
        const key = m ? m.map(v => v.toFixed(3)).join() : '';
        if (sent.get(d.id) === key) continue;
        sent.set(d.id, key);
        ctl.setTransform(d.id, m ?? null);
      }
      if (!c.fitted || c.refit) { c.fitted = true; c.refit = false; ctl.fit(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [data, byId, show]);
  const stepRef = useRef(now);
  stepRef.current = now;
  useEffect(() => { clock.current.dirty = true; }, [now]);
  useEffect(() => { // a new sequence starts from its first step, with the jacket lying down only for the jacket
    const c = clock.current; c.lay = c.layTo = sid === 'jacket' ? 1 : 0; c.fitted = false; c.t = 0; c.running = false; setCurrent(null); setPlaying(false); setUpright(false);
  }, [sid]);
  useEffect(() => { if (data && current === null) show(now, true); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' }); }, [now]);

  const visible = useMemo(() => { const v = new Set(shown); if (offshore && data?.decks.some(d => d.id === OFFSHORE)) v.add(OFFSHORE); else v.delete(OFFSHORE); return v; }, [shown, offshore, data]);
  const highlight = useMemo(() => (focus && step?.actions.length ? new Set(step.actions.map(a => a.deck)) : null), [focus, step]);
  const groupName = (id: string) => data?.groups.find(g => g.id === id)?.name ?? id[0].toUpperCase() + id.slice(1);
  const groupColour = (id: string) => data?.groups.find(g => g.id === id)?.color ?? '#8b95a7';
  const stepParts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of step?.actions ?? []) if (a.kind !== 'rollup') for (const [g, n] of Object.entries(byId.get(a.deck)?.parts ?? {})) out[g] = (out[g] ?? 0) + n;
    return out;
  }, [step, byId]);
  const modelDecks = (data?.decks ?? []).filter(d => d.step !== null && d.kind !== 'static' && d.id !== 'skid' && !d.id.startsWith('cradle-'));
  const count = (d: SeqDeck) => Object.values(d.parts).reduce((a, b) => a + b, 0);
  const built = modelDecks.filter(d => (d.step ?? 99) <= now).reduce((s, d) => s + count(d), 0);
  const total = modelDecks.reduce((s, d) => s + count(d), 0);
  const rev1 = steps.filter(s => s.items.some(i => /\(rev1/.test(i))).length;
  const running = clock.current.running;

  return (
    <>
      <PageHead title="Construction sequence" desc={info.desc}
        actions={<Btn kind="small" icon="refresh" onClick={() => void seq.refetch()}>Refresh</Btn>} />
      <div className="stats">
        <Stat label="Steps" value={data ? last : '—'} foot={data ? `${steps.filter(s => s.actions.length).length} move components of the model` : `Fabrication sequence · ${info.label}`} icon="layers" />
        <Stat label="Components" value={data ? modelDecks.length : '—'} foot={sid === 'jacket' ? 'Rows, framing, diagonals, pipework, tanks…' : 'Decks, platforms, equipment, systems…'} icon="box" />
        <Stat label="Built so far" value={data ? built.toLocaleString('en-GB') : '—'} foot={data ? `of ${total.toLocaleString('en-GB')} model parts, after step ${now}` : ''} icon="chart" />
        {sid === 'jacket' ? <Stat label="Changed in Rev 1" value={data ? rev1 : '—'} foot="Steps with clouded changes on the drawing" icon="edit" />
          : <Stat label="Lifted into place" value={data ? data.decks.filter(d => d.moveStep).length : '—'} foot="Built in the yard first, then lifted and moved" icon="edit" />}
      </div>

      {seq.error ? <ErrorBox error={seq.error} /> : !data ? <Loading label="Loading the sequence…" /> : (
        <div className="fl-grid">
          <div className="panel fl-view">
            <div className="panel-head">
              <div><h2>{info.label} · step {now} of {last}</h2><p>{step?.title}. Drag to orbit, right-drag to pan, scroll to zoom.</p></div>
              <div className="actions">
                <Btn kind="small" icon="chevron-left" iconOnly aria-label="Previous step" disabled={now <= 1} onClick={() => go(now - 1)} />
                <Btn kind="small primary" onClick={() => { if (playing) setPlaying(false); else { setPlaying(true); show(now >= last ? 1 : now, true); } }}>{playing ? 'Pause' : 'Play all'}</Btn>
                <Btn kind="small" icon="refresh" iconOnly aria-label="Replay this step" onClick={() => go(now)} />
                <Btn kind="small" icon="chevron-right" iconOnly aria-label="Next step" disabled={now >= last} onClick={() => go(now + 1)} />
              </div>
            </div>
            <div className="seq-scrub">
              <input type="range" min={1} max={last} step={1} value={now} aria-label="Step" onChange={e => go(Number(e.target.value))} />
            </div>
            <div className="chip-bar" role="group" aria-label="Sequence">
              {SEQUENCES.map(x => <button key={x.id} type="button" className={`chip-filter ${sid === x.id ? 'active' : ''}`} aria-pressed={sid === x.id} onClick={() => { const q = new URLSearchParams(params); q.set('sequence', x.id); setParams(q, { replace: true }); }}>{x.label}</button>)}
            </div>
            <div className="chip-bar" role="group" aria-label="View">
              <button type="button" className={`chip-filter ${focus ? 'active' : ''}`} aria-pressed={focus} onClick={() => setFocus(f => !f)} title="Show this step's components in colour and the rest in grey">Highlight this step</button>
              {data.decks.some(d => d.id === OFFSHORE) && <button type="button" className={`chip-filter ${offshore ? 'active' : ''}`} aria-pressed={offshore} onClick={() => setOffshore(o => !o)} title="Piles and conductors are installed offshore, not in the yard">Piles &amp; conductors (offshore)</button>}
              {sid === 'jacket' && <button type="button" className={`chip-filter ${upright ? 'active' : ''}`} aria-pressed={upright} onClick={() => { const u = !upright; setUpright(u); clock.current.layTo = u ? 0 : 1; }} title="The jacket is built lying on its side; show it standing as installed">Installed position (upright)</button>}
              <button type="button" className="chip-filter" onClick={() => control.current?.fit()}>Fit view</button>
              <label className="seq-speed">Speed <select className="filter" value={speed} aria-label="Animation speed" onChange={e => setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
            </div>
            <div className="fl-stage-wrap">
              <Suspense fallback={<Loading label="Loading the 3D viewer…" />}>
                <FacilityViewer decks={decks} tags={NO_TAGS} visible={visible} selected={null} colors={NO_COLOURS} highlight={highlight} controlRef={control} dark={dark} onPick={noop} />
              </Suspense>
              {step && step.actions[active] && <div className="seq-caption" role="status">{step.actions[active].label}</div>}
            </div>
            <div className="fl-legend" aria-label="Parts moved in this step">
              {step?.actions.length ? Object.entries(stepParts).map(([g, n]) => <span key={g}><i className="fl-dot" style={{ background: groupColour(g) }} aria-hidden="true" />{groupName(g)} <b>{n.toLocaleString('en-GB')}</b></span>)
                : <span>This step moves no components of the model (temporary works, tests or preparation).</span>}
            </div>
            {sid === 'jacket' ? <p className="tiny muted seq-note">The model carries no construction-sequence data, so each part is given to a component from where it stands: the four frames (Row 2, 2.1, 5.1 and 5 along the jacket), the bays between them, the elevation of the framing, and the Navisworks sets of the jacket. The jacket is built lying on its side on the launch cradles, each row face down and then rolled up about the leg row on the launch cradle (the -X side). The ground and skid ways are only drawn to show this.</p>
              : <p className="tiny muted seq-note">The parts are given to a stage from the Selection Sets the model carries (decks, E-House, platforms, crane, equipment by tag) and from the discipline and deck of each zone. Parts built in a yard (decks, E-House, deck support frame, platforms) stand east of the platform until the stage that lifts them in. Small fittings (bolts, clamps, cut-outs) are left out to keep the model light.</p>}
          </div>

          <div className="panel fl-list">
            <div className="panel-head"><div><h2>Steps</h2><p>{data.source}</p></div></div>
            <ol className="seq-steps" ref={list}>
              {steps.map(s => (
                <li key={s.no} className={`seq-step ${s.no === now ? 'on' : ''} ${s.no < now ? 'done' : ''}`} aria-current={s.no === now ? 'step' : undefined}>
                  <button type="button" className="seq-head" onClick={() => go(s.no)} aria-expanded={s.no === now}>
                    <span className="seq-no">{s.no}</span>
                    <span className="seq-title">{s.title}</span>
                    {s.actions.length ? <i className="seq-3d" title="Moves components of the model"><Icon name="box" /></i> : null}
                  </button>
                  {s.no === now && (
                    <div className="seq-body">
                      <p className="tiny muted">Sheet {s.sheet} of {info.sheets}{s.date ? ` · tentative lifting date ${s.date}` : s.from ? ` · from ${s.from}` : ''}</p>
                      {s.actions.length > 0 && (
                        <>
                          <h3 className="seq-sub">Components in this step</h3>
                          <ol className="seq-acts">
                            {s.actions.map((a, i) => (
                              <li key={i} className={`${i === active && running ? 'now' : ''} ${(running ? i < active : true) ? 'done' : ''}`}><span className={`seq-kind ${a.kind}`}>{a.kind === 'rollup' ? 'roll up' : a.kind === 'move' ? 'move' : a.kind === 'fab' ? 'fabricate' : a.kind === 'upend' ? 'upend' : 'lift'}</span> {byId.get(a.deck)?.name}</li>
                            ))}
                          </ol>
                        </>
                      )}
                      <h3 className="seq-sub">Drawing, sheet {s.sheet}</h3>
                      <StepItems items={s.items} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
