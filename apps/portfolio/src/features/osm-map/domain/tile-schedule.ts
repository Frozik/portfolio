import { FAILED_RETRY_SECONDS, MAX_CONCURRENT_LOADS } from './constants';
import type { TileKey } from './tile-key';
import type { SelectedTile } from './tile-selection';
import { compareByScreenDistance } from './tile-selection';

export type TileStatus =
  | { readonly kind: 'queued' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly fadeStart: number }
  | { readonly kind: 'failed'; readonly retryAfter: number };

/** The one owner of what every tile is doing; every transition returns a new schedule. */
export interface TileSchedule {
  readonly tiles: ReadonlyMap<TileKey, TileStatus>;
}

export interface ScheduleUpdate {
  readonly schedule: TileSchedule;
  /** Loads to begin now, highest priority first. */
  readonly start: readonly TileKey[];
  /** In-flight loads of tiles out of view, given up so tiles in view can take their slots. */
  readonly abort: readonly TileKey[];
}

export const EMPTY_SCHEDULE: TileSchedule = { tiles: new Map() };

/**
 * Brings the schedule in line with the tiles selected this frame: forgets
 * queued tiles that left the view, queues newcomers (and expired failures)
 * from the screen centre outwards, and fills the concurrency budget. A
 * load whose tile left the view keeps going — the bytes are half-way here
 * and the tile is likely to return — but yields its slot as soon as a tile
 * in view is waiting for one. A ready tile stays as long as the atlas still
 * holds its texture (`hasTexture`); once evicted it is loaded again when
 * selected.
 */
export function reconcileSchedule(
  schedule: TileSchedule,
  selected: readonly SelectedTile[],
  nowSeconds: number,
  hasTexture: (key: TileKey) => boolean
): ScheduleUpdate {
  const selectedKeys = new Set(selected.map(tile => tile.key));
  const tiles = new Map<TileKey, TileStatus>();
  const outOfViewLoads: TileKey[] = [];
  let loadingCount = 0;

  for (const [key, status] of schedule.tiles) {
    switch (status.kind) {
      case 'ready':
        if (hasTexture(key)) {
          tiles.set(key, status);
        }
        break;
      case 'loading':
        tiles.set(key, status);
        loadingCount++;
        if (!selectedKeys.has(key)) {
          outOfViewLoads.push(key);
        }
        break;
      case 'failed':
        if (nowSeconds < status.retryAfter) {
          tiles.set(key, status);
        }
        break;
      case 'queued':
        break;
      default:
        assertNever(status);
    }
  }

  const queued = selected.filter(tile => !tiles.has(tile.key)).sort(compareByScreenDistance);
  const start: TileKey[] = [];
  const abort: TileKey[] = [];
  for (const tile of queued) {
    if (loadingCount >= MAX_CONCURRENT_LOADS) {
      const preempted = outOfViewLoads.pop();
      if (preempted !== undefined) {
        tiles.delete(preempted);
        abort.push(preempted);
        loadingCount--;
      }
    }
    if (loadingCount < MAX_CONCURRENT_LOADS) {
      tiles.set(tile.key, { kind: 'loading' });
      start.push(tile.key);
      loadingCount++;
    } else {
      tiles.set(tile.key, { kind: 'queued' });
    }
  }

  return { schedule: { tiles }, start, abort };
}

function withStatus(schedule: TileSchedule, key: TileKey, status: TileStatus): TileSchedule {
  const tiles = new Map(schedule.tiles);
  tiles.set(key, status);
  return { tiles };
}

export function markReady(schedule: TileSchedule, key: TileKey, nowSeconds: number): TileSchedule {
  return withStatus(schedule, key, { kind: 'ready', fadeStart: nowSeconds });
}

export function markFailed(schedule: TileSchedule, key: TileKey, nowSeconds: number): TileSchedule {
  return withStatus(schedule, key, {
    kind: 'failed',
    retryAfter: nowSeconds + FAILED_RETRY_SECONDS,
  });
}

export function statusOf(schedule: TileSchedule, key: TileKey): TileStatus | undefined {
  return schedule.tiles.get(key);
}

/** The earliest moment a failed tile may be tried again, if any is waiting. */
export function earliestRetry(schedule: TileSchedule): number | undefined {
  let earliest: number | undefined;
  for (const status of schedule.tiles.values()) {
    if (status.kind === 'failed' && (earliest === undefined || status.retryAfter < earliest)) {
      earliest = status.retryAfter;
    }
  }
  return earliest;
}

export function countLoading(schedule: TileSchedule): number {
  let count = 0;
  for (const status of schedule.tiles.values()) {
    if (status.kind === 'loading' || status.kind === 'queued') {
      count++;
    }
  }
  return count;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected tile status: ${String(value)}`);
}
