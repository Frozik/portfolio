import type { ISO } from '@frozik/utils/date/types';
import { isNil, max, orderBy } from 'lodash-es';

import type { IGeneration } from '../domain/generation';
import { HALT_PLAYER_SCORE_PER_MS, POPULATION_SIZE } from '../domain/genetic/constants';
import { createTensorflowPlayers } from '../domain/genetic/createTensorflowPlayers';
import { loadTensorflowPlayers } from '../domain/genetic/loadTensorflowPlayers';
import { singlePendulumGenerationBuilder } from '../domain/genetic/singlePendulumGenerationBuilder';
import { singlePendulumScoreCalculatorBuilder } from '../domain/genetic/singlePendulumScoreCalculatorBuilder';
import type { IGenerationsRepository } from '../domain/ports/generations-repository';
import type { ICompetition, IScoredPlayer, TPlayer } from '../domain/types';
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
  const breedNextGeneration = singlePendulumGenerationBuilder(POPULATION_SIZE, MAX_RUNS);

  let completedGenerationsCount = getGenerations().length;

  return {
    start: competitionStart,

    // Generations are read on init, not when the competition is built: the
    // competition outlives the playground, so a re-entered playground must
    // resume from the newest generation instead of a stale snapshot.
    init(): Promise<readonly TPlayer[]> {
      const savedPlayers = getGenerations().at(-1)?.players;

      return isNil(savedPlayers)
        ? createTensorflowPlayers(POPULATION_SIZE)
        : loadTensorflowPlayers(savedPlayers);
    },

    scoreCalculatorBuilder: singlePendulumScoreCalculatorBuilder,

    competitionForPlayerCompleted(_: TPlayer, score: number): boolean {
      return score < HALT_PLAYER_SCORE_PER_MS * FITNESS_RUN_INTERVAL;
    },

    competitionCompleted(elapsed: DOMHighResTimeStamp): boolean {
      return elapsed >= FITNESS_RUN_INTERVAL;
    },

    async restartCompetition(playersWithScore: readonly IScoredPlayer[], elapsed) {
      completedGenerationsCount++;

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
