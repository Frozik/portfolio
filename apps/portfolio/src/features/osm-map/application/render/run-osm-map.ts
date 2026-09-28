import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';

import {
  ATLAS_LAYERS_TARGET,
  FPS_IDLE,
  FPS_INTERACTION,
  FPS_RESIZE,
  FPS_ANIMATION,
  MAX_STORED_BUILDING_TILES,
} from '../../domain/constants';
import type { StreetTile } from '../../domain/street-tile';
import { requestCurrentPosition } from '../../infrastructure/geolocation';
import { createIndexedDBTileStore } from '../../infrastructure/indexeddb-tile-store';
import type { MapFrame } from '../../infrastructure/layers/map-frame';
import { MapGroundLayer } from '../../infrastructure/layers/map-ground-layer';
import { MapStreetLayer } from '../../infrastructure/layers/map-street-layer';
import { MapWaterLayer } from '../../infrastructure/layers/map-water-layer';
import { createMapCameraController } from '../../infrastructure/map-camera-controller';
import { createOpenFreeMapTileSource } from '../../infrastructure/openfreemap-tile-source';
import { createOsmTileSource } from '../../infrastructure/osm-tile-source';
import { StreetTileCache } from '../../infrastructure/street-tile-cache';
import { createStreetTileDecoder } from '../../infrastructure/street-tile-worker-client';
import { TileAtlas } from '../../infrastructure/tile-atlas';
import { TileLoader } from '../../infrastructure/tile-loader';
import { createViewHashSync } from '../../infrastructure/view-hash-sync';
import type { OsmMapStore } from '../OsmMapStore';
import { MapScene } from './map-scene';
import { StreetTraffic } from './street-traffic';

/** Encoded street tiles keep to their own database: their keys collide with the raster tiles'. */
const STREET_STORE_NAME = 'osm-map-streets';

/** The composition root of the running map; the returned function tears everything down. */
export function runOsmMap({
  canvas,
  store,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: OsmMapStore;
}): VoidFunction {
  const disposables = new DisposableBag();
  const fpsController = new FpsController(FPS_IDLE);
  const hashSync = createViewHashSync();
  let touched = false;
  const camera = createMapCameraController(canvas, hashSync.initialView ?? store.home, () => {
    touched = true;
    fpsController.raise(FPS_INTERACTION);
  });
  disposables.add(() => camera.destroy());
  if (hashSync.initialView === undefined) {
    // The fix may take seconds; the map opens over the remembered place (or
    // the default) meanwhile and jumps only if nobody has moved it yet.
    disposables.add(
      requestCurrentPosition(position => {
        store.setHome(position);
        if (!touched) {
          camera.setView(store.home);
        }
      })
    );
  }
  disposables.add(() => hashSync.dispose());
  disposables.add(store.attachViewControl(camera));
  disposables.add(
    runGpuApp({
      // A view nobody chose stays out of the URL: a hash written for the
      // opening pose would make the next visit skip geolocation for good.
      init: () =>
        initGpu(
          canvas,
          store,
          camera,
          view => {
            if (touched) {
              hashSync.publish(view);
            }
          },
          fpsController
        ),
      initErrorMessage: 'Failed to initialize the OSM map renderer',
    })
  );
  return () => disposables.disposeAll();
}

async function initGpu(
  canvas: HTMLCanvasElement,
  store: OsmMapStore,
  camera: ReturnType<typeof createMapCameraController>,
  publishView: ReturnType<typeof createViewHashSync>['publish'],
  fpsController: FpsController
): Promise<GpuAppSession> {
  const context = await createGpuContext(canvas, {
    requiredLimits: limits => ({
      maxTextureArrayLayers: Math.min(limits.maxTextureArrayLayers, ATLAS_LAYERS_TARGET),
    }),
  });
  const atlas = new TileAtlas(
    context.device,
    Math.min(context.device.limits.maxTextureArrayLayers, ATLAS_LAYERS_TARGET)
  );
  const tileStore = createIndexedDBTileStore();
  const streetStore = createIndexedDBTileStore(STREET_STORE_NAME, MAX_STORED_BUILDING_TILES);
  const streetCache = new StreetTileCache(context.device);
  const streetDecoder = createStreetTileDecoder();
  let frameTime = 0;
  const onLoadChange = (): void => {
    scene.markLoadsChanged();
    fpsController.raise(FPS_INTERACTION);
  };
  const loader = new TileLoader<ImageBitmap>({
    source: createOsmTileSource(),
    sink: atlas,
    store: tileStore,
    decode: bytes =>
      createImageBitmap(bytes, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
    release: image => image.close(),
    readNow: () => frameTime,
    onChange: onLoadChange,
  });
  const streetLoader = new TileLoader<StreetTile>({
    source: createOpenFreeMapTileSource(),
    sink: streetCache,
    store: streetStore,
    decode: (bytes, coord, signal) => streetDecoder.decode(bytes, coord, signal),
    readNow: () => frameTime,
    onChange: onLoadChange,
  });
  const scene = new MapScene({
    camera,
    loader,
    streetLoader,
    traffic: new StreetTraffic(key => streetCache.roadsOf(key)),
    hasWater: key => streetCache.hasWater(key),
    atlas,
    onPoseChanged: publishView,
    onBearing: store.reportBearing,
  });
  // The ground layer runs the scene; the water and street layers draw the
  // same frame right after it, and the next tick replaces it.
  let currentFrame: MapFrame | undefined;
  const groundLayer = new MapGroundLayer(context, atlas, state => {
    frameTime = state.time;
    if (scene.busy) {
      fpsController.raise(FPS_INTERACTION);
    } else if (scene.animatedAtRest) {
      fpsController.raise(FPS_ANIMATION);
    }
    currentFrame = scene.advance(state);
    return currentFrame;
  });
  const readFrame = (): MapFrame | undefined => currentFrame;
  const waterLayer = new MapWaterLayer(context, streetCache, readFrame);
  const streetLayer = new MapStreetLayer(context, streetCache, readFrame);
  const layerManager = new RenderLayerManager([groundLayer, waterLayer, streetLayer]);
  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
    fpsController,
    onFpsUpdate: fps => scene.reportFrameRate(fps, frameTime),
    shouldRender: () => groundLayer.consumeDirty(),
    onResize: () => fpsController.raise(FPS_RESIZE),
  });

  return {
    cleanup: () => {
      stopRenderLoop();
      loader.dispose();
      streetLoader.dispose();
      streetDecoder.dispose();
      layerManager.dispose();
      streetCache.dispose();
      atlas.dispose();
      fpsController.dispose();
      context.device.destroy();
    },
  };
}
