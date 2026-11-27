"""Builds the Facility Layout files of the ST-CGF Topside from what ModelTool `groups` welded (see classify_tds.py):

    python build_tds.py <publicDir>        e.g. ... ../../../app/apps/web/public

Writes <public>/models/topside2/<deck>.glb (part 1, the overview: one per deck box dsf, sd, cd, id, md; steel, access, pipe rack and the large equipment),
<public>/models/topside2/sys-<deck>-<discipline>.glb (part 2, one per deck and system discipline: piping, electrical, instrument...; the page loads
the ones of a discipline when the user picks it) and model.json.

Nodes of a deck's GLB:
  * one node per listed equipment, named by its tag (MBD-2501), which the equipment list colours by delivery;
  * one node per (Level 2 entry, deck), named TS-<deck>-<discipline>-<n>: <n> numbers the entries of model.json `levels`
    (a pipe line, a group of junction boxes, a kind of structural member...), so the page highlights a whole discipline (Level 1),
    or one entry of it (Level 2), in every deck at once.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from build_models import CREASE, read_bin, rgba, to_glb_space  # noqa: E402
from classify_tds import DECKS, DISC_IDS, DISCIPLINES, SYSTEM_RUN  # noqa: E402
from glb import GlbBuilder, shaded  # noqa: E402

HERE = Path(__file__).parent
TDS = HERE / "out" / "tds"
COLOUR = {d[0]: d[2] for d in DISCIPLINES}
LABEL = {d[0]: d[1] for d in DISCIPLINES}


def merge(parts):
    vs, fs, n = [], [], 0
    for v, f in parts:
        vs.append(v)
        fs.append(f + n)
        n += len(v)
    return np.concatenate(vs), np.concatenate(fs)


def load_units():
    units = json.loads((TDS / "units.json").read_text())
    for u in units:
        if u["item"] and (re.match(r"(SUB)?EQUIPMENT \d+ of", u["item"]) or u["item"].lower().endswith("_footprint")):
            u["item"] = None  # a name made of the model tree's own words says nothing
        folder = "gb3" if u["p2"] else "ga4"
        path = TDS / folder / f"{u['id']}.bin"
        u["mesh"] = read_bin(path) if path.exists() else None
        u["tris"] = 0 if u["mesh"] is None else len(u["mesh"][1])
    return [u for u in units if u["mesh"] is not None and u["tris"]]


def write_glb(path, spec, origin):
    """spec: [(node name, discipline, (v, f))]. One mesh per node, in the colour of its discipline."""
    g = GlbBuilder(draco=True)
    nodes, tris = [], 0
    for name, disc, (v, f) in spec:
        used = np.unique(f)
        remap = np.full(len(v), -1, dtype=np.int64)
        remap[used] = np.arange(len(used))
        P, N, F = shaded(to_glb_space(v[used], origin), remap[f], CREASE)
        nodes.append(g.node(name, g.mesh(P, N, F, g.material(rgba(COLOUR[disc]), disc, metallic=0.2, rough=0.7))))
        tris += int(len(F))
    g.write(path, [g.node("root", children=nodes)])
    return tris


def main():
    public = Path(sys.argv[1])
    units = load_units()
    allv = np.concatenate([u["mesh"][0] for u in units])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    origin = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    print(len(units), "units,", sum(u["tris"] for u in units), "triangles; model box", lo.round(1), hi.round(1))

    # Level 2 entries: one per (discipline, group, item), numbered in the order of the discipline chips, then by name
    order = {d[0]: i for i, d in enumerate(DISCIPLINES)}
    entries = sorted({(u["disc"], u["group"], u["item"] or "") for u in units if not u["tag"]}, key=lambda e: (order[e[0]], e[1].lower(), e[2].lower()))
    number = {e: i + 1 for i, e in enumerate(entries)}
    levels = [{"n": number[e], "disc": e[0], "group": e[1], "item": e[2] or None, "triangles": 0, "decks": []} for e in entries]

    out = public / "models" / "topside2"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.glb"):
        old.unlink()
    for old in out.glob("sys-*.glb"):
        old.unlink()
    by = defaultdict(lambda: defaultdict(list))  # deck -> (node name, discipline) -> meshes
    for u in units:
        if u["tag"]:
            key = (u["tag"], "mechanical", False, "")
        else:
            key = (f"TS-{u['deck']}-{u['disc']}-{number[(u['disc'], u['group'], u['item'] or '')]}{'-v' if u.get('v') else ''}", u["disc"], bool(u["p2"]), "valves" if u["group"] == "Instrument valves" else u["disc"])
        by[u["deck"]][key].append(u["mesh"])
    decks, manifest_units, systems = [], [], []
    floor = 0.0
    for i, (did, name, elev, top) in enumerate(DECKS):
        if did not in by:
            continue
        allspec = [(k[0], k[1], merge(ms), k[2], k[3]) for k, ms in sorted(by[did].items(), key=lambda kv: (kv[0][0].startswith("TS-") is False, kv[0][0]))]
        spec = [x[:3] for x in allspec if not x[3]]
        for disc in DISC_IDS + ["valves"]:
            part = [x[:3] for x in allspec if x[4] == disc and x[3]]
            if part:
                sp = out / f"sys-{did}-{disc}.glb"
                st = write_glb(sp, part, origin)
                systems.append({"deck": did, "disc": disc, "file": sp.name, "bytes": sp.stat().st_size, "triangles": st})
        path = out / f"{did}.glb"
        tris = write_glb(path, spec, origin)
        base = float(elev - 0.3 - origin[2]) if did != "dsf" else 0.0
        decks.append({"id": did, "name": name, "elevation": elev, "box": {"base": round(base, 2), "top": round(float(min(top, hi[2] + 0.5) - origin[2]), 2)},
                      "file": path.name, "bytes": path.stat().st_size, "triangles": tris, "equipment": sum(1 for k, _, _ in spec if not k.startswith("TS-"))})
        for node, disc, m, _p2, _fk in allspec:
            t = int(len(m[1]))
            if node.startswith("TS-"):
                n = int(node.split("-")[3])
                levels[n - 1]["triangles"] += t
                levels[n - 1]["decks"].append(did)
                manifest_units.append({"tag": node, "deck": did, "disc": disc, "name": f"{LABEL[disc]} · {levels[n - 1]['group']}" + (f" · {levels[n - 1]['item']}" if levels[n - 1]["item"] else ""), "triangles": t})
            else:
                manifest_units.append({"tag": node, "deck": did, "disc": disc, "name": node, "triangles": t, "equipment": True})
        print(f"{did:4} {path.stat().st_size / 1e6:6.2f} MB {tris:>9,} triangles, {decks[-1]['equipment']} equipment nodes, {sum(1 for k, _, _ in spec if k.startswith('TS-'))} system nodes")
    tri_by_disc = defaultdict(int)
    for u in manifest_units:
        tri_by_disc[u["disc"]] += u["triangles"]
    manifest = {"model": "topside2", "name": "ST-CGF Topside", "source": "CGF-Topside+DSF.nwd", "origin": origin.tolist(), "upAxis": "Y",
                "bounds": {"min": (lo - origin).tolist(), "max": (hi - origin).tolist()}, "groups": [],
                "disciplines": [{"id": d[0], "name": d[1], "color": d[2], "triangles": int(tri_by_disc[d[0]])} for d in DISCIPLINES],
                "decks": decks, "systems": systems, "levels": levels, "units": manifest_units}
    (out / "model.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")
    print(f"model.json: {len(levels)} level-2 entries, {len(manifest_units)} nodes")


if __name__ == "__main__":
    main()
