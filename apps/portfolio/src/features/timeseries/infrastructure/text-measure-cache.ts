import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { LRUCache } from 'lru-cache';

import type { IGlyphMetrics, ITextMeasurer } from '../domain/text-measurer';

const DEFAULT_MAX_SIZE = 500;

/**
 * Memoises `measureText` per label and the glyph metrics per font on a
 * private measuring context, invalidating when the font changes (a DPR
 * change changes the font size). Saves ~1200 synchronous layout queries per
 * second per chart at 60 fps.
 */
export class TextMeasureCache implements ITextMeasurer {
  private readonly context: CanvasRenderingContext2D;
  private readonly widthCache: LRUCache<string, number>;
  private currentFont = '';
  private glyphMetrics: IGlyphMetrics | undefined;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    const context = document.createElement('canvas').getContext('2d');
    assert(!isNil(context), '2D canvas context unavailable for text measuring');
    this.context = context;
    this.widthCache = new LRUCache({ max: maxSize });
  }

  measureWidth(text: string, font: string): number {
    this.ensureFont(font);
    const cached = this.widthCache.get(text);
    if (!isNil(cached)) {
      return cached;
    }
    const width = this.context.measureText(text).width;
    this.widthCache.set(text, width);
    return width;
  }

  /** Alphabetic baseline plus this offset centres digit-only labels; the `middle` baseline sits too high. */
  getGlyphMetrics(font: string): IGlyphMetrics {
    this.ensureFont(font);
    if (!isNil(this.glyphMetrics)) {
      return this.glyphMetrics;
    }
    const metrics = this.context.measureText('0');
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    this.glyphMetrics = { ascent, descent, centerOffset: (ascent - descent) / 2 };
    return this.glyphMetrics;
  }

  private ensureFont(font: string): void {
    if (font === this.currentFont) {
      return;
    }
    this.currentFont = font;
    this.context.font = font;
    this.widthCache.clear();
    this.glyphMetrics = undefined;
  }
}
