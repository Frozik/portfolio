import { LRUCache } from 'lru-cache';

interface IGlyphMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly centerOffset: number;
}

const DEFAULT_MAX_SIZE = 500;

/**
 * LRU cache for Canvas 2D text measurements.
 *
 * Caches `measureText().width` per label string and glyph vertical metrics
 * (ascent/descent/centerOffset) per font configuration. Invalidates
 * automatically when font changes (e.g. DPR change triggers font size change).
 *
 * At 60fps with ~20 axis labels per chart, this avoids ~1200 measureText()
 * calls per second per chart — each is a synchronous browser layout query.
 */
export class TextMeasureCache {
  private widthCache: LRUCache<string, number>;
  private currentFont = '';
  private glyphMetrics: IGlyphMetrics | null = null;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.widthCache = new LRUCache({ max: maxSize });
  }

  measureWidth(ctx: CanvasRenderingContext2D, text: string): number {
    this.ensureFont(ctx);

    const cached = this.widthCache.get(text);

    if (cached !== undefined) {
      return cached;
    }

    const width = ctx.measureText(text).width;
    this.widthCache.set(text, width);

    return width;
  }

  getGlyphMetrics(ctx: CanvasRenderingContext2D): IGlyphMetrics {
    this.ensureFont(ctx);

    if (this.glyphMetrics !== null) {
      return this.glyphMetrics;
    }

    const metrics = ctx.measureText('0');
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;

    this.glyphMetrics = {
      ascent,
      descent,
      centerOffset: (ascent - descent) / 2,
    };

    return this.glyphMetrics;
  }

  private ensureFont(ctx: CanvasRenderingContext2D): void {
    if (ctx.font === this.currentFont) {
      return;
    }

    this.currentFont = ctx.font;
    this.widthCache.clear();
    this.glyphMetrics = null;
  }
}
