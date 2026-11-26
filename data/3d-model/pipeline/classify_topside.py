"""Classifies every geometry leaf of `CGF-Topside Sequence.nwd` for two uses at once:

  * the Construction sequence of the topside (which fabrication / installation stage brings each part), and
  * Facility Layout -> ST-CGF Topside (which deck and which system the part belongs to).

    python classify_topside.py            # needs out/top/leaves.tsv (ModelTool `leaves`) and out/top/sets.json (ModelTool `sets`)

Writes  out/top/assign.txt   one unit id per leaf (`-` = left out), in the order of `leaves`, for ModelTool `groups`
        out/top/units.json   unit id -> {deck, system, label, fab, install, leaves, kept}

A unit is the set of leaves that share the same (deck, system, label, fab stage, install stage); the stage ids are those of
`Construction sequence/Topside Fab Sequence/topside-fabrication-steps.json`.  `fab` is where the part is built (in the yard),
`install` where it joins the topside: they differ for parts that are lifted in (decks, E-House, deck support frame, platforms).

The model names its zones <discipline letter>CG<deck code>D2B (M mechanical, S structure, P piping, E electrical, J instrument,
T telecom, R safety, H HVAC, X supports) and the author saved a Selection Set for most stages (ID 1, ID 2, MD 1, MD 2, E-HOUSE, CD,
SCD+DSF, BLAST WALL, GTG PLATFORM ...), which decide the structure.  Equipment is placed by its tag (the drawing lists the tags per stage).
"""
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out" / "top"

SYSTEMS = {"S": "structural", "M": "equipment", "P": "piping", "X": "piping", "E": "e_i", "J": "e_i", "T": "telecom", "R": "safety", "H": "hvac"}
# the drawing's equipment lists, by tag, to the stage that installs them (tags as they appear in the model)
TAG_STAGE = {
    "6B": ["MBL-6410", "MBL-6411", "WHCP-2870", "MBD-2501", "MBD-2701", "HBA-4904A", "HBA-4904B", "ZZZ-6400", "ZZZ-6405", "MBL-5010", "ZZZ-5000", "MBF-4302", "DV-80"],
    "10": ["ZZZ-4101"],
    "11": ["LAN-7100", "ZAU-3003", "ZZZ-4202", "ZZZ-4201", "MBD-2613A", "MBD-2613B", "MBF-5701", "HAP-5703", "MBF-5702", "FM-200"],
    "17": ["MAF-2401", "ZZZ-4710", "MAD-2415"],
    "19": ["CAE-2614", "HAL-5704"],
    "20B": ["MBJ-4905"],
    "20D": ["LAN-7000"],
    "22B": ["ZZZ-2510"],
    "22C": ["ZZZ-9908"],
}
DECK_BY_CODE = {"MD": "md", "ID": "id", "CD": "cd", "SD": "sd", "EH": "id", "TJ": None, "TS": None}
DECK_NAMES = {"dsf": "Deck support frame", "sd": "Sub-cellar deck", "cd": "Cellar deck", "id": "Intermediate deck", "md": "Main deck"}
SKIP_WORDS = ("HANDLING", "OBST", "PORTABLE", "OPERATOR-", "_VOL", "MIE/", "ACCESS_WAY", "SPACE-FOR-FUTURE", "RESERVE")
# leaves smaller than this (bounding-box diagonal, metres) are bolts, clamps and fittings: left out to keep the model light
MIN_DIAG = {"structural": 0.12, "equipment": 0.06, "piping": 0.80, "e_i": 0.60, "telecom": 0.60, "safety": 0.60, "hvac": 0.60}
# the platform stands inside this box (metres, model coordinates); stray items of the model far outside it are left out
BOX = ((-25.0, -70.0, -12.0), (55.0, 30.0, 50.0))
# the systems are welded on a coarser grid than steel and equipment (ModelTool `groups`, two runs): pipes and cable trays do not need 2 cm
SYSTEM_RUN = {"piping", "e_i", "telecom", "safety", "hvac"}


