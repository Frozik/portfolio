export const DEFAULT_COLUMN_WIDTH = 160;
export const DEFAULT_MIN_COLUMN_WIDTH = 40;

export interface IWidthRequest {
  readonly id: string;
  readonly width: number | undefined;
  readonly flex: number | undefined;
  readonly minWidth: number | undefined;
  readonly maxWidth: number | undefined;
}

function clamp(request: IWidthRequest, width: number): number {
  const min = request.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const max = request.maxWidth ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, width));
}

/**
 * Pixel width of every column. Flex columns share the space left after the
 * fixed ones, proportionally to their `flex`, each clamped to its bounds; a
 * column that hits a bound leaves its share to the others. Without a viewport
 * a flex column takes the default width.
 */
export function resolveWidths(
  requests: readonly IWidthRequest[],
  viewportWidth: number | undefined
): ReadonlyMap<string, number> {
  const widths = new Map<string, number>();
  let fixedTotal = 0;
  const flexible: IWidthRequest[] = [];
  for (const request of requests) {
    if (request.flex !== undefined && request.flex > 0) {
      flexible.push(request);
      continue;
    }
    const width = clamp(request, request.width ?? DEFAULT_COLUMN_WIDTH);
    widths.set(request.id, width);
    fixedTotal += width;
  }
  if (flexible.length === 0) {
    return widths;
  }
  if (viewportWidth === undefined) {
    for (const request of flexible) {
      widths.set(request.id, clamp(request, DEFAULT_COLUMN_WIDTH));
    }
    return widths;
  }
  let remaining = Math.max(0, viewportWidth - fixedTotal);
  let unresolved = flexible;
  while (unresolved.length > 0) {
    const flexTotal = unresolved.reduce((sum, request) => sum + (request.flex ?? 0), 0);
    const bounded = unresolved.filter(request => {
      const share = (remaining * (request.flex ?? 0)) / flexTotal;
      const width = clamp(request, share);
      if (width === share) {
        return false;
      }
      widths.set(request.id, width);
      remaining -= width;
      return true;
    });
    if (bounded.length === 0) {
      for (const request of unresolved) {
        widths.set(request.id, (remaining * (request.flex ?? 0)) / flexTotal);
      }
      break;
    }
    unresolved = unresolved.filter(request => !bounded.includes(request));
  }
  return widths;
}
