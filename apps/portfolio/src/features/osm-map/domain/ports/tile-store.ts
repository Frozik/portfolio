import type { TileKey } from '../tile-key';

/**
 * The second tier of the tile cache: encoded tiles kept on disk after the
 * GPU atlas let them go, so a tile coming back into view is decoded again
 * but never fetched again. Holds a fixed number of tiles and forgets the
 * ones asked for least recently.
 */
export interface TileStore {
  /** The stored bytes, or nothing; a hit counts as an access. */
  get(key: TileKey): Promise<Blob | undefined>;
  set(key: TileKey, bytes: Blob): Promise<void>;
  /** Tiles held, as last known. */
  readonly count: number;
}
