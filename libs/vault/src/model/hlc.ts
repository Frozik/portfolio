import { compareStrings } from './compare-strings';

/**
 * A hybrid logical clock stamp: wall milliseconds, a counter for
 * stamps within the same millisecond, and the node (`deviceId:tabNonce`) that
 * breaks the last tie. Compared lexicographically, never rewritten by merge.
 */
export interface IHlc {
  readonly wallMs: number;
  readonly counter: number;
  readonly node: string;
}

/** A remote clock this far ahead is not followed: local edits must not jump into its future. */
export const MAX_REMOTE_LEAD_MS = 24 * 60 * 60 * 1000;

export function compareHlc(first: IHlc, second: IHlc): number {
  if (first.wallMs !== second.wallMs) {
    return first.wallMs - second.wallMs;
  }
  if (first.counter !== second.counter) {
    return first.counter - second.counter;
  }
  return compareStrings(first.node, second.node);
}

export function maxHlc(first: IHlc, second: IHlc): IHlc {
  return compareHlc(first, second) >= 0 ? first : second;
}

export function initialHlc(node: string): IHlc {
  return { wallMs: 0, counter: 0, node };
}

/** The next local stamp: never behind the last one, even when the wall clock went back. */
export function hlcTick(last: IHlc, wallMs: number): IHlc {
  return wallMs > last.wallMs
    ? { wallMs, counter: 0, node: last.node }
    : { wallMs: last.wallMs, counter: last.counter + 1, node: last.node };
}

export interface IHlcReceipt {
  readonly clock: IHlc;
  /** The remote stamp was over a day ahead and ignored; its device's clock is wrong. */
  readonly remoteAhead: boolean;
}

/** Moves the local clock past a stamp seen from another device, unless that device runs a day ahead. */
export function hlcReceive(last: IHlc, remote: IHlc, wallMs: number): IHlcReceipt {
  if (remote.wallMs > wallMs + MAX_REMOTE_LEAD_MS) {
    return { clock: last, remoteAhead: true };
  }
  const nextWall = Math.max(last.wallMs, remote.wallMs, wallMs);
  const sameWallCounters = [last, remote]
    .filter(stamp => stamp.wallMs === nextWall)
    .map(stamp => stamp.counter);
  const counter = sameWallCounters.length === 0 ? 0 : Math.max(...sameWallCounters) + 1;
  return { clock: { wallMs: nextWall, counter, node: last.node }, remoteAhead: false };
}
