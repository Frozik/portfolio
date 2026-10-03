import { floorPixelOf, valueToPixel } from '../../../core/scale/scale-mapping';
import { cssOf } from '../../../core/series/color';
import { columnOptionsOf } from '../../../marks/column/core';
import type { ICanvasMarkPainter } from '../../painter';
import { elementSpanOf, paintAt, stepPixelsOf, visibleElements } from '../path-points';

/**
 * The column mark on the 2D canvas: a rectangle from the baseline to the
 * value, in the middle of the element's interval; a candle counts by its
 * close. When no coarser scale is left the columns narrow to what their
 * interval leaves them (§4.3).
 */
export const columnCanvasPainter: ICanvasMarkPainter = {
  drawRun(context, frame, { run, style }, use, scale): void {
    const { baseline, gap } = columnOptionsOf(use.options);
    const dpr = frame.size.devicePixelRatio;
    const isAggregated = stepPixelsOf(frame, run) > 0;
    const base = baseline === 'bottom' ? floorPixelOf(scale) : valueToPixel(scale, baseline);
    const values = run.shape === 'candle' ? run.close : run.value;
    const { from, to } = visibleElements(frame, run);

    for (let element = from; element < to; element += 1) {
      const value = values[element];
      if (Number.isNaN(value)) {
        continue;
      }
      const span = elementSpanOf(frame, run, element);
      const widest = isAggregated ? span.width - gap * dpr : Number.POSITIVE_INFINITY;
      const width = Math.max(dpr, Math.min(paintAt(style.fill.size, element) * dpr, widest));
      const left = span.left + span.width / 2 - width / 2;
      const top = valueToPixel(scale, value);
      const height = Math.max(Math.abs(base - top), dpr);
      const upper = (top + base) / 2 - height / 2;
      context.fillStyle = cssOf(paintAt(style.fill.color, element));
      context.fillRect(left, upper, width, height);

      const outline = Math.min(paintAt(style.stroke.size, element) * dpr, width / 2);
      if (outline > 0) {
        context.strokeStyle = cssOf(paintAt(style.stroke.color, element));
        context.lineWidth = outline;
        context.strokeRect(
          left + outline / 2,
          upper + outline / 2,
          width - outline,
          Math.max(height - outline, 0)
        );
      }
    }
  },
};
