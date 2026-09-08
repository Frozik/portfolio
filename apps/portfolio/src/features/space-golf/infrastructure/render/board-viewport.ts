import type { Vector2 } from '@frozik/utils/math/vector2';

/** How the board's metres map onto a canvas: a uniform scale and where the board's origin lands. */
export interface BoardViewport {
  /** Pixels per metre. */
  readonly scale: number;
  /** Pixel position of the board's lower-left corner. */
  readonly origin: Vector2;
}

/** Air left around the board, as a share of the smaller fitting dimension. */
const MARGIN_SHARE = 0.03;

/** Fits the whole board into the viewport, letterboxed and centred, y pointing up on the board. */
export function fitBoard(
  viewport: { readonly width: number; readonly height: number },
  board: { readonly width: number; readonly height: number }
): BoardViewport {
  const scale =
    Math.min(viewport.width / board.width, viewport.height / board.height) * (1 - MARGIN_SHARE);
  return {
    scale,
    origin: {
      x: (viewport.width - board.width * scale) / 2,
      y: (viewport.height + board.height * scale) / 2,
    },
  };
}

/** Board metres → pixels; the pixel y axis points down. */
export function boardToPixel(viewport: BoardViewport, point: Vector2): Vector2 {
  return {
    x: viewport.origin.x + point.x * viewport.scale,
    y: viewport.origin.y - point.y * viewport.scale,
  };
}

export function pixelToBoard(viewport: BoardViewport, pixel: Vector2): Vector2 {
  return {
    x: (pixel.x - viewport.origin.x) / viewport.scale,
    y: (viewport.origin.y - pixel.y) / viewport.scale,
  };
}
