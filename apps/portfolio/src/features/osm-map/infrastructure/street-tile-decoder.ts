import type { MultiPolygon, PolygonWithHoles } from '@frozik/utils/geometry/polygonTypes';
import { VectorTile, type VectorTileLayer } from '@mapbox/vector-tile';
import { isNil } from 'lodash-es';
import { PbfReader } from 'pbf';

import type { BuildingFootprint } from '../domain/building-footprint';
import { buildingTileMesh, polygonsOfTileRings } from '../domain/building-footprint';
import { DEFAULT_BUILDING_HEIGHT_M } from '../domain/constants';
import type { ClearanceLine, GroundObstacles } from '../domain/ground-mask';
import { groundMaskOf } from '../domain/ground-mask';
import type { RoadClass, TileRoad } from '../domain/road-lines';
import { ROAD_CLASSES, roadLinesOfTile } from '../domain/road-lines';
import type { StreetTile } from '../domain/street-tile';
import { clippedPolygonsOfTileRings } from '../domain/tile-clip';
import type { TileGrid } from '../domain/tile-grid';
import { tileGridOf, tileSizeMOf, toPlan } from '../domain/tile-grid';
import type { TileCoord } from '../domain/tile-key';
import { tileKeyOf } from '../domain/tile-key';
import type { TreeCover, TreeCoverKind } from '../domain/tree-cover';
import { plantTrees } from '../domain/tree-cover';
import { waterTileMesh } from '../domain/water-surface';

const BUILDING_LAYER = 'building';
const TRANSPORTATION_LAYER = 'transportation';
const WATER_LAYER = 'water';
const LANDCOVER_LAYER = 'landcover';
const LANDUSE_LAYER = 'landuse';
const WATERWAY_LAYER = 'waterway';
const AEROWAY_LAYER = 'aeroway';
const WOOD_CLASS = 'wood';
/** Water reaches this far into the neighbouring tile: opaque, so the overlap is invisible, while a crack between two quantised meshes is not. */
const WATER_OVERLAP_TILE_UNITS = 1;
/** City parks and gardens are `grass` landcover told apart by subclass; the `park` layer is protected areas, whole city centres with their rivers. */
const PARK_SUBCLASSES: readonly unknown[] = ['park', 'garden'];
const LINE_FEATURE = 2;
const POLYGON_FEATURE = 3;
const TUNNEL = 'tunnel';
/** Bare surfaces drawn on the raster that a park polygon may still enclose: pitches, tracks, sand. */
const BARE_LANDUSE_CLASSES: readonly unknown[] = [
  'pitch',
  'playground',
  'track',
  'stadium',
  'railway',
];
const BARE_LANDCOVER_CLASSES: readonly unknown[] = ['sand', 'rock', 'ice'];
/** Half the ground a line takes, by its OpenMapTiles class: the carriageway or bed plus a margin a trunk keeps from it. */
const CLEARANCE_HALF_WIDTH_M: Readonly<Record<string, number>> = {
  motorway: 10,
  trunk: 9,
  primary: 8,
  secondary: 7,
  tertiary: 6,
  minor: 5,
  service: 3.5,
  busway: 5,
  raceway: 6,
  track: 2.5,
  path: 1.5,
  rail: 3,
  transit: 3,
  river: 8,
  canal: 5,
  stream: 2,
  ditch: 1.5,
  drain: 1.5,
};

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

/** Lines that take ground — roads, paths, rails, streams — except those running under it. */
function clearanceLinesOfLayer(
  layer: VectorTileLayer | undefined,
  coord: TileCoord
): readonly ClearanceLine[] {
  if (layer === undefined) {
    return [];
  }
  const grid = tileGridOf(coord, layer.extent);
  const lines: ClearanceLine[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    const { class: lineClass, brunnel } = feature.properties;
    const halfWidthM =
      typeof lineClass === 'string' ? CLEARANCE_HALF_WIDTH_M[lineClass] : undefined;
    if (feature.type !== LINE_FEATURE || isNil(halfWidthM) || brunnel === TUNNEL) {
      continue;
    }
    for (const line of feature.loadGeometry()) {
      lines.push({ points: toPlan(line, grid), halfWidthM });
    }
  }
  return lines;
}

/** Everything a tree must not stand on: water, buildings, roads and the bare surfaces between them. */
function groundObstaclesOf(
  layers: VectorTile['layers'],
  coord: TileCoord,
  footprints: readonly BuildingFootprint[]
): GroundObstacles {
  return {
    areas: [
      ...polygonsOfLayer(layers[WATER_LAYER], coord),
      ...footprints.flatMap(footprint => footprint.polygons),
      ...polygonsOfLayer(layers[TRANSPORTATION_LAYER], coord),
      ...polygonsOfLayer(layers[AEROWAY_LAYER], coord),
      ...polygonsOfLayer(layers[LANDUSE_LAYER], coord, ({ class: cls }) =>
        BARE_LANDUSE_CLASSES.includes(cls)
      ),
      ...polygonsOfLayer(layers[LANDCOVER_LAYER], coord, ({ class: cls }) =>
        BARE_LANDCOVER_CLASSES.includes(cls)
      ),
    ],
    lines: [
      ...clearanceLinesOfLayer(layers[TRANSPORTATION_LAYER], coord),
      ...clearanceLinesOfLayer(layers[WATERWAY_LAYER], coord),
    ],
  };
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
  const footprints =
    buildings === undefined
      ? []
      : footprintsOfLayer(buildings, tileGridOf(coord, buildings.extent));
  const ground = groundMaskOf(tileSizeMOf(coord), groundObstaclesOf(layers, coord, footprints));
  return {
    buildings: buildingTileMesh(footprints),
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
    trees: plantTrees(treeCoversOf(layers, coord), ground, String(tileKeyOf(coord))),
  };
}
