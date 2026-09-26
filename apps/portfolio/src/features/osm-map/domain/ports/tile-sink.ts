import type { TileKey } from '../tile-key';

/**
 * Where a decoded tile ends up on the GPU — a layer of the raster atlas, a
 * mesh in the building cache. Holds a bounded number of tiles and evicts the
 * least recently touched when full; the loader learns of an eviction by
 * asking `has` again.
 */
export interface TileSink<TPayload> {
  store(key: TileKey, payload: TPayload): void;
  has(key: TileKey): boolean;
  /** Marks the tile as in use so eviction reaches for something else first. */
  touch(key: TileKey): void;
}
