import type { Meters } from './units';

/** Quick-start plot: a 30 × 40 m rectangle anchored at the plan origin. */
export const DEFAULT_SITE_WIDTH_METERS: Meters = 30;
export const DEFAULT_SITE_LENGTH_METERS: Meters = 40;

/** Saint Petersburg — the default site location, changeable in the settings panel. */
export const DEFAULT_LATITUDE_DEGREES = 59.94;
export const DEFAULT_LONGITUDE_DEGREES = 30.31;
export const DEFAULT_TIME_ZONE_ID = 'Europe/Moscow';
/** Plan north matches geographic north until the user rotates the plot. */
export const DEFAULT_NORTH_OFFSET_DEGREES = 0;

export const DEFAULT_GRID_STEP_METERS: Meters = 0.5;
export const DEFAULT_IS_SNAP_ENABLED = true;
export const DEFAULT_SETBACK_METERS: Meters = 3;
/** Upper bound of the sampled heightfield grid: 256² cells cover a 60 m plot at ~0.25 m. */
export const DEFAULT_HEIGHTFIELD_TARGET_RESOLUTION = 256;
export const DEFAULT_CONTOUR_INTERVAL_METERS: Meters = 0.5;

export const DEFAULT_WALL_HEIGHT_METERS: Meters = 3;
/** A new footprint sits on the terrain height under its centre until told otherwise. */
export const DEFAULT_PAD_ELEVATION_MODE = 'terrain-center';

/**
 * How far the pad's apron is carried below the lowest ground the footprint
 * covers. Deep enough that a house levelled onto a slope never reads as floating
 * over the low side, shallow enough that the skirt stays buried everywhere else.
 */
export const APRON_DEPTH_METERS: Meters = 0.5;

/** What the catalogue is armed with at first; sizes are per-species in `site-plan.ts`. */
export const DEFAULT_TREE_SPECIES = 'spruce';
/** Below this a tree has no volume left to draw, and its instance scale collapses. */
export const MIN_TREE_EXTENT_METERS: Meters = 0.1;

/**
 * The car every parked car on the plan is: a mid-size crossover of today's
 * proportions (the Jaecoo J8 class — 4.8 m long, 1.9 m wide, 1.75 m tall).
 * The size is a constant rather than a field of the model — a
 * car is drawn to check that a drive or a gate has room for one, and a plan that
 * let every car be resized would invite a fantasy of a car that fits.
 */
export const CAR_LENGTH_METERS: Meters = 4.8;
export const CAR_WIDTH_METERS: Meters = 1.9;
export const CAR_HEIGHT_METERS: Meters = 1.75;
/** A freshly parked car faces plan east until it is turned. */
export const DEFAULT_CAR_ROTATION_DEGREES = 0;

/** A garden path wide enough for one person; changed per path in the panel. */
export const DEFAULT_PATH_WIDTH_METERS: Meters = 1;

/**
 * How far a path ribbon floats over the ground it is draped on. It matches the
 * order of the boundary outline's own lift: enough to clear the depth precision
 * of a scene tens of metres across, little enough to read as paving rather than
 * as a plank hovering over the garden.
 */
export const PATH_DRAPE_OFFSET_METERS: Meters = 0.04;
