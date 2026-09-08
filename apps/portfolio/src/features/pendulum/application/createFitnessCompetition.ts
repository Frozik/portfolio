import type { ISO } from '@frozik/utils/date/types';
import { isNil, max, orderBy } from 'lodash-es';

import type { IGeneration } from '../domain/generation';
import {
  HOPELESS_AFTER,
  HOPELESS_SCORE_PER_MS,
  POPULATION_SIZE,
} from '../domain/genetic/constants';
import { createSinglePendulumScoreCalculator } from '../domain/genetic/createSinglePendulumScoreCalculator';
import { createTensorflowPlayers } from '../domain/genetic/createTensorflowPlayers';
import { episodesOf, sumScoresByPlayer } from '../domain/genetic/episodes';
import { loadTensorflowPlayers } from '../domain/genetic/loadTensorflowPlayers';
import { singlePendulumGenerationBuilder } from '../domain/genetic/singlePendulumGenerationBuilder';
import { TensorflowPlayer } from '../domain/players/TensorflowPlayer';
import type { IGenerationsRepository } from '../domain/ports/generations-repository';
import type { ICompetition, INextGenerationEntry, IScoredPlayer, TPlayer } from '../domain/types';
import { isScoredRobot } from '../domain/types';

const MAX_RUNS = 10_000;
const FITNESS_RUN_INTERVAL = 20_000;

/**
 * Builds the genetic competition driving the fitness playground: it seeds the
 * population (fresh or continued from the last persisted generation), scores
 * runs, persists every completed generation and breeds the next one.
 */
export function createFitnessCompetition({
  competitionStart,
  getGenerations,
  onGenerationCompleted,
  saveRobotModel,
}: {
  readonly competitionStart: ISO;
  readonly getGenerations: () => readonly IGeneration[];
  readonly onGenerationCompleted: (generation: IGeneration) => void;
  readonly saveRobotModel: IGenerationsRepository['saveRobotModel'];
}): ICompetition {
  const breedNextGeneration = singlePendulumGenerationBuilder(
    POPULATION_SIZE,
    MAX_RUNS,
    () => new TensorflowPlayer()
  );

  let completedGenerationsCount = getGenerations().length;

  return {
    start: competitionStart,

    // Generations are read on init, not when the competition is built: the
    // competition outlives the playground, so a re-entered playground must
    // resume from the newest generation instead of a stale snapshot.
    async init(): Promise<readonly INextGenerationEntry[]> {
      const savedPlayers = getGenerations().at(-1)?.players;
      const players = isNil(savedPlayers)
        ? await createTensorflowPlayers(POPULATION_SIZE)
        : await loadTensorflowPlayers(savedPlayers);

      return players.flatMap(player => episodesOf(player));
    },

    createScoreCalculator: createSinglePendulumScoreCalculator,

    competitionForPlayerCompleted(_: TPlayer, score: number, elapsed): boolean {
      return elapsed >= HOPELESS_AFTER && score < HOPELESS_SCORE_PER_MS * elapsed;
    },

    competitionCompleted(elapsed: DOMHighResTimeStamp): boolean {
      return elapsed >= FITNESS_RUN_INTERVAL;
    },

    async restartCompetition(episodesWithScore: readonly IScoredPlayer[], elapsed) {
      completedGenerationsCount++;

      const playersWithScore = sumScoresByPlayer(episodesWithScore);

      const players = await Promise.all(
        playersWithScore.filter(isScoredRobot).map(async ({ player, score }) => ({
          name: player.name,
          modelUrl: await saveRobotModel(competitionStart, player),
          score,
        }))
      );

      onGenerationCompleted({
        id: completedGenerationsCount,
        maxScore: max(playersWithScore.map(({ score }) => score)) ?? 0,
        players: orderBy(players, ({ score }) => score, 'desc'),
      });

      return breedNextGeneration(playersWithScore, elapsed, completedGenerationsCount);
    },
  };
}
