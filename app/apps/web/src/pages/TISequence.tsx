import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewerControl } from '../FacilityViewer';
import { lazyPage } from '../lazyPage';
import { usePrefs } from '../state';
import { Btn, ErrorBox, Loading, PageHead, Stat } from '../ui';

const FacilityViewer = lazyPage(() => import('../FacilityViewer'));

type Vec = [number, number, number];
interface Deck { id: string; name: string; file: string; group: string }
interface Body { rest: number[] | null; track: number[] }
interface Stage {
  no: number; name: string; actions: string[]; hook_height_m: number; hook_load?: string; hook_load_mt?: number; hook_load_extreme_mt?: number;
  sling_loads_mt: Record<string, number> | null; sling_loads_extreme_mt?: Record<string, number | null>; pitch_deg: number; roll_deg: number; clearance_m: number;
  flood: Record<string, number>; highlight: string[];
}
interface StepView { target: 'barge' | 'jacket' | 'vessel'; dist: number; az: number; el: number }
interface TiStep { no: number; phase: 'transport' | 'launch' | 'arrive' | 'hookup' | 'upend'; title: string; text: string[]; seconds: number; view: StepView; frames?: [number, number]; upend?: [number, number]; launch_stage?: number; follow?: boolean }
interface Seq {
  source: string; fps: number; seabed: number; frames: number[]; groups: { id: string; name: string; color: string }[]; decks: Deck[]; lineDeck: { file: string; count: number };
  bodies: Record<string, Body>; jacket: { localBBox: Vec[]; bottomRect: [[number, number], [number, number], number]; padeyeBBox: Vec[] };
  crane: { root: Vec; pivot: Vec; tip: Vec; heading: number; hullU: [number, number]; hullHalfWidth: number; hookRestCenter: Vec }; points: Record<string, number[]>; towpoints: Record<string, Vec>; framesOf: Record<string, number>;
  launch: { drawing: string; summary: Record<string, number>; stages: { no: number; name: string; time_s: number; velocity_m_s: number | null }[] };
  upending: { drawing: string; jacket: { weight_mt: number; buoyancy_mt: number; reserve_buoyancy_pct: number; sling_length_m: Record<string, number> }; stages: Stage[]; buoyancy_tanks: { code: string; deck: string | null; note: string }[]; legs: string[] };
  steps: TiStep[];
}

/* ---- small 4x4 algebra, row-major, in the Blender scene's coordinates (X, Y horizontal, Z up) ---- */
type Mat = number[];
const ID: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a: Mat, b: Mat): Mat => { const o = new Array<number>(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]; o[i * 4 + j] = s; } return o; };
const trans = (x: number, y: number, z: number): Mat => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const rotZ = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
const rotY = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
const apply = (m: Mat, p: readonly number[]): Vec => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
/** Inverse of a rigid motion (rotation + translation). */
const invRigid = (m: Mat): Mat => {
  const r = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const t = [-(r[0] * m[3] + r[1] * m[7] + r[2] * m[11]), -(r[3] * m[3] + r[4] * m[7] + r[5] * m[11]), -(r[6] * m[3] + r[7] * m[7] + r[8] * m[11])];
  return [r[0], r[1], r[2], t[0], r[3], r[4], r[5], t[1], r[6], r[7], r[8], t[2], 0, 0, 0, 1];
};
const fromQuat = (t: Vec, q: number[]): Mat => {
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), t[0], 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), t[1], 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), t[2], 0, 0, 0, 1];
};
const slerp = (a: number[], b: number[], u: number): number[] => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d = Math.abs(d);
  let k0 = 1 - u, k1 = u;
  if (d < 0.9995) { const th = Math.acos(d), sn = Math.sin(th); k0 = Math.sin((1 - u) * th) / sn; k1 = Math.sin(u * th) / sn; }
  const q = a.map((v, i) => k0 * v + k1 * s * b[i]);
  const n = Math.hypot(...q);
  return q.map(v => v / n);
};
/** Blender (X, Y, Z up) to the viewer's glTF space (X, Y up, -Z): p' = C p, so a motion M becomes C M C^T. Column-major for the viewer. */
const toViewer = (m: Mat): number[] => {
  const C = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
  const Ct = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  const r = mul(mul(C, m), Ct);
  return [0, 1, 2, 3].flatMap(c => [r[c], r[4 + c], r[8 + c], r[12 + c]]);
};
const viewerPoint = (p: readonly number[]): Vec => [p[0], p[2], -p[1]];
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);

/** The motion that stretches the 1 m unit box of the line deck from point a to point b, `w` metres thick. */
function lineMatrix(a: Vec, b: Vec, w: number): Mat {
  const d = sub(b, a);
  const L = Math.max(len(d), 0.01);
  const ex: Vec = [d[0] / L, d[1] / L, d[2] / L];
  let ey: Vec = [-ex[1], ex[0], 0];
  if (Math.hypot(ey[0], ey[1]) < 1e-4) ey = [0, 1, 0];
  const n = Math.hypot(ey[0], ey[1], ey[2]);
  ey = [ey[0] / n, ey[1] / n, ey[2] / n];
  const ez: Vec = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
  return [ex[0] * L, ey[0] * w, ez[0] * w, a[0], ex[1] * L, ey[1] * w, ez[1] * w, a[1], ex[2] * L, ey[2] * w, ez[2] * w, a[2], 0, 0, 0, 1];
}

