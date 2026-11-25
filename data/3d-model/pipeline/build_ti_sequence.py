"""Builds the offshore T&I sequence of the ST-CGF jacket for T&I -> Sequence.

    python build_ti_sequence.py <publicDir>          e.g. ... ../../../app/apps/web/public

Inputs
  out/ti/*.glb, out/ti/meta.json       from export_ti_blender.py (the Blender scene: jacket, launch barge, tugs, SK3500 crane vessel and its
                                       animation of the tow, the launch and the tow to the upending position, sampled per frame)
  Construction sequence/jacket-ti-stages.json   the stage tables of the launch and of the floatation & upending drawings
Output
  <publicDir>/sequence/ti/*.glb and sequence.json (decks, animation tracks, the steps of the sequence, the stage tables).

The Blender animation covers the barge arriving, the tugs connecting, the trim, the six launch stages, the barge being towed away and the
tow of the floating jacket to the upending location. The upending itself (floatation, hook-up, flooding, nine stages) is not animated in the
scene: the page poses the jacket from the stage table (hook height, pitch, seabed clearance, flooding), as the drawing shows each stage.
"""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out" / "ti"
STAGES = HERE.parent / "Construction sequence" / "jacket-ti-stages.json"

GROUPS = [
    {"id": "jacket", "name": "Jacket", "color": "#cc8d12"},
    {"id": "cradle", "name": "Launch truss and cradle", "color": "#d95a1c"},
    {"id": "tanks", "name": "Buoyancy tanks", "color": "#2b6cb8"},
    {"id": "barge", "name": "Launch barge", "color": "#6c7b90"},
    {"id": "tug", "name": "Tugs", "color": "#c0392b"},
    {"id": "crane", "name": "Crane vessel SK3500", "color": "#e0b341"},
    {"id": "water", "name": "Sea and seabed", "color": "#2a7ab8"},
]
DECKS = [
    ("jacket", "Jacket", "jacket"), ("cradle", "Launch truss and cradle", "cradle"),
    ("tank-a2", "Buoyancy tank A2", "tanks"), ("tank-a5", "Buoyancy tank A5", "tanks"),
    ("tank-c2", "Buoyancy tank C2", "tanks"), ("tank-c5", "Buoyancy tank C5", "tanks"),
    ("barge", "Launch barge", "barge"), ("rocker", "Rocker arm", "barge"),
    ("tug-0", "Lead tug", "tug"), ("tug-1", "Tug 1", "tug"), ("tug-2", "Tug 2", "tug"), ("tug-3", "Tug 3", "tug"), ("tug-4", "Tug 4", "tug"),
    ("vessel", "Crane vessel SK3500", "crane"), ("crane", "Crane", "crane"), ("hook", "Main hook", "crane"),
    ("seabed-launch", "Seabed at the launch site", "water"),
]
UPEND_AZ = 20  # the crane vessel lies on the +Y side of the jacket (Blender), i.e. on the -Z side in the viewer: look from the other side so that the hull does not hide the jacket
LINES = 40  # a pool of thin boxes the page stretches between two points: tow lines, slings and the crane rope


def marker(meta, name):
    for m in meta["markers"]:
        if m["name"] == name:
            return m["frame"]
    raise KeyError(name)


