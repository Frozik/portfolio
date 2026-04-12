export const MIN_CAMERA_DISTANCE = 3;
export const MAX_CAMERA_DISTANCE = 15;
export const INITIAL_CAMERA_DISTANCE = 5;

export const MOUSE_ROTATE_SENSITIVITY = 0.005;
export const MOUSE_PAN_SENSITIVITY = 0.003;
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

/** Orthographic scale: half-height = distance * ORTHO_SCALE */
export const ORTHO_SCALE = Math.tan(FIELD_OF_VIEW_RADIANS / 2);

export const BACKGROUND_COLOR = { r: 0.1, g: 0.1, b: 0.12, a: 1 };

export const MS_PER_SECOND = 1000;

/** Number of vertices per line quad (2 triangles = 6 vertices) */
export const VERTICES_PER_LINE_QUAD = 6;

/** Per-edge instance data: startPosition(3) + endPosition(3) = 6 floats */
export const FLOATS_PER_EDGE_INSTANCE = 6;

// --- Visible segment (edge) dimensions ---
/** Line width in screen pixels for visible normal segments */
export const SEGMENT_WIDTH_PIXELS = 5.0;
/** Line width in screen pixels for visible highlighted segments */
export const SEGMENT_HIGHLIGHT_WIDTH_PIXELS = 7.0;

// --- Hidden segment dimensions (behind faces) ---
/** Line width in screen pixels for hidden normal segments */
export const HIDDEN_SEGMENT_WIDTH_PIXELS = 5.0;
/** Line width in screen pixels for hidden highlighted segments */
export const HIDDEN_SEGMENT_HIGHLIGHT_WIDTH_PIXELS = 7.0;

// --- Extended line dimensions (thinner than segments) ---
/** Line width in screen pixels for visible extended lines */
export const EXTENDED_LINE_WIDTH_PIXELS = 2;
/** Line width in screen pixels for visible highlighted extended lines */
export const EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS = 5;
/** Line width in screen pixels for hidden extended lines */
export const HIDDEN_EXTENDED_LINE_WIDTH_PIXELS = 2.5;
/** Line width in screen pixels for hidden highlighted extended lines */
export const HIDDEN_EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS = 3.5;
/** Brightness multiplier for hidden elements (edges and vertex markers behind faces) */
export const HIDDEN_BRIGHTNESS = 0.3;

// --- Pipeline-overridable constant IDs for edge shader ---
export const EDGE_NORMAL_WIDTH_OVERRIDE_ID = 0;
export const EDGE_HIGHLIGHT_WIDTH_OVERRIDE_ID = 1;
export const EDGE_BRIGHTNESS_OVERRIDE_ID = 2;
export const EDGE_DASH_LENGTH_OVERRIDE_ID = 3;
export const EDGE_GAP_LENGTH_OVERRIDE_ID = 4;

/** Dash pattern for hidden edges: dash length in screen pixels */
export const HIDDEN_DASH_LENGTH_PIXELS = 10.0;
/** Dash pattern for hidden edges: gap length in screen pixels */
export const HIDDEN_GAP_LENGTH_PIXELS = 10.0;

// --- Pipeline-overridable constant ID for vertex marker shader ---
export const MARKER_USE_HIGHLIGHT_COLOR_OVERRIDE_ID = 0;

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

/** Selection highlight color (light blue) */
export const HIGHLIGHT_COLOR: readonly [number, number, number] = [0.4, 0.75, 1.0];

/** Drag-to-connect preview line and snap target marker color (orange) */
export const DRAG_PREVIEW_COLOR: readonly [number, number, number] = [1.0, 0.6, 0.0];

/** Diameter in screen pixels for selected vertex marker */
export const VERTEX_MARKER_SIZE_PIXELS = 20.0;
/** Diameter in screen pixels for non-selected vertex markers */
export const VERTEX_MARKER_SMALL_SIZE_PIXELS = 6.0;

/** Pipeline-overridable constant ID for marker size override */
export const MARKER_SIZE_OVERRIDE_ID = 1;

/** Click detection: max movement in pixels to still count as a click */
export const CLICK_MOVEMENT_THRESHOLD = 3;

/** Click detection: max time in milliseconds to still count as a click */
export const CLICK_TIME_THRESHOLD_MS = 300;

/** Hit testing: radius in screen pixels for vertex proximity detection */
export const VERTEX_HIT_RADIUS_PIXELS = 15;

/** Hit testing: max distance in screen pixels from edge line to count as a hit */
export const EDGE_HIT_RADIUS_PIXELS = 10;

/** Max 3D distance between two lines to consider them intersecting */
export const LINE_INTERSECTION_MAX_DISTANCE = 0.01;

/** Double-click/double-tap: max time between two clicks */
export const DOUBLE_CLICK_TIME_THRESHOLD_MS = 400;
/** Double-click/double-tap: max distance between two click positions */
export const DOUBLE_CLICK_DISTANCE_THRESHOLD = 10;

/** How far to extend a line beyond the edge endpoints (in world units) */
export const LINE_EXTENSION_LENGTH = 1000;
