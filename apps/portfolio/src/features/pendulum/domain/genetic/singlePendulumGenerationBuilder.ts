import { assert } from '@frozik/utils/assert/assert';
import { clamp, orderBy, sample, sampleSize, sum } from 'lodash-es';

import { RAILS_HALF_LENGTH } from '../constants';
import type {
  INextGenerationEntry,
  IPendulumOptions,
  IRobotPlayer,
  IScoredPlayer,
  TCompetitionOutcome,
} from '../types';
import { isScoredRobot } from '../types';
import { MAX_SCORE_PER_MS, SEASONED_SCORE_PER_MS } from './constants';
import { episodesOf } from './episodes';

enum EAction {
  Mutate = 'mutate',
  Crossover = 'crossover',
  New = 'new',
}

interface IRobotEntry extends INextGenerationEntry {
  readonly player: IRobotPlayer;
  readonly pendulumOptions?: Partial<IPendulumOptions>;
}

// Fraction of the population kept as elite survivors each generation (top 1/5th).
const ELITE_FRACTION_DIVISOR = 5;

// Gaussian noise scales applied to network weights.
const ELITE_MUTATION_RATES = [0.02, 0.1] as const;
const MUTATION_RATES = [0.02, 0.05, 0.1, 0.2] as const;

// Parents are the best of this many robots drawn at random from the ranking.
const TOURNAMENT_SIZE = 3;

// Relative probabilities for breeding actions when filling the rest of the population.
const MUTATE_PROBABILITY = 70;
const CROSSOVER_PROBABILITY = 25;
const NEW_PLAYER_PROBABILITY = 5;

/**
 * Elitism plus tournament selection: the best fifth survives untouched (the
 * seasoned ones from a random rail position, so they generalise), every
 * survivor gets a near and a far mutant, and the rest of the population is
 * bred from tournament-picked parents so the pressure stays on the top while
 * the bottom still contributes genes. Scores arrive summed per robot; every
 * robot goes out again with its episodes.
 */
export function singlePendulumGenerationBuilder(
  populationSize: number,
  maxRuns: number,
  createRobot: () => IRobotPlayer
) {
  return async (
    playersWithScore: readonly IScoredPlayer[],
    timeStep: DOMHighResTimeStamp,
    runsPassed: number
  ): Promise<TCompetitionOutcome> => {
    if (runsPassed >= maxRuns) {
      return { kind: 'finished' };
    }

    const ranked = orderBy(playersWithScore.filter(isScoredRobot), ({ score }) => score, 'desc');
    const eliteCount = Math.trunc(Math.min(ranked.length, populationSize) / ELITE_FRACTION_DIVISOR);
    const elite = ranked.slice(0, eliteCount);

    const newPopulation: IRobotEntry[] = elite.map(({ player, score }) =>
      startSeasonedAnywhere(player, score / timeStep)
    );

    for (const { player } of elite) {
      for (const mutationRate of ELITE_MUTATION_RATES) {
        newPopulation.push({ player: await player.mutate(mutationRate) });
      }
    }

    while (newPopulation.length < populationSize) {
      const action = actionRandom(
        { action: EAction.Mutate, probability: MUTATE_PROBABILITY },
        { action: EAction.Crossover, probability: CROSSOVER_PROBABILITY },
        { action: EAction.New, probability: NEW_PLAYER_PROBABILITY }
      );

      switch (action) {
        case EAction.Mutate: {
          const parent = tournamentWinner(ranked);
          newPopulation.push({ player: await parent.mutate(sample(MUTATION_RATES)) });
          break;
        }
        case EAction.Crossover: {
          const father = tournamentWinner(ranked);
          const mother = tournamentWinner(ranked);
          if (father !== mother) {
            newPopulation.push({ player: await father.crossoverModels(mother) });
          }
          break;
        }
        case EAction.New: {
          newPopulation.push({ player: createRobot() });
          break;
        }
      }
    }

    return {
      kind: 'nextGeneration',
      entries: newPopulation.flatMap(({ player, pendulumOptions }) =>
        episodesOf(player, pendulumOptions)
      ),
    };
  };
}

/** A robot that balances most of its run starts the next one away from the centre, the better the farther. */
function startSeasonedAnywhere(player: IRobotPlayer, scorePerMs: number): IRobotEntry {
  if (scorePerMs < SEASONED_SCORE_PER_MS) {
    return { player };
  }

  const reach =
    clamp((scorePerMs - SEASONED_SCORE_PER_MS) / (MAX_SCORE_PER_MS - SEASONED_SCORE_PER_MS), 0, 1) *
    RAILS_HALF_LENGTH;

  return { player, pendulumOptions: { pivotPosition: randomNumber(-reach, reach) } };
}

/** The ranking is ordered best first, so the winner is the lowest index drawn. */
function tournamentWinner(ranked: readonly IScoredPlayer<IRobotPlayer>[]): IRobotPlayer {
  assert(ranked.length > 0, 'Cannot breed from an empty population');

  const contestants = sampleSize(ranked, TOURNAMENT_SIZE);
  return contestants.reduce((best, candidate) => (candidate.score > best.score ? candidate : best))
    .player;
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
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
