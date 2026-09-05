import { last } from 'lodash-es';

import type { RobotModelUrl } from './types';

export interface IGenerationPlayer {
  readonly name: string;
  readonly modelUrl: RobotModelUrl;
  readonly score: number;
}

export interface IGeneration {
  readonly id: number;
  readonly maxScore: number;
  readonly players: readonly IGenerationPlayer[];
}

export function maxPopulationSize(generations: readonly IGeneration[]): number {
  return generations.reduce((size, { players }) => Math.max(size, players.length), 0);
}

/**
 * A persisted snapshot may lag behind generations appended locally while the
 * training loop keeps running; the snapshot wins for everything it knows and
 * the newer local tail is kept on top.
 */
export function mergeSnapshotWithOptimisticTail(
  snapshot: readonly IGeneration[],
  local: readonly IGeneration[]
): readonly IGeneration[] {
  const snapshotMaxId = last(snapshot)?.id ?? Number.NEGATIVE_INFINITY;
  const optimisticTail = local.filter(generation => generation.id > snapshotMaxId);

  return [...snapshot, ...optimisticTail];
}
