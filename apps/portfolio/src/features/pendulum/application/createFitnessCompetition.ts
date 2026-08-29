import type { ISO } from '@frozik/utils/date/types';
import { isNil, max } from 'lodash-es';

import type { IGeneration } from '../domain/defs';
import { HALT_PLAYER_SCORE_PER_MS, POPULATION_SIZE } from '../domain/genetic/constants';
import { createTensorflowPlayers } from '../domain/genetic/createTensorflowPlayers';
import { loadTensorflowPlayers } from '../domain/genetic/loadTensorflowPlayers';
import { singlePendulumGenerationBuilder } from '../domain/genetic/singlePendulumGenerationBuilder';
import { singlePendulumScoreCalculatorBuilder } from '../domain/genetic/singlePendulumScoreCalculatorBuilder';
import type { ICompetition, IRobotPlayer, IScoredPlayer, TPlayer } from '../domain/types';
import { EPlayerType } from '../domain/types';
import { buildRobotModelUrl } from '../infrastructure/IndexedDBGenerationsRepository';

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
}: {
  readonly competitionStart: ISO;
  readonly getGenerations: () => readonly IGeneration[];
  readonly onGenerationCompleted: (generation: IGeneration) => void;
}): ICompetition {
  const breedNextGeneration = singlePendulumGenerationBuilder(POPULATION_SIZE, MAX_RUNS);

  let completedGenerationsCount = getGenerations().length;

  return {
    start: competitionStart,

    get generationsCount(): number {
      return completedGenerationsCount;
    },

    // Generations are read on init, not when the competition is built: the
    // competition outlives the playground, so a re-entered playground must
    // resume from the newest generation instead of a stale snapshot.
    init(): Promise<TPlayer[]> {
      const savedPlayers = getGenerations()
        .at(-1)
        ?.players.map(({ name, modelUrl }) => ({ name, modelUrl }));

      return isNil(savedPlayers)
        ? createTensorflowPlayers(POPULATION_SIZE)
        : loadTensorflowPlayers(savedPlayers);
    },

    scoreCalculatorBuilder: singlePendulumScoreCalculatorBuilder,

    competitionForPlayerCompleted(_: TPlayer, score: number): boolean {
      return score < HALT_PLAYER_SCORE_PER_MS * FITNESS_RUN_INTERVAL;
    },

    competitionCompleted(timeStep: DOMHighResTimeStamp): boolean {
      return timeStep >= FITNESS_RUN_INTERVAL;
    },

    async restartCompetition(playersWithScore: IScoredPlayer[], timeStep: DOMHighResTimeStamp) {
      completedGenerationsCount++;

      const players = await Promise.all(
        playersWithScore
          .filter(
            (playerWithScore: IScoredPlayer): playerWithScore is IScoredPlayer<IRobotPlayer> =>
              playerWithScore.player.type === EPlayerType.Robot
          )
          .map(async ({ player, score }) => {
            const modelUrl = buildRobotModelUrl(competitionStart, player.name);

            await player.save(modelUrl);

            return {
              name: player.name,
              modelUrl,
              score,
            };
          })
      );

      onGenerationCompleted({
        id: completedGenerationsCount,
        maxScore: max(playersWithScore.map(({ score }) => score)) ?? 0,
        players: players.sort((first, second) => second.score - first.score),
      });

      return breedNextGeneration(playersWithScore, timeStep, completedGenerationsCount);
    },
  };
}
