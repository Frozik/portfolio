import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import type { BuildingFootprint } from '../domain/building-footprint';
import { buildingTileMesh, polygonsOfTileRings, tileGridOf } from '../domain/building-footprint';
import { DEFAULT_BUILDING_HEIGHT_M } from '../domain/constants';
import type { TileCoord } from '../domain/tile-key';

const BUILDING_LAYER = 'building';
const POLYGON_FEATURE = 3;

function numberProperty(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The OpenMapTiles `building` layer of one tile, as footprints in metres from the tile corner. */
export function footprintsOfTile(
  bytes: ArrayBuffer,
  coord: TileCoord
): readonly BuildingFootprint[] {
  const layer = new VectorTile(new PbfReader(bytes)).layers[BUILDING_LAYER];
  if (layer === undefined) {
    return [];
  }
  const grid = tileGridOf(coord, layer.extent);
  const footprints: BuildingFootprint[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (feature.type !== POLYGON_FEATURE || feature.properties.hide_3d === true) {
      continue;
    }
    footprints.push({
      polygons: polygonsOfTileRings(feature.loadGeometry(), grid),
      heightM: numberProperty(feature.properties.render_height, DEFAULT_BUILDING_HEIGHT_M),
      minHeightM: numberProperty(feature.properties.render_min_height, 0),
    });
  }
  return footprints;
}

export function decodeBuildingTile(bytes: ArrayBuffer, coord: TileCoord): LitMesh {
  return buildingTileMesh(footprintsOfTile(bytes, coord));
}
