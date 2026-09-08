import {
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
  CONTACT_EPSILON_METERS,
} from './constants';
import { carveCup } from './cup';
import type { Level } from './level';
import { createBlock, createChamferedBlock } from './walls';

/** Thickness of the frame around the board. */
const FRAME = 1;

/**
 * A hand-built arena for the specifications: a framed board, a thin vertical
 * bar in the middle, a chamfered block on the right, the cup in the floor at
 * x = 4.5 and a spike row on the floor at x ∈ [8, 9] that is extended on odd
 * strokes.
 */
export function createTestLevel(): Level {
  const floor = createBlock(-FRAME, -FRAME, BOARD_WIDTH_METERS + 2 * FRAME, FRAME);
  const ceiling = createBlock(-FRAME, BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS + 2 * FRAME, FRAME);
  const left = createBlock(-FRAME, 0, FRAME, BOARD_HEIGHT_METERS);
  const right = createBlock(BOARD_WIDTH_METERS, 0, FRAME, BOARD_HEIGHT_METERS);
  const bar = createBlock(4, 2, 0.1, 4);
  const chamfered = createChamferedBlock(6, 8, 2, 2, 0.5, new Set(['lowerLeft']));
  return carveCup({
    seed: 0,
    width: BOARD_WIDTH_METERS,
    height: BOARD_HEIGHT_METERS,
    walls: [floor, ceiling, left, right, bar, chamfered],
    // The floor's top edge runs from (10, 0) to (-1, 0), so `at` counts from x = 10.
    spikes: [{ wall: 0, edge: 2, from: 1, length: 1, extendedOnOddStrokes: true }],
    pickups: [],
    tee: { x: 1, y: BALL_RADIUS_METERS + CONTACT_EPSILON_METERS },
    cup: { wall: 0, edge: 2, at: 5.5, radius: 0.2 },
    par: 2,
  });
}
