const CHANNEL_MAX = 255;
const GREEN_SHIFT = 8;
const BLUE_SHIFT = 16;
const ALPHA_SHIFT = 24;

/** A colour as one 32-bit number: red in the low byte, then green, blue and alpha. */
export type TColor = number;

/** Packs channels given in 0…1. */
export function rgba(red: number, green: number, blue: number, alpha = 1): TColor {
  const byte = (channel: number): number =>
    Math.round(Math.min(Math.max(channel, 0), 1) * CHANNEL_MAX);
  return (
    (byte(red) |
      (byte(green) << GREEN_SHIFT) |
      (byte(blue) << BLUE_SHIFT) |
      (byte(alpha) << ALPHA_SHIFT)) >>>
    0
  );
}

export interface IColorChannels {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** Channels in 0…1. */
export function channelsOf(color: TColor): IColorChannels {
  return {
    red: (color & CHANNEL_MAX) / CHANNEL_MAX,
    green: ((color >>> GREEN_SHIFT) & CHANNEL_MAX) / CHANNEL_MAX,
    blue: ((color >>> BLUE_SHIFT) & CHANNEL_MAX) / CHANNEL_MAX,
    alpha: ((color >>> ALPHA_SHIFT) & CHANNEL_MAX) / CHANNEL_MAX,
  };
}

export function withAlpha(color: TColor, alpha: number): TColor {
  const { red, green, blue } = channelsOf(color);
  return rgba(red, green, blue, alpha);
}

export function cssOf(color: TColor): string {
  const { red, green, blue, alpha } = channelsOf(color);
  const byte = (channel: number): number => Math.round(channel * CHANNEL_MAX);
  return `rgba(${byte(red)}, ${byte(green)}, ${byte(blue)}, ${alpha})`;
}
