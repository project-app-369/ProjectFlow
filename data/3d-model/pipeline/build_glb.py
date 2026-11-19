"""Build one Draco-compressed GLB per deck from the geometry ModelTool extracted.

    python build_glb.py <outDir> [deckIds]      e.g. python build_glb.py E:/.../public/models/facility main,caissons

Reads  out/catalog.json and out/work/*.bin (the real triangles of each equipment and structure node, vertices welded within 2 mm).
Writes <outDir>/<deck>.glb and <outDir>/facility-model.json (the node names and positions the web page needs).

Every triangle is kept: nothing is replaced by a box or an envelope and nothing is thinned (DECIMATE is off). The files are small only
because of Draco compression (positions at 16 bits inside each 60,000-triangle block, about 1 mm, normals at 8 bits); the page decodes
them with the Draco WebAssembly decoder before the Autodesk viewer loads them. Normals keep hard edges hard.

Coordinates: the model is Z-up in project metres; the GLB is Y-up and re-centred on ORIGIN so the topside sits near (0, 0, 0).
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

from glb import GlbBuilder, shaded

HERE = Path(__file__).parent
WORK = HERE / "out" / "work"
ORIGIN = np.array([-132.0, 120.0, 0.0])

# triangles whose centroid falls outside are modelling strays (parts parked far from the platform)
FOOTPRINT = {"x": (-175.0, -95.0), "y": (75.0, 170.0), "z": (-45.0, 75.0)}
FOOTPRINT_BRIDGE = {"x": (-118.0, -25.0), "y": (80.0, 108.0), "z": (20.0, 45.0)}

# Triangle budgets. Structure: per deck, shared out over its categories in proportion to what they hold. Equipment: per unit, by size.
STRUCTURE_BUDGET = {"main": 420_000, "intermediate": 420_000, "cellar": 350_000, "sub-cellar": 175_000, "dsf": 175_000, "caissons": 90_000, "bridge": 210_000}
CATEGORY_FLOOR = 2_000
EQUIPMENT_TRIS_PER_METRE = 1_000
EQUIPMENT_MIN, EQUIPMENT_MAX = 3_000, 30_000
CREASE_DEGREES = 40.0

STRUCT_COLOR = {
    "Primary steel": (0.33, 0.40, 0.52, 1), "Bracing": (0.36, 0.44, 0.56, 1), "Secondary steel": (0.52, 0.58, 0.67, 1),
    "Trimmer steel": (0.60, 0.65, 0.72, 1), "Deck plate": (0.80, 0.82, 0.86, 1), "Grating": (0.70, 0.72, 0.76, 1), "Coaming": (0.48, 0.54, 0.62, 1),
    "Equipment supports": (0.45, 0.52, 0.50, 1), "Blast wall": (0.74, 0.50, 0.46, 1), "E-House": (0.84, 0.87, 0.91, 1),
    "Conductor guide": (0.50, 0.50, 0.58, 1), "Deck support frame": (0.40, 0.47, 0.58, 1), "Caissons": (0.44, 0.50, 0.58, 1),
    "Stairs": (0.58, 0.62, 0.68, 1), "Access platforms": (0.62, 0.66, 0.72, 1), "Railings": (0.86, 0.80, 0.30, 1), "Hatch covers": (0.55, 0.60, 0.66, 1),
    "Pipe racks": (0.48, 0.52, 0.58, 1), "Penetrations": (0.55, 0.55, 0.60, 1), "Miscellaneous steel": (0.56, 0.60, 0.66, 1), "Crane boom rest": (0.42, 0.48, 0.58, 1),
    "Monorails": (0.50, 0.54, 0.60, 1), "Lifting lugs": (0.74, 0.52, 0.30, 1),
}
EQUIP_COLOR = (0.91, 0.58, 0.23, 1)


def to_glb_space(p: np.ndarray) -> np.ndarray:
    q = p - ORIGIN
    return np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1)  # Z-up -> Y-up (a rotation: winding is unchanged)


def inside(c: np.ndarray, fp) -> np.ndarray:
    return (c[:, 0] > fp["x"][0]) & (c[:, 0] < fp["x"][1]) & (c[:, 1] > fp["y"][0]) & (c[:, 1] < fp["y"][1]) & (c[:, 2] > fp["z"][0]) & (c[:, 2] < fp["z"][1])


def read_bin(path: Path):
    raw = path.read_bytes()
    nv, nt = struct.unpack_from("<ii", raw, 0)
    v = np.frombuffer(raw, dtype="<f4", count=nv * 3, offset=8).reshape(-1, 3).astype(np.float64)
    f = np.frombuffer(raw, dtype="<i4", count=nt * 3, offset=8 + nv * 12).reshape(-1, 3)
    return v, f


def compact(v: np.ndarray, f: np.ndarray):
    used = np.unique(f)
    remap = np.full(len(v), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return v[used], remap[f]


# Every triangle of the model is kept. Set DECIMATE to thin a part to its budget with quadric edge collapse instead (a lossy option).
DECIMATE = False


def decimate(v: np.ndarray, f: np.ndarray, target: int):
    """Quadric edge collapse down to `target` triangles (nothing happens when the part is already under budget, or DECIMATE is off)."""
    if not DECIMATE or len(f) <= target:
        return v, f
    import fast_simplification
    nv, nf = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - target / len(f), agg=5)
    nf = nf.astype(np.int64)
    ok = (nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2])
    return compact(nv.astype(np.float64), nf[ok])


# A storey is the space from a deck's level up to the next deck's: that is where its equipment stands, so its bracing and stairs
# belong to it. Below the sub-cellar deck level is the DSF. (A little under each level, so members that end on a deck's beams stay with that deck.)
STOREY_TOLERANCE = 0.3


def storey_decks(cat):
    """[(deck id, lowest z of its storey)] from the lowest storey up, using the decks' nominal levels from the catalog."""
    levels = sorted((d["elevation"], d["id"]) for d in cat["decks"] if d["id"] in ("sub-cellar", "cellar", "intermediate", "main"))
    return [("dsf", float("-inf"))] + [(did, z - STOREY_TOLERANCE) for z, did in levels]


