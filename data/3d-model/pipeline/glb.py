"""Minimal GLB writer (numpy only): a node tree of named meshes with flat colour materials."""
import json
import struct
import time

import numpy as np


def _pad(b: bytes, fill: bytes = b"\x00") -> bytes:
    return b + fill * ((4 - len(b) % 4) % 4)


class GlbBuilder:
    def __init__(self, draco=False):
        self.draco = draco  # compress every primitive with Draco (KHR_draco_mesh_compression); the web page decodes it before the viewer sees it
        self.buf = bytearray()
        self.views, self.accessors, self.meshes, self.materials, self.nodes = [], [], [], [], []
        self._mat = {}
        self._q = {}  # mesh index -> (centre, half extent) of a quantised mesh; its node carries the inverse
        self.quantized = False

    def _view(self, data: bytes, target=None) -> int:
        while len(self.buf) % 4:
            self.buf.append(0)
        v = {"buffer": 0, "byteOffset": len(self.buf), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.buf += data
        self.views.append(v)
        return len(self.views) - 1

    def _acc(self, view, ctype, count, atype, **extra) -> int:
        a = {"componentType": ctype, "count": count, "type": atype}
        if view is not None:
            a["bufferView"] = view
        a.update(extra)
        self.accessors.append(a)
        return len(self.accessors) - 1

    def material(self, rgba, name=None, metallic=0.1, rough=0.8, double=True) -> int:
        key = (tuple(round(float(c), 3) for c in rgba), metallic, rough)
        if key not in self._mat:
            self.materials.append({
                "name": name or "mat%d" % len(self.materials),
                "pbrMetallicRoughness": {"baseColorFactor": [float(c) for c in rgba], "metallicFactor": metallic, "roughnessFactor": rough},
                "doubleSided": double,
                **({"alphaMode": "BLEND"} if rgba[3] < 0.999 else {}),
            })
            self._mat[key] = len(self.materials) - 1
        return self._mat[key]

    def mesh(self, positions, normals, indices, material, quantize="normals", block=21000) -> int:
        """One mesh as several primitives of at most `block` triangles each, so the indices fit 16 bits.

        quantize "normals" (default): float positions, normals as int8 (KHR_mesh_quantization). "all" would also store positions as int16
        under a node scale, but the Autodesk viewer then draws nothing or garbage whatever min/max and scale are written, so it is not used.
        normals=None leaves the normals out. quantize False: float normals too.
        """
        positions = np.asarray(positions, dtype=np.float64)
        faces = np.asarray(indices).reshape(-1, 3)
        lo, hi = positions.min(axis=0), positions.max(axis=0)
        centre = (lo + hi) / 2
        half = max(float((hi - lo).max()) / 2, 1e-6)  # one scale for all axes: the viewer culls by bounds and mishandles a non-uniform node scale
        if self.draco:
            return self._draco_mesh(positions, normals, faces, material)
        prims = []
        for b in range(0, len(faces), block):
            f = faces[b:b + block]
            used, inv = np.unique(f, return_inverse=True)
            p = positions[used]
            if quantize == "all":
                q = np.rint((p - centre) / half * 32767).astype("<i2")
                pv = self._view(q.tobytes(), 34962)
                pa = self._acc(pv, 5122, len(q), "VEC3", normalized=True, min=(q.min(axis=0) / 32767).tolist(), max=(q.max(axis=0) / 32767).tolist())
            else:
                p32 = p.astype(np.float32)
                pv = self._view(p32.tobytes(), 34962)
                pa = self._acc(pv, 5126, len(p32), "VEC3", min=p32.min(axis=0).tolist(), max=p32.max(axis=0).tolist())
            attrs = {"POSITION": pa}
            if normals is not None:
                n = np.asarray(normals)[used]
                if quantize == "all":
                    n4 = np.zeros((len(n), 4), dtype=np.int8)
                    n4[:, :3] = np.rint(n * 127).astype(np.int8)
                    nv = self._view(n4.tobytes(), 34962)
                    self.views[nv]["byteStride"] = 4
                    attrs["NORMAL"] = self._acc(nv, 5120, len(n), "VEC3", normalized=True)
                else:
                    nv = self._view(np.ascontiguousarray(n, dtype=np.float32).tobytes(), 34962)
                    attrs["NORMAL"] = self._acc(nv, 5126, len(n), "VEC3")
            ix = inv.reshape(-1).astype(np.uint16)
            ia = self._acc(self._view(ix.tobytes(), 34963), 5123, len(ix), "SCALAR")
            prims.append({"attributes": attrs, "indices": ia, "material": material, "mode": 4})
        if quantize and normals is not None:
            self.quantized = True
        self.meshes.append({"primitives": prims})
        if quantize == "all":
            self._q[len(self.meshes) - 1] = (centre, np.array([half, half, half]))
        return len(self.meshes) - 1

    def _draco_mesh(self, positions, normals, faces, material, block=60000, bits=16) -> int:
        """Draco primitives of `block` triangles; positions keep `bits` bits per axis within each primitive's own bounding box (1.2 mm
        at 80 m for 16 bits), normals 8 bits. Indices and attributes are float / uint32 once decoded."""
        import DracoPy
        prims = []
        for b in range(0, len(faces), block):
            f = faces[b:b + block]
            used, inv = np.unique(f, return_inverse=True)
            p = positions[used].astype(np.float32)
            n = np.asarray(normals, dtype=np.float64)[used]
            blob = DracoPy.encode(p, inv.reshape(-1, 3).astype(np.uint32), quantization_bits=bits, compression_level=7, normals=n, normal_quantization_bits=8)
            bv = self._view(blob)
            pa = self._acc(None, 5126, len(p), "VEC3", min=p.min(axis=0).tolist(), max=p.max(axis=0).tolist())
            na = self._acc(None, 5126, len(p), "VEC3")
            ia = self._acc(None, 5125, inv.size, "SCALAR")
            prims.append({"attributes": {"POSITION": pa, "NORMAL": na}, "indices": ia, "material": material, "mode": 4,
                          "extensions": {"KHR_draco_mesh_compression": {"bufferView": bv, "attributes": {"POSITION": 0, "NORMAL": 1}}}})
        self.meshes.append({"primitives": prims})
        return len(self.meshes) - 1

    def node(self, name, mesh=None, children=None, extras=None) -> int:
        n = {"name": name}
        if mesh is not None:
            n["mesh"] = mesh
            if mesh in self._q:
                c, h = self._q[mesh]
                n["translation"] = [float(x) for x in c]
                n["scale"] = [float(x) for x in h]
        if children:
            n["children"] = children
        if extras:
            n["extras"] = extras
        self.nodes.append(n)
        return len(self.nodes) - 1

    def write(self, path, roots):
        doc = {
            "asset": {"version": "2.0", "generator": "projectflow-model-pipeline"},
            "scene": 0,
            "scenes": [{"nodes": roots}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.buf)}],
        }
        if self.quantized:
            doc["extensionsUsed"] = ["KHR_mesh_quantization"]
            doc["extensionsRequired"] = ["KHR_mesh_quantization"]
        if self.draco:
            doc["extensionsUsed"] = ["KHR_draco_mesh_compression"]
            doc["extensionsRequired"] = ["KHR_draco_mesh_compression"]
        js = _pad(json.dumps(doc, separators=(",", ":")).encode(), b" ")
        bn = _pad(bytes(self.buf))
        data = b"".join([
            struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)),
            struct.pack("<II", len(js), 0x4E4F534A), js,
            struct.pack("<II", len(bn), 0x004E4942), bn,
        ])
        # The folder is synced by Google Drive, which can hold a file for a moment after it was written: retry.
        for attempt in range(20):
            try:
                with open(path, "wb") as f:
                    f.write(data)
                return
            except OSError:
                if attempt == 19:
                    raise
                time.sleep(1.5)


