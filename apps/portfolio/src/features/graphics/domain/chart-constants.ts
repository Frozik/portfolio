export const VERTICES_PER_INSTANCE = 18;
export const BORDER_SEGMENT_COUNT = 4;

export const SIN_PEN_MIN = 2.0;
export const SIN_PEN_MAX = 20.0;

export const BORDER_MARGIN = 20;

export const SIN_SEGMENTS_DIVISOR = 4;

export const MSAA_SAMPLE_COUNT = 4;
export const SIN_Y_LAYER_OPACITY = 0.7;

/** Shapes per CSS pixel of canvas area; a 1920×1080 canvas gets ~518 shapes. */
export const SHAPE_DENSITY = 1e-4;
/** Upper bound for GPU buffer pre-allocation, enough for an 8K display at 2× DPR. */
export const MAX_SHAPE_BUFFER_COUNT = 16_384;
export const SHAPE_FADE_DURATION = 0.5;
export const SHAPE_HOLD_DURATION_MIN = 2.0;
export const SHAPE_HOLD_DURATION_MAX = 3.0;
export const SHAPE_SIZE_MIN = 40;
export const SHAPE_SIZE_MAX = 160;
export const SHAPE_VERTICES_PER_INSTANCE = 6;
export const SHAPE_MIN_BRIGHTNESS = 0.4;
/** Floor for the brightness divisor so an all-black draw cannot blow up the boost. */
export const SHAPE_BRIGHTNESS_EPSILON = 0.01;

export const SHAPE_OPACITY_MIN = 0.6;
export const SHAPE_OPACITY_MAX = 1.0;

export function computeSinXSegmentCount(canvasWidth: number): number {
  return Math.trunc(canvasWidth / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
}

export function computeSinYSegmentCount(canvasHeight: number): number {
  return Math.trunc(canvasHeight / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
}
