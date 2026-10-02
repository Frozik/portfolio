import { isNil } from 'lodash-es';

import { rgba } from '../../core/series/color';
import type { IMark } from '../../core/series/mark';
import type { TPaintSource } from '../../core/series/paint';
import { colorsOf, sizesOf } from '../../core/series/paint';
import type { TShape } from '../../core/series/shape';
import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IColumnMarkOptions } from './core';

const DEFAULT_COLOR = rgba(0, 0.5, 1, 0.6);
const DEFAULT_WIDTH = 5;
const DEFAULT_GAP = 1;
const NO_STROKE = { color: 0, size: 0 } as const;

export interface IColumnStyleOptions<TX> {
  readonly shape?: TShape;
  readonly color?: TPaintSource<TX>;
  /** Width of a column, CSS pixels: with `gap`, what the scale is chosen from (§4.3). */
  readonly width?: number;
  /** The least room kept between neighbouring columns, CSS pixels. */
  readonly gap?: number;
  /** Where the columns stand: the bottom of the plot by default, nought for a histogram. */
  readonly baseline?: number | 'bottom';
  readonly stroke?: { readonly color: TPaintSource<TX>; readonly size: TPaintSource<TX> };
}

export function createColumnStyle<TX>(
  mark: IMark,
  options: IColumnStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  const {
    color = DEFAULT_COLOR,
    width = DEFAULT_WIDTH,
    gap = DEFAULT_GAP,
    baseline = 'bottom',
    stroke,
  } = options;
  const markOptions: IColumnMarkOptions = { baseline, gap };

  return {
    shape: options.shape ?? 'point',
    elementWidth: width,
    elementGap: gap,
    style: run => ({
      marks: [{ mark, options: markOptions }],
      fill: { color: colorsOf(run, color), size: width },
      stroke: isNil(stroke)
        ? NO_STROKE
        : { color: colorsOf(run, stroke.color), size: sizesOf(run, stroke.size) },
    }),
  };
}
