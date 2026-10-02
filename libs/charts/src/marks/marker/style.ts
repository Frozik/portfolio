import { isNil } from 'lodash-es';

import { rgba } from '../../core/series/color';
import type { IMark } from '../../core/series/mark';
import type { TPaintSource } from '../../core/series/paint';
import { colorsOf, sizesOf } from '../../core/series/paint';
import type { TShape } from '../../core/series/shape';
import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IMarkerMarkOptions } from './core';
import type { TFigure } from './figures';

const DEFAULT_COLOR = rgba(0, 0.5, 1);
const DEFAULT_SIZE = 8;
const TRANSPARENT = 0;
const NO_STROKE = { color: 0, size: 0 } as const;

export interface IMarkerStyleOptions<TX> {
  readonly shape?: TShape;
  readonly figure?: TFigure;
  readonly color?: TPaintSource<TX>;
  /** The side of the square the figure is inscribed in, CSS pixels. */
  readonly size?: TPaintSource<TX>;
  /** The outline of the figure; with a transparent `color` the figure is hollow. */
  readonly stroke?: { readonly color: TPaintSource<TX>; readonly size: TPaintSource<TX> };
  /** The least distance between neighbouring markers along X, CSS pixels: the scale is chosen so they do not crowd (§4.3). One pixel by default. */
  readonly spacing?: number;
}

export function createMarkerStyle<TX>(
  mark: IMark,
  options: IMarkerStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  const { color = DEFAULT_COLOR, size = DEFAULT_SIZE, stroke } = options;
  const markOptions: IMarkerMarkOptions = { figure: options.figure ?? 'circle' };

  return {
    shape: options.shape ?? 'point',
    elementWidth: options.spacing ?? 1,
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

export interface IRingStyleOptions<TX> {
  readonly shape?: TShape;
  readonly color?: TPaintSource<TX>;
  readonly size?: TPaintSource<TX>;
  /** Thickness of the ring, CSS pixels. */
  readonly width?: TPaintSource<TX>;
  readonly spacing?: number;
}

/** A circle with no fill and an outline. */
export function createRingStyle<TX>(
  mark: IMark,
  options: IRingStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  return createMarkerStyle(mark, {
    shape: options.shape,
    figure: 'circle',
    color: TRANSPARENT,
    size: options.size,
    stroke: { color: options.color ?? DEFAULT_COLOR, size: options.width ?? 1 },
    spacing: options.spacing,
  });
}
