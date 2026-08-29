import type { LetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';
import { computeLetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';

/** Largest integer scale, letterboxed; too-small canvases fall back to fractional (§11.1). */
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
    snapToWholePixels: true,
  });
}
