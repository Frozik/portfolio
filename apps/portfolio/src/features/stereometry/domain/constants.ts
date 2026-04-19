import type { PartialElementStyle } from './render-types';

// --- FPS levels ---

export const FPS_IDLE = 10;
export const FPS_RESIZE = 60;
export const FPS_INTERACTION = 60;
export const FPS_ANIMATION = 60;

// --- Camera ---

export const MIN_CAMERA_DISTANCE = 3;
export const MAX_CAMERA_DISTANCE = 15;
export const INITIAL_CAMERA_DISTANCE = 5;
export const INITIAL_ELEVATION = Math.PI / 2.3;
export const INITIAL_AZIMUTH = Math.PI / 30;
export const MOUSE_ROTATE_SENSITIVITY = 0.005;
export const MOUSE_PAN_SENSITIVITY = 0.003;
export const WHEEL_ZOOM_SENSITIVITY = 0.01;
export const INERTIA_DAMPING = 0.95;
export const INERTIA_MIN_VELOCITY = 0.1;
/** Exponential smoothing factor for zoom animation (0 = no movement, 1 = instant) */
export const ZOOM_SMOOTHING_FACTOR = 0.1;
/** Distance threshold below which zoom snaps to target to avoid infinite lerp tail */
export const ZOOM_SNAP_THRESHOLD = 0.001;
export const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 100;
/** Orthographic scale: half-height = distance * ORTHO_SCALE */
export const ORTHO_SCALE = Math.tan(FIELD_OF_VIEW_RADIANS / 2);

// --- User interaction (click / hit detection) ---

/** Click detection: max movement in pixels to still count as a click */
export const CLICK_MOVEMENT_THRESHOLD = 3;
/** Click detection: max time in milliseconds to still count as a click */
export const CLICK_TIME_THRESHOLD_MS = 300;
/** Double-click/double-tap: max time between two clicks */
export const DOUBLE_CLICK_TIME_THRESHOLD_MS = 400;
/** Double-click/double-tap: max distance between two click positions */
export const DOUBLE_CLICK_DISTANCE_THRESHOLD = 10;
/** Hit testing: radius in screen pixels for vertex proximity detection */
export const VERTEX_HIT_RADIUS_PIXELS = 30;
/** Hit testing: max distance in screen pixels from edge line to count as a hit */
export const EDGE_HIT_RADIUS_PIXELS = 20;
/** Line hit: how long to hold a line before the drag-to-parallel gesture activates. */
export const LINE_HOLD_DELAY_MS = 250;

// --- Hit-test scoring weights (tune to steer the unified hit-test) ---
//
// Each candidate earns an additive score:
//   score = typeBonus
//         + HIT_PROXIMITY_WEIGHT * proximityScore  (1.0 for closest-to-ray, 0.0 for farthest)
//         + HIT_DEPTH_WEIGHT     * depthScore      (1.0 for closest-to-camera, 0.0 for farthest)
// where both scores are normalized in [0, 1] across collected candidates.

/** Max bonus awarded to the candidate closest to the cursor ray (scaled by proximity). */
export const HIT_PROXIMITY_WEIGHT = 0.2;
/** Max bonus awarded to the candidate closest to the camera (scaled by relative depth). */
export const HIT_DEPTH_WEIGHT = 0.1;
/** Additive score bonus applied to vertex candidates. */
export const HIT_VERTEX_TYPE_BONUS = 0.2;
/** Additive score bonus applied to finite segments (edges and user segments). */
export const HIT_SEGMENT_TYPE_BONUS = 0.1;
/** Additive score bonus applied to infinite line candidates (extensions and user lines). */
export const HIT_LINE_TYPE_BONUS = 0;

// --- Geometry / math ---

/** How far to extend a line beyond the edge endpoints (in world units) */
export const LINE_EXTENSION_LENGTH = 20;
/** Max 3D distance between two lines to consider them intersecting */
export const LINE_INTERSECTION_MAX_DISTANCE = 0.01;
/** Sentinel value indicating a line endpoint is not connected to any scene vertex */
export const NO_CONNECTED_VERTEX_INDEX = -1;
export const VERTICES_PER_TRIANGLE = 3;
/** Floats per face vertex: position only (vec3) */
export const FACE_POSITION_FLOATS = 3;
// --- GPU pipeline / rendering ---

export const MSAA_SAMPLE_COUNT = 4;
/** Homogeneous w-component for position vectors in clip-space transforms */
export const HOMOGENEOUS_W = 1.0;
/** Number of vertices per line quad (2 triangles = 6 vertices) */
export const VERTICES_PER_LINE_QUAD = 6;

/** Depth fade: how quickly elements fade with distance (higher = faster fade) */
export const DEPTH_FADE_RATE = 0.45;
/** Depth fade: minimum alpha for the most distant elements */
export const DEPTH_FADE_MIN = 0.1;

// --- Visual styles ---

/**
 * Visual styles for stereometry scene elements.
 *
 * Keys follow the format 'element:modifier1:modifier2' where modifiers
 * are sorted alphabetically. The resolver cascades from general to specific.
 */
export const STEREOMETRY_STYLES = {
  line: {
    color: '#FFFFFF',
    width: 1.0,
    alpha: 1.0,
    line: { type: 'solid' as const },
  },
  'line:hidden': {
    alpha: 0.3,
    line: { type: 'dashed' as const, dash: 10.0, gap: 10.0 },
  },
  'line:selected': {
    color: '#55AAFF',
  },
  'line:hidden:selected': {
    alpha: 1,
  },
  'line:segment': {
    width: 3.0,
  },
  'line:preview': {
    color: '#4488BB',
  },
  'line:inner': {
    width: 3.0,
  },
  'line:input': {
    color: '#FF8973',
    width: 3.0,
    alpha: 1,
  },
  'line:input:selected': {
    color: '#A61A00',
  },
  'line:segment:input': {
    color: '#FF8973',
    width: 3.0,
    alpha: 1,
  },
  'line:segment:input:selected': {
    color: '#A61A00',
  },
  'line:solution': {
    color: '#EFBF04',
  },

  vertex: {
    markerType: 'circle',
    color: '#000000',
    size: 10,
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
  },
  'vertex:hidden': {
    strokeColor: '#999999',
  },
  'vertex:selected': {
    color: '#55AAFF',
  },
  'vertex:hidden:selected': {
    color: '#3388DD',
  },
  'vertex:inner': {
    strokeColor: '#AAFF44',
    color: '#AAAAAA',
  },
  'vertex:inner:hidden': {
    strokeColor: '#77CC22',
    color: '#000000',
  },
  'vertex:preview': {
    color: '#000000',
    strokeColor: '#4488BB',
    strokeWidth: 6,
    size: 16,
  },
  'vertex:input': {
    markerType: 'solid',
    color: '#FF8973',
    size: 10,
  },
  'vertex:input:hidden': {
    markerType: 'solid',
    color: '#FF8973',
    size: 10,
  },
  'vertex:input:selected': {
    markerType: 'solid',
    color: '#A61A00',
    size: 10,
  },
  'vertex:solution': {
    markerType: 'solid',
    color: '#EFBF04',
  },
  'vertex:solution:hidden': {
    markerType: 'solid',
    color: '#EFBF04',
  },

  'face:solution': {
    color: '#EFBF04',
    alpha: 0.1,
  },

  background: {
    color: '#1A1A1F',
  },
} satisfies Readonly<Record<string, PartialElementStyle>>;
