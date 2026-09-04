export interface IGlyphMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly centerOffset: number;
}

/** Text metrics for a CSS font string; the infrastructure measures with a canvas, the domain never sees it. */
export interface ITextMeasurer {
  measureWidth(text: string, font: string): number;
  getGlyphMetrics(font: string): IGlyphMetrics;
}
