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
export const SHAPE_DENSITY = 1e-5;
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

// Uniform buffer layout:
// mat4x4<f32> mvp            (64 bytes, offset 0)
// vec2<f32>   viewport       (8 bytes, offset 64)
// f32         time           (4 bytes, offset 72)
// u32         sinCount       (4 bytes, offset 76)
// f32         sinPenMin      (4 bytes, offset 80)
// f32         sinPenMax      (4 bytes, offset 84)
// f32         borderMargin   (4 bytes, offset 88)
// u32         borderOffset   (4 bytes, offset 92)
// u32         sinYCount      (4 bytes, offset 96)
// padding                    (12 bytes, offset 100 -- pad to 112 for 16-byte alignment)
// total = 112 bytes
export const UNIFORM_BUFFER_SIZE = 112;

// Compositing uniform: just the opacity float (padded to 16 for alignment)
export const COMPOSITE_UNIFORM_SIZE = 16;

export const FULLSCREEN_TRIANGLE_VERTEX_COUNT = 3;

export const OFFSCREEN_FORMAT: GPUTextureFormat = 'rgba8unorm';

export const MS_PER_SECOND = 1000;
