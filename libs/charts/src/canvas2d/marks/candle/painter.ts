import { valueToPixel } from '../../../core/scale/scale-mapping';
import { cssOf } from '../../../core/series/color';
import { xToPixel } from '../../../core/viewport/plot-mapping';
import { candleOptionsOf } from '../../../marks/candle/core';
import type { ICanvasMarkPainter } from '../../painter';
import { paintAt, stepPixelsOf, visibleElements } from '../path-points';

/**
 * The candle mark on the 2D canvas: a body from open to close in the middle of
 * the candle's interval, and a wick from it up to the high and down to the low.
 * The wick never runs through the body: a translucent body would show it. When
 * no coarser scale is left the body narrows to what the interval leaves it (§4.3).
 */
export const candleCanvasPainter: ICanvasMarkPainter = {
  drawRun(context, frame, { run, style }, use, scale): void {
    if (run.shape !== 'candle') {
      return;
    }
    const { gap } = candleOptionsOf(use.options);
    const dpr = frame.size.devicePixelRatio;
    const stepPixels = stepPixelsOf(frame, run);
    const { from, to } = visibleElements(frame, run);

    for (let element = from; element < to; element += 1) {
      const open = run.open[element];
      if (Number.isNaN(open)) {
        continue;
      }
      const centerX = xToPixel(frame, run.x[element]) + stepPixels / 2;
      const strokeSize = paintAt(style.stroke.size, element) * dpr;
      const strokeColor = cssOf(paintAt(style.stroke.color, element));
      const bodyWidth = Math.max(
        dpr,
        Math.min(paintAt(style.fill.size, element) * dpr, stepPixels - gap * dpr)
      );
      const wickWidth = Math.max(strokeSize, dpr);
      const openY = valueToPixel(scale, open);
      const closeY = valueToPixel(scale, run.close[element]);
      const bodyHeight = Math.max(Math.abs(closeY - openY), dpr);
      const bodyLeft = centerX - bodyWidth / 2;
      const bodyTop = (openY + closeY) / 2 - bodyHeight / 2;
      const bodyBottom = bodyTop + bodyHeight;

      const highY = valueToPixel(scale, run.max[element]);
      const lowY = valueToPixel(scale, run.min[element]);
      const wickTop = Math.min(highY, lowY);
      const wickBottom = Math.max(highY, lowY);
      context.fillStyle = strokeColor;
      if (wickTop < bodyTop) {
        context.fillRect(centerX - wickWidth / 2, wickTop, wickWidth, bodyTop - wickTop);
      }
      if (wickBottom > bodyBottom) {
        context.fillRect(centerX - wickWidth / 2, bodyBottom, wickWidth, wickBottom - bodyBottom);
      }

      context.fillStyle = cssOf(paintAt(style.fill.color, element));
      context.fillRect(bodyLeft, bodyTop, bodyWidth, bodyHeight);

      const outline = Math.min(strokeSize, bodyWidth / 2);
      if (outline > 0) {
        context.strokeStyle = strokeColor;
        context.lineWidth = outline;
        context.strokeRect(
          bodyLeft + outline / 2,
          bodyTop + outline / 2,
          bodyWidth - outline,
          Math.max(bodyHeight - outline, 0)
        );
      }
    }
  },
};
