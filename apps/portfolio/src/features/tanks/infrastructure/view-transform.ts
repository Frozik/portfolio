/** Smallest scale we ever draw at: below one physical pixel per wu the field would vanish. */
const MIN_FRACTIONAL_SCALE = 1;

export interface ViewTransform {
  /** Physical pixels per world unit. */
  readonly scale: number;
  /** Physical-pixel offset of the field's top-left corner inside the canvas. */
  readonly originX: number;
  readonly originY: number;
}

/** Largest integer scale, letterboxed; too-small canvases fall back to fractional (§11.1). */
export function computeViewTransform(
  canvasWidthPx: number,
  canvasHeightPx: number,
  fieldWidthWu: number,
  fieldHeightWu: number
): ViewTransform {
  const fittingScale = Math.min(canvasWidthPx / fieldWidthWu, canvasHeightPx / fieldHeightWu);
  const scale = fittingScale < MIN_FRACTIONAL_SCALE ? fittingScale : Math.floor(fittingScale);

  return {
    scale,
    originX: Math.round((canvasWidthPx - fieldWidthWu * scale) / 2),
    originY: Math.round((canvasHeightPx - fieldHeightWu * scale) / 2),
  };
}
