# 3D model pipeline: Navisworks NWD → per-deck GLB for the web

Turns `../STP-STT2B-CPY_20261110-Claude.nwd` (139 MB, 438,517 geometry items) into seven Draco-compressed GLB files for
Construction → Facility Layout (`app/apps/web/public/models/facility/`, about 61 MB in all):

| Group | Contents |
|---|---|
| Sub-Cellar, Cellar, Intermediate (with the E-House) and Main Deck | primary, secondary and trimmer steel, bracing, coaming, equipment supports, plating, grating, stairs, access platforms, railings, hatch covers, pipe racks, penetrations, miscellaneous steel, and the deck's large equipment |
| DSF | the deck support frame |
| Caissons | the jacket caissons and the equipment hanging in them (PBE-4902A/B, ABH-4901A/B, ABH-6204, PBA-6205) |
| Bridge | trusses, grating, plate, railings |

**Bracing and stairs by storey.** The bracing rows (truss rows) and stairs are modelled in the main-deck zone but run between levels, so
`build_glb.py` deals their triangles out to the deck whose storey they stand in (a storey is the space from a deck's level up to the
next deck's, where that deck's equipment stands; below the sub-cellar level is the DSF). The levels are the decks' nominal elevations in
`catalog.py` (13.5, 18, 26, 34 m) less 0.3 m, and a node opts in with `"storey"` in `STRUCT`.

**Nothing is simplified.** Every triangle of the model is exported with its real shape and proportions; vertices are only welded where
they coincide within 2 mm (23.1 M source triangles → 18.5 M, no visible change). Each equipment is **one part named by its tag**
(`MBD-2501`); where a tag has a vendor model and a placeholder the vendor model wins, among vendor revisions the latest dated one, and
parts parked far from the platform are clipped. Left out are only what is not part of the facility: temporary and stored items
(portable platforms, obstruction volumes, footprints, rigging), piping, cable trays, and instrument-size items.

## How the size comes down without touching the shape

| Step | Size of all decks |
|---|---|
| Same, with 16-bit indices and 8-bit normals (`KHR_mesh_quantization`) | 808 MB |
| **Draco** (`KHR_draco_mesh_compression`, positions to about 1 mm per 60,000-triangle block, normals 8 bit) | **61 MB** |

The Autodesk viewer's glTF loader cannot read Draco, so `app/apps/web/src/dracoGlb.ts` fetches each deck, decodes it with Google's Draco
WebAssembly decoder (`public/vendor/draco`) and gives the viewer a plain GLB as a blob URL. All decks download and decode in parallel
and are shown one by one as each is ready. Other things tried: quantised (int16) positions under a node scale and Draco handed to the
viewer directly both render nothing; instancing identical equipment saves only 5 %.

## Run

Needs Navisworks Manage 2025, the in-box .NET Framework C# 5 compiler (`csc.exe`) and Python with `pip install -r requirements.txt`.

```powershell
# 1. what is in the model (zones and their children), written to out/*.tsv
.\run.ps1 <model.nwd> <commands>.txt      # `children` command: see cmds_extract.txt for the command-file format
# 2. decide decks, equipment tags and structure nodes -> out/jobs.txt, out/catalog.json
python catalog.py
# 3. extract the geometry in a hidden Navisworks (about 6 minutes, 317 MB) -> out/work/
.\run.ps1 <model.nwd> .\cmds_extract.txt
# 4. build the GLBs and the manifest
python build_glb.py ..\..\..\app\apps\web\public\models\facility
# 5. refresh the sheet rows (dates from the Expediting report) in the seed
python ..\..\..\app\apps\api\seed\extract_facility.py
```

`ModelTool.cs` is a Navisworks plugin (`tree`, `props`, `subtree`, `children`, `extract`); `run.ps1` builds it with `build.ps1`, opens the
model through the Navisworks Automation API and runs a command file. `Extract.cs` reads triangles through the COM API in world metres
(the matrix convention is checked against each item's bounding box).

## Windows Smart App Control

`build.ps1` compiles an **unsigned** DLL that Navisworks must load. Windows Smart App Control (or an App Control policy) may refuse it:
the plugin is then "not found". Sign the DLL with a trusted code-signing certificate, or have the machine's owner allow it (Smart App
Control has no allow list: it is on or off). The current files were extracted with Smart App Control off.

## Viewer notes (Autodesk Platform Services Viewer 7, glTF extension)

