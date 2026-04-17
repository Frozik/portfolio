export const VERTICES_PER_INSTANCE = 18;
// Keep in sync with BORDER_SEGMENT_COUNT in shaders/chart.wgsl
export const BORDER_SEGMENT_COUNT = 4;

export const BACKGROUND_R = 0.149;
export const BACKGROUND_G = 0.149;
export const BACKGROUND_B = 0.149;

export const SIN_PEN_MIN = 2.0;
export const SIN_PEN_MAX = 20.0;

export const BORDER_MARGIN = 20;

export const SIN_SEGMENTS_DIVISOR = 4;
export const HALF = 0.5;

export const MSAA_SAMPLE_COUNT = 4;
export const SIN_Y_LAYER_OPACITY = 0.7;

// --- Animated shapes constants ---
// Shapes per pixel of canvas area. At 1920x1080, yields ~518 shapes.
export const SHAPE_DENSITY = 1e-4;
// Upper bound for GPU buffer pre-allocation. Sufficient for ~8K display at 2x DPR.
export const MAX_SHAPE_BUFFER_COUNT = 16_384;
// Keep in sync with FADE_DURATION in shaders/shapes.wgsl
export const SHAPE_FADE_DURATION = 0.5;
export const SHAPE_HOLD_DURATION_MIN = 2.0;
export const SHAPE_HOLD_DURATION_MAX = 3.0;
export const SHAPE_SIZE_MIN = 40;
export const SHAPE_SIZE_MAX = 160;
// Keep in sync with SHAPE_TYPE_COUNT in shaders/shapes.wgsl
export const SHAPE_TYPE_COUNT = 10;
export const SHAPE_VERTICES_PER_INSTANCE = 6;
export const SHAPE_MIN_BRIGHTNESS = 0.4;
// Each shape: 3 x vec4<f32> = 48 bytes
export const SHAPE_INSTANCE_BYTES = 48;

export const SHAPE_OPACITY_MIN = 0.6;
export const SHAPE_OPACITY_MAX = 1.0;

export const OFFSCREEN_FORMAT: GPUTextureFormat = 'rgba8unorm';

export function computeSinXSegmentCount(canvasWidth: number): number {
  return Math.trunc(canvasWidth / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
}

export function computeSinYSegmentCount(canvasHeight: number): number {
  return Math.trunc(canvasHeight / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
}

export const ALPHA_BLEND_STATE: GPUBlendState = {
  color: {
    srcFactor: 'src-alpha',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
};
