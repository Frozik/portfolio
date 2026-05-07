import { assert } from '@frozik/utils/assert/assert';

const PERCENT_MULTIPLIER = 100;
/** Alpha for the filled portion of the price-cell weight bar (darker shade of the side colour). */
const WEIGHT_BAR_FILLED_ALPHA = 0.55;
/** Alpha for the unfilled track of the price-cell weight bar (lighter shade of the side colour). */
const WEIGHT_BAR_TRACK_ALPHA = 0.18;
const HEX_RADIX = 16;
const RGB_HEX_LENGTH = 7;

function rgbaFromHex(hex: string, alpha: number): string {
  assert(hex.length === RGB_HEX_LENGTH, `expected 7-char hex (#RRGGBB), got "${hex}"`);
  const red = Number.parseInt(hex.slice(1, 3), HEX_RADIX);
  const green = Number.parseInt(hex.slice(3, 5), HEX_RADIX);
  const blue = Number.parseInt(hex.slice(5, 7), HEX_RADIX);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function buildWeightBarBackground(weightFraction: number, sideHex: string): string {
  const stopPercent = weightFraction * PERCENT_MULTIPLIER;
  const filled = rgbaFromHex(sideHex, WEIGHT_BAR_FILLED_ALPHA);
  const track = rgbaFromHex(sideHex, WEIGHT_BAR_TRACK_ALPHA);
  return `linear-gradient(to right, ${filled} ${stopPercent}%, ${track} ${stopPercent}%)`;
}
