"""Exports the Jacket T&I scene of STT2B_CGF_Jacket_Light.blend for the web app.

Run:  blender -b "<.blend>" --python export_ti_blender.py -- <out_dir>
Writes one Draco GLB per deck (world coordinates at frame 1, Z up converted to glTF Y up) and meta.json with the
animation tracks of the barge, rocker arm, jacket and the four tugs (frame, position, quaternion), in Blender world coordinates.
"""
import bpy, bmesh, json, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
F0 = 1
TRACK_STEP = 5
SEABED = -52.3


def mesh_objs(*cols, roots=()):
    out = []
    for n in cols:
        out += [o for o in bpy.data.collections[n].all_objects if o.type == 'MESH' and not o.hide_viewport and not o.hide_render]
    for r in roots:
        out += [o for o in bpy.data.objects[r].children_recursive if o.type == 'MESH']
    seen, uniq = set(), []
    for o in out:
        if o.name not in seen:
            seen.add(o.name)
            uniq.append(o)
    return uniq


def flatten(objs, name, decimate=None):
    """One mesh object holding every part, in world coordinates, materials kept."""
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        me.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            me.flip_normals()
        ob = bpy.data.objects.new(o.name, me)
        bpy.context.scene.collection.objects.link(ob)
        parts.append(ob)
    if not parts:
        return None
    with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts):
        bpy.ops.object.join()
    ob = parts[0]
    ob.name = name
    if decimate:
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = decimate
    return ob


def colour_materials(ob):
    """The scene tints its materials through a node group (the cinematic depth tint), which the glTF exporter cannot follow: put the plain colour on the Principled BSDF."""
    for slot in ob.material_slots:
        m = slot.material
        if m is None:
            continue
        dc = tuple(m.diffuse_color)
        if not m.use_nodes:
            m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        if not b:
            continue
        inp = b.inputs['Base Color']
        col = dc
        rgb = m.node_tree.nodes.get('BaseColor')
        if rgb is not None and rgb.type == 'RGB':
            col = tuple(rgb.outputs[0].default_value)
        for l in list(m.node_tree.links):
            if l.to_socket == inp:
                m.node_tree.links.remove(l)
        if not inp.is_linked and (inp.default_value[:3] == (0.8, 0.8, 0.8) or rgb is not None):
            inp.default_value = col


def export(ob, name):
    colour_materials(ob)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_cameras=False, export_lights=False, export_animations=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_materials='EXPORT')
    print('EXPORTED', name, len(ob.data.vertices), os.path.getsize(path))
    return path


def bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return [[min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]]


def material(name, rgba):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba
    b.inputs['Alpha'].default_value = rgba[3]
    b.inputs['Roughness'].default_value = 0.8
    try:
        m.surface_render_method = 'BLENDED' if rgba[3] < 1 else 'DITHERED'
    except Exception:
        pass
    return m


def plane(name, cx, cy, z, sx, sy, mat):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(sx, sy, 1), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, z), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    return ob


def sea_grid(name, cx, cy, sx, sy, step, mat, w=0.35):
    """The sea surface as a grid of thin lines at MSL: a solid plane would hide the part of the jacket under water."""
    bm = bmesh.new()
    x0, x1, y0, y1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2
    x = x0
    while x <= x1 + 1e-6:
        c = bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(w, sy, w * 0.5), verts=c['verts'])
        bmesh.ops.translate(bm, vec=(x, cy, 0), verts=c['verts'])
        x += step
    y = y0
    while y <= y1 + 1e-6:
        c = bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(sx, w, w * 0.5), verts=c['verts'])
        bmesh.ops.translate(bm, vec=(cx, y, 0), verts=c['verts'])
        y += step
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    return ob


