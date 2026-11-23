"""Assigns every geometry leaf of LQM2.nwd (in the order of out/m/lqm_leaves.tsv) to a discipline group.

    python classify_lqm.py   ->  out/m/lqm_assign.txt (one group id per leaf) and a count per group
"""
import collections
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from leaves import load  # noqa: E402

TELECOM = re.compile(r"TELECOM|PAGA|SPEAKER|INTERCOM|KUBAND|CCTV|\bTEL\b|PAGE", re.I)


def group(path: str, name: str) -> str:
    p = path.split(" > ")
    src = p[2] if len(p) > 2 else ""
    if "HVAC.nwd" in src:
        return "hvac"
    if "ARC.nwd" in src:
        return "architectural"
    if "LQSTT_16" in src:
        return "structural"
    if "SLING" in src or "LAYDOWN" in src:
        return "lifting"
    full = path + " > " + name
    if "LQ_STT_PHASE 2 > LQ_STT_PHASE 2" in path:
        d = p[5] if len(p) > 5 else ""
        sub = p[6] if len(p) > 6 else ""
        if d.startswith("ELECTRICAL & INSTRUMENT"):
            return "telecom" if TELECOM.search(" ".join(p[6:9])) else "e_i"
        if d.startswith("PIPING") or d == "DECK SCUPPER":
            return "piping"
        if d.startswith("STRUCTURE") or d.startswith("SUPPORT") or d == "SAFETY":
            return "structural"
        if d.startswith("HVAC"):
            return "hvac"
        if d == "ARC":
            return "architectural"
        if d.startswith("EQUIPMENT"):
            return "equipment"
        return "other"
    top = p[3] if len(p) > 3 else ""
    if re.search(r"PS-XLQ|SP-XLQ", top):
        return "piping"
    if "AirCooler" in top or "AFDS" in full or "HVAC" in top:
        return "hvac"
    if re.search(r"JUNCTION BOX|ZEL-|ZEC-|ZET-", top + full):
        return "e_i"
    if "ACCU" in top:
        return "equipment"
    return "other"


if __name__ == "__main__":
    rows = load(str(Path(__file__).parent / "out" / "m" / "lqm_leaves.tsv"))
    out = [group(r["path"], r["name"]) for r in rows]
    Path(__file__).parent.joinpath("out", "m", "lqm_assign.txt").write_text("\n".join(out), encoding="utf8")
    for k, v in collections.Counter(out).most_common():
        print(v, k)
