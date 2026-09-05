import type { IGeneration } from './generation';
import { maxPopulationSize, mergeSnapshotWithOptimisticTail } from './generation';
import type { RobotModelUrl } from './types';

function generation(id: number, playersCount = 1): IGeneration {
  return {
    id,
    maxScore: id,
    players: Array.from({ length: playersCount }, (_, index) => ({
      name: `robot-${id}-${index}`,
      modelUrl: `model-${id}-${index}` as RobotModelUrl,
      score: id,
    })),
  };
}

describe('mergeSnapshotWithOptimisticTail', () => {
  it('keeps locally appended generations the snapshot does not know about yet', () => {
    const merged = mergeSnapshotWithOptimisticTail(
      [generation(1), generation(2)],
      [generation(1), generation(2), generation(3), generation(4)]
    );

    expect(merged.map(({ id }) => id)).toEqual([1, 2, 3, 4]);
  });

  it('prefers the snapshot for every generation it already contains', () => {
    const persisted = generation(2, 3);

    const merged = mergeSnapshotWithOptimisticTail([generation(1), persisted], [generation(2, 1)]);

    expect(merged[1]).toBe(persisted);
  });

  it('returns the snapshot alone when nothing was appended locally', () => {
    expect(mergeSnapshotWithOptimisticTail([generation(1)], [])).toEqual([generation(1)]);
  });

  it('keeps every local generation when the snapshot is empty', () => {
    expect(mergeSnapshotWithOptimisticTail([], [generation(1), generation(2)])).toEqual([
      generation(1),
      generation(2),
    ]);
  });
});

describe('maxPopulationSize', () => {
  it('is the biggest player count across generations', () => {
    expect(maxPopulationSize([generation(1, 2), generation(2, 5), generation(3, 3)])).toBe(5);
  });

  it('is zero without generations', () => {
    expect(maxPopulationSize([])).toBe(0);
  });
});
