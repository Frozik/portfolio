import { isNil } from 'lodash-es';

import { rgba } from '../../core/series/color';
import type { IMark } from '../../core/series/mark';
import type { TPaintSource } from '../../core/series/paint';
import { colorsOf, sizesOf } from '../../core/series/paint';
import type { TShape } from '../../core/series/shape';
import type { IStyleProcessor } from '../../core/series/style-processor';
import type { ILineMarkOptions, TLineJoin } from './core';

const DEFAULT_COLOR = rgba(0, 0.5, 1);
const DEFAULT_SIZE = 1;
const NO_STROKE = { color: 0, size: 0 } as const;

export interface ILineStyleOptions<TX> {
  /** The shape to draw from; a line from candles runs through the four points of each (§5.4). */
  readonly shape?: TShape;
  readonly color?: TPaintSource<TX>;
  /** Thickness, CSS pixels. */
  readonly size?: TPaintSource<TX>;
  /** An outline along both sides of the line. */
  readonly stroke?: { readonly color: TPaintSource<TX>; readonly size: TPaintSource<TX> };
  readonly join?: TLineJoin;
}

export function createLineStyle<TX>(
  mark: IMark,
  options: ILineStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  const markOptions: ILineMarkOptions = { join: options.join ?? 'linear', paint: 'fill' };
  const { color = DEFAULT_COLOR, size = DEFAULT_SIZE, stroke } = options;

  return {
    shape: options.shape ?? 'point',
    elementWidth: 1,
    elementGap: 0,
    style: run => ({
      marks: [{ mark, options: markOptions }],
      fill: { color: colorsOf(run, color), size: sizesOf(run, size) },
      stroke: isNil(stroke)
        ? NO_STROKE
        : { color: colorsOf(run, stroke.color), size: sizesOf(run, stroke.size) },
    }),
  };
}
