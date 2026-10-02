import { isNil } from 'lodash-es';

import type { IChartFrame } from '../core/frame/chart-frame';
import type { IMarkUse, IStyledRun } from '../core/series/style-processor';
import type { ITextMeasurer } from './text-measurer';

export const CANVAS2D_BACKEND = 'canvas2d';

/**
 * Something drawn on the 2D canvas of a chart. The surface repaints all its
 * painters together, and only when one of them says its picture is out of
 * date or the canvas was cleared by a resize (§6.7).
 */
export interface ICanvasPainter {
  /** Whether what was painted last no longer shows this frame. */
  isStale(frame: IChartFrame<unknown>, now: number): boolean;
  paint(context: CanvasRenderingContext2D, frame: IChartFrame<unknown>, now: number): void;
}

export interface ICanvasPainterContext {
  readonly text: ITextMeasurer;
}

export type TCanvasPainterFactory = (context: ICanvasPainterContext) => ICanvasPainter;

export function isCanvasPainterFactory(candidate: unknown): candidate is TCanvasPainterFactory {
  return typeof candidate === 'function';
}

/** What draws a mark on the 2D canvas: one styled run at a time, already clipped to the plot. */
export interface ICanvasMarkPainter {
  drawRun(
    context: CanvasRenderingContext2D,
    frame: IChartFrame<unknown>,
    styled: IStyledRun<unknown>,
    use: IMarkUse
  ): void;
}

export function isCanvasMarkPainter(candidate: unknown): candidate is ICanvasMarkPainter {
  return typeof candidate === 'object' && !isNil(candidate) && 'drawRun' in candidate;
}
