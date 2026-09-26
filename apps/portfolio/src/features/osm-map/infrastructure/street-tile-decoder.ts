import { VectorTile, type VectorTileLayer } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

import type { BuildingFootprint } from '../domain/building-footprint';
import { buildingTileMesh, polygonsOfTileRings } from '../domain/building-footprint';
import { DEFAULT_BUILDING_HEIGHT_M } from '../domain/constants';
import type { RoadClass, TileRoad } from '../domain/road-lines';
import { ROAD_CLASSES, roadLinesOfTile } from '../domain/road-lines';
import type { StreetTile } from '../domain/street-tile';
import type { TileGrid } from '../domain/tile-grid';
import { tileGridOf } from '../domain/tile-grid';
import type { TileCoord } from '../domain/tile-key';

const BUILDING_LAYER = 'building';
const TRANSPORTATION_LAYER = 'transportation';
const LINE_FEATURE = 2;
const POLYGON_FEATURE = 3;
const TUNNEL = 'tunnel';

function numberProperty(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRoadClass(value: unknown): value is RoadClass {
  return typeof value === 'string' && (ROAD_CLASSES as readonly string[]).includes(value);
}

function onewayOf(value: unknown): -1 | 0 | 1 {
  return value === 1 ? 1 : value === -1 ? -1 : 0;
}

/** The OpenMapTiles `building` layer of one tile, as footprints in metres from the tile corner. */
export function footprintsOfTile(
  bytes: ArrayBuffer,
  coord: TileCoord
): readonly BuildingFootprint[] {
  const layer = new VectorTile(new PbfReader(bytes)).layers[BUILDING_LAYER];
  return layer === undefined ? [] : footprintsOfLayer(layer, tileGridOf(coord, layer.extent));
}

function footprintsOfLayer(layer: VectorTileLayer, grid: TileGrid): readonly BuildingFootprint[] {
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

/** The drivable roads of the `transportation` layer: cars cannot be seen in a tunnel. */
function roadsOfLayer(layer: VectorTileLayer): readonly TileRoad[] {
  const roads: TileRoad[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    const { class: roadClass, brunnel, oneway } = feature.properties;
    if (feature.type !== LINE_FEATURE || !isRoadClass(roadClass) || brunnel === TUNNEL) {
      continue;
    }
    roads.push({ lines: feature.loadGeometry(), roadClass, oneway: onewayOf(oneway) });
  }
  return roads;
}

export function decodeStreetTile(bytes: ArrayBuffer, coord: TileCoord): StreetTile {
  const { layers } = new VectorTile(new PbfReader(bytes));
  const buildings = layers[BUILDING_LAYER];
  const transportation = layers[TRANSPORTATION_LAYER];
  return {
    buildings: buildingTileMesh(
      buildings === undefined
        ? []
        : footprintsOfLayer(buildings, tileGridOf(coord, buildings.extent))
    ),
    roads:
      transportation === undefined
        ? []
        : roadLinesOfTile(
            roadsOfLayer(transportation),
            coord,
            transportation.extent,
            tileGridOf(coord, transportation.extent).tileSizeM
          ),
  };
}
