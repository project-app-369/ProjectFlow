"""Classifies every geometry leaf of `CGF-Topside+DSF.nwd` for Facility Layout -> ST-CGF Topside.

    python classify_tds.py     # needs out/tds/leaves.tsv (ModelTool `leaves`)

A part belongs to

  * a **deck box**, by its true elevation (the model's Z is the elevation in metres): a deck's box runs from the deck's level (less 0.3 m
    of steel) up to the level of the next deck, so a storey holds the deck plate and everything that stands on it up to the deck above.
    DSF below the sub-cellar deck, then sub-cellar (13.5 m), cellar (18 m), intermediate (26 m) and main deck (34 m, with everything above);
  * a **Level 1 discipline** (DISCIPLINES, 16 of them), read from the zone letter and the branch of the model tree;
  * a **Level 2 group** inside the discipline (the kind of item: junction boxes, cable tray, transmitters, valves, ... or the service of a pipe)
    and, for piping, the **line** (`3"-AI-A6-3001`) and, for mechanical, the **equipment tag** (a listed Facility Layout tag is one node).

Writes  out/tds/assign_a.txt, assign_b.txt   one unit id per leaf (`-` = left out) in the order of `leaves`, for ModelTool `groups`
                                              (a: steel and equipment, 4 mm grid; b: systems, 6 mm grid: welds only the vertices that coincide, shapes stay true)
        out/tds/units.json                    unit id -> {deck, disc, group, item, tag, leaves}
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out" / "tds"

# Level 1: id, label, colour. The order is the order of the chips.
DISCIPLINES = [
    ("struct_pri", "Structural Primary", "#7f93b8"),
    ("struct_sec", "Structural Secondary", "#a9bbd6"),
    ("misc", "Misc.", "#a39e93"),
    ("access", "Access Platform", "#c9a227"),
    ("pipe_rack", "Pipe rack", "#6d8f5e"),
    ("steel_piping", "Steel Piping", "#2f9d83"),
    ("frp_piping", "FRP Piping", "#9bd14b"),
    ("pipe_supports", "Pipe supports", "#5b8c85"),
    ("mechanical", "Mechanical", "#e8943a"),
    ("electrical", "Electrical", "#e5a93a"),
    ("lighting", "Lighting", "#ffe066"),
    ("instrument", "Instrument", "#7a5cc7"),
    ("fire_gas", "Fire & Gas", "#f06292"),
    ("telecom", "Telecom", "#d4543b"),
    ("hvac", "HVAC", "#3b82f6"),
    ("safety", "Safety", "#c4478a"),
]
DISC_IDS = [d[0] for d in DISCIPLINES]
LARGE_EQUIPMENT = 1.5  # bounding-box diagonal (m) from which an untagged piece of equipment is in the overview
SYSTEM_RUN = {"steel_piping", "frp_piping", "pipe_supports", "electrical", "lighting", "instrument", "fire_gas", "telecom", "hvac", "safety"}
# smallest part kept (bounding-box diagonal, metres): bolts, clamps and fittings are left out to keep the model light
# Part 1 (the overview, loaded at once) keeps the large parts only; part 2 (the systems, loaded when one is picked) keeps nearly everything.
MIN_DIAG = {"struct_pri": 0.15, "struct_sec": 0.15, "misc": 0.20, "access": 0.20, "pipe_rack": 0.04, "mechanical": 0.04, "steel_piping": 0.25, "frp_piping": 0.25,
            "pipe_supports": 0.05, "electrical": 0.05, "lighting": 0.06, "instrument": 0.04, "fire_gas": 0.05, "telecom": 0.05, "hvac": 0.30, "safety": 0.04}
# the platform stands inside this box (metres, model coordinates)
BOX = ((-175.0, 70.0, -5.0), (-95.0, 170.0, 62.0))
# deck boxes: id, name, nominal elevation, upper limit of the box (the next deck's level less 0.3 m)
DECKS = [("dsf", "DSF", 10.0, 13.2), ("sd", "Sub-Cellar Deck", 13.5, 17.7), ("cd", "Cellar Deck", 18.0, 25.7), ("id", "Intermediate Deck", 26.0, 33.7), ("md", "Main Deck", 34.0, 1e9)]
SKIP_WORDS = ("HANDLING", "OBST", "PORTABLE", "OPERATOR-", "_VOL", "MIE/", "ACCESS_WAY", "SPACE-FOR-FUTURE", "RESERVE", "FOOTPRINT", "RIGGING")

SEGMENT = {
    "JUNCTBX": "Junction boxes", "JUNCAIR": "Junction boxes", "LADDER": "Cable ladder", "TRAY": "Cable tray", "RUNTRAY": "Cable tray", "TRAY_LAD_ESUPP": "Cable tray & ladder supports",
    "RUNSUPP": "Cable tray supports", "SUPP": "Supports", "MCT_PENE": "Cable transits", "MCT-PEN": "Cable transits", "PUSHBUT-SWITCH": "Push buttons & switches",
    "SOCKET-OUTLET": "Socket outlets", "MAIN-EQUI": "Main electrical equipment", "MAIN_EQUI": "Main electrical equipment", "MAIN_EQUI_L1": "Main electrical equipment",
    "MAIN_EQUI_L2": "Main electrical equipment", "MAIN_EQUI-ESUPP": "Main electrical equipment", "MAIN_EQUI_ESUPP": "Main electrical equipment",
    "LIGHTING_ESC": "Escape lighting", "LIGHTING_EMER": "Emergency lighting", "LIGHTING_ESUPP": "Essential-supply lighting", "LIGHTING_NOR": "Normal lighting",
    "FGDEV": "Fire & gas devices", "SAFETY-EQUI": "Safety equipment", "EQUI_SUPP": "Supports", "DRAINBOX": "Drain boxes", "LFTBEAM": "Lifting beams",
    "PSO": "Pipe supports", "SPO": "Pipe supports", "TRIM2": "Pipe supports",
    "ELECTRICAL_TRIMMER_BEAM": "Cable tray supports",
}
# structural branches (the part of the branch name after the zone prefix)
STRUCT = [
    ("struct_pri", ("-PRI", "BRACING", "DECK_SUPPORT_FRAME", "_DFS")), ("struct_sec", ("-SEC", "TRIMMER")),
    ("access", ("ACPLTF", "STAIR", "RAILING", "HANDRAIL", "GRATING", "FLOORING")), ("pipe_rack", ("PIPE_RACK", "PIPERACK")),
]
VALVE = re.compile(r"^(BDV|XCV|SDV|DBB|PCV|LCV|FCV|TCV|ESDV|HV|XV|CV|PSV|TSV|PV|FV|SV|MOV|XZV|ZV|HCV|EBV)\b|VALVE", re.I)
TRANSMITTER = re.compile(r"^(PT|PDT|PDIT|PIT|PZT|FT|FIT|TT|TIT|TZT|LT|LIT|LZT|AT|AIT|DT|QT|ST|VT|XT|XY|LS|PS|TS|FS|LSH|LSL|PSH|PSL|PG|TG|LG|FG)(?=[-_ /0-9A-Z])", re.I)
CABINET = re.compile(r"CAB|PANEL|PNL|LCP|UCP|MCC|RIO|SWITCHBOARD|DB-", re.I)


def csv_tags():
    rows = list(csv.DictReader(open(HERE.parent / "facility-equipment.csv", encoding="utf-8-sig")))
    return sorted({r["Tag"].strip() for r in rows if r["Tag"].strip()}, key=len, reverse=True)


def deck_of(z):
    for did, _, _, top in DECKS:
        if z < top:
            return did
    return "md"


def clean(name):
    """/SCGMD2B-PRI -> PRI; /CGD-3"-AI-A6-3001 -> 3"-AI-A6-3001"""
    return re.sub(r"^/(?:[A-Z]CG\w*?|CG[A-Z])[-/]", "", name).lstrip("/").strip()


def segment_label(seg):
    key = seg.split("/")[-1]
    if key in SEGMENT:
        return SEGMENT[key]
    key2 = re.sub(r"^[A-Z]CG\w*?[_-]", "", key)
    if key2 in SEGMENT:
        return SEGMENT[key2]
    if "LIGHTING" in key:
        return SEGMENT.get(re.sub(r"^.*(LIGHTING_[A-Z]+).*$", r"\1", key), "Lighting")
    if "JUNC" in key:
        return "Junction boxes"
    if "TRAY" in key or "LADDER" in key:
        return "Cable tray"
    if "SUPP" in key:
        return "Supports"
    if "EQUI" in key:
        return "Equipment"
    return key.replace("_", " ").replace("-", " ").strip().capitalize() or "Other"


def line_parts(name):
    """/CGD-3"-AI-A6-3001 -> ('AI', 'A6', '3"-AI-A6-3001'), or None."""
    n = clean(name)
    m = re.match(r'^([\d./]+"?)-([A-Z]{2})-([A-Z0-9]+)-', n)
    return (m.group(2), m.group(3), n) if m else None


