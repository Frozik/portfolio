import { BLUE, GREEN, GREY, ORANGE, RED } from './palette';

interface IBand {
  /** Values above this belong to the band. */
  readonly above: number;
  readonly color: number;
  readonly lineSize: number;
}

/** Highest first: a value takes the first band it is above. */
const BANDS: readonly IBand[] = [
  { above: 110, color: RED, lineSize: 10 },
  { above: 105, color: ORANGE, lineSize: 8 },
  { above: 100, color: GREY, lineSize: 6 },
  { above: 95, color: GREEN, lineSize: 4 },
];
const LOWEST: IBand = { above: Number.NEGATIVE_INFINITY, color: BLUE, lineSize: 2 };

function bandOf(value: number): IBand {
  return BANDS.find(band => value > band.above) ?? LOWEST;
}

/** Extreme values stand out: red at the top, blue at the bottom. */
export function colorByValue(value: number): number {
  return bandOf(value).color;
}

/** Calm stretches are thin, high ones thick. */
export function lineSizeByValue(value: number): number {
  return bandOf(value).lineSize;
}