def main(public: Path) -> None:
    meta = json.loads((OUT / "meta.json").read_text(encoding="utf8"))
    st = json.loads(STAGES.read_text(encoding="utf8"))
    dest = public / "sequence" / "ti"
    dest.mkdir(parents=True, exist_ok=True)
    for f in dest.glob("*.glb"):
        f.unlink()
    for name, _, _ in DECKS:
        shutil.copy(OUT / f"{name}.glb", dest / f"{name}.glb")
    shutil.copy(OUT / "line.glb", dest / "line.glb")

    mk = lambda n: marker(meta, n)
    launch = {s["no"]: mk(s["marker"]) for s in st["launch"]["stages"]}
    f_tug3, f_tug4 = mk("Tug#3 receives tow line"), mk("Tug#4 receives tow line")
    f_tug1, f_tug2 = mk("Tug#1 receives tow line"), mk("Tug#2 receives tow line")
    f_slack, f_away, f_tow = mk("Step3 Jacket floating level - tugs pick up slack"), mk("Barge towed away"), mk("Tow jacket via corridor to EN3000 (time-lapse)")  # the jacket stays where it is launched: the scene's tow to the crane vessel is not used
    f_trim, f_station, f_end = mk("Ballast to launch trim"), mk("All tugs on station"), meta["frame_end"]
    f_arrive = 1

    def step(no, phase, title, text, seconds, view, **kw):
        d = {"no": no, "phase": phase, "title": title, "text": text, "seconds": seconds, "view": view}
        d.update(kw)
        return d

    steps = [
        step(1, "transport", "Barge arrives under tow with the jacket", [
            "The launch barge, carrying the jacket on its skid ways, is towed to the launch location by the lead tug.",
            "Water depth at the launch location is 52.30 m (LAT); the barge mean draft is 4.48 m."], 7,
            {"target": "barge", "dist": 330, "az": 25, "el": 16}, frames=[f_arrive, mk("Tug#1 approach stern STBD")]),
        step(2, "transport", "Tugs 1 and 2 approach and connect", [
            "Tug 1 approaches the stern on the starboard side and receives its tow line.",
            "Tug 2 approaches the stern on the port side and receives its tow line."], 8,
            {"target": "barge", "dist": 560, "az": 25, "el": 34}, frames=[mk("Tug#1 approach stern STBD"), f_tug2]),
        step(3, "transport", "Tugs 3 and 4 connect, all tugs on station", [
            "Tugs 3 and 4 take position on the port and starboard quarters and receive their lines.",
            "All four tugs are on station and hold the barge for the launch."], 9,
            {"target": "barge", "dist": 560, "az": 25, "el": 34}, frames=[f_tug2, f_station]),
        step(4, "transport", "Ballast the barge to launch trim", [
            "OIC ballasts the barge to the launch trim and draft (final trim and draft are decided by OIC).",
            "The barge is trimmed by the stern so that the jacket can slide along the skid ways under the winch pull."], 6,
            {"target": "barge", "dist": 280, "az": 15, "el": 8}, frames=[f_station, launch[1]]),
    ]
    names = {s["no"]: s for s in st["launch"]["stages"]}
    ldur = {1: 14, 2: 4, 3: 5.5, 4: 4, 5: 12, 6: 2}
    lend = {1: launch[2], 2: launch[3], 3: launch[4], 4: launch[5], 5: launch[6], 6: f_slack}
    sm = st["launch"]["summary"]
    pin = names[2]["pin_reaction_mt"]
    ltext = {
        1: [f"Winch pulls the jacket along the skid ways towards the stern; the jacket weight ({sm['jacket_weight_mt']} MT) rests on the skid ways and the rocker arm.",
            "Launch results are for a dynamic friction of 0.05 and a winch speed of 0.30 m/s."],
        2: ["The jacket reaches the rocker arm pins and tips: the rocker arm rotates about its pivot.", f"Maximum pin reaction: {pin['port']} MT port ({pin['port_extreme']} MT extreme), {pin['stbd']} MT starboard ({pin['stbd_extreme']} MT extreme)."],
        3: ["The jacket slides off the rocker arm and enters the water; the stern of the barge reaches its maximum submergence."],
        4: ["The jacket separates from the barge and rotates about its own centre of buoyancy in the water."],
        5: [f"The jacket is at its minimum clearance from the seabed, {sm['min_seabed_clearance_m']:.2f} m (water depth 52.30 m LAT).", f"Maximum pin reaction during the launch: {sm['max_pin_reaction_mt']} MT."],
        6: [f"The jacket settles to its floating position. Jacket buoyancy {sm['jacket_buoyancy_mt']} MT against a weight of {sm['jacket_weight_mt']} MT: minimum reserve buoyancy {sm['min_reserve_buoyancy_pct']}%."],
    }
    for n in range(1, 7):
        stg = names[n]
        steps.append(step(4 + n, "launch", f"Launch stage {n}: {stg['name']}", ltext[n] + [f"Drawing time {stg['time_s']:g} s" + (f", jacket velocity {stg['velocity_m_s']:g} m/s." if stg["velocity_m_s"] is not None else ".")], ldur[n],
                          {"target": "jacket", "dist": 240 if n < 4 else 200, "az": 15, "el": 8}, frames=[launch[n], lend[n]], launch_stage=n))
    steps += [
        step(11, "transport", "Jacket floats level, tugs pick up the slack", [
            "The jacket floats level and the tugs take up their lines on the jacket; the barge is released."], 4,
            {"target": "jacket", "dist": 220, "az": 25, "el": 14}, frames=[f_slack, f_away]),
        step(12, "transport", "Barge towed away", ["The launch barge, under tow by the lead tug, is towed clear of the jacket."], 6,
             {"target": "jacket", "dist": 260, "az": 25, "el": 14}, frames=[f_away, f_tow]),
        step(13, "arrive", "Crane vessel moves in alongside the jacket", [
            "The jacket stays where it was launched, held by the four tugs. The tugs on the crane side open up to give way.",
            "The crane vessel SK3500 comes in with the launch barge gone, and takes position parallel to the jacket, clear of it, with its crane stowed along the hull."], 12,
             {"target": "vessel", "dist": 380, "az": 30, "el": 24}, frames=[f_tow, f_tow]),
        step(14, "hookup", "Crane reaches out over the jacket, slings connected", [
            "The crane slews its boom over the side until the hook is above the lifting padeyes; the vessel stays clear of the jacket.",
            "The main hook is lowered and the four lifting slings (rows A2, A5, C2 and C5) are connected to the upending padeyes; the jacket floats freely with the slings connected."], 12,
             {"target": "jacket", "dist": 260, "az": UPEND_AZ, "el": 20}, upend=[-1, 0]),
    ]
    for s in st["upending"]["stages"][1:]:
        steps.append(step(14 + s["no"], "upend", f"Upending stage {s['no']}: {s['name']}", s["actions"], 7 if s["no"] < 9 else 5,
                          {"target": "jacket", "dist": 230, "az": UPEND_AZ, "el": 12}, upend=[s["no"] - 1, s["no"]]))

    tracks = {k: [v for row in rows for v in row] for k, rows in meta["tracks"].items()}  # flat: x y z qw qx qy qz
    bodies = {k: {"rest": [round(x, 5) for row in meta["rest"][k] for x in row] if k in meta["rest"] else None, "track": tracks[k]} for k in tracks}
    out = {
        "source": "Offshore T&I of the ST-CGF jacket: launch (2021-4589-66-0007), floatation & upending (2021-4589-66-0009), and the Blender scene STT2B_CGF_Jacket_Light.blend",
        "fps": meta["fps"], "seabed": meta["seabed"], "frames": meta["frames"], "markers": meta["markers"],
        "groups": GROUPS,
        "decks": [{"id": n, "name": t, "file": f"{n}.glb", "group": g} for n, t, g in DECKS],
        "lineDeck": {"file": "line.glb", "count": LINES},
        "bodies": bodies,
        "points": {k: [v for row in rows for v in row] for k, rows in meta["points"].items()},
        "towpoints": meta["towpoints"],
        "jacket": {"localBBox": meta["jacket_local_bbox"], "bottomRect": meta["bottom_rect"], "padeyeBBox": meta["padeye_local_bbox"]},
        "crane": {"root": meta["crane_root"], "pivot": meta["crane_pivot"], "hullU": meta["hull_u_range"], "tip": meta["crane_tip"], "heading": meta["crane_heading"], "hullHalfWidth": meta["hull_half_width"], "hookRestCenter": meta["hook_rest_center"]},
        "framesOf": {"tug1": f_tug1, "tug2": f_tug2, "tug3": f_tug3, "tug4": f_tug4, "trim": f_trim, "slack": f_slack, "away": f_away, "tow": f_tow},
        "launch": st["launch"], "upending": st["upending"], "steps": steps,
    }
    (dest / "sequence.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf8")
    print("wrote", dest / "sequence.json", len(steps), "steps", round((dest / "sequence.json").stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
