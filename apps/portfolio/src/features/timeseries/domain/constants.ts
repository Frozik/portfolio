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

/** Candlestick: 6 vertices (quad), shape cut in fragment shader. */
export const VERTICES_PER_CANDLESTICK = 6;

/** Number of fBm octaves summed for the noise signal. */
export const FBM_OCTAVES = 6;

/** Frequency multiplier between successive fBm octaves. */
export const FBM_LACUNARITY = 2.0;

/** Amplitude multiplier (persistence) between successive fBm octaves. */
export const FBM_GAIN = 0.5;

/** Base frequency of the lowest fBm octave. */
export const FBM_BASE_FREQUENCY = 4.0;

/** Base amplitude of the lowest fBm octave. */
export const FBM_BASE_AMPLITUDE = 15.0;

/** Center value around which fBm oscillates. */
export const FBM_VALUE_CENTER = 100;

/** Y-axis offset between octave planes in 2D noise to decorrelate octaves. */
export const OCTAVE_OFFSET = 1000;

/** Number of data points stored per fixed-size texture slot. */
export const POINTS_PER_SLOT = 256;

/** Number of 256-point slots that fit in one texture row (2048 / 256). */
export const SLOTS_PER_ROW = 8;

/** Half constant for readability in float calculations. */
export const HALF = 0.5;

/** Clip space coordinate range (from -1 to 1). */
export const CLIP_RANGE = 2.0;

/** Milliseconds per second. */
export const MS_PER_SECOND = 1000;

/** Minimum zoom factor per mouse wheel step. */
export const ZOOM_FACTOR_MIN = 0.7;

/** Maximum zoom factor per mouse wheel step. */
export const ZOOM_FACTOR_MAX = 1.3;

/** Minimum allowed time range in seconds (1 minute). */
export const MIN_TIME_RANGE_SECONDS = 60;

/** Interpolation speed for animated zoom (0–1, higher = faster). */
export const ZOOM_LERP_SPEED = 0.18;

/** Relative threshold: snap to target when remaining delta is less than this fraction of visible range. */
export const ZOOM_SNAP_THRESHOLD = 0.005;

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
export const AXIS_MARGIN_LEFT = 10;
export const AXIS_MARGIN_BOTTOM = 10;
export const AXIS_MARGIN_TOP = 10;
export const AXIS_MARGIN_RIGHT = 10;

/** SVG namespace. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Axis tick length in pixels. */
export const TICK_LENGTH = 5;

/** Axis label color. */
export const AXIS_LABEL_COLOR = '#ccc';

/** Axis label background color (semi-transparent). */
export const AXIS_LABEL_BG_COLOR = 'rgba(50, 50, 50, 0.75)';

/** Padding around axis label background in pixels. */
export const AXIS_LABEL_BG_PADDING_X = 3;
export const AXIS_LABEL_BG_PADDING_Y = 2;

/** Minimum clearance in pixels between Y-axis labels and the X-axis label zone. */
export const Y_LABEL_X_AXIS_CLEARANCE = 18;

/** Minimum clearance in pixels between X-axis labels and the Y-axis line. */
export const X_LABEL_Y_AXIS_CLEARANCE = 18;

/** Axis line color. */
export const AXIS_LINE_COLOR = '#aaa';

/** Grid line color. */
export const GRID_LINE_COLOR = '#444';

/** Axis font size in pixels. */
export const AXIS_FONT_SIZE = 11;

/** Axis font family. */
export const AXIS_FONT_FAMILY = 'monospace';

/** Initial offscreen canvas width in pixels. */
export const INITIAL_OFFSCREEN_WIDTH = 1024;

/** Initial offscreen canvas height in pixels. */
export const INITIAL_OFFSCREEN_HEIGHT = 768;

/** Seconds in approximately 3 months (90 days). */
const THREE_MONTHS_SECONDS = 90 * 24 * 3600;

/** Seconds in approximately 1 month (30 days). */
const ONE_MONTH_SECONDS = 30 * 24 * 3600;

/** Seconds in 1 week (7 days). */
const ONE_WEEK_SECONDS = 7 * 24 * 3600;

/** Initial zoom levels for the 4 demo charts: [timeStart, timeEnd] pairs as offsets from GLOBAL_EPOCH_OFFSET. */
export const CHART_ZOOM_LEVELS: ReadonlyArray<readonly [number, number]> = [
  // Full year view
  [0, FULL_YEAR_SECONDS],
  // ~3 months centered
  [
    FULL_YEAR_SECONDS / 2 - THREE_MONTHS_SECONDS / 2,
    FULL_YEAR_SECONDS / 2 + THREE_MONTHS_SECONDS / 2,
  ],
  // ~1 month centered
  [FULL_YEAR_SECONDS / 2 - ONE_MONTH_SECONDS / 2, FULL_YEAR_SECONDS / 2 + ONE_MONTH_SECONDS / 2],
  // ~1 week centered
  [FULL_YEAR_SECONDS / 2 - ONE_WEEK_SECONDS / 2, FULL_YEAR_SECONDS / 2 + ONE_WEEK_SECONDS / 2],
];
