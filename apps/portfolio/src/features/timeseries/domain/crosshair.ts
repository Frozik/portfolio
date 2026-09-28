import { isNil } from 'lodash-es';

import { formatTimeAtScale, formatValueAtRange } from './axis-ticks';
import type { IChartFrameLayout } from './frame-layout';
import { pixelXToTime, pixelYToValue } from './plot-mapping';
import { scaleFromTimeRange } from './viewport';

const LINE_THICKNESS = 1;
const CENTER_THICKNESS_RATIO = 3;
const CENTER_ARM_LENGTH = 10;
const DASH_LENGTH = 4;

/** Where the pointer is over the chart, in CSS pixels from its top-left corner. */
export interface IPointerPosition {
  readonly x: number;
  readonly y: number;
}

/** Everything is in device pixels, measured from the top-left canvas corner. */
export interface ICrosshair {
  /** Left edge of the vertical line and top edge of the horizontal one. */
  readonly lineLeft: number;
  readonly lineTop: number;
  readonly thickness: number;
  /** The lines are this thick for `centerArmLength` to each side of where they cross. */
  readonly centerThickness: number;
  readonly centerArmLength: number;
  readonly dashLength: number;
  readonly timeLabel: string;
  readonly valueLabel: string;
}

/**
 * The crosshair under the pointer, or `undefined` while the pointer is
 * outside the plot. Lines sit on whole device pixels; the labels name the
 * time and value at the centre of the lines.
 */
export function computeCrosshair(
  layout: IChartFrameLayout,
  pointer: IPointerPosition | undefined
): ICrosshair | undefined {
  if (isNil(pointer)) {
    return undefined;
  }

  const { dpr, plotLeft, plotTop, plotRight, plotBottom } = layout;
  const pixelX = pointer.x * dpr;
  const pixelY = pointer.y * dpr;
  if (pixelX < plotLeft || pixelX > plotRight || pixelY < plotTop || pixelY > plotBottom) {
    return undefined;
  }

  const thickness = Math.max(1, Math.round(LINE_THICKNESS * dpr));
  const lineLeft = Math.floor(pixelX);
  const lineTop = Math.floor(pixelY);
  const time = pixelXToTime(layout, lineLeft + thickness / 2);
  const value = pixelYToValue(layout, lineTop + thickness / 2);

  return {
    lineLeft,
    lineTop,
    thickness,
    centerThickness: thickness * CENTER_THICKNESS_RATIO,
    centerArmLength: Math.round(CENTER_ARM_LENGTH * dpr),
    dashLength: Math.round(DASH_LENGTH * dpr),
    timeLabel: formatTimeAtScale(time, scaleFromTimeRange(layout.timeStart, layout.timeEnd)),
    valueLabel: formatValueAtRange(value, layout.valueMin, layout.valueMax),
  };
}
