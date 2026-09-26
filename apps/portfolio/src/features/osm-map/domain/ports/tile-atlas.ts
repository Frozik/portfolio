import type { TileKey } from '../tile-key';
import type { TileCoverage } from './tile-coverage';
import type { TileSink } from './tile-sink';

/** GPU-side home of decoded raster tiles; the WebGPU adapter lives in `infrastructure/`. */
export interface TileAtlasPort extends TileSink<ImageBitmap> {
  /** Uploads the image into a layer; the image stays the caller's to close. */
  store(key: TileKey, image: ImageBitmap): void;
  layerOf(key: TileKey): number | undefined;
  readonly capacity: number;
  readonly usedCount: number;
  /** The resident tiles by ground extent, for borrowing pictures while a tile loads. */
  readonly coverage: TileCoverage;
}