def access_group(full):
    """Access platform leaves by what they are: grating and flooring are told apart from the platform framework, ladders, stairs and railings."""
    up = full.upper()
    for word, label in (("GRATING", "Grating"), ("FLOORING", "Flooring"), ("LADDER", "Ladders"), ("STAIR", "Stairs"), ("RAILING", "Railings"), ("HANDRAIL", "Railings")):
        if word in up:
            return label
    return "Access platforms"


def valve_type(name):
    """BDV-2401-4_TANK... -> BDV;  XV-7000B-2 -> XV"""
    m = re.match(r"[A-Za-z]+", clean(name))
    return m.group(0).upper() if m else "Other"


MANUAL_VALVE = re.compile(r"\s/(V[A-Z]{0,2})(\d{4,6})$")


# the parts that make a pipe continuous (tube, elbow, tee, reducer, flange, olet, coupling, valve...) are never dropped for being short: a line cut by a missing
# elbow or valve shows as a gap. Gaskets and attachments are thin and leave no visible gap, so they follow the usual limit.
PIPE_PART = re.compile(r"^(TUBE|FTUBE|ELBOW|BEND|FBEND|TEE|REDUCER|FLANGE|OLET|COUPLING|PCOMPONENT|FBLIND|CAP|CROSS|NOZZLE|/V[A-Z]{0,2}\d)", re.I)


