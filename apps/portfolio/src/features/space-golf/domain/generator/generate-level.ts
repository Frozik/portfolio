import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../constants';
import { carveCup } from '../cup';
import type { Level } from '../level';
import { applySurfaces } from '../surfaces';
import { createLayout } from './layout';
import { placeCup } from './place-cup';
import { placeFloaters } from './place-floaters';
import { placeSpikes } from './place-spikes';
import { placeSurfaces } from './place-surfaces';
import { createRandom } from './random';

/**
 * The level for a seed: islands laid out around a tee shelf, a few elastic
 * or viscous surfaces on their deep faces, the cup cut into one of the
 * plain faces, spike rows on a few others, floating squares in the open.
 * Deterministic — the same seed gives the same level everywhere. Nothing
 * yet proves the cup reachable (§9).
 */
export function generateLevel(seed: number): Level {
  const random = createRandom(seed);
  const layout = createLayout(random);
  const board = { width: BOARD_WIDTH_METERS, height: BOARD_HEIGHT_METERS };
  const walls = applySurfaces(layout.walls, placeSurfaces(random, layout.walls, layout.grid));
  const carved = carveCup({
    seed,
    ...board,
    walls,
    tee: layout.tee,
    cup: placeCup(random, walls, board, layout.tee),
    spikes: [],
    floaters: [],
  });
  return {
    ...carved,
    spikes: placeSpikes(random, carved.walls, board, carved.tee),
    floaters: placeFloaters(random, carved.walls, board, carved.tee),
  };
}
