import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../constants';
import { carveCup } from '../cup';
import type { Level } from '../level';
import { createLayout } from './layout';
import { placeBars } from './place-bars';
import { placeFeatures } from './place-features';
import { placePickups } from './place-pickups';
import { createRandom } from './random';
import { MAX_SOLUTION_STROKES, solve } from './solver';

/** Layouts tried per seed before the easiest solvable one is accepted. */
const MAX_ATTEMPTS = 12;
/** A hole-in-one is no puzzle; a level starts at this many strokes. */
const MIN_PAR = 2;
/** Attempts of one seed draw from distinct streams. */
const ATTEMPT_STRIDE = 1000;

/**
 * The level for a seed: layouts are drawn until one is playable by the
 * game's own physics in two to six strokes. The solver's stroke count is
 * the par. Deterministic — the same seed gives the same level everywhere.
 */
export function generateLevel(seed: number): Level {
  let fallback: Level | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const random = createRandom(seed * ATTEMPT_STRIDE + attempt);
    const layout = createLayout(random);
    const features = placeFeatures(random, layout.grid, layout.walls, layout.teeCell);
    const reserved = [layout.teeCell, ...features.occupied];
    const bars = placeBars(random, layout.grid, reserved);
    const pickups = placePickups(random, layout.grid, [...reserved, ...bars.cells]);
    const candidate: Level = carveCup({
      seed,
      width: BOARD_WIDTH_METERS,
      height: BOARD_HEIGHT_METERS,
      walls: [...features.walls, ...bars.walls],
      spikes: features.spikes,
      pickups,
      tee: layout.tee,
      cup: features.cup,
      par: 0,
    });
    const solution = solve(candidate);
    if (solution === undefined) {
      continue;
    }
    const level = { ...candidate, par: solution.strokes.length };
    if (level.par >= MIN_PAR && level.par <= MAX_SOLUTION_STROKES) {
      return level;
    }
    fallback ??= level;
  }
  if (fallback === undefined) {
    throw new Error(`generateLevel: no playable layout for seed ${seed}`);
  }
  return fallback;
}
