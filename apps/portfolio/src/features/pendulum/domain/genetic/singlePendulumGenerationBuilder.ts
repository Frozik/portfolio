import { assert } from '@frozik/utils/assert/assert';
import { clamp, isNil, orderBy, shuffle, sum } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import { TensorflowPlayer } from '../players/TensorflowPlayer';
import type {
  INextGenerationEntry,
  IPendulumOptions,
  IRobotPlayer,
  IScoredPlayer,
  TCompetitionOutcome,
} from '../types';
import { isScoredRobot } from '../types';
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

interface IRobotEntry extends INextGenerationEntry {
  readonly player: IRobotPlayer;
  readonly pendulumOptions?: Partial<IPendulumOptions>;
}

// Fraction of the population kept as elite survivors each generation (top 1/5th).
const ELITE_FRACTION_DIVISOR = 5;

// Mutation rates (gaussian noise scale applied to network weights) by survivor tier.
const HALT_PLAYER_MUTATION_RATE = 0.02;
const LOW_PLAYER_MUTATION_RATES = [0.005, 0.05, 0.1] as const;
const ELITE_MUTATION_RATES = [0.01, 0.05] as const;

// Mutation rates used by the random-action breeding phase.
const STANDARD_MUTATION_RATE = 0.1;
const AGGRESSIVE_MUTATION_RATE = 0.2;

// Relative probabilities for breeding actions when filling the rest of the population.
const MUTATE_PROBABILITY = 50;
const AGGRESSIVE_MUTATION_PROBABILITY = 5;
const CROSSOVER_PROBABILITY = 10;
const PICK_PROBABILITY = 5;
const NEW_PLAYER_PROBABILITY = 1;

export function singlePendulumGenerationBuilder(populationSize: number, maxRuns: number) {
  return async (
    playersWithScore: readonly IScoredPlayer[],
    timeStep: DOMHighResTimeStamp,
    runsPassed: number
  ): Promise<TCompetitionOutcome> => {
    if (runsPassed >= maxRuns) {
      return { kind: 'finished' };
    }

    const partSize = Math.trunc(
      Math.min(playersWithScore.length, populationSize) / ELITE_FRACTION_DIVISOR
    );

    const orderedPlayersWithScores = orderBy(playersWithScore, ({ score }) => score, 'desc').filter(
      isScoredRobot
    );

    const newPopulation: IRobotEntry[] = [];

    for (const { player, score } of orderedPlayersWithScores.slice(0, partSize)) {
      if (score <= timeStep * HALT_PLAYER_SCORE_PER_MS) {
        newPopulation.push({ player: await player.mutate(HALT_PLAYER_MUTATION_RATE) });
      } else if (score <= timeStep * LOW_PLAYER_SCORE_PER_MS) {
        for (const mutationRate of LOW_PLAYER_MUTATION_RATES) {
          newPopulation.push({ player: await player.mutate(mutationRate) });
        }
      } else {
        newPopulation.push(putPlayerInRandomPosition(player, timeStep, score));
      }
    }

    // Only survivors kept at the rail center seed the elite mutations.
    for (const { player, pendulumOptions } of newPopulation.slice(0, partSize)) {
      if (isNil(pendulumOptions)) {
        for (const mutationRate of ELITE_MUTATION_RATES) {
          newPopulation.push({ player: await player.mutate(mutationRate) });
        }
      }
    }

    const shuffledPlayers = shuffle(orderedPlayersWithScores.slice(partSize));

    while (newPopulation.length < populationSize) {
      const action = actionRandom(
        { action: EAction.Mutate, probability: MUTATE_PROBABILITY },
        { action: EAction.AggressiveMutation, probability: AGGRESSIVE_MUTATION_PROBABILITY },
        { action: EAction.Crossover, probability: CROSSOVER_PROBABILITY },
        { action: EAction.Pick, probability: PICK_PROBABILITY },
        { action: EAction.New, probability: NEW_PLAYER_PROBABILITY }
      );

      switch (action) {
        case EAction.Mutate: {
          const randomPlayer = pickRandomArrayElement(orderedPlayersWithScores).player;

          newPopulation.push({ player: await randomPlayer.mutate(STANDARD_MUTATION_RATE) });

          break;
        }
        case EAction.AggressiveMutation: {
          const randomPlayer = pickRandomArrayElement(orderedPlayersWithScores).player;

          newPopulation.push({ player: await randomPlayer.mutate(AGGRESSIVE_MUTATION_RATE) });

          break;
        }
        case EAction.Crossover: {
          const randomPlayer1 = pickRandomArrayElement(orderedPlayersWithScores).player;
          const randomPlayer2 = pickRandomArrayElement(orderedPlayersWithScores).player;

          if (randomPlayer1 !== randomPlayer2) {
            newPopulation.push({ player: await randomPlayer1.crossoverModels(randomPlayer2) });
          }

          break;
        }
        case EAction.Pick: {
          const picked = shuffledPlayers.pop();
          if (!isNil(picked)) {
            newPopulation.push({ player: picked.player });
          }

          break;
        }
        case EAction.New: {
          newPopulation.push({ player: new TensorflowPlayer() });

          break;
        }
      }
    }

    return { kind: 'nextGeneration', entries: newPopulation };
  };
}

function putPlayerInRandomPosition(
  player: IRobotPlayer,
  timeStep: DOMHighResTimeStamp,
  score: number
): IRobotEntry {
  if (score <= timeStep * MEDIUM_SCORE_PER_MS) {
    return { player };
  }

  const positionMaxOffset = clamp(score / (timeStep * HIGH_SCORE_PER_MS), 0, RAILS_HALF_LENGTH);

  if (positionMaxOffset === 0) {
    return { player };
  }

  return {
    player,
    pendulumOptions: { pivotPosition: randomNumber(-positionMaxOffset, positionMaxOffset) },
  };
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

function pickRandomArrayElement<TElement>(array: readonly TElement[]): TElement {
  return array[Math.trunc(Math.random() * array.length)];
}

function actionRandom<TAction>(
  ...actions: readonly { readonly action: TAction; readonly probability: number }[]
): TAction {
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
