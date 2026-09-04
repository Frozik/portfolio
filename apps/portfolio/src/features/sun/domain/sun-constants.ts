/** Instance budgets from richest to cheapest; the sphere is re-laid out for whichever is active. */
export const INSTANCE_COUNT_LEVELS = [250_000, 100_000, 25_000] as const;
/** Rolling FPS under which the current budget is considered too heavy for the device. */
export const LOW_FPS_THRESHOLD = 30;
/** Consecutive low FPS reports (one per meter update) before stepping down a level. */
export const LOW_FPS_REPORTS_TO_STEP_DOWN = 8;

export const MIN_CAMERA_DISTANCE = 5;
export const MAX_CAMERA_DISTANCE = 20;
export const INITIAL_CAMERA_DISTANCE = 16;
export const MOUSE_ROTATE_SENSITIVITY = 0.005;
export const WHEEL_ZOOM_SENSITIVITY = 0.01;
export const INITIAL_ELEVATION = Math.PI / 2;

export const INERTIA_DAMPING = 0.95;
export const INERTIA_MIN_VELOCITY = 0.1;
export const INERTIA_STALE_MOVE_MS = 100;

export const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 100;

export const MSAA_SAMPLE_COUNT = 4;

export const VERTICES_PER_TRIANGLE = 3;
