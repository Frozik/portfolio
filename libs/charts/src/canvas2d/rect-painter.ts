import type { IChartFrame } from '../core/frame/chart-frame';
import type { IPixelRect } from '../core/frame/pixel-rect';
import type { TColor } from '../core/series/color';
import { cssOf, withAlpha, channelsOf } from '../core/series/color';
import type { ICanvasPainter, TCanvasPainterFactory } from './painter';

export interface ICanvasRectBatch {
  readonly rects: readonly IPixelRect[];
  readonly color: TColor;
  readonly opacity: number;
  /** Length of a dash and of the gap after it along the longer side, device pixels; nought draws solid. */
  readonly dashLength: number;
}

export interface ICanvasRectSource {
  batchOf(frame: IChartFrame<unknown>): ICanvasRectBatch;
  /** Whatever the batch depends on besides the frame. */
  revision?(): number;
}

/** Flat rectangles in device pixels, solid or dashed: what the grid and the debug marks are made of on the 2D canvas. */
export function canvasRectPainter(source: ICanvasRectSource): TCanvasPainterFactory {
  return (): ICanvasPainter => {
    let painted: IChartFrame<unknown> | undefined;
    let paintedRevision: number | undefined;
    return {
      isStale(frame): boolean {
        const revision = source.revision?.();
        const stale = frame !== painted || revision !== paintedRevision;
        painted = frame;
        paintedRevision = revision;
        return stale;
      },
      paint(context, frame): void {
        const { rects, color, opacity, dashLength } = source.batchOf(frame);
        context.fillStyle = cssOf(withAlpha(color, channelsOf(color).alpha * opacity));
        for (const rect of rects) {
          if (dashLength <= 0) {
            context.fillRect(rect.left, rect.top, rect.width, rect.height);
            continue;
          }
          const isVertical = rect.height > rect.width;
          const length = isVertical ? rect.height : rect.width;
          for (let along = 0; along < length; along += dashLength * 2) {
            const dash = Math.min(dashLength, length - along);
            if (isVertical) {
              context.fillRect(rect.left, rect.top + along, rect.width, dash);
            } else {
              context.fillRect(rect.left + along, rect.top, dash, rect.height);
            }
          }
        }
      },
    };
  };
}
