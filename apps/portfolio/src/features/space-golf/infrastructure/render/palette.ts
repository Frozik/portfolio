import type { Rgba } from './mesh-writer';

/** Deep space, islands of black Khokhloma lacquer with a lit gold edge, a white ball. */
export const PALETTE = {
  space: [5, 6, 12, 255],
  /** The black lacquer the Khokhloma pattern is painted on. */
  lacquer: [24, 12, 9, 255],
  rim: [201, 178, 106, 255],
  /** The foresight bonus: a deep blue disc in a cyan ring, unlike anything else on the board. */
  bonusFill: [14, 34, 56, 235],
  bonusRing: [110, 215, 255, 255],
  /** The grip bonus: a deep plum disc in a gum-pink ring — nothing else on the board is pink. */
  gripFill: [50, 14, 40, 235],
  gripRing: [255, 128, 204, 255],
  /** A sliding rod and the plates it slides through: steel, shaded across so the rod reads as round. */
  steelDark: [78, 82, 92, 255],
  steel: [168, 174, 186, 255],
  steelLight: [236, 240, 246, 255],
  rivet: [40, 42, 48, 255],
  /** A screw rod and its plates: brass, so the two kinds are told apart at a glance; the thread is cut in dark. */
  brassDark: [96, 72, 30, 255],
  brass: [190, 150, 70, 255],
  brassLight: [240, 214, 140, 255],
  thread: [58, 42, 16, 255],
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
  /** The dots and the ring while the ball still moves: the pull is taken, the stroke waits for the rest. */
  dotPending: [150, 150, 158, 150],
  aimRingPending: [150, 150, 158, 50],
  flag: [255, 255, 255, 255],
  burst: [255, 236, 180, 255],
  star: [255, 255, 255, 90],
  aimRing: [255, 255, 255, 70],
  /** The bow the band is drawn as, and the light about it: an amber haze where the hand is, gold sparks, a white-hot string. */
  bandGlow: [255, 168, 48, 255],
  bandGold: [255, 206, 92, 255],
  bandCore: [255, 250, 226, 255],
  /** The Khokhloma berry painted along the bow's limbs, the same red the pattern shader uses. */
  berry: [189, 26, 18, 255],
} as const satisfies Record<string, Rgba>;

/** The same colour at another opacity: the fading ring of a burst, the tail of a trail, the pull of the band. */
export function withAlpha(color: Rgba, alpha: number): Rgba {
  return [color[0], color[1], color[2], Math.round(alpha)];
}

export const CLEAR_COLOR = {
  r: PALETTE.space[0] / 255,
  g: PALETTE.space[1] / 255,
  b: PALETTE.space[2] / 255,
  a: 1,
};
