import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_BG_COLOR,
  AXIS_LABEL_BG_PADDING_X,
  AXIS_LABEL_BG_PADDING_Y,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  TICK_LENGTH,
  X_LABEL_Y_AXIS_CLEARANCE,
  Y_LABEL_X_AXIS_CLEARANCE,
} from '../constants';
import type { IChartFrameLayout } from '../frame-layout';
import type { ITextMeasurer } from '../text-measurer';
import type { IAxisTick } from '../types';

import { timeToPixelX, valueToPixelY } from './shared';

const LABEL_BG_RADIUS = 2;
const X_LABEL_GAP = 3;
const Y_LABEL_GAP = 4;

/** Device-pixel label styling, resolved once per frame from the current DPR. */
interface IAxisLabelStyle {
  readonly fontSize: number;
  readonly tickLength: number;
  readonly lineWidth: number;
  readonly bgPaddingX: number;
  readonly bgRadius: number;
  readonly boxHeight: number;
  readonly glyphCenterOffset: number;
}

interface ILabelPlacement {
  readonly boxLeft: number;
  readonly centerY: number;
  readonly textX: number;
  readonly textAlign: CanvasTextAlign;
}

/** Per-axis strategy consumed by the shared tick-drawing loop. */
interface IAxisTickGeometry {
  readonly ticks: readonly IAxisTick[];
  toPixel(tickPosition: number): number;
  isVisible(pixel: number): boolean;
  strokeTickMark(ctx: CanvasRenderingContext2D, pixel: number): void;
  /** `null` when the label would collide with the perpendicular axis. */
  placeLabel(pixel: number, textWidth: number): ILabelPlacement | null;
}

function createXAxisGeometry(layout: IChartFrameLayout, style: IAxisLabelStyle): IAxisTickGeometry {
  const { plotLeft, plotRight, plotBottom } = layout;
  const clearance = X_LABEL_Y_AXIS_CLEARANCE * layout.dpr;
  const labelGap = X_LABEL_GAP * layout.dpr;

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
        return null;
      }

      return {
        boxLeft,
        centerY: plotBottom - style.tickLength - labelGap - style.fontSize / 2,
        textX: pixel,
        textAlign: 'center',
      };
    },
  };
}

function createYAxisGeometry(layout: IChartFrameLayout, style: IAxisLabelStyle): IAxisTickGeometry {
  const { plotLeft, plotTop, plotBottom } = layout;
  const clearance = Y_LABEL_X_AXIS_CLEARANCE * layout.dpr;
  const labelX = plotLeft + style.tickLength + Y_LABEL_GAP * layout.dpr;

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
        return null;
      }

      return {
        boxLeft: labelX - style.bgPaddingX,
        centerY: pixel,
        textX: labelX,
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

    const textWidth = textMeasurer.measureWidth(ctx, tick.label);
    const placement = geometry.placeLabel(pixel, textWidth);

    if (placement === null) {
      continue;
    }

    ctx.fillStyle = AXIS_LABEL_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(
      placement.boxLeft,
      placement.centerY - style.boxHeight / 2,
      textWidth + style.bgPaddingX * 2,
      style.boxHeight,
      style.bgRadius
    );
    ctx.fill();

    ctx.fillStyle = AXIS_LABEL_COLOR;
    ctx.textAlign = placement.textAlign;
    ctx.fillText(tick.label, placement.textX, placement.centerY + style.glyphCenterOffset);
  }
}

/**
 * Paint the L-shaped axis lines plus both tick rails with their labelled,
 * rounded background boxes on top of the GPU pass.
 */
export function drawChartAxes(
  ctx: CanvasRenderingContext2D,
  layout: IChartFrameLayout,
  textMeasurer: ITextMeasurer
): void {
  const { dpr, plotLeft, plotTop, plotRight, plotBottom } = layout;
  const fontSize = AXIS_FONT_SIZE * dpr;
  const bgPaddingY = AXIS_LABEL_BG_PADDING_Y * dpr;

  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  ctx.font = `${fontSize}px ${AXIS_FONT_FAMILY}`;
  ctx.textBaseline = 'alphabetic';

  // Glyph metrics cached per font size — avoids measureText('0') every frame.
  // Uses 'alphabetic' baseline + measured centerOffset for true visual centering
  // (Canvas 'middle' baseline sits too high for digit-only labels).
  const { centerOffset } = textMeasurer.getGlyphMetrics(ctx);

  const style: IAxisLabelStyle = {
    fontSize,
    tickLength: TICK_LENGTH * dpr,
    lineWidth: dpr,
    bgPaddingX: AXIS_LABEL_BG_PADDING_X * dpr,
    bgRadius: LABEL_BG_RADIUS * dpr,
    boxHeight: fontSize + bgPaddingY * 2,
    glyphCenterOffset: centerOffset,
  };

  drawAxisTicks(ctx, createXAxisGeometry(layout, style), style, textMeasurer);
  drawAxisTicks(ctx, createYAxisGeometry(layout, style), style, textMeasurer);
}
