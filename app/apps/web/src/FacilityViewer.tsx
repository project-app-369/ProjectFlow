import { useEffect, useRef, useState } from 'react';
import { fetchDeckUrl } from './dracoGlb';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Autodesk?: any; THREE?: any } }

/** The Autodesk Platform Services (Forge) Viewer, loaded from Autodesk's CDN; the models are the GLB files of the facility, served with the app. */
const VIEWER_CDN = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*';

export interface ViewerDeck { id: string; name: string; url: string }
/** A model loaded only when it is wanted (the system files of the topside): shown with its deck, and only while a system is highlighted. */
export interface ViewerExtra extends ViewerDeck { parent: string }

export interface ViewerControl {
  setTransform(id: string, m: readonly number[] | null): void;
  fit(): void;
  /** Aims the camera at a point (viewer coordinates) from `dist` metres away, at an azimuth from +Z and an elevation, both in degrees. */
  look?(target: readonly number[], dist: number, az: number, el: number): void;
  /** Moves camera and target together so that the target follows a point, keeping whatever orbit and zoom the user has set. */
  follow?(target: readonly number[]): void;
}

export interface FacilityViewerProps {
  decks: ViewerDeck[];
  /** More models, fetched once they are listed here; each shows only parts that match the highlighted system. */
  extra?: ViewerExtra[];
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
  systemHL?: { suffix?: string; /** which parts take part, by node name (a discipline or one entry of it) */ match?: (name: string) => boolean; /** null keeps the parts' own colours */ colour: string | null } | null;
  /** Receives handles to move a deck (a 16-number column-major matrix, null = back in place) and to frame everything shown. */
  /** A translucent horizontal plane (the sea surface), drawn in an overlay so that what is below it shows through. Viewer coordinates: centre [x, z], size [width, depth]. */
  sea?: { center: [number, number]; size: [number, number]; colour: number; opacity: number } | null;
  controlRef?: { current: ViewerControl | null };
  onPick: (tag: string | null) => void;
  onLoaded?: (loaded: number, total: number) => void;
}

interface Entry { parent?: string; model: any; tagToDb: Map<string, number>; dbToTag: Map<number, string>; rootDb: number | null }

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

interface WireSet { scene: string; meshes: { fid: number; mesh: any }[] }
const wireSets = new WeakMap<object, WireSet>();

/** Puts the overlay wireframe back where its fragments are now (a deck that was moved apart has a new placement transform). */
function syncWire(viewer: any, model: any) {
  const set = wireSets.get(model);
  if (!set) return;
  const fl = model.getFragmentList();
  const mx = new window.THREE.Matrix4();
  for (const { fid, mesh } of set.meshes) { fl.getWorldMatrix(fid, mx); mesh.matrix.copy(mx); mesh.matrixWorldNeedsUpdate = true; }
  viewer.impl.invalidate(true, true, true);
}

/**
 * Draws every fragment of the model whose dbId is not in `keep` as a faint wireframe, on an overlay scene (the viewer's own shaders ignore
 * a wireframe material). The caller hides the solid originals; keep = null removes the wireframe.
 */
function setWire(viewer: any, model: any, keep: Set<number> | null, dark: boolean | undefined) {
  const T = window.THREE;
  const old = wireSets.get(model);
  if (old) {
    for (const { mesh } of old.meshes) { viewer.impl.removeOverlay(old.scene, mesh); mesh.geometry.dispose(); }
    viewer.impl.removeOverlayScene(old.scene);
    wireSets.delete(model);
  }
  if (keep) {
    const fl = model.getFragmentList();
    const f2d: ArrayLike<number> | undefined = fl?.fragments?.fragId2dbId;
    if (!f2d) return;
    const scene = `fl-wire-${model.id}`;
    viewer.impl.createOverlayScene(scene);
    const mat = new T.MeshBasicMaterial({ color: dark ? 0x9fb0c8 : 0x56657d, wireframe: true, transparent: true, opacity: dark ? 0.22 : 0.28, depthWrite: false });
    const meshes: WireSet['meshes'] = [];
    const mx = new T.Matrix4();
    for (let fid = 0; fid < f2d.length; fid++) {
      if (keep.has(f2d[fid])) continue;
      const g = fl.getGeometry(fid);
      if (!g?.vb || !g.ib) continue;
      const stride: number = g.vbstride, n = Math.floor(g.vb.length / stride);
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { p[i * 3] = g.vb[i * stride]; p[i * 3 + 1] = g.vb[i * stride + 1]; p[i * 3 + 2] = g.vb[i * stride + 2]; }
      const geo = new T.BufferGeometry();
      geo.addAttribute('position', new T.BufferAttribute(p, 3));
      geo.addAttribute('index', new T.BufferAttribute(g.ib, 1));
      const mesh = new T.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      fl.getWorldMatrix(fid, mx);
      mesh.matrix.copy(mx);
      viewer.impl.addOverlay(scene, mesh);
      meshes.push({ fid, mesh });
    }
    wireSets.set(model, { scene, meshes });
  }
  viewer.impl.invalidate(true, true, true);
}

