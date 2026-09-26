import type { TileSink } from '../domain/ports/tile-sink';
import type { TileSource } from '../domain/ports/tile-source';
import type { TileStore } from '../domain/ports/tile-store';
import type { TileCoord, TileKey } from '../domain/tile-key';
import { tileCoordOf } from '../domain/tile-key';
import type { TileSchedule } from '../domain/tile-schedule';
import {
  countLoading,
  earliestRetry,
  EMPTY_SCHEDULE,
  markFailed,
  markReady,
  reconcileSchedule,
  statusOf,
} from '../domain/tile-schedule';
import type { SelectedTile } from '../domain/tile-selection';
import { compareByScreenDistance } from '../domain/tile-selection';

export interface ReadyTile {
  /** Frame time the tile landed at, or `-∞` for one restored from the store, which shows at once. */
  readonly fadeStart: number;
}

export interface TileLoaderOptions<TPayload> {
  readonly source: TileSource;
  readonly sink: TileSink<TPayload>;
  readonly store: TileStore;
  /** Turns encoded bytes into what the sink takes; `createImageBitmap` for pictures, a worker for meshes. */
  readonly decode: (bytes: Blob, coord: TileCoord, signal: AbortSignal) => Promise<TPayload>;
  /** Frees a decoded payload the sink never took (a late result); nothing to free by default. */
  readonly release?: (payload: TPayload) => void;
  /** Frame clock in seconds; stamps fade-ins and retry backoffs. */
  readonly readNow: () => number;
  /** A tile landed or failed — the scene needs another frame. */
  readonly onChange: VoidFunction;
}

const NEVER_FADES = Number.NEGATIVE_INFINITY;

/**
 * Runs the pure tile schedule against the cache tiers and the network: a
 * tile the sink dropped is read back from the store and decoded again,
 * appearing without a fade; only a tile in neither tier is fetched. Decoded
 * payloads live just long enough to be handed to the sink.
 */
export class TileLoader<TPayload> {
  private schedule: TileSchedule = EMPTY_SCHEDULE;
  private readonly inFlight = new Map<TileKey, AbortController>();
  private disposed = false;

  constructor(private readonly options: TileLoaderOptions<TPayload>) {}

  reconcile(selected: readonly SelectedTile[], nowSeconds: number): void {
    const { sink } = this.options;
    const update = reconcileSchedule(this.schedule, selected, nowSeconds, key => sink.has(key));
    this.schedule = update.schedule;
    for (const key of update.abort) {
      this.inFlight.get(key)?.abort();
      this.inFlight.delete(key);
    }
    for (const key of update.start) {
      this.startLoad(key);
    }
    // Edges first, so the tiles around the screen centre end up most
    // recently used and are the last the sink would evict.
    for (const tile of selected.toSorted(compareByScreenDistance).toReversed()) {
      if (statusOf(this.schedule, tile.key)?.kind === 'ready') {
        sink.touch(tile.key);
      }
    }
  }

  readyTile(key: TileKey): ReadyTile | undefined {
    const status = statusOf(this.schedule, key);
    if (status?.kind !== 'ready' || !this.options.sink.has(key)) {
      return undefined;
    }
    return { fadeStart: status.fadeStart };
  }

  get pendingCount(): number {
    return countLoading(this.schedule);
  }

  /** When the earliest failed tile may be tried again, so the scene can reconcile then. */
  get nextRetryAt(): number | undefined {
    return earliestRetry(this.schedule);
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.inFlight.values()) {
      controller.abort();
    }
    this.inFlight.clear();
  }

  private startLoad(key: TileKey): void {
    const { source, store, decode, release } = this.options;
    const controller = new AbortController();
    this.inFlight.set(key, controller);
    const coord = tileCoordOf(key);
    let fromStore = false;
    store
      .get(key)
      .then(stored => {
        if (stored !== undefined) {
          fromStore = true;
          return stored;
        }
        return source.loadTile(coord, controller.signal).then(fetched => {
          void store.set(key, fetched);
          return fetched;
        });
      })
      .then(bytes => decode(bytes, coord, controller.signal))
      .then(
        payload => {
          if (this.disposed || this.inFlight.get(key) !== controller) {
            release?.(payload);
            return;
          }
          this.inFlight.delete(key);
          this.options.sink.store(key, payload);
          release?.(payload);
          const fadeStart = fromStore ? NEVER_FADES : this.options.readNow();
          this.schedule = markReady(this.schedule, key, fadeStart);
          this.options.onChange();
        },
        () => {
          if (this.disposed || this.inFlight.get(key) !== controller) {
            return;
          }
          this.inFlight.delete(key);
          this.schedule = markFailed(this.schedule, key, this.options.readNow());
          this.options.onChange();
        }
      );
  }
}
