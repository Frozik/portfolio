// Keep in sync with INSTANCE_COUNT in shaders/sun.wgsl
export const INSTANCE_COUNT = 100_000;

export const BACKGROUND_COLOR = { r: 0.149, g: 0.149, b: 0.149, a: 1 };

export const MIN_CAMERA_DISTANCE = 5;
export const MAX_CAMERA_DISTANCE = 20;
export const INITIAL_CAMERA_DISTANCE = 16;
export const MOUSE_ROTATE_SENSITIVITY = 0.005;
export const WHEEL_ZOOM_SENSITIVITY = 0.01;
export const INITIAL_ELEVATION = Math.PI / 2;
export const ELEVATION_MIN = 0.01;
export const ELEVATION_MAX = Math.PI - 0.01;

export const INERTIA_DAMPING = 0.95;
export const INERTIA_MIN_VELOCITY = 0.1;

export const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
export const NEAR_PLANE = 0.1;
export const FAR_PLANE = 100;

export const MSAA_SAMPLE_COUNT = 4;

export const VERTICES_PER_TRIANGLE = 3;

export const MS_PER_SECOND = 1000;
