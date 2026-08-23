import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';
import { POWER_UP_PICKUP_POINTS } from '../domain/constants';

import type { WorldEvent } from '../domain/types';
import { SCORE_POPUP_KILL_TICKS, SCORE_POPUP_PICKUP_TICKS } from './render-constants';
import { ScorePopupList, toScoreDigits } from './score-popup-list';

const KILL_POSITION: Vector2 = { x: 72, y: 40 };

function kill(points: number, position: Vector2 = KILL_POSITION): WorldEvent {
  return { type: 'enemy-destroyed', enemyType: 'basic', position, points };
}

function advance(popups: ScorePopupList, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) {
    popups.advance();
  }
}

describe('toScoreDigits', () => {
  it('splits a score into numerals', () => {
    expect(toScoreDigits(100)).toEqual([1, 0, 0]);
    expect(toScoreDigits(400)).toEqual([4, 0, 0]);
    expect(toScoreDigits(500)).toEqual([5, 0, 0]);
  });

  it('always draws at least one numeral', () => {
    expect(toScoreDigits(0)).toEqual([0]);
  });
});

describe('ScorePopupList', () => {
  it('floats a kill reward over the dead tank', () => {
    const popups = new ScorePopupList();

    popups.consume([kill(400)]);

    expect(popups.items).toHaveLength(1);
    expect(popups.items[0].digits).toEqual([4, 0, 0]);
    expect(popups.items[0].centerXWu).toBe(KILL_POSITION.x);
    expect(popups.items[0].centerYWu).toBe(KILL_POSITION.y);
    expect(popups.items[0].durationTicks).toBe(SCORE_POPUP_KILL_TICKS);
  });

  it('holds a kill reward for twelve ticks', () => {
    const popups = new ScorePopupList();

    popups.consume([kill(100)]);
    advance(popups, SCORE_POPUP_KILL_TICKS - 1);

    expect(popups.items).toHaveLength(1);

    popups.advance();

    expect(popups.items).toHaveLength(0);
  });

  it('floats the bonus 500 over the pickup for much longer', () => {
    const popups = new ScorePopupList();

    popups.consume([
      { type: 'power-up-taken', powerUpType: 'star', playerSlot: 0, position: { x: 40, y: 88 } },
    ]);

    expect(popups.items[0].digits).toEqual(toScoreDigits(POWER_UP_PICKUP_POINTS));
    expect(popups.items[0].durationTicks).toBe(SCORE_POPUP_PICKUP_TICKS);

    advance(popups, SCORE_POPUP_KILL_TICKS);

    expect(popups.items).toHaveLength(1);
  });

  it('stays silent for a grenade kill, which awards nothing and reports nothing', () => {
    const popups = new ScorePopupList();

    popups.consume([{ type: 'score-awarded', points: 0, totalScore: 0 }]);

    expect(popups.items).toHaveLength(0);
  });

  it('wipes the field when the next stage starts', () => {
    const popups = new ScorePopupList();

    popups.consume([kill(200)]);
    popups.consume([{ type: 'stage-started', stageNumber: 2 }]);

    expect(popups.items).toHaveLength(0);
  });

  it('refuses to grow without bound when a grenade cashes out the whole field', () => {
    const popups = new ScorePopupList();

    for (let index = 0; index < 50; index++) {
      popups.consume([kill(100)]);
    }

    expect(popups.items.length).toBeLessThanOrEqual(8);
  });

  it('expires each popup on its own clock', () => {
    const popups = new ScorePopupList();

    popups.consume([
      kill(100),
      { type: 'power-up-taken', powerUpType: 'tank', playerSlot: 0, position: KILL_POSITION },
    ]);
    advance(popups, SCORE_POPUP_KILL_TICKS);

    expect(popups.items).toHaveLength(1);
    expect(popups.items[0].durationTicks).toBe(SCORE_POPUP_PICKUP_TICKS);
  });
});
