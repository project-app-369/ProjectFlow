"""Builds the Jacket fabrication sequence for Construction -> Construction sequence, broken down into the components that move.

    python build_sequence.py <publicDir>          e.g. ... ../../../app/apps/web/public

Reads the 22 steps transcribed from drawing 2021-4589-65-4015 ("Construction sequence/jacket-fabrication-steps.json") and the Jacket
model's geometry (out/m/jacket.raw + the groups of classify_models.py), splits the model into components (a row frame, a level of
horizontal framing, a set of diagonals, the flooding lines of a row, a buoyancy tank, ...), decides in which step each one is built and
how it arrives, and writes <publicDir>/sequence/jacket/<component>.glb and sequence.json (the steps with their ordered actions).

The model carries no construction-sequence data, so the component of a part is inferred from where it stands. The jacket is built as four
vertical frames ("rows") along Y: Row 2 (y 96), Row 2.1 (108), Row 5.1 (128) and Row 5 (140), with horizontal framing between them at
EL -54.39 / -35 / -14 and the conductor frames beyond Row 5. A member in a row's plane belongs to that row; a member that spans a bay
between two rows belongs to the framing or diagonal that the drawing installs in that bay. Piles and conductors are installed offshore.

The whole jacket is built lying on its side (its height horizontal, along the skid ways), standing on Leg C. A row is fabricated lying
face down on the launch cradle ("fab") and rolled up about Leg C until its plane stands vertical ("rollup"); what the drawing installs on a
lying row (framing Part 3 and 4, flooding lines, J-tubes) rides with it ("follow"); everything else is lifted into place ("lift").
The page can turn the finished jacket upright (its installed position).
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import classify_models as cm  # noqa: E402
from build_models import rgba, to_glb_space, weld  # noqa: E402
from glb import GlbBuilder, shaded  # noqa: E402
from leaves import load  # noqa: E402
from rawio import leaf_tris, read_raw  # noqa: E402

HERE = Path(__file__).parent
M = HERE / "out" / "m"
STEPS = HERE.parent / "Construction sequence" / "jacket-fabrication-steps.json"
CREASE = 40.0

ROWS = {"2": 96.0, "2.1": 108.0, "5.1": 128.0, "5": 140.0}  # plan position (Y) of the four frames
ROW_FAB = {"5.1": 2, "2.1": 2, "5": 8, "2": 9}  # the step that fabricates each frame, lying on the ground
ROW_ROLL = {"5.1": 4, "2.1": 6, "5": 11, "2": 12}  # the step that rolls it up
ROW_DIR = {"5.1": 1, "5": 1, "2.1": -1, "2": -1}  # which way it lies: +1 towards +Y (north), -1 towards -Y
LEVELS = {"n54": (-54.39, "EL -54.39"), "n35": (-35.0, "EL -35.00"), "n14": (-14.0, "EL -14.00"), "p5": (5.0, "EL +5.00")}
XC = -148.0  # the leg row a frame stands on while it is rolled up (the launch cradle of the model is under it); a lying frame is turned about it
JZ0, JZ1 = -57.0, 10.0  # the jacket's extent in height, without the piles
FRAMING_PART = {"inner": 1, "south": 4, "north": 3}
FRAMING_STEP = {1: 5, 3: 9, 4: 10}
FRAMING_FOLLOW = {3: "row-5", 4: "row-2"}
DIAG_STEP = {("inner", "C"): 6, ("inner", "B"): 7, ("inner", "A"): 7, ("north", "C"): 11, ("north", "B"): 12, ("north", "A"): 13,
             ("south", "C"): 12, ("south", "B"): 13, ("south", "A"): 13}
BAY_NAME = {"inner": "Row 5.1 to 2.1", "north": "Row 5 to 5.1", "south": "Row 2 to 2.1"}
# buoyancy tanks, in the order of classify_models.TANKS: name, step
TANKS = [("C5", 20), ("A2", 17), ("A5", 19), ("C2", 14), ("T5", 20), ("T2", 16), ("F0-1", 19), ("F0-2", 19), ("F0-3", 19)]
OFFSHORE = "offshore"
COLOURS = {"ground": "#d5d9e0", "skid": "#8e949e", "steel": "#4f5b6b", "timber": "#b07a4a"}
# Rows 5.1 and 2.1 are the two small launch trusses inside the jacket. They are fabricated lying beside the skid ways, rolled up there, then moved
# onto their launch cradle (timber down on the steel cradle, the cradle on the skid way). Rows 5 and 2 are built lying at their own place.
FAB_OFFSET = {"5.1": 37.0, "2.1": -37.0}  # how far (along Y) the lying frame is from its final position
CRADLE_STEP = 3
TANK_CLEARANCE = 2.5  # m, from the lowest buoyancy tank to the ground the jacket lies over


def level(z):
    return min(LEVELS, key=lambda k: abs(LEVELS[k][0] - z))


def frame_component(c, dim):
    """The row, framing or diagonal a structural part (or an anode) belongs to."""
    x, y, z = c
    if y > 143:
        return f"cf-{level(z)}"  # beyond Row 5: the conductor frames and what hangs on them
    row = min(ROWS, key=lambda r: abs(ROWS[r] - y))
    if dim[1] < 3.5 and abs(ROWS[row] - y) < 3.5:
        return f"row-{row}"
    if y < ROWS["2"] - 3.5:
        return "row-2"
    bay = "south" if y < ROWS["2.1"] else "inner" if y < ROWS["5.1"] else "north"
    if dim[2] < 2.5:
        return f"fr{FRAMING_PART[bay]}-{level(z)}"
    return f"dg-{bay}-" + ("C" if x > -124 else "B" if x > -140 else "A")


def assign():
    rows = load(str(M / "jacket_leaves.tsv"))
    group = np.array(open(M / "jacket_assign.txt").read().split("\n"))
    bb = np.array([r["bb"] for r in rows])
    dim = bb[:, 3:] - bb[:, :3]
    c = (bb[:, :3] + bb[:, 3:]) / 2
    ph = np.array([cm.phase(r["path"]) for r in rows])
    comp = np.empty(len(rows), dtype=object)
    for i in range(len(rows)):
        g, y = group[i], c[i, 1]
        north, far = y >= 118.0, y >= ROWS["5.1"]
        comp[i] = ("removed" if g == "removed" else f"row-{g[4:].replace('_', '.')}" if g.startswith("row_") else
                   "cradle-5.1" if g == "launch_cradle" and north else "cradle-2.1" if g == "launch_cradle" else
                   f"walk-{'5' if north else '2'}" if g in ("grating_support", "grating") else f"mud-{'north' if north else 'south'}" if g == "mudmat" else
                   f"cf-{level(c[i, 2])}" if g == "conductor_guide" else "conductor-guard" if g == "conductor_guard" else
                   "caisson-guard" if g == "caisson_guard" else "caissons" if g == "seawater_caisson" else "open-drain" if g == "open_drain" else
                   "overboard" if g == "overboard" else OFFSHORE if g in ("piles", "conductors") else f"fenders-{'5' if north else '2'}" if g == "fenders" else
                   "riser" if g == "riser" else f"jtubes-{'5' if far else '2'}" if g == "jtubes" else f"flood-{'5' if far else '2'}" if g == "flooding" else
                   "bridge-support" if g == "bridge_support" else "tower" if g == "bridge_tower" else "valve-panel" if g == "valve_panel" else
                   "ti-platform" if g == "ti_platform" else "tank" if g == "buoyancy_tanks" else frame_component(c[i], dim[i]))
    # An anode (and its support) is welded to a member: it is installed with the component of the nearest member, never before it (no anode floats).
    host = np.array([g not in ("anodes", "removed", "piles", "conductors") for g in group])
    hi = np.where(host)[0]
    for i in np.where(group == "anodes")[0]:
        d = np.linalg.norm(np.maximum(0, np.maximum(bb[hi, :3] - bb[i, 3:], bb[i, :3] - bb[hi, 3:])), axis=1)
        comp[i] = comp[hi[int(d.argmin())]]
    idx = np.where(comp == "tank")[0]  # each part of the "Buoyancy tanks" set goes with the nearest of the nine tanks
    dist = np.full((len(cm.TANKS), len(idx)), np.inf)
    for k, (axis, ca, cb, lo, hi, r) in enumerate(cm.TANKS):
        i, j = {2: (0, 1), 0: (1, 2), 1: (0, 2)}[axis]
        radial = np.hypot(c[idx, i] - ca, c[idx, j] - cb)
        beyond = np.maximum(0, np.maximum(lo - c[idx, axis], c[idx, axis] - hi))
        dist[k] = np.hypot(np.maximum(0, radial - r), beyond)
    for n, i in enumerate(idx):
        comp[i] = f"tank-{TANKS[int(dist[:, n].argmin())][0]}"
    return rows, group, comp


def meta(cid):
    """name, step, kind ('fab' | 'lift' | 'upend' | 'static'), follow of a component."""
    if cid.startswith("cradle-"):
        return f"Steel launch cradle with timber · Row {cid[7:]}", CRADLE_STEP, "lift", None
    if cid.startswith("walk-"):
        return f"Grating support and grating · Row {cid[5:]}", ROW_ROLL[cid[5:]], "lift", None  # after the row is rolled up (the roll-up is the first action of its step)
    if cid.startswith("fenders-"):
        return f"Surge fender supports · Row {cid[8:]}", 9 if cid == "fenders-5" else 10, "lift", f"row-{cid[8:]}"
    named = {"riser": ("Riser lines and clamps · Row 5", 10, "row-5"), "conductor-guard": ("Conductor guard", 17, None), "caisson-guard": ("Caisson guard", 15, None),
             "open-drain": ("Open drain caisson", 18, None), "overboard": ("Overboard frame and pipe", 15, None), "valve-panel": ("Valve panel", 20, None),
             "ti-platform": ("Working platform (T&I platform 2)", 21, None)}
    if cid in named:
        return named[cid][0], named[cid][1], "lift", named[cid][2]
    if cid == OFFSHORE:
        return "Piles & conductors (offshore)", None, "static", None
    p = cid.split("-")
    if p[0] == "row":
        return f"Row {p[1]} frame", ROW_FAB[p[1]], "fab", None
    if p[0][:2] == "fr":
        part = int(p[0][2:])
        return f"Horizontal framing Part {part} · {LEVELS[p[1]][1]}", FRAMING_STEP[part], "lift", FRAMING_FOLLOW.get(part)
    if p[0] == "dg":
        return f"Diagonal braces Row {p[2]} · {BAY_NAME[p[1]]}", DIAG_STEP[(p[1], p[2])], "lift", None
    if p[0] == "cf":
        return f"Conductor frame · {LEVELS[p[1]][1]}", 14, "lift", None
    if p[0] == "mud":
        return f"Mudmat · {'Row 5 to 5.1' if p[1] == 'north' else 'Row 2 to 2.1'}", 9 if p[1] == "north" else 10, "lift", "row-5" if p[1] == "north" else "row-2"
    if p[0] == "flood":
        return f"Flooding lines · Row {p[1]}", ROW_ROLL[p[1]], "lift", None  # after the row is rolled up
    if p[0] == "jtubes":
        return f"J-tubes · Row {p[1]}", 10 if p[1] == "5" else 11, "lift", f"row-{p[1]}"
    if cid == "caissons":
        return "Seawater lift pump caissons", 14, "lift", None
    if cid == "bridge-support":
        return "Bridge landing support", 19, "lift", None
    if cid == "tower":
        return "Bridge landing tower", 21, "lift", None
    if p[0] == "tank":
        name = "-".join(p[1:])
        k = [t[0] for t in TANKS].index(name)
        return f"Buoyancy tank {name}", TANKS[k][1], "lift", None
    raise KeyError(cid)


def box(lo, hi):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    v = np.array([[x, y, z] for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)], dtype=float)
    f = np.array([[0, 2, 3], [0, 3, 1], [4, 5, 7], [4, 7, 6], [0, 1, 5], [0, 5, 4], [2, 6, 7], [2, 7, 3], [0, 4, 6], [0, 6, 2], [1, 3, 7], [1, 7, 5]])
    return v, f


def main():
    public = Path(sys.argv[1])
    out = public / "sequence" / "jacket"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    rows, group, comp = assign()
    buf, off, cnt = read_raw(M / "jacket.raw")
    assert len(cnt) == len(rows)
    colour = {gid: col for gid, _, col in cm.JACKET_GROUPS} | COLOURS
    parts = {}  # (component, group) -> (vertices, faces)
    counts = {}
    for cid in sorted(set(comp) - {"removed"}):
        for gid in sorted(set(group[comp == cid])):
            idx = [i for i in range(len(rows)) if comp[i] == cid and group[i] == gid and cnt[i]]
            counts.setdefault(cid, {})[gid] = int(np.sum((comp == cid) & (group == gid)))
            if idx:
                parts[(cid, gid)] = weld(np.concatenate([leaf_tris(buf, off, cnt, i) for i in idx]))
    allv = np.concatenate([v for v, _ in parts.values()])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    origin = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])  # the same origin as the model of Facility layout
    glb = lambda x, y, z: [x - origin[0], z - origin[2], -(y - origin[1])]  # noqa: E731  Z-up -> Y-up

    # The jacket is built lying on its side, a frame resting on Leg C. The ground is the plane below Leg C (the page turns the ground with the jacket);
    # only two launch cradles stand on it, under the two small launch trusses Row 5.1 and 2.1: skid way (concrete), steel cradle, timber on top.
    bbs = np.array([r["bb"] for r in rows])
    cr = bbs[group == "launch_cradle"]
    cx0 = float(cr[:, 0].min())  # underside of the model's launch cradle (the jacket's -X side)
    live = (comp != "removed") & (comp != OFFSHORE)
    GX = float(bbs[live, 0].min()) - TANK_CLEARANCE  # the ground: the lowest part (a buoyancy tank) is TANK_CLEARANCE above it, so the skid ways under the cradles are as tall as that
    zr = bbs[[g.startswith("row_") for g in group]]
    z0, z1 = float(zr[:, 2].min()) - 1.5, float(zr[:, 5].max()) + 1.5
    parts[("ground", "ground")] = box((GX - 0.6, origin[1] - 95, JZ0 - 16), (GX, origin[1] + 95, JZ1 + 16))
    sv, sf = [], []

    def beam(y0, y1):
        v, f = box((GX, y0, z0), (cx0, y1, z1))
        sf.append(f + sum(len(a) for a in sv)); sv.append(v)
    for r in ("5.1", "2.1"):  # under the launch cradles, where the jacket rests
        beam(ROWS[r] - 2.6, ROWS[r] + 2.6)
    for r in ROWS:  # a frame is fabricated lying face down at its place (Row 5.1 and 2.1 beside it) and rolled up there: sleepers under it, clear of the tanks that hang below Row 5 and Row 2
        base = ROWS[r] + FAB_OFFSET.get(r, 0.0)
        if r in FAB_OFFSET:
            beam(base - 2.6, base + 2.6)  # where it stands after its roll-up
        for k in range(5 if r not in FAB_OFFSET else 6):
            y = base + ROW_DIR[r] * ((k * 6.0) if r in FAB_OFFSET else (9.0 + k * 6.0))
            beam(y - 1.0, y + 1.0)
    parts[("skid", "skid")] = (np.concatenate(sv), np.concatenate(sf))

    decks, order = [], []
    for cid in sorted({c for c, _ in parts}):
        g = GlbBuilder(draco=True)
        nodes, tris = [], 0
        for (d, gid), (v, f) in parts.items():
            if d != cid:
                continue
            used = np.unique(f)
            remap = np.full(len(v), -1, dtype=np.int64)
            remap[used] = np.arange(len(used))
            P, N, F = shaded(to_glb_space(v[used], origin), remap[f], CREASE)
            nodes.append(g.node(gid, g.mesh(P, N, F, g.material(rgba(colour[gid]), gid, metallic=0.2, rough=0.7))))
            tris += int(len(F))
        path = out / f"{cid}.glb"
        g.write(path, [g.node("root", children=nodes)])
        if cid in ("ground", "skid"):
            d = {"id": cid, "name": "Ground" if cid == "ground" else "Skid ways and sleepers", "step": 1, "kind": "static" if cid == "ground" else "fab", "follow": None}
        else:
            name, step, kind, follow = meta(cid)
            d = {"id": cid, "name": name, "step": step, "kind": kind, "follow": follow}
        d |= {"file": path.name, "bytes": path.stat().st_size, "triangles": tris, "parts": counts.get(cid, {})}
        if cid.startswith("row-"):
            r = cid[4:]
            d["pivot"] = {"p": glb(XC, ROWS[r], origin[2]), "dir": ROW_DIR[r]}
            d["rollStep"] = ROW_ROLL[r]
            if r in FAB_OFFSET:
                d["fabOffset"] = FAB_OFFSET[r]
        decks.append(d)
        print(f"{cid:14} {path.stat().st_size / 1e6:6.2f} MB {tris:>9,} triangles step {d['step']} {d['kind']}")

    src = json.loads(STEPS.read_text(encoding="utf8"))
    kind_order = {"fab": 0, "upend": 1, "lift": 2, "static": 3}
    steps = []
    for s in src["steps"]:
        no = s["no"]
        acts = []
        for d in decks:  # a row is rolled up first, then what the step installs
            if d.get("rollStep") == no:
                acts.append({"deck": d["id"], "kind": "rollup", "label": f"Roll up {d['name']} to the vertical position"})
                if "fabOffset" in d:
                    acts.append({"deck": d["id"], "kind": "move", "label": f"Lift and move {d['name']} onto its launch cradle"})
        for d in sorted((d for d in decks if d["step"] == no and d["kind"] != "static"), key=lambda d: (kind_order[d["kind"]], d["id"])):
            verb = {"fab": "Fabricate lying on the launch cradle", "lift": "Lift in"}[d["kind"]]
            acts.append({"deck": d["id"], "kind": d["kind"], "label": f"Lay the skid ways and sleepers, tall enough for the buoyancy tanks to clear the ground by {TANK_CLEARANCE:g} m" if d["id"] == "skid" else f"{verb} {d['name']}"})
        steps.append({**s, "actions": acts})
    manifest = {"model": "jacket", "name": "ST-CGF Jacket", "origin": origin.tolist(), "upAxis": "Y", "source": src["source"],
                "groups": [{"id": gid, "name": name, "color": col} for gid, name, col in cm.JACKET_GROUPS],
                "decks": decks, "steps": steps}
    (out / "sequence.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
