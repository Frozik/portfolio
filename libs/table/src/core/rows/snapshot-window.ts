import type { IRowRange } from './row-source';

export interface IWindow {
  readonly offset: number;
  readonly limit: number;
}

/** The one window the server is asked for: the visible range plus a buffer, rounded out to whole pages. */
export function windowFor(range: IRowRange, pageRows: number, bufferRows: number): IWindow {
  const start = Math.max(0, range.start - bufferRows);
  const end = range.end + bufferRows;
  const offset = Math.floor(start / pageRows) * pageRows;
  const limit = Math.max(pageRows, Math.ceil(end / pageRows) * pageRows - offset);
  return { offset, limit };
}

export function sameWindow(left: IWindow | undefined, right: IWindow): boolean {
  return left !== undefined && left.offset === right.offset && left.limit === right.limit;
}

/** Rows a new window can keep from the old one until its snapshot arrives: only the overlap keeps its indexes. */
export function overlapOf<TRow>(
  previous: { readonly window: IWindow; readonly rows: readonly TRow[] } | undefined,
  next: IWindow
): readonly TRow[] {
  if (previous === undefined) {
    return [];
  }
  const start = Math.max(previous.window.offset, next.offset);
  const end = Math.min(previous.window.offset + previous.rows.length, next.offset + next.limit);
  if (start !== next.offset || end <= start) {
    return [];
  }
  return previous.rows.slice(start - previous.window.offset, end - previous.window.offset);
}
