/** What the visitor asks to see: a function and the stretch of x the chart opens on. */
export interface PlotView {
  readonly expression: string;
  readonly xMin: number;
  readonly xMax: number;
}

/** One request to the server: the function over one window of x, at one density. */
export interface SampleRequest extends PlotView {
  readonly points: number;
}

export interface PlotLimits {
  readonly expressionMaxLength: number;
  readonly sampleMaxPoints: number;
}

/** NaN in `y` is a gap: the server found the function undefined there or an asymptote. */
export interface PlotCurve {
  readonly x: readonly number[];
  readonly y: readonly number[];
}

/** Why the server could not read the expression. */
export type ExpressionErrorReason =
  | 'empty'
  | 'too-long'
  | 'too-deep'
  | 'unexpected-character'
  | 'invalid-number'
  | 'unknown-identifier'
  | 'unexpected-token'
  | 'unexpected-end'
  | 'unknown';

export type PlotInputError = 'expression-empty' | 'expression-too-long' | 'invalid-range';

/** Catches what the page can tell on its own; the expression itself is the server's to judge. */
export function validatePlotView(view: PlotView, limits: PlotLimits): PlotInputError | undefined {
  if (view.expression.trim().length === 0) {
    return 'expression-empty';
  }
  if (view.expression.length > limits.expressionMaxLength) {
    return 'expression-too-long';
  }
  if (!Number.isFinite(view.xMin) || !Number.isFinite(view.xMax) || view.xMin >= view.xMax) {
    return 'invalid-range';
  }
  return undefined;
}

/** One sample per this many physical pixels: dense enough for a smooth line, no denser. */
const PHYSICAL_PIXELS_PER_POINT = 10;
const MIN_POINTS = 2;

/**
 * How many points a window `cssPixels` wide is worth on this screen. The
 * chart asks again when the view is zoomed, so the density follows the zoom.
 */
export function pointsFor(cssPixels: number, devicePixelRatio: number, maxPoints: number): number {
  const points = Math.ceil((cssPixels * devicePixelRatio) / PHYSICAL_PIXELS_PER_POINT);
  return Math.min(maxPoints, Math.max(MIN_POINTS, points));
}

/** The server streams a curve in chunks; joined in order they are the curve. */
export function joinChunks(chunks: readonly PlotCurve[]): PlotCurve {
  return {
    x: chunks.flatMap(chunk => chunk.x),
    y: chunks.flatMap(chunk => chunk.y),
  };
}
