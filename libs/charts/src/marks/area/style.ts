import { isNil } from 'lodash-es';

import { rgba } from '../../core/series/color';
import type { IMark } from '../../core/series/mark';
import type { TPaintSource } from '../../core/series/paint';
import { colorsOf, sizesOf } from '../../core/series/paint';
import type { TShape } from '../../core/series/shape';
import type { IMarkUse, IStyleProcessor } from '../../core/series/style-processor';
import type { ILineMarkOptions, TLineJoin } from '../line/core';
import type { IAreaMarkOptions } from './core';

const DEFAULT_COLOR = rgba(0, 0.5, 1, 0.2);
const NO_LINE = { color: 0, size: 0 } as const;

export interface IAreaStyleOptions<TX> {
  readonly shape?: TShape;
  readonly color?: TPaintSource<TX>;
  readonly baseline?: number | 'bottom';
  readonly join?: TLineJoin;
  /** A line along the upper edge of the band, drawn over it. */
  readonly line?: { readonly color: TPaintSource<TX>; readonly size: TPaintSource<TX> };
}

export interface IAreaMarks {
  readonly area: IMark;
  /** Draws the edge line; needed only when the style asks for one. */
  readonly line: IMark;
}

export function createAreaStyle<TX>(
  marks: IAreaMarks,
  options: IAreaStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  const { color = DEFAULT_COLOR, baseline = 'bottom', join = 'linear', line } = options;
  const areaOptions: IAreaMarkOptions = { baseline, join };
  const edgeOptions: ILineMarkOptions = { join, paint: 'stroke' };
  const uses: readonly IMarkUse[] = isNil(line)
    ? [{ mark: marks.area, options: areaOptions }]
    : [
        { mark: marks.area, options: areaOptions },
        { mark: marks.line, options: edgeOptions },
      ];

  return {
    shape: options.shape ?? 'point',
    elementWidth: 1,
    elementGap: 0,
    style: run => ({
      marks: uses,
      fill: { color: colorsOf(run, color), size: 0 },
      stroke: isNil(line)
        ? NO_LINE
        : { color: colorsOf(run, line.color), size: sizesOf(run, line.size) },
    }),
  };
}
