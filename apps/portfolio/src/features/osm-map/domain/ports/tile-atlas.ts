import type { TileKey } from '../tile-key';
import type { TileCoverage } from './tile-coverage';

/** GPU-side home of decoded tiles; the WebGPU adapter lives in `infrastructure/`. */
export interface TileAtlasPort {
  /** Uploads the image into a layer, evicting the least recently used tile when full; the image stays the caller's to close. */
  store(key: TileKey, image: ImageBitmap): void;
  layerOf(key: TileKey): number | undefined;
  /** Marks the tile as in use so eviction reaches for something else first. */
  touch(key: TileKey): void;
  readonly capacity: number;
  readonly usedCount: number;
  /** The resident tiles by ground extent, for borrowing pictures while a tile loads. */
  readonly coverage: TileCoverage;
}