/** Where a body (jacket, barge, tug…) stands at animation frame `f`, interpolated between the sampled frames of the Blender scene. */
function sampleBody(seq: Seq, name: string, f: number): Mat {
  const fr = seq.frames, tr = seq.bodies[name].track;
  let lo = 0, hi = fr.length - 1;
  if (f <= fr[0]) hi = lo; else if (f >= fr[hi]) lo = hi; else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fr[mid] <= f) lo = mid; else hi = mid; }
  const at = (i: number) => tr.slice(i * 7, i * 7 + 7);
  const A = at(lo), B = at(hi);
  const u = hi === lo ? 0 : (f - fr[lo]) / (fr[hi] - fr[lo]);
  return fromQuat([lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)], slerp(A.slice(3), B.slice(3), u));
}

/** A line between two points; `sag` (fraction of its length) makes it hang under its own weight, drawn as `n` straight pieces. */
interface Line { a: Vec; b: Vec; w: number; sag?: number; n?: number }

/** The straight pieces of a hanging line: a parabola below the chord, as a slack tow wire or line hangs. */
function segments(l: Line): { a: Vec; b: Vec; w: number }[] {
  const n = l.n ?? 1;
  if (n === 1 || !l.sag) return [{ a: l.a, b: l.b, w: l.w }];
  const drop = Math.min(24, l.sag * len(sub(l.b, l.a)));
  const at = (i: number): Vec => { const t = i / n; return [lerp(l.a[0], l.b[0], t), lerp(l.a[1], l.b[1], t), lerp(l.a[2], l.b[2], t) - 4 * drop * t * (1 - t)]; };
  return Array.from({ length: n }, (_, i) => ({ a: at(i), b: at(i + 1), w: l.w }));
}

interface Frame {
  matrices: Map<string, number[] | null>; visible: Set<string>; lines: Line[]; focus: Vec; pitch: number | null; stage: Stage | null; hookHeight: number | null;
  slings: Record<string, number> | null; frame: number | null; upendStep: boolean; flood: Record<string, number>; clearance: number | null; barge: number | null;
}

/** The jacket's footprint in plan, relative to its padeye centre, over the whole upending (the union of its poses from lying to upright). */
function jacketPlan(seq: Seq, MJ: Mat, padCentre: Vec, _padeyes: Record<string, Vec>): { x0: number; x1: number; y0: number; y1: number } {
  const [lo, hi] = seq.jacket.localBBox;
  const R0: Mat = [MJ[0], MJ[1], MJ[2], 0, MJ[4], MJ[5], MJ[6], 0, MJ[8], MJ[9], MJ[10], 0, 0, 0, 0, 1];
  const out = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
  for (const phi of [0, 20, 40, 60, 80, 90]) {
    const R = mul(R0, rotY((-phi * Math.PI) / 180));
    const pc = apply(R, padCentre);
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
      const p = apply(R, [x, y, z]);
      out.x0 = Math.min(out.x0, p[0] - pc[0]); out.x1 = Math.max(out.x1, p[0] - pc[0]);
      out.y0 = Math.min(out.y0, p[1] - pc[1]); out.y1 = Math.max(out.y1, p[1] - pc[1]);
    }
  }
  return out;
}

const placements = new WeakMap<Seq, { psi: number; slew: number; clearance: number }>();

/**
 * Where the crane vessel lies, as a heading and how far its crane has turned: the hook above the boom tip is over the padeye centre, the crane has a fixed reach
 * from its pedestal, and the hull must stay clear of the jacket's footprint. Searched over all headings and slew angles for the largest clearance.
 */
