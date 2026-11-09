import type { THexColor } from './group';

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#?([0-9a-f]{6})$/i;

/** «FF8800», «#ff8800» or «F80» as one colour, «#ff8800»; anything else is not a colour. */
export function parseHexColor(text: string): THexColor | null {
  const trimmed = text.trim();
  const short = SHORT_HEX.exec(trimmed);
  if (short !== null) {
    return `#${short
      .slice(1)
      .map(digit => `${digit}${digit}`)
      .join('')
      .toLowerCase()}` as THexColor;
  }
  const long = LONG_HEX.exec(trimmed);
  return long === null ? null : (`#${long[1]?.toLowerCase() ?? ''}` as THexColor);
}
