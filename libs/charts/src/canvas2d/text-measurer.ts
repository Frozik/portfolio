import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

export interface IGlyphMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly centerOffset: number;
}

export interface ITextMeasurer {
  measureWidth(text: string, font: string): number;
  getGlyphMetrics(font: string): IGlyphMetrics;
}

const MAX_CACHED_WIDTHS = 500;

/**
 * Memoises `measureText` per label and the glyph metrics per font on a
 * private measuring context, forgetting everything when the font changes (a
 * DPR change changes the font size). Saves a thousand synchronous layout
 * queries a second per chart at 60 fps.
 */
export function createTextMeasurer(): ITextMeasurer {
  const context = document.createElement('canvas').getContext('2d');
  assert(!isNil(context), 'no 2D canvas context to measure text with');
  const widths = new Map<string, number>();
  let currentFont = '';
  let glyphMetrics: IGlyphMetrics | undefined;

  const selectFont = (font: string): void => {
    if (font !== currentFont) {
      currentFont = font;
      context.font = font;
      widths.clear();
      glyphMetrics = undefined;
    }
  };

  return {
    measureWidth(text, font): number {
      selectFont(font);
      const cached = widths.get(text);
      if (!isNil(cached)) {
        return cached;
      }
      if (widths.size >= MAX_CACHED_WIDTHS) {
        widths.clear();
      }
      const { width } = context.measureText(text);
      widths.set(text, width);
      return width;
    },
    /** Alphabetic baseline plus this offset centres digit-only labels; the `middle` baseline sits too high. */
    getGlyphMetrics(font): IGlyphMetrics {
      selectFont(font);
      if (isNil(glyphMetrics)) {
        const metrics = context.measureText('0');
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        glyphMetrics = { ascent, descent, centerOffset: (ascent - descent) / 2 };
      }
      return glyphMetrics;
    },
  };
}
