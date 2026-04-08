import { FLOATS_PER_POINT } from './constants';
import type { IDataPoint } from './types';

const COLOR_CHANNEL_OFFSET = 3;

/**
 * Encode data points into a Float32Array suitable for texture upload.
 * Each point is stored as 4 floats: [timeDelta, valueDelta, size, packedColor].
 *
 * The color channel is written via a Uint32Array view to preserve the exact
 * bit pattern — packed RGBA values often produce NaN float patterns which
 * would be lost if assigned through Float32Array.
 */
export function encodePoints(
  points: readonly IDataPoint[],
  baseTime: number,
  baseValue: number
): Float32Array {
  const buffer = new ArrayBuffer(points.length * FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);

  for (let i = 0; i < points.length; i++) {
    const offset = i * FLOATS_PER_POINT;
    const point = points[i];
    f32[offset] = point.time - baseTime;
    f32[offset + 1] = point.value - baseValue;
    f32[offset + 2] = point.size;
    // Write color as raw uint32 bits to avoid NaN canonicalization
    u32[offset + COLOR_CHANNEL_OFFSET] = colorFloatToUint32(point.color);
  }

  return f32;
}

const colorBuf = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
const colorF32 = new Float32Array(colorBuf);
const colorU32 = new Uint32Array(colorBuf);

/** Extract the raw uint32 bits from a packed color float. */
function colorFloatToUint32(color: number): number {
  colorF32[0] = color;
  return colorU32[0];
}
