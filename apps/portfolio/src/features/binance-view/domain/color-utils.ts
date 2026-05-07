/**
 * Convert a CSS hex colour (`#RRGGBB` or `#RGB`) to linear-sRGB floats
 * in `[0, 1]` per channel.
 *
 * The conversion uses the **piecewise** sRGB → linear transfer
 * function, not the gamma-2.2 shortcut:
 *
 *     linear = c / 12.92                              if c ≤ 0.04045
 *     linear = ((c + 0.055) / 1.055) ** 2.4           otherwise
 *
 * Why piecewise? Pure `c ** 2.2` is a decent visual approximation but
 * disagrees with the official sRGB definition near zero. The linear
 * segment in `[0, 0.04045]` avoids the pathological gamma-curve slope
 * at the origin, which would otherwise crush dark colours and make
 * tiny stroke values render as pure black.
 *
 * Conversion is performed once (at WebGPU pipeline-creation, when hex
 * constants are pushed into shader override-constants), so runtime
 * cost is irrelevant — correctness wins.
 */

const SHORT_FORM_HEX_LENGTH = 4; // '#abc'
const LONG_FORM_HEX_LENGTH = 7; // '#aabbcc'
const HEX_BYTE_RADIX = 16;
const RGB_CHANNEL_MAX = 255;
const SRGB_LINEAR_CUTOFF = 0.04045;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_SCALE = 1.055;
const SRGB_GAMMA_EXPONENT = 2.4;

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Apply the sRGB → linear transfer function to a single channel value
 * already normalised to `[0, 1]`.
 */
function srgbChannelToLinear(channel: number): number {
  if (channel <= SRGB_LINEAR_CUTOFF) {
    return channel / SRGB_LINEAR_SLOPE;
  }
  return ((channel + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE) ** SRGB_GAMMA_EXPONENT;
}

/**
 * Expand a 3-digit hex colour (`#abc`) to its 6-digit form
 * (`#aabbcc`). Caller is responsible for shape validation.
 */
function expandShortFormHex(hex: string): string {
  const r = hex.charAt(1);
  const g = hex.charAt(2);
  const b = hex.charAt(3);
  return `#${r}${r}${g}${g}${b}${b}`;
}

/**
 * Parse a CSS hex colour and return its linear-sRGB representation.
 *
 * Accepts `#RGB` and `#RRGGBB` forms (case-insensitive). Throws on any
 * other shape — wrong length, missing `#`, non-hex characters, etc.
 */
export function hexToLinearRgb(hex: string): { r: number; g: number; b: number } {
  if (!HEX_PATTERN.test(hex)) {
    throw new Error(`hexToLinearRgb: invalid hex colour "${hex}"`);
  }

  const expanded = hex.length === SHORT_FORM_HEX_LENGTH ? expandShortFormHex(hex) : hex;
  // After validation + (optional) expansion the string is guaranteed
  // to have the long form; assert to keep the `parseInt` calls honest.
  if (expanded.length !== LONG_FORM_HEX_LENGTH) {
    throw new Error(`hexToLinearRgb: expansion failed for "${hex}"`);
  }

  const redByte = Number.parseInt(expanded.slice(1, 3), HEX_BYTE_RADIX);
  const greenByte = Number.parseInt(expanded.slice(3, 5), HEX_BYTE_RADIX);
  const blueByte = Number.parseInt(expanded.slice(5, 7), HEX_BYTE_RADIX);

  return {
    r: srgbChannelToLinear(redByte / RGB_CHANNEL_MAX),
    g: srgbChannelToLinear(greenByte / RGB_CHANNEL_MAX),
    b: srgbChannelToLinear(blueByte / RGB_CHANNEL_MAX),
  };
}
