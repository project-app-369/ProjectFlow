"""Classifies the leaves of the DSF and of the E-House of `CGF-Topside Sequence.nwd` into the stages of their own fabrication sequences:

  DSF      261001_ST-CGF TOPSIDE DSF_FABRICATION_SEQUENCE    (Construction sequence/DSF Fab Sequence/dsf-fabrication-steps.json, 12 stages)
  E-House  2021-4591-65-1022 E-House Fabrication Sequence     (Construction sequence/Topside Fab Sequence/ehouse-fabrication-steps.json, 13 stages)

    python classify_sub.py       # needs out/top/leaves.tsv and out/top/sets.json

Writes out/top/assign_c.txt (one unit id per leaf, `-` = left out) and out/top/units_sub.json.  ModelTool `groups` welds each unit.

DSF: the model names its parts (/DSF_BOX_PLATE_LOWER_3 ...): the drawing's parts L3-1..6, L4-1..6 are the six 11 m lengths of the lower box of row 3 and row 4,
M3/M4-A1,A2,C1,C2 the halves of the middle boxes, U3/U4-A,C the upper boxes; CROSS_SECTION holds the cross girders, transverse beams and tubular frames,
DSF_BARCING the horizontal bracings, DSF_SUPPORT the support DSU-3.1, DSF_TIMBER / CLIP_PLT / DSF_BOLT the timbers and their fixings.
E-House: the E-HOUSE Selection Set (structure) and the E-House zones of the E, J, T and H disciplines are placed by level: the decks stand at about 12.2 (level 1),
18.1 (level 2) and 22.4 (level 3, the roof); what lies between two decks belongs to the lower one.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out" / "top"
DSF_RANGE = (343341, 350767)
MIN_DIAG = 0.12
L1_TOP, L2_TOP = 15.0, 20.5  # decks: level 1 below 15, level 2 below 20.5, level 3 (roof) above
WALL_SPLIT = 18.0  # walls and columns below belong to level 1, above to level 2


def dsf_stage(p, b, zc):
    """-> (stage no, label) for a leaf of the DSF zone, or None."""
    full = " > ".join(p)
    xc = (b[0] + b[3]) / 2
    m = re.search(r"/DSF_BOX_PLATE_(LOWER|MIDDLE|UPPER)_([AC]?)(\d)", full)
    if m:
        level, grid, row = m.groups()
        if level == "LOWER":
            part = min(5, max(0, int((xc + 17.0) // 11.0))) + 1  # six 11 m lengths from x = -17
            order = {3: 3, 4: 3, 2: 4, 5: 4, 1: 4, 6: 4}
            if row == "3":
                return order[part] if row == "3" else None, f"Lower box L3-{part}"
            return 7, f"Lower box L4-{part}"
        if level == "MIDDLE":
            return 8, f"Middle box M{row}-{grid}"
        return 9, f"Upper box U{row}-{grid}"
    if "/DSF_BARCING" in full:
        return 6, "Horizontal bracing"
    if "/DSF_CROSS_SECTION" in full:
        return (10, "Tubular frames") if b[5] > -3.0 else (5, "Cross girders and transverse beams")
    if "/DSF_SUPPORT" in full:
        return 11, "DSF support DSU-3.1"
    if "/DSF_TIMBER" in full or "/CLIP_PLT" in full or "/DSF_BOLT" in full:
        return 12, "Timbers, clip plates and bolts"
    return None


def eh_stage(zone, member, b, name):
    """-> (stage no, label, system) for a leaf of the E-House, or None. zone is e.g. /ECGEHD2B."""
    zc = (b[2] + b[5]) / 2
    level = 1 if zc < WALL_SPLIT else 2
    if zone == "/SCGIDD2B":
        # structure: the frames of the decks (primary and secondary steel) by level, the framing and panels of the walls and roof, the ladders
        if zc < L1_TOP:
            deck = 1
        elif zc < L2_TOP:
            deck = 2
        else:
            deck = 3
        tall = (b[5] - b[2]) > 1.2
        if "LADDER" in name:
            return 11, "Stairs and ladders", "structural"
        if tall:  # columns and wall framing, wall panels
            return (3 if level == 1 else 5), f"Columns and wall on level {level}", "structural"
        return {1: 2, 2: 2, 3: 2}[deck], f"Deck level {deck}", "structural"
    if zone == "/HCGEHD2B":
        return (7 if level == 1 else 9) if zc < 22.0 else 11, "HVAC and ducting", "hvac"
    if zone in ("/ECGEHD2B", "/JCGEHD2B", "/TCGEHD2B", "/MCGEHD2B"):
        system = {"/ECGEHD2B": "e_i", "/JCGEHD2B": "e_i", "/TCGEHD2B": "telecom", "/MCGEHD2B": "equipment"}[zone]
        equip = "CABINET" in name or "EQUI" in name
        if equip:
            return (8 if level == 1 else 10), f"Equipment on level {level}", "equipment"
        return (7 if level == 1 else 9), f"Cable tray and supports, level {level}", system
    return None


def main():
    sets = json.load(open(OUT / "sets.json"))
    ehouse = set(sets["E-HOUSE"]) | set(sets["E-HOUSE MISC"])
    units, assign = {}, []
    with open(OUT / "leaves.tsv", encoding="utf8") as f:
        next(f)
        for i, line in enumerate(f):
            a = line.rstrip("\n").split("\t")
            p = a[0].split(" > ")
            b = [float(x) for x in a[3:9]]
            diag = ((b[3] - b[0]) ** 2 + (b[4] - b[1]) ** 2 + (b[5] - b[2]) ** 2) ** 0.5
            zone = p[4] if len(p) > 4 else ""
            hit = None
            if DSF_RANGE[0] <= i <= DSF_RANGE[1] and zone == "/SCGSDD2B":
                r = dsf_stage(p, b, (b[2] + b[5]) / 2)
                if r and r[0]:
                    hit = ("dsf", r[0], r[1], "structural")
            elif p[2:3] and p[2].startswith("STP-CGF-TEN") and not any(w in a[0] for w in ("HANDLING", "OBST", "PORTABLE", "_VOL", "MIE/")):
                if (zone == "/SCGIDD2B" and i in ehouse) or zone in ("/HCGEHD2B", "/ECGEHD2B", "/JCGEHD2B", "/TCGEHD2B", "/MCGEHD2B"):
                    r = eh_stage(zone, i in ehouse, b, a[0].split(" > ")[-1] + " " + a[1])
                    if r:
                        hit = ("ehouse", r[0], r[1], r[2])
            if hit is None or diag < MIN_DIAG:
                assign.append("-")
                continue
            key = "|".join(map(str, hit))
            if key not in units:
                units[key] = {"id": "s%03d" % len(units), "seq": hit[0], "stage": hit[1], "label": hit[2], "system": hit[3], "leaves": 0}
            units[key]["leaves"] += 1
            assign.append(units[key]["id"])
    (OUT / "assign_c.txt").write_text("\n".join(assign) + "\n")
    out = sorted(units.values(), key=lambda u: u["id"])
    json.dump(out, open(OUT / "units_sub.json", "w"), indent=1)
    print(len(out), "units,", sum(u["leaves"] for u in out), "leaves kept")
    for u in out:
        print(u["id"], u["seq"], "stage", u["stage"], u["system"], u["label"], u["leaves"])


if __name__ == "__main__":
    main()
