import { useEffect, useRef, useState } from 'react';
import { fetchDeckUrl } from './dracoGlb';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Autodesk?: any; THREE?: any } }

/** The Autodesk Platform Services (Forge) Viewer, loaded from Autodesk's CDN; the models are the GLB files of the facility, served with the app. */
const VIEWER_CDN = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*';

export interface ViewerDeck { id: string; name: string; url: string }

export interface ViewerControl { setTransform(id: string, m: readonly number[] | null): void; fit(): void }

export interface FacilityViewerProps {
  decks: ViewerDeck[];
  /** The part names that are equipment (their tag); everything else in a deck is structure. */
  tags: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  selected: string | null;
  /** Theming colour (CSS hex) per tag; a tag without one keeps the model's own colour. */
  colors: Readonly<Record<string, string>>;
  dark: boolean;
  /** A deck or group to show in its own colours while every other one is greyed out. */
  highlight?: string | ReadonlySet<string> | null;
  /** A system that runs through every deck (LQM#2): its parts, the nodes named `<deck code>-<suffix>`, keep their colour and everything else turns grey. */
  systemHL?: { suffix: string; colour: string } | null;
  /** Receives handles to move a deck (a 16-number column-major matrix, null = back in place) and to frame everything shown. */
  controlRef?: { current: ViewerControl | null };
  onPick: (tag: string | null) => void;
  onLoaded?: (loaded: number, total: number) => void;
}

interface Entry { model: any; tagToDb: Map<string, number>; dbToTag: Map<number, string>; rootDb: number | null }

