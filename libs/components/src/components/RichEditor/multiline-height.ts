/**
 * The border-box height of a growing textarea: `scrollHeight` holds the
 * text and padding but not the border, so a height of `scrollHeight` alone
 * is a border short and scrolls from the first line.
 */
export function multilineHeight({
  scrollHeight,
  lineHeight,
  paddingY,
  borderY,
  maxRows,
}: {
  readonly scrollHeight: number;
  readonly lineHeight: number;
  readonly paddingY: number;
  readonly borderY: number;
  readonly maxRows: number;
}): { readonly height: number; readonly overflows: boolean } {
  const limit = lineHeight > 0 ? lineHeight * maxRows + paddingY : Number.POSITIVE_INFINITY;
  return {
    height: Math.min(scrollHeight, limit) + borderY,
    overflows: scrollHeight > limit,
  };
}