def box(name, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.translate(bm, vec=(0.5, 0, 0), verts=bm.verts)   # runs along +X from the origin, 1 m long and 1 m square: scaled by the page
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    return ob


LATER = {'BRIDGE_SUPPORT(TOWER)', 'BRIDGE_BUMPER'}
sc.frame_set(F0)
meta = {'fps': sc.render.fps, 'markers': sorted([{'frame': m.frame, 'name': m.name} for m in sc.timeline_markers], key=lambda m: m['frame']),
        'frame_end': sc.frame_end, 'seabed': SEABED, 'decks': {}}

J = 'JACKET_CGF'
single = lambda n: [bpy.data.objects[n]]
decks = {
    # the bridge tower (and its bumper) is installed after the piling: only the landing support of the bridge is on the jacket in this phase
    'jacket': ([o for o in mesh_objs('1_Primary_structure', '4_Mudmat', '5_Appurtenances', '6_Bridge_support', '7_Walkway', '8_Anodes') if o.name not in LATER], J, None),
    'cradle': (mesh_objs('2_Launch_truss_cradle'), J, None),
    'tank-a2': (single('BUOYANCY_TANK_A2'), J, None), 'tank-a5': (single('BUOYANCY_TANK_A5'), J, None),
    'tank-c2': (single('BUOYANCY_TANK_C2'), J, None), 'tank-c5': (single('BUOYANCY_TANK_C5'), J, None),
    'barge': (mesh_objs('BRG_1_Hull', 'BRG_2_Skidway', 'BRG_4_Deck_equipment', 'BRG_5_Mooring_outfitting', 'BRG_6_Construction_aids'), 'BARGE_HOLMEN_PACIFIC', None),
    'rocker': (mesh_objs('BRG_3_Rocker_arm'), 'ROCKER_PIVOT', None),
}
decks['tug-0'] = (mesh_objs(roots=['ENA_Jade_ROOT']), 'ENA_Jade_ROOT', None)
for i in range(1, 5):
    decks['tug-%d' % i] = (mesh_objs(roots=['T%d_ENA_Jade_ROOT' % i]), 'T%d_ENA_Jade_ROOT' % i, None)   # the supply-boat model (ENA Jade), one colour per tug
hook = [o for o in bpy.data.objects['pasted__hOOK.001'].children_recursive if o.type == 'MESH']
hook_names = {o.name for o in hook}
# the hull and the boom are separate decks: the crane slews about its base on the vessel's root, so the page can swing the boom over the side
# The crane is one piece: house, mast, boom and head turn together on the round pedestal, which stays on the hull. The hoist rope of the model is left
# out: the page draws it from the boom tip to the hook, wherever they are.
ROPES = {'pasted__polySurface379.002', 'pasted__polySurface382.003', 'pasted__polySurface384.002', 'pasted__polySurface386.002', 'pasted__polySurface388.003'}


crane_meshes = [o for o in mesh_objs('SK3500_MAINCRANE_HD') if o.name not in hook_names and o.name not in ROPES]
decks['vessel'] = (mesh_objs('SK3500_BODY_HD'), None, 0.3)
decks['crane'] = (crane_meshes, None, 0.3)   # the pedestal ring turns about its own axis with it, which cannot be seen
decks['hook'] = (hook, None, None)
jacket_parts = [o.name for k in ('jacket', 'cradle', 'tank-a2', 'tank-a5', 'tank-c2', 'tank-c5') for o in decks[k][0]]

rest = {}
for name, (objs, root, dec) in decks.items():
    root_m = bpy.data.objects[root].matrix_world.copy() if root else None
    ob = flatten(objs, name, dec)
    if ob is None:
        print('EMPTY', name)
        continue
    bb = bbox(ob)
    export(ob, name)
    meta['decks'][name] = {'root': root, 'bbox': bb, 'file': name + '.glb'}
    if root:
        rest[root] = root_m

bed = material('Seabed', (0.55, 0.47, 0.34, 1))
for nm, cx, cy, sx, sy in (('seabed-launch', 150, -118, 520, 300), ('seabed-install', 1111, -2026, 420, 420)):
    p = plane(nm, cx, cy, SEABED, sx, sy, bed)
    export(p, nm)
    meta['decks'][nm] = {'root': None, 'bbox': bbox(p), 'file': nm + '.glb'}
ln = box('line', material('Line', (0.08, 0.08, 0.08, 1)))
export(ln, 'line')
meta['decks']['line'] = {'root': None, 'bbox': bbox(ln), 'file': 'line.glb'}

# ---- reference data (the original objects are still there: only copies were joined)
Jo = bpy.data.objects[J]
inv = Jo.matrix_world.inverted()


def local_bb(names):
    pts = []
    for n in names:
        o = bpy.data.objects[n]
        pts += [inv @ (o.matrix_world @ Vector(c)) for c in o.bound_box]
    return [[round(min(p[i] for p in pts), 2) for i in range(3)], [round(max(p[i] for p in pts), 2) for i in range(3)]]


meta['jacket_local_bbox'] = local_bb(jacket_parts)
zlow = meta['jacket_local_bbox'][0][2]
bot = [inv @ (o.matrix_world @ v.co) for n in jacket_parts for o in [bpy.data.objects[n]] for v in o.data.vertices]
bot = [p for p in bot if p.z < zlow + 1.5]
meta['bottom_rect'] = [[round(min(p.x for p in bot), 2), round(min(p.y for p in bot), 2)], [round(max(p.x for p in bot), 2), round(max(p.y for p in bot), 2)], round(zlow, 2)]
meta['padeye_local_bbox'] = local_bb(['UPENDING_PADEYE'])
hbs = [bbox(bpy.data.objects[n]) for n in hook_names]
meta['hook_rest_bbox'] = [[min(b[0][i] for b in hbs) for i in range(3)], [max(b[1][i] for b in hbs) for i in range(3)]]
meta['crane_root'] = list(bpy.data.objects['SK3500_ROOT'].matrix_world.translation)
meta['crane_bbox'] = meta['decks']['vessel']['bbox']
rt = bpy.data.objects['SK3500_ROOT'].matrix_world.translation
import math
heading = math.degrees(bpy.data.objects['SK3500_ROOT'].matrix_world.to_euler().z) + 180.0   # direction of the vessel's long axis (the boom lies along it)


def centre(names):
    pts = []
    for n in names:
        o = bpy.data.objects[n]
        for c in [o] + list(o.children_recursive):
            if c.type == 'MESH':
                pts += [c.matrix_world @ Vector(v) for v in c.bound_box]
    return [round((min(p[i] for p in pts) + max(p[i] for p in pts)) / 2, 2) for i in range(3)]


ax = Vector((math.cos(math.radians(heading)), math.sin(math.radians(heading)), 0))
bx = Vector((-ax.y, ax.x, 0))
hull_half = 0.0
for o in bpy.data.collections['SK3500_BODY_HD'].all_objects:
    if o.type == 'MESH':
        for v in o.data.vertices:
            hull_half = max(hull_half, abs(((o.matrix_world @ v.co) - rt).dot(bx)))
# the pedestal's axis: a circle through the lowest vertices of the crane (its round base)
ped = [o.matrix_world @ v.co for o in crane_meshes for v in o.data.vertices]
ped = [p for p in ped if p.z < 4]
n = len(ped)
sx = sum(p.x for p in ped) / n
sy = sum(p.y for p in ped) / n
# algebraic circle fit (Kasa) about the mean
suu = suv = svv = suuu = svvv = suvv = svuu = 0.0
for p in ped:
    uu, vv = p.x - sx, p.y - sy
    suu += uu * uu; suv += uu * vv; svv += vv * vv; suuu += uu ** 3; svvv += vv ** 3; suvv += uu * vv * vv; svuu += vv * uu * uu
det = suu * svv - suv * suv
cu = (svv * (suuu + suvv) / 2 - suv * (svvv + svuu) / 2) / det
cv = (suu * (svvv + svuu) / 2 - suv * (suuu + suvv) / 2) / det
meta['crane_pivot'] = [round(sx + cu, 2), round(sy + cv, 2), 0.0]
meta['crane_tip'] = centre(['group581.002', 'group581.003'])   # the sheaves at the boom tip, which the hook hangs from
hull_u = [1e9, -1e9]
for o in bpy.data.collections['SK3500_BODY_HD'].all_objects:
    if o.type == 'MESH':
        for v in o.data.vertices:
            uu = ((o.matrix_world @ v.co) - rt).dot(ax)
            hull_u = [min(hull_u[0], uu), max(hull_u[1], uu)]
meta['hull_u_range'] = [round(x, 2) for x in hull_u]
meta['crane_heading'] = round(heading, 3)
meta['hull_half_width'] = round(hull_half, 2)
meta['hook_rest_center'] = [round((meta['hook_rest_bbox'][0][i] + meta['hook_rest_bbox'][1][i]) / 2, 2) for i in range(3)]

meta['towpoints'] = {str(i): [round(x, 3) for x in (inv @ bpy.data.objects['JKT_TOWPOINT_%d' % i].matrix_world.translation)] for i in range(1, 5)}
points = {'line1': 'TUG_1_LINE_END', 'line2': 'TUG_2_LINE_END', 'line3': 'TUG_3_LINE_END', 'line4': 'TUG_4_LINE_END',
          'mainStern': 'TUG_MAIN_TOW_STERN', 'apex': 'TOW_BRIDLE_APEX', 'fairP': 'TOW_BOW_FAIRLEAD_P', 'fairS': 'TOW_BOW_FAIRLEAD_S'}
roots = {'tug-0': 'TUG_MAIN_TOW', 'jacket': J, 'barge': 'BARGE_HOLMEN_PACIFIC', 'rocker': 'ROCKER_PIVOT', 'tug-1': 'TUG_1', 'tug-2': 'TUG_2',
         'tug-3': 'TUG_3', 'tug-4': 'TUG_4'}
frames = sorted(set(list(range(1, 4100, TRACK_STEP)) + list(range(4100, sc.frame_end + 1, 25)) + [sc.frame_end] + [m.frame for m in sc.timeline_markers]))
meta['frames'] = frames
tr = {k: [] for k in roots}
for f in frames:
    sc.frame_set(f)
    for k, r in roots.items():
        M = bpy.data.objects[r].matrix_world
        t = M.translation
        q = M.to_quaternion()
        tr[k].append([round(t.x, 3), round(t.y, 3), round(t.z, 3), round(q.w, 5), round(q.x, 5), round(q.y, 5), round(q.z, 5)])
meta['tracks'] = tr
pt = {k: [] for k in points}
for f in frames:
    sc.frame_set(f)
    for k, n in points.items():
        t = bpy.data.objects[n].matrix_world.translation
        pt[k].append([round(t.x, 3), round(t.y, 3), round(t.z, 3)])
meta['points'] = pt
for n in ('TUG_MAIN_TOW', 'TUG_1', 'TUG_2', 'TUG_3', 'TUG_4'):
    rest[n] = Matrix.Identity(4)   # the tug models are exported in their own pose at the origin: the TUG_n empties carry the motion
rest['TUG_MAIN_TOW'] = Matrix.Identity(4)   # the lead tug's model is exported in its own pose, at the origin
meta['rest'] = {k: [list(map(float, row)) for row in rest[v]] for k, v in roots.items() if v in rest}
with open(os.path.join(OUT, 'meta.json'), 'w') as fh:
    json.dump(meta, fh)
print('DONE', len(frames), 'frames')
