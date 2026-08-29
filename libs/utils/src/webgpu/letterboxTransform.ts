/** Below one physical pixel per world unit a snapped scale would floor to zero and vanish. */
const MIN_SNAPPED_SCALE = 1;

export interface LetterboxTransform {
  /** Physical pixels per world unit. */
  readonly scale: number;
  /** Physical-pixel offset of the field's top-left corner inside the canvas. */
  readonly originX: number;
  readonly originY: number;
}

/**
 * Places a fixed-size world field inside a canvas: the largest scale that fits it whole, centered
 * with letterboxing on the axis that has room to spare.
 *
 * `snapToWholePixels` is for tile art, where a fractional scale smears the sprite grid — it takes
 * the largest integer scale and lands the field on a whole pixel. Callers drawing smooth geometry
 * leave it off, since rounding down would waste up to half a screen on a laptop display.
 */
export function computeLetterboxTransform({
  canvasWidthPx,
  canvasHeightPx,
  fieldWidthWu,
  fieldHeightWu,
  snapToWholePixels = false,
}: {
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly fieldWidthWu: number;
  readonly fieldHeightWu: number;
  readonly snapToWholePixels?: boolean;
}): LetterboxTransform {
  const fittingScale = Math.min(canvasWidthPx / fieldWidthWu, canvasHeightPx / fieldHeightWu);
  const scale =
    snapToWholePixels && fittingScale >= MIN_SNAPPED_SCALE
      ? Math.floor(fittingScale)
      : fittingScale;
  const originX = (canvasWidthPx - fieldWidthWu * scale) / 2;
  const originY = (canvasHeightPx - fieldHeightWu * scale) / 2;

  return snapToWholePixels
    ? { scale, originX: Math.round(originX), originY: Math.round(originY) }
    : { scale, originX, originY };
}
