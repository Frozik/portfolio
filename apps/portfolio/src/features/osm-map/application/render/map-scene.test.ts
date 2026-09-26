import type { FrameState } from '@frozik/utils/webgpu/renderLayer';

import { MAX_CONCURRENT_LOADS } from '../../domain/constants';
import type { MapCameraState } from '../../domain/map-camera';
import { createMapCamera } from '../../domain/map-camera';
import { DEFAULT_VIEW } from '../../domain/map-view';
import type { TileAtlasPort } from '../../domain/ports/tile-atlas';
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

function restingCamera(): MapCameraController {
  const state: MapCameraState = createMapCamera(DEFAULT_VIEW);
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
    touch: () => undefined,
    capacity: 64,
    usedCount: 0,
    coverage: new ResidentTileIndex(),
  };
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick++) {
    await Promise.resolve();
  }
}

describe('MapScene', () => {
  it('keeps loading the queue while the camera is at rest', async () => {
    const { source, resolvers } = createFakeSource();
    let time = 0;
    const scene = new MapScene({
      camera: restingCamera(),
      loader: new TileLoader({
        source,
        atlas: createFakeAtlas(),
        store: createFakeStore(),
        decode: () => Promise.resolve({ close: () => undefined } as unknown as ImageBitmap),
        readNow: () => time,
        onChange: () => scene.markLoadsChanged(),
      }),
      atlas: createFakeAtlas(),
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
});
