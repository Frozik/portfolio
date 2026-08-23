import { beforeEach, describe, expect, it } from 'vitest';

import type { WorldEvent } from '../domain/types';
import { EffectList, getEffectFrame } from './effect-list';
import {
  LARGE_EXPLOSION_SIZE_WU,
  MAX_ACTIVE_EFFECTS,
  SMALL_EXPLOSION_SIZE_WU,
} from './render-constants';

const ORIGIN = { x: 40, y: 56 } as const;

const TANK_EXPLOSION_DURATION_TICKS = 36;
const BASE_EXPLOSION_DURATION_TICKS = 39;
const BULLET_CLANG_DURATION_TICKS = 9;

function advanceTicks(effects: EffectList, tickCount: number): void {
  for (let tick = 0; tick < tickCount; tick++) {
    effects.advance();
  }
}

function collectFrameSizes(effects: EffectList, tickCount: number): readonly number[] {
  const sizes: number[] = [];

  for (let tick = 0; tick < tickCount; tick++) {
    const [effect] = effects.items;

    if (effect !== undefined) {
      sizes.push(getEffectFrame(effect).sizeWu);
    }

    effects.advance();
  }

  return sizes;
}

describe('EffectList', () => {
  let effects: EffectList;

  beforeEach(() => {
    effects = new EffectList();
  });

  it('starts empty', () => {
    expect(effects.items).toHaveLength(0);
  });

  it('blows a tank kill up at the position the event reported', () => {
    effects.consume([
      { type: 'enemy-destroyed', enemyType: 'basic', position: ORIGIN, points: 100 },
    ]);

    expect(effects.items).toEqual([
      { kind: 'tank-explosion', centerXWu: ORIGIN.x, centerYWu: ORIGIN.y, ticksElapsed: 0 },
    ]);
  });

  it('blows the player up on the same storyboard as an enemy', () => {
    effects.consume([{ type: 'player-destroyed', playerSlot: 0, position: ORIGIN }]);

    expect(effects.items[0].kind).toBe('tank-explosion');
  });

  it('sparks where a bullet dies on terrain, steel or the border', () => {
    const reasons = ['terrain', 'steel', 'border'] as const;

    for (const reason of reasons) {
      effects.consume([{ type: 'bullet-ended', position: ORIGIN, reason }]);
    }

    expect(effects.items.map(effect => effect.kind)).toEqual([
      'bullet-clang',
      'bullet-clang',
      'bullet-clang',
    ]);
  });

  it('stays silent on a bullet-bullet annihilation and on a shield-absorbed hit', () => {
    effects.consume([
      { type: 'bullet-ended', position: ORIGIN, reason: 'bullet' },
      { type: 'bullet-ended', position: ORIGIN, reason: 'tank' },
    ]);

    expect(effects.items).toHaveLength(0);
  });

  it('takes the eagle out with its own timeline, since base-destroyed carries no position', () => {
    effects.consume([{ type: 'bullet-ended', position: ORIGIN, reason: 'eagle' }]);

    expect(effects.items[0].kind).toBe('base-explosion');
  });

  describe('timelines', () => {
    it('runs a tank death for 36 ticks', () => {
      effects.consume([{ type: 'player-destroyed', playerSlot: 0, position: ORIGIN }]);

      advanceTicks(effects, TANK_EXPLOSION_DURATION_TICKS - 1);
      expect(effects.items).toHaveLength(1);

      advanceTicks(effects, 1);
      expect(effects.items).toHaveLength(0);
    });

    it('runs the eagle pyramid for 39 ticks', () => {
      effects.consume([{ type: 'bullet-ended', position: ORIGIN, reason: 'eagle' }]);

      advanceTicks(effects, BASE_EXPLOSION_DURATION_TICKS - 1);
      expect(effects.items).toHaveLength(1);

      advanceTicks(effects, 1);
      expect(effects.items).toHaveLength(0);
    });

    it('runs a bullet clang for 9 ticks and never grows past tank size', () => {
      effects.consume([{ type: 'bullet-ended', position: ORIGIN, reason: 'terrain' }]);

      const sizes = collectFrameSizes(effects, BULLET_CLANG_DURATION_TICKS);

      expect(sizes).toHaveLength(BULLET_CLANG_DURATION_TICKS);
      expect(new Set(sizes)).toEqual(new Set([SMALL_EXPLOSION_SIZE_WU]));
      expect(effects.items).toHaveLength(0);
    });

    it('grows a tank death into the 32-wu blast and settles back down', () => {
      effects.consume([{ type: 'player-destroyed', playerSlot: 0, position: ORIGIN }]);

      const sizes = collectFrameSizes(effects, TANK_EXPLOSION_DURATION_TICKS);

      expect(sizes[0]).toBe(SMALL_EXPLOSION_SIZE_WU);
      expect(sizes[18]).toBe(LARGE_EXPLOSION_SIZE_WU);
      expect(sizes[TANK_EXPLOSION_DURATION_TICKS - 1]).toBe(SMALL_EXPLOSION_SIZE_WU);
    });

    it('holds the closing frame rather than reading past the timeline', () => {
      effects.consume([{ type: 'bullet-ended', position: ORIGIN, reason: 'terrain' }]);

      const [effect] = effects.items;
      effect.ticksElapsed = BULLET_CLANG_DURATION_TICKS * 10;

      expect(getEffectFrame(effect).sizeWu).toBe(SMALL_EXPLOSION_SIZE_WU);
    });
  });

  it('wipes the field when a new stage starts', () => {
    effects.consume([
      { type: 'enemy-destroyed', enemyType: 'fast', position: ORIGIN, points: 200 },
    ]);
    effects.consume([{ type: 'stage-started', stageNumber: 2 }]);

    expect(effects.items).toHaveLength(0);
  });

  it('bounds the list instead of growing it without limit', () => {
    const flood: readonly WorldEvent[] = Array.from(
      { length: MAX_ACTIVE_EFFECTS * 2 },
      () => ({ type: 'bullet-ended', position: ORIGIN, reason: 'terrain' }) as const
    );

    effects.consume(flood);

    expect(effects.items).toHaveLength(MAX_ACTIVE_EFFECTS);
  });

  it('never holds on to the event array the world reuses between ticks', () => {
    const reusedEvents: WorldEvent[] = [
      { type: 'enemy-destroyed', enemyType: 'armor', position: ORIGIN, points: 400 },
    ];

    effects.consume(reusedEvents);
    reusedEvents.length = 0;

    expect(effects.items).toHaveLength(1);
  });
});