# runs that must not show a gap whatever the size of a piece: cable tray and ladder (and their supports), supports of instruments and telecom
CONTINUOUS = {"Cable tray", "Cable ladder", "Cable tray & ladder supports", "Cable tray supports", "Supports", "Cable transits"}


def min_diag(disc, group, name):
    if disc == "hvac":
        # ducting is kept whole (a short section or a damper missing leaves a gap in the run); only the gaskets and the small parts of equipment and supports go
        return {"Ducting": 0.3 if name.strip().upper().startswith("GASKET") else 0.0, "Duct supports": 0.1}.get(group, 0.3)
    if group.endswith("valves"):
        return 0.0
    if disc in ("steel_piping", "frp_piping") and PIPE_PART.match(name.strip()):
        return 0.0
    if disc in ("electrical", "telecom", "instrument") and group in CONTINUOUS:
        return 0.0
    return MIN_DIAG[disc]


def classify(p, tags, full):
    """-> (disc, group, item, tag) for a leaf, or None to leave it out."""
    zone, branch = p[2], (p[3] if len(p) > 3 else "")
    letter = zone[1]
    sub = p[4] if len(p) > 4 else ""
    if letter == "S":
        b = branch.upper()
        for disc, words in STRUCT:
            if any(w in b for w in words):
                if disc == "access":
                    return disc, access_group(full), None, None
                if disc == "pipe_rack":
                    return disc, "Pipe rack", None, None
                return disc, clean(branch).replace("_", " ").replace("-", " ").title(), None, None
        return "misc", clean(branch).replace("_", " ").replace("-", " ").title(), None, None
    if letter == "D":
        return "misc", "Lifting beams", None, None
    if letter == "M":
        tag = next((t for t in tags if t in full), None)
        if tag:
            return "mechanical", "Equipment", tag, tag
        seg = segment_label(branch)
        return "mechanical", "Vendor equipment" if "VENDOR" in full else seg if seg != "Equipment" else "Other equipment", clean(sub) if sub else None, None
    if letter == "X":
        return "pipe_supports", "Pipe supports", None, None
    if letter == "E":
        if "LIGHTING" in branch.upper():
            return "lighting", segment_label(branch), None, None
        return "electrical", segment_label(branch), None, None
    if letter == "J":
        seg = segment_label(branch)
        if seg == "Fire & gas devices":
            return "fire_gas", "Fire & gas devices", None, None
        if seg == "Equipment":
            nm = clean(sub)
            if CABINET.search(nm):
                return "instrument", "Cabinets & panels", None, None
            if VALVE.search(nm):
                return "instrument", "Instrument valves", valve_type(nm), None
            if TRANSMITTER.match(nm):
                return "instrument", "Transmitters & switches", None, None
            return "instrument", "Other instruments", None, None
        return "instrument", seg, None, None
    if letter == "T":
        return "telecom", segment_label(branch), None, None
    if letter == "R":
        return "safety", "Safety equipment", None, None
    if letter == "H":
        up = branch.upper()
        if "SUPPORT" in up:
            return "hvac", "Duct supports", None, None
        if "DUCT" in up and not re.match(r"^/Z[A-Z]{2}-", sub):
            return "hvac", "Ducting", None, None
        return "hvac", "HVAC equipment", re.sub(r"^\d+_", "", clean(sub)) if sub else None, None
    if letter == "P":
        up = full.upper()
        if "INST_ON-OFF_VALVE" in up or "SDV-" in sub.upper() or "BDV-" in sub.upper() or "XV-" in sub.upper():
            return "instrument", "Instrument valves", valve_type(sub), None
        lp = line_parts(sub) if sub else None
        if lp:
            service, cls, name = lp
            frp = cls[0] == "F" or "GRE" in up
            return ("frp_piping" if frp else "steel_piping"), service, name, None
        if "GRE" in up or "FRP" in up:
            return "frp_piping", "Studies and fittings", None, None
        return "steel_piping", "Fittings and studies", None, None
    return None


