export const TILE_SIZE_PX = 256;
/** log2(TILE_SIZE_PX) + 1: every level down to 1×1. */
export const MIP_LEVEL_COUNT = 9;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 19;
export const DEGREES_PER_RADIAN = 180 / Math.PI;
/** With this FOV the horizon stays off screen up to 67.5° of pitch, so no sky is ever drawn. */
export const MAX_PITCH_RADIANS = 65 / DEGREES_PER_RADIAN;
export const FOV_RADIANS = Math.PI / 4;

/**
 * A tile subdivides while its projected edge exceeds this. √2 × the tile
 * size makes a flat view pick round(zoom) like Leaflet: tiles are drawn
 * between 0.7× and 1.4× native, half the requests of "never magnify".
 */
export const LOD_THRESHOLD_PX = TILE_SIZE_PX * Math.SQRT2;
/** Detail multipliers from richest to cheapest; the fps budget steps down through them. */
export const DETAIL_LEVELS = [1, 0.5] as const;
/**
 * Never above the atlas ceiling, so a frame can never hold more tiles than
 * the atlas keeps even on a device stuck at WebGPU's default 256 layers:
 * enough for 4K at full tilt; a 5K display straight down is drawn one level
 * coarser rather than thrashing the atlas.
 */
export const MAX_TILES_PER_FRAME = 256;
/** Quads per frame: every selected tile plus cached descendants laid over the ones still loading. */
export const MAX_INSTANCES_PER_FRAME = MAX_TILES_PER_FRAME * 2;
/** How many levels below a loading tile cached descendants are borrowed from (≤ 84 quads). */
export const MAX_FALLBACK_DEPTH = 3;
export const TILE_BUDGET_COARSEN_FACTOR = Math.SQRT2;
export const TILE_BUDGET_MAX_ROUNDS = 4;

export const NEAR_PLANE_FACTOR = 0.05;
export const FOG_START_FACTOR = 1.5;
export const FOG_END_FACTOR = 5;
export const FAR_PLANE_MARGIN = 1.01;

export const FADE_IN_SECONDS = 0.25;
export const CHECKER_CELLS_PER_TILE = 4;

export const MAX_CONCURRENT_LOADS = 6;
export const FAILED_RETRY_SECONDS = 10;
/** Second cache tier: encoded tiles kept in IndexedDB, the least recently read forgotten past this. */
export const MAX_STORED_TILES = 1000;
export const INITIAL_ATLAS_LAYERS = 64;
/**
 * Atlas layers asked of the device: a full turn of the camera at maximum
 * tilt on a retina display passes ≈770 distinct tiles through the frame,
 * and the atlas should hold a turn. WebGPU's default is 256; the adapter's
 * own limit caps the request, and the atlas only grows this far on demand
 * (≈350 KB per layer with mips).
 */
export const ATLAS_LAYERS_TARGET = 1024;
export const MAX_ANISOTROPY = 16;

/** Zoom levels per wheel pixel: one 100 px notch is half a level. */
export const WHEEL_ZOOM_SENSITIVITY = 0.005;
export const ROTATE_SENSITIVITY = 0.005;
export const TILT_SENSITIVITY = 0.005;
/** A single pan step never moves the target farther than this many camera distances. */
export const MAX_PAN_STEP_FACTOR = 1;

export const INERTIA_DAMPING = 0.92;
export const INERTIA_MIN_VELOCITY_PX = 0.05;
export const INERTIA_STALE_MOVE_MS = 100;

export const FPS_IDLE = 10;
export const FPS_INTERACTION = 60;
export const FPS_RESIZE = 60;
export const LOW_FPS_THRESHOLD = 30;
/** FPS readings count only this soon after the camera moved: idle frames are skipped and read as 0. */
export const FPS_SAMPLE_QUIET_SECONDS = 0.5;
export const LOW_FPS_REPORTS_TO_STEP_DOWN = 8;

export const HASH_WRITE_DELAY_MS = 300;

/** The vector tiles carry buildings at their last zoom; finer views draw the z14 ancestor's mesh. */
export const BUILDING_TILE_ZOOM = 14;
/** Buildings rise once the camera is this close; farther out the raster map is the whole picture. */
export const BUILDINGS_MIN_ZOOM = 16;
/** Metres in one Web Mercator unit at the equator: the Earth's circumference. */
export const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** What OpenMapTiles gives an untagged building; the same stands in for a missing value. */
export const DEFAULT_BUILDING_HEIGHT_M = 5;
/** Building meshes kept on the GPU before the least recently drawn are dropped. */
export const MAX_BUILDING_MESH_BYTES = 96 * 2 ** 20;
/** Encoded building tiles kept in IndexedDB. */
export const MAX_STORED_BUILDING_TILES = 300;
/** How long a building tile takes to grow out of the ground when it enters the picture. */
export const BUILDING_RISE_SECONDS = 0.6;
/** z14 tiles a frame can place; a 4K view at full tilt from z16 needs about twenty. */
export const MAX_BUILDING_TILES_PER_FRAME = 64;

export const GEOLOCATION_TIMEOUT_MS = 10_000;
/** A fix this old is still good enough to open the map over the right city. */
export const GEOLOCATION_MAX_AGE_MS = 600_000;
