"""Builds the web files of the ST-CGF Topside from what ModelTool `groups` welded in Navisworks (see classify_topside.py):

  * Construction sequence:   <public>/sequence/topside/<deck>.glb + sequence.json   (one GLB per fabricate/install pair, parts coloured by system)
  * Facility layout:         <public>/models/topside2/<deck>.glb + model.json        (one GLB per deck; nodes TS-<deck>-<system> and one node per equipment tag)

    python build_topside.py <publicDir>        e.g. ... ../../../app/apps/web/public

Reads out/top/units.json (unit -> deck, system, label, fab and install stage) and out/top/g4a|g4b/<unit>.bin.
Every file is Draco compressed (the page decodes it before the viewer sees it); the sequence files carry nothing that the stage does not show.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from build_models import CREASE, read_bin, rgba, to_glb_space  # noqa: E402
from glb import GlbBuilder, shaded  # noqa: E402

HERE = Path(__file__).parent
TOP = HERE / "out" / "top"
STEPS = HERE.parent / "Construction sequence" / "Topside Fab Sequence" / "topside-fabrication-steps.json"
WELD = 0.02
COLOUR = {"structural": "#8fa3c4", "equipment": "#e8943a", "piping": "#2f9d83", "e_i": "#e5a93a", "telecom": "#d4543b", "hvac": "#3b82f6", "safety": "#c4478a"}
SYSTEM_NAME = {"structural": "Structural", "equipment": "Equipment", "piping": "Piping and supports", "e_i": "Electrical & instrument", "telecom": "Telecom", "hvac": "HVAC", "safety": "Safety"}
DECKS = [("dsf", "DSF", 10.0), ("sd", "Sub-Cellar Deck", 13.5), ("cd", "Cellar Deck", 18.0), ("id", "Intermediate Deck", 26.0), ("md", "Main Deck", 34.0)]  # names as in the equipment list
GROUND = -10.6  # the underside of the skidway: the yard where the decks are fabricated lies at this level


def merge(parts):
    """[(v, f)] -> one (v, f)."""
    vs, fs, n = [], [], 0
    for v, f in parts:
        vs.append(v)
        fs.append(f + n)
        n += len(v)
    return np.concatenate(vs), np.concatenate(fs)


def load_units():
    units = json.loads((TOP / "units.json").read_text())
    for u in units:
        path = next((p for p in (TOP / "g4a" / f"{u['id']}.bin", TOP / "g4b" / f"{u['id']}.bin") if p.exists()), None)  # steel and equipment on a 3 cm grid, the systems on 7 cm
        u["mesh"] = read_bin(path) if path else None
        u["tris"] = 0 if u["mesh"] is None else len(u["mesh"][1])
    return [u for u in units if u["mesh"] is not None and u["tris"]]


def write_glb(path, nodes_spec, origin):
    """nodes_spec: [(node name, system, (v, f))]. One mesh per node, in the colour of the system."""
    g = GlbBuilder(draco=True)
    nodes, tris = [], 0
    for name, system, (v, f) in nodes_spec:
        used = np.unique(f)
        remap = np.full(len(v), -1, dtype=np.int64)
        remap[used] = np.arange(len(used))
        P, N, F = shaded(to_glb_space(v[used], origin), remap[f], CREASE)
        nodes.append(g.node(name, g.mesh(P, N, F, g.material(rgba(COLOUR[system]), system, metallic=0.2, rough=0.7))))
        tris += int(len(F))
    g.write(path, [g.node("root", children=nodes)])
    return tris


STEPS_DIR = HERE.parent / "Construction sequence"
SUB = {
    "dsf": ("DSF", STEPS_DIR / "DSF Fab Sequence" / "dsf-fabrication-steps.json"),
    "ehouse": ("E-House", STEPS_DIR / "Topside Fab Sequence" / "ehouse-fabrication-steps.json"),
}


def build_sub_sequences(public, origin):
    """The DSF and E-House sequences: every stage adds its parts where they stand (nothing is lifted in from a yard here)."""
    units = json.loads((TOP / "units_sub.json").read_text())
    for u in units:
        path = TOP / "g3c" / f"{u['id']}.bin"
        u["mesh"] = read_bin(path) if path.exists() else None
    units = [u for u in units if u["mesh"] is not None and len(u["mesh"][1])]
    for sid, (name, steps_file) in SUB.items():
        out = public / "sequence" / sid
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob("*.glb"):
            old.unlink()
        src = json.loads(steps_file.read_text(encoding="utf8"))
        mine = [u for u in units if u["seq"] == sid]
        decks = []
        for stage in sorted({u["stage"] for u in mine}):
            us = [u for u in mine if u["stage"] == stage]
            by_sys = defaultdict(list)
            for u in us:
                by_sys[u["system"]].append(u["mesh"])
            spec = [(f"{sid}-{stage}-{s}", s, merge(by_sys[s])) for s in sorted(by_sys, key=lambda s: (s == "equipment", s))]
            path = out / f"stage{stage}.glb"
            tris = write_glb(path, spec, origin)
            labels = sorted({u["label"] for u in us})
            decks.append({"id": f"stage{stage}", "name": ", ".join(labels[:3]) + ("…" if len(labels) > 3 else ""), "step": stage, "kind": "lift" if all(u["system"] == "equipment" for u in us) else "fab", "follow": None,
                          "file": path.name, "bytes": path.stat().st_size, "triangles": tris, "parts": {s: int(sum(len(m[1]) for m in ms)) for s, ms in by_sys.items()}, "labels": labels})
            print(f"{sid:7} stage {stage:2} {path.stat().st_size / 1e6:6.2f} MB {tris:>9,} triangles")
        steps = []
        for s in src["stages"]:
            acts = [{"deck": d["id"], "kind": d["kind"], "label": f"{'Lift in' if d['kind'] == 'lift' else 'Fabricate and fit'}: {', '.join(d['labels'][:4])}{'…' if len(d['labels']) > 4 else ''}"} for d in decks if d["step"] == s["no"]]
            steps.append({"no": s["no"], "sheet": s["sheet"], "title": s["title"], "items": s["items"], "actions": acts})
        manifest = {"model": sid, "name": name, "origin": origin.tolist(), "upAxis": "Y", "source": src["source"], "upright": True,
                    "groups": [{"id": k, "name": SYSTEM_NAME[k], "color": COLOUR[k]} for k in COLOUR], "decks": decks, "steps": steps}
        (out / "sequence.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


def main():
    public = Path(sys.argv[1])
    units = load_units()
    allv = np.concatenate([u["mesh"][0] for u in units])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    origin = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    print(len(units), "units,", sum(u["tris"] for u in units), "triangles; model box", lo.round(1), hi.round(1))
    build_sequence(public, units, origin, lo, hi)
    if (TOP / "g3c").exists():
        build_sub_sequences(public, origin)
    build_facility(public, units, origin, lo, hi)


def build_sequence(public, units, origin, lo, hi):
    out = public / "sequence" / "topside"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    src = json.loads(STEPS.read_text(encoding="utf8"))
    no_of = {s["id"]: s["no"] for s in src["stages"]}
    # one deck (GLB) per (fabricate stage, install stage); the parts of every system in it, equipment last
    groups = defaultdict(list)
    for u in units:
        groups[(u["fab"], u["install"])].append(u)
    decks, slot = [], 0
    yard_x = float(hi[0] - origin[0]) + 22.0  # the yard lies east of the topside
    for (fab, inst), us in sorted(groups.items(), key=lambda kv: (no_of[kv[0][0]], no_of[kv[0][1]])):
        by_sys = defaultdict(list)
        for u in us:
            by_sys[u["system"]].append(u["mesh"])
        spec = [(f"{fab}-{inst}-{s}", s, merge(by_sys[s])) for s in sorted(by_sys, key=lambda s: (s == "equipment", s))]
        did = f"s{fab}" if fab == inst else f"s{fab}-to-{inst}"
        path = out / f"{did}.glb"
        tris = write_glb(path, spec, origin)
        deck = {"id": did, "name": us[0]["label"] if len({u["label"] for u in us}) == 1 else f"Stage {fab}: {len(us)} groups", "step": no_of[fab], "kind": "lift" if all(u["system"] == "equipment" for u in us) else "fab",
                "follow": None, "file": path.name, "bytes": path.stat().st_size, "triangles": tris,
                "parts": {s: int(sum(len(m[1]) for m in ms)) for s, ms in by_sys.items()}, "labels": sorted({u["label"] for u in us})}
        if fab != inst:
            v = np.concatenate([u["mesh"][0] for u in us])
            vmin, vmax = v.min(axis=0), v.max(axis=0)
            w, d = float(vmax[0] - vmin[0]), float(vmax[1] - vmin[1])
            col, row = slot % 2, slot // 2
            slot += 1
            # GLB space: x = x - ox, y (up) = z - oz, z = -(y - oy). Fabricated in the yard east of the topside, on the ground, side by side along z
            tx = (yard_x + col * (w + 14.0)) - float(vmin[0] - origin[0])
            tz = row * (d + 14.0) + float(vmax[1] - origin[1])
            ty = GROUND - float(vmin[2])
            deck["fabShift"] = [round(tx, 2), round(ty, 2), round(tz, 2)]
            deck["moveStep"] = no_of[inst]
        decks.append(deck)
        print(f"{did:12} {path.stat().st_size / 1e6:6.2f} MB {tris:>9,} triangles  step {deck['step']}" + (f" -> {deck['moveStep']}" if "moveStep" in deck else ""))
    steps = []
    for s in src["stages"]:
        acts = []
        for d in decks:
            if d["step"] == s["no"]:
                verb = "Lift in" if d["kind"] == "lift" else "Fabricate" if "fabShift" in d else "Install"
                acts.append({"deck": d["id"], "kind": d["kind"] if "fabShift" not in d else "fab", "label": f"{verb}: {', '.join(d['labels'][:3])}{'…' if len(d['labels']) > 3 else ''}"})
            if d.get("moveStep") == s["no"]:
                acts.append({"deck": d["id"], "kind": "move", "label": f"Lift and move into place: {', '.join(d['labels'][:3])}"})
        steps.append({"no": s["no"], "id": s["id"], "sheet": s["sheet"], "title": s["title"], "items": s["items"], "date": s.get("date"), "from": s.get("from"), "equipment": s.get("equipment"), "actions": acts})
    manifest = {"model": "topside", "name": "ST-CGF Topside", "origin": origin.tolist(), "upAxis": "Y", "source": src["source"], "upright": True,
                "groups": [{"id": k, "name": SYSTEM_NAME[k], "color": COLOUR[k]} for k in COLOUR], "decks": decks, "steps": steps}
    (out / "sequence.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


def build_facility(public, units, origin, lo, hi):
    out = public / "models" / "topside2"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    by = defaultdict(lambda: defaultdict(list))  # deck -> node key -> meshes
    kind = {}
    for u in units:
        if u["system"] == "equipment" and not u["label"].startswith("Equipment") and not u["label"] in ("Mercury removal unit", "Pedestal crane adaptor", "Pedestal crane A-frame", "Vendor equipment on main deck"):
            key = ("tag", u["label"])
        else:
            key = ("system", u["system"])
        by[u["deck"]][key].append(u["mesh"])
        kind[(u["deck"], key)] = u
    decks, manifest_units = [], []
    for did, name, elev in DECKS:
        if did not in by:
            continue
        spec = []
        for (typ, k), ms in sorted(by[did].items(), key=lambda kv: (kv[0][0] != "system", kv[0][1])):
            system = "equipment" if typ == "tag" else k
            tag = k if typ == "tag" else f"TS-{did}-{k}"
            spec.append((tag, system, merge(ms)))
        path = out / f"{did}.glb"
        tris = write_glb(path, spec, origin)
        decks.append({"id": did, "name": name, "elevation": elev, "file": path.name, "bytes": path.stat().st_size, "triangles": tris, "equipment": sum(1 for t, _, _ in spec if not t.startswith("TS-"))})
        for tag, system, m in spec:
            manifest_units.append({"tag": tag, "deck": did, "system": system, "name": SYSTEM_NAME[system] if tag.startswith("TS-") else tag, "triangles": int(len(m[1]))})
        print(f"{did:6} {path.stat().st_size / 1e6:6.2f} MB {tris:>9,} triangles, {decks[-1]['equipment']} equipment nodes")
    manifest = {"model": "topside2", "name": "ST-CGF Topside", "origin": origin.tolist(), "upAxis": "Y",
                "bounds": {"min": (lo - origin).tolist(), "max": (hi - origin).tolist()}, "groups": [], "decks": decks, "units": manifest_units}
    (out / "model.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
