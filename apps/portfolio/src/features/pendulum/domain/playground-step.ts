import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { advanceWorld } from './physics/advanceWorld';
import type {
  ICompetition,
  IEnvironment,
  INextGenerationEntry,
  IScoredPlayer,
  IWorld,
  TCompetitionOutcome,
  TPlayer,
} from './types';

interface ICompetitionMembership {
  readonly competition: ICompetition;
  readonly scoreOf: (world: IWorld, deltaTime: DOMHighResTimeStamp) => number;
}

export interface IPlaygroundEntry {
  readonly player: TPlayer;
  readonly world: IWorld;
  readonly active: boolean;
  readonly membership: ICompetitionMembership | undefined;
  readonly score: number;
}

export interface IRunningCompetition {
  readonly competition: ICompetition;
  readonly elapsed: DOMHighResTimeStamp;
}

export interface IPlaygroundState {
  readonly entries: readonly IPlaygroundEntry[];
  readonly competitions: readonly IRunningCompetition[];
}

export type TSpawnEntry = (
  competition: ICompetition,
  next: INextGenerationEntry
) => IPlaygroundEntry;

export const EMPTY_PLAYGROUND_STATE: IPlaygroundState = { entries: [], competitions: [] };

/** One physics step for every active entry, then the competition clocks. */
export function advancePlayground(
  state: IPlaygroundState,
  deltaTime: DOMHighResTimeStamp,
  environment: IEnvironment
): IPlaygroundState {
  const competitions = state.competitions.map(running => ({
    ...running,
    elapsed: running.elapsed + deltaTime,
  }));
  const timedOut = new Set(
    competitions
      .filter(({ competition, elapsed }) => competition.competitionCompleted(elapsed))
      .map(({ competition }) => competition)
  );

  const elapsedOf = new Map(
    competitions.map(({ competition, elapsed }) => [competition, elapsed] as const)
  );

  const entries = state.entries
    .map(entry => advanceEntry(entry, deltaTime, environment, elapsedOf))
    .map(entry =>
      !isNil(entry.membership) && timedOut.has(entry.membership.competition)
        ? { ...entry, active: false }
        : entry
    );

  return { entries, competitions };
}

function advanceEntry(
  entry: IPlaygroundEntry,
  deltaTime: DOMHighResTimeStamp,
  environment: IEnvironment,
  elapsedOf: ReadonlyMap<ICompetition, DOMHighResTimeStamp>
): IPlaygroundEntry {
  if (!entry.active) {
    return entry;
  }

  const action = entry.player.play(entry.world, deltaTime);
  const world = advanceWorld(entry.world, deltaTime, action, environment);

  if (isNil(entry.membership)) {
    return { ...entry, world };
  }

  const { competition } = entry.membership;
  const score = entry.score + entry.membership.scoreOf(world, deltaTime);
  const halted = competition.competitionForPlayerCompleted(
    entry.player,
    score,
    elapsedOf.get(competition) ?? 0
  );

  return { ...entry, world, score, active: !halted };
}

/** Competitions none of whose members are still running. */
export function findSettledCompetitions(state: IPlaygroundState): readonly IRunningCompetition[] {
  return state.competitions.filter(({ competition }) =>
    membersOf(state, competition).every(({ active }) => !active)
  );
}

export function scoredMembersOf(
  state: IPlaygroundState,
  competition: ICompetition
): readonly IScoredPlayer[] {
  return membersOf(state, competition).map(({ player, score }) => ({ player, score }));
}

/**
 * Replaces a settled competition's members with the outcome's next generation.
 * Members the outcome dropped are disposed here, as the playground was their
 * owner.
 */
export function applyCompetitionOutcome(
  state: IPlaygroundState,
  settled: IRunningCompetition,
  outcome: TCompetitionOutcome,
  spawnEntry: TSpawnEntry
): IPlaygroundState {
  const { competition } = settled;
  const members = membersOf(state, competition);
  const others = state.entries.filter(entry => entry.membership?.competition !== competition);

  switch (outcome.kind) {
    case 'finished': {
      for (const { player } of members) {
        player.dispose();
      }
      return {
        entries: others,
        competitions: state.competitions.filter(running => running !== settled),
      };
    }
    case 'nextGeneration': {
      const survivors = new Set(outcome.entries.map(({ player }) => player));
      for (const { player } of members) {
        if (!survivors.has(player)) {
          player.dispose();
        }
      }
      return {
        entries: [...others, ...outcome.entries.map(next => spawnEntry(competition, next))],
        competitions: state.competitions.map(running =>
          running === settled ? { ...running, elapsed: 0 } : running
        ),
      };
    }
    default:
      return assertNever(outcome);
  }
}

export function disposeOutcomePlayers(outcome: TCompetitionOutcome): void {
  if (outcome.kind === 'nextGeneration') {
    for (const { player } of outcome.entries) {
      player.dispose();
    }
  }
}

function membersOf(
  state: IPlaygroundState,
  competition: ICompetition
): readonly IPlaygroundEntry[] {
  return state.entries.filter(entry => entry.membership?.competition === competition);
}
