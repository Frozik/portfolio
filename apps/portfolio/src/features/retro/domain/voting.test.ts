import type { CardId, ClientId, GroupId, VotesByTarget } from './types';
import { ERetroPhase } from './types';
import {
  canPlaceVote,
  canRetractVote,
  countClientVotesOnTarget,
  countTotalVotesOnTarget,
  countVotesUsedByClient,
  EVoteRejectionReason,
  getPerTargetVoteLimit,
  rankTargetsByVotes,
} from './voting';

const ALICE = 1 as ClientId;
const BOB = 2 as ClientId;

const CARD_A = 'card-a' as CardId;
const CARD_B = 'card-b' as CardId;
const GROUP_X = 'group-x' as GroupId;

function makeVotes(
  entries: readonly [CardId | GroupId, ReadonlyArray<readonly [ClientId, number]>][]
): VotesByTarget {
  const result = new Map<CardId | GroupId, Map<ClientId, number>>();

  for (const [target, clientVotes] of entries) {
    result.set(target, new Map(clientVotes));
  }

  return result;
}

describe('countVotesUsedByClient', () => {
  it('sums a client votes across targets', () => {
    const votes = makeVotes([
      [
        CARD_A,
        [
          [ALICE, 2],
          [BOB, 1],
        ],
      ],
      [CARD_B, [[ALICE, 1]]],
    ]);

    expect(countVotesUsedByClient(votes, ALICE)).toBe(3);
    expect(countVotesUsedByClient(votes, BOB)).toBe(1);
  });

  it('returns 0 for a client with no votes', () => {
    const votes = makeVotes([]);

    expect(countVotesUsedByClient(votes, ALICE)).toBe(0);
  });
});

describe('countClientVotesOnTarget', () => {
  it('returns the client vote count for a target', () => {
    const votes = makeVotes([[CARD_A, [[ALICE, 2]]]]);

    expect(countClientVotesOnTarget(votes, CARD_A, ALICE)).toBe(2);
  });

  it('returns 0 when the target is not in the map', () => {
    const votes = makeVotes([]);

    expect(countClientVotesOnTarget(votes, CARD_A, ALICE)).toBe(0);
  });
});

describe('countTotalVotesOnTarget', () => {
  it('sums votes across clients for a target', () => {
    const votes = makeVotes([
      [
        CARD_A,
        [
          [ALICE, 2],
          [BOB, 3],
        ],
      ],
    ]);

    expect(countTotalVotesOnTarget(votes, CARD_A)).toBe(5);
  });
});

describe('getPerTargetVoteLimit', () => {
  it('is ceil(votesPerParticipant / 2)', () => {
    expect(getPerTargetVoteLimit(5)).toBe(3);
    expect(getPerTargetVoteLimit(4)).toBe(2);
    expect(getPerTargetVoteLimit(1)).toBe(1);
  });
});

describe('canPlaceVote', () => {
  it('rejects when not in vote phase', () => {
    const result = canPlaceVote({
      phase: ERetroPhase.Brainstorm,
      votes: makeVotes([]),
      targetId: CARD_A,
      clientId: ALICE,
      votesPerParticipant: 5,
    });

    expect(result).toEqual({
      allowed: false,
      reason: EVoteRejectionReason.NotInVotePhase,
    });
  });

  it('rejects when allowance is exhausted', () => {
    const votes = makeVotes([[CARD_A, [[ALICE, 5]]]]);

    const result = canPlaceVote({
      phase: ERetroPhase.Vote,
      votes,
      targetId: CARD_B,
      clientId: ALICE,
      votesPerParticipant: 5,
    });

    expect(result).toEqual({
      allowed: false,
      reason: EVoteRejectionReason.AllowanceExhausted,
    });
  });

  it('rejects when per-target limit is reached', () => {
    // limit for 5 is ceil(5/2) = 3
    const votes = makeVotes([[CARD_A, [[ALICE, 3]]]]);

    const result = canPlaceVote({
      phase: ERetroPhase.Vote,
      votes,
      targetId: CARD_A,
      clientId: ALICE,
      votesPerParticipant: 5,
    });

    expect(result).toEqual({
      allowed: false,
      reason: EVoteRejectionReason.PerTargetLimitReached,
    });
  });

  it('allows when phase, allowance and per-target limit are satisfied', () => {
    const votes = makeVotes([[CARD_A, [[ALICE, 1]]]]);

    const result = canPlaceVote({
      phase: ERetroPhase.Vote,
      votes,
      targetId: CARD_A,
      clientId: ALICE,
      votesPerParticipant: 5,
    });

    expect(result).toEqual({ allowed: true });
  });
});

describe('canRetractVote', () => {
  it('returns true when a client has at least one vote on the target during Vote phase', () => {
    const votes = makeVotes([[CARD_A, [[ALICE, 1]]]]);

    expect(canRetractVote(ERetroPhase.Vote, votes, CARD_A, ALICE)).toBe(true);
  });

  it('returns false when the client has no votes on the target', () => {
    const votes = makeVotes([]);

    expect(canRetractVote(ERetroPhase.Vote, votes, CARD_A, ALICE)).toBe(false);
  });

  it('returns false outside of Vote phase', () => {
    const votes = makeVotes([[CARD_A, [[ALICE, 1]]]]);

    expect(canRetractVote(ERetroPhase.Discuss, votes, CARD_A, ALICE)).toBe(false);
  });
});

describe('rankTargetsByVotes', () => {
  it('sorts targets by total votes descending', () => {
    const votes = makeVotes([
      [CARD_A, [[ALICE, 1]]],
      [
        CARD_B,
        [
          [ALICE, 2],
          [BOB, 3],
        ],
      ],
      [GROUP_X, [[ALICE, 2]]],
    ]);

    const ranked = rankTargetsByVotes([CARD_A, CARD_B, GROUP_X], votes);

    expect(ranked).toEqual([
      { targetId: CARD_B, totalVotes: 5 },
      { targetId: GROUP_X, totalVotes: 2 },
      { targetId: CARD_A, totalVotes: 1 },
    ]);
  });

  it('treats missing targets as zero votes', () => {
    const votes = makeVotes([]);

    const ranked = rankTargetsByVotes([CARD_A, CARD_B], votes);

    expect(ranked.every(entry => entry.totalVotes === 0)).toBe(true);
  });
});
