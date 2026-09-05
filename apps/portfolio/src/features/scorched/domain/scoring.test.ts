import { describe, expect, it } from 'vitest';

import { CASH_PER_POINT, STANDARD_KILL_POINTS } from './constants';
import type { RoundOutcome } from './scoring';
import { countScoringKills, rankStandings, scoreRound } from './scoring';
import type { PlayerId } from './types';
import { toPlayerId } from './types';

const PLAYER_IDS = [toPlayerId(1), toPlayerId(2), toPlayerId(3)];

function createOutcome(overrides: Partial<RoundOutcome> = {}): RoundOutcome {
  return { damages: [], kills: [], retreatedIds: [], ...overrides };
}

function getPoints(scores: ReturnType<typeof scoreRound>, playerId: PlayerId): number {
  return scores.find(score => score.playerId === playerId)?.points ?? 0;
}

describe('scoreRound', () => {
  it('scores damage continuously as it is dealt', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({
        damages: [
          { dealerId: toPlayerId(1), targetId: toPlayerId(2), amount: 30 },
          { dealerId: toPlayerId(1), targetId: toPlayerId(3), amount: 12 },
        ],
      })
    );

    expect(getPoints(scores, toPlayerId(1))).toBe(42);
    expect(getPoints(scores, toPlayerId(2))).toBe(0);
  });

  it('subtracts damage a player deals to itself', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({
        damages: [
          { dealerId: toPlayerId(1), targetId: toPlayerId(2), amount: 30 },
          { dealerId: toPlayerId(1), targetId: toPlayerId(1), amount: 20 },
        ],
      })
    );

    expect(getPoints(scores, toPlayerId(1))).toBe(10);
  });

  it('ignores damage nobody caused', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({ damages: [{ dealerId: undefined, targetId: toPlayerId(2), amount: 40 }] })
    );

    expect(scores.every(score => score.points === 0)).toBe(true);
  });

  it('adds the kill bonus on top of the damage points', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({
        damages: [{ dealerId: toPlayerId(1), targetId: toPlayerId(2), amount: 100 }],
        kills: [{ killerId: toPlayerId(1), victimId: toPlayerId(2) }],
      })
    );

    expect(getPoints(scores, toPlayerId(1))).toBe(100 + STANDARD_KILL_POINTS);
  });

  it('charges a player the bonus for killing itself', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({ kills: [{ killerId: toPlayerId(1), victimId: toPlayerId(1) }] })
    );

    expect(getPoints(scores, toPlayerId(1))).toBe(-STANDARD_KILL_POINTS);
  });

  it('lets a retreat forfeit the points but deny the killer their bounty', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({
        damages: [
          { dealerId: toPlayerId(2), targetId: toPlayerId(3), amount: 50 },
          { dealerId: toPlayerId(1), targetId: toPlayerId(2), amount: 40 },
        ],
        kills: [{ killerId: toPlayerId(1), victimId: toPlayerId(2) }],
        retreatedIds: [toPlayerId(2)],
      })
    );

    expect(getPoints(scores, toPlayerId(2))).toBe(0);
    expect(getPoints(scores, toPlayerId(1))).toBe(40);
  });

  it('pays out the round winnings at the cash rate and never goes negative', () => {
    const scores = scoreRound(
      PLAYER_IDS,
      createOutcome({
        damages: [
          { dealerId: toPlayerId(1), targetId: toPlayerId(2), amount: 10 },
          { dealerId: toPlayerId(2), targetId: toPlayerId(2), amount: 30 },
        ],
      })
    );

    expect(scores.find(score => score.playerId === 1)?.cash).toBe(10 * CASH_PER_POINT);
    expect(scores.find(score => score.playerId === 2)?.cash).toBe(0);
  });
});

describe('countScoringKills', () => {
  it('counts only kills that were neither self-inflicted nor denied by a retreat', () => {
    const outcome = createOutcome({
      kills: [
        { killerId: toPlayerId(1), victimId: toPlayerId(2) },
        { killerId: toPlayerId(1), victimId: toPlayerId(3) },
        { killerId: toPlayerId(1), victimId: toPlayerId(1) },
      ],
      retreatedIds: [toPlayerId(3)],
    });

    expect(countScoringKills(outcome, toPlayerId(1))).toBe(1);
    expect(countScoringKills(outcome, toPlayerId(2))).toBe(0);
  });
});

describe('rankStandings', () => {
  it('puts the most kills first and breaks ties on points', () => {
    const ranked = rankStandings([
      { playerId: toPlayerId(1), kills: 2, points: 500 },
      { playerId: toPlayerId(2), kills: 4, points: 100 },
      { playerId: toPlayerId(3), kills: 2, points: 900 },
    ]);

    expect(ranked.map(standing => standing.playerId)).toEqual([2, 3, 1]);
  });

  it('leaves the input untouched', () => {
    const standings = [
      { playerId: toPlayerId(1), kills: 0, points: 0 },
      { playerId: toPlayerId(2), kills: 5, points: 0 },
    ];

    rankStandings(standings);

    expect(standings[0].playerId).toBe(toPlayerId(1));
  });
});
