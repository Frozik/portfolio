import { PbfWriter } from 'pbf';

import {
  DEFAULT_BUILDING_HEIGHT_M,
  FOREST_AREA_PER_TREE_M2,
  PARK_AREA_PER_TREE_M2,
  STREET_MESH_UNIT_M,
} from '../domain/constants';
import { tileGridOf } from '../domain/tile-grid';
import { decodeStreetTile, footprintsOfTile } from './street-tile-decoder';

const TILE = { z: 14, x: 9570, y: 4760 };
const EXTENT = 4096;
const TRIANGLES_PER_BOX = 10;
const VERTICES_PER_TRIANGLE = 3;

type LayerName = 'building' | 'transportation' | 'water' | 'landcover' | 'park';
const LAYERS: readonly LayerName[] = ['building', 'transportation', 'water', 'landcover', 'park'];

interface EncodedFeature {
  readonly ring: readonly (readonly [number, number])[];
  readonly properties: Readonly<Record<string, number | boolean | string>>;
  /** A road rather than a building: an open line in the `transportation` layer. */
  readonly line?: boolean;
  /** The layer the feature goes in; a building unless said otherwise, a road when it is a line. */
  readonly layer?: LayerName;
}

function layerOf(feature: EncodedFeature): LayerName {
  return feature.layer ?? (feature.line === true ? 'transportation' : 'building');
}

const MOVE_TO = 1;
const LINE_TO = 2;
const CLOSE_PATH = 7;
const LINE_STRING = 2;
const POLYGON = 3;
const MVT_VERSION = 2;

function command(id: number, count: number): number {
  return (id & 7) | (count << 3);
}

function zigzag(value: number): number {
  return (value << 1) ^ (value >> 31);
}

function geometryOf(ring: EncodedFeature['ring'], closed: boolean): number[] {
  const [first, ...rest] = ring;
  const commands = [
    command(MOVE_TO, 1),
    zigzag(first[0]),
    zigzag(first[1]),
    command(LINE_TO, rest.length),
  ];
  let previous = first;
  for (const point of rest) {
    commands.push(zigzag(point[0] - previous[0]), zigzag(point[1] - previous[1]));
    previous = point;
  }
  if (closed) {
    commands.push(command(CLOSE_PATH, 1));
  }
  return commands;
}

