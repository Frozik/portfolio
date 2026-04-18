const BYTE_MASK = 0xff;
const COLOR_SCALE = 255;
// Blue channel is capped at 0x7E to keep bit 30 clear: if bits 23-30
// are all 1 the float32 becomes an IEEE 754 NaN, which GPUs are free
// to canonicalise and lose the encoded bits.
const BLUE_MAX_BYTE = 0x7e;

const sharedBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
const f32View = new Float32Array(sharedBuffer);
const u32View = new Uint32Array(sharedBuffer);

/**
 * Pack RGBA color channels (each in 0..1 range) into a single float32
 * so they fit inside one texel channel of a data texture without
 * spending a separate texture lookup.
 *
 * Layout: `[A in bits 0-7] [R in bits 8-15] [G in bits 16-23] [B in bits 24-31]`.
 * Alpha sits in the low byte so the float32 exponent field (bits
 * 23-30) avoids the all-ones pattern that would create NaN.
 */
export function packColor(r: number, g: number, b: number, a: number): number {
  const ai = Math.round(a * COLOR_SCALE) & BYTE_MASK;
  const ri = Math.round(r * COLOR_SCALE) & BYTE_MASK;
  const gi = Math.round(g * COLOR_SCALE) & BYTE_MASK;
  const bi = Math.min(Math.round(b * COLOR_SCALE) & BYTE_MASK, BLUE_MAX_BYTE);

  u32View[0] = ai | (ri << 8) | (gi << 16) | (bi << 24);
  return f32View[0];
}

export interface IUnpackedColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Inverse of {@link packColor}. Bit-reinterprets a packed float32
 * back into RGBA channels in the 0..1 range.
 */
export function unpackColor(packed: number): IUnpackedColor {
  f32View[0] = packed;
  const bits = u32View[0];
  return {
    a: (bits & BYTE_MASK) / COLOR_SCALE,
    r: ((bits >> 8) & BYTE_MASK) / COLOR_SCALE,
    g: ((bits >> 16) & BYTE_MASK) / COLOR_SCALE,
    b: ((bits >> 24) & BYTE_MASK) / COLOR_SCALE,
  };
}
