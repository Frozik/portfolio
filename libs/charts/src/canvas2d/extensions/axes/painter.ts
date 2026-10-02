import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../../core/frame/chart-frame';
import type { IAxisTick, ITicksSlice } from '../../../core/frame/ticks';
import { cssOf } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import { valueToPixel, xToPixel } from '../../../core/viewport/plot-mapping';
import type { IAxisLabelStyle, ILabelPlacement } from '../../axis-label';
import { axisLabelStyleOf, drawAxisLabel } from '../../axis-label';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';
import type { ITextMeasurer } from '../../text-measurer';

/** Room kept between the labels of one axis and the line of the other, CSS pixels. */
const AXIS_CLEARANCE = 18;

/** How the ticks of one axis are placed; the drawing loop is shared by both. */
interface IAxisGeometry<TPosition> {
  readonly ticks: readonly IAxisTick<TPosition>[];
  toPixel(position: TPosition): number;
  isVisible(pixel: number): boolean;
  strokeTickMark(context: CanvasRenderingContext2D, pixel: number): void;
  /** `undefined` when the label would collide with the other axis. */
  placeLabel(pixel: number, textWidth: number): ILabelPlacement | undefined;
}

function xAxisOf<TX>(
  frame: IChartFrame<TX>,
  ticks: ITicksSlice<TX>,
  style: IAxisLabelStyle
): IAxisGeometry<TX> {
  const { plot } = frame;
  const clearance = AXIS_CLEARANCE * frame.size.devicePixelRatio;
  return {
    ticks: ticks.xTicks(frame),
    toPixel: position => xToPixel(frame, position),
    isVisible: pixel => pixel >= plot.left && pixel <= plot.right,
    strokeTickMark(context, pixel): void {
      context.moveTo(pixel, plot.bottom);
      context.lineTo(pixel, plot.bottom - style.tickLength);
    },
    placeLabel(pixel, textWidth): ILabelPlacement | undefined {
      const boxLeft = pixel - textWidth / 2 - style.paddingX;
      return boxLeft < plot.left + clearance
        ? undefined
        : { boxLeft, centerY: style.xLabelCenterY, textX: pixel, textAlign: 'center' };
    },
  };
}

function valueAxisOf<TX>(
  frame: IChartFrame<TX>,
  ticks: ITicksSlice<TX>,
  style: IAxisLabelStyle
): IAxisGeometry<number> {
  const { plot } = frame;
  const clearance = AXIS_CLEARANCE * frame.size.devicePixelRatio;
  return {
    ticks: ticks.yTicks(frame),
    toPixel: value => valueToPixel(frame, value),
    isVisible: pixel => pixel >= plot.top && pixel <= plot.bottom,
    strokeTickMark(context, pixel): void {
      context.moveTo(plot.left, pixel);
      context.lineTo(plot.left + style.tickLength, pixel);
    },
    placeLabel: pixel =>
      pixel + style.boxHeight / 2 > plot.bottom - clearance
        ? undefined
        : {
            boxLeft: style.valueLabelTextX - style.paddingX,
            centerY: pixel,
            textX: style.valueLabelTextX,
            textAlign: 'start',
          },
  };
}

function drawTicks<TX, TPosition>(
  context: CanvasRenderingContext2D,
  frame: IChartFrame<TX>,
  geometry: IAxisGeometry<TPosition>,
  style: IAxisLabelStyle,
  text: ITextMeasurer
): void {
  for (const tick of geometry.ticks) {
    const pixel = geometry.toPixel(tick.position);
    if (!geometry.isVisible(pixel)) {
      continue;
    }
    context.strokeStyle = cssOf(frame.theme.axisLine);
    context.lineWidth = style.lineWidth;
    context.beginPath();
    geometry.strokeTickMark(context, pixel);
    context.stroke();

    const textWidth = text.measureWidth(tick.label, style.font);
    const placement = geometry.placeLabel(pixel, textWidth);
    if (!isNil(placement)) {
      drawAxisLabel(context, style, { text: tick.label, textWidth, placement }, frame.theme.label);
    }
  }
}

/** The L-shaped axis lines and both tick rails with their labelled boxes, over the GPU pass. */
export function axesPainter<TX>(ticks: ITicksSlice<TX>): TCanvasPainterFactory {
  return ({ text }): ICanvasPainter => {
    let painted: IChartFrame<unknown> | undefined;
    return {
      isStale(frame): boolean {
        const stale = frame !== painted;
        painted = frame;
        return stale;
      },
      paint(context, unknownFrame): void {
        const frame = ownFrame<TX>(unknownFrame);
        const { plot } = frame;
        const style = axisLabelStyleOf(frame, text);

        context.strokeStyle = cssOf(frame.theme.axisLine);
        context.lineWidth = style.lineWidth;
        context.beginPath();
        context.moveTo(plot.left, plot.top);
        context.lineTo(plot.left, plot.bottom);
        context.lineTo(plot.right, plot.bottom);
        context.stroke();

        context.font = style.font;
        context.textBaseline = 'alphabetic';
        drawTicks(context, frame, xAxisOf(frame, ticks, style), style, text);
        drawTicks(context, frame, valueAxisOf(frame, ticks, style), style, text);
      },
    };
  };
}
