import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * How the board's metres map onto a canvas: a uniform scale, where the
 * board's origin lands and which way its axes run in pixels — down the
 * canvas's y for a portrait canvas, turned a quarter for a landscape one.
 */
export interface BoardViewport {
  /** Pixels per metre. */
  readonly scale: number;
  /** Pixel position of the board's origin, its lower-left corner. */
  readonly origin: Vector2;
  /** The board's x axis in pixels per metre. */
  readonly xAxis: Vector2;
  /** The board's y axis in pixels per metre. */
  readonly yAxis: Vector2;
}

/** Air left around the board, as a share of the smaller fitting dimension. */
const MARGIN_SHARE = 0.03;

/**
 * Fits the whole board into the viewport, letterboxed and centred. A
 * portrait canvas shows the board upright, y up; a landscape canvas shows
 * it turned a quarter counter-clockwise, so the board's top — the tee —
 * is at the left and its bottom at the right, and the board fills the
 * screen instead of standing in a strip between black bars.
 */
export function fitBoard(
  viewport: { readonly width: number; readonly height: number },
  board: { readonly width: number; readonly height: number }
): BoardViewport {
  if (viewport.width > viewport.height) {
    const scale =
      Math.min(viewport.width / board.height, viewport.height / board.width) * (1 - MARGIN_SHARE);
    return {
      scale,
      origin: {
        x: (viewport.width + board.height * scale) / 2,
        y: (viewport.height + board.width * scale) / 2,
      },
      xAxis: { x: 0, y: -scale },
      yAxis: { x: -scale, y: 0 },
    };
  }
  const scale =
    Math.min(viewport.width / board.width, viewport.height / board.height) * (1 - MARGIN_SHARE);
  return {
    scale,
    origin: {
      x: (viewport.width - board.width * scale) / 2,
      y: (viewport.height + board.height * scale) / 2,
    },
    xAxis: { x: scale, y: 0 },
    yAxis: { x: 0, y: -scale },
  };
}

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The board's rectangle on the canvas in whole pixels, clamped to the canvas:
 * the scissor of the render pass, so the board is the screen the way the
 * original's arena is — whatever lies beyond its edge is out of sight.
 */
export function boardPixelRect(
  viewport: BoardViewport,
  board: { readonly width: number; readonly height: number },
  canvas: { readonly width: number; readonly height: number }
): PixelRect {
  const corners = [
    boardToPixel(viewport, { x: 0, y: 0 }),
    boardToPixel(viewport, { x: board.width, y: board.height }),
  ];
  const left = Math.max(0, Math.floor(Math.min(corners[0].x, corners[1].x)));
  const top = Math.max(0, Math.floor(Math.min(corners[0].y, corners[1].y)));
  const right = Math.min(canvas.width, Math.ceil(Math.max(corners[0].x, corners[1].x)));
  const bottom = Math.min(canvas.height, Math.ceil(Math.max(corners[0].y, corners[1].y)));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Board metres → pixels. */
export function boardToPixel(viewport: BoardViewport, point: Vector2): Vector2 {
  return {
    x: viewport.origin.x + viewport.xAxis.x * point.x + viewport.yAxis.x * point.y,
    y: viewport.origin.y + viewport.xAxis.y * point.x + viewport.yAxis.y * point.y,
  };
}

/** Pixels → board metres: the axes are orthogonal and `scale` long, so projecting undoes the map. */
export function pixelToBoard(viewport: BoardViewport, pixel: Vector2): Vector2 {
  const dx = pixel.x - viewport.origin.x;
  const dy = pixel.y - viewport.origin.y;
  const squared = viewport.scale * viewport.scale;
  return {
    x: (dx * viewport.xAxis.x + dy * viewport.xAxis.y) / squared,
    y: (dx * viewport.yAxis.x + dy * viewport.yAxis.y) / squared,
  };
}
