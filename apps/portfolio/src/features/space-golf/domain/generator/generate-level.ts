import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../constants';
import { carveCup } from '../cup';
import type { Level } from '../level';
import { applySurfaces } from '../surfaces';
import { createLayout } from './layout';
import { placeCup } from './place-cup';
import { placeFloaters } from './place-floaters';
import { placeRods } from './place-rods';
import { placeSpikes } from './place-spikes';
import { placeSurfaces } from './place-surfaces';
import { createRandom } from './random';

/**
 * The level for a seed: islands laid out around a tee shelf, a few elastic
 * or viscous surfaces on their deep faces, the cup cut into one of the
 * plain faces, spike rows on a few others, floaters in the open, a rod or
 * two bridging a gap. Deterministic — the same seed gives the same level everywhere. Nothing
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
    rods: [],
  });
  const furnished: Level = {
    ...carved,
    spikes: placeSpikes(random, carved.walls, board, carved.tee),
    floaters: placeFloaters(random, carved.walls, board, carved.tee),
  };
  return { ...furnished, rods: placeRods(random, furnished) };
}
