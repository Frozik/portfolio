import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../../core/frame/chart-frame';
import type { ITicksSlice } from '../../../core/frame/ticks';
import type { IScaleFrame } from '../../../core/scale/scale';
import { valueToPixel } from '../../../core/scale/scale-mapping';
import { scaleLineX } from '../../../core/scale/scale-strip';
import { cssOf } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import { xToPixel } from '../../../core/viewport/plot-mapping';
import type { IAxisLabelStyle, ILabelColors } from '../../axis-label';
import { axisLabelStyleOf, drawAxisLabel, scaleLabelPlacement } from '../../axis-label';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';
import type { ITextMeasurer } from '../../text-measurer';

/** Room kept between the labels of one axis and the line of the other, CSS pixels. */
const AXIS_CLEARANCE = 18;

interface IAxesPaint<TX> {
  readonly context: CanvasRenderingContext2D;
  readonly frame: IChartFrame<TX>;
  readonly ticks: ITicksSlice<TX>;
  readonly style: IAxisLabelStyle;
  readonly text: ITextMeasurer;
}

function strokeLine(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
}

/** The X axis under the whole plot: its line, its tick marks and their labels above it. */
function drawXAxis<TX>({ context, frame, ticks, style, text }: IAxesPaint<TX>): void {
  const { plot, theme } = frame;
  const clearance = AXIS_CLEARANCE * frame.size.devicePixelRatio;
  strokeLine(context, plot.left, plot.bottom, plot.right, plot.bottom);

  for (const tick of ticks.xTicks(frame)) {
    const pixel = xToPixel(frame, tick.position);
    if (pixel < plot.left || pixel > plot.right) {
      continue;
    }
    strokeLine(context, pixel, plot.bottom, pixel, plot.bottom - style.tickLength);
    const textWidth = text.measureWidth(tick.label, style.font);
    const boxLeft = pixel - textWidth / 2 - style.paddingX;
    // A label that would run into the value scale on the left is left out.
    if (boxLeft >= plot.left + clearance) {
      drawAxisLabel(
        context,
        style,
        {
          text: tick.label,
          textWidth,
          placement: { boxLeft, centerY: style.xLabelCenterY, textX: pixel, textAlign: 'center' },
        },
        theme.label
      );
      context.strokeStyle = cssOf(theme.axisLine);
    }
  }
}

/**
 * The title of a scale, where a label at its top end would stand. Answers the
 * height above which a tick label would lie on it.
 */
function drawScaleTitle<TX>(
  { context, frame, style, text }: IAxesPaint<TX>,
  scale: IScaleFrame,
  colors: ILabelColors
): number {
  const { title, plot } = scale;
  if (isNil(title)) {
    return plot.top;
  }
  const center = plot.top + style.boxHeight / 2;
  const textWidth = text.measureWidth(title, style.font);
  drawAxisLabel(
    context,
    style,
    {
      text: title,
      textWidth,
      placement: scaleLabelPlacement(frame, scale, style, textWidth, center),
    },
    colors
  );
  return center + style.boxHeight;
}

/** One value scale: its line down the side of its pane, tick marks towards the plot, a label by each. */
function drawScale<TX>(paint: IAxesPaint<TX>, scale: IScaleFrame, isLowestPane: boolean): void {
  const { context, frame, ticks, style, text } = paint;
  const { theme } = frame;
  const { plot } = scale;
  const clearance = AXIS_CLEARANCE * frame.size.devicePixelRatio;
  const lineX = scaleLineX(frame, scale);
  const tickEnd = lineX + (scale.side === 'left' ? style.tickLength : -style.tickLength);
  // Inside the plot the lowest labels would lie on the labels of the X axis.
  const lowestCenter =
    isLowestPane && scale.order === 0 ? plot.bottom - clearance - style.boxHeight / 2 : plot.bottom;
  const colors = { background: theme.label.background, text: scale.color ?? theme.label.text };

  context.strokeStyle = cssOf(theme.axisLine);
  strokeLine(context, lineX, plot.top, lineX, plot.bottom);
  const highestCenter = drawScaleTitle(paint, scale, colors);
  for (const tick of ticks.valueTicks(frame, scale)) {
    const pixel = valueToPixel(scale, tick.position);
    if (pixel < plot.top || pixel > plot.bottom) {
      continue;
    }
    context.strokeStyle = cssOf(theme.axisLine);
    strokeLine(context, lineX, pixel, tickEnd, pixel);
    if (pixel <= lowestCenter && pixel >= highestCenter) {
      const textWidth = text.measureWidth(tick.label, style.font);
      drawAxisLabel(
        context,
        style,
        {
          text: tick.label,
          textWidth,
          placement: scaleLabelPlacement(frame, scale, style, textWidth, pixel),
        },
        colors
      );
    }
  }
}

/**
 * The axis lines, tick marks and labelled boxes, over whatever draws the
 * series: the X axis under the plot, a line under every pane, and every
 * value scale on its side of its pane — the first inside the plot, the rest
 * in gutters beyond it.
 */
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
        const style = axisLabelStyleOf(frame, text);
        const paint: IAxesPaint<TX> = { context, frame, ticks, style, text };

        context.strokeStyle = cssOf(frame.theme.axisLine);
        context.lineWidth = style.lineWidth;
        context.font = style.font;
        context.textBaseline = 'alphabetic';

        const lowest = frame.panes.at(-1);
        for (const pane of frame.panes) {
          if (pane !== lowest) {
            context.strokeStyle = cssOf(frame.theme.axisLine);
            strokeLine(
              context,
              pane.plot.left,
              pane.plot.bottom,
              pane.plot.right,
              pane.plot.bottom
            );
          }
          for (const scale of pane.scales) {
            if (scale.visible) {
              drawScale(paint, scale, pane === lowest);
            }
          }
        }
        context.strokeStyle = cssOf(frame.theme.axisLine);
        drawXAxis(paint);
      },
    };
  };
}