let assets: Promise<void> | null = null;
function loadAssets(): Promise<void> {
  if (window.Autodesk?.Viewing?.GuiViewer3D) return Promise.resolve();
  assets ??= new Promise<void>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${VIEWER_CDN}/style.min.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${VIEWER_CDN}/viewer3D.min.js`;
    js.onload = () => resolve();
    js.onerror = () => { assets = null; reject(new Error('The Autodesk viewer could not be loaded. It is fetched from Autodesk, so the page needs internet access.')); };
    document.head.appendChild(js);
  });
  return assets;
}

/** The glTF extension fills in its node → dbId table a little after the model's load callback. */
async function nodeTable(model: any): Promise<{ gltf: { nodes: { name?: string }[] }; nodeToDbId: Record<number, number> }> {
  for (let i = 0; i < 200; i++) {
    const d = model.getData?.();
    if (d?.gltf?.nodes && d.nodeToDbId) return d;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('The model loaded but its parts could not be read.');
}

/**
 * Theming needs the model's dbId → fragment table, which the glTF extension does not fill in: build it from the fragment → dbId list.
 * Without it setThemingColor throws inside the viewer.
 */
function ensureFragmentTable(model: any) {
  const frags = model.getFragmentList()?.fragments;
  const f2d: ArrayLike<number> | undefined = frags?.fragId2dbId;
  if (!f2d?.length || (frags.pfCount === f2d.length && frags.dbId2fragId)) return;
  const table: Record<number, number | number[]> = {};
  for (let i = 0; i < f2d.length; i++) {
    const have = table[f2d[i]];
    table[f2d[i]] = have === undefined ? i : Array.isArray(have) ? [...have, i] : [have, i];
  }
  frags.dbId2fragId = table;
  frags.pfCount = f2d.length;
}

const toVec4 = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new window.THREE.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
};

export default function FacilityViewer({ decks, tags, visible, selected, colors, dark, highlight = null, systemHL = null, controlRef, onPick, onLoaded }: FacilityViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const entries = useRef(new Map<string, Entry>());
  const [state, setState] = useState<{ phase: 'loading' | 'ready' | 'error'; message?: string; loaded: number }>({ phase: 'loading', loaded: 0 });
  const [detail, setDetail] = useState<Record<string, string>>({});
  const live = useRef({ onPick, selected, tags });
  live.current = { onPick, selected, tags };

  useEffect(() => {
    let dead = false;
    const ctl = new AbortController(); // leaving the page, or another model being picked, stops the downloads and the decoding of this one
    const entriesNow = entries.current;
    (async () => {
      try {
        await loadAssets();
        const A = window.Autodesk;
        await new Promise<void>(done => A.Viewing.Initializer({ env: 'Local', api: 'derivativeV2' }, done));
        if (dead || !host.current) return;
        const viewer = new A.Viewing.GuiViewer3D(host.current, { extensions: [] });
        viewer.start();
        viewerRef.current = viewer;
        await viewer.loadExtension('Autodesk.glTF');
        // with several models loaded the viewer reports a selection through the aggregate event (SELECTION_CHANGED is the single-model one)
        viewer.addEventListener(A.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, (e: any) => {
          const hit = e.selections?.[0];
          const entry = hit ? [...entriesNow.values()].find(x => x.model === hit.model) : undefined;
          const tag = entry?.dbToTag.get(hit?.dbIdArray?.[0]) ?? null;
          if (tag !== live.current.selected) live.current.onPick(tag);
        });
        let loaded = 0;
        // every deck downloads and decodes at once; they are handed to the viewer in order as each is ready
        const ready = decks.map(deck => fetchDeckUrl(deck.url, text => { if (!dead) setDetail(d => ({ ...d, [deck.id]: text })); }, ctl.signal));
        ready.forEach(p => p.catch(() => undefined));
        for (const [i, deck] of decks.entries()) {
          if (dead) return;
          const blobUrl = await ready[i];
          if (dead) { URL.revokeObjectURL(blobUrl); return; }
          // the loader picks its format from a file extension, which a blob URL lacks: the fragment supplies one
          const model = await new Promise<any>((resolve, reject) => viewer.loadModel(`${blobUrl}#${deck.id}.glb`, {}, resolve, (code: number, msg: string, extra: unknown) => { console.error('glTF load failed', deck.url, code, msg, extra); reject(new Error(`${deck.name}: ${msg || code}`)); }));
          if (dead) return;
          const data = await nodeTable(model);
          if (dead) return;
          URL.revokeObjectURL(blobUrl);
          setDetail(d => ({ ...d, [deck.id]: '' }));
          const tagToDb = new Map<number | string, number>() as Map<string, number>;
          const dbToTag = new Map<number, string>();
          data.gltf.nodes.forEach((n, i) => {
            const db = data.nodeToDbId[i];
            if (n.name && db !== undefined && live.current.tags.has(n.name)) { tagToDb.set(n.name, db); dbToTag.set(db, n.name); }
          });
          const rootIndex = data.gltf.nodes.findIndex(n => n.name === deck.id);
          const rootDb = data.nodeToDbId[rootIndex >= 0 ? rootIndex : 0];
          entriesNow.set(deck.id, { model, tagToDb, dbToTag, rootDb: rootDb ?? null });
          onLoaded?.(++loaded, decks.length);
          setState({ phase: 'loading', loaded });
        }
        if (dead) return;
        const bb = viewer.impl.getVisibleBounds(true);
        const c = bb.getCenter(new window.THREE.Vector3());
        const size = bb.getSize(new window.THREE.Vector3());
        const r = Math.max(size.x, size.z) * 0.9;
        viewer.navigation.setView(new window.THREE.Vector3(c.x + r, c.y + size.y * 0.7, c.z + r), c);
        viewer.navigation.setCameraUpVector(new window.THREE.Vector3(0, 1, 0));
        setState({ phase: 'ready', loaded });
      } catch (e) {
        if (!dead) setState({ phase: 'error', message: e instanceof Error ? e.message : 'The 3D view could not start.', loaded: 0 });
      }
    })();
    return () => {
      dead = true;
      ctl.abort();
      try { viewerRef.current?.finish(); } catch { /* the viewer was never fully started */ }
      viewerRef.current = null;
      entriesNow.clear();
    };
    // the decks are fixed for the life of the page; visibility, selection and colours are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!controlRef || state.phase !== 'ready') return;
    controlRef.current = {
      setTransform: (id, m) => {
        const v = viewerRef.current, e = entries.current.get(id);
        if (!v || !e) return;
        e.model.setPlacementTransform(m ? new window.THREE.Matrix4().fromArray([...m]) : new window.THREE.Matrix4());
        v.impl.invalidate(true, true, true);
      },
      fit: () => {
        const v = viewerRef.current;
        if (!v) return;
        const bb = v.impl.getVisibleBounds(true);
        const c = bb.getCenter(new window.THREE.Vector3());
        const size = bb.getSize(new window.THREE.Vector3());
        const r = Math.max(size.x, size.z, size.y * 0.8) * 0.95;
        v.navigation.setView(new window.THREE.Vector3(c.x + r, c.y + Math.max(size.y * 0.7, r * 0.5), c.z + r), c);
        v.navigation.setCameraUpVector(new window.THREE.Vector3(0, 1, 0));
      },
    };
    return () => { controlRef.current = null; };
  }, [controlRef, state.phase]);

  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    for (const [id, e] of entries.current) { if (visible.has(id)) v.showModel(e.model.id); else v.hideModel(e.model.id); }
  }, [visible, state.phase]);

  const isolated = useRef(new Set<string>());
  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    for (const [id, e] of entries.current) {
      ensureFragmentTable(e.model);
      v.clearThemingColors(e.model);
      if (systemHL && e.rootDb !== null) {
        // the system keeps its colour; everything else is ghosted (see-through), so the system shows through the parts in front of it
        const ids: number[] = [];
        for (const [tag, db] of e.tagToDb) if (tag.endsWith(`-${systemHL.suffix}`)) { ids.push(db); v.setThemingColor(db, toVec4(colors[tag] ?? systemHL.colour), e.model, true); }
        v.isolate(ids.length ? ids : [-1], e.model);
        isolated.current.add(id);
        continue;
      }
      if (isolated.current.has(id)) { v.isolate([], e.model); isolated.current.delete(id); }
      if (highlight && !(typeof highlight === 'string' ? id === highlight : highlight.has(id)) && e.rootDb !== null) {
        // everything but the highlighted part is washed out to a pale grey
        v.setThemingColor(e.rootDb, new window.THREE.Vector4(0.82, 0.85, 0.9, 0.9), e.model, true);
        continue;
      }
      for (const [tag, db] of e.tagToDb) if (colors[tag]) v.setThemingColor(db, toVec4(colors[tag]), e.model, false);
    }
  }, [colors, highlight, systemHL, state.phase]);

  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    if (!selected) { v.clearSelection(); return; }
    for (const e of entries.current.values()) {
      const db = e.tagToDb.get(selected);
      if (db === undefined) continue;
      v.select([db], e.model);
      v.fitToView([db], e.model);
      return;
    }
    v.clearSelection();
  }, [selected, state.phase]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (dark) v.setBackgroundColor(30, 36, 48, 12, 16, 24); else v.setBackgroundColor(232, 238, 246, 250, 252, 255);
  }, [dark, state.phase]);

  return (
    <div className="fl-stage" aria-busy={state.phase === 'loading'}>
      <div ref={host} className="fl-canvas" />
      {state.phase === 'loading' && (
        <div className="fl-overlay"><span className="sk sk-row" /><p>Loading the 3D model… {state.loaded}/{decks.length}</p>
          <p className="tiny">{decks.filter(d => detail[d.id]).map(d => `${d.name}: ${detail[d.id]}`).join(' · ')}</p></div>
      )}
      {state.phase === 'error' && <div className="fl-overlay error" role="alert"><p>{state.message}</p></div>}
      <a className="fl-credit" href="https://aps.autodesk.com/" target="_blank" rel="noreferrer">Powered by Autodesk Platform Services</a>
    </div>
  );
}
