export const MIN_CAMERA_DISTANCE = 3;
export const MAX_CAMERA_DISTANCE = 15;
export const INITIAL_CAMERA_DISTANCE = 5;

export const MOUSE_ROTATE_SENSITIVITY = 0.005;
export const WHEEL_ZOOM_SENSITIVITY = 0.01;

export const INITIAL_ELEVATION = Math.PI / 3;

export const INERTIA_DAMPING = 0.95;
export const INERTIA_MIN_VELOCITY = 0.1;

/** Exponential smoothing factor for zoom animation (0 = no movement, 1 = instant) */
export const ZOOM_SMOOTHING_FACTOR = 0.1;
/** Distance threshold below which zoom snaps to target to avoid infinite lerp tail */
export const ZOOM_SNAP_THRESHOLD = 0.001;

export const MSAA_SAMPLE_COUNT = 4;

export const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 100;

export const BACKGROUND_COLOR = { r: 0.1, g: 0.1, b: 0.12, a: 1 };

export const MS_PER_SECOND = 1000;

/** Pentagonal pyramid: base radius and apex height */
export const PYRAMID_BASE_RADIUS = 1.0;
export const PYRAMID_HEIGHT = 1.5;

/** Number of sides in the pentagonal base */
export const PENTAGON_SIDES = 5;

/** Edges: 5 base edges + 5 lateral edges (base to apex) */
export const EDGE_COUNT = 10;

/** Line width in screen pixels for wireframe rendering */
export const LINE_WIDTH_PIXELS = 2.0;

/** Number of vertices per line quad (2 triangles = 6 vertices) */
export const VERTICES_PER_LINE_QUAD = 6;

/** Brightness multiplier for edges hidden behind faces (0 = invisible, 1 = same as visible) */
export const HIDDEN_EDGE_BRIGHTNESS = 0.25;

/** Pipeline-overridable constant ID for edge brightness in the WGSL shader */
export const EDGE_BRIGHTNESS_OVERRIDE_ID = 0;

/** Face geometry: 5 side triangles + 3 base triangles (fan triangulation of pentagon) */
export const SIDE_TRIANGLE_COUNT = 5;
export const BASE_TRIANGLE_COUNT = 3;
export const FACE_TRIANGLE_COUNT = SIDE_TRIANGLE_COUNT + BASE_TRIANGLE_COUNT;
export const VERTICES_PER_TRIANGLE = 3;
export const FACE_VERTEX_COUNT = FACE_TRIANGLE_COUNT * VERTICES_PER_TRIANGLE;

/** Floats per face vertex: position only (vec3) */
export const FACE_POSITION_FLOATS = 3;

/**
 * Depth bias applied to face geometry so that edges at the same 3D position
 * win the depth test against the face behind them (prevents z-fighting).
 */
export const FACE_DEPTH_BIAS = 2;
export const FACE_DEPTH_BIAS_SLOPE_SCALE = 1.0;
