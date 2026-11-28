import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewerControl, ViewerExtra } from '../FacilityViewer';
import { errorText, request, type FacilityEquipment, type FacilityEquipmentResponse } from '../api';
import { useDeepLink } from '../deepLink';
import { diffDays, fmtDate, localToday } from '../format';
import { Icon } from '../icons';
import { lazyPage } from '../lazyPage';
import { useAccess, useApp, usePrefs, useToast } from '../state';
import { Btn, Confirm, ErrorBox, Loading, Modal, PageHead, Stat } from '../ui';
import { FacilityEquipmentForm } from './FacilityEquipmentForm';
import { EQUIPMENT_GROUP, MANUAL_VALVES, TopsideSystems, type Discipline, type EntryPick, type LevelEntry } from './TopsideSystems';

const FacilityViewer = lazyPage(() => import('../FacilityViewer'));

interface DeckFile { id: string; name: string; file: string; bytes: number; equipment: number; elevation?: number }
interface Manifest { decks: DeckFile[]; systems?: { deck: string; disc: string; file: string; bytes: number }[]; units: { tag: string; deck: string; disc?: string; equipment?: boolean }[]; disciplines?: Discipline[]; levels?: LevelEntry[] }

/** The models of the project: the topside is split by deck into equipment, the others by system; both are listed with Tag, name, ROS and ETA. */
type ModelId = 'topside2' | 'jacket' | 'lqm' | 'linkbridge';
/** `slug` is the facility in the address: ?facility=cgf-topside */
const MODELS: { id: ModelId; label: string; slug: string }[] = [{ id: 'topside2', label: 'ST-CGF Topside', slug: 'cgf-topside' }, { id: 'jacket', label: 'ST-CGF Jacket', slug: 'cgf-jacket' }, { id: 'lqm', label: 'LQM#2', slug: 'lqm2' }, { id: 'linkbridge', label: 'Link Bridge', slug: 'link-bridge' }];
/** A system row of the jacket, LQM or link bridge is tagged <prefix>-<group id>; the group id names the part of the 3D model. */
/** The systems of the LQM#2 that run through every floor: a chip highlights one in all floors (nodes named LQ-<floor>-<id>). */
const LQM_SYSTEMS = [
  { id: 'hvac', label: 'HVAC', colour: '#3b82f6' }, { id: 'piping', label: 'Steel piping', colour: '#2f9d83' }, { id: 'piping_frp', label: 'FRP piping', colour: '#9bd14b' },
  { id: 'telecom', label: 'Telecom', colour: '#d4543b' }, { id: 'lighting', label: 'Lighting', colour: '#ffe066' }, { id: 'fg', label: 'Fire & gas', colour: '#f06292' },
  { id: 'e_i', label: 'E&I', colour: '#e5a93a' }, { id: 'safety', label: 'Safety', colour: '#d62839' },
];
/** The equipment list is one for both topside models; the database knows it as the model "topside". */
const dataModel = (m: ModelId): string => (m === 'topside2' ? 'topside' : m);
const groupOf = (tag: string) => tag.replace(/^[A-Za-z]+-/, '');
interface GroupFile { id: string; name: string; file: string; color: string; bytes: number; triangles: number }
interface GroupManifest { name: string; groups: GroupFile[] }
const SOON_DAYS = 14;

type ColourBy = 'delivery' | 'method' | 'none';
type Delivery = 'late' | 'soon' | 'ok' | 'none';
const DELIVERY_LABEL: Record<Delivery, string> = { late: 'ETA after ROS', soon: `Less than ${SOON_DAYS} days to ROS`, ok: 'Arrives in time', none: 'No ROS / ETA yet' };
const DELIVERY_COLOUR: Record<Delivery, string> = { late: '#e5484d', soon: '#f5a524', ok: '#30a46c', none: '#8b95a7' };
const METHOD_COLOUR: Record<string, string> = { 'Lift by Crane': '#3b82f6', Skidding: '#14b8a6' };
const NO_METHOD = '#8b95a7';

/** How the delivery stands against the date the equipment is required on site: the margin is ROS minus ETA, in days. */
export function delivery(i: Pick<FacilityEquipment, 'rosDate' | 'etaDate'>): { state: Delivery; margin: number | null } {
  if (!i.rosDate || !i.etaDate) return { state: 'none', margin: null };
  const margin = diffDays(i.etaDate, i.rosDate);
  return { state: margin < 0 ? 'late' : margin < SOON_DAYS ? 'soon' : 'ok', margin };
}
/** 31 Jan 27: the list is narrow, so dates drop the century. */
const shortDate = (d: string | null) => (d ? fmtDate(d).replace(/ \d{2}(\d{2})$/, ' $1') : '—');
const methodKey = (m: string | null) => (m && /skid/i.test(m) ? 'Skidding' : m && /crane|lift/i.test(m) ? 'Lift by Crane' : null);

const NO_TAGS: ReadonlySet<string> = new Set();
const NO_EXTRA: ViewerExtra[] = [];
const NO_COLOURS: Readonly<Record<string, string>> = {};

function Dot({ colour }: { colour: string }) {
  return <span className="fl-dot" style={{ background: colour }} aria-hidden="true" />;
}

