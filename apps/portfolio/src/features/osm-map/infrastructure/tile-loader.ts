import type { TileAtlasPort } from '../domain/ports/tile-atlas';
import type { TileSource } from '../domain/ports/tile-source';
import type { TileStore } from '../domain/ports/tile-store';
import type { TileKey } from '../domain/tile-key';
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
  readonly layer: number;
  readonly fadeStart: number;
}

export interface TileLoaderOptions {
  readonly source: TileSource;
  readonly atlas: TileAtlasPort;
  readonly store: TileStore;
  /** Decodes an encoded tile; `createImageBitmap` in the browser. */
  readonly decode: (bytes: Blob) => Promise<ImageBitmap>;
  /** Frame clock in seconds; stamps fade-ins and retry backoffs. */
  readonly readNow: () => number;
  /** A tile landed or failed — the scene needs another frame. */
  readonly onChange: VoidFunction;
}

const NEVER_FADES = Number.NEGATIVE_INFINITY;

/**
 * Runs the pure tile schedule against the cache tiers and the network: a
 * tile the atlas dropped is read back from the store and decoded again,
 * appearing without a fade; only a tile in neither tier is fetched. Decoded
 * images live just long enough to be uploaded.
 */
export class TileLoader {
  private schedule: TileSchedule = EMPTY_SCHEDULE;
  private readonly inFlight = new Map<TileKey, AbortController>();
  private disposed = false;

  constructor(private readonly options: TileLoaderOptions) {}

  reconcile(selected: readonly SelectedTile[], nowSeconds: number): void {
    const { atlas } = this.options;
    const update = reconcileSchedule(
      this.schedule,
      selected,
      nowSeconds,
      key => atlas.layerOf(key) !== undefined
    );
    this.schedule = update.schedule;
    for (const key of update.abort) {
      this.inFlight.get(key)?.abort();
      this.inFlight.delete(key);
    }
    for (const key of update.start) {
      this.startLoad(key);
    }
    // Edges first, so the tiles around the screen centre end up most
    // recently used and are the last the atlas would evict.
    for (const tile of selected.toSorted(compareByScreenDistance).toReversed()) {
      if (statusOf(this.schedule, tile.key)?.kind === 'ready') {
        atlas.touch(tile.key);
      }
    }
  }

  readyTile(key: TileKey): ReadyTile | undefined {
    const status = statusOf(this.schedule, key);
    const layer = this.options.atlas.layerOf(key);
    if (status?.kind !== 'ready' || layer === undefined) {
      return undefined;
    }
    return { layer, fadeStart: status.fadeStart };
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
    const { source, store, decode } = this.options;
    const controller = new AbortController();
    this.inFlight.set(key, controller);
    let fromStore = false;
    store
      .get(key)
      .then(stored => {
        if (stored !== undefined) {
          fromStore = true;
          return stored;
        }
        return source.loadTile(tileCoordOf(key), controller.signal).then(fetched => {
          void store.set(key, fetched);
          return fetched;
        });
      })
      .then(decode)
      .then(
        image => {
          if (this.disposed || this.inFlight.get(key) !== controller) {
            image.close();
            return;
          }
          this.inFlight.delete(key);
          this.options.atlas.store(key, image);
          image.close();
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
