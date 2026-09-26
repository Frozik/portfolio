import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import { EMPTY_LIT_MESH } from '@frozik/utils/geometry/litMesh';
import type { FrameState } from '@frozik/utils/webgpu/renderLayer';

import {
  BUILDING_RISE_SECONDS,
  BUILDINGS_MIN_ZOOM,
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
import type { TileKey } from '../../domain/tile-key';
import type { MapCameraController } from '../../infrastructure/map-camera-controller';
import { TileLoader } from '../../infrastructure/tile-loader';
import { MapScene } from './map-scene';

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

function createFakeMeshSink(): TileSink<LitMesh> {
  const keys = new Set<TileKey>();
  return { store: key => keys.add(key), has: key => keys.has(key), touch: () => undefined };
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
      buildingLoader: new TileLoader<LitMesh>({
        source: createFakeSource().source,
        sink: createFakeMeshSink(),
        store: createFakeStore(),
        decode: () => Promise.resolve(EMPTY_LIT_MESH),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
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
    const buildings = createFakeSource();
    let time = 0;
    const scene = new MapScene({
      camera: restingCamera(BUILDINGS_MIN_ZOOM),
      loader: new TileLoader<ImageBitmap>({
        source: createFakeSource().source,
        sink: createFakeAtlas(),
        store: createFakeStore(),
        decode: () => Promise.resolve({ close: () => undefined } as unknown as ImageBitmap),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
      buildingLoader: new TileLoader<LitMesh>({
        source: buildings.source,
        sink: createFakeMeshSink(),
        store: createFakeStore(),
        decode: () => Promise.resolve(EMPTY_LIT_MESH),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
      atlas: createFakeAtlas(),
      store: createFakeStore(),
      onPoseChanged: () => undefined,
      onStats: () => undefined,
    });

    scene.advance(frame(time));
    await settle();
    buildings.resolvers[0]();
    await settle();
    time = 5;
    const landed = scene.advance(frame(time));
    const midway = scene.advance(frame(time + BUILDING_RISE_SECONDS / 2));
    const settled = scene.advance(frame(time + BUILDING_RISE_SECONDS * 2));
    const atRest = scene.advance(frame(time + BUILDING_RISE_SECONDS * 3));

    expect(landed?.buildings.map(placement => placement.riseStart)).toEqual([time]);
    expect(midway?.buildings[0].riseStart).toBe(time);
    expect(settled).toBeDefined();
    expect(atRest).toBeUndefined();
  });
});
