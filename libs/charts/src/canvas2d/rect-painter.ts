import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IChartFrame } from '../core/frame/chart-frame';
import type { IPixelRect } from '../core/frame/pixel-rect';

import type { TRectPattern } from '../core/frame/rect-pattern';
import type { TColor } from '../core/series/color';
import { channelsOf, cssOf, withAlpha } from '../core/series/color';
import type { ICanvasPainter, TCanvasPainterFactory } from './painter';

export interface ICanvasRectBatch {
  readonly rects: readonly IPixelRect[];
  readonly color: TColor;
  readonly opacity: number;
  readonly pattern: TRectPattern;
}

export interface ICanvasRectSource {
  batchOf(frame: IChartFrame<unknown>): ICanvasRectBatch;
  /** Whatever the batch depends on besides the frame. */
  revision?(): number;
}

function fillDashed(context: CanvasRenderingContext2D, rect: IPixelRect, dashLength: number): void {
  const isTall = rect.height > rect.width;
  const length = isTall ? rect.height : rect.width;
  for (let along = 0; along < length; along += dashLength * 2) {
    const dash = Math.min(dashLength, length - along);
    if (isTall) {
      context.fillRect(rect.left, rect.top + along, rect.width, dash);
    } else {
      context.fillRect(rect.left + along, rect.top, dash, rect.height);
    }
  }
}

/** A line swinging from one edge of the shorter side to the other every half period, stroked down the longer one. */
function strokeZigzag(
  context: CanvasRenderingContext2D,
  rect: IPixelRect,
  period: number,
  thickness: number
): void {
  const isTall = rect.height > rect.width;
  const length = isTall ? rect.height : rect.width;
  const across = isTall ? rect.width : rect.height;
  const amplitude = Math.max(0, (across - thickness) / 2);
  const pointAt = (along: number, swing: number): readonly [number, number] => {
    const centre = across / 2 + amplitude * swing;
    return isTall ? [rect.left + centre, rect.top + along] : [rect.left + along, rect.top + centre];
  };
  context.lineWidth = thickness;
  context.lineJoin = 'miter';
  context.beginPath();
  context.moveTo(...pointAt(0, 1));
  let swing = -1;
  for (let along = period / 2; along < length + period / 2; along += period / 2) {
    context.lineTo(...pointAt(Math.min(along, length), swing));
    swing = -swing;
  }
  context.stroke();
}

/** Flat rectangles in device pixels, solid, dashed or seamed: what the grid, the cuts and the debug marks are made of on the 2D canvas. */
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
        const { rects, color, opacity, pattern } = source.batchOf(frame);
        const css = cssOf(withAlpha(color, channelsOf(color).alpha * opacity));
        context.fillStyle = css;
        context.strokeStyle = css;
        for (const rect of rects) {
          switch (pattern.kind) {
            case 'solid':
              context.fillRect(rect.left, rect.top, rect.width, rect.height);
              break;
            case 'dashed':
              fillDashed(context, rect, pattern.dashLength);
              break;
            case 'zigzag':
              strokeZigzag(context, rect, pattern.period, pattern.thickness);
              break;
            default:
              assertNever(pattern);
          }
        }
      },
    };
  };
}
