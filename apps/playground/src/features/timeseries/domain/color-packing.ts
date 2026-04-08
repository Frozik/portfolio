const BYTE_MASK = 0xff;
const COLOR_SCALE = 255;

const sharedBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
const f32View = new Float32Array(sharedBuffer);
const u32View = new Uint32Array(sharedBuffer);

/**
 * Pack RGBA color channels (each in 0..1 range) into a single float32.
 *
 * Layout: [A in bits 0-7] [R in bits 8-15] [G in bits 16-23] [B in bits 24-31]
 *
 * Alpha is placed in the low byte to keep high bytes (which overlap with
 * the float32 exponent field at bits 23-30) away from 0xFF — this prevents
 * the packed value from becoming IEEE 754 NaN, which GPUs may canonicalize
 * and lose the encoded color data.
 *
 * Blue is capped at 0x7E in the high byte to ensure bit 30 is never set
 * when bit 31 is set, avoiding all-1s exponent (0xFF).
 */
export function packColor(r: number, g: number, b: number, a: number): number {
  const ai = Math.round(a * COLOR_SCALE) & BYTE_MASK;
  const ri = Math.round(r * COLOR_SCALE) & BYTE_MASK;
  const gi = Math.round(g * COLOR_SCALE) & BYTE_MASK;
  // Cap blue at 0x7E to avoid NaN exponent when sign bit is set
  const bi = Math.min(Math.round(b * COLOR_SCALE) & BYTE_MASK, 0x7e);

  u32View[0] = ai | (ri << 8) | (gi << 16) | (bi << 24);
  return f32View[0];
}

/**
 * Unpack a float32 (bit-reinterpreted) back into RGBA color channels (each in 0..1 range).
 * Must match the layout used in packColor and the WGSL unpackColorWgsl function.
 */
export function unpackColor(packed: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  f32View[0] = packed;
  const bits = u32View[0];

  return {
    a: (bits & BYTE_MASK) / COLOR_SCALE,
    r: ((bits >> 8) & BYTE_MASK) / COLOR_SCALE,
    g: ((bits >> 16) & BYTE_MASK) / COLOR_SCALE,
    b: ((bits >> 24) & BYTE_MASK) / COLOR_SCALE,
  };
}
