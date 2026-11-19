"""Decide which Navisworks nodes become which deck, structure part and equipment unit.

Inputs  : out/equip_children.tsv  (written by the Navisworks `children` command)
Outputs : out/jobs.txt            (extract jobs for ModelTool)
          out/catalog.json        (units and structure parts, consumed by build_glb.py)
"""
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"

DECKS = [
    # id, name, nominal elevation (m, from the plating levels in the model)
    ("sub-cellar", "Sub-Cellar Deck", 13.5),
    ("cellar", "Cellar Deck", 18.0),
    ("intermediate", "Intermediate Deck", 26.0),
    ("main", "Main Deck", 34.0),
    ("dsf", "DSF", 10.0),
    ("caissons", "Caissons", -10.0),
    ("bridge", "Bridge", 30.0),
]

ZONE_DECK = {
    "/MCGMDD2B/EQUI": "main", "/MCGMDD2B/EQUI/VENDOR": "main",
    "/MCGIDD2B/EQUI": "intermediate", "/MCGIDD2B/EQUI/VENDOR": "intermediate",
    "/MCGCDD2B/EQUI": "cellar", "/MCGCDD2B/EQUIPMENT/VENDOR": "cellar",
    "/MCGSDD2B/EQUI": "sub-cellar", "/MCGSDD2B/EQUI/VENDOR": "sub-cellar",
    "/MCGTJD2B/EQUI": "dsf", "/MCGTJD2B/EQUI/VENDOR": "dsf",
    "/ECGIDD2B/MAIN_EQUI": "intermediate",
    "/HCGEHD2B/EHOUSE/HVA-EQUIPMENT": "intermediate",
}

# Where the project introduction deck (30-Oct-26) puts a tag; it wins over the zone the tag is modelled in.
DECK_BY_TAG = {}
for deck, tags in {
    "sub-cellar": "MBF-6101 PBE-6103A PBE-6103B PBA-6203 ABJ-6202 PBA-6206 PBA-6205",
    "cellar": "WHCP-2870 MBD-2501 MBF-4302 ZZZ-4101 DV-8007 DV-8008 DV-8009 DV-8010 HBA-4904A HBA-4904B ZZZ-5000 MBD-2701 ZZZ-6400 ZZZ-6405",
    "intermediate": "LAN-7100 ZZZ-4710 MAF-2401 MAD-2415 ZAU-3003 ZZZ-4202 ZZZ-4201",
    "main": "ZZZ-9908 LAN-7000A LAN-7000B CAE-2614A CAE-2614B ZZZ-2510 MBJ-4905",
}.items():
    for t in tags.split():
        DECK_BY_TAG[t] = deck

# Equipment that hangs in the caissons below the DSF: grouped with the Caissons, not with the deck it is operated from
DECK_BY_TAG.update({t: "caissons" for t in "PBE-4902A PBE-4902B ABH-4901A ABH-4901B ABH-6204 PBA-6205".split()})

SKIP_NAME = re.compile(
    r"PORTABLE-PLATFORM|OBST|FootPrint|^EQUIPMENT \d+ of ZONE|/Copy-of-|Copy-of-|STORED|NAV\.-PHOTOCELL|HEAT_TRACING|GUTTER_NOZZLE|"
    r"VALVE_INTERLOCK|SEA-WATER-OVER-BOARD|WORKER-MAINTENANCE|-ZZZ-CABINET|HAP-5703AB|Test_hole|Access_Door|SUNSHADE|JBCI|^/JB|/SP-30"
)
TAG_RE = re.compile(r"([A-Z]{1,4}\d?-\d{3,5}(?:_?[A-Z]{1,2})?)(?![A-Za-z0-9])")
ROLE_RE = re.compile(r"-(EXHAUST|VALVE|STP-SL|STP-OK|AIR[-_]MODULE)")
SPECIAL = {
    "TOTE-TANKS": "TOTE-TANKS",
    "N2-CYLINDER-RACK-1": "N2-RACK-1",
    "N2.-CYLINDER-RACK-2": "N2-RACK-2",
    "STT-PACU-2": "PACU-2",
    "FM-200-XA": "FM-200-XA",
    "FM-200-XB": "FM-200-XB",
}


def tag_of(name: str):
    n = name.strip("/")
    for k, v in SPECIAL.items():
        if k in n:
            return v
    n2 = re.sub(r"^(MCG[A-Z]{3}2B|MCG[A-Z]{3})-", "", n.lstrip("/"))
    n2 = re.sub(r"^\d{8}_", "", n2)
    m = TAG_RE.match(n2)
    if not m:
        return None
    return m.group(1).replace("_", "")


def revision_key(name: str):
    digits = re.findall(r"\d{6}", name)
    return max(digits) if digits else ""


