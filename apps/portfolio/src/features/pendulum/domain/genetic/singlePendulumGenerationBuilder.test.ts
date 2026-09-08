import { RAILS_HALF_LENGTH } from '../constants';
import type { IRobotPlayer, IScoredPlayer } from '../types';
import { EPlayerType } from '../types';
import { MAX_SCORE_PER_MS, SEASONED_SCORE_PER_MS } from './constants';
import { EPISODES_PER_ROBOT } from './episodes';
import { singlePendulumGenerationBuilder } from './singlePendulumGenerationBuilder';

const RUN = 20_000;
const POPULATION = 10;

function createRobot(name: string): IRobotPlayer {
  const robot: IRobotPlayer = {
    type: EPlayerType.Robot,
    name,
    play: () => ({ pivotVelocity: 0 }),
    mutate: async () => createRobot(`${name}'`),
    crossoverModels: async () => createRobot(`${name}x`),
    describeNetwork: () => [],
    save: async () => undefined,
    dispose: () => undefined,
  };
  return robot;
}

function scoredPopulation(scorePerMsOf: (index: number) => number): IScoredPlayer[] {
  return Array.from({ length: POPULATION }, (_, index) => ({
    player: createRobot(`robot-${index}`),
    score: scorePerMsOf(index) * RUN,
  }));
}

describe('singlePendulumGenerationBuilder', () => {
  it('finishes once the run limit is reached', async () => {
    const breed = singlePendulumGenerationBuilder(POPULATION, 3, () => createRobot('new'));

    expect(
      await breed(
        scoredPopulation(() => 0),
        RUN,
        3
      )
    ).toEqual({ kind: 'finished' });
  });

  it('keeps the best fifth unchanged, refills the population and sends every robot out with its episodes', async () => {
    const breed = singlePendulumGenerationBuilder(POPULATION, 100, () => createRobot('new'));
    const population = scoredPopulation(index => 0.5 - index * 0.01);

    const outcome = await breed(population, RUN, 1);

    expect(outcome.kind).toBe('nextGeneration');
    if (outcome.kind !== 'nextGeneration') {
      return;
    }
    const robots = [...new Set(outcome.entries.map(({ player }) => player))];
    expect(outcome.entries).toHaveLength(POPULATION * EPISODES_PER_ROBOT);
    expect(robots).toHaveLength(POPULATION);
    expect(robots.slice(0, 2)).toEqual([population[0].player, population[1].player]);
    expect(robots.slice(2).every(robot => !population.some(p => p.player === robot))).toBe(true);
  });

  it('starts seasoned survivors away from the centre, the best ones anywhere on the rails', async () => {
    const breed = singlePendulumGenerationBuilder(POPULATION, 100, () => createRobot('new'));
    const population = scoredPopulation(index =>
      index === 0 ? MAX_SCORE_PER_MS : index === 1 ? SEASONED_SCORE_PER_MS - 0.1 : 0
    );

    const outcome = await breed(population, RUN, 1);

    expect(outcome.kind).toBe('nextGeneration');
    if (outcome.kind !== 'nextGeneration') {
      return;
    }
    const [champion, , runnerUp] = outcome.entries;
    const start = champion.pendulumOptions?.pivotPosition;
    expect(start).toBeDefined();
    expect(Math.abs(start ?? 0)).toBeLessThanOrEqual(RAILS_HALF_LENGTH);
    expect(runnerUp.pendulumOptions?.pivotPosition).toBeUndefined();
  });
});
