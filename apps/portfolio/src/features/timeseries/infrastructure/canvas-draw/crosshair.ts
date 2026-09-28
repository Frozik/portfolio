import { clamp } from 'lodash-es';

import {
  CROSSHAIR_CENTER_COLOR,
  CROSSHAIR_LABEL_BG_COLOR,
  CROSSHAIR_LABEL_COLOR,
  CROSSHAIR_LINE_COLOR,
} from '../../domain/constants';
import type { ICrosshair } from '../../domain/crosshair';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import type { ITextMeasurer } from '../../domain/text-measurer';
import type { IAxisLabelStyle, ILabelColors } from './axis-label';
import { drawAxisLabel } from './axis-label';

const CROSSHAIR_LABEL_COLORS: ILabelColors = {
  background: CROSSHAIR_LABEL_BG_COLOR,
  text: CROSSHAIR_LABEL_COLOR,
};

/**
 * Dashed arms running from the crossing to the plot edges. Every arm starts
 * at the crossing, so the dashes travel with the pointer instead of crawling
 * along a line that moves.
 */
function strokeArms(
  ctx: CanvasRenderingContext2D,
  layout: IChartFrameLayout,
  crosshair: ICrosshair
): void {
  const { plotLeft, plotTop, plotRight, plotBottom } = layout;
  const { lineLeft, lineTop, thickness, centerArmLength, dashLength } = crosshair;
  const centerX = lineLeft + thickness / 2;
  const centerY = lineTop + thickness / 2;

  ctx.strokeStyle = CROSSHAIR_LINE_COLOR;
  ctx.lineWidth = thickness;
  ctx.setLineDash([dashLength, dashLength]);
  ctx.beginPath();
  ctx.moveTo(centerX, lineTop - centerArmLength);
  ctx.lineTo(centerX, plotTop);
  ctx.moveTo(centerX, lineTop + thickness + centerArmLength);
  ctx.lineTo(centerX, plotBottom);
  ctx.moveTo(lineLeft - centerArmLength, centerY);
  ctx.lineTo(plotLeft, centerY);
  ctx.moveTo(lineLeft + thickness + centerArmLength, centerY);
  ctx.lineTo(plotRight, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function fillCrossing(ctx: CanvasRenderingContext2D, crosshair: ICrosshair): void {
  const { lineLeft, lineTop, thickness, centerThickness, centerArmLength } = crosshair;
  const sideThickness = (centerThickness - thickness) / 2;
  const length = centerArmLength * 2 + thickness;

  ctx.fillStyle = CROSSHAIR_CENTER_COLOR;
  ctx.fillRect(lineLeft - sideThickness, lineTop - centerArmLength, centerThickness, length);
  ctx.fillRect(lineLeft - centerArmLength, lineTop - sideThickness, length, centerThickness);
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  layout: IChartFrameLayout,
  crosshair: ICrosshair,
  style: IAxisLabelStyle,
  textMeasurer: ITextMeasurer
): void {
  const { plotLeft, plotTop, plotRight } = layout;
  const centerX = crosshair.lineLeft + crosshair.thickness / 2;
  const centerY = crosshair.lineTop + crosshair.thickness / 2;

  ctx.font = style.font;
  ctx.textBaseline = 'alphabetic';

  const timeWidth = textMeasurer.measureWidth(crosshair.timeLabel, style.font);
  const timeBoxWidth = timeWidth + style.bgPaddingX * 2;
  const timeBoxLeft = Math.round(
    clamp(centerX - timeBoxWidth / 2, plotLeft, plotRight - timeBoxWidth)
  );
  drawAxisLabel(
    ctx,
    style,
    {
      text: crosshair.timeLabel,
      textWidth: timeWidth,
      placement: {
        boxLeft: timeBoxLeft,
        centerY: style.timeLabelCenterY,
        textX: timeBoxLeft + timeBoxWidth / 2,
        textAlign: 'center',
      },
    },
    CROSSHAIR_LABEL_COLORS
  );

  const halfBoxHeight = style.boxHeight / 2;
  const lowestValueLabelCenterY = style.timeLabelCenterY - style.boxHeight;
  drawAxisLabel(
    ctx,
    style,
    {
      text: crosshair.valueLabel,
      textWidth: textMeasurer.measureWidth(crosshair.valueLabel, style.font),
      placement: {
        boxLeft: style.valueLabelTextX - style.bgPaddingX,
        centerY: clamp(centerY, plotTop + halfBoxHeight, lowestValueLabelCenterY),
        textX: style.valueLabelTextX,
        textAlign: 'start',
      },
    },
    CROSSHAIR_LABEL_COLORS
  );
}

/**
 * The crosshair above everything else on the overlay: dashed arms clipped to
 * the plot, a thick solid crossing under the pointer, and the time and value
 * it points at, written where the tick labels of each axis sit. The value
 * label stops above the row of the time label, so the two never overlap.
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  layout: IChartFrameLayout,
  crosshair: ICrosshair,
  style: IAxisLabelStyle,
  textMeasurer: ITextMeasurer
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.plotLeft, layout.plotTop, layout.plotWidth, layout.plotHeight);
  ctx.clip();
  strokeArms(ctx, layout, crosshair);
  fillCrossing(ctx, crosshair);
  ctx.restore();

  drawLabels(ctx, layout, crosshair, style, textMeasurer);
}