def split_by_storey(v, f, bands):
    """{deck id: (vertices, faces)} with each triangle in the storey its centroid stands in."""
    z = v[f].mean(axis=1)[:, 2]
    out = {}
    for k, (did, low) in enumerate(bands):
        high = bands[k + 1][1] if k + 1 < len(bands) else float("inf")
        sel = f[(z >= low) & (z < high)]
        if len(sel):
            out[did] = compact(v, sel)
    return out


def load_part(path: Path, fp):
    if not path.exists():
        return None
    v, f = read_bin(path)
    if not len(f):
        return None
    f = f[inside(v[f].mean(axis=1), fp)]
    return compact(v, f) if len(f) else None


def equipment_mesh(unit, fp):
    vs, fs, off = [], [], 0
    for p in unit["parts"]:
        part = load_part(WORK / (p["id"] + ".bin"), fp)
        if part is None:
            continue
        v, f = part
        vs.append(v)
        fs.append(f + off)
        off += len(v)
    if not vs:
        return None
    v, f = np.concatenate(vs), np.concatenate(fs)
    diag = float(np.linalg.norm(v.max(axis=0) - v.min(axis=0)))
    original = len(f)
    v, f = decimate(v, f, int(min(EQUIPMENT_MAX, max(EQUIPMENT_MIN, diag * EQUIPMENT_TRIS_PER_METRE))))
    return v, f, original


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "glb"
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None  # optional: just these deck ids
    out.mkdir(parents=True, exist_ok=True)
    cat = json.loads((HERE / "out" / "catalog.json").read_text(encoding="utf8"))
    manifest = {"origin": ORIGIN.tolist(), "upAxis": "Y", "decks": [], "units": []}
    # members that run between levels are dealt out to the decks first
    bands = storey_decks(cat)
    dealt = {}  # deck id -> [(category, (v, f))]
    for s in cat["structure"]:
        if s.get("split") != "storey":
            continue
        part = load_part(WORK / (s["id"] + ".bin"), FOOTPRINT)
        if part is None:
            continue
        for did, piece in split_by_storey(*part, bands).items():
            dealt.setdefault(did, []).append((s["category"], piece))
    for deck in cat["decks"]:
        did = deck["id"]
        if only and did not in only:
            continue
        fp = FOOTPRINT_BRIDGE if did == "bridge" else FOOTPRINT
        g = GlbBuilder(draco=True)

        # structure: every category of the deck, thinned in proportion to the deck's budget
        loaded = []
        for s in cat["structure"]:
            if s["deck"] == did and not s.get("split"):
                part = load_part(WORK / (s["id"] + ".bin"), fp)
                if part is not None:
                    loaded.append((s["category"], part))
        loaded += dealt.get(did, [])
        merged = {}
        for category, (v, f) in loaded:
            m = merged.setdefault(category, ([], [], 0))
            m[0].append(v)
            m[1].append(f + m[2])
            merged[category] = (m[0], m[1], m[2] + len(v))
        total = sum(sum(len(f) for f in fs) for _, fs, _ in merged.values()) or 1
        budget = STRUCTURE_BUDGET.get(did, 300_000)
        struct_nodes, tris_struct, tris_struct_in = [], 0, total if merged else 0
        for category, (vs, fs, _) in merged.items():
            v, f = np.concatenate(vs), np.concatenate(fs)
            share = len(f) / total
            v, f = decimate(v, f, max(CATEGORY_FLOOR, int(budget * share)))
            P, N, F = shaded(to_glb_space(v), f, CREASE_DEGREES)
            m = g.mesh(P, N, F, g.material(STRUCT_COLOR.get(category, (0.6, 0.6, 0.65, 1)), category))
            struct_nodes.append(g.node(category, m))
            tris_struct += len(F)

        eq_nodes, units, tris_eq = [], [], 0
        for u in cat["units"]:
            if u["deck"] != did:
                continue
            res = equipment_mesh(u, fp)
            if res is None:
                continue
            v, f, original = res
            P, N, F = shaded(to_glb_space(v), f, CREASE_DEGREES)
            m = g.mesh(P, N, F, g.material(EQUIP_COLOR, "Equipment", metallic=0.3, rough=0.55))
            lo, hi = P.min(axis=0), P.max(axis=0)
            eq_nodes.append(g.node(u["tag"], m, extras={"tag": u["tag"]}))
            tris_eq += len(F)
            units.append({"tag": u["tag"], "deck": did, "triangles": int(len(F)), "sourceTriangles": int(original), "min": lo.round(2).tolist(), "max": hi.round(2).tolist(), "parts": [Path(p["node"]).name for p in u["parts"]]})
        root = g.node(deck["name"], children=[g.node("Structure", children=struct_nodes), g.node("Equipment", children=eq_nodes)])
        path = out / f"{did}.glb"
        g.write(path, [root])
        manifest["decks"].append({"id": did, "name": deck["name"], "elevation": deck["elevation"], "file": path.name, "bytes": path.stat().st_size,
                                  "structureTriangles": tris_struct, "structureSourceTriangles": tris_struct_in, "equipmentTriangles": tris_eq, "equipment": len(units)})
        manifest["units"].extend(units)
        print(f"{did:13s} {path.stat().st_size/1e6:7.2f} MB  structure {tris_struct:8d} tris (from {tris_struct_in})  equipment {len(units):3d} units {tris_eq:8d} tris")
    (out / "facility-model.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
