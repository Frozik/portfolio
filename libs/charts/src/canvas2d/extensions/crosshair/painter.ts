import { clamp, isNil } from 'lodash-es';

import type { IChartFrame, IPlotRect } from '../../../core/frame/chart-frame';
import type { IChartTheme } from '../../../core/frame/theme';
import { cssOf } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import type { ICrosshair, ICrosshairSlice } from '../../../extensions/crosshair/core';
import type { IAxisLabelStyle, ILabelColors } from '../../axis-label';
import { axisLabelStyleOf, drawAxisLabel } from '../../axis-label';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';
import type { ITextMeasurer } from '../../text-measurer';

/**
 * Dashed arms running from the crossing to the plot edges. Every arm starts
 * at the crossing, so the dashes travel with the pointer instead of crawling
 * along a line that moves.
 */
function strokeArms<TX>(
  context: CanvasRenderingContext2D,
  plot: IPlotRect,
  crosshair: ICrosshair<TX>,
  theme: IChartTheme
): void {
  const { lineLeft, lineTop, thickness, centerArmLength, dashLength } = crosshair;
  const centerX = lineLeft + thickness / 2;
  const centerY = lineTop + thickness / 2;

  context.strokeStyle = cssOf(theme.crosshair.line);
  context.lineWidth = thickness;
  context.setLineDash([dashLength, dashLength]);
  context.beginPath();
  context.moveTo(centerX, lineTop - centerArmLength);
  context.lineTo(centerX, plot.top);
  context.moveTo(centerX, lineTop + thickness + centerArmLength);
  context.lineTo(centerX, plot.bottom);
  context.moveTo(lineLeft - centerArmLength, centerY);
  context.lineTo(plot.left, centerY);
  context.moveTo(lineLeft + thickness + centerArmLength, centerY);
  context.lineTo(plot.right, centerY);
  context.stroke();
  context.setLineDash([]);
}

function fillCrossing<TX>(
  context: CanvasRenderingContext2D,
  crosshair: ICrosshair<TX>,
  theme: IChartTheme
): void {
  const { lineLeft, lineTop, thickness, centerThickness, centerArmLength } = crosshair;
  const sideThickness = (centerThickness - thickness) / 2;
  const length = centerArmLength * 2 + thickness;

  context.fillStyle = cssOf(theme.crosshair.center);
  context.fillRect(lineLeft - sideThickness, lineTop - centerArmLength, centerThickness, length);
  context.fillRect(lineLeft - centerArmLength, lineTop - sideThickness, length, centerThickness);
}

/** The value label stops above the row of the X label, so the two never overlap. */
function drawLabels<TX>(
  context: CanvasRenderingContext2D,
  frame: IChartFrame<TX>,
  crosshair: ICrosshair<TX>,
  style: IAxisLabelStyle,
  text: ITextMeasurer
): void {
  const { plot, theme } = frame;
  const colors: ILabelColors = {
    background: theme.crosshair.labelBackground,
    text: theme.crosshair.labelText,
  };
  const centerX = crosshair.lineLeft + crosshair.thickness / 2;
  const centerY = crosshair.lineTop + crosshair.thickness / 2;

  context.font = style.font;
  context.textBaseline = 'alphabetic';

  const xWidth = text.measureWidth(crosshair.xLabel, style.font);
  const xBoxWidth = xWidth + style.paddingX * 2;
  const xBoxLeft = Math.round(clamp(centerX - xBoxWidth / 2, plot.left, plot.right - xBoxWidth));
  drawAxisLabel(
    context,
    style,
    {
      text: crosshair.xLabel,
      textWidth: xWidth,
      placement: {
        boxLeft: xBoxLeft,
        centerY: style.xLabelCenterY,
        textX: xBoxLeft + xBoxWidth / 2,
        textAlign: 'center',
      },
    },
    colors
  );

  const halfBoxHeight = style.boxHeight / 2;
  drawAxisLabel(
    context,
    style,
    {
      text: crosshair.valueLabel,
      textWidth: text.measureWidth(crosshair.valueLabel, style.font),
      placement: {
        boxLeft: style.valueLabelTextX - style.paddingX,
        centerY: clamp(centerY, plot.top + halfBoxHeight, style.xLabelCenterY - style.boxHeight),
        textX: style.valueLabelTextX,
        textAlign: 'start',
      },
    },
    colors
  );
}

/** Dashed arms clipped to the plot, a thick solid crossing under the pointer, and what it points at on both axes. */
export function crosshairPainter<TX>(slice: ICrosshairSlice<TX>): TCanvasPainterFactory {
  return ({ text }): ICanvasPainter => {
    let paintedFrame: IChartFrame<unknown> | undefined;
    let paintedPosition = slice.position;
    return {
      isStale(frame): boolean {
        const stale = frame !== paintedFrame || slice.position !== paintedPosition;
        paintedFrame = frame;
        paintedPosition = slice.position;
        return stale;
      },
      paint(context, unknownFrame): void {
        const frame = ownFrame<TX>(unknownFrame);
        const crosshair = slice.crosshairOf(frame);
        if (isNil(crosshair)) {
          return;
        }
        const { plot } = frame;
        context.save();
        context.beginPath();
        context.rect(plot.left, plot.top, plot.width, plot.height);
        context.clip();
        strokeArms(context, plot, crosshair, frame.theme);
        fillCrossing(context, crosshair, frame.theme);
        context.restore();

        drawLabels(context, frame, crosshair, axisLabelStyleOf(frame, text), text);
      },
    };
  };
}