function vesselPlacement(seq: Seq, plan: { x0: number; x1: number; y0: number; y1: number }): { psi: number; slew: number; clearance: number } {
  const cached = placements.get(seq);
  if (cached) return cached;
  const cr = seq.crane;
  const root0 = cr.root as Vec, piv0 = cr.pivot as Vec, tip0 = cr.tip as Vec;
  const dTip = sub(tip0, piv0);
  const aAng = (cr.heading * Math.PI) / 180;
  const hull: [number, number][] = [];
  const [u0, u1] = cr.hullU, hw = cr.hullHalfWidth;
  // the hull outline in the vessel's frame (relative to the root; the long axis along `aAng`)
  for (const [uu, vv] of [[u0, -hw], [u1, -hw], [u1, hw], [u0, hw]]) hull.push([uu, vv]);
  const edge: [number, number][] = [];
  for (let i = 0; i < 4; i++) { const a = hull[i], b = hull[(i + 1) % 4]; for (let k = 0; k <= 24; k++) edge.push([lerp(a[0], b[0], k / 24), lerp(a[1], b[1], k / 24)]); }
  const rect = (x: number, y: number) => Math.hypot(Math.max(plan.x0 - x, 0, x - plan.x1), Math.max(plan.y0 - y, 0, y - plan.y1));
  const dRoot: Vec = [root0[0] - piv0[0], root0[1] - piv0[1], 0];
  let best = { psi: 0, slew: 0, clearance: -1e9 };
  for (let ps = 0; ps < 360; ps += 3) {
    for (let sl = 0; sl < 360; sl += 6) {
      const psi = (ps * Math.PI) / 180, sigma = (sl * Math.PI) / 180;
      // the hook (at the origin) is over the tip: pivot = -(tip - pivot) turned by psi + sigma
      const c1 = Math.cos(psi + sigma), s1 = Math.sin(psi + sigma);
      const pv: [number, number] = [-(c1 * dTip[0] - s1 * dTip[1]), -(s1 * dTip[0] + c1 * dTip[1])];
      const c0 = Math.cos(psi), s0 = Math.sin(psi);
      const rt: [number, number] = [pv[0] + c0 * dRoot[0] - s0 * dRoot[1], pv[1] + s0 * dRoot[0] + c0 * dRoot[1]];
      // the vessel frame is aligned so that its long axis (angle aAng at rest) is turned to the heading psi - aAng... the model's own rotation is built in, so rotate by psi about the root
      let clear = 1e9;
      for (const [uu, vv] of edge) {
        // the point of the hull in the rest world frame, relative to the root
        const rx = Math.cos(aAng) * uu - Math.sin(aAng) * vv, ry = Math.sin(aAng) * uu + Math.cos(aAng) * vv;
        const x = rt[0] + c0 * rx - s0 * ry, y = rt[1] + s0 * rx + c0 * ry;
        const d = rect(x, y);
        // a point inside the footprint counts as a negative clearance
        const inside = x > plan.x0 && x < plan.x1 && y > plan.y0 && y < plan.y1;
        clear = Math.min(clear, inside ? -Math.min(x - plan.x0, plan.x1 - x, y - plan.y0, plan.y1 - y) : d);
      }
      // the crane's own reach and the boom must also stay out of the way of the jacket when stowed: nothing more to test, the boom is above the water line
      if (clear > best.clearance) best = { psi, slew: sigma, clearance: clear };
    }
  }
  placements.set(seq, best);
  return best;
}

/**
 * Everything that stands somewhere at second `u` (0..1) of a step: the animation of the Blender scene up to the barge leaving, then the crane vessel moving in beside
 * the jacket (which stays where it floated after the launch), its crane reaching over it, and the upending posed from the stage table.
 */
