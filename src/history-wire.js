// History records as JSON, for the Pi's files and what it sends the browser:
// each typed array becomes { t: its type, d: its bytes in base64 }. Shared by
// the userscript and the Pi (both little-endian).

const TYPES = { f32: Float32Array, u8: Uint8Array, u16: Uint16Array, u32: Uint32Array };
const NAMES = new Map(Object.entries(TYPES).map(([name, type]) => [type, name]));

function toBase64(bytes) {
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(text);
}

function fromBase64(text) {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

export function packRecord(record) {
    const out = {};
    for (const [k, v] of Object.entries(record)) {
        const name = v && NAMES.get(v.constructor);
        out[k] = name ? { t: name, d: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) } : v;
    }
    return out;
}

export function unpackRecord(packed) {
    const out = {};
    for (const [k, v] of Object.entries(packed)) {
        const type = v && typeof v === "object" && TYPES[v.t];
        out[k] = type ? new type(fromBase64(v.d).buffer) : v;
    }
    return out;
}
