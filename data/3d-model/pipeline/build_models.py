"""Builds one GLB per group for the Jacket, LQM and Link Bridge models of Construction -> Facility layout.

    python build_models.py jacket|linkbridge|lqm <outDir>        e.g. ... jacket ../../../app/apps/web/public/models

Jacket and Link Bridge read out/m/<model>.raw (ModelTool `rawleaves`) and out/m/<model>_assign.txt (classify_models.py);
LQM reads the per-group out/m/lqm/<group>.bin that ModelTool `groups` welded in Navisworks (classify_lqm.py).
Every triangle is kept; vertices are only welded where they coincide within WELD metres. The files are GLBs
(Draco-compressed like the topside decks: the page decodes them before the viewer sees them), one mesh per group, in the colour of the group.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import classify_models as cm  # noqa: E402
from glb import GlbBuilder, shaded  # noqa: E402
from rawio import leaf_tris, read_raw  # noqa: E402

HERE = Path(__file__).parent
M = HERE / "out" / "m"
WELD = 0.005
CREASE = 40.0
NAMES = {"jacket": "Jacket", "linkbridge": "Link Bridge", "lqm": "LQM"}
LQM_GROUPS = [
    ("structural", "Structural", "#8fa3c4"), ("piping", "Piping", "#2f9d83"), ("e_i", "Electrical & instrument", "#e5a93a"),
    ("telecom", "Telecom", "#d4543b"), ("hvac", "HVAC", "#3b82f6"), ("architectural", "Architectural", "#c9c3b8"),
    ("equipment", "Equipment", "#e8943a"), ("lifting", "Lifting & laydown", "#7c5cc4"), ("other", "Other", "#7c8aa5"),
]
GROUPS = {"jacket": cm.JACKET_GROUPS, "linkbridge": cm.BRIDGE_GROUPS, "lqm": LQM_GROUPS}


def rgba(hexcolour):
    return tuple(int(hexcolour[i:i + 2], 16) / 255 for i in (1, 3, 5)) + (1.0,)


def weld(tris):
    """(N,3,3) triangles -> (vertices, faces), vertices on a WELD grid merged, degenerate faces dropped."""
    p = tris.reshape(-1, 3).astype(np.float64)
    key = np.rint(p / WELD).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    v = p[first]
    f = inv.reshape(-1, 3)
    ok = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])
    return v, f[ok]


def read_bin(path):
    raw = path.read_bytes()
    nv, nt = struct.unpack_from("<ii", raw, 0)
    v = np.frombuffer(raw, dtype="<f4", count=nv * 3, offset=8).reshape(-1, 3).astype(np.float64)
    f = np.frombuffer(raw, dtype="<i4", count=nt * 3, offset=8 + nv * 12).reshape(-1, 3)
    return v, f


def to_glb_space(p, origin):
    q = p - origin
    return np.stack([q[:, 0], q[:, 2], -q[:, 1]], axis=1)  # Z-up -> Y-up


def main():
    model, out = sys.argv[1], Path(sys.argv[2]) / sys.argv[1]
    out.mkdir(parents=True, exist_ok=True)
    groups = GROUPS[model]
    parts = {}
    if model == "lqm":
        for gid, _, _ in groups:
            f = M / "lqm" / f"{gid}.bin"
            if f.exists():
                parts[gid] = read_bin(f)
    else:
        buf, off, cnt = read_raw(M / f"{model}.raw")
        assign = (M / f"{model}_assign.txt").read_text().split("\n")
        assert len(assign) == len(cnt), (len(assign), len(cnt))
        for gid, _, _ in groups:
            idx = [i for i, a in enumerate(assign) if a == gid and cnt[i]]
            if idx:
                parts[gid] = weld(np.concatenate([leaf_tris(buf, off, cnt, i) for i in idx]))
    allv = np.concatenate([v for v, _ in parts.values()])
    lo, hi = allv.min(axis=0), allv.max(axis=0)
    origin = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    manifest = {"model": model, "name": NAMES[model], "origin": origin.tolist(), "upAxis": "Y", "bounds": {"min": lo.tolist(), "max": hi.tolist()}, "groups": []}
    for gid, name, colour in groups:
        if gid not in parts:
            continue
        v, f = parts[gid]
        used = np.unique(f)
        remap = np.full(len(v), -1, dtype=np.int64)
        remap[used] = np.arange(len(used))
        v, f = v[used], remap[f]
        P, N, F = shaded(to_glb_space(v, origin), f, CREASE)
        g = GlbBuilder(draco=True)
        mesh = g.mesh(P, N, F, g.material(rgba(colour), name, metallic=0.2, rough=0.7))
        root = g.node("root", children=[g.node(gid, mesh)])
        path = out / f"{gid}.glb"
        g.write(path, [root])
        manifest["groups"].append({"id": gid, "name": name, "file": f"{gid}.glb", "color": colour, "bytes": path.stat().st_size, "triangles": int(len(F))})
        print(f"{model} {gid:18} {path.stat().st_size / 1e6:7.2f} MB  {len(F):>9,} triangles")
    (out / "model.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