function pose(seq: Seq, step: TiStep, u: number): Frame {
  const matrices = new Map<string, number[] | null>();
  const visible = new Set<string>(['seabed-launch', 'jacket', 'cradle', 'tank-a2', 'tank-a5', 'tank-c2', 'tank-c5', 'tug-1', 'tug-2', 'tug-3', 'tug-4']);
  const lines: Line[] = [];
  const after = step.phase === 'arrive' || step.phase === 'hookup' || step.phase === 'upend';
  const f = after ? seq.framesOf.tow : step.frames ? lerp(step.frames[0], step.frames[1], u) : seq.framesOf.tow;
  const jacketDecks = ['jacket', 'cradle', 'tank-a2', 'tank-a5', 'tank-c2', 'tank-c5'];
  const set = (id: string, m: Mat) => matrices.set(id, toViewer(m));
  const rest = (b: string) => seq.bodies[b].rest ?? ID;
  const body = (b: string) => mul(sampleBody(seq, b, f), invRigid(rest(b)));
  const bbJ = seq.jacket.localBBox;
  const jacketCentre: Vec = [(bbJ[0][0] + bbJ[1][0]) / 2, (bbJ[0][1] + bbJ[1][1]) / 2, (bbJ[0][2] + bbJ[1][2]) / 2];
  const pad = seq.jacket.padeyeBBox;
  const padZ = (pad[0][2] + pad[1][2]) / 2;
  const padCentre: Vec = [0, 0, padZ];
  const padeyes: Record<string, Vec> = { A2: [pad[0][0], pad[1][1], padZ], A5: [pad[0][0], pad[0][1], padZ], C2: [pad[1][0], pad[1][1], padZ], C5: [pad[1][0], pad[0][1], padZ] };
  const [[bx0, by0], [bx1, by1], bz] = seq.jacket.bottomRect;
  const corners: Vec[] = [[bx0, by0, bz], [bx0, by1, bz], [bx1, by0, bz], [bx1, by1, bz]];

  const MJ = sampleBody(seq, 'jacket', f);
  let jacketM = MJ;
  let focus: Vec;
  let pitch: number | null = null;
  let stage: Stage | null = null;
  let hookHeight: number | null = null;
  let slings: Record<string, number> | null = null;
  let flood: Record<string, number> = {};
  let clearance: number | null = null;
  const shifts: Record<string, Vec> = { '1': [0, 0, 0], '2': [0, 0, 0], '3': [0, 0, 0], '4': [0, 0, 0] };

  const showYard = !after && step.no <= 12;
  if (showYard) {
    for (const id of ['barge', 'rocker', 'tug-0']) visible.add(id);
    set('barge', body('barge')); set('rocker', body('rocker')); set('tug-0', body('tug-0'));
  }
  const barge = showYard ? (Math.asin(Math.max(-1, Math.min(1, apply(sampleBody(seq, 'barge', f), [1, 0, 0])[2] - sampleBody(seq, 'barge', f)[11]))) * 180) / Math.PI : null;

  if (!after) {
    pitch = (Math.asin(Math.max(-1, Math.min(1, apply(MJ, [0, 0, 1])[2] - MJ[11]))) * 180) / Math.PI;
    focus = step.view.target === 'barge' && showYard ? apply(sampleBody(seq, 'barge', f), [71, 0, 8]) : apply(MJ, jacketCentre);
    for (const t of ['tug-1', 'tug-2', 'tug-3', 'tug-4']) set(t, body(t));
    for (const id of jacketDecks) set(id, body('jacket'));
    lines.push(...towLines(seq, f, jacketM, shifts, false, step));
    return { matrices, visible, lines, focus: viewerPoint(focus), pitch, stage, hookHeight, slings, frame: f, upendStep: false, flood, clearance, barge };
  }

  // ---- the crane vessel. The crane is one piece (house, mast, boom, head): it slews as a whole on its pedestal, which stays on the hull. The hull is placed
  // (heading and slew angle searched once for the largest clearance from the jacket's plan) so that the hook above the boom tip is over the padeyes.
  visible.add('vessel'); visible.add('crane'); visible.add('hook');
  const cr = seq.crane;
  const root0 = cr.root as Vec, piv0 = cr.pivot as Vec, tip0 = cr.tip as Vec;
  const towPad = apply(MJ, padCentre);
  const best = vesselPlacement(seq, jacketPlan(seq, MJ, padCentre, padeyes));
  const psiH = best.psi; // hull heading
  const sigma = best.slew; // how far the crane has turned, from stowed along the hull to over the jacket
  const dTip = sub(tip0, piv0);
  const rotXY = (ang: number, v: Vec): Vec => [Math.cos(ang) * v[0] - Math.sin(ang) * v[1], Math.sin(ang) * v[0] + Math.cos(ang) * v[1], v[2]];
  const ups = (v: number, a: number, b: number) => ease(clamp01((v - a) / (b - a)));
  const arriving = step.phase === 'arrive';
  const arrive = arriving ? ups(u, 0, 1) : 1;
  const tipFinalOff = rotXY(psiH + sigma, dTip);
  const pivFinal: Vec = [towPad[0] - tipFinalOff[0], towPad[1] - tipFinalOff[1], 0];
  const away = (() => { const d = sub(pivFinal, towPad); const L = Math.hypot(d[0], d[1]) || 1; return [d[0] / L, d[1] / L] as [number, number]; })();
  const APPROACH = 450; // metres the vessel sails in from the side away from the jacket
  const pivNow: Vec = [pivFinal[0] + away[0] * APPROACH * (1 - arrive), pivFinal[1] + away[1] * APPROACH * (1 - arrive), 0];
  const dRoot = sub(root0, piv0);
  const rRoot = rotXY(psiH, dRoot);
  const rootNow: Vec = [pivNow[0] + rRoot[0], pivNow[1] + rRoot[1], 0];
  const hullM = mul(mul(trans(rootNow[0], rootNow[1], 0), rotZ(psiH)), trans(-root0[0], -root0[1], 0));
  const slew = arriving ? 0 : step.phase === 'hookup' ? ups(u, 0, 0.5) : 1;
  const craneM = mul(mul(trans(pivNow[0], pivNow[1], 0), rotZ(psiH + slew * sigma)), trans(-piv0[0], -piv0[1], 0));
  set('vessel', hullM); set('crane', craneM);
  const tip = apply(craneM, tip0);
  const hookOff = sub(apply(craneM, cr.hookRestCenter as Vec), tip); // the hook hangs this far from the tip when the crane is stowed

  // the tugs release their lines and stand off, clear of the vessel
  const open = arriving ? ups(u, 0, 0.5) : 1;
  for (const i of ['1', '2', '3', '4']) {
    const m = sampleBody(seq, `tug-${i}`, f);
    const d: Vec = [m[3] - towPad[0], m[7] - towPad[1], 0];
    const L = Math.hypot(d[0], d[1]) || 1;
    shifts[i] = [(d[0] / L) * 220 * open, (d[1] / L) * 220 * open, 0];
    set(`tug-${i}`, mul(trans(...shifts[i]), body(`tug-${i}`)));
  }

  let phi = 0;
  let zl = Math.min(...corners.map(c => apply(MJ, c)[2]));
  let hookPos: Vec = [tip[0] + hookOff[0], tip[1] + hookOff[1], cr.hookRestCenter[2]];
  const ropeAlways: Vec = tip;
  if (!arriving) {
    const [i0, i1] = step.upend as [number, number];
    const st = seq.upending.stages;
    const s1 = st[i1];
    stage = s1;
    if (step.phase === 'hookup') {
      const lower = ups(u, 0.4, 0.85);
      const settle = ups(u, 0.8, 1);
      phi = lerp(0, s1.pitch_deg, settle);
      zl = lerp(zl, seq.seabed + s1.clearance_m, settle);
      hookPos = [tip[0] + hookOff[0] * (1 - lower), tip[1] + hookOff[1] * (1 - lower), lerp(cr.hookRestCenter[2], s1.hook_height_m, lower)];
    } else {
      const a = i0 < 0 ? st[0] : st[i0];
      const e = ease(clamp01(u));
      phi = lerp(a.pitch_deg, s1.pitch_deg, e);
      zl = seq.seabed + lerp(a.clearance_m, s1.clearance_m, e);
      hookPos = [tip[0], tip[1], lerp(a.hook_height_m, s1.hook_height_m, e)];
      const names = Object.keys({ ...a.flood, ...s1.flood });
      flood = Object.fromEntries(names.map(n => [n, lerp(a.flood[n] ?? 0, s1.flood[n] ?? 0, e)]));
    }
    hookHeight = hookPos[2];
    clearance = zl - seq.seabed;
  }
  pitch = phi;
  // pose of the jacket for a pitch phi (jacket length axis above horizontal), padeye centre kept where it floated, lowest point at height zl
  const R0: Mat = [MJ[0], MJ[1], MJ[2], 0, MJ[4], MJ[5], MJ[6], 0, MJ[8], MJ[9], MJ[10], 0, 0, 0, 0, 1];
  const R = mul(R0, rotY((-phi * Math.PI) / 180));
  const pc = apply(R, padCentre);
  const low = Math.min(...corners.map(c => apply(R, c)[2]));
  jacketM = phi === 0 ? MJ : mul(trans(towPad[0] - pc[0], towPad[1] - pc[1], zl - low), R);
  const placed = mul(jacketM, invRigid(rest('jacket')));
  for (const id of jacketDecks) set(id, placed);
  set('hook', trans(hookPos[0] - cr.hookRestCenter[0], hookPos[1] - cr.hookRestCenter[1], hookPos[2] - cr.hookRestCenter[2]));

  lines.push({ a: ropeAlways, b: [hookPos[0], hookPos[1], hookPos[2] + 2.4], w: 1.0 }); // the hoist rope, from the boom tip to the hook
  const slingsOn = (step.phase === 'hookup' && u > 0.9) || (step.phase === 'upend' && stage?.hook_load !== 'slack');
  if (slingsOn) {
    slings = {};
    for (const [k, p] of Object.entries(padeyes)) { const w = apply(jacketM, p); const top: Vec = [hookPos[0], hookPos[1], hookPos[2] - 2.4]; /* the slings hang from the hook itself */ lines.push({ a: top, b: w, w: 0.6 }); slings[k] = len(sub(w, top)); }
  }
  focus = step.view.target === 'vessel' ? [rootNow[0], rootNow[1], 25] : apply(jacketM, jacketCentre);
  if (stage && step.phase === 'upend' && step.no === seq.steps.length) hookHeight = stage.hook_height_m;
  return { matrices, visible, lines, focus: viewerPoint(focus), pitch, stage, hookHeight, slings, frame: null, upendStep: true, flood, clearance, barge: null };
}

