import type { IRobotPlayer } from '../types';
import { EPlayerType } from '../types';
import { EPISODES_PER_ROBOT, episodesOf, sumScoresByPlayer } from './episodes';

function createRobot(name: string): IRobotPlayer {
  const robot: IRobotPlayer = {
    type: EPlayerType.Robot,
    name,
    play: () => ({ pivotVelocity: 0 }),
    mutate: async () => robot,
    crossoverModels: async () => robot,
    describeNetwork: () => [],
    save: async () => undefined,
    dispose: () => undefined,
  };
  return robot;
}

describe('episodesOf', () => {
  it('runs a robot from the hanging rest and from a slightly tilted upright', () => {
    const robot = createRobot('a');

    const [hanging, upright] = episodesOf(robot, { pivotPosition: 50 });

    expect(episodesOf(robot)).toHaveLength(EPISODES_PER_ROBOT);
    expect(hanging).toEqual({ player: robot, pendulumOptions: { pivotPosition: 50 } });
    expect(upright.player).toBe(robot);
    expect(upright.pendulumOptions?.pivotPosition).toBe(50);
    expect(Math.abs((upright.pendulumOptions?.initialAngle ?? 0) - Math.PI)).toBeLessThanOrEqual(
      0.1
    );
  });
});

describe('sumScoresByPlayer', () => {
  it('adds up every episode of a player, keeping the players in order of first appearance', () => {
    const a = createRobot('a');
    const b = createRobot('b');

    expect(
      sumScoresByPlayer([
        { player: a, score: 10 },
        { player: b, score: 1 },
        { player: a, score: 5 },
      ])
    ).toEqual([
      { player: a, score: 15 },
      { player: b, score: 1 },
    ]);
  });

  it('tells apart robots that share a name', () => {
    const scored = sumScoresByPlayer([
      { player: createRobot('twin'), score: 1 },
      { player: createRobot('twin'), score: 2 },
    ]);

    expect(scored).toHaveLength(2);
  });
});
