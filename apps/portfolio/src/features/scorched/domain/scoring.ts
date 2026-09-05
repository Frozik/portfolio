import {
  CASH_PER_POINT,
  SELF_DAMAGE_POINTS_MULTIPLIER,
  STANDARD_KILL_POINTS,
  STANDARD_POINTS_PER_DAMAGE,
} from './constants';
import type { PlayerId } from './types';

export interface DamageRecord {
  /** Undefined for damage nobody caused — a fall onto collapsing dirt, for instance. */
  readonly dealerId: PlayerId | undefined;
  readonly targetId: PlayerId;
  readonly amount: number;
}

export interface KillRecord {
  readonly killerId: PlayerId | undefined;
  readonly victimId: PlayerId;
}

export interface RoundOutcome {
  readonly damages: readonly DamageRecord[];
  readonly kills: readonly KillRecord[];
  /** [MANUAL §8] Players who took the helicopter out rather than fight it to the end. */
  readonly retreatedIds: readonly PlayerId[];
}

export interface RoundScore {
  readonly playerId: PlayerId;
  readonly points: number;
  readonly cash: number;
}

export interface MatchStanding {
  readonly playerId: PlayerId;
  readonly kills: number;
  readonly points: number;
}

/**
 * [MANUAL §8] STANDARD scoring: damage scores continuously as it is dealt and a kill adds a
 * bonus on top. Damage a player deals to itself scores against it instead of for it.
 */
export function scoreRound(
  playerIds: readonly PlayerId[],
  outcome: RoundOutcome
): readonly RoundScore[] {
  const pointsByPlayer = new Map<PlayerId, number>(playerIds.map(playerId => [playerId, 0]));

  const addPoints = (playerId: PlayerId | undefined, points: number): void => {
    if (playerId === undefined || !pointsByPlayer.has(playerId)) {
      return;
    }

    pointsByPlayer.set(playerId, (pointsByPlayer.get(playerId) ?? 0) + points);
  };

  for (const damage of outcome.damages) {
    const isSelfInflicted = damage.dealerId === damage.targetId;
    const multiplier = isSelfInflicted ? SELF_DAMAGE_POINTS_MULTIPLIER : 1;

    addPoints(damage.dealerId, damage.amount * STANDARD_POINTS_PER_DAMAGE * multiplier);
  }

  for (const kill of outcome.kills) {
    if (outcome.retreatedIds.includes(kill.victimId)) {
      continue;
    }

    const multiplier = kill.killerId === kill.victimId ? SELF_DAMAGE_POINTS_MULTIPLIER : 1;

    addPoints(kill.killerId, STANDARD_KILL_POINTS * multiplier);
  }

  return playerIds.map(playerId => {
    const points = outcome.retreatedIds.includes(playerId)
      ? 0
      : (pointsByPlayer.get(playerId) ?? 0);

    return { playerId, points, cash: Math.max(0, Math.floor(points * CASH_PER_POINT)) };
  });
}

/** Kills that count towards the match: a retreat denies the shooter their bounty. */
export function countScoringKills(outcome: RoundOutcome, playerId: PlayerId): number {
  return outcome.kills.filter(
    kill =>
      kill.killerId === playerId &&
      kill.victimId !== playerId &&
      !outcome.retreatedIds.includes(kill.victimId)
  ).length;
}

/** What the result screen celebrates: the round's single hardest hit and its top gun. */
export interface RoundHighlight {
  readonly playerId: PlayerId;
  readonly amount: number;
}

/** Damage a tank did to itself is never a highlight — the result screen celebrates marksmanship. */
function isScoringDamage(damage: DamageRecord): boolean {
  return damage.dealerId !== undefined && damage.dealerId !== damage.targetId && damage.amount > 0;
}

export function findBiggestHit(outcome: RoundOutcome): RoundHighlight | undefined {
  return outcome.damages
    .filter(isScoringDamage)
    .reduce<RoundHighlight | undefined>(
      (biggest, damage) =>
        damage.dealerId === undefined || (biggest !== undefined && damage.amount <= biggest.amount)
          ? biggest
          : { playerId: damage.dealerId, amount: damage.amount },
      undefined
    );
}

export function findTopDamageDealer(outcome: RoundOutcome): RoundHighlight | undefined {
  const totals = new Map<PlayerId, number>();

  for (const damage of outcome.damages.filter(isScoringDamage)) {
    if (damage.dealerId !== undefined) {
      totals.set(damage.dealerId, (totals.get(damage.dealerId) ?? 0) + damage.amount);
    }
  }

  return [...totals].reduce<RoundHighlight | undefined>(
    (best, [playerId, amount]) =>
      best !== undefined && amount <= best.amount ? best : { playerId, amount },
    undefined
  );
}

/** [WIKI §8] Most kills across the whole match takes it; points break the tie. */
export function rankStandings(standings: readonly MatchStanding[]): readonly MatchStanding[] {
  return [...standings].sort(
    (first, second) => second.kills - first.kills || second.points - first.points
  );
}
