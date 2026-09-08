import type { Rgba } from './mesh-writer';

/** The reference's look: deep space, navy blocks with a lit gold edge, a white ball. */
export const PALETTE = {
  space: [5, 6, 12, 255],
  block: [38, 42, 74, 255],
  blockTile: [45, 50, 86, 255],
  rim: [201, 178, 106, 255],
  spike: [214, 190, 118, 255],
  spikeRetracted: [140, 124, 80, 255],
  ball: [255, 255, 255, 255],
  dot: [255, 255, 255, 220],
  flag: [255, 255, 255, 255],
  burst: [255, 236, 180, 255],
  star: [255, 255, 255, 90],
  pickup: [214, 190, 118, 255],
  aimRing: [255, 255, 255, 70],
} as const satisfies Record<string, Rgba>;

export const CLEAR_COLOR = {
  r: PALETTE.space[0] / 255,
  g: PALETTE.space[1] / 255,
  b: PALETTE.space[2] / 255,
  a: 1,
};
