import { cssOf } from '../../../core/series/color';
import { markerOptionsOf } from '../../../marks/marker/core';
import type { TFigure } from '../../../marks/marker/figures';
import { FIGURE_POLYGONS } from '../../../marks/marker/figures';
import type { ICanvasMarkPainter } from '../../painter';
import { paintAt, pointsOf } from '../path-points';

const FULL_TURN = Math.PI * 2;

/** The outline of a figure of the given size round a point; the figure table has Y up, the canvas has it down. */
function tracePath(
  context: CanvasRenderingContext2D,
  figure: TFigure,
  x: number,
  y: number,
  size: number
): void {
  context.beginPath();
  if (figure === 'circle') {
    context.arc(x, y, size / 2, 0, FULL_TURN);
    return;
  }
  FIGURE_POLYGONS[figure].forEach((vertex, index) => {
    const vertexX = x + vertex.x * size;
    const vertexY = y - vertex.y * size;
    if (index === 0) {
      context.moveTo(vertexX, vertexY);
    } else {
      context.lineTo(vertexX, vertexY);
    }
  });
  context.closePath();
}

/**
 * The marker mark on the 2D canvas: the figure of the table on every point,
 * filled and outlined. The outline lies inside the figure, as on WebGPU, so a
 * marker is the size its style names with or without one (§6.7).
 */
export const markerCanvasPainter: ICanvasMarkPainter = {
  drawRun(context, frame, { run, style }, use): void {
    const { figure } = markerOptionsOf(use.options);
    const dpr = frame.size.devicePixelRatio;
    context.lineJoin = 'miter';

    for (const point of pointsOf(frame, run)) {
      if (point.isGap) {
        continue;
      }
      const size = paintAt(style.fill.size, point.element) * dpr;
      const strokeSize = paintAt(style.stroke.size, point.element) * dpr;
      tracePath(context, figure, point.x, point.y, size);
      context.fillStyle = cssOf(paintAt(style.fill.color, point.element));
      context.fill();
      if (strokeSize > 0) {
        context.save();
        context.clip();
        context.strokeStyle = cssOf(paintAt(style.stroke.color, point.element));
        context.lineWidth = strokeSize * 2;
        context.stroke();
        context.restore();
      }
    }
  },
};
