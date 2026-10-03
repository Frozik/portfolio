/** How a flat rectangle is filled: whole, in dashes along its longer side, or by a line zigzagging along it. */
export type TRectPattern =
  | { readonly kind: 'solid' }
  /** Dashes along the longer side, each as long as the gap after it, device pixels. */
  | { readonly kind: 'dashed'; readonly dashLength: number }
  /**
   * A line of the given thickness running along the longer side and swinging
   * from one edge of the shorter side to the other once per period, device
   * pixels: a seam.
   */
  | { readonly kind: 'zigzag'; readonly period: number; readonly thickness: number };

export const SOLID: TRectPattern = { kind: 'solid' };

export function dashed(dashLength: number): TRectPattern {
  return dashLength > 0 ? { kind: 'dashed', dashLength } : SOLID;
}
