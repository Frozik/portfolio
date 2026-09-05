import type { LetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';
import { computeLetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';

/** Where a world point lands inside the canvas, for the React overlays drawn over the field. */
export function toScreenPosition(
  transform: LetterboxTransform,
  worldX: number,
  worldY: number,
  fieldHeightWu: number
): { readonly x: number; readonly y: number } {
  return {
    x: transform.originX + worldX * transform.scale,
    y: transform.originY + (fieldHeightWu - worldY) * transform.scale,
  };
}

/** The inverse: where a finger or a mouse landed, in world units (drag-to-aim). */
export function toWorldPosition(
  transform: LetterboxTransform,
  screenX: number,
  screenY: number,
  fieldHeightWu: number
): { readonly x: number; readonly y: number } {
  return {
    x: (screenX - transform.originX) / transform.scale,
    y: fieldHeightWu - (screenY - transform.originY) / transform.scale,
  };
}

/**
 * Where the 800 × 500 field lands on the canvas. Unlike the tanks field this is not tile
 * art, so the scale is left fractional — snapping it to whole pixels would waste up to half a
 * screen on a laptop display.
 */
export function computeViewTransform(
  canvasWidthPx: number,
  canvasHeightPx: number,
  fieldWidthWu: number,
  fieldHeightWu: number
): LetterboxTransform {
  return computeLetterboxTransform({
    canvasWidthPx,
    canvasHeightPx,
    fieldWidthWu,
    fieldHeightWu,
  });
}
