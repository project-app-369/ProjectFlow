"""Splits the LQM#2 model by FLOOR for Construction -> Facility layout (one GLB per floor, like the topside decks).

    python build_lqm_floors.py <outDir>        e.g. ... ../../../app/apps/web/public/models

Reads  out/m/lqm/<discipline>.bin   (what ModelTool `groups` welded in Navisworks, see classify_lqm.py / build_models.py)
       out/m/lqm_leaves.tsv         (leaf bounding boxes: to cut the tagged equipment out of the discipline meshes)
Writes <outDir>/lqm/<floor>.glb and <outDir>/lqm/model.json   (decks + units, the same shape as the topside manifest)

Floors are cut at the slabs: the flat plates of the model sit at 27.96 (deck level), 30.45 (1st floor), 34.0 (2nd), 37.6 (3rd) and about 41.2 (roof), and the
HVAC model names its levels "VENTILATION 1ST / 2ND / 3RD / ROOF FLOOR" at the same heights. A band starts just under its slab (30.40, 33.95, 37.55, 41.0), so a
slab belongs to the floor it carries. Triangles that cross a plane are CLIPPED there, so every cut is a clean flat edge (no sliver of a wall or column
left on the wrong floor, no ragged saw-tooth).

Each floor GLB has one node per discipline that has triangles on it (tag LQ-<floor>-<discipline>: the page lists it with its ROS and ETA and
colours it by delivery) and one node per tagged equipment the model names (ZCU-6810A, ZEC-8546, ...), cut out by bounding box.
Lifting & laydown and "other" stay untagged in their own colours.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from build_models import CREASE, LQM_GROUPS, read_bin, rgba, to_glb_space, weld  # noqa: E402
from glb import GlbBuilder, shaded  # noqa: E402
from leaves import load  # noqa: E402

HERE = Path(__file__).parent
M = HERE / "out" / "m"
# id, name, code, elevation of the walking surface, band (z0, z1) of everything that belongs to the deck.
# A deck is the BOX from its own floor (the walking surface on the main beams and plate) up to the floor of the next deck: whatever stands above the deck floor
# and under the next deck floor belongs to that deck, ceiling services (HVAC, E&I, lighting, telecom) and the beams / plate of the next floor included.
# Floor surfaces measured in the model: 27.95, 31.55, 35.15 and 38.75 (roof); the Roof is everything above, with the main HVAC equipment and the ducting support frame.
FLOORS = [("deck", "First Floor", "D", 27.95, -99.0, 31.35, -99.0, 31.35), ("floor1", "Second Floor", "1F", 31.55, 31.35, 34.95, 31.35, 34.95),
          ("floor2", "Third Floor", "2F", 35.15, 34.95, 38.55, 34.95, 38.55), ("roof", "Roof Floor", "RF", 38.75, 38.55, 999.0, 38.55, 999.0)]
# the box of a deck ends right under the upper (top) flange of the main beams of the next floor (flange underside 31.38 / 34.98, floor surface 31.55 / 35.15): flange and plate belong to the deck above
CEILING = ()  # no discipline is shifted: every one is cut at the same planes
LIFT = ("lifting", "Lifting rigging & sling", "LIFT", 52.0)  # slings and laydown: a level of their own, whatever their height
TAGGED = ("structural", "piping", "piping_frp", "lighting", "fg", "safety", "e_i", "telecom", "hvac", "architectural", "equipment")  # disciplines listed per floor (and "lifting", on its own level)
FRP_CLASS = re.compile(r"-[A-Z]{2}-B8[A-Z0-9]*(?:[-/(\s]|$)|\bGRE\b")  # piping class B8.. (FRP / GRE) in the line number, or a GRE fitting
TAG = re.compile(r"\b(Z[A-Z]{2}-\d{4}[A-Z]?)\b")
# tagged equipment of the model: tag -> (discipline listed under, leaf tags that carry it)
EQUIP_PADDING = 0.03


def clip_plane(tris, c, above):
    """Keeps the part of each triangle (N,3,3) above (or below) the plane z = c; triangles that cross it are cut, so the edge is straight."""
    sd = (tris[:, :, 2] - c) * (1 if above else -1)
    inside = sd >= 0
    n_in = inside.sum(axis=1)
    out = [tris[n_in == 3]]
    for n, lone in ((1, True), (2, False)):
        sel = n_in == n
        if not sel.any():
            continue
        t, sdv, ins = tris[sel], sd[sel], inside[sel]
        k = np.argmax(ins if lone else ~ins, axis=1)  # the vertex alone on its side
        idx = np.arange(len(t))
        order = np.stack([k, (k + 1) % 3, (k + 2) % 3], axis=1)
        p = t[idx[:, None], order]
        d = sdv[idx[:, None], order]
        def cut(i, j):
            w = (d[:, i] / (d[:, i] - d[:, j]))[:, None]
            return p[:, i] + w * (p[:, j] - p[:, i])
        if lone:  # one vertex inside: a smaller triangle
            out.append(np.stack([p[:, 0], cut(0, 1), cut(0, 2)], axis=1))
        else:  # one vertex outside: a quad of two triangles
            a, b, ob, oa = p[:, 1], p[:, 2], cut(0, 2), cut(0, 1)
            out.append(np.stack([a, b, ob], axis=1))
            out.append(np.stack([a, ob, oa], axis=1))
    return np.concatenate(out)


def clip_band(tris, z0, z1):
    return clip_plane(clip_plane(tris, z0, True), z1, False) if z0 > -50 else clip_plane(tris, z1, False) if z1 < 500 else tris


def split_leaves(v, f, group, pred):
    """Splits a discipline mesh in two: each triangle takes the class (pred true / false) of the smallest leaf of that discipline, by bounding box, that contains it."""
    rows = load(str(M / "lqm_leaves.tsv"))
    assign = (M / "lqm_assign.txt").read_text().splitlines()
    leaves = [(np.array(r["bb"]), bool(pred(" > ".join(r["path"].split(" > ")[3:]) + " " + r["name"]))) for r, a in zip(rows, assign) if a == group]
    leaves.sort(key=lambda x: -np.prod(x[0][3:] - x[0][:3] + 1e-3))  # large first: a small leaf overrides the box it sits in
    c = v[f].mean(axis=1)
    sel = np.zeros(len(f), dtype=bool)
    for b, yes in leaves:
        inb = np.all((c >= b[:3] - EQUIP_PADDING) & (c <= b[3:] + EQUIP_PADDING), axis=1)
        sel[inb] = yes
    return (v, f[~sel]), (v, f[sel])


def join(*meshes):
    """One mesh from several (vertices, faces) parts."""
    vs, fs, base = [], [], 0
    for v, f in meshes:
        vs.append(v)
        fs.append(f + base)
        base += len(v)
    return np.concatenate(vs), np.concatenate(fs)


def split_systems(disc):
    """Systems that cut across the disciplines of the model: FRP piping, lighting, fire & gas, safety (fire-fighting, life-saving)."""
    disc["piping"], disc["piping_frp"] = split_leaves(*disc["piping"], "piping", lambda t: bool(FRP_CLASS.search(t)))
    disc["e_i"], disc["lighting"] = split_leaves(*disc["e_i"], "e_i", lambda t: bool(re.search(r"LIGHT", t, re.I)))
    disc["telecom"], fg_tel = split_leaves(*disc["telecom"], "telecom", lambda t: bool(re.search(r"SMOKE|GAS DETECTOR|HEAT DETECTOR|DETECTOR|HORN|FLASHING|F&G|AFDS", t, re.I)))
    disc["hvac"], fg_hvac = split_leaves(*disc["hvac"], "hvac", lambda t: bool(re.search(r"Smoke Detector|Fire_Alarm|AFDS", t)))
    disc["fg"] = join(fg_tel, fg_hvac)
    disc["structural"], saf_str = split_leaves(*disc["structural"], "structural", lambda t: bool(re.search(r"SAFETY|HOSE REEL|extinguisher", t, re.I)))
    disc["architectural"], saf_arc = split_leaves(*disc["architectural"], "architectural", lambda t: bool(re.search(r"Fire Extinguisher|Life ?(buoy|jacket|ring|raft)", t, re.I)))
    disc["safety"] = join(saf_str, saf_arc)


def equipment_boxes():
    """tag -> bounding box of every leaf whose path names it (a combined unit 'ZCU-6810A/ZCU-6810B' is one geometry, tagged with the first)."""
    boxes = {}
    for r in load(str(M / "lqm_leaves.tsv")):
        text = " > ".join(r["path"].split(" > ")[3:8]) + " " + r["name"]
        tags = list(dict.fromkeys(TAG.findall(text)))
        if not tags:
            continue
        b = np.array(r["bb"])
        t = tags[0]
        lo, hi = (boxes[t][:3], boxes[t][3:]) if t in boxes else (b[:3], b[3:])
        boxes[t] = np.concatenate([np.minimum(lo, b[:3]), np.maximum(hi, b[3:])])
    return boxes


def main():
    out = Path(sys.argv[1]) / "lqm"
    out.mkdir(parents=True, exist_ok=True)
    disc = {}
    for gid, name, colour in LQM_GROUPS:
        f = M / "lqm" / f"{gid}.bin"
        if f.exists():
            disc[gid] = read_bin(f)
    split_systems(disc)
    allv = np.concatenate([v for v, _ in disc.values()])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    origin = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    boxes = equipment_boxes()
    # tagged equipment: triangles of the equipment, E&I and HVAC meshes inside the unit's box move to its own node
    units = {}  # tag -> {floor id: faces}
    cut = {g: [] for g in disc}
    for tag, b in boxes.items():
        for g in ("equipment", "e_i", "hvac"):
            v, f = disc[g]
            c = v[f].mean(axis=1)
            inb = np.all((c >= b[:3] - EQUIP_PADDING) & (c <= b[3:] + EQUIP_PADDING), axis=1)
            if g != "equipment" and not np.any(inb):
                continue
            if np.any(inb):
                units.setdefault(tag, []).append((g, f[inb]))
                cut[g].append(inb)
    def floor_of(z):
        return next(fid for fid, _, _, _, z0, z1, _, _ in FLOORS if z0 <= z < z1)
    home = {}  # tag -> the floor that holds most of its triangles
    for tag, parts in units.items():
        count = {}
        for gid, f in parts:
            for fl in np.array([floor_of(z) for z in disc[gid][0][f].mean(axis=1)[:, 2]]):
                count[fl] = count.get(fl, 0) + 1
        home[tag] = max(count, key=count.get)
    manifest = {"model": "lqm", "name": "LQM#2", "origin": origin.tolist(), "upAxis": "Y", "bounds": {"min": lo.tolist(), "max": hi.tolist()}, "groups": [], "decks": [], "units": []}
    colour = {g: c for g, _, c in LQM_GROUPS}
    label = {g: n for g, n, _ in LQM_GROUPS}
    colour.update(piping="#2f9d83", piping_frp="#9bd14b", lighting="#ffe066", fg="#f06292", safety="#d62839")
    label.update(piping="Steel piping", piping_frp="FRP piping", lighting="Lighting", fg="Fire & gas", safety="Safety (fire-fighting, life-saving)")
    for fid, fname, code, elev, z0, z1, h0, h1 in FLOORS + [(LIFT[0], LIFT[1], LIFT[2], LIFT[3], 0, 0, 0, 0)]:
        lift = fid == "lifting"
        g = GlbBuilder(draco=True)
        children, tris, n_equip = [], 0, 0

        def node(name, v, f, hexcolour, mat_name):
            nonlocal tris
            used = np.unique(f)
            remap = np.full(len(v), -1, dtype=np.int64)
            remap[used] = np.arange(len(used))
            P, N, F = shaded(to_glb_space(v[used], origin), remap[f], CREASE)
            tris += len(F)
            mesh = g.mesh(P, N, F, g.material(rgba(hexcolour), mat_name, metallic=0.2, rough=0.7))
            children.append(g.node(name, mesh))
        for gid, (v, f) in disc.items():
            if lift != (gid == "lifting"):
                continue
            keep = np.ones(len(f), dtype=bool)
            for m in cut[gid]:
                keep &= ~m
            f = f[keep]
            bt = v[f] if lift else clip_band(v[f], h0, h1) if gid in CEILING else clip_band(v[f], z0, z1)
            if len(bt):
                v2, f2 = weld(bt)
                tag = f"LQ-{code}-{gid}" if gid in TAGGED or lift else gid
                node(tag, v2, f2, colour[gid], label[gid])
                if gid in TAGGED or lift:
                    manifest["units"].append({"tag": tag, "deck": fid, "system": gid, "name": label[gid], "triangles": int(len(f2))})
        for tag, parts in units.items():
            if home[tag] != fid:
                continue
            vs, fs, base = [], [], 0
            for gid, f in parts:  # the whole unit goes to its home floor, so a tag names one node in the model
                v = disc[gid][0]
                vs.append(v)  # each discipline mesh has its own vertices: stack them and shift the faces
                fs.append(f + base)
                base += len(v)
            allf = np.concatenate(fs)
            v = np.concatenate(vs)
            node(tag, v, allf, "#e8943a", tag)
            n_equip += 1
            manifest["units"].append({"tag": tag, "deck": fid, "system": "equipment", "name": None, "triangles": int(len(allf))})
        if not children:
            continue
        root = g.node(fid, children=children)
        path = out / f"{fid}.glb"
        g.write(path, [root])
        manifest["decks"].append({"id": fid, "name": fname, "elevation": elev, "file": f"{fid}.glb", "bytes": path.stat().st_size, "triangles": tris, "equipment": len(children)})
        print(f"{fid:8} {path.stat().st_size / 1e6:6.2f} MB  {tris:>9,} triangles  {len(children)} nodes ({n_equip} tagged equipment)")
    (out / "model.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
