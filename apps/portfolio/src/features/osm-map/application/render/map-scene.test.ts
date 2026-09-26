import type { FrameState } from '@frozik/utils/webgpu/renderLayer';

import type { BuildingMesh } from '../../domain/building-footprint';
import {
  BUILDING_RISE_SECONDS,
  BUILDINGS_MIN_ZOOM,
  CARS_MIN_ZOOM,
  MAX_CONCURRENT_LOADS,
} from '../../domain/constants';
import type { MapCameraState } from '../../domain/map-camera';
import { createMapCamera } from '../../domain/map-camera';
import { DEFAULT_VIEW } from '../../domain/map-view';
import type { TileAtlasPort } from '../../domain/ports/tile-atlas';
import type { TileSink } from '../../domain/ports/tile-sink';
import type { TileSource } from '../../domain/ports/tile-source';
import type { TileStore } from '../../domain/ports/tile-store';
import { ResidentTileIndex } from '../../domain/resident-tile-index';
import type { RoadLine } from '../../domain/road-lines';
import { roadLinesOfTile } from '../../domain/road-lines';
import type { StreetTile } from '../../domain/street-tile';
import type { TileCoord, TileKey } from '../../domain/tile-key';
import type { MapCameraController } from '../../infrastructure/map-camera-controller';
import { TileLoader } from '../../infrastructure/tile-loader';
import { MapScene } from './map-scene';
import { StreetTraffic } from './street-traffic';

function frame(time: number): FrameState {
  return { time, canvasWidth: 1600, canvasHeight: 900, devicePixelRatio: 1 };
}

function restingCamera(zoom: number = DEFAULT_VIEW.zoom): MapCameraController {
  const state: MapCameraState = createMapCamera({ ...DEFAULT_VIEW, zoom });
  return {
    tick: () => state,
    setView: () => undefined,
    resetNorth: () => undefined,
    moveTo: () => undefined,
    destroy: () => undefined,
  };
}

function createFakeSource() {
  const resolvers: Array<() => void> = [];
  const source: TileSource = {
    loadTile: () =>
      new Promise<Blob>(resolve => {
        resolvers.push(() => resolve({ size: 1 } as Blob));
      }),
  };
  return { source, resolvers };
}

function createFakeStore(): TileStore {
  const bytes = new Map<TileKey, Blob>();
  return {
    get: key => Promise.resolve(bytes.get(key)),
    set: (key, blob) => {
      bytes.set(key, blob);
      return Promise.resolve();
    },
    get count(): number {
      return bytes.size;
    },
  };
}

function createFakeAtlas(): TileAtlasPort {
  const layers = new Map<TileKey, number>();
  return {
    store: key => layers.set(key, layers.size),
    layerOf: key => layers.get(key),
    has: key => layers.has(key),
    touch: () => undefined,
    capacity: 64,
    usedCount: 0,
    coverage: new ResidentTileIndex(),
  };
}

function createFakeStreetSink(): TileSink<StreetTile> & {
  roadsOf: (key: TileKey) => readonly RoadLine[];
} {
  const tiles = new Map<TileKey, StreetTile>();
  return {
    store: (key, tile) => tiles.set(key, tile),
    has: key => tiles.has(key),
    touch: () => undefined,
    roadsOf: key => tiles.get(key)?.roads ?? [],
  };
}

const NO_BUILDINGS: BuildingMesh = { positions: new Int16Array(0), indices: new Uint32Array(0) };

/** One straight one-way street through the tile, long enough for a few cars. */
function straightStreet(coord: TileCoord): readonly RoadLine[] {
  return roadLinesOfTile(
    [
      {
        lines: [
          [
            { x: 100, y: 2000 },
            { x: 4000, y: 2000 },
          ],
        ],
        roadClass: 'secondary',
        oneway: 1,
      },
    ],
    coord,
    4096,
    1224
  );
}

