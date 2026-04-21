import { isNil } from 'lodash-es';

import type { CardId, ClientId, GroupId, VotesByTarget } from './types';
import { ERetroPhase } from './types';

/**
 * Total votes this client has cast across all targets.
 */
export function countVotesUsedByClient(votes: VotesByTarget, clientId: ClientId): number {
  let total = 0;

  votes.forEach(votesForTarget => {
    total += votesForTarget.get(clientId) ?? 0;
  });

  return total;
}

/**
 * How many votes this client has placed on a single target.
 */
export function countClientVotesOnTarget(
  votes: VotesByTarget,
  targetId: CardId | GroupId,
  clientId: ClientId
): number {
  const votesForTarget = votes.get(targetId);

  if (isNil(votesForTarget)) {
    return 0;
  }

  return votesForTarget.get(clientId) ?? 0;
}

/**
 * Sum of all votes on a target. Only safe to reveal after the Vote phase.
 */
export function countTotalVotesOnTarget(votes: VotesByTarget, targetId: CardId | GroupId): number {
  const votesForTarget = votes.get(targetId);

  if (isNil(votesForTarget)) {
    return 0;
  }

  let total = 0;
  votesForTarget.forEach(count => {
    total += count;
  });
  return total;
}

/**
 * Maximum number of votes one client may pile on a single target —
 * half of their total allowance, rounded up, per Parabol guidance.
 */
export function getPerTargetVoteLimit(votesPerParticipant: number): number {
  return Math.ceil(votesPerParticipant / 2);
}

export enum EVoteRejectionReason {
  NotInVotePhase = 'notInVotePhase',
  AllowanceExhausted = 'allowanceExhausted',
  PerTargetLimitReached = 'perTargetLimitReached',
}

export type VoteAttemptResult =
  | { allowed: true }
  | { allowed: false; reason: EVoteRejectionReason };

/**
 * Decide whether a client may place one more vote on a given target under
 * the current phase and allowance configuration.
 */
export function canPlaceVote(params: {
  phase: ERetroPhase;
  votes: VotesByTarget;
  targetId: CardId | GroupId;
  clientId: ClientId;
  votesPerParticipant: number;
}): VoteAttemptResult {
  const { phase, votes, targetId, clientId, votesPerParticipant } = params;

  if (phase !== ERetroPhase.Vote) {
    return { allowed: false, reason: EVoteRejectionReason.NotInVotePhase };
  }

  if (countVotesUsedByClient(votes, clientId) >= votesPerParticipant) {
    return { allowed: false, reason: EVoteRejectionReason.AllowanceExhausted };
  }

  if (
    countClientVotesOnTarget(votes, targetId, clientId) >=
    getPerTargetVoteLimit(votesPerParticipant)
  ) {
    return { allowed: false, reason: EVoteRejectionReason.PerTargetLimitReached };
  }

  return { allowed: true };
}

/**
 * Returns true when a client may retract a vote they have placed. Allowed
 * in Vote phase only; no-op otherwise.
 */
export function canRetractVote(
  phase: ERetroPhase,
  votes: VotesByTarget,
  targetId: CardId | GroupId,
  clientId: ClientId
): boolean {
  if (phase !== ERetroPhase.Vote) {
    return false;
  }

  return countClientVotesOnTarget(votes, targetId, clientId) > 0;
}

/**
 * Sort descriptor exposed during Discuss: targets ordered by total votes.
 */
export interface IRankedTarget<TId extends CardId | GroupId> {
  targetId: TId;
  totalVotes: number;
}

export function rankTargetsByVotes<TId extends CardId | GroupId>(
  targetIds: readonly TId[],
  votes: VotesByTarget
): IRankedTarget<TId>[] {
  return targetIds
    .map(targetId => ({
      targetId,
      totalVotes: countTotalVotesOnTarget(votes, targetId),
    }))
    .sort((first, second) => second.totalVotes - first.totalVotes);
}