/** Construction → Facility Layout: the CGF topside by deck in 3D (Autodesk viewer), with its large equipment, ROS, ETA and installation method, which are added, edited and deleted here (stored in the database). */
export default function FacilityLayout() {
  const { project } = useApp();
  const { dark } = usePrefs();
  const qc = useQueryClient();
  const access = useAccess();
  const toast = useToast();
  const [editing, setEditing] = useState<FacilityEquipment | null>(null);
  const [removing, setRemoving] = useState<FacilityEquipment | null>(null);
  const [openTag, setOpenTag] = useDeepLink();
  const [filter, setFilter] = useState('');
  const [colourBy, setColourBy] = useState<ColourBy>('delivery');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [params, setParams] = useSearchParams();
  /** The facility shown lives in the address (`?facility=`), so each one has its own link; none given means the topside. */
  const model: ModelId = MODELS.find(m => m.slug === params.get('facility'))?.id ?? 'topside2';
  const [highlight, setHighlight] = useState<string | null>(null);
  const [systemHL, setSystemHL] = useState<string | null>(null);
  /** The topside's own systems: Level 1 is a discipline, Level 2 what inside it is highlighted (a group, a pipe line, a tag). */
  const [discHL, setDiscHL] = useState<string | null>(null);
  const [entryHL, setEntryHL] = useState<EntryPick>(null);
  const [rightTab, setRightTab] = useState<'equipment' | 'systems'>('equipment');
  /** How far apart the deck boxes are pulled, 0 to 100 %. */
  const [apart, setApart] = useState(0);
  const control = useRef<ViewerControl | null>(null);
  const switchModel = (m: ModelId) => {
    setHidden(new Set()); setHighlight(null); setSystemHL(null); setPicked(null); setDiscHL(null); setEntryHL(null); setRightTab('equipment'); setApart(0);
    const p = new URLSearchParams(params);
    p.set('facility', MODELS.find(x => x.id === m)!.slug); p.delete('id');
    setParams(p);
  };
  const [folded, setFolded] = useState<Set<string>>(new Set());
  /** The equipment picked in the 3D model or in the list: highlighted in both. The detail drawer (`?id=`) is a separate step. */
  const [picked, setPicked] = useState<string | null>(null);
  const viewPanel = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  /** Where the browser refuses real full screen (an embedded pane, an iframe), the card fills the window instead. */
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const onChange = () => {
      setFull(document.fullscreenElement === viewPanel.current);
      window.dispatchEvent(new Event('resize')); // the viewer follows its container's size on a window resize
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    window.dispatchEvent(new Event('resize'));
    return () => { document.removeEventListener('keydown', onKey); window.dispatchEvent(new Event('resize')); };
  }, [expanded]);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (expanded) setExpanded(false);
    else if (viewPanel.current?.requestFullscreen) viewPanel.current.requestFullscreen().catch(() => setExpanded(true));
    else setExpanded(true);
  };

  // Edits made by other people reach the page on the next load, when the window is focused again, and every minute.
  const equipment = useQuery({
    queryKey: ['facility-equipment', project.id],
    queryFn: () => request<FacilityEquipmentResponse>(`/projects/${project.id}/construction/facility-layout/equipment`),
    refetchInterval: 60_000,
  });
  /** The topside and the LQM#2 are split by deck / floor into equipment; the jacket and the link bridge by system. */
  const decked = model === 'topside2' || model === 'lqm';
  const manifest = useQuery({
    queryKey: ['facility-manifest', model],
    enabled: decked,
    queryFn: async () => { const r = await fetch(`${import.meta.env.BASE_URL}models/${model}/model.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error('The 3D model files are missing.'); return (await r.json()) as Manifest; },
    staleTime: 60_000, // a rebuilt model must show up: a stale copy in the persisted query cache would list the old decks
  });

  const other = useQuery({
    queryKey: ['model-manifest', model],
    enabled: !decked,
    queryFn: async () => { const r = await fetch(`${import.meta.env.BASE_URL}models/${model}/model.json`, { cache: 'no-cache' }); if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null; return (await r.json()) as GroupManifest; },
    staleTime: 60_000,
  });
  /** A model whose files have not been built yet (the manifest is not there). */
  const notBuilt = !decked && other.isSuccess && other.data === null;
  const modelLabel = MODELS.find(m => m.id === model)!.label;
  const deckWord = model === 'lqm' ? 'floor' : 'deck';

  const base = `/projects/${project.id}/construction/facility-layout/equipment`;
  const refresh = () => qc.invalidateQueries({ queryKey: ['facility-equipment', project.id] });
  const remove = useMutation({
    mutationFn: (tag: string) => request<void>(`${base}/${encodeURIComponent(tag)}`, { method: 'DELETE' }),
    onSuccess: () => { setRemoving(null); setOpenTag(null); refresh(); toast('Equipment deleted.'); },
    onError: (e: Error) => { setRemoving(null); toast(errorText(e)); },
  });

  const items = useMemo(() => (equipment.data?.items ?? []).filter(i => i.model === dataModel(model)), [equipment.data, model]);
  // The address always names the facility; a link to an item (?id=) of another facility switches to that facility.
  useEffect(() => {
    const p = new URLSearchParams(params); // the router's query (window.location.search is empty with hash routes: the facility would be reset to the topside after every switch)
    if (MODELS.some(m => m.slug === p.get('facility'))) return; // the address already names a facility
    const hit = openTag && openTag !== 'new' ? equipment.data?.items.find(i => i.tag === openTag) : undefined;
    // a link to an item, with no facility yet: wait until the list holds the item to know where it is
    if (openTag && openTag !== 'new' && !hit) return;
    p.set('facility', MODELS.find(m => m.id === (hit?.model === 'topside' || !hit ? 'topside2' : hit.model))!.slug);
    setParams(p, { replace: true });
  }, [params, openTag, equipment.data, setParams]);
  /** Every node of the deck files (the viewer finds equipment and highlight parts by name) and, of those, the listed equipment. */
  const inModel = useMemo(() => new Set((manifest.data?.units ?? []).map(u => u.tag)), [manifest.data]);
  const equipmentInModel = useMemo(() => new Set((manifest.data?.units ?? []).filter(u => !u.tag.startsWith('TS-')).map(u => u.tag)), [manifest.data]);
  /** In 3D: a topside equipment is a part of the model; a system row is a group of it. */
  const systemIds = useMemo(() => new Set((other.data?.groups ?? []).map(g => g.id)), [other.data]);
  const modelled = (tag: string) => (decked ? equipmentInModel.has(tag) : systemIds.has(groupOf(tag)));
  const topDecks = manifest.data?.decks ?? [];
  const groupColours = useMemo(() => Object.fromEntries((other.data?.groups ?? []).map(g => [g.id, g.color])), [other.data]);
  const modelDecks = decked ? topDecks : (other.data?.groups ?? []).map(g => ({ id: g.id, name: g.name, file: g.file, bytes: g.bytes, equipment: 0 }));
  const deckNames = useMemo(() => {
    if (!decked) return items.length ? [{ name: items[0].deck, id: null as string | null }] : [];
    const order = new Map(topDecks.map((d, i) => [d.name, i]));
    const ids = new Map(topDecks.map(d => [d.name, d.id]));
    return [...(equipment.data?.decks ?? [])]
      .filter(name => (equipment.data?.items ?? []).some(i => i.model === dataModel(model) && i.deck === name))
      .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b))
      .map(name => ({ name, id: ids.get(name) ?? null }));
  }, [topDecks, equipment.data, decked, items]);

  const q = filter.trim().toLowerCase();
  const shown = useMemo(() => {
    const order = new Map((other.data?.groups ?? []).map((g, n) => [g.id, n])); // systems follow the order of the model's chips
    const list = items.filter(i => !q || [i.tag, i.name, i.packageCode, i.vendor, i.method, i.deck].some(x => x?.toLowerCase().includes(q)));
    return decked ? list : [...list].sort((a, b) => (order.get(groupOf(a.tag)) ?? 99) - (order.get(groupOf(b.tag)) ?? 99));
  }, [items, q, other.data, decked]);
  const byDeck = useMemo(() => {
    const m = new Map<string, FacilityEquipment[]>();
    for (const i of shown) m.set(i.deck, [...(m.get(i.deck) ?? []), i]);
    return m;
  }, [shown]);

  const systemRows = useMemo(() => new Map(items.map(i => [groupOf(i.tag), i])), [items]);

  const colours = useMemo(() => {
    const out: Record<string, string> = {};
    if (colourBy === 'none') return out;
    for (const i of items) out[i.tag] = colourBy === 'delivery' ? DELIVERY_COLOUR[delivery(i).state] : METHOD_COLOUR[methodKey(i.method) ?? ''] ?? NO_METHOD;
    return out;
  }, [items, colourBy]);

  const stats = useMemo(() => {
    const d = items.map(i => delivery(i).state);
    return { total: items.length, late: d.filter(s => s === 'late').length, soon: d.filter(s => s === 'soon').length, none: d.filter(s => s === 'none').length, method: items.filter(i => methodKey(i.method)).length };
  }, [items]);

  const visibleDecks = useMemo(() => new Set(modelDecks.filter(d => !hidden.has(d.id)).map(d => d.id)), [modelDecks, hidden]);
  const toggleDeck = (id: string) => setHidden(h => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const onlyDeck = (id: string) => setHidden(new Set(modelDecks.filter(d => d.id !== id).map(d => d.id)));
  const toggleFold = (deck: string) => setFolded(f => { const n = new Set(f); if (n.has(deck)) n.delete(deck); else n.add(deck); return n; });
  const creating = openTag === 'new';
  const active = creating ? null : openTag ?? picked;
  /** A click in the 3D model or on a row of the list only focuses the equipment (highlighted in both); the Details button of the row opens its details. */
  const pickInModel = useCallback((tag: string | null) => setPicked(tag), []);
  const focusInList = (tag: string) => setPicked(tag);
  const openDetails = (tag: string) => { setPicked(tag); setOpenTag(tag); };
  // a system picked in the list turns the rest of the model grey, like the highlight chip does
  useEffect(() => { if (!decked) setHighlight(active ? groupOf(active) : null); }, [active, decked]);

  // Show the picked equipment in the list: unfold its deck, clear a search that hides it, and scroll the row to the middle of the list.
  useEffect(() => {
    if (!active) return;
    const item = items.find(i => i.tag === active);
    if (!item) return;
    setFolded(f => (f.has(item.deck) ? new Set([...f].filter(d => d !== item.deck)) : f));
    if (q && ![item.tag, item.name, item.packageCode, item.vendor, item.method, item.deck].some(x => x?.toLowerCase().includes(q))) setFilter('');
    const id = requestAnimationFrame(() => {
      const row = [...document.querySelectorAll<HTMLElement>('tr.fl-row')].find(r => r.dataset.tag === active);
      const box = row?.closest<HTMLElement>('.fl-groups');
      if (!row || !box) return;
      const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
      box.scrollTo({ top: box.scrollTop + (r.top - b.top) - box.clientHeight / 2 + r.height / 2, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
    // `q` and `items` only decide whether the row is there to scroll to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items.length]);

  const open = openTag && !creating ? items.find(i => i.tag === openTag) ?? null : null;
  const pickedItem = picked ? items.find(i => i.tag === picked) ?? null : null;
  /** The summary card in the viewer: for the picked equipment, and in full screen (where the drawer cannot show) for the open one. */
  const hud = full ? open ?? pickedItem : open ? null : pickedItem;
  const today = localToday();
  // the viewer resolves a path against the page's own address (/m/...), so it gets full URLs
  const fileBase = `${import.meta.env.BASE_URL}models/${model}/`;
  // the file's size is part of its address: a rebuilt model never comes from a copy the browser or the host kept under the same name
  const decks = modelDecks.map(d => ({ id: d.id, name: d.name, url: new URL(`${fileBase}${d.file}?v=${d.bytes}`, document.baseURI).href }));
  // part 2 of the topside: the system files of the picked discipline are fetched only then (the overview above is light)
  const extra = useMemo(() => (model !== 'topside2' || !discHL ? NO_EXTRA : (manifest.data?.systems ?? []).filter(x => x.disc === discHL || (x.disc === 'valves' && (discHL === 'instrument' || discHL === 'steel_piping' || discHL === 'frp_piping'))).map(x => ({ id: `sys-${x.deck}-${x.disc}`, name: `${x.deck} ${x.disc}`, parent: x.deck, url: new URL(`${fileBase}${x.file}?v=${x.bytes}`, document.baseURI).href }))),
    [model, discHL, manifest.data, fileBase]);
  const triangles = (other.data?.groups ?? []).reduce((s, g) => s + g.triangles, 0);
  const megabytes = (other.data?.groups ?? []).reduce((s, g) => s + g.bytes, 0) / 1e6;

  const disciplines = useMemo(() => (manifest.data?.disciplines ?? []).filter(d => d.triangles > 0), [manifest.data]);
  const levels = useMemo(() => manifest.data?.levels ?? [], [manifest.data]);
  const modelledEquipment = useMemo(() => items.filter(i => equipmentInModel.has(i.tag)).map(i => ({ tag: i.tag, name: i.name, deck: i.deck })), [items, equipmentInModel]);
  /** The parts the system highlight lights in the topside: a whole discipline, or one entry of it, in every deck; the rest turns see-through. */
  const topsideHL = useMemo(() => {
    if (model !== 'topside2' || !discHL) return null;
    const ns = entryHL?.kind === 'group' ? new Set(levels.filter(l => l.disc === discHL && l.group === entryHL.group).map(l => l.n)) : entryHL?.kind === 'level' ? new Set([entryHL.n]) : null;
    const allTags = !entryHL || (entryHL.kind === 'group' && entryHL.group === EQUIPMENT_GROUP);
    const manual = entryHL?.kind === 'group' && entryHL.group === MANUAL_VALVES;
    // the actuated valves sit between the pieces of a line: they light with a whole piping discipline, so no line looks cut
    const valveNs = discHL === 'steel_piping' || discHL === 'frp_piping' ? new Set(levels.filter(l => l.group === 'Instrument valves').map(l => l.n)) : null;
    const match = (name: string) => {
      if (!name.startsWith('TS-')) return discHL === 'mechanical' && (allTags || (entryHL?.kind === 'tag' && entryHL.tag === name));
      const [, , disc, n, flag] = name.split('-');
      if (disc === discHL) return manual ? flag === 'v' : !entryHL || (!!ns && ns.has(Number(n)));
      return !!valveNs && !entryHL && disc === 'instrument' && valveNs.has(Number(n));
    };
    return { match, colour: null };
  }, [model, discHL, entryHL, levels]);
  // a discipline or one entry of it was picked: frame what stays lit (a single pipe line is small inside the whole platform)
  useEffect(() => {
    if (model !== 'topside2' || !discHL) return;
    let tries = 0, timer = 0;
    const frame = () => { if (control.current) control.current.fit(); else if (tries++ < 20) timer = window.setTimeout(frame, 300); };
    timer = window.setTimeout(frame, 400);
    return () => window.clearTimeout(timer);
  }, [model, discHL, entryHL]);
  // the deck boxes pulled apart along the vertical: each box at its own elevation plus the gap
  const appliedApart = useRef(0);
  useEffect(() => {
    if (model !== 'topside2') return;
    if (!apart && !appliedApart.current) return;
    let timer = 0, tries = 0;
    const apply = () => {
      const c = control.current;
      if (!c) { if (tries++ < 240) timer = window.setTimeout(apply, 500); return; }
      topDecks.forEach((d, i) => { const lift = (apart / 100) * 14 * i; c.setTransform(d.id, lift ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, lift, 0, 1] : null); });
      if (Math.abs(apart - appliedApart.current) > 15) c.fit();
      appliedApart.current = apart;
    };
    apply();
    return () => window.clearTimeout(timer);
  }, [apart, topDecks, model]);
  const systemsTab = model === 'topside2' && rightTab === 'systems' && disciplines.length > 0;

  return (
    <>
      <PageHead title="Facility layout" desc="The ST-CGF topside (by deck and by system, with its equipment), ST-CGF jacket, LQM#2 and link bridge in 3D. The topside is split by deck and the LQM#2 by floor into equipment, the other models by system; each one has its ROS and ETA, and picking it in the list or the model shows its dates."
        actions={<>
          {decked && access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpenTag('new')}>New equipment</Btn>}
          <Btn kind="small" icon="refresh" onClick={refresh}>Refresh</Btn>
        </>} />
      <div className="stats">
        <Stat label={decked ? 'Equipment' : 'Systems'} value={equipment.data ? stats.total : '—'} foot={decked ? `${equipmentInModel.size} shown in 3D` : `${systemIds.size} shown in 3D`} icon="box" />
        <Stat label="ETA after ROS" value={equipment.data ? stats.late : '—'} foot={<span className={stats.late ? 'negative' : ''}>Arrives after it is needed on site</span>} icon="risk" />
        <Stat label="Close to ROS" value={equipment.data ? stats.soon : '—'} foot={`Less than ${SOON_DAYS} days of margin`} icon="clock" />
        <Stat label="No dates" value={equipment.data ? stats.none : '—'} foot={<span className={stats.none ? 'warning' : ''}>{decked ? 'Edit an equipment' : 'Edit a system'} to add its ROS and ETA</span>} icon="calendar" />
        {decked
          ? <Stat label="Method set" value={equipment.data ? `${stats.method}/${stats.total}` : '—'} foot="Lift by Crane or Skidding" icon="anchor" />
          : <Stat label="3D model" value={other.data ? `${(triangles / 1e6).toFixed(2)} M` : '—'} foot={other.data ? `triangles · ${megabytes.toFixed(1)} MB` : 'Loading'} icon="chart" />}
      </div>

      <div className="fl-grid">
        <div className={`panel fl-view${expanded ? ' fl-expanded' : ''}`} ref={viewPanel}>
          <div className="panel-head">
            <div><h2>{modelLabel}</h2><p>Drag to orbit, right-drag to pan, scroll to zoom.{decked ? ' Click an equipment to see its dates.' : ' Use the chips to show, hide or highlight a system.'}</p></div>
            <div className="actions">
              <Btn kind="small" icon={full || expanded ? 'shrink' : 'expand'} iconOnly aria-label={full || expanded ? 'Exit full screen' : 'Full screen'} onClick={toggleFull} />
              {decked && <select className="filter" aria-label="Colour equipment by" value={colourBy} onChange={e => setColourBy(e.target.value as ColourBy)}>
                <option value="delivery">Colour by delivery</option><option value="method">Colour by method</option><option value="none">Model colours</option>
              </select>}
            </div>
          </div>
          <div className="chip-bar model-tabs" role="tablist" aria-label="Model">
            {MODELS.map(m => (
              <button key={m.id} type="button" role="tab" aria-selected={model === m.id} className={`chip-filter model-tab ${model === m.id ? 'active' : ''}`} onClick={() => switchModel(m.id)}>{m.label}</button>
            ))}
          </div>
          <div className="chip-bar" role="group" aria-label={decked ? `${deckWord[0].toUpperCase()}${deckWord.slice(1)}s shown` : 'Systems shown'}>
            {modelDecks.map(d => (
              <span key={d.id} className="chip-split">
                <button type="button" className={`chip-filter ${visibleDecks.has(d.id) ? 'active' : ''}`} aria-pressed={visibleDecks.has(d.id)} onClick={() => toggleDeck(d.id)} onDoubleClick={() => onlyDeck(d.id)} title={`Click to show or hide, double-click to show this ${decked ? 'deck' : 'system'} alone`}>
                  {!decked && <i className="fl-dot" style={{ background: groupColours[d.id] }} aria-hidden="true" />}{d.name}{decked ? <span>{model === 'topside2' ? d.equipment : items.filter(i => i.deck === d.name).length}</span> : (() => { const it = systemRows.get(d.id); const st = it ? delivery(it).state : 'none'; return <span className={st === 'late' ? 'negative' : st === 'soon' ? 'warning' : ''} title={DELIVERY_LABEL[st]}>{st === 'late' ? 'Late' : st === 'soon' ? 'Soon' : st === 'ok' ? 'OK' : '—'}</span>; })()}
                </button>
                {!decked && <button type="button" className={`chip-filter chip-hl ${highlight === d.id ? 'active' : ''}`} aria-pressed={highlight === d.id} aria-label={`Highlight ${d.name}`} title={highlight === d.id ? 'Clear the highlight' : `Highlight ${d.name}: the rest turns grey`} onClick={() => setHighlight(h => (h === d.id ? null : d.id))}><Icon name="search" /></button>}
              </span>
            ))}
            <button type="button" className="chip-filter" onClick={() => { setHidden(new Set()); setHighlight(null); setSystemHL(null); }}>{decked ? `All ${deckWord}s` : 'All systems'}</button>
          </div>
          {model === 'topside2' && (
            <>
              <div className="chip-bar fl-apart" role="group" aria-label="Deck boxes">
                <label className="seq-speed">Separate the decks <input type="range" min={0} max={100} step={5} value={apart} aria-label="Separate the deck boxes" onChange={e => setApart(Number(e.target.value))} /> {apart ? `${Math.round(apart * 0.14 * 10) / 10} m per level` : 'in place'}</label>
                <span className="tiny muted">{topDecks.filter(d => d.elevation).map(d => `${d.name.replace(' Deck', '')} +${d.elevation!.toFixed(1)} m`).join(' · ')}</span>
              </div>
              {disciplines.length > 0 && (
                <div className="chip-bar" role="group" aria-label="Systems, level 1">
                  <span className="tiny muted">Systems</span>
                  {disciplines.map(d => (
                    <button key={d.id} type="button" className={`chip-filter ${discHL === d.id ? 'active' : ''}`} aria-pressed={discHL === d.id} title={discHL === d.id ? 'Clear the highlight' : `Highlight ${d.name} in all decks: the rest turns see-through`}
                      onClick={() => { setDiscHL(h => (h === d.id ? null : d.id)); setEntryHL(null); if (discHL !== d.id) setRightTab('systems'); }}>
                      <i className="fl-dot" style={{ background: d.color }} aria-hidden="true" />{d.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {model === 'lqm' && (
            <div className="chip-bar" role="group" aria-label="Systems, in all floors">
              <span className="tiny muted">Systems in all floors</span>
              {LQM_SYSTEMS.map(sy => {
                const rows = items.filter(i => i.tag.endsWith(`-${sy.id}`));
                const states = rows.map(i => delivery(i).state);
                const st: Delivery = states.includes('late') ? 'late' : states.includes('soon') ? 'soon' : states.includes('ok') ? 'ok' : 'none';
                return (
                  <button key={sy.id} type="button" className={`chip-filter ${systemHL === sy.id ? 'active' : ''}`} aria-pressed={systemHL === sy.id} disabled={!rows.length} title={systemHL === sy.id ? 'Clear the highlight' : `Highlight ${sy.label} in all floors: the rest turns grey`} onClick={() => setSystemHL(h => (h === sy.id ? null : sy.id))}>
                    <i className="fl-dot" style={{ background: sy.colour }} aria-hidden="true" />{sy.label}<span className={st === 'late' ? 'negative' : st === 'soon' ? 'warning' : ''} title={DELIVERY_LABEL[st]}>{st === 'late' ? 'Late' : st === 'soon' ? 'Soon' : st === 'ok' ? 'OK' : '—'}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="fl-stage-wrap">
            {notBuilt ? <div className="panel empty">The {modelLabel} model has not been prepared yet. Its files are produced from the Navisworks model by the 3D pipeline (data/3d-model/pipeline).</div> : (decked ? manifest.error : other.error) ? <ErrorBox error={(decked ? manifest.error : other.error)!} /> : !modelDecks.length ? <Loading label="Loading the model list…" /> : (
              <Suspense fallback={<Loading label="Loading the 3D viewer…" />}>
                <FacilityViewer key={model} controlRef={control} decks={decks} extra={extra} tags={decked ? inModel : NO_TAGS} visible={visibleDecks} selected={decked ? active : null} colors={decked ? colours : NO_COLOURS} highlight={highlight} systemHL={model === 'topside2' ? topsideHL : model === 'lqm' && systemHL ? { suffix: systemHL, colour: LQM_SYSTEMS.find(x => x.id === systemHL)?.colour ?? '#3b82f6' } : null} dark={dark} onPick={pickInModel} />
              </Suspense>
            )}
            {hud && (
              <div className="fl-hud" role="dialog" aria-label={`${hud.tag} summary`}>
                <div className="fl-hud-head"><strong>{hud.tag}</strong><button type="button" className="link-button" aria-label="Clear selection" onClick={() => { setPicked(null); setOpenTag(null); if (!decked) setHighlight(null); }}><Icon name="close" /></button></div>
                <p>{hud.name ?? '—'} · {hud.deck}</p>
                <dl>
                  <div><dt>ROS</dt><dd>{fmtDate(hud.rosDate)}</dd></div>
                  <div><dt>ETA</dt><dd className={delivery(hud).state === 'late' ? 'negative' : delivery(hud).state === 'soon' ? 'warning' : ''}>{fmtDate(hud.etaDate)}</dd></div>
                  <div><dt>Method</dt><dd>{hud.method ?? '—'}</dd></div>
                </dl>
                {!full && <button type="button" className="btn small" onClick={() => setOpenTag(hud.tag)}>Details</button>}
              </div>
            )}
          </div>
          <div className="fl-legend" aria-label="Legend">
            {!decked && modelDecks.map(d => <span key={d.id}><Dot colour={groupColours[d.id] ?? '#8b95a7'} />{d.name}</span>)}
            {decked && colourBy === 'delivery' && (Object.keys(DELIVERY_LABEL) as Delivery[]).map(k => <span key={k}><Dot colour={DELIVERY_COLOUR[k]} />{DELIVERY_LABEL[k]}</span>)}
            {decked && colourBy === 'method' && <>{Object.entries(METHOD_COLOUR).map(([k, c]) => <span key={k}><Dot colour={c} />{k}</span>)}<span><Dot colour={NO_METHOD} />Method not set</span></>}
            {decked && colourBy === 'none' && <span><Dot colour="#e8943a" />Equipment <Dot colour="#6b7a99" />Structure</span>}
          </div>
        </div>

        <div className="panel fl-list">
          <div className="panel-head"><div><h2>{decked ? `Equipment by ${deckWord}` : 'Systems'}</h2><p>{equipment.data ? `${shown.length} of ${items.length} ${decked ? 'equipment' : 'systems'} · ROS = required on site, ETA = expected on site` : '…'}</p></div></div>
          {model === 'topside2' && disciplines.length > 0 && (
            <div className="chip-bar model-tabs" role="tablist" aria-label="List">
              <button type="button" role="tab" aria-selected={!systemsTab} className={`chip-filter model-tab ${!systemsTab ? 'active' : ''}`} onClick={() => setRightTab('equipment')}>Equipment</button>
              <button type="button" role="tab" aria-selected={systemsTab} className={`chip-filter model-tab ${systemsTab ? 'active' : ''}`} onClick={() => setRightTab('systems')}>Systems</button>
            </div>
          )}
          {!systemsTab && <div className="toolbar">
            <label className="search"><Icon name="search" /><input placeholder={decked ? 'Search tag, name, vendor or package…' : 'Search system, tag or package…'} value={filter} onChange={e => setFilter(e.target.value)} aria-label={decked ? 'Search equipment' : 'Search systems'} /></label>
          </div>}
          {systemsTab ? <TopsideSystems disciplines={disciplines} levels={levels} equipment={modelledEquipment} disc={discHL} pick={entryHL} onDisc={setDiscHL} onPick={setEntryHL} /> : equipment.error ? <ErrorBox error={equipment.error} /> : equipment.isPending ? <Loading /> : !deckNames.length ? <div className="empty">{decked ? 'No equipment yet. Use New equipment.' : 'No systems listed for this model yet.'}</div> : (
            <div className="fl-groups">
              {model === 'lqm' && (() => {
                const all = LQM_SYSTEMS.map(sy => {
                  const rows = items.filter(i => i.tag.endsWith(`-${sy.id}`));
                  if (!rows.length || (q && !sy.label.toLowerCase().includes(q))) return null;
                  const latest = (k: 'rosDate' | 'etaDate') => rows.map(r => r[k]).filter((x): x is string => !!x).sort().pop() ?? null;
                  const state = (['late', 'soon', 'ok', 'none'] as Delivery[]).find(st => rows.some(r => delivery(r).state === st)) ?? 'none';
                  return { sy, rosDate: latest('rosDate'), etaDate: latest('etaDate'), state };
                }).filter((x): x is NonNullable<typeof x> => !!x);
                if (!all.length) return null;
                const isFolded = folded.has('__all');
                return (
                  <section className="fl-group">
                    <h3><button type="button" className="link-button" aria-expanded={!isFolded} onClick={() => toggleFold('__all')}>
                      <Icon name={isFolded ? 'chevron-right' : 'chevron-down'} />All floors<span className="muted"> · {all.length} systems</span>
                    </button>{systemHL && <button type="button" className="link-button tiny" title="Clear the highlight" onClick={() => setSystemHL(null)}>Clear</button>}</h3>
                    {!isFolded && (
                      <div className="table-wrap">
                        <table className="fl-table">
                          <thead><tr><th>SYSTEM</th><th>NAME</th><th>ROS</th><th>ETA</th></tr></thead>
                          <tbody>
                            {all.map(({ sy, rosDate, etaDate, state }) => (
                              <tr key={sy.id} className={`fl-row ${systemHL === sy.id ? 'selected' : ''}`} aria-selected={systemHL === sy.id} tabIndex={0} title={`Highlight ${sy.label} in all floors`}
                                onClick={() => setSystemHL(h => (h === sy.id ? null : sy.id))} onKeyDown={e => { if (e.key === 'Enter') setSystemHL(h => (h === sy.id ? null : sy.id)); }}>
                                <td><strong><Dot colour={sy.colour} /> ALL</strong></td>
                                <td><span className="fl-name">{sy.label}</span></td>
                                <td>{shortDate(rosDate)}</td>
                                <td><span className={state === 'late' ? 'negative' : state === 'soon' ? 'warning' : ''}>{shortDate(etaDate)}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })()}
              {deckNames.map(({ name, id }) => {
                const rows = byDeck.get(name) ?? [];
                if (!rows.length) return null;
                const isFolded = folded.has(name);
                return (
                  <section key={name} className="fl-group">
                    {decked && <h3><button type="button" className="link-button" aria-expanded={!isFolded} onClick={() => toggleFold(name)}>
                      <Icon name={isFolded ? 'chevron-right' : 'chevron-down'} />{name}<span className="muted"> · {rows.length}</span>
                    </button>{id && <button type="button" className="link-button tiny" title="Show this deck alone in the 3D model" onClick={() => onlyDeck(id)}>Only</button>}</h3>}
                    {(!decked || !isFolded) && (
                      <div className="table-wrap">
                        <table className={`fl-table${decked ? "" : " no-tag"}`}>
                          <thead><tr>{decked && <th>TAG</th>}<th>{decked ? 'NAME' : 'SYSTEM'}</th><th>ROS</th><th>ETA</th><th><span className="sr-only">Details</span></th></tr></thead>
                          <tbody>
                            {rows.map(i => {
                              const d = delivery(i);
                              return (
                                <tr key={i.tag} className={`fl-row ${active === i.tag ? 'selected' : ''}`} data-tag={i.tag} aria-selected={active === i.tag} onClick={() => focusInList(i.tag)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') focusInList(i.tag); }}>
                                  {decked && <td><strong>{i.tag}</strong>{!modelled(i.tag) && <span className="tiny muted" title="Not modelled in 3D"> · no 3D</span>}</td>}
                                  <td>{i.name ? <span className="fl-name" title={i.name}>{i.name}</span> : <span className="muted">—</span>}{!decked && !modelled(i.tag) && <span className="tiny muted" title="Not modelled in 3D"> · no 3D</span>}</td>
                                  <td>{shortDate(i.rosDate)}</td>
                                  <td><span className={d.state === 'late' ? 'negative' : d.state === 'soon' ? 'warning' : ''}>{shortDate(i.etaDate)}</span></td>
                                  <td className="fl-actions"><button type="button" className="icon-btn fl-details" title="Details" aria-label={`Details of ${i.name ?? i.tag}`} onClick={e => { e.stopPropagation(); openDetails(i.tag); }} onKeyDown={e => e.stopPropagation()}><Icon name="arrow" /></button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {model === 'jacket' && <p className="tiny muted panel-body">ETA = the last item of the expediting-report packages that feed the system (jacket steel, anodes, flooding, fenders, grating, cradle timber); piles, conductors, risers and J-tubes are in no package of the report. Every system but “Jacket structure” and “Anodes & supports” is a Selection Set saved in CGF-Jacket.nwd (the four rows, launch cradle, piles, conductors and their guides, caissons, risers, J-tubes, bridge landing, flooding, buoyancy tanks, fenders, gratings…). What no set holds is structure or anodes, told apart by fabrication phase.</p>}
        </div>
      </div>

      {open && !full && !editing && (
        <Modal title={`${open.tag}${open.name ? ` · ${open.name}` : ''}`} onClose={() => setOpenTag(null)} actions={<>{access.canManage && <Btn onClick={() => setRemoving(open)}>Delete</Btn>}{access.canWrite && <Btn kind="primary" icon="edit" onClick={() => setEditing(open)}>Edit</Btn>}<Btn onClick={() => setOpenTag(null)}>Close</Btn></>}>
          {(() => {
            const d = delivery(open);
            return (
              <div className="dialog-body">
                <div className="detail-grid">
                  <div><small>Tag</small><strong>{open.tag}</strong></div>
                  <div><small>{open.model === 'lqm' ? 'Floor' : 'Deck'}</small><strong>{open.deck}</strong></div>
                  <div><small>ROS (required on site)</small><strong>{fmtDate(open.rosDate)}</strong></div>
                  <div><small>ETA (expected on site)</small><strong>{fmtDate(open.etaDate)}</strong></div>
                  <div><small>Margin</small><strong className={d.state === 'late' ? 'negative' : d.state === 'soon' ? 'warning' : ''}>{d.margin === null ? '—' : d.margin < 0 ? `${-d.margin} days late` : `${d.margin} days`}</strong></div>
                  <div><small>Installation method</small><strong>{open.method ?? <span className="muted">Not set · use Edit</span>}</strong></div>
                  <div><small>Package</small><strong>{open.packageCode ?? '—'}</strong></div>
                  <div><small>Vendor</small><strong>{open.vendor ?? '—'}</strong></div>
                  <div><small>Shipment status</small><strong>{open.status ?? '—'}</strong></div>
                  <div><small>Package status</small><strong>{open.packageStatus ?? '—'}</strong></div>
                </div>
                {open.remarks && <><h3 className="fl-sub">Remarks</h3><p className="fl-text">{open.remarks}</p></>}
                {open.comments && <><h3 className="fl-sub">Comments</h3><p className="fl-text">{open.comments}</p></>}
                <p className="tiny muted fl-source">Source: {open.source ?? '—'}{open.etaDate && open.etaDate < today && d.state !== 'none' ? ' · the ETA date has passed' : ''}{!modelled(open.tag) ? ' · not modelled in 3D' : ''}</p>
              </div>
            );
          })()}
        </Modal>
      )}
      {(creating || editing) && (
        <FacilityEquipmentForm item={editing} model={dataModel(model) as FacilityEquipment['model']} decks={deckNames.map(d => d.name).concat(modelDecks.map(d => d.name).filter(n => !deckNames.some(x => x.name === n)))} base={base}
          onClose={() => { setEditing(null); if (creating) setOpenTag(null); }}
          onSaved={tag => { setEditing(null); refresh(); setOpenTag(tag); }} />
      )}
      {removing && (
        <Confirm title={`Delete ${removing.tag}`} busy={remove.isPending} onConfirm={() => remove.mutate(removing.tag)} onClose={() => setRemoving(null)}>
          <p>{removing.tag}{removing.name ? ` · ${removing.name}` : ''} will be removed from the equipment list. Its part stays in the 3D model.</p>
        </Confirm>
      )}
    </>
  );
}