/** A named point of the Blender scene (a tug's line end, the bridle apex, a fairlead…) at frame `f`. */
function samplePoint(seq: Seq, name: string, f: number): Vec {
  const fr = seq.frames, tr = seq.points[name];
  let lo = 0, hi = fr.length - 1;
  if (f <= fr[0]) hi = lo; else if (f >= fr[hi]) lo = hi; else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fr[mid] <= f) lo = mid; else hi = mid; }
  const u = hi === lo ? 0 : (f - fr[lo]) / (fr[hi] - fr[lo]);
  return [0, 1, 2].map(k => lerp(tr[lo * 3 + k], tr[hi * 3 + k], u)) as Vec;
}

/**
 * Tow lines, as the Blender scene rigs them: the lead tug's wire runs from its stern to the bridle apex and from there to the two bow fairleads of the barge;
 * each of the four tugs runs a line from its stern to its own tow point on the jacket (JKT_TOWPOINT_1..4), from the moment it receives the line.
 */
function towLines(seq: Seq, f: number, jacketM: Mat, shifts: Record<string, Vec>, hold: boolean, step?: TiStep): Frame['lines'] {
  const out: Line[] = [];
  const bargeOn = !hold && (step?.no ?? 99) <= 12;
  if (bargeOn) {
    const apex = samplePoint(seq, 'apex', f);
    out.push({ a: samplePoint(seq, 'mainStern', f), b: apex, w: 1.2, sag: 0.05, n: 6 });
    out.push({ a: apex, b: samplePoint(seq, 'fairP', f), w: 0.8, sag: 0.03, n: 2 });
    out.push({ a: apex, b: samplePoint(seq, 'fairS', f), w: 0.8, sag: 0.03, n: 2 });
  }
  const from: Record<string, number> = { '1': seq.framesOf.tug1, '2': seq.framesOf.tug2, '3': seq.framesOf.tug3, '4': seq.framesOf.tug4 };
  for (const i of Object.keys(from)) {
    if (f < from[i] && !hold) continue;
    const e = samplePoint(seq, `line${i}`, f);
    out.push({ a: [e[0] + shifts[i][0], e[1] + shifts[i][1], e[2]], b: apply(jacketM, seq.towpoints[i]), w: 1.0, sag: 0.06, n: 6 });
  }
  return out;
}

