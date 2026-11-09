import type { TFloatingMinute } from './floating-time';

/** Half-open `[from, to)` in floating minutes. */
export interface IWindow {
  readonly from: TFloatingMinute;
  readonly to: TFloatingMinute;
}

/** Sorted, disjoint, non-empty windows: every operation here returns that shape. */
export type TWindowSet = readonly IWindow[];

/** A scheduled action without a schedule: always on, until its calendars narrow it. */
/** The ends of «all the time»: not moments anything changes at. */
const BEGINNING = Number.MIN_SAFE_INTEGER as TFloatingMinute;
const NEVER_ENDS = Number.MAX_SAFE_INTEGER as TFloatingMinute;

export const ALL_TIME: TWindowSet = [{ from: BEGINNING, to: NEVER_ENDS }];

export function normalizeWindows(windows: readonly IWindow[]): TWindowSet {
  const sorted = windows
    .filter(window => window.to > window.from)
    .sort((left, right) => left.from - right.from);
  const result: IWindow[] = [];
  for (const window of sorted) {
    const last = result.at(-1);
    if (last !== undefined && window.from <= last.to) {
      result[result.length - 1] = {
        from: last.from,
        to: window.to > last.to ? window.to : last.to,
      };
    } else {
      result.push(window);
    }
  }
  return result;
}

export function subtractWindows(base: TWindowSet, removed: TWindowSet): TWindowSet {
  const result: IWindow[] = [];
  for (const window of base) {
    let pieces: IWindow[] = [window];
    for (const cut of removed) {
      pieces = pieces.flatMap(piece => {
        if (cut.to <= piece.from || cut.from >= piece.to) {
          return [piece];
        }
        return [
          ...(cut.from > piece.from ? [{ from: piece.from, to: cut.from }] : []),
          ...(cut.to < piece.to ? [{ from: cut.to, to: piece.to }] : []),
        ];
      });
    }
    result.push(...pieces);
  }
  return normalizeWindows(result);
}

export function intersectWindows(left: TWindowSet, right: TWindowSet): TWindowSet {
  const result: IWindow[] = [];
  for (const one of left) {
    for (const other of right) {
      const from = one.from > other.from ? one.from : other.from;
      const to = one.to < other.to ? one.to : other.to;
      if (to > from) {
        result.push({ from, to });
      }
    }
  }
  return normalizeWindows(result);
}

/** The window holding `minute`, if any. */
export function windowAt(windows: TWindowSet, minute: TFloatingMinute): IWindow | null {
  return windows.find(window => minute >= window.from && minute < window.to) ?? null;
}

/** The first window boundary after `minute`: when the state changes next. */
export function nextBoundary(windows: TWindowSet, minute: TFloatingMinute): TFloatingMinute | null {
  for (const window of windows) {
    if (window.from > minute) {
      return window.from;
    }
    if (window.to > minute) {
      return window.to === NEVER_ENDS ? null : window.to;
    }
  }
  return null;
}
