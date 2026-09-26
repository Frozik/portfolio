import type { TileSource } from '../domain/ports/tile-source';
import type { TileCoord } from '../domain/tile-key';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function tileUrl({ z, x, y }: TileCoord): string {
  return OSM_TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/**
 * The OpenStreetMap standard tile server. Its usage policy is honoured by
 * construction: the browser sends the `Referer` and keeps the HTTP cache,
 * only tiles in view are ever requested, and the page shows the credit.
 */
export function createOsmTileSource(): TileSource {
  return {
    async loadTile(coord: TileCoord, signal: AbortSignal): Promise<Blob> {
      const response = await fetch(tileUrl(coord), { signal });
      if (!response.ok) {
        throw new Error(`Tile ${coord.z}/${coord.x}/${coord.y} failed with ${response.status}`);
      }
      return response.blob();
    },
  };
}