/** Does the one-off vessel placement search before the first step that needs it, so that step does not stall. */
function warmUp(seq: Seq) {
  const pad = seq.jacket.padeyeBBox;
  const padCentre: Vec = [0, 0, (pad[0][2] + pad[1][2]) / 2];
  const MJ = sampleBody(seq, 'jacket', seq.framesOf.tow);
  vesselPlacement(seq, jacketPlan(seq, MJ, padCentre, {}));
}

const kindName = (s: TiStep) => (s.phase === 'launch' ? 'Launch' : s.phase === 'upend' ? 'Upending' : s.phase === 'hookup' ? 'Hook-up' : s.phase === 'arrive' ? 'Vessel' : 'Tow');

/** T&I → Sequence: the offshore transportation and installation of the ST-CGF jacket, from the barge arriving at the launch site to the jacket on the seabed. */
export default function TISequence({ standalone = false }: { standalone?: boolean } = {}) {
  const { dark } = usePrefs();
  const seqQ = useQuery({
    queryKey: ['ti-sequence', 1],
    queryFn: async () => {
      const r = await fetch(`${import.meta.env.BASE_URL}sequence/ti/sequence.json`, { cache: 'no-cache' });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('The T&I sequence files have not been built yet (data/3d-model/pipeline/build_ti_sequence.py).');
      return (await r.json()) as Seq;
    },
    staleTime: 60_000,
  });
  const seq = seqQ.data;
  const [now, setNow] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [sea, setSea] = useState(true);
  const [readout, setReadout] = useState<Frame | null>(null);
  const [progress, setProgress] = useState(0);
  const control = useRef<ViewerControl | null>(null);
  const clock = useRef({ u: 0, running: true, last: 0, step: 1, looked: 0, lookStep: 0 });
  const live = useRef({ playing, speed, follow });
  live.current = { playing, speed, follow };
  const list = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());

  const steps = seq?.steps ?? [];
  const step = steps.find(s => s.no === now);
  const decks = useMemo(() => {
    if (!seq) return [];
    const url = (f: string) => new URL(`${import.meta.env.BASE_URL}sequence/ti/${f}`, document.baseURI).href;
    return [...seq.decks.map(d => ({ id: d.id, name: d.name, url: url(d.file) })), ...Array.from({ length: seq.lineDeck.count }, (_, i) => ({ id: `ln-${i}`, name: `Line ${i + 1}`, url: url(seq.lineDeck.file) }))];
  }, [seq]);

  const goto = useCallback((n: number, u = 0) => { clock.current.step = n; clock.current.u = u; clock.current.running = true; setNow(n); }, []);
  const go = (n: number) => { setPlaying(false); goto(Math.min(Math.max(n, 1), steps.length), 0); };

  useEffect(() => {
    if (!seq) return;
    let raf = 0;
    const sent = new Map<string, string>();
    let shownKey = '';
    let prev: ViewerControl | null = null;
    let lastRead = 0;
    let focusNow: Vec | null = null; // the followed point is smoothed, so that a change of target between steps does not make the camera jump
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const c = clock.current;
      const dt = c.last ? Math.min(0.1, (ts - c.last) / 1000) : 0;
      c.last = ts;
      const s = seq.steps.find(x => x.no === c.step);
      if (!s) return;
      if (c.running && live.current.playing) {
        c.u += (dt * live.current.speed) / s.seconds;
        if (c.u >= 1) { c.u = 1; if (c.step >= seq.steps.length) setPlaying(false); else goto(c.step + 1, 0); }
      }
      const f = pose(seq, s, c.u);
      const segs = f.lines.flatMap(segments).slice(0, seq.lineDeck.count);
      const ids = [...f.visible, ...segs.map((_, i) => `ln-${i}`)].sort().join();
      if (ids !== shownKey) { shownKey = ids; setShown(new Set([...f.visible, ...segs.map((_, i) => `ln-${i}`)])); }
      const ctl = control.current;
      if (ctl !== prev) { prev = ctl; sent.clear(); c.lookStep = 0; }  // the camera is aimed once, when the viewer is ready; after that only "Follow the action" moves it
      if (!ctl) return;
      for (const d of seq.decks) {
        const m = f.matrices.get(d.id);
        const key = m ? m.map(v => v.toFixed(3)).join() : '';
        if (sent.get(d.id) === key) continue;
        sent.set(d.id, key);
        ctl.setTransform(d.id, m ?? null);
      }
      for (let i = 0; i < seq.lineDeck.count; i++) {
        const l = segs[i];
        const key = l ? `${l.a.map(v => v.toFixed(2))}|${l.b.map(v => v.toFixed(2))}` : '';
        if (sent.get(`ln-${i}`) === key) continue;
        sent.set(`ln-${i}`, key);
        if (l) ctl.setTransform(`ln-${i}`, toViewer(lineMatrix(l.a, l.b, l.w))); else ctl.setTransform(`ln-${i}`, toViewer(lineMatrix([0, 0, -500], [0, 0, -500.01], 0.01)));
      }
      if (c.lookStep === 0) { c.lookStep = c.step; ctl.look?.(f.focus, s.view.dist, s.view.az, s.view.el); } else if (live.current.follow) { const k = 1 - Math.exp(-dt * 3); focusNow = focusNow ? (focusNow.map((v, i) => v + (f.focus[i] - v) * k) as Vec) : f.focus; ctl.follow?.(focusNow); }
      if (!live.current.follow) focusNow = null;
      if (ts - lastRead > 90) { lastRead = ts; setReadout(f); setProgress(c.u); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seq, goto]);
  useEffect(() => { if (seq) warmUp(seq); }, [seq]);
  useEffect(() => { list.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' }); }, [now]);

  const visible = shown;
  const seaPlane = useMemo(() => (sea ? { center: [150, 120] as [number, number], size: [1300, 900] as [number, number], colour: 0x1f7fd1, opacity: 0.5 } : null), [sea]);
  const total = steps.length;
  const sum = seq?.launch.summary;
  const up = seq?.upending;
  const floodRows = readout ? Object.entries(readout.flood).filter(([, v]) => v > 0.5) : [];

  const body = (
    <>
      {standalone ? (
        <header className="ti-solo-head">
          <h1>Jacket T&amp;I sequence</h1>
          <p>Offshore transportation and installation of the ST-CGF jacket: tow, launch, crane vessel hook-up, floatation and upending.</p>
        </header>
      ) : (
      <PageHead title="Jacket T&I sequence" desc="Offshore transportation and installation of the ST-CGF jacket: the barge arriving at the launch site and the tugs connecting, the six stages of the launch, the tow of the floating jacket to the crane vessel, and the floatation and upending in nine stages. The motion up to the upending position follows the Blender scene; the upending is posed from the stage table of drawing 2021-4589-66-0009."
        actions={<Btn kind="small" icon="refresh" onClick={() => void seqQ.refetch()}>Refresh</Btn>} />
      )}
      {!standalone && <div className="stats">
        <Stat label="Steps" value={seq ? total : '—'} foot={seq ? `${steps.filter(s => s.phase === 'launch').length} launch stages, ${steps.filter(s => s.phase === 'upend').length} upending stages after the hook-up` : 'Offshore T&I of the jacket'} icon="layers" />
        <Stat label="Jacket weight" value={sum ? `${sum.jacket_weight_mt.toLocaleString('en-GB')} MT` : '—'} foot={up ? `${up.jacket.weight_mt.toLocaleString('en-GB')} MT factored for the upending` : ''} icon="box" />
        <Stat label="Min. seabed clearance" value={sum ? `${sum.min_seabed_clearance_m.toFixed(2)} m` : '—'} foot="During the launch, water depth 52.30 m (LAT)" icon="chart" />
        <Stat label="Max. pin reaction" value={sum ? `${sum.max_pin_reaction_mt.toLocaleString('en-GB')} MT` : '—'} foot={sum ? `Reserve buoyancy ${sum.min_reserve_buoyancy_pct}% after the launch` : ''} icon="edit" />
      </div>}

      {seqQ.error ? <ErrorBox error={seqQ.error} /> : !seq ? <Loading label="Loading the T&I sequence…" /> : (
        <div className="fl-grid">
          <div className="panel fl-view">
            <div className="panel-head">
              <div><h2>Step {now} of {total} · {step ? kindName(step) : ''}</h2><p>{step?.title}. Drag to orbit, right-drag to pan, scroll to zoom.</p></div>
              <div className="actions">
                <Btn kind="small" icon="chevron-left" iconOnly aria-label="Previous step" disabled={now <= 1} onClick={() => go(now - 1)} />
                <Btn kind="small primary" onClick={() => { if (playing) setPlaying(false); else { if (now >= total && progress >= 1) goto(1, 0); setPlaying(true); } }}>{playing ? 'Pause' : 'Play all'}</Btn>
                <Btn kind="small" icon="refresh" iconOnly aria-label="Replay this step" onClick={() => go(now)} />
                <Btn kind="small" icon="chevron-right" iconOnly aria-label="Next step" disabled={now >= total} onClick={() => go(now + 1)} />
              </div>
            </div>
            <div className="seq-scrub">
              <input type="range" min={0} max={total * 1000 - 1} step={1} value={Math.min(total * 1000 - 1, (now - 1) * 1000 + Math.round(progress * 999))} aria-label="Position in the sequence"
                onChange={e => { const v = Number(e.target.value); setPlaying(false); goto(Math.floor(v / 1000) + 1, (v % 1000) / 999); }} />
            </div>
            <div className="chip-bar" role="group" aria-label="View">
              <button type="button" className={`chip-filter ${follow ? 'active' : ''}`} aria-pressed={follow} onClick={() => setFollow(f => !f)} title="Keep the camera on the barge or the jacket as they move. Dragging or zooming the view switches it off, so you can orbit, pan and zoom freely.">Follow the action</button>
              <button type="button" className={`chip-filter ${sea ? 'active' : ''}`} aria-pressed={sea} onClick={() => setSea(x => !x)} title="Show the sea surface; hide it to see the part of the jacket under water">Sea surface</button>
              <button type="button" className="chip-filter" onClick={() => { if (step && readout) control.current?.look?.(readout.focus, step.view.dist, step.view.az, step.view.el); }}>Reset view</button>
              <button type="button" className="chip-filter" onClick={() => { if (step && readout) control.current?.look?.(readout.focus, step.view.dist * 0.45, step.view.az + 70, 10); }}>Close-up</button>
              <label className="seq-speed">Speed <select className="filter" value={speed} aria-label="Animation speed" onChange={e => setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
            </div>
            <div className="fl-stage-wrap" onPointerDownCapture={() => setFollow(false)} onWheelCapture={() => setFollow(false)}>
              <Suspense fallback={<Loading label="Loading the 3D viewer…" />}>
                <FacilityViewer decks={decks} tags={NO_TAGS} visible={visible} selected={null} colors={NO_COLOURS} sea={seaPlane} controlRef={control} dark={dark} onPick={noop} />
              </Suspense>
              {step && <div className="seq-caption" role="status">{step.title}</div>}
            </div>
            <div className="ti-readout" aria-label="Readout">
              {readout?.frame != null && <span>Time <b>{((readout.frame - 1) / seq.fps).toFixed(0)} s</b></span>}
              {readout?.pitch != null && <span>Jacket pitch <b>{readout.pitch.toFixed(1)}°</b></span>}
              {readout?.barge != null && step?.phase !== 'upend' && <span>Barge trim <b>{readout.barge.toFixed(1)}°</b></span>}
              {readout?.hookHeight != null && <span>Hook height <b>{readout.hookHeight.toFixed(1)} m</b></span>}
              {readout?.clearance != null && <span>Seabed clearance <b>{readout.clearance.toFixed(1)} m</b></span>}
              {readout?.stage && step?.phase === 'upend' && <span>Hook load <b>{readout.stage.hook_load_mt ? `${readout.stage.hook_load_mt} MT${readout.stage.hook_load_extreme_mt ? ` (${readout.stage.hook_load_extreme_mt})` : ''}` : readout.stage.hook_load}</b></span>}
            </div>
            <div className="fl-legend" aria-label="Legend">
              {seq.groups.filter(g => g.id !== 'water').map(g => <span key={g.id}><i className="fl-dot" style={{ background: g.color }} aria-hidden="true" />{g.name}</span>)}
            </div>
            <p className="tiny muted seq-note">Geometry and the motion of the barge, rocker arm, jacket and tugs come from STT2B_CGF_Jacket_Light.blend (the crane vessel is reduced in detail). The upending is not animated in that file: the jacket is posed for each stage from the drawing's hook height, pitch and seabed clearance, with the lifting slings drawn from the hook to the four padeyes (rows A2, A5, C2 and C5). Tow lines are indicative.</p>
          </div>

          <div className="panel fl-list">
            <div className="panel-head"><div><h2>Steps</h2><p>{seq.launch.drawing.split(',')[0]} and {seq.upending.drawing.split(',')[0]}</p></div></div>
            <ol className="seq-steps" ref={list}>
              {steps.map(s => (
                <li key={s.no} className={`seq-step ${s.no === now ? 'on' : ''} ${s.no < now ? 'done' : ''}`} aria-current={s.no === now ? 'step' : undefined}>
                  <button type="button" className="seq-head" onClick={() => go(s.no)} aria-expanded={s.no === now}>
                    <span className="seq-no">{s.no}</span>
                    <span className="seq-title">{s.title}</span>
                    <span className={`seq-kind ${s.phase === 'launch' ? 'lift' : s.phase === 'upend' || s.phase === 'hookup' || s.phase === 'arrive' ? 'rollup' : 'fab'}`}>{kindName(s)}</span>
                  </button>
                  {s.no === now && (
                    <div className="seq-body">
                      <ul className="ti-text">{s.text.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      {readout?.stage && (s.phase === 'upend' || s.phase === 'hookup') && <StageTable stage={readout.stage} live={readout.slings} design={up?.jacket.sling_length_m} />}
                      {floodRows.length > 0 && (
                        <>
                          <h3 className="seq-sub">Flooding</h3>
                          <ul className="ti-flood">{floodRows.map(([k, v]) => <li key={k}><span>{k}</span><span className="ti-bar"><i style={{ width: `${v}%` }} /></span><b>{Math.round(v)}%</b></li>)}</ul>
                        </>
                      )}
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
  return standalone ? <div className="lintel ti-solo">{body}</div> : body;
}

const NO_TAGS: ReadonlySet<string> = new Set();
const NO_COLOURS: Readonly<Record<string, string>> = {};
const noop = () => undefined;

function StageTable({ stage, live, design }: { stage: Stage; live: Record<string, number> | null; design?: Record<string, number> }) {
  const rows = ['A5', 'A2', 'C2', 'C5'];
  return (
    <table className="ti-table">
      <caption>Stage {stage.no}: {stage.name}</caption>
      <thead><tr><th>Sling</th><th>Load (MT)</th><th>Length (m)</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r}>
            <td>{r}</td>
            <td>{stage.sling_loads_mt ? `${stage.sling_loads_mt[r]}${stage.sling_loads_extreme_mt?.[r] ? ` (${stage.sling_loads_extreme_mt[r]})` : ''}` : 'slack'}</td>
            <td>{live?.[r] ? live[r].toFixed(1) : '—'}{design?.[r] ? ` / ${design[r]}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
