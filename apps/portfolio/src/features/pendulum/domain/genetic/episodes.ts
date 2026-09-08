import type {
  INextGenerationEntry,
  IPendulumOptions,
  IRobotPlayer,
  IScoredPlayer,
  TPlayer,
} from '../types';

/** Every robot runs this many episodes per generation; its score is their sum. */
export const EPISODES_PER_ROBOT = 2;

/** Largest random lean, either way, of the upright start. */
const UPRIGHT_START_TILT = 0.1;

/**
 * A robot's generation is two episodes: one from the hanging rest, one from
 * a slightly tilted upright. Balancing is a linear skill nearby networks
 * already half-possess, and the upright start pays for it directly; the
 * hanging start then only asks for the swing-up into a catch the robot can
 * already do. From the hanging start alone the population settles for
 * swinging through the top and never learns to catch.
 */
export function episodesOf(
  player: IRobotPlayer,
  pendulumOptions?: Partial<IPendulumOptions>
): readonly INextGenerationEntry[] {
  return [
    { player, pendulumOptions },
    {
      player,
      pendulumOptions: {
        ...pendulumOptions,
        initialAngle: Math.PI + (Math.random() * 2 - 1) * UPRIGHT_START_TILT,
      },
    },
  ];
}

/** One score per player, in order of first appearance: the sum over its episodes. */
export function sumScoresByPlayer(scored: readonly IScoredPlayer[]): readonly IScoredPlayer[] {
  const totals = new Map<TPlayer, number>();

  for (const { player, score } of scored) {
    totals.set(player, (totals.get(player) ?? 0) + score);
  }

  return [...totals].map(([player, score]) => ({ player, score }));
}
