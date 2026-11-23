"""Decides which group each geometry leaf of the Jacket and Link Bridge models belongs to (the order of out/m/<model>_leaves.tsv).

The Jacket model is a BOCAD export: its parts are called "PANEL 235 of SBFRAMEWORK 1 of FRMWORK 2" and sit under the fabrication phases
(1 to 9), so the groups below come from geometry (where a part stands and what shape it has) and from the phase it belongs to.
    python classify_models.py jacket|linkbridge
"""
import collections
import json
import re
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
M = HERE / "out" / "m"
sys.path.insert(0, str(HERE))
from leaves import load  # noqa: E402

# One group for every Selection Set saved in CGF-Jacket.nwd (name of the set, id, colour); the rest is "structure" and "anodes".
# Where two sets share a part the later one wins, so this is also the order they are applied in.
JACKET_SETS = [
    ("Row 5.1", "row_5_1", "#8fa3c4"), ("Row 2.1", "row_2_1", "#7d93b8"), ("Row 5", "row_5", "#9bb0cf"), ("Row 2", "row_2", "#889fc3"),
    ("Grating support", "grating_support", "#c9a227"), ("Mudmad", "mudmat", "#a98467"), ("Conductor Guide", "conductor_guide", "#d98f4e"),
    ("Conductor Guard", "conductor_guard", "#c4672b"), ("Caisson Guard", "caisson_guard", "#b5651d"), ("Piles", "piles", "#d4543b"),
    ("Conductors", "conductors", "#e07b39"), ("Surge Fenders", "fenders", "#2f9d83"), ("Riser", "riser", "#5b8def"), ("J Tubes", "jtubes", "#8e5ac8"),
    ("Seawater Pump caisson", "seawater_caisson", "#14b8a6"), ("Open Drain Caisson", "open_drain", "#0e9f8e"), ("Overboard Frame", "overboard", "#9a7b4f"),
    ("Bridge landing support", "bridge_support", "#2f7d9d"), ("Bridge landing tower", "bridge_tower", "#3aa0c8"), ("Flooding", "flooding", "#7c5cc4"),
    ("Valve panel", "valve_panel", "#c05cc4"), ("T&I platform 2", "ti_platform", "#e5a93a"), ("Launch cradle", "launch_cradle", "#b07a4a"),
    ("Grating", "grating", "#d8c04a"), ("Buoyancy Tank", "buoyancy_tanks", "#3b82f6"),
]
JACKET_GROUPS = [("structure", "Jacket structure", "#6f7f9c"), ("anodes", "Anodes & supports", "#e5a93a")] + [(gid, name, col) for name, gid, col in JACKET_SETS]
BRIDGE_GROUPS = [
    ("structure", "Structure", "#8fa3c4"),
    ("grating_railing", "Grating & railing", "#c9a227"),
    ("piping", "Steel piping", "#2f9d83"),
    ("piping_frp", "FRP piping", "#9bd14b"),
    ("supports", "Pipe supports", "#a98467"),
    ("electrical", "Electrical & instrument", "#e5a93a"),
    ("misc", "Miscellaneous", "#7c8aa5"),
]
# (TANKS below locates the nine tanks for the construction sequence; the tanks themselves come from the "Buoyancy tanks" set.) Cylinders with dense ring stiffeners, found from those rings (phase 7 parts that are round, 3-8 m across, thin along one axis).
# Nine tanks: four vertical ones at the corners, three horizontal ones at EL -10 m and two along the south and north rows at EL +8.5 m.
# Each is (axis, centre a, centre b, from, to, radius): axis 2 = Z (a, b = X, Y), axis 0 = X (a, b = Y, Z), axis 1 = Y (a, b = X, Z).
TANKS = [(2, -114.94, 143.79, -53.1, -12.0, 1.49), (2, -149.49, 92.02, -27.9, 3.2, 1.79), (2, -149.49, 143.99, -33.9, 3.5, 1.79), (2, -113.34, 99.45, -53.1, -11.5, 1.48),
         (0, 143.0, 8.5, -134.4, -114.5, 1.23), (0, 92.2, 8.5, -138.4, -114.5, 1.73), (0, 128.0, -10.0, -147.8, -128.4, 1.98), (0, 108.0, -10.0, -147.8, -128.4, 1.98),
         (1, -138.0, -10.0, 110.1, 125.9, 1.98)]


# Selection Set of CGF Jacket.nwd -> group, in the order they are applied
SET_GROUPS = [("Pile", "piles"), ("Conductor", "conductors"), ("Caisson", "caissons"), ("Flooding system", "flooding"), ("Buoyancy tanks", "buoyancy_tanks"), ("J-tubes", "jtubes"), ("Bridge support", "bridge_support")]
LEG_REACH = 3.0  # horizontal distance from a leg axis within which tubing counts as running along the leg
TUBE_REACH = 1.2  # and from the surface of a buoyancy tank


def phase(path: str) -> str:
    m = re.search(r"PHASE[-_]?(\d+(?:-\d+)?)", path)
    return m.group(1) if m else "ifc" if "anodes.ifc" in path else ""


def jacket():
    """Group of every leaf of out/m/jacket_leaves.tsv: its Selection Set (out/m/jacket_sets2.json, made by sets_map2.py), else anodes or structure.
    Leaves that CGF-Jacket.nwd no longer has are "removed"."""
    rows = load(str(M / "jacket_leaves.tsv"))
    ph = np.array([phase(r["path"]) for r in rows])
    out = np.full(len(rows), "structure", dtype=object)
    out[np.isin(ph, ["4-6", "4-7", "4-9", "ifc"])] = "anodes"
    out[ph == "4-8"] = "mudmat"
    sets = json.loads((M / "jacket_sets2.json").read_text(encoding="utf8"))
    for name, gid, _ in JACKET_SETS:
        out[sets[name]] = gid
    out[json.loads((M / "jacket_removed.json").read_text(encoding="utf8"))] = "removed"
    return out


def linkbridge():
    rows = load(str(M / "linkbridge_leaves.tsv"))
    out = []
    for r in rows:
        p = r["path"].split(" > ")
        z = p[3] if len(p) > 3 else ""
        sub = p[4] if len(p) > 4 else ""
        if z.startswith("/XBC"):
            out.append("supports" if re.search(r"/PS$|/SP$", sub) else "structure")
        elif z.startswith("/SBC"):
            out.append("grating_railing" if re.search(r"GRATING|RAILING", sub) else "structure")
        elif z.startswith("/PBC"):
            # piping class B8.. (B8CD, B8CW, B8C) is FRP (GRE); every other class is steel / cupro-nickel
            out.append("piping_frp" if re.search(r"-[A-Z]{2}-B8[A-Z0-9]*[-/(]|-[A-Z]{2}-B8[A-Z0-9]*$", " ".join(p[3:]) + " " + r["name"]) else "piping")
        elif z.startswith("/EBC") or z.startswith("/JBC"):
            out.append("electrical")
        else:
            out.append("misc")
    return np.array(out, dtype=object)


if __name__ == "__main__":
    model = sys.argv[1]
    out = {"jacket": jacket, "linkbridge": linkbridge}[model]()
    (M / f"{model}_assign.txt").write_text("\n".join(out), encoding="utf8")
    for k, v in collections.Counter(out).most_common():
        print(v, k)
