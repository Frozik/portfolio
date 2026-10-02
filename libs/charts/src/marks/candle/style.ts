import type { TColor } from '../../core/series/color';
import type { IMark } from '../../core/series/mark';
import type { TPaintSource } from '../../core/series/paint';
import { colorsOf } from '../../core/series/paint';
import { defineStyle } from '../../core/series/style-processor';
import type { IStyleProcessor } from '../../core/series/style-processor';
import type { ICandleMarkOptions } from './core';

const DEFAULT_WIDTH = 5;
const DEFAULT_GAP = 1;
const DEFAULT_STROKE_SIZE = 1;

export interface ICandleStyleOptions<TX> {
  /** Width of the body, CSS pixels: with `gap`, what the scale is chosen from (§4.3). */
  readonly width?: number;
  /** The least room kept between neighbouring candles, CSS pixels. */
  readonly gap?: number;
  /** Body colours of a rising and a falling candle; the theme's by default. */
  readonly up?: TColor;
  readonly down?: TColor;
  /** The body colour of each candle, instead of `up` and `down`. */
  readonly color?: TPaintSource<TX>;
  /** The wick and the outline of the body; the theme's colour and one pixel by default. */
  readonly stroke?: { readonly color?: TColor; readonly size?: number };
}

export function createCandleStyle<TX>(
  mark: IMark,
  options: ICandleStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  const { width = DEFAULT_WIDTH, gap = DEFAULT_GAP, color, stroke } = options;
  const markOptions: ICandleMarkOptions = { gap };

  return defineStyle<TX, 'candle'>({
    shape: 'candle',
    elementWidth: width,
    elementGap: gap,
    style: (run, { theme }) => {
      const up = options.up ?? theme.candle.up;
      const down = options.down ?? theme.candle.down;
      const byDirection: TPaintSource<TX> = sample => (sample.close >= sample.open ? up : down);
      return {
        marks: [{ mark, options: markOptions }],
        fill: { color: colorsOf(run, color ?? byDirection), size: width },
        stroke: {
          color: stroke?.color ?? theme.candle.stroke,
          size: stroke?.size ?? DEFAULT_STROKE_SIZE,
        },
      };
    },
  });
}
