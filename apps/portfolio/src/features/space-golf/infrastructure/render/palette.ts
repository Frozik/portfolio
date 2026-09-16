import type { Rgba } from './mesh-writer';

/** Deep space, islands of black Khokhloma lacquer with a lit gold edge, a white ball. */
export const PALETTE = {
  space: [5, 6, 12, 255],
  /** The black lacquer the Khokhloma pattern is painted on. */
  lacquer: [24, 12, 9, 255],
  rim: [201, 178, 106, 255],
  /** A spike tooth: white like the ball, shaded across so it reads as a cone. */
  spikeLit: [255, 255, 255, 255],
  spikeShade: [150, 150, 162, 255],
  spikeDark: [84, 84, 96, 255],
  /** The socket a retracted tooth leaves: a dark hole in the face with a white lip. */
  socketMouth: [58, 56, 60, 255],
  socketDepth: [4, 4, 6, 255],
  socketLip: [255, 255, 255, 255],
  ball: [255, 255, 255, 255],
  dot: [255, 255, 255, 220],
  flag: [255, 255, 255, 255],
  burst: [255, 236, 180, 255],
  star: [255, 255, 255, 90],
  aimRing: [255, 255, 255, 70],
} as const satisfies Record<string, Rgba>;

export const CLEAR_COLOR = {
  r: PALETTE.space[0] / 255,
  g: PALETTE.space[1] / 255,
  b: PALETTE.space[2] / 255,
  a: 1,
};
