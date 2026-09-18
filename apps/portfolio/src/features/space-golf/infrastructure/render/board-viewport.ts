import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * How the board's metres map onto a canvas: a uniform scale, where the
 * board's origin lands and which way its axes run in pixels.
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

/**
 * The view a camera gives: `center` metres of the world in the middle of
 * the canvas, `scale` pixels to the metre, y pointing up. The scale is the
 * same on every device — nothing is fitted to the screen — so a small
 * screen shows less of the world, not a smaller world.
 */
export function viewportOf(
  center: Vector2,
  scale: number,
  canvas: { readonly width: number; readonly height: number }
): BoardViewport {
  return {
    scale,
    origin: { x: canvas.width / 2 - center.x * scale, y: canvas.height / 2 + center.y * scale },
    xAxis: { x: scale, y: 0 },
    yAxis: { x: 0, y: -scale },
  };
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
