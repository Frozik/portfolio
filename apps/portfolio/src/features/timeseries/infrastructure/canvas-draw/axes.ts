import { isNil } from 'lodash-es';

import {
  AXIS_LABEL_BG_COLOR,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  X_LABEL_Y_AXIS_CLEARANCE,
  Y_LABEL_X_AXIS_CLEARANCE,
} from '../../domain/constants';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import { timeToPixelX, valueToPixelY } from '../../domain/plot-mapping';
import type { ITextMeasurer } from '../../domain/text-measurer';
import type { IAxisTick } from '../../domain/types';
import type { IAxisLabelStyle, ILabelColors, ILabelPlacement } from './axis-label';
import { drawAxisLabel } from './axis-label';

const TICK_LABEL_COLORS: ILabelColors = {
  background: AXIS_LABEL_BG_COLOR,
  text: AXIS_LABEL_COLOR,
};

/** Per-axis strategy consumed by the shared tick-drawing loop. */
interface IAxisTickGeometry {
  readonly ticks: readonly IAxisTick[];
  toPixel(tickPosition: number): number;
  isVisible(pixel: number): boolean;
  strokeTickMark(ctx: CanvasRenderingContext2D, pixel: number): void;
  /** `undefined` when the label would collide with the perpendicular axis. */
  placeLabel(pixel: number, textWidth: number): ILabelPlacement | undefined;
}

function createXAxisGeometry(layout: IChartFrameLayout, style: IAxisLabelStyle): IAxisTickGeometry {
  const { plotLeft, plotRight, plotBottom } = layout;
  const clearance = X_LABEL_Y_AXIS_CLEARANCE * layout.dpr;

  return {
    ticks: layout.xTicks,
    toPixel: tickPosition => timeToPixelX(layout, tickPosition),
    isVisible: pixel => pixel >= plotLeft && pixel <= plotRight,
    strokeTickMark: (ctx, pixel) => {
      ctx.moveTo(pixel, plotBottom);
      ctx.lineTo(pixel, plotBottom - style.tickLength);
    },
    placeLabel: (pixel, textWidth) => {
      const boxLeft = pixel - textWidth / 2 - style.bgPaddingX;

      if (boxLeft < plotLeft + clearance) {
        return undefined;
      }

      return {
        boxLeft,
        centerY: style.timeLabelCenterY,
        textX: pixel,
        textAlign: 'center',
      };
    },
  };
}

function createYAxisGeometry(layout: IChartFrameLayout, style: IAxisLabelStyle): IAxisTickGeometry {
  const { plotLeft, plotTop, plotBottom } = layout;
  const clearance = Y_LABEL_X_AXIS_CLEARANCE * layout.dpr;

  return {
    ticks: layout.yTicks,
    toPixel: tickPosition => valueToPixelY(layout, tickPosition),
    isVisible: pixel => pixel >= plotTop && pixel <= plotBottom,
    strokeTickMark: (ctx, pixel) => {
      ctx.moveTo(plotLeft, pixel);
      ctx.lineTo(plotLeft + style.tickLength, pixel);
    },
    placeLabel: pixel => {
      if (pixel + style.boxHeight / 2 > plotBottom - clearance) {
        return undefined;
      }

      return {
        boxLeft: style.valueLabelTextX - style.bgPaddingX,
        centerY: pixel,
        textX: style.valueLabelTextX,
        textAlign: 'start',
      };
    },
  };
}

function drawAxisTicks(
  ctx: CanvasRenderingContext2D,
  geometry: IAxisTickGeometry,
  style: IAxisLabelStyle,
  textMeasurer: ITextMeasurer
): void {
  for (const tick of geometry.ticks) {
    const pixel = geometry.toPixel(tick.position);

    if (!geometry.isVisible(pixel)) {
      continue;
    }

    ctx.strokeStyle = AXIS_LINE_COLOR;
    ctx.lineWidth = style.lineWidth;
    ctx.beginPath();
    geometry.strokeTickMark(ctx, pixel);
    ctx.stroke();

    const textWidth = textMeasurer.measureWidth(tick.label, style.font);
    const placement = geometry.placeLabel(pixel, textWidth);

    if (isNil(placement)) {
      continue;
    }

    drawAxisLabel(ctx, style, { text: tick.label, textWidth, placement }, TICK_LABEL_COLORS);
  }
}

/**
 * Paint the L-shaped axis lines plus both tick rails with their labelled,
 * rounded background boxes on top of the GPU pass.
 */
export function drawChartAxes(
  ctx: CanvasRenderingContext2D,
  layout: IChartFrameLayout,
  style: IAxisLabelStyle,
  textMeasurer: ITextMeasurer
): void {
  const { dpr, plotLeft, plotTop, plotRight, plotBottom } = layout;

  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  ctx.font = style.font;
  ctx.textBaseline = 'alphabetic';

  drawAxisTicks(ctx, createXAxisGeometry(layout, style), style, textMeasurer);
  drawAxisTicks(ctx, createYAxisGeometry(layout, style), style, textMeasurer);
}
