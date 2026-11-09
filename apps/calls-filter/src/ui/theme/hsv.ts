import type { THexColor } from '../../contexts/grouping/domain/group';

/** A colour as a picker holds it: hue in degrees, saturation and value from 0 to 1. */
export interface IHsv {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

const FULL_CIRCLE = 360;
const HUE_SECTOR = 60;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR = 2;

export function hsvToHex({ hue, saturation, value }: IHsv): THexColor {
  const chroma = value * saturation;
  const position = (((hue % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE) / HUE_SECTOR;
  const second = chroma * (1 - Math.abs((position % 2) - 1));
  const sectors = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ] as const;
  const [red, green, blue] = sectors[Math.floor(position)] ?? sectors[0];
  const match = value - chroma;
  const channel = (part: number) =>
    Math.round((part + match) * CHANNEL_MAX)
      .toString(HEX_RADIX)
      .padStart(HEX_PAIR, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}` as THexColor;
}

export function hexToHsv(hex: THexColor): IHsv {
  const channel = (index: number) =>
    Number.parseInt(hex.slice(1 + index * HEX_PAIR, 3 + index * HEX_PAIR), HEX_RADIX) / CHANNEL_MAX;
  const [red, green, blue] = [channel(0), channel(1), channel(2)];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  const sector =
    delta === 0
      ? 0
      : max === red
        ? ((green - blue) / delta + 6) % 6
        : max === green
          ? (blue - red) / delta + 2
          : (red - green) / delta + 4;
  return {
    hue: sector * HUE_SECTOR,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
}
