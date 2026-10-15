import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

const HEX_CHANNELS = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.040_45;
const LINEAR_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const FLARE = 0.05;

function linear(channel: number): number {
  const value = channel / CHANNEL_MAX;
  return value <= LINEAR_THRESHOLD
    ? value / LINEAR_SLOPE
    : ((value + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA;
}

/** WCAG 2 relative luminance of an opaque `#rrggbb`. */
function luminance(hex: string): number {
  const match = HEX_CHANNELS.exec(hex);
  assert(!isNil(match), `Not an opaque #rrggbb colour: ${hex}`);
  return LUMINANCE_WEIGHTS.reduce(
    (sum, weight, index) => sum + weight * linear(Number.parseInt(match[index + 1] ?? '0', 16)),
    0
  );
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + FLARE) / ((darker ?? 0) + FLARE);
}
