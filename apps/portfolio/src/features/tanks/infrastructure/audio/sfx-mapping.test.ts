import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { WorldEvent } from '../../domain/types';
import { mapWorldEventsToSfx } from './sfx-mapping';

const SOMEWHERE: Vector2 = { x: 64, y: 96 };

function brickHit(): WorldEvent {
  return { type: 'bullet-ended', position: SOMEWHERE, reason: 'terrain' };
}

describe('mapWorldEventsToSfx', () => {
  it('says nothing about a quiet tick', () => {
    expect(mapWorldEventsToSfx([])).toEqual([]);
  });

  it('fires the gun only for the player', () => {
    expect(
      mapWorldEventsToSfx([
        { type: 'bullet-fired', owner: { side: 'player', slot: 0 }, position: SOMEWHERE },
      ])
    ).toEqual(['shot']);

    expect(
      mapWorldEventsToSfx([
        { type: 'bullet-fired', owner: { side: 'enemy', slot: 2 }, position: SOMEWHERE },
      ])
    ).toEqual([]);
  });

  it('tells brick, steel and the border apart', () => {
    expect(mapWorldEventsToSfx([brickHit()])).toEqual(['brick-crumble']);
    expect(
      mapWorldEventsToSfx([{ type: 'bullet-ended', position: SOMEWHERE, reason: 'steel' }])
    ).toEqual(['steel-clang']);
    expect(
      mapWorldEventsToSfx([{ type: 'bullet-ended', position: SOMEWHERE, reason: 'border' }])
    ).toEqual(['steel-clang']);
  });

  it('keeps a bullet dying on a tank or another bullet silent', () => {
    expect(
      mapWorldEventsToSfx([
        { type: 'bullet-ended', position: SOMEWHERE, reason: 'tank' },
        { type: 'bullet-ended', position: SOMEWHERE, reason: 'bullet' },
      ])
    ).toEqual([]);
  });

  it('blows up tanks, the player and the eagle at their own weights', () => {
    expect(
      mapWorldEventsToSfx([
        { type: 'enemy-destroyed', enemyType: 'basic', position: SOMEWHERE, points: 100 },
      ])
    ).toEqual(['small-explosion']);

    expect(
      mapWorldEventsToSfx([{ type: 'player-destroyed', playerSlot: 0, position: SOMEWHERE }])
    ).toEqual(['big-explosion']);

    expect(mapWorldEventsToSfx([{ type: 'base-destroyed' }])).toEqual(['big-explosion']);
  });

  it('scores the power-up lifecycle and the extra life', () => {
    expect(
      mapWorldEventsToSfx([{ type: 'power-up-spawned', powerUpType: 'star', position: SOMEWHERE }])
    ).toEqual(['power-up-appear']);

    expect(
      mapWorldEventsToSfx([
        { type: 'power-up-taken', powerUpType: 'star', playerSlot: 0, position: SOMEWHERE },
      ])
    ).toEqual(['power-up-pickup']);

    expect(mapWorldEventsToSfx([{ type: 'extra-life-awarded', totalLives: 4 }])).toEqual([
      'extra-life',
    ]);
  });

  it('hisses when the player starts sliding on ice', () => {
    expect(mapWorldEventsToSfx([{ type: 'player-ice-slide-started', playerSlot: 0 }])).toEqual([
      'ice-skid',
    ]);
  });

  it('leaves the flow moments to the jingles', () => {
    expect(
      mapWorldEventsToSfx([
        { type: 'stage-started', stageNumber: 1 },
        { type: 'enemy-spawned', slot: 0, enemyType: 'basic', isPowerUpCarrier: false },
        { type: 'score-awarded', points: 100, totalScore: 100 },
        { type: 'stage-cleared', stageNumber: 1 },
        { type: 'game-over' },
      ])
    ).toEqual([]);
  });

  it('throttles a tick full of brick hits down to a single crumble', () => {
    expect(mapWorldEventsToSfx([brickHit(), brickHit(), brickHit(), brickHit()])).toEqual([
      'brick-crumble',
    ]);
  });

  it('keeps distinct sounds of one tick, in the order they happened', () => {
    expect(
      mapWorldEventsToSfx([
        { type: 'bullet-fired', owner: { side: 'player', slot: 0 }, position: SOMEWHERE },
        brickHit(),
        { type: 'enemy-destroyed', enemyType: 'fast', position: SOMEWHERE, points: 200 },
        brickHit(),
      ])
    ).toEqual(['shot', 'brick-crumble', 'small-explosion']);
  });
});
