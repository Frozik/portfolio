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
/** Buildings stay until the camera backs off to here: a gap under the threshold, so hovering at it never flickers them. */
export const BUILDINGS_HIDE_ZOOM = 15.5;
/** Street meshes — building boxes and water surfaces — are `int16` in this unit from the tile's north-west corner. */
export const STREET_MESH_UNIT_M = 0.1;
/** Metres in one Web Mercator unit at the equator: the Earth's circumference. */
export const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** What OpenMapTiles gives an untagged building; the same stands in for a missing value. */
export const DEFAULT_BUILDING_HEIGHT_M = 5;
/**
 * Street meshes kept on the GPU before the least recently drawn are dropped:
 * sixty dense city tiles, four screens of downtown. WebGPU has no memory
 * budget to ask; the ceiling is a guess at what a phone's browser tab can
 * hold beside the atlas without the device being lost.
 */
export const MAX_BUILDING_MESH_BYTES = 256 * 2 ** 20;
/**
 * Street tiles a picture asks for at once, nearest the camera target first:
 * a full tilt at z16 sees about forty z14 tiles down to the fog, and the
 * working set must fit the cache with room to spare, or tiles in view would
 * evict each other and blink. Dense city tiles run to 4 MB each.
 */
export const MAX_STREET_TILES_IN_VIEW = 32;
/** Encoded building tiles kept in IndexedDB. */
export const MAX_STORED_BUILDING_TILES = 300;
/** How long a building tile takes to grow out of the ground when it enters the picture. */
export const BUILDING_RISE_SECONDS = 0.6;
/** Cars appear once a car is a few pixels long; at z16 they would be moving specks. */
export const CARS_MIN_ZOOM = 17;
/** Cars stay until the camera backs off to here, for the same reason as the buildings. */
export const CARS_HIDE_ZOOM = 16.5;
/** Traffic and water animate at this rate: smooth enough for small movers, half the battery of 60. */
export const FPS_ANIMATION = 30;
/** Right-hand traffic: a lane sits this far right of the road's centre line. */
export const LANE_OFFSET_M = 1.75;
/** One car per this much road at seeding, before the road class weighs in. */
export const CAR_SPACING_M = 80;
/** Ceiling per tile; counts scale down proportionally when the roads would seed more. */
export const MAX_CARS_PER_TILE = 400;
/** Junction vertices match by position on this grid: 1/64 of a tile unit, about a centimetre. */
export const JUNCTION_GRID_PER_UNIT = 64;
/** At a junction a car keeps to its road this often; otherwise it turns onto another. */
export const KEEP_STRAIGHT_PROBABILITY = 0.7;
/** A car this close to a junction is in it; the box no two cars from different roads share. */
export const JUNCTION_ZONE_M = 9;
/** A car this close to a junction, coming from the right, has priority: the other waits at the zone edge. */
export const YIELD_DISTANCE_M = 25;
/** Four cars each yielding to their right would wait forever; after this long the waiting car goes. */
export const MAX_YIELD_SECONDS = 3;
/** Cars a frame can draw; a screen of z14 tiles at z17 holds a few hundred. */
export const MAX_CARS_PER_FRAME = 4096;
/** Bumper to bumper is not driving: a car never closes on the one ahead below this. */
export const CAR_MIN_GAP_M = 8;
/** A frame this long is a tab that was hidden; traffic steps by this much at most. */
export const MAX_TRAFFIC_STEP_SECONDS = 0.1;
/** One tree per this much forest; sparser than the real thing, dense enough to read as woods. */
export const FOREST_AREA_PER_TREE_M2 = 350;
/** One tree per this much park: lawns with trees, not a forest. */
export const PARK_AREA_PER_TREE_M2 = 1200;
/** Ceiling per tile; a tile that is all forest plants proportionally fewer. */
export const MAX_TREES_PER_TILE = 10_000;
/** Ground taken by water, buildings and roads is rasterised this fine before trees are planted around it. */
export const GROUND_MASK_CELL_M = 2;
/** A tree keeps this share of its crown radius clear of taken ground: crowns may lean over a road, trunks may not stand in it. */
export const TREE_CLEARANCE_CROWN_SHARE = 0.5;
/** z14 tiles a frame can place; a 4K view at full tilt from z16 needs about twenty. */
export const MAX_BUILDING_TILES_PER_FRAME = 64;

export const GEOLOCATION_TIMEOUT_MS = 10_000;
/** A fix this old is still good enough to open the map over the right city. */
export const GEOLOCATION_MAX_AGE_MS = 600_000;