def main():
    tags = csv_tags()
    units, assign = {}, []
    stats = Counter()
    with open(OUT / "leaves.tsv", encoding="utf8", errors="replace") as f:
        next(f)
        for line in f:
            a = line.rstrip("\n").split("\t")
            p = a[0].split(" > ")
            b = [float(x) for x in a[3:9]]
            c = [(b[k] + b[3 + k]) / 2 for k in range(3)]
            if len(p) < 4 or len(p[2]) < 4 or p[2][2:4] != "CG":
                stats["not a zone"] += 1
                assign.append("-")
                continue
            if not all(BOX[0][k] <= c[k] <= BOX[1][k] for k in range(3)):
                stats["outside"] += 1
                assign.append("-")
                continue
            full = " > ".join(p[3:]) + " " + a[1]
            if any(w in full for w in SKIP_WORDS):
                stats["skip name"] += 1
                assign.append("-")
                continue
            hit = classify(p, tags, full)
            if hit is None:
                stats["unclassified"] += 1
                assign.append("-")
                continue
            disc, group, item, tag = hit
            diag = ((b[3] - b[0]) ** 2 + (b[4] - b[1]) ** 2 + (b[5] - b[2]) ** 2) ** 0.5
            # a hand-operated valve inside a piping line stays an item of its line (so a line shows whole) and is flagged: the page lists the flagged ones as Manual valves
            mv = disc in ("steel_piping", "frp_piping") and bool(MANUAL_VALVE.search(full.strip()))
            if diag < (0.0 if mv else min_diag(disc, group, a[1])):
                stats["small"] += 1
                assign.append("-")
                continue
            deck = "dsf" if "DECK_SUPPORT_FRAME" in full or "_DFS" in full else deck_of(c[2])
            # part 2: the systems, and the small parts of the equipment (a valve, a nozzle, a ladder on a vessel); part 1 keeps the listed tags and the large ones
            p2 = disc in SYSTEM_RUN or (disc == "mechanical" and not tag and diag < LARGE_EQUIPMENT)
            key = (deck, disc, group, item or "", tag or "", p2, mv)
            if key not in units:
                units[key] = {"id": "t%04d" % len(units), "p2": p2, "v": mv, "deck": deck, "disc": disc, "group": group, "item": item, "tag": tag, "leaves": 0}
            units[key]["leaves"] += 1
            assign.append(units[key]["id"])
    (OUT / "assign_all.txt").write_text("\n".join(assign) + "\n")
    sysunits = {u["id"] for u in units.values() if u["p2"]}
    (OUT / "assign_a.txt").write_text("\n".join("-" if x in sysunits else x for x in assign) + "\n")
    (OUT / "assign_b.txt").write_text("\n".join(x if x in sysunits else "-" for x in assign) + "\n")
    out = sorted(units.values(), key=lambda u: u["id"])
    json.dump(out, open(OUT / "units.json", "w"), indent=1)
    kept = sum(u["leaves"] for u in out)
    print(dict(stats), len(out), "units,", kept, "leaves kept of", len(assign))
    by = Counter()
    for u in out:
        by[(u["disc"])] += u["leaves"]
    for d in DISC_IDS:
        n = len({(u["group"], u["item"]) for u in out if u["disc"] == d})
        print(f"{d:14} {by[d]:>8} leaves  {n:>5} level-2 entries")
    for dk in [d[0] for d in DECKS]:
        print(dk, sum(u["leaves"] for u in out if u["deck"] == dk))


if __name__ == "__main__":
    sys.exit(main())
