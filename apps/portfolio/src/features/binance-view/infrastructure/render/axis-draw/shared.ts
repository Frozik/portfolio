import type { ICanvasDimensions } from '../../../domain/axis-scale';
import type { IOrderbookSnapshot, UnixTimeMs } from '../../../domain/types';

export const LABEL_PADDING_X = 3;
export const LABEL_PADDING_Y = 2;

export interface IAxisDrawInput extends ICanvasDimensions {
  readonly ctx: CanvasRenderingContext2D;
  readonly viewTimeStartMs: UnixTimeMs;
  readonly viewTimeEndMs: UnixTimeMs;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly priceStep: number;
  /** Cursor position (CSS px, canvas-relative) for the crosshair overlay. */
  readonly cursorCss: { readonly x: number; readonly y: number } | undefined;
  /** Snapshot at the right edge of the viewport, painted as per-level volume bars. */
  readonly lastSnapshot: IOrderbookSnapshot | undefined;
}
