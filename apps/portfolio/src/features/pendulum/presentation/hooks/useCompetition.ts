import { useFunction } from '@frozik/components';
import { isSyncedValueDescriptor } from '@frozik/utils';
import { isNil, max } from 'lodash-es';
import { useEffect, useState } from 'react';
import { usePendulumStore } from '../../application/usePendulumStore';
import { HALT_PLAYER_SCORE_PER_MS } from '../../domain/genetic/constants';
import { createTensorflowPlayers } from '../../domain/genetic/createTensorflowPlayers';
import { loadTensorflowPlayers } from '../../domain/genetic/loadTensorflowPlayers';
import { singlePendulumGenerationBuilder } from '../../domain/genetic/singlePendulumGenerationBuilder';
import { singlePendulumScoreCalculatorBuilder } from '../../domain/genetic/singlePendulumScoreCalculatorBuilder';
import type { ICompetition, IRobotPlayer, IScoredPlayer, TPlayer } from '../../domain/types';
import { EPlayerType } from '../../domain/types';

const POPULATION_SIZE = 30;
const MAX_RUNS = 10_000;
const FITNESS_RUN_INTERVAL = 20_000;

export function useCompetition(): ICompetition | undefined {
  const store = usePendulumStore();

  const currentCompetition = store.currentCompetition;

  const [competition, setCompetition] = useState<ICompetition | undefined>();

  const createCompetition = useFunction(async () => {
    if (!isSyncedValueDescriptor(currentCompetition)) {
      return;
    }

    const { competitionStart, generations } = currentCompetition.value;

    const competitionProlongation = singlePendulumGenerationBuilder(POPULATION_SIZE, MAX_RUNS);

    const savedPlayers = generations
      ?.at(-1)
      ?.players.map(({ name, modelUrl }: { name: string; modelUrl: string }) => ({
        name,
        modelUrl,
      }));

    let count = generations?.length ?? 0;

    const competition: ICompetition = {
      start: competitionStart,

      get generationsCount(): number {
        return count;
      },

      init: isNil(savedPlayers)
        ? createTensorflowPlayers.bind(undefined, POPULATION_SIZE)
        : loadTensorflowPlayers.bind(undefined, savedPlayers),

      scoreCalculatorBuilder: singlePendulumScoreCalculatorBuilder,

      competitionForPlayerCompleted(_: TPlayer, score: number): boolean {
        return score < HALT_PLAYER_SCORE_PER_MS * FITNESS_RUN_INTERVAL;
      },

      competitionCompleted(timeStep: DOMHighResTimeStamp): boolean {
        return timeStep >= FITNESS_RUN_INTERVAL;
      },

      async restartCompetition(playersWithScore: IScoredPlayer[], timeStep: DOMHighResTimeStamp) {
        count++;

        const players = await Promise.all(
          playersWithScore
            .filter(
              (playerWithScore: IScoredPlayer): playerWithScore is IScoredPlayer<IRobotPlayer> =>
                playerWithScore.player.type === EPlayerType.Robot
            )
            .map(async ({ player, score }) => {
              const modelUrl = `indexeddb://${competition.start}-player-${player.name}}`;

              await player.save(modelUrl);

              return {
                name: player.name,
                modelUrl,
                score,
              };
            })
        );

        store.addCompetitionRun({
          competitionStart,
          generation: {
            id: count,
            maxScore: max(playersWithScore.map(({ score }) => score)) ?? 0,
            players: players.sort((a, b) => b.score - a.score),
          },
        });

        return competitionProlongation(playersWithScore, timeStep, count);
      },
    };

    setCompetition(competition);
  });

  const competitionStart = isSyncedValueDescriptor(currentCompetition)
    ? currentCompetition.value.competitionStart
    : undefined;

  useEffect(() => {
    if (isNil(competitionStart)) {
      setCompetition(undefined);
    } else {
      void createCompetition();
    }
  }, [createCompetition, competitionStart]);

  return competition;
}
