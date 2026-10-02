import type { MultiPolygon, PolygonWithHoles } from '@frozik/utils/geometry/polygonTypes';
import { VectorTile, type VectorTileLayer } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

import type { BuildingFootprint } from '../domain/building-footprint';
import { buildingTileMesh, polygonsOfTileRings } from '../domain/building-footprint';
import { DEFAULT_BUILDING_HEIGHT_M } from '../domain/constants';
import type { RoadClass, TileRoad } from '../domain/road-lines';
import { ROAD_CLASSES, roadLinesOfTile } from '../domain/road-lines';
import type { StreetTile } from '../domain/street-tile';
import { clippedPolygonsOfTileRings } from '../domain/tile-clip';
import type { TileGrid } from '../domain/tile-grid';
import { tileGridOf } from '../domain/tile-grid';
import type { TileCoord } from '../domain/tile-key';
import { tileKeyOf } from '../domain/tile-key';
import type { TreeCover, TreeCoverKind } from '../domain/tree-cover';
import { plantTrees } from '../domain/tree-cover';
import { waterTileMesh } from '../domain/water-surface';

const BUILDING_LAYER = 'building';
const TRANSPORTATION_LAYER = 'transportation';
const WATER_LAYER = 'water';
const LANDCOVER_LAYER = 'landcover';
const WOOD_CLASS = 'wood';
/** Water reaches this far into the neighbouring tile: opaque, so the overlap is invisible, while a crack between two quantised meshes is not. */
const WATER_OVERLAP_TILE_UNITS = 1;
/** City parks and gardens are `grass` landcover told apart by subclass; the `park` layer is protected areas, whole city centres with their rivers. */
const PARK_SUBCLASSES: readonly unknown[] = ['park', 'garden'];
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

/** Every polygon of a layer that passes the filter, cut to the tile. */
function polygonsOfLayer(
  layer: VectorTileLayer | undefined,
  coord: TileCoord,
  keep: (properties: Record<string, unknown>) => boolean = () => true,
  margin: number = 0
): MultiPolygon {
  if (layer === undefined) {
    return [];
  }
  const grid = tileGridOf(coord, layer.extent);
  const polygons: PolygonWithHoles[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (feature.type === POLYGON_FEATURE && keep(feature.properties)) {
      polygons.push(...clippedPolygonsOfTileRings(feature.loadGeometry(), grid, margin));
    }
  }
  return polygons;
}

/** Woods, parks and gardens of the `landcover` layer grow trees. */
function treeCoversOf(layers: VectorTile['layers'], coord: TileCoord): readonly TreeCover[] {
  const covers: readonly (readonly [TreeCoverKind, MultiPolygon])[] = [
    [
      'forest',
      polygonsOfLayer(layers[LANDCOVER_LAYER], coord, ({ class: cls }) => cls === WOOD_CLASS),
    ],
    [
      'park',
      polygonsOfLayer(layers[LANDCOVER_LAYER], coord, ({ subclass }) =>
        PARK_SUBCLASSES.includes(subclass)
      ),
    ],
  ];
  return covers.flatMap(([kind, polygons]) => (polygons.length === 0 ? [] : [{ kind, polygons }]));
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
    water: waterTileMesh(
      polygonsOfLayer(layers[WATER_LAYER], coord, () => true, WATER_OVERLAP_TILE_UNITS)
    ),
    trees: plantTrees(treeCoversOf(layers, coord), String(tileKeyOf(coord))),
  };
}
