export interface ScorchedViewTransform {
  /** Physical pixels per world unit. */
  readonly scale: number;
  /** Physical-pixel offset of the field's top-left corner inside the canvas. */
  readonly originX: number;
  readonly originY: number;
}

/**
 * Where the 800 × 500 field lands on the canvas (§11.1): the largest scale that fits it whole,
 * centered with letterboxing. Unlike the tanks field this is not tile art, so the scale is left
 * fractional — snapping it to whole pixels would waste up to half a screen on a laptop display.
 */
/** Where a world point lands inside the canvas, for the React overlays drawn over the field. */
export function toScreenPosition(
  transform: ScorchedViewTransform,
  worldX: number,
  worldY: number,
  fieldHeightWu: number
): { readonly x: number; readonly y: number } {
  return {
    x: transform.originX + worldX * transform.scale,
    y: transform.originY + (fieldHeightWu - worldY) * transform.scale,
  };
}

/** The inverse: where a finger or a mouse landed, in world units (§12.2 drag-to-aim). */
export function toWorldPosition(
  transform: ScorchedViewTransform,
  screenX: number,
  screenY: number,
  fieldHeightWu: number
): { readonly x: number; readonly y: number } {
  return {
    x: (screenX - transform.originX) / transform.scale,
    y: fieldHeightWu - (screenY - transform.originY) / transform.scale,
  };
}

export function computeViewTransform(
  canvasWidthPx: number,
  canvasHeightPx: number,
  fieldWidthWu: number,
  fieldHeightWu: number
): ScorchedViewTransform {
  const scale = Math.min(canvasWidthPx / fieldWidthWu, canvasHeightPx / fieldHeightWu);

  return {
    scale,
    originX: (canvasWidthPx - fieldWidthWu * scale) / 2,
    originY: (canvasHeightPx - fieldHeightWu * scale) / 2,
  };
}