- Loaded from `developer.api.autodesk.com` with `env: 'Local'`: no APS account, token or Model Derivative translation.
- `loadModel` needs absolute URLs (a path is resolved against the page's own address).
- The glTF model has no instance tree and no dbId → fragment table: node names and ids come from `model.getData().gltf.nodes` and
  `nodeToDbId` (available a moment after the load callback), and `FacilityViewer.tsx` builds the fragment table that theming needs.

## Jacket, LQM and Link Bridge (`Jacket All.nwd`, `LQM2.nwd`, `Link Bridge.nwd`)

The same viewer shows these three beside the topside (Construction → Facility layout, model tabs). Each is split into systems that can be
shown, hidden or highlighted; the 582 MB full-platform model is not processed yet. `run.ps1` now points at Navisworks Manage 2027.

| Model | Systems | How the system of a part is decided |
|---|---|---|
| Jacket | Jacket structure, Piles & conductors, Bridge support, Buoyancy tanks, Flooding system, Mudmat & skirt, Anodes & supports | The BOCAD export carries no part names (“PANEL 235 of SBFRAMEWORK 1 of FRMWORK 2”) under nine fabrication phases, so `classify_models.py` uses where a part stands, its shape and its phase (anodes: the IFC import; buoyancy tanks: the nine cylinders found from their dense ring stiffeners (four vertical at the corners, five horizontal), each with its shell and rings; flooding system: the rest of phase 7, the tanks' outfitting of valves, collars, clamps, short tube sections and vents (the model has no continuous tubing along the legs to pick out); piles and conductors: below the mudline and long vertical tubes) |
| LQM | Structural, Piping, Electrical & instrument, Telecom, HVAC, Architectural, Equipment, Lifting & laydown | The model keeps the discipline folders (`STRUCTURE-LQ2`, `PIPING-LQ2`, `ELECTRICAL & INSTRUMENT-LQ2`, …) and the HVAC and ARC files; `classify_lqm.py` maps them, telecom being the TELECOM / PAGA / SPEAKER / INTERCOM items of the instrument and telecom equipment |
| Link Bridge | Structure, Grating & railing, Piping, Pipe supports, Electrical & instrument | By zone prefix (`SBC` structure, `PBC` piping, `EBC`/`JBC` electrical, `XBC` supports) |

```powershell
.
un.ps1 <model.nwd> out\m\cmd_leaves.txt      # `leaves` (every geometry leaf with its path and box) and `rawleaves` (its triangles)
python classify_models.py jacket                  # or linkbridge; LQM: python classify_lqm.py
python preview_groups.py jacket                   # side / front / top views in the colour of each group, to check the grouping
.
un.ps1 LQM2.nwd out\m\cmd_groups.txt         # LQM only: `groups <outDir> <assign> <cell>` welds each system inside Navisworks (the raw dump is too large)
python build_models.py jacket ..\..\..pppps\web\public\models      # writes <model>/<system>.glb and model.json
```

Jacket 4.6 M triangles in 13.7 MB, Link Bridge 1.5 M in 5.3 MB (Draco, vertices welded within 5 mm).
LQM 1.85 M triangles in 8.8 MB: it holds about 48 M triangles in 42,000 parts, so `groups` leaves out the 17,400 parts under 15 cm (bolts, clamps, straps) and welds the rest on a 2 cm grid (about 5 minutes in Navisworks).

## Jacket groups from the Selection Sets, and the fabrication sequence

`CGF-Jacket.nwd` carries Selection Sets (Pile, Conductor, Caisson, J-tubes, Bridge support, Flooding system, Buoyancy tanks). `ModelTool sets <out.tsv>` exports them
(leaf indexes in the order of `leaves`); `sets_map.py` maps those indexes to `out/m/jacket_leaves.tsv` (the file has 6 leaves fewer than `Jacket All.nwd`,
so they are matched by path, name and box) and writes `out/m/jacket_sets.json`, which `classify_models.py` applies.
`ModelTool timeliner <out.tsv>` lists TimeLiner tasks (the file has none).

    $env:MODELTOOL_DLL = 'ModelTool_b.dll'   # optional: build the plugin under another name when Navisworks still has ModelTool.dll loaded
    .\run.ps1 'E:\...\CGF-Jacket.nwd' cmds.txt   # cmds.txt lines: sets<TAB>E:/.../jacket_sets.tsv (absolute paths, forward slashes)

`build_sequence.py <publicDir>` builds the Construction sequence page: the 22 steps of drawing 2021-4589-65-4015 are in `../Construction sequence/jacket-fabrication-steps.json`
(transcribed from the drawing); each model part is given the step that builds it (from its row, bay and elevation, see the script) and one GLB per step is written to `public/sequence/jacket/`.