def build():
    rows = list(csv.DictReader(open(OUT / "equip_children.tsv", encoding="utf8"), delimiter="\t"))
    by_tag = {}
    for r in rows:
        zone = r["zone"]
        if zone not in ZONE_DECK:
            continue
        name = r["name"]
        if SKIP_NAME.search(name):
            continue
        tag = tag_of(name)
        if not tag or int(r["geo"]) == 0:
            continue
        vendor = zone.endswith("/VENDOR") or "VENDOR" in name
        m = ROLE_RE.search(name)
        role = m.group(1).replace("_", "-") if m else ""
        box = [float(r[k]) for k in ("minx", "miny", "minz", "maxx", "maxy", "maxz")]
        by_tag.setdefault(tag, []).append({"node": name, "zone": zone, "vendor": vendor, "role": role, "geo": int(r["geo"]), "box": box})

    units = []
    for tag, nodes in sorted(by_tag.items()):
        chosen = {}
        for n in nodes:
            cur = chosen.get(n["role"])
            if cur is None:
                chosen[n["role"]] = n
                continue
            # vendor model beats the placeholder; among vendor models the latest dated revision wins
            if n["vendor"] and not cur["vendor"]:
                chosen[n["role"]] = n
            elif n["vendor"] == cur["vendor"] and revision_key(n["node"]) > revision_key(cur["node"]):
                chosen[n["role"]] = n
            elif n["vendor"] == cur["vendor"] and revision_key(n["node"]) == revision_key(cur["node"]) and n["geo"] > cur["geo"]:
                chosen[n["role"]] = n
        # a vendor model of the whole package already contains the placeholder's valves
        parts = list(chosen.values())
        deck = DECK_BY_TAG.get(tag) or ZONE_DECK[nodes[0]["zone"]]
        units.append({"tag": tag, "deck": deck, "parts": parts})
    return units


# (node, category, weld size in metres[, "storey"]). "storey": the node is modelled in one deck's zone but its members run between levels
# (bracing and stair rows of the main-deck zone span the whole platform): build_glb.py deals its triangles out to the deck whose storey they stand in.
# (node, category, weld size in metres). Every leaf of the node is exported with its real triangles; the weld only merges vertices that
# coincide within that distance, so shapes and proportions are kept. build_glb.py thins a part further only when it exceeds its budget.
W = 0.002
STRUCT = {
    "main": [
        ("/SCGMD2B-PRI", "Primary steel", W), ("/SCGMD2B-BRACING", "Bracing", W, "storey"), ("/SCGMD2B-SEC", "Secondary steel", W), ("/SCGMD2B-TRIMMER", "Trimmer steel", W),
        ("/SCGMD2B-PLATING", "Deck plate", W), ("/SCGMD2B-COAMING", "Coaming", W), ("/SCGMD2B-EQUIPMENT-SP", "Equipment supports", W),
        ("/SCGMD2B-STAIR", "Stairs", W, "storey"), ("/SCGMD2B-ACPLTF", "Access platforms", W), ("/SCGMD2B-RAILING", "Railings", W), ("/SCGMD2B-HATCH_COVER", "Hatch covers", W),
        ("/SCGMD2B-PIPE_RACK", "Pipe racks", W), ("/SCGMD2B-PENE", "Penetrations", W), ("/SCGMD2B-MISC", "Miscellaneous steel", W), ("/SCGMD2B-CRANE_BOOM_REST", "Crane boom rest", W),
    ],
    "intermediate": [
        ("/SCGID2B-PRI", "Primary steel", W), ("/SCGID2B-SEC", "Secondary steel", W), ("/SCGID2B-TRIMMER", "Trimmer steel", W), ("/SCGID2B-PLATING", "Deck plate", W),
        ("/SCGID2B-GRATING", "Grating", W), ("/SCGID2B-COAMING", "Coaming", W), ("/SCGID2B-EQUIPSUP", "Equipment supports", W), ("/SCGID2B-BLAST_WALL", "Blast wall", W),
        ("/SCGID2B-MONORAIL", "Monorails", W), ("/SCGID2B-PENE", "Penetrations", W), ("/SCGID2B-RAILING", "Railings", W), ("/SCGID2B-ACPLTF", "Access platforms", W),
        ("/SCGID2B-PIPERACK", "Pipe racks", W), ("/SCGID2B-HATCH", "Hatch covers", W), ("/SCGID2B-EHOUSE", "E-House", W),
    ],
    "cellar": [
        ("/SCGCD2B-PRI", "Primary steel", W), ("/SCGCD2B-SEC", "Secondary steel", W), ("/SCGCD2B-TRIMMER", "Trimmer steel", W), ("/SCGCD2B-PLATING", "Deck plate", W),
        ("/SCGCD2B-GRATING", "Grating", W), ("/SCGCD2B-COAMING", "Coaming", W), ("/SCGCD2B-EQUIPSUP", "Equipment supports", W), ("/SCGCD2B-RAILING", "Railings", W),
        ("/SCGCD2B-ACPLTF", "Access platforms", W), ("/SCGCD2B-HATCH_COVER", "Hatch covers", W), ("/SCGCD2B-LIFTING_LUG", "Lifting lugs", W), ("/SCGCD2B-PENE", "Penetrations", W),
        ("/SCGCD2B-MISC", "Miscellaneous steel", W),
    ],
    "sub-cellar": [
        ("/SCGSD2B-PRI", "Primary steel", W), ("/SCGSD2B-SEC", "Secondary steel", W), ("/SCGSD2B-TRIMMER", "Trimmer steel", W), ("/SCGSD2B-FLOORING", "Deck plate", W),
        ("/SCGSD2B-GRATING", "Grating", W), ("/SCGSDD2B-COAMING", "Coaming", W), ("/SCGSD2B-EQUIP", "Equipment supports", W), ("/SCGS2B-CONDUCTOR-GUIDE", "Conductor guide", W),
        ("/SCGSD2B-ACPLTF", "Access platforms", W), ("/SCGSD2B-HANDRAIL", "Railings", W), ("/SCGSD2B-PENE", "Penetrations", W), ("/SCGSDD2B_MISC", "Miscellaneous steel", W),
    ],
    "dsf": [
        ("/SCGSD2B-DECK_SUPPORT_FRAME_DFS", "Deck support frame", W),
    ],
    "caissons": [
        ("/SCGSDD2B_JK_CAISSON", "Caissons", W), ("/SCGTJD/JACKET/MC", "Caissons", W),
    ],
    "bridge": [
        ("/SBCIDD2B/PRISTR", "Primary steel", W), ("/SBCIDD2B/SECSTR", "Secondary steel", W), ("/SBCIDD2B/GRATING", "Grating", W), ("/SBCIDD2B/PLATING", "Deck plate", W),
        ("/SBCIDD2B/RAILING", "Railings", W), ("/SBCIDD2B/MISC", "Miscellaneous steel", W), ("/XBCIDD2B/PS", "Primary steel", W), ("/XBCIDD2B/SP", "Secondary steel", W),
        ("/XBCIDD2B/TRIM", "Trimmer steel", W), ("/SBCIDK2B/SECSTR", "Secondary steel", W), ("/SBCIDK2B/GRATING", "Grating", W), ("/SBCIDK2B/RAILING", "Railings", W),
    ],
}