def shaded(positions: np.ndarray, faces: np.ndarray, crease: float = 40.0):
    """Normals that keep hard edges hard: a corner shares its vertex's smooth normal when the face is within `crease` degrees of it,
    and otherwise gets a vertex of its own with the face normal. Returns (positions, normals, faces) with degenerate faces dropped."""
    p = np.asarray(positions, dtype=np.float64)
    f = np.asarray(faces, dtype=np.int64).reshape(-1, 3)
    fn = np.cross(p[f[:, 1]] - p[f[:, 0]], p[f[:, 2]] - p[f[:, 0]])
    area = np.linalg.norm(fn, axis=1)
    keep = area > 1e-16
    f, fn, area = f[keep], fn[keep], area[keep]
    un = fn / area[:, None]
    n = len(p)
    vs = np.stack([sum(np.bincount(f[:, k], weights=fn[:, c], minlength=n) for k in range(3)) for c in range(3)], axis=1)
    ln = np.linalg.norm(vs, axis=1, keepdims=True)
    ln[ln == 0] = 1
    vn = vs / ln
    smooth = np.stack([np.einsum("ij,ij->i", vn[f[:, k]], un) >= np.cos(np.radians(crease)) for k in range(3)], axis=1)
    out_f = f.copy()
    extra_p, extra_n = [], []
    base = n
    for k in range(3):
        hard = ~smooth[:, k]
        cnt = int(hard.sum())
        out_f[hard, k] = base + np.arange(cnt)
        extra_p.append(p[f[hard, k]])
        extra_n.append(un[hard])
        base += cnt
    P = np.concatenate([p] + extra_p)
    N = np.concatenate([vn] + extra_n)
    used = np.unique(out_f)
    remap = np.full(len(P), -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    return P[used], N[used], remap[out_f]
