import { assert } from '@frozik/utils/assert/assert';

import type { IChartFrame } from '../core/frame/chart-frame';
import { scaleOf } from '../core/frame/chart-frame';
import type { ICanvasPainter } from './painter';
import { CANVAS2D_BACKEND, isCanvasMarkPainter } from './painter';

/** The series of a chart on the 2D canvas, each mark by its own painter, clipped to the plot of its pane. */
export function seriesPainter(): ICanvasPainter {
  let painted: IChartFrame<unknown> | undefined;
  return {
    isStale(frame): boolean {
      const stale = frame !== painted;
      painted = frame;
      return stale;
    },
    paint(context, frame): void {
      for (const series of frame.series) {
        const scale = scaleOf(frame, series.scaleId);
        const { plot } = scale;
        context.save();
        context.beginPath();
        context.rect(plot.left, plot.top, plot.width, plot.height);
        context.clip();
        for (const styled of series.runs) {
          for (const use of styled.style.marks) {
            const painter = use.mark.painters[CANVAS2D_BACKEND];
            assert(
              isCanvasMarkPainter(painter),
              `the "${use.mark.id}" mark has no 2D canvas painter: import its style from "@frozik/charts/canvas2d"`
            );
            painter.drawRun(context, frame, styled, use, scale);
          }
        }
        context.restore();
      }
    },
  };
}
