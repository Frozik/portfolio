import { NANOS_PER_SECOND } from '@frozik/utils/date/constants';

import type { TRun } from '../core/series/point-run';
import type { TShape } from '../core/series/shape';
import type { IPaint, IStyle } from '../core/series/style-processor';
import { CHANNELS_PER_TEXEL, SLOT_TEXELS } from './slot-layout';

const NANOS_PER_SECOND_BIG = BigInt(NANOS_PER_SECOND);

/** A point takes two texels, a candle four; the last texel of both is the paint (§6.4). */
export const TEXELS_PER_ELEMENT: Readonly<Record<TShape, number>> = { point: 2, candle: 4 };

export function elementsPerSlot(shape: TShape): number {
  return Math.floor(SLOT_TEXELS / TEXELS_PER_ELEMENT[shape]);
}

const scratch = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT);
const scratchFloat = new Float32Array(scratch);
const scratchBits = new Uint32Array(scratch);

const SECONDS_BITS = 32;

function floatBits(value: number): number {
  scratchFloat[0] = value;
  return scratchBits[0];
}

/**
 * A value as two float32: the nearest float and what the rounding lost.
 * Together about 48 significant bits; the shader subtracts the viewport from
 * each part before adding them, so nothing is rounded to one float32 (§6.4).
 */
function writeSplit(texels: Uint32Array, offset: number, value: number): void {
  const high = Math.fround(value);
  texels[offset] = floatBits(high);
  texels[offset + 1] = floatBits(value - high);
}

/**
 * Time as whole seconds and the nanoseconds within the second. The seconds
 * wrap round 32 bits, before the epoch and after 2106 alike: the shader only
 * ever subtracts two of them, and a wrapped difference is exact as long as
 * the moments are less than 2³¹ seconds — 68 years — apart (`MAX_TIME_SPAN`).
 */
function writeTime(texels: Uint32Array, offset: number, nanoseconds: bigint): void {
  const withinSecond =
    ((nanoseconds % NANOS_PER_SECOND_BIG) + NANOS_PER_SECOND_BIG) % NANOS_PER_SECOND_BIG;
  const seconds = (nanoseconds - withinSecond) / NANOS_PER_SECOND_BIG;
  texels[offset] = Number(BigInt.asUintN(SECONDS_BITS, seconds));
  texels[offset + 1] = Number(withinSecond);
}

function writePosition<TX>(texels: Uint32Array, offset: number, position: TX): void {
  if (typeof position === 'bigint') {
    writeTime(texels, offset, position);
  } else {
    writeSplit(texels, offset, Number(position));
  }
}

function paintAt(values: number | Uint32Array | Float32Array, index: number): number {
  return typeof values === 'number' ? values : values[index];
}

function writePaint(texels: Uint32Array, offset: number, style: IStyle, index: number): void {
  const paints: readonly IPaint[] = [style.fill, style.stroke];
  paints.forEach((paint, order) => {
    texels[offset + order * 2] = floatBits(paintAt(paint.size, index));
    texels[offset + order * 2 + 1] = paintAt(paint.color, index);
  });
}

/** Elements `from`…`from + count` of a run, with their paint, as the texels of one slot. */
export function encodeElements<TX>(
  run: TRun<TX>,
  style: IStyle,
  from: number,
  count: number
): Uint32Array<ArrayBuffer> {
  const stride = TEXELS_PER_ELEMENT[run.shape] * CHANNELS_PER_TEXEL;
  const texels = new Uint32Array(count * stride);
  for (let order = 0; order < count; order += 1) {
    const index = from + order;
    const offset = order * stride;
    writePosition(texels, offset, run.x[index]);
    if (run.shape === 'candle') {
      writeSplit(texels, offset + 2, run.open[index]);
      writeSplit(texels, offset + 4, run.close[index]);
      writeSplit(texels, offset + 6, run.min[index]);
      writeSplit(texels, offset + 8, run.max[index]);
    } else {
      writeSplit(texels, offset + 2, run.value[index]);
    }
    writePaint(texels, offset + stride - CHANNELS_PER_TEXEL, style, index);
  }
  return texels;
}

/** A viewport bound the way the shader subtracts it: the same two parts an element's position has. */
export function splitPosition<TX>(position: TX): readonly [number, number] {
  const parts = new Uint32Array(2);
  writePosition(parts, 0, position);
  return [parts[0], parts[1]];
}

export function splitValue(value: number): readonly [number, number] {
  const high = Math.fround(value);
  return [high, value - high];
}
