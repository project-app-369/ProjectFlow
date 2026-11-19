/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The facility GLB files are Draco-compressed (about 12x smaller to download). The Autodesk viewer's glTF loader does not decode
 * Draco, so the page fetches each file, decodes it here with Google's Draco WebAssembly decoder (served from /vendor/draco) and hands
 * the viewer an ordinary uncompressed GLB as a blob URL.
 */

const DRACO_BASE = `${import.meta.env.BASE_URL}vendor/draco/`;

let decoder: Promise<any> | null = null;
function loadDecoder(): Promise<any> {
  decoder ??= (async () => {
    const [wasm] = await Promise.all([
      fetch(`${DRACO_BASE}draco_decoder.wasm`).then(r => { if (!r.ok) throw new Error('The Draco decoder is missing.'); return r.arrayBuffer(); }),
      new Promise<void>((resolve, reject) => {
        if ((window as any).DracoDecoderModule) { resolve(); return; }
        const s = document.createElement('script');
        s.src = `${DRACO_BASE}draco_wasm_wrapper.js`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('The Draco decoder could not be loaded.'));
        document.head.appendChild(s);
      }),
    ]);
    return (window as any).DracoDecoderModule({ wasmBinary: wasm });
  })().catch(e => { decoder = null; throw e; });
  return decoder;
}

interface Chunk { json: any; bin: Uint8Array }

function parseGlb(buf: ArrayBuffer): Chunk {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file.');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen;
  const binLen = dv.getUint32(binStart, true);
  return { json, bin: new Uint8Array(buf, binStart + 8, binLen) };
}

const pad4 = (n: number) => (n + 3) & ~3;

/** Returns the uncompressed GLB as bytes. A file without Draco primitives passes through unchanged. */
export async function decodeDracoGlb(buf: ArrayBuffer, onStep?: (done: number, total: number) => void): Promise<Uint8Array> {
  const { json, bin } = parseGlb(buf);
  if (!(json.extensionsRequired ?? []).includes('KHR_draco_mesh_compression')) return new Uint8Array(buf);
  const draco = await loadDecoder();
  const dec = new draco.Decoder();
  const parts: Uint8Array[] = [];
  let length = 0;
  const views: any[] = [];
  const accessors: any[] = [];
  const push = (data: ArrayBufferView, target: number) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const offset = length;
    const padded = pad4(bytes.byteLength);
    parts.push(bytes);
    if (padded > bytes.byteLength) parts.push(new Uint8Array(padded - bytes.byteLength));
    length += padded;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    return views.length - 1;
  };
  const total = json.meshes.reduce((n: number, m: any) => n + m.primitives.length, 0);
  let done = 0;
  try {
    for (const mesh of json.meshes) {
      for (const prim of mesh.primitives) {
        const ext = prim.extensions?.KHR_draco_mesh_compression;
        if (!ext) throw new Error('A primitive has no Draco data.');
        const view = json.bufferViews[ext.bufferView];
        const src = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
        const db = new draco.DecoderBuffer();
        db.Init(new Int8Array(src.buffer, src.byteOffset, src.byteLength), src.byteLength);
        const geo = new draco.Mesh();
        const status = dec.DecodeBufferToMesh(db, geo);
        if (!status.ok() || geo.ptr === 0) throw new Error(`Draco decode failed: ${status.error_msg()}`);
        const faces = geo.num_faces();
        const points = geo.num_points();
        const attribute = (type: number, comps: number) => {
          const a = dec.GetAttribute(geo, dec.GetAttributeId(geo, type));
          const count = points * comps;
          const ptr = draco._malloc(count * 4);
          dec.GetAttributeDataArrayForAllPoints(geo, a, draco.DT_FLOAT32, count * 4, ptr);
          const out = new Float32Array(draco.HEAPF32.buffer, ptr, count).slice();
          draco._free(ptr);
          return out;
        };
        const pos = attribute(draco.POSITION, 3);
        const nor = attribute(draco.NORMAL, 3);
        const idxPtr = draco._malloc(faces * 12);
        dec.GetTrianglesUInt32Array(geo, faces * 12, idxPtr);
        const idx32 = new Uint32Array(draco.HEAPU32.buffer, idxPtr, faces * 3).slice();
        draco._free(idxPtr);
        draco.destroy(geo);
        draco.destroy(db);

        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
        const small = points < 65536;
        const posAcc = accessors.push({ bufferView: push(pos, 34962), componentType: 5126, count: points, type: 'VEC3', min, max }) - 1;
        const norAcc = accessors.push({ bufferView: push(nor, 34962), componentType: 5126, count: points, type: 'VEC3' }) - 1;
        const idxAcc = accessors.push({ bufferView: push(small ? Uint16Array.from(idx32) : idx32, 34963), componentType: small ? 5123 : 5125, count: faces * 3, type: 'SCALAR' }) - 1;
        prim.attributes = { POSITION: posAcc, NORMAL: norAcc };
        prim.indices = idxAcc;
        delete prim.extensions;
        onStep?.(++done, total);
        if (done % 4 === 0) await new Promise(r => setTimeout(r)); // let the page breathe between primitives
      }
    }
  } finally {
    draco.destroy(dec);
  }
  json.bufferViews = views;
  json.accessors = accessors;
  json.buffers = [{ byteLength: length }];
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((e: string) => e !== 'KHR_draco_mesh_compression');
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((e: string) => e !== 'KHR_draco_mesh_compression');
  if (!json.extensionsUsed.length) delete json.extensionsUsed;
  if (!json.extensionsRequired.length) delete json.extensionsRequired;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.byteLength);
  const out = new Uint8Array(12 + 8 + jsonLen + 8 + length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.byteLength, true);
  dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLen);
  out.set(jsonBytes, 20);
  const binAt = 20 + jsonLen;
  dv.setUint32(binAt, length, true); dv.setUint32(binAt + 4, 0x004e4942, true);
  let at = binAt + 8;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

/** Fetches a deck, reporting download progress, and returns a blob URL the viewer can load. */
export async function fetchDeckUrl(url: string, onProgress?: (text: string, fraction: number) => void): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.split('/').pop()}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader();
  let buf: ArrayBuffer;
  if (reader) {
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      onProgress?.(`Downloading ${(got / 1e6).toFixed(1)}${total ? ` of ${(total / 1e6).toFixed(1)}` : ''} MB`, total ? got / total : 0);
    }
    const all = new Uint8Array(got);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.byteLength; }
    buf = all.buffer;
  } else buf = await res.arrayBuffer();
  const glb = await decodeDracoGlb(buf, (d, t) => onProgress?.(`Decoding ${d}/${t}`, d / t));
  return URL.createObjectURL(new Blob([glb.buffer as ArrayBuffer], { type: 'model/gltf-binary' }));
}
