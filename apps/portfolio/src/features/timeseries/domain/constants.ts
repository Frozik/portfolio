/** Maximum number of data points stored per texture row. */
export const TEXTURE_WIDTH = 2048;

/** Maximum number of rows available in the data texture. */
export const TEXTURE_MAX_ROWS = 512;

/** Initial number of rows allocated for the data texture (grows by 2x as needed). */
export const TEXTURE_INITIAL_ROWS = 4;

/** Number of float32 values stored per data point: x-delta, y-delta, size, packed-color. */
export const FLOATS_PER_POINT = 4;

/** Vertical padding ratio applied to the value axis range. */
export const Y_PADDING_RATIO = 0.1;

/** Default line width in pixels. */
export const LINE_WIDTH_PX = 2.0;

/** Minimum simulated loading delay in milliseconds. */
export const LOADING_DELAY_MIN_MS = 200;

/** Maximum simulated loading delay in milliseconds. */
export const LOADING_DELAY_MAX_MS = 500;

/** Global epoch offset — January 1, 2026 00:00:00 UTC in seconds. */
export const GLOBAL_EPOCH_OFFSET = 1_767_225_600;

/** Background color red component (matches webgpu-graphics). */
export const BACKGROUND_R = 0.149;

/** Background color green component. */
export const BACKGROUND_G = 0.149;

/** Background color blue component. */
export const BACKGROUND_B = 0.149;

/** MSAA sample count for anti-aliased rendering. */
export const MSAA_SAMPLE_COUNT = 4;

/** Number of vertices per segment: 6 join A + 6 join B + 6 line body = 18. */
export const VERTICES_PER_SEGMENT = 18;

/** Rhombus: 6 vertices (quad), shape cut in fragment shader via discard. */
export const VERTICES_PER_RHOMBUS = 6;

/** Value offset for second series (additive to base random walk). */
export const SERIES_2_VALUE_OFFSET = 2.0;

/** Duration threshold: ranges wider than this (in seconds) use Year scale. */
export const YEAR_DURATION_THRESHOLD = 180 * 24 * 3600;

/** Duration threshold: ranges wider than this use Month scale. */
export const MONTH_DURATION_THRESHOLD = 20 * 24 * 3600;

/** Duration threshold: ranges wider than this use Week scale. */
export const WEEK_DURATION_THRESHOLD = 3 * 24 * 3600;

/** Duration threshold: ranges wider than this use Day scale. */
export const DAY_DURATION_THRESHOLD = 6 * 3600;

/** Duration threshold: ranges wider than this use Hour scale. */
export const HOUR_DURATION_THRESHOLD = 10 * 60;

/** Half constant for readability in float calculations. */
export const HALF = 0.5;

/** Clip space coordinate range (from -1 to 1). */
export const CLIP_RANGE = 2.0;

/** Milliseconds per second. */
export const MS_PER_SECOND = 1000;

/** Uniform buffer size in bytes (padded to 16-byte alignment).
 * Layout:
 *   vec2<f32> viewport      (8 bytes, offset 0)
 *   f32       timeRangeMin  (4 bytes, offset 8)
 *   f32       timeRangeMax  (4 bytes, offset 12)
 *   f32       valueRangeMin (4 bytes, offset 16)
 *   f32       valueRangeMax (4 bytes, offset 20)
 *   u32       pointCount    (4 bytes, offset 24)
 *   u32       textureWidth  (4 bytes, offset 28)
 *   f32       lineWidth     (4 bytes, offset 32)
 *   u32       textureRow    (4 bytes, offset 36)
 *   f32       baseTime      (4 bytes, offset 40)
 *   f32       baseValue     (4 bytes, offset 44)
 *   total = 48 bytes (aligned)
 */
export const UNIFORM_BUFFER_SIZE = 48;

/** Number of float32 values in the uniform buffer. */
export const UNIFORM_FLOAT_COUNT = UNIFORM_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT;

/** Minimum zoom factor per mouse wheel step. */
export const ZOOM_FACTOR_MIN = 0.9;

/** Maximum zoom factor per mouse wheel step. */
export const ZOOM_FACTOR_MAX = 1.1;

/** Minimum allowed time range in seconds (1 minute). */
export const MIN_TIME_RANGE_SECONDS = 60;

/** Interpolation speed for animated zoom (0–1, higher = faster). */
export const ZOOM_LERP_SPEED = 0.18;

/** Threshold below which the viewport snaps to target (in seconds). */
export const ZOOM_SNAP_THRESHOLD = 0.001;

/** One full year duration in seconds. */
export const FULL_YEAR_SECONDS = 365 * 24 * 3600;

/** Default line color: a pleasant blue tone — rgba(0.2, 0.6, 1.0, 1.0). */
export const LINE_COLOR_R = 0.2;
export const LINE_COLOR_G = 0.6;
export const LINE_COLOR_B = 1.0;
export const LINE_COLOR_A = 1.0;

/** Default point size stored in the texture data. */
export const DEFAULT_POINT_SIZE = 1.0;

/** SVG axis margins in pixels. */
export const AXIS_MARGIN_LEFT = 60;
export const AXIS_MARGIN_BOTTOM = 30;
export const AXIS_MARGIN_TOP = 10;
export const AXIS_MARGIN_RIGHT = 10;

/** SVG namespace. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Axis tick length in pixels. */
export const TICK_LENGTH = 5;

/** Axis label color. */
export const AXIS_LABEL_COLOR = '#999';

/** Axis line color. */
export const AXIS_LINE_COLOR = '#555';

/** Grid line color. */
export const GRID_LINE_COLOR = '#333';

/** Axis font size in pixels. */
export const AXIS_FONT_SIZE = 11;

/** Axis font family. */
export const AXIS_FONT_FAMILY = 'monospace';
