import { assert } from '@frozik/utils';
import { clamp, isNil, orderBy, shuffle, sum } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import { TensorflowPlayer } from '../players/TensorflowPlayer';
import type { IPendulumOptions, IRobotPlayer, IScoredPlayer, TPlayer } from '../types';
import { EPlayerType } from '../types';
import {
  HALT_PLAYER_SCORE_PER_MS,
  HIGH_SCORE_PER_MS,
  LOW_PLAYER_SCORE_PER_MS,
  MEDIUM_SCORE_PER_MS,
} from './constants';

enum EAction {
  Mutate = 'mutate',
  AggressiveMutation = 'mutate-aggressive',
  Crossover = 'crossover',
  Pick = 'pick',
  New = 'new',
}

export function singlePendulumGenerationBuilder(populationSize: number, maxRuns: number) {
  return async (
    playersWithScore: IScoredPlayer[],
    timeStep: DOMHighResTimeStamp,
    runsPassed: number
  ): Promise<
    false | (TPlayer | { player: TPlayer; pendulumOptions: Partial<IPendulumOptions> })[]
  > => {
    if (runsPassed >= maxRuns) {
      return false;
    }

    const partSize = Math.trunc(Math.min(playersWithScore.length, populationSize) / 5);

    const orderedPlayersWithScores = orderBy(playersWithScore, ({ score }) => score, 'desc').filter(
      (playerWithScore: IScoredPlayer): playerWithScore is IScoredPlayer<IRobotPlayer> =>
        playerWithScore.player.type === EPlayerType.Robot
    );

    const newPopulation: (
      | IRobotPlayer
      | { player: IRobotPlayer; pendulumOptions: Partial<IPendulumOptions> }
    )[] = [];

    for (const { player, score } of orderedPlayersWithScores.slice(0, partSize)) {
      if (score <= timeStep * HALT_PLAYER_SCORE_PER_MS) {
        newPopulation.push(await player.mutate(0.02));
      } else if (score <= timeStep * LOW_PLAYER_SCORE_PER_MS) {
        newPopulation.push(await player.mutate(0.005));
        newPopulation.push(await player.mutate(0.05));
        newPopulation.push(await player.mutate(0.1));
      } else {
        newPopulation.push(putPlayerInRandomPosition(player, timeStep, score));
      }
    }

    for (let index = 0; index < partSize; index++) {
      const bestPlayer = newPopulation[index];
      if (!('player' in bestPlayer) && !isNil(bestPlayer.mutate)) {
        newPopulation.push(await bestPlayer.mutate(0.01));
        newPopulation.push(await bestPlayer.mutate(0.05));
      }
    }

    const shuffledPlayers = shuffle(orderedPlayersWithScores.slice(partSize));

    while (newPopulation.length < populationSize) {
      const action = actionRandom(
        { action: EAction.Mutate, probability: 50 },
        { action: EAction.AggressiveMutation, probability: 5 },
        { action: EAction.Crossover, probability: 10 },
        { action: EAction.Pick, probability: 5 },
        { action: EAction.New, probability: 1 }
      );

      switch (action) {
        case EAction.Mutate: {
          const randomPlayer = pickRandomArrayElement(orderedPlayersWithScores).player;

          newPopulation.push(await randomPlayer.mutate(0.1));

          break;
        }
        case EAction.AggressiveMutation: {
          const randomPlayer = pickRandomArrayElement(orderedPlayersWithScores).player;

          newPopulation.push(await randomPlayer.mutate(0.2));

          break;
        }
        case EAction.Crossover: {
          const randomPlayer1 = pickRandomArrayElement(orderedPlayersWithScores).player;
          const randomPlayer2 = pickRandomArrayElement(orderedPlayersWithScores).player;

          if (randomPlayer1 !== randomPlayer2 && !isNil(randomPlayer1.crossoverModels)) {
            newPopulation.push(await randomPlayer1.crossoverModels(randomPlayer2));
          }

          break;
        }
        case EAction.Pick: {
          if (shuffledPlayers.length > 0) {
            const { player } = shuffledPlayers.splice(0, 1)[0];

            newPopulation.push(player);
          }

          break;
        }
        case EAction.New: {
          newPopulation.push(new TensorflowPlayer());

          break;
        }
      }
    }

    return newPopulation;
  };
}

function putPlayerInRandomPosition(
  player: IRobotPlayer,
  timeStep: DOMHighResTimeStamp,
  score: number
): IRobotPlayer | { player: IRobotPlayer; pendulumOptions: Partial<IPendulumOptions> } {
  if (score <= timeStep * MEDIUM_SCORE_PER_MS) {
    return player;
  }

  const positionMaxOffset = clamp(score / (timeStep * HIGH_SCORE_PER_MS), 0, RAILS_HALF_LENGTH);

  if (positionMaxOffset === 0) {
    return player;
  }

  const pendulumOptions: Partial<IPendulumOptions> = {
    pivotPosition: randomNumber(-positionMaxOffset, positionMaxOffset),
  };

  return { player, pendulumOptions };
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

function pickRandomArrayElement<T>(array: T[]): T {
  return array[Math.trunc(Math.random() * array.length)];
}

function actionRandom<TAction>(...actions: { action: TAction; probability: number }[]): TAction {
  assert(actions.length > 0, 'Actions must not be empty');

  const probabilitySum = sum(actions.map(({ probability }) => probability));

  const randomValue = Math.random() * probabilitySum;

  let currentProbability = 0;

  for (const { action, probability } of actions) {
    currentProbability += probability;

    if (randomValue < currentProbability) {
      return action;
    }
  }

  return actions[actions.length - 1].action;
}