const NO_EXTRA: ViewerExtra[] = [];

const toVec4 = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new window.THREE.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
};

export default function FacilityViewer({ decks, extra = NO_EXTRA, tags, visible, selected, colors, dark, highlight = null, systemHL = null, sea = null, controlRef, onPick, onLoaded }: FacilityViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const entries = useRef(new Map<string, Entry>());
  const [state, setState] = useState<{ phase: 'loading' | 'ready' | 'error'; message?: string; loaded: number }>({ phase: 'loading', loaded: 0 });
  const [detail, setDetail] = useState<Record<string, string>>({});
  const [rev, setRev] = useState(0); // bumped when a lazily loaded model arrives, so the highlight reaches it
  const abort = useRef<AbortController | null>(null);
  const asked = useRef(new Set<string>());
  const live = useRef({ onPick, selected, tags });
  live.current = { onPick, selected, tags };

  useEffect(() => {
    let dead = false;
    const ctl = new AbortController(); // leaving the page, or another model being picked, stops the downloads and the decoding of this one
    const entriesNow = entries.current;
    abort.current = ctl;
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
        const v = viewerRef.current;
        if (!v) return;
        for (const [eid, e] of entries.current) {
          if (eid !== id && e.parent !== id) continue;
          e.model.setPlacementTransform(m ? new window.THREE.Matrix4().fromArray([...m]) : new window.THREE.Matrix4());
          syncWire(v, e.model);
        }
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
      look: (t, dist, az, el) => {
        const v = viewerRef.current;
        if (!v) return;
        const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
        const target = new window.THREE.Vector3(t[0], t[1], t[2]);
        v.navigation.setView(new window.THREE.Vector3(t[0] + dist * Math.cos(e) * Math.sin(a), t[1] + dist * Math.sin(e), t[2] + dist * Math.cos(e) * Math.cos(a)), target);
        v.navigation.setCameraUpVector(new window.THREE.Vector3(0, 1, 0));
      },
      follow: t => {
        const v = viewerRef.current;
        if (!v) return;
        const cur = v.navigation.getTarget();
        const d = new window.THREE.Vector3(t[0] - cur.x, t[1] - cur.y, t[2] - cur.z);
        if (d.lengthSq() < 1e-6) return;
        v.navigation.setView(v.navigation.getPosition().clone().add(d), cur.clone().add(d));
      },
    };
    return () => { controlRef.current = null; };
  }, [controlRef, state.phase]);

  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    for (const [id, e] of entries.current) { if (visible.has(e.parent ?? id) && (!e.parent || systemHL)) v.showModel(e.model.id); else v.hideModel(e.model.id); }
  }, [visible, state.phase, rev, systemHL]);

  // the system files are fetched when a page asks for them, and handed to the viewer like a deck
  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    for (const x of extra) {
      if (asked.current.has(x.id)) continue;
      asked.current.add(x.id);
      void (async () => {
        try {
          const blobUrl = await fetchDeckUrl(x.url, text => setDetail(d => ({ ...d, [x.id]: text })), abort.current?.signal);
          const model = await new Promise<any>((resolve, reject) => v.loadModel(`${blobUrl}#${x.id}.glb`, {}, resolve, (code: number, msg: string) => reject(new Error(`${x.name}: ${msg || code}`))));
          const data = await nodeTable(model);
          URL.revokeObjectURL(blobUrl);
          setDetail(d => ({ ...d, [x.id]: '' }));
          const tagToDb = new Map<number | string, number>() as Map<string, number>;
          const dbToTag = new Map<number, string>();
          data.gltf.nodes.forEach((n, i) => { const db = data.nodeToDbId[i]; if (n.name && db !== undefined) { tagToDb.set(n.name, db); dbToTag.set(db, n.name); } });
          entries.current.set(x.id, { parent: x.parent, model, tagToDb, dbToTag, rootDb: null });
          setRev(r => r + 1);
        } catch (e) {
          asked.current.delete(x.id);
          setDetail(d => ({ ...d, [x.id]: '' }));
          console.error('system file failed', x.url, e);
        }
      })();
    }
  }, [extra, state.phase]);

  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v || !sea) return;
    const T = window.THREE;
    const name = 'sea-surface';
    v.impl.createOverlayScene(name);
    const mat = new T.MeshBasicMaterial({ color: sea.colour, transparent: true, opacity: sea.opacity, side: T.DoubleSide, depthWrite: false });
    const mesh = new T.Mesh(new T.PlaneGeometry(sea.size[0], sea.size[1]), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(sea.center[0], 0, sea.center[1]);
    v.impl.addOverlay(name, mesh);
    // a grid of lines on the surface, so the water level reads clearly from any angle
    const gridStep = 50, gridPts: number[] = [];
    const hw = sea.size[0] / 2, hd = sea.size[1] / 2;
    for (let x = -hw; x <= hw; x += gridStep) gridPts.push(x, 0.05, -hd, x, 0.05, hd);
    for (let z = -hd; z <= hd; z += gridStep) gridPts.push(-hw, 0.05, z, hw, 0.05, z);
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.Float32BufferAttribute(gridPts, 3));
    const grid = new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55, depthWrite: false }));
    grid.position.set(sea.center[0], 0, sea.center[1]);
    v.impl.addOverlay(name, grid);
    v.impl.invalidate(true, true, true);
    return () => { try { v.impl.removeOverlay(name, mesh); v.impl.removeOverlay(name, grid); v.impl.removeOverlayScene(name); v.impl.invalidate(true, true, true); } catch { /* the viewer has gone */ } };
  }, [sea, state.phase]);

  const isolated = useRef(new Set<string>());
  const wired = useRef(new Set<string>());
  useEffect(() => {
    const v = viewerRef.current;
    if (state.phase !== 'ready' || !v) return;
    for (const [id, e] of entries.current) {
      ensureFragmentTable(e.model);
      v.clearThemingColors(e.model);
      if (e.parent) {
        // a system file: only what matches shows, in its own colour
        if (systemHL?.match) {
          const ids: number[] = [];
          for (const [tag, db] of e.tagToDb) if (systemHL.match(tag)) ids.push(db);
          v.setGhosting(false);
          v.isolate(ids.length ? ids : [-1], e.model);
          isolated.current.add(id);
        } else if (isolated.current.has(id)) { v.isolate([], e.model); isolated.current.delete(id); }
        continue;
      }
      if (systemHL && e.rootDb !== null) {
        // the system keeps its colour; everything else is ghosted (see-through), so the system shows through the parts in front of it
        const ids: number[] = [];
        for (const [tag, db] of e.tagToDb) {
          if (!(systemHL.match ? systemHL.match(tag) : tag.endsWith(`-${systemHL.suffix}`))) continue;
          ids.push(db);
          const c = colors[tag] ?? systemHL.colour;
          if (c) v.setThemingColor(db, toVec4(c), e.model, true);
        }
        if (systemHL.match) {
          // the topside: every other part stays in place as a faint wireframe, so the filtered system reads against the whole platform
          v.setGhosting(false);
          v.isolate(ids.length ? ids : [-1], e.model);
          setWire(v, e.model, new Set(ids), dark);
          wired.current.add(id);
          isolated.current.add(id);
          continue;
        }
        v.isolate(ids.length ? ids : [-1], e.model);
        isolated.current.add(id);
        continue;
      }
      if (wired.current.has(id)) { setWire(v, e.model, null, dark); wired.current.delete(id); }
      if (isolated.current.has(id)) { v.isolate([], e.model); isolated.current.delete(id); v.setGhosting(true); }
      if (highlight && !(typeof highlight === 'string' ? id === highlight : highlight.has(id)) && e.rootDb !== null) {
        // everything but the highlighted part is washed out to a pale grey
        v.setThemingColor(e.rootDb, new window.THREE.Vector4(0.82, 0.85, 0.9, 0.9), e.model, true);
        continue;
      }
      for (const [tag, db] of e.tagToDb) if (colors[tag]) v.setThemingColor(db, toVec4(colors[tag]), e.model, false);
    }
  }, [colors, highlight, systemHL, dark, state.phase, rev]);

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
