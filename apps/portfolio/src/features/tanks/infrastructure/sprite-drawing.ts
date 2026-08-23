import type { Direction } from '../domain/types';

/** Sprites are authored facing up; the shader rotates them clockwise by these quarter turns. */
export const ROTATION_TURNS_BY_DIRECTION: Readonly<Record<Direction, number>> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};

const BLINK_PHASE_COUNT = 2;

export const VISIBLE_BLINK_PHASE = 0;
export const FLASHING_BLINK_PHASE = 1;

/** Which half of a two-state blink the given tick falls in — power-ups, carrier flash, shields. */
export function getBlinkPhase(tick: number, phaseTicks: number): number {
  return Math.floor(tick / phaseTicks) % BLINK_PHASE_COUNT;
}
