/**
 * One-off generator for the Anavaya app icons (favicon.ico + apple-touch-icon.png).
 * Rasterizes the same scales-of-justice mark as public/favicon.svg with a tiny
 * supersampling rasterizer, then encodes PNG (zlib) and wraps a copy in an ICO.
 * Run: node scripts/gen-icons.mjs   — safe to delete afterwards.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [0x14, 0x14, 0x14];
const GOLD = [0xc9, 0xa2, 0x2b];
const S = 64; // design space

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax,
    vy = by - ay;
  const wx = px - ax,
    wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy || 1), 0, 1);
  const dx = px - (ax + t * vx),
    dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function roundRect(px, py, r) {
  // signed distance to a rounded square inset 0 in the 0..S box
  const qx = Math.abs(px - S / 2) - (S / 2 - r);
  const qy = Math.abs(py - S / 2) - (S / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const t = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const u = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
}

const STROKES = [
  [32, 17, 32, 47, 1.6], // post
  [14, 23, 50, 23, 1.6], // beam
  [22, 47, 42, 47, 1.6], // base
  [14, 23, 14, 28, 1.0], // hangers
  [50, 23, 50, 28, 1.0],
];

/** Returns [r,g,b,a] for a point in design space, or null when outside the mark. */
function sample(x, y) {
  if (roundRect(x, y, 14) > 0) return null;
  // gold pan triangles
  if (
    inTriangle(x, y, [14, 28], [6, 39], [22, 39]) ||
    inTriangle(x, y, [50, 28], [42, 39], [58, 39])
  )
    return [...GOLD, 0.85];
  // finial
  if (Math.hypot(x - 32, y - 16) <= 3.6) return [...GOLD, 1];
  for (const [ax, ay, bx, by, hw] of STROKES) {
    if (segDist(x, y, ax, ay, bx, by) <= hw) return [...GOLD, 1];
  }
  return [...BG, 1];
}

function render(size, ss = 4) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * S;
          const y = ((py + (sy + 0.5) / ss) / size) * S;
          const c = sample(x, y);
          if (!c) continue;
          const [cr, cg, cb, ca] = c;
          // composite the sub-sample over whatever is already accumulated
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const n = ss * ss;
      const o = (py * size + px) * 4;
      if (a > 0) {
        buf[o] = Math.round(r / a);
        buf[o + 1] = Math.round(g / a);
        buf[o + 2] = Math.round(b / a);
        buf[o + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return buf;
}

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO wrapping PNG payloads (supported since Windows Vista, and by every browser). */
function encodeIco(entries) {
  const dir = Buffer.alloc(6 + 16 * entries.length);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = 6 + i * 16;
    dir[o] = size >= 256 ? 0 : size;
    dir[o + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([dir, ...entries.map((e) => e.png)]);
}

const ico = encodeIco(
  [16, 32, 48].map((size) => ({ size, png: encodePng(render(size), size) })),
);
writeFileSync("public/favicon.ico", ico);
writeFileSync("public/apple-touch-icon.png", encodePng(render(180), 180));
console.log(`favicon.ico ${ico.length} bytes · apple-touch-icon.png written`);