/** The smallest Mapbox vector tile with the layers the decoder reads, straight from the protobuf schema. */
function encodeTile(features: readonly EncodedFeature[]): ArrayBuffer {
  const pbf = new PbfWriter();
  for (const layer of LAYERS) {
    encodeLayer(
      pbf,
      layer,
      features.filter(feature => layerOf(feature) === layer)
    );
  }
  const bytes = pbf.finish();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function encodeLayer(pbf: PbfWriter, name: string, features: readonly EncodedFeature[]): void {
  const keys: string[] = [];
  const values: (number | boolean | string)[] = [];
  const tagsOf = (properties: EncodedFeature['properties']): number[] =>
    Object.entries(properties).flatMap(([key, value]) => {
      if (!keys.includes(key)) {
        keys.push(key);
      }
      values.push(value);
      return [keys.indexOf(key), values.length - 1];
    });
  const encodedFeatures = features.map(feature => ({
    tags: tagsOf(feature.properties),
    type: feature.line === true ? LINE_STRING : POLYGON,
    geometry: geometryOf(feature.ring, feature.line !== true),
  }));

  pbf.writeMessage(
    3,
    (_, layer) => {
      layer.writeVarintField(15, MVT_VERSION);
      layer.writeStringField(1, name);
      for (const feature of encodedFeatures) {
        layer.writeMessage(
          2,
          (_, writer) => {
            writer.writePackedVarint(2, feature.tags);
            writer.writeVarintField(3, feature.type);
            writer.writePackedVarint(4, feature.geometry);
          },
          undefined
        );
      }
      for (const key of keys) {
        layer.writeStringField(3, key);
      }
      for (const value of values) {
        layer.writeMessage(
          4,
          (_, writer) => {
            if (typeof value === 'boolean') {
              writer.writeBooleanField(7, value);
            } else if (typeof value === 'string') {
              writer.writeStringField(1, value);
            } else {
              writer.writeDoubleField(3, value);
            }
          },
          undefined
        );
      }
      layer.writeVarintField(5, EXTENT);
    },
    undefined
  );
}

const SQUARE: EncodedFeature['ring'] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe('building tile decoding', () => {
  it('reads footprints with their render heights and skips buildings flagged as not for 3D', () => {
    const bytes = encodeTile([
      { ring: SQUARE, properties: { render_height: 12, render_min_height: 3 } },
      { ring: SQUARE, properties: { render_height: 30, hide_3d: true } },
      { ring: SQUARE, properties: {} },
    ]);

    const footprints = footprintsOfTile(bytes, TILE);

    expect(footprints.map(footprint => [footprint.heightM, footprint.minHeightM])).toEqual([
      [12, 3],
      [DEFAULT_BUILDING_HEIGHT_M, 0],
    ]);
    const metresPerUnit = tileGridOf(TILE, EXTENT).tileSizeM / EXTENT;
    expect(footprints[0].polygons[0].outer).toContainEqual({
      x: 100 * metresPerUnit,
      y: -100 * metresPerUnit,
    });
  });

  it('extrudes the tile into one mesh and turns its roads into lanes, tunnels and paths left out', () => {
    const road: EncodedFeature['ring'] = [
      [0, 2000],
      [4096, 2000],
    ];
    const bytes = encodeTile([
      { ring: SQUARE, properties: { render_height: 12 } },
      { ring: road, properties: { class: 'secondary', oneway: 0 }, line: true },
      { ring: road, properties: { class: 'minor', oneway: 1 }, line: true },
      { ring: road, properties: { class: 'tertiary', brunnel: 'tunnel' }, line: true },
      { ring: road, properties: { class: 'path' }, line: true },
    ]);

    const tile = decodeStreetTile(bytes, TILE);

    expect(tile.buildings.indices).toHaveLength(TRIANGLES_PER_BOX * VERTICES_PER_TRIANGLE);
    expect(tile.roads.map(road => [road.roadClass, road.oneway])).toEqual([
      ['secondary', 0],
      ['minor', 1],
    ]);
    expect(tile.roads[0].bordersAtStart && tile.roads[0].bordersAtEnd).toBe(true);
    expect(tile.water.indices).toHaveLength(0);
    expect(tile.trees).toEqual([]);
  });

  it('plants woods from the landcover layer and parks, but not grass or farmland', () => {
    const block: EncodedFeature['ring'] = [
      [0, 0],
      [2000, 0],
      [2000, 2000],
      [0, 2000],
    ];
    const bytes = encodeTile([
      { ring: block, properties: { class: 'wood' }, layer: 'landcover' },
      { ring: block, properties: { class: 'grass' }, layer: 'landcover' },
      { ring: block, properties: { class: 'grass', subclass: 'park' }, layer: 'landcover' },
    ]);
    const grassOnly = encodeTile([
      { ring: block, properties: { class: 'farmland' }, layer: 'landcover' },
      { ring: block, properties: { class: 'grass', subclass: 'grass' }, layer: 'landcover' },
    ]);

    const tile = decodeStreetTile(bytes, TILE);
    const treeCount = tile.trees.reduce((sum, batch) => sum + batch.instances.length / 4, 0);
    const blockSideM = (2000 * tileGridOf(TILE, EXTENT).tileSizeM) / EXTENT;

    expect(treeCount).toBeGreaterThan(0);
    const woodAndPark =
      (blockSideM * blockSideM) / FOREST_AREA_PER_TREE_M2 +
      (blockSideM * blockSideM) / PARK_AREA_PER_TREE_M2;
    expect(treeCount).toBeLessThan(woodAndPark * 1.2);
    expect(decodeStreetTile(grassOnly, TILE).trees).toEqual([]);
  });

  it('plants nothing over a protected area: the park layer is nature reserves and heritage zones, water and streets included', () => {
    const wholeTile: EncodedFeature['ring'] = [
      [0, 0],
      [EXTENT, 0],
      [EXTENT, EXTENT],
      [0, EXTENT],
    ];
    const bytes = encodeTile([
      { ring: wholeTile, properties: { class: 'protected_area' }, layer: 'park' },
    ]);

    expect(decodeStreetTile(bytes, TILE).trees).toEqual([]);
  });

  it('cuts the water one tile unit past the tile square, so neighbours overlap instead of cracking, and lays it flat as one mesh', () => {
    const ocean: EncodedFeature['ring'] = [
      [-64, -64],
      [4160, -64],
      [4160, 4160],
      [-64, 4160],
    ];
    const bytes = encodeTile([{ ring: ocean, properties: { class: 'ocean' }, layer: 'water' }]);

    const tile = decodeStreetTile(bytes, TILE);

    expect(tile.water.indices).toHaveLength(2 * VERTICES_PER_TRIANGLE);
    const meshUnitsPerTileUnit = tileGridOf(TILE, EXTENT).tileSizeM / EXTENT / STREET_MESH_UNIT_M;
    expect(Math.min(...tile.water.positions)).toBe(Math.round(-meshUnitsPerTileUnit));
    expect(Math.max(...tile.water.positions)).toBe(Math.round((EXTENT + 1) * meshUnitsPerTileUnit));
  });
});
