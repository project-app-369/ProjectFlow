# Draco decoder

`draco_wasm_wrapper.js` and `draco_decoder.wasm` are Google's Draco 1.5.6 WebAssembly decoder, copied unchanged from
`https://www.gstatic.com/draco/versioned/decoders/1.5.6/` (Apache License 2.0, https://github.com/google/draco).

`src/dracoGlb.ts` uses them to unpack the Draco-compressed facility GLB files (`/models/facility/*.glb`) in the browser, because the
Autodesk viewer's glTF loader cannot read Draco itself.
