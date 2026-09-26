import type { TileCoord } from '../tile-key';

/** Where tile images come from, still encoded; the network adapter lives in `infrastructure/`. */
export interface TileSource {
  loadTile(coord: TileCoord, signal: AbortSignal): Promise<Blob>;
}
