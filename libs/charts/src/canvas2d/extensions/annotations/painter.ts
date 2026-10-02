import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../../core/frame/chart-frame';
import { mainScaleOf, scaleOf } from '../../../core/frame/chart-frame';
import type { ITicksSlice } from '../../../core/frame/ticks';
import { valueToPixel } from '../../../core/scale/scale-mapping';
import { cssOf } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import { xToPixel } from '../../../core/viewport/plot-mapping';
import type { IAnnotationsSlice } from '../../../extensions/annotations/core';
import type { IAxisLabelStyle } from '../../axis-label';
import { axisLabelStyleOf, drawAxisLabel, scaleLabelPlacement } from '../../axis-label';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';
import type { ITextMeasurer } from '../../text-measurer';

const LEVEL_DASH = 6;
const EVENT_BADGE_GAP = 4;
const FULL_TURN = Math.PI * 2;

interface IAnnotationsPaint<TX> {
  readonly context: CanvasRenderingContext2D;
  readonly frame: IChartFrame<TX>;
  readonly style: IAxisLabelStyle;
  readonly text: ITextMeasurer;
}

/** A dashed line across the pane at each level, and its label where the tick labels of its scale sit. */
function drawLevels<TX>(
  { context, frame, style, text }: IAnnotationsPaint<TX>,
  slice: IAnnotationsSlice<TX>,
  ticks: ITicksSlice<TX>
): void {
  const dash = LEVEL_DASH * frame.size.devicePixelRatio;
  for (const level of slice.levels) {
    const scale = isNil(level.scale) ? mainScaleOf(frame) : scaleOf(frame, level.scale);
    const { plot } = scale;
    const pixel = valueToPixel(scale, level.value);
    if (pixel < plot.top || pixel > plot.bottom) {
      continue;
    }
    const color = level.color ?? frame.theme.crosshair.line;
    context.strokeStyle = cssOf(color);
    context.lineWidth = style.lineWidth;
    context.setLineDash([dash, dash]);
    context.beginPath();
    context.moveTo(plot.left, pixel);
    context.lineTo(plot.right, pixel);
    context.stroke();
    context.setLineDash([]);

    if (!scale.visible) {
      continue;
    }
    const label = level.label ?? ticks.formatValue(frame, scale, level.value);
    const textWidth = text.measureWidth(label, style.font);
    drawAxisLabel(
      context,
      style,
      {
        text: label,
        textWidth,
        placement: scaleLabelPlacement(frame, scale, style, textWidth, pixel),
      },
      { background: color, text: frame.theme.background }
    );
  }
}

/** A round badge above the X axis at each event, with its letter in it. */
function drawEvents<TX>(
  { context, frame, style, text }: IAnnotationsPaint<TX>,
  slice: IAnnotationsSlice<TX>
): void {
  const { plot, theme } = frame;
  const radius = style.boxHeight / 2;
  const centerY =
    style.xLabelCenterY - style.boxHeight - EVENT_BADGE_GAP * frame.size.devicePixelRatio;
  for (const event of slice.events) {
    const pixel = xToPixel(frame, event.x);
    if (pixel < plot.left || pixel > plot.right) {
      continue;
    }
    const textWidth = text.measureWidth(event.label, style.font);
    const halfWidth = Math.max(radius, textWidth / 2 + style.paddingX);
    context.fillStyle = cssOf(event.color ?? theme.crosshair.labelBackground);
    context.beginPath();
    if (halfWidth === radius) {
      context.arc(pixel, centerY, radius, 0, FULL_TURN);
    } else {
      context.roundRect(pixel - halfWidth, centerY - radius, halfWidth * 2, radius * 2, radius);
    }
    context.fill();
    context.fillStyle = cssOf(theme.crosshair.labelText);
    context.textAlign = 'center';
    context.fillText(event.label, pixel, centerY + style.glyphCenterOffset);
  }
}

/** Levels and event marks on the 2D canvas, over the series and under the crosshair. */
export function annotationsPainter<TX>(
  slice: IAnnotationsSlice<TX>,
  ticks: ITicksSlice<TX>
): TCanvasPainterFactory {
  return ({ text }): ICanvasPainter => {
    let paintedFrame: IChartFrame<unknown> | undefined;
    let paintedRevision = slice.revision;
    return {
      isStale(frame): boolean {
        const stale = frame !== paintedFrame || slice.revision !== paintedRevision;
        paintedFrame = frame;
        paintedRevision = slice.revision;
        return stale;
      },
      paint(context, unknownFrame): void {
        const frame = ownFrame<TX>(unknownFrame);
        const style = axisLabelStyleOf(frame, text);
        const paint: IAnnotationsPaint<TX> = { context, frame, style, text };
        context.font = style.font;
        context.textBaseline = 'alphabetic';
        drawLevels(paint, slice, ticks);
        drawEvents(paint, slice);
      },
    };
  };
}
