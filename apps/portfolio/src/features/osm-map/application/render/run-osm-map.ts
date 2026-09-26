import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';

import { ATLAS_LAYERS_TARGET, FPS_IDLE, FPS_INTERACTION, FPS_RESIZE } from '../../domain/constants';
import { requestCurrentPosition } from '../../infrastructure/geolocation';
import { createIndexedDBTileStore } from '../../infrastructure/indexeddb-tile-store';
import { MapGroundLayer } from '../../infrastructure/layers/map-ground-layer';
import { createMapCameraController } from '../../infrastructure/map-camera-controller';
import { createOsmTileSource } from '../../infrastructure/osm-tile-source';
import { TileAtlas } from '../../infrastructure/tile-atlas';
import { TileLoader } from '../../infrastructure/tile-loader';
import { createViewHashSync } from '../../infrastructure/view-hash-sync';
import type { OsmMapStore } from '../OsmMapStore';
import { MapScene } from './map-scene';

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
  let frameTime = 0;
  const loader = new TileLoader({
    source: createOsmTileSource(),
    atlas,
    store: tileStore,
    decode: bytes =>
      createImageBitmap(bytes, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
    readNow: () => frameTime,
    onChange: () => {
      scene.markLoadsChanged();
      fpsController.raise(FPS_INTERACTION);
    },
  });
  const scene = new MapScene({
    camera,
    loader,
    atlas,
    store: tileStore,
    onPoseChanged: publishView,
    onStats: store.reportFrame,
  });
  const groundLayer = new MapGroundLayer(context, atlas, state => {
    frameTime = state.time;
    if (scene.busy) {
      fpsController.raise(FPS_INTERACTION);
    }
    return scene.advance(state);
  });
  const layerManager = new RenderLayerManager([groundLayer]);
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
      layerManager.dispose();
      atlas.dispose();
      fpsController.dispose();
      context.device.destroy();
    },
  };
}
