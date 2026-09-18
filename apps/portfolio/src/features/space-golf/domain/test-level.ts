import { BALL_RADIUS_METERS, CONTACT_EPSILON_METERS, CUP_RADIUS_METERS } from './constants';
import { carveCup } from './cup';
import type { Cup, Level } from './level';
import { createBlock, createChamferedBlock } from './walls';

/** The specifications' own board, the reference's 9 × 16 m, whatever the game's grows to. */
const BOARD_WIDTH_METERS = 9;
const BOARD_HEIGHT_METERS = 16;
/** Thickness of the frame around the board. */
const FRAME = 1;
/** The floor rises this far into the board, so the cup's notch lies on it. */
const FLOOR_TOP = 1;

/**
 * A hand-built arena for the specifications: a framed board whose floor
 * stands at y = 1, a thin vertical bar in the middle, a chamfered block on
 * the right and the cup in the floor at x = 4.5.
 */
export function createTestLevel(): Level & { readonly cup: Cup } {
  const floor = createBlock(-FRAME, -FRAME, BOARD_WIDTH_METERS + 2 * FRAME, FRAME + FLOOR_TOP);
  const ceiling = createBlock(-FRAME, BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS + 2 * FRAME, FRAME);
  const left = createBlock(-FRAME, 0, FRAME, BOARD_HEIGHT_METERS);
  const right = createBlock(BOARD_WIDTH_METERS, 0, FRAME, BOARD_HEIGHT_METERS);
  const bar = createBlock(4, 2, 0.1, 4);
  const chamfered = createChamferedBlock(6, 8, 2, 2, 0.5, new Set(['lowerLeft']));
  return carveCup({
    seed: 0,
    walls: [floor, ceiling, left, right, bar, chamfered],
    tee: { x: 1, y: FLOOR_TOP + BALL_RADIUS_METERS + CONTACT_EPSILON_METERS },
    // The floor's top edge runs from (10, 1) to (-1, 1), so `at` counts from x = 10.
    cup: { wall: 0, edge: 2, at: 5.5, radius: CUP_RADIUS_METERS },
    spikes: [],
    floaters: [],
    rods: [],
  });
}
