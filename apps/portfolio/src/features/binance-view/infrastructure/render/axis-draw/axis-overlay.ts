import {
  buildPlotRect,
  buildTimeAxisLabelsRect,
  buildVolumeBarsRect,
  buildYAxisRect,
} from '../../../domain/axis-scale';
import { AXIS_FONT_FAMILY, AXIS_FONT_SIZE, AXIS_LINE_COLOR } from '../../../domain/constants';

import { drawCrosshair } from './crosshair';
import type { IAxisDrawInput } from './shared';
import { drawTimeAxisLabels } from './time-axis';
import { drawYAxisPanel } from './y-axis-panel';

/** Axis lines, ticks, labels, the Y-axis panel and the crosshair on the overlay canvas. */
export function drawAxisLabels(input: IAxisDrawInput): void {
  const { ctx, devicePixelRatio } = input;
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const plotRect = buildPlotRect(input);
  const yAxisRect = buildYAxisRect(input);
  const timeAxisLabelsRect = buildTimeAxisLabelsRect(input);
  const volumeBarsRect = buildVolumeBarsRect(input);
  ctx.font = `${AXIS_FONT_SIZE}px ${AXIS_FONT_FAMILY}`;
  ctx.strokeStyle = AXIS_LINE_COLOR;
  ctx.lineWidth = 1;

  drawTimeAxisLabels(ctx, plotRect, timeAxisLabelsRect, input);
  drawYAxisPanel(ctx, yAxisRect, input);
  drawCrosshair(ctx, { plotRect, yAxisRect, volumeBarsRect }, input);

  ctx.restore();
}