function createStreetScene(zoom: number) {
  const streets = createFakeSource();
  const sink = createFakeStreetSink();
  const atlas = createFakeAtlas();
  let time = 0;
  const scene = new MapScene({
    camera: restingCamera(zoom),
    loader: new TileLoader<ImageBitmap>({
      source: createFakeSource().source,
      sink: atlas,
      store: createFakeStore(),
      decode: () => Promise.resolve({ close: () => undefined } as unknown as ImageBitmap),
      readNow: () => time,
      onChange: () => scene.markLoadsChanged(),
    }),
    streetLoader: new TileLoader<StreetTile>({
      source: streets.source,
      sink,
      store: createFakeStore(),
      decode: (_bytes, coord) =>
        Promise.resolve({ buildings: NO_BUILDINGS, roads: straightStreet(coord) }),
      readNow: () => time,
      onChange: () => scene.markLoadsChanged(),
    }),
    traffic: new StreetTraffic(sink.roadsOf),
    atlas,
    store: createFakeStore(),
    onPoseChanged: () => undefined,
    onStats: () => undefined,
  });
  return { scene, streets, setTime: (next: number) => (time = next) };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick++) {
    await Promise.resolve();
  }
}

describe('MapScene', () => {
  it('keeps loading the queue while the camera is at rest', async () => {
    const { source, resolvers } = createFakeSource();
    const atlas = createFakeAtlas();
    let time = 0;
    const scene = new MapScene({
      camera: restingCamera(),
      loader: new TileLoader<ImageBitmap>({
        source,
        sink: atlas,
        store: createFakeStore(),
        decode: () => Promise.resolve({ close: () => undefined } as unknown as ImageBitmap),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
      streetLoader: new TileLoader<StreetTile>({
        source: createFakeSource().source,
        sink: createFakeStreetSink(),
        store: createFakeStore(),
        decode: () => Promise.resolve({ buildings: NO_BUILDINGS, roads: [] }),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
      traffic: new StreetTraffic(() => []),
      atlas,
      store: createFakeStore(),
      onPoseChanged: () => undefined,
      onStats: () => undefined,
    });

    const first = scene.advance(frame(time));
    await settle();
    expect(first?.instanceCount).toBeGreaterThan(MAX_CONCURRENT_LOADS);
    expect(resolvers).toHaveLength(MAX_CONCURRENT_LOADS);
    expect(scene.advance(frame(++time))).toBeUndefined();

    resolvers[0]();
    await settle();
    const afterLanding = scene.advance(frame(++time));
    await settle();

    expect(afterLanding).toBeDefined();
    expect(resolvers).toHaveLength(MAX_CONCURRENT_LOADS + 1);
  });

  it('grows building tiles out of the ground when they enter the picture and draws until they stand', async () => {
    const { scene, streets, setTime } = createStreetScene(BUILDINGS_MIN_ZOOM);

    scene.advance(frame(0));
    await settle();
    streets.resolvers[0]();
    await settle();
    const time = 5;
    setTime(time);
    const landed = scene.advance(frame(time));
    const midway = scene.advance(frame(time + BUILDING_RISE_SECONDS / 2));
    const settled = scene.advance(frame(time + BUILDING_RISE_SECONDS * 2));
    const atRest = scene.advance(frame(time + BUILDING_RISE_SECONDS * 3));

    expect(landed?.streetTiles.map(placement => placement.riseStart)).toEqual([time]);
    expect(landed?.cars).toEqual([]);
    expect(midway?.streetTiles[0].riseStart).toBe(time);
    expect(settled).toBeDefined();
    expect(atRest).toBeUndefined();
  });

  it('drives cars along the lanes at street zoom and keeps the frames coming while they move', async () => {
    const { scene, streets } = createStreetScene(CARS_MIN_ZOOM);

    scene.advance(frame(0));
    await settle();
    streets.resolvers[0]();
    await settle();
    const first = scene.advance(frame(1));
    const later = scene.advance(frame(1.05));
    const muchLater = scene.advance(frame(BUILDING_RISE_SECONDS * 4));

    expect(first?.cars.length).toBeGreaterThan(0);
    expect(first?.cars[0].placementIndex).toBe(0);
    expect(later?.cars[0].x).toBeGreaterThan(first?.cars[0].x ?? Number.POSITIVE_INFINITY);
    expect(muchLater).toBeDefined();
    expect(scene.trafficMoving).toBe(true);
  });

  it("keeps a tile's rise where it was when the tile blinks out of the picture and back", async () => {
    const { scene, streets, setTime } = createStreetScene(BUILDINGS_MIN_ZOOM);

    scene.advance(frame(0));
    await settle();
    streets.resolvers[0]();
    await settle();
    setTime(5);
    const landed = scene.advance(frame(5));
    scene.markLoadsChanged();
    const again = scene.advance(frame(5 + BUILDING_RISE_SECONDS * 5));

    expect(landed?.streetTiles[0].riseStart).toBe(5);
    expect(again?.streetTiles[0].riseStart).toBe(5);
  });
});