def csv_tags():
    """The equipment tags of Facility Layout (data/3d-model/facility-equipment.csv), longest first."""
    rows = list(csv.DictReader(open(HERE.parent / "facility-equipment.csv", encoding="utf-8-sig")))
    return sorted({r["Tag"].strip() for r in rows if r["Tag"].strip()}, key=len, reverse=True)


def tag_of(name, tags):
    """The listed equipment tag a model item belongs to (its name holds the tag, with a deck prefix and sub-part suffixes)."""
    for t in tags:
        if t in name:
            return t
    return None


def deck_of_z(z):
    return "sd" if z < 3.5 else "cd" if z < 11.0 else "id" if z < 19.5 else "md"


def main():
    sets = json.load(open(OUT / "sets.json"))
    tags = csv_tags()
    member = defaultdict(set)
    for name, idx in sets.items():
        for i in idx:
            member[i].add(name)
    units, assign = {}, []
    stats = Counter()
    with open(OUT / "leaves.tsv", encoding="utf8") as f:
        next(f)
        for i, line in enumerate(f):
            a = line.rstrip("\n").split("\t")
            p = a[0].split(" > ")
            b = [float(x) for x in a[3:9]]
            diag = ((b[3] - b[0]) ** 2 + (b[4] - b[1]) ** 2 + (b[5] - b[2]) ** 2) ** 0.5
            zc = (b[2] + b[5]) / 2
            file = p[2] if len(p) > 2 else ""
            zone = p[4] if len(p) > 4 else ""
            sub = p[5] if len(p) > 5 else ""
            tag = re.sub(r"^/[A-Z]CG\w{2,3}-", "", p[6]).lstrip("/") if len(p) > 6 else ""
            if not all(BOX[0][k] <= (b[k] + b[3 + k]) / 2 <= BOX[1][k] for k in range(3)):
                stats["outside"] += 1
                assign.append("-")
                continue
            m = member.get(i, set())
            full = a[0]
            unit = None  # (deck, system, label, fab, install)
            if file.startswith("STP-CGF-TEN") and "RVM" in p[3] and zone.startswith("/") and zone[2:4] == "CG":
                disc, code = zone[1], zone[4:6]
                system = SYSTEMS.get(disc)
                deck = DECK_BY_CODE.get(code) or deck_of_z(zc)
                if system is None or any(w in full for w in SKIP_WORDS) or "_VOL" in a[1]:
                    stats["skip name"] += 1
                    assign.append("-")
                    continue
                if disc == "S":
                    if code == "SD":
                        unit = ("dsf", "structural", "Deck support frame", "2B", "25B")
                    elif "SCD PLATF" in m:
                        unit = ("sd", "structural", "Sub-cellar deck platforms", "2D", "27")
                    elif "ACESS PLATFORM" in m:
                        unit = ("cd", "structural", "Access platforms", "2C", "6C")
                    elif "E-HOUSE" in m or "E-HOUSE MISC" in m or "E-HOUSE DUCTING SP" in m:
                        unit = ("id", "structural", "E-House", "2B", "15")
                    elif "ID 1" in m or "ID 1 PL" in m:
                        unit = ("id", "structural", "Intermediate deck part 1", "2A", "7")
                    elif "ID 2" in m:
                        unit = ("id", "structural", "Intermediate deck part 2", "2A", "8")
                    elif "MD 1" in m:
                        unit = ("md", "structural", "Main deck part 1", "2A", "13")
                    elif "MD 2" in m:
                        unit = ("md", "structural", "Main deck part 2", "2A", "14")
                    elif "ID PIPE RACK" in m:
                        unit = ("id", "structural", "Pipe rack below intermediate deck", "6C", "6C")
                    elif "MD PIPE RACK" in m:
                        unit = ("md", "structural", "Pipe rack below main deck", "12", "12")
                    elif "BLAST WALL" in m:
                        unit = ("id", "structural", "Fire and blast wall", "9", "9")
                    elif "BRACING" in m:
                        unit = ("cd", "structural", "Columns and braces", "6A", "6A")
                    elif "GLYCOL PLATFORM" in m or "EXPANSION TANK #1" in m or "GTG PLATFORM #1" in m or "GYLCOL AND COOLER SP PLATFORM #1" in m:
                        unit = ("md", "structural", "GTG, glycol and expansion platforms (1)", "20A", "20A")
                    elif "GTG PLATFORM #2" in m or "EXPANSION TANK " in m:
                        unit = ("md", "structural", "GTG service platforms (2)", "20B", "20B")
                    elif "GTG PLATFORM" in m:
                        unit = ("md", "structural", "GTG service platforms", "20C", "20C")
                    elif "ID PLATFORM" in m or "ID MISC" in m:
                        unit = ("id", "structural", "Platforms and miscellaneous on intermediate deck", "16", "16")
                    elif "CD" in m:
                        unit = ("cd", "structural", "Cellar deck", "5", "5")
                    elif code == "CD":
                        unit = ("cd", "structural", "Cellar deck", "5", "5")
                    elif code == "ID":
                        unit = ("id", "structural", "Remaining structures on intermediate deck", "16", "16")
                    else:
                        unit = ("md", "structural", "Miscellaneous steel on main deck", "23", "23")
                elif disc == "M":
                    if "Mercury" in m:
                        unit = (deck, "equipment", "Mercury removal unit", "22B", "22B")
                    elif "PEDESTAL CRANE" in m:
                        unit = ("md", "equipment", "Pedestal crane adaptor", "17", "17")
                    elif "A FRAME" in m:
                        unit = ("md", "equipment", "Pedestal crane A-frame", "22A", "22A")
                    else:
                        st = None
                        for s, pats in TAG_STAGE.items():
                            if any(t in tag or t in p[6] for t in pats):
                                st = s
                                break
                        if st is None:
                            st = {"cd": "6B", "id": "17", "md": "19", "sd": "27"}[deck]
                        listed = tag_of(p[6] + "/" + (p[7] if len(p) > 7 else ""), tags)
                        unit = (deck, "equipment", listed or "Equipment " + {"6B": "on cellar deck", "10": "lifted on cellar deck", "11": "on intermediate deck", "17": "on intermediate deck", "19": "on main deck", "20B": "expansion vessel", "20D": "gas turbine generators", "22B": "mercury removal unit", "22C": "pedestal crane boom", "27": "on sub-cellar deck"}[st], st, st)
                else:
                    if code == "EH":
                        st, deck = "15", "id"
                    else:
                        st = {"cd": "18", "id": "18", "md": "21" if disc == "R" else "18", "sd": "27"}[deck]
                    unit = (deck, system, {"piping": "Piping and supports", "e_i": "Electrical and instrument", "telecom": "Telecom", "safety": "Safety", "hvac": "HVAC"}[system] + (" (E-House)" if code == "EH" else ""), st, st)
                if diag < MIN_DIAG[unit[1]]:
                    stats["small"] += 1
                    assign.append("-")
                    continue
            elif file.startswith("4N991"):
                unit = ("md", "equipment", "Vendor equipment on main deck", "19", "19")
            elif file == "0":
                unit = ("dsf", "structural", "Skidway", "3", "3")
            else:
                stats["not part"] += 1
                assign.append("-")
                continue
            key = "|".join(unit)
            if key not in units:
                units[key] = {"id": "u%03d" % len(units), "deck": unit[0], "system": unit[1], "label": unit[2], "fab": unit[3], "install": unit[4], "leaves": 0}
            units[key]["leaves"] += 1
            assign.append(units[key]["id"])
    (OUT / "assign.txt").write_text("\n".join(assign) + "\n")
    sysunits = {u["id"] for u in units.values() if u["system"] in SYSTEM_RUN}
    (OUT / "assign_a.txt").write_text("\n".join("-" if (x in sysunits) else x for x in assign) + "\n")
    (OUT / "assign_b.txt").write_text("\n".join(x if (x in sysunits) else "-" for x in assign) + "\n")
    out = sorted(units.values(), key=lambda u: u["id"])
    json.dump(out, open(OUT / "units.json", "w"), indent=1)
    print(dict(stats), len(out), "units,", sum(u["leaves"] for u in out), "leaves kept of", len(assign))
    for u in out:
        print(u["id"], u["deck"], u["system"], u["label"], "fab", u["fab"], "inst", u["install"], u["leaves"])


if __name__ == "__main__":
    main()