def main():
    units = build()
    min_diag = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
    kept = []
    for u in units:
        # drop units whose chosen parts are all tiny (instrument-size items)
        diag = 0.0
        for p in u["parts"]:
            b = p["box"]
            diag = max(diag, ((b[3] - b[0]) ** 2 + (b[4] - b[1]) ** 2 + (b[5] - b[2]) ** 2) ** 0.5)
        if diag < min_diag and u["tag"] not in DECK_BY_TAG:
            continue
        kept.append(u)

    jobs, n = [], 0
    for u in kept:
        for p in u["parts"]:
            n += 1
            p["id"] = "eq%03d" % n
            jobs.append("equip\t%s\t%s\t1\t%s" % (p["id"], p["node"], W))
    structs, sjobs = [], []
    for deck, items in STRUCT.items():
        for i, (node, cat, weld, *flag) in enumerate(items):
            sid = "st_%s_%02d" % (deck.replace("-", ""), i)
            structs.append({"id": sid, "deck": deck, "node": node, "category": cat, "mode": "mesh", **({"split": flag[0]} if flag else {})})
            sjobs.append("equip\t%s\t%s\t1\t%s" % (sid, node, weld))
    (OUT / "jobs_equip.txt").write_text("\n".join(jobs) + "\n", encoding="utf8")
    (OUT / "jobs_struct.txt").write_text("\n".join(sjobs) + "\n", encoding="utf8")
    jobs += sjobs
    (OUT / "jobs.txt").write_text("\n".join(jobs) + "\n", encoding="utf8")
    (OUT / "catalog.json").write_text(json.dumps({"decks": [{"id": d, "name": nm, "elevation": e} for d, nm, e in DECKS], "units": kept, "structure": structs}, indent=1), encoding="utf8")
    by_deck = {}
    for u in kept:
        by_deck.setdefault(u["deck"], []).append(u["tag"])
    for d, t in by_deck.items():
        print(d, len(t), " ".join(t))
    print("jobs:", len(jobs), "units:", len(kept))


if __name__ == "__main__":
    main()
