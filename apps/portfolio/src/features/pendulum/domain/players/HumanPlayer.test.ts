import { describe, expect, it } from 'vitest';

import { createWorld } from '../physics/createWorld';
import { HumanPlayer } from './HumanPlayer';

const TICK = 16;

function createPlayer(heldKeys: readonly string[], dragTarget?: number): HumanPlayer {
  return new HumanPlayer(
    { isPressed: code => heldKeys.includes(code), dispose: () => undefined },
    () => dragTarget
  );
}

function play(player: HumanPlayer, pivotPosition = 0): number {
  return player.play(createWorld({ bobsCount: 1, pivotPosition }), TICK).pivotVelocity;
}

describe('HumanPlayer', () => {
  it('keeps the cart still when nothing is held', () => {
    expect(play(createPlayer([]))).toBe(0);
  });

  it('drives the cart left and right with the arrow keys', () => {
    expect(play(createPlayer(['ArrowLeft']))).toBeLessThan(0);
    expect(play(createPlayer(['ArrowRight']))).toBeGreaterThan(0);
  });

  it('boosts the arrow keys while Shift is held', () => {
    expect(play(createPlayer(['ArrowRight', 'ShiftLeft']))).toBeGreaterThan(
      play(createPlayer(['ArrowRight']))
    );
  });

  it('brings the cart under a held pointer within one tick', () => {
    const cartX = -40;
    const pointerX = 120;

    expect(cartX + play(createPlayer([], pointerX), cartX) * TICK).toBeCloseTo(pointerX);
  });

  it('holds the cart still once it is under the pointer', () => {
    expect(play(createPlayer([], 75), 75)).toBe(0);
  });

  it('lets the pointer win over the arrow keys', () => {
    expect(play(createPlayer(['ArrowLeft'], 75), 75)).toBe(0);
  });
});
