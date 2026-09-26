import { isNil } from 'lodash-es';

import type { TileSource } from '../domain/ports/tile-source';
import type { TileCoord } from '../domain/tile-key';

/** The TileJSON names the current planet build; the tile path changes with every build. */
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

interface TileJson {
  readonly tiles: readonly string[];
}

function isTileJson(value: unknown): value is TileJson {
  return (
    typeof value === 'object' &&
    !isNil(value) &&
    'tiles' in value &&
    Array.isArray(value.tiles) &&
    typeof value.tiles[0] === 'string'
  );
}

function tileUrl(template: string, { z, x, y }: TileCoord): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/**
 * OpenFreeMap's planet vector tiles (OpenMapTiles schema, OSM data): free,
 * keyless, with a `building` layer at z13–14 carrying render heights. The
 * tile URL is read from the TileJSON once per session; a failed read is
 * forgotten so the next tile tries again.
 */
export function createOpenFreeMapTileSource(): TileSource {
  let templatePromise: Promise<string> | undefined;

  const readTemplate = (): Promise<string> => {
    if (isNil(templatePromise)) {
      const reading = fetch(TILEJSON_URL)
        .then(response => {
          if (!response.ok) {
            throw new Error(`OpenFreeMap TileJSON failed with ${response.status}`);
          }
          return response.json();
        })
        .then((json: unknown) => {
          if (!isTileJson(json)) {
            throw new Error('OpenFreeMap TileJSON has no tile URL');
          }
          return json.tiles[0];
        });
      reading.catch(() => {
        if (templatePromise === reading) {
          templatePromise = undefined;
        }
      });
      templatePromise = reading;
    }
    return templatePromise;
  };

  return {
    async loadTile(coord: TileCoord, signal: AbortSignal): Promise<Blob> {
      const template = await readTemplate();
      const response = await fetch(tileUrl(template, coord), { signal });
      if (!response.ok) {
        throw new Error(
          `Building tile ${coord.z}/${coord.x}/${coord.y} failed with ${response.status}`
        );
      }
      return response.blob();
    },
  };
}
