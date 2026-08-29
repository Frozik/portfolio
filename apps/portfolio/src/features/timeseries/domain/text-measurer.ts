export interface IGlyphMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly centerOffset: number;
}

/**
 * Domain port for Canvas 2D text metrics. Implemented by the
 * infrastructure `TextMeasureCache`, which memoises `measureText` calls
 * per font — the axis painter only needs the pure measurement surface.
 */
export interface ITextMeasurer {
  measureWidth(ctx: CanvasRenderingContext2D, text: string): number;
  getGlyphMetrics(ctx: CanvasRenderingContext2D): IGlyphMetrics;
}
