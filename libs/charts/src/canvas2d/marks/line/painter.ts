import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../../core/frame/chart-frame';
import { cssOf } from '../../../core/series/color';
import type { IPaint } from '../../../core/series/style-processor';
import { lineOptionsOf } from '../../../marks/line/core';
import type { ICanvasMarkPainter } from '../../painter';
import type { IPathPoint } from '../path-points';
import { joined, paintAt, pointsOf } from '../path-points';

function strokePath(
  context: CanvasRenderingContext2D,
  frame: IChartFrame<unknown>,
  points: readonly IPathPoint[],
  paint: IPaint,
  extraWidth: IPaint | undefined
): void {
  const dpr = frame.size.devicePixelRatio;
  const isUniform = typeof paint.color === 'number' && typeof paint.size === 'number';
  const widthAt = (element: number): number =>
    (paintAt(paint.size, element) +
      (isNil(extraWidth) ? 0 : 2 * paintAt(extraWidth.size, element))) *
    dpr;

  let isOpen = false;
  const flush = (): void => {
    if (isOpen) {
      context.stroke();
      isOpen = false;
    }
  };
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (isNil(previous) || point.isGap || previous.isGap) {
      flush();
      return;
    }
    if (!isOpen || !isUniform) {
      flush();
      context.strokeStyle = cssOf(paintAt(paint.color, previous.element));
      context.lineWidth = widthAt(previous.element);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      isOpen = true;
    }
    context.lineTo(point.x, point.y);
  });
  flush();
}

/** The line mark on the 2D canvas: the same joins, gaps and outline as on WebGPU, drawn as paths (§6.7). */
export const lineCanvasPainter: ICanvasMarkPainter = {
  drawRun(context, frame, { run, style }, use): void {
    const options = lineOptionsOf(use.options);
    const points = joined(pointsOf(frame, run), options.join);

    context.lineJoin = 'round';
    context.lineCap = 'round';
    if (options.paint === 'stroke') {
      strokePath(context, frame, points, style.stroke, undefined);
      return;
    }
    const hasOutline = typeof style.stroke.size !== 'number' || style.stroke.size > 0;
    if (hasOutline) {
      strokePath(
        context,
        frame,
        points,
        { color: style.stroke.color, size: style.fill.size },
        style.stroke
      );
    }
    strokePath(context, frame, points, style.fill, undefined);
  },
};
