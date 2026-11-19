import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorText, request, type FacilityEquipment, type FacilityEquipmentResponse } from '../api';
import { useDeepLink } from '../deepLink';
import { diffDays, fmtDate, localToday } from '../format';
import { Icon } from '../icons';
import { lazyPage } from '../lazyPage';
import { useAccess, useApp, usePrefs, useToast } from '../state';
import { Btn, Confirm, ErrorBox, Loading, Modal, PageHead, Stat } from '../ui';
import { FacilityEquipmentForm } from './FacilityEquipmentForm';

const FacilityViewer = lazyPage(() => import('../FacilityViewer'));

interface DeckFile { id: string; name: string; file: string; bytes: number; equipment: number }
interface Manifest { decks: DeckFile[]; units: { tag: string; deck: string }[] }

const MODEL_BASE = `${import.meta.env.BASE_URL}models/facility/`;
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

  // Edits typed in the Google Sheet reach the page on the next load, when the window is focused again, and every minute.
  const equipment = useQuery({
    queryKey: ['facility-equipment', project.id],
    queryFn: () => request<FacilityEquipmentResponse>(`/projects/${project.id}/construction/facility-layout/equipment`),
    refetchInterval: 60_000,
  });
  const manifest = useQuery({
    queryKey: ['facility-manifest'],
    queryFn: async () => { const r = await fetch(`${MODEL_BASE}facility-model.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error('The 3D model files are missing.'); return (await r.json()) as Manifest; },
    staleTime: 60_000, // a rebuilt model must show up: a stale copy in the persisted query cache would list the old decks
  });

  const base = `/projects/${project.id}/construction/facility-layout/equipment`;
  const refresh = () => qc.invalidateQueries({ queryKey: ['facility-equipment', project.id] });
  const remove = useMutation({
    mutationFn: (tag: string) => request<void>(`${base}/${encodeURIComponent(tag)}`, { method: 'DELETE' }),
    onSuccess: () => { setRemoving(null); setOpenTag(null); refresh(); toast('Equipment deleted.'); },
    onError: (e: Error) => { setRemoving(null); toast(errorText(e)); },
  });

  const items = equipment.data?.items ?? [];
  const inModel = useMemo(() => new Set((manifest.data?.units ?? []).map(u => u.tag)), [manifest.data]);
  const modelDecks = manifest.data?.decks ?? [];
  const deckNames = useMemo(() => {
    const order = new Map(modelDecks.map((d, i) => [d.name, i]));
    const ids = new Map(modelDecks.map(d => [d.name, d.id]));
    return [...(equipment.data?.decks ?? [])]
      .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b))
      .map(name => ({ name, id: ids.get(name) ?? null }));
  }, [modelDecks, equipment.data]);

  const q = filter.trim().toLowerCase();
  const shown = useMemo(() => items.filter(i => !q || [i.tag, i.name, i.packageCode, i.vendor, i.method, i.deck].some(x => x?.toLowerCase().includes(q))), [items, q]);
  const byDeck = useMemo(() => {
    const m = new Map<string, FacilityEquipment[]>();
    for (const i of shown) m.set(i.deck, [...(m.get(i.deck) ?? []), i]);
    return m;
  }, [shown]);

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
  /** A click in the 3D model only highlights the equipment (in the list too); a click in the list also opens its details. */
  const pickInModel = useCallback((tag: string | null) => setPicked(tag), []);
  const pickInList = (tag: string) => { setPicked(tag); setOpenTag(tag); };

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
  const decks = modelDecks.map(d => ({ id: d.id, name: d.name, url: new URL(`${MODEL_BASE}${d.file}`, window.location.origin).href }));

  return (
    <>
      <PageHead title="Facility layout" desc="The CGF topside by deck in 3D: structure and large equipment, with each equipment's ROS, ETA and installation method. Equipment can be added, edited and deleted."
        actions={<>
          {access.canWrite && <Btn kind="small primary" icon="plus" onClick={() => setOpenTag('new')}>Add equipment</Btn>}
          <Btn kind="small" icon="refresh" onClick={refresh}>Refresh</Btn>
        </>} />
      <div className="stats">
        <Stat label="Equipment" value={equipment.data ? stats.total : '—'} foot={`${inModel.size} shown in 3D`} icon="box" />
        <Stat label="ETA after ROS" value={equipment.data ? stats.late : '—'} foot={<span className={stats.late ? 'negative' : ''}>Arrives after it is needed on site</span>} icon="risk" />
        <Stat label="Close to ROS" value={equipment.data ? stats.soon : '—'} foot={`Less than ${SOON_DAYS} days of margin`} icon="clock" />
        <Stat label="No dates" value={equipment.data ? stats.none : '—'} foot={<span className={stats.none ? 'warning' : ''}>Edit an equipment to add its ROS and ETA</span>} icon="calendar" />
        <Stat label="Method set" value={equipment.data ? `${stats.method}/${stats.total}` : '—'} foot="Lift by Crane or Skidding" icon="anchor" />
      </div>

      <div className="fl-grid">
        <div className={`panel fl-view${expanded ? ' fl-expanded' : ''}`} ref={viewPanel}>
          <div className="panel-head">
            <div><h2>3D model</h2><p>Drag to orbit, right-drag to pan, scroll to zoom. Click an equipment to see its dates.</p></div>
            <div className="actions">
              <Btn kind="small" icon={full || expanded ? 'shrink' : 'expand'} iconOnly aria-label={full || expanded ? 'Exit full screen' : 'Full screen'} onClick={toggleFull} />
              <select className="filter" aria-label="Colour equipment by" value={colourBy} onChange={e => setColourBy(e.target.value as ColourBy)}>
                <option value="delivery">Colour by delivery</option><option value="method">Colour by method</option><option value="none">Model colours</option>
              </select>
            </div>
          </div>
          <div className="chip-bar" role="group" aria-label="Decks shown">
            {modelDecks.map(d => (
              <button key={d.id} type="button" className={`chip-filter ${visibleDecks.has(d.id) ? 'active' : ''}`} aria-pressed={visibleDecks.has(d.id)} onClick={() => toggleDeck(d.id)} onDoubleClick={() => onlyDeck(d.id)} title="Click to show or hide, double-click to show this deck alone">
                {d.name}<span>{d.equipment}</span>
              </button>
            ))}
            <button type="button" className="chip-filter" onClick={() => setHidden(new Set())}>All decks</button>
          </div>
          <div className="fl-stage-wrap">
            {manifest.error ? <ErrorBox error={manifest.error} /> : !modelDecks.length ? <Loading label="Loading the model list…" /> : (
              <Suspense fallback={<Loading label="Loading the 3D viewer…" />}>
                <FacilityViewer decks={decks} tags={inModel} visible={visibleDecks} selected={active} colors={colours} dark={dark} onPick={pickInModel} />
              </Suspense>
            )}
            {hud && (
              <div className="fl-hud" role="dialog" aria-label={`${hud.tag} summary`}>
                <div className="fl-hud-head"><strong>{hud.tag}</strong><button type="button" className="link-button" aria-label="Clear selection" onClick={() => { setPicked(null); setOpenTag(null); }}><Icon name="close" /></button></div>
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
            {colourBy === 'delivery' && (Object.keys(DELIVERY_LABEL) as Delivery[]).map(k => <span key={k}><Dot colour={DELIVERY_COLOUR[k]} />{DELIVERY_LABEL[k]}</span>)}
            {colourBy === 'method' && <>{Object.entries(METHOD_COLOUR).map(([k, c]) => <span key={k}><Dot colour={c} />{k}</span>)}<span><Dot colour={NO_METHOD} />Method not set</span></>}
            {colourBy === 'none' && <span><Dot colour="#e8943a" />Equipment <Dot colour="#6b7a99" />Structure</span>}
          </div>
        </div>

        <div className="panel fl-list">
          <div className="panel-head"><div><h2>Equipment by deck</h2><p>{equipment.data ? `${shown.length} of ${items.length} equipment · ROS = required on site, ETA = expected on site` : '…'}</p></div></div>
          <div className="toolbar">
            <label className="search"><Icon name="search" /><input placeholder="Search tag, name, vendor or package…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Search equipment" /></label>
          </div>
          {equipment.error ? <ErrorBox error={equipment.error} /> : equipment.isPending ? <Loading /> : !deckNames.length ? <div className="empty">No equipment yet. Use Add equipment.</div> : (
            <div className="fl-groups">
              {deckNames.map(({ name, id }) => {
                const rows = byDeck.get(name) ?? [];
                if (!rows.length) return null;
                const isFolded = folded.has(name);
                return (
                  <section key={name} className="fl-group">
                    <h3><button type="button" className="link-button" aria-expanded={!isFolded} onClick={() => toggleFold(name)}>
                      <Icon name={isFolded ? 'chevron-right' : 'chevron-down'} />{name}<span className="muted"> · {rows.length}</span>
                    </button>{id && <button type="button" className="link-button tiny" title="Show this deck alone in the 3D model" onClick={() => onlyDeck(id)}>Only</button>}</h3>
                    {!isFolded && (
                      <div className="table-wrap">
                        <table className="fl-table">
                          <thead><tr><th>TAG</th><th>NAME</th><th>ROS</th><th>ETA</th></tr></thead>
                          <tbody>
                            {rows.map(i => {
                              const d = delivery(i);
                              return (
                                <tr key={i.tag} className={`fl-row ${active === i.tag ? 'selected' : ''}`} data-tag={i.tag} aria-selected={active === i.tag} onClick={() => pickInList(i.tag)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') pickInList(i.tag); }}>
                                  <td><strong>{i.tag}</strong>{!inModel.has(i.tag) && <span className="tiny muted" title="Not modelled in 3D"> · no 3D</span>}</td>
                                  <td>{i.name ? <span className="fl-name" title={i.name}>{i.name}</span> : <span className="muted">—</span>}</td>
                                  <td>{shortDate(i.rosDate)}</td>
                                  <td><span className={d.state === 'late' ? 'negative' : d.state === 'soon' ? 'warning' : ''}>{shortDate(i.etaDate)}</span></td>
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
                  <div><small>Deck</small><strong>{open.deck}</strong></div>
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
                <p className="tiny muted fl-source">Source: {open.source ?? '—'}{open.etaDate && open.etaDate < today && d.state !== 'none' ? ' · the ETA date has passed' : ''}{!inModel.has(open.tag) ? ' · not modelled in 3D' : ''}</p>
              </div>
            );
          })()}
        </Modal>
      )}
      {(creating || editing) && (
        <FacilityEquipmentForm item={editing} decks={deckNames.map(d => d.name).concat(modelDecks.map(d => d.name).filter(n => !deckNames.some(x => x.name === n)))} base={base}
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
