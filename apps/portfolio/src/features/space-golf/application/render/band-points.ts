import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BoardViewport } from '../../infrastructure/render/board-viewport';
import { pixelToBoard } from '../../infrastructure/render/board-viewport';
import { VIEW_PIXELS_PER_METER } from '../camera';

/**
 * The band is measured on the screen and not on the board: a point of it
 * is where the pointer was, in CSS pixels from the canvas's top left, at
 * the one scale — so the same thumb travel is the same stroke whatever the
 * zoom, and wherever the camera goes meanwhile. The pointer reads points in,
 * the renderer draws them where the finger is: both conventions live here
 * and nowhere else.
 */
export function toBand(cssX: number, cssY: number): Vector2 {
  return { x: cssX / VIEW_PIXELS_PER_METER, y: -cssY / VIEW_PIXELS_PER_METER };
}

/** Where a point of the band lies on the board this frame. */
export function bandToBoard(
  viewport: BoardViewport,
  point: Vector2,
  canvasPixelsPerCssPixel: number
): Vector2 {
  return pixelToBoard(viewport, {
    x: point.x * VIEW_PIXELS_PER_METER * canvasPixelsPerCssPixel,
    y: -point.y * VIEW_PIXELS_PER_METER * canvasPixelsPerCssPixel,
  });
}
