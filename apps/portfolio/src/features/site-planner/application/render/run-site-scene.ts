import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { isNil } from 'lodash-es';
import type { IReactionDisposer } from 'mobx';
import { reaction } from 'mobx';

import type { Sunlight } from '../../domain/sun/sun-direction';
import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';
import type { Heightfield } from '../../domain/terrain/heightfield';
import { computeElevationRange } from '../../domain/terrain/heightfield';
import type { Meters } from '../../domain/units';
import { planToWorld } from '../../domain/view/world-frame';
import { ObjectsLayer } from '../../infrastructure/layers/objects-layer';
import { createSceneUpdateLayer } from '../../infrastructure/layers/scene-update-layer';
import { ShadowLayer } from '../../infrastructure/layers/shadow-layer';
import { SkyLayer } from '../../infrastructure/layers/sky-layer';
import { TerrainLayer } from '../../infrastructure/layers/terrain-layer';
import type { OrbitCamera, OrbitCameraHome } from '../../infrastructure/orbit-camera';
import { createOrbitCamera } from '../../infrastructure/orbit-camera';
import {
  DEPTH_FORMAT,
  FPS_ANIMATION,
  FPS_IDLE,
  FPS_INTERACTION,
  FPS_RESIZE,
  MSAA_SAMPLE_COUNT,
} from '../../infrastructure/render-constants';
import { createSceneUniforms } from '../../infrastructure/scene-uniforms';
import {
  computeShadowProjection,
  createShadowMap,
  EMPTY_SHADOW_PROJECTION,
} from '../../infrastructure/shadow-map';
import type { SceneObjects, SceneSink, SceneTerrain } from '../scene-sink';
import type { SitePlannerStore } from '../SitePlannerStore';

/**
 * Where the light comes from in the moment between the device coming up and the
 * store's own sun reaching it: the south-west, 40° above the horizon. Points
 * *towards* the sun, as every sun direction in the feature does.
 */
const INITIAL_SUNLIGHT: Sunlight = {
  direction: [-0.542, 0.643, 0.542],
  intensity: 1,
};

const HALF = 0.5;

export interface SiteSceneSession {
  /** Frames the plot again, wherever the camera was left. */
  resetCamera(): void;
  dispose(): void;
}

interface SiteSceneGpuSession {
  readonly cleanup: VoidFunction;
  readonly sink: SceneSink;
}

/**
 * The 3D session: an orbit camera, a WebGPU device and the layers drawing into
 * it, fed from the store through a {@link SceneSink}. Rendering is on demand —
 * a frame is encoded only once the camera or the plan moved — and throttled by
 * the frame-rate governor the rest of the time.
 *
 * Returns as soon as the camera and the input are live; the device request runs
 * on behind it, and an unmount that beats it tears the session down the moment
 * it arrives (precedent: `runStereometry`).
 */
export function runSiteScene({
  canvas,
  store,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SitePlannerStore;
}): SiteSceneSession {
  const camera = createOrbitCamera(canvas);
  const fpsController = new FpsController(FPS_IDLE);

  let isDirty = true;
  let stopWatchingTerrain: IReactionDisposer | undefined;
  let stopWatchingObjects: IReactionDisposer | undefined;
  let stopWatchingOverlay: IReactionDisposer | undefined;
  let stopWatchingSun: IReactionDisposer | undefined;

  const markDirty = (): void => {
    isDirty = true;
  };

  /**
   * A redraw request, plus the camera's heading published to the store. The 3D
   * compass is React drawn over the canvas, and the frames the view moved on are
   * the only moments its needle could be stale — so it follows the camera
   * without a loop of its own, and a scene at rest costs it nothing.
   */
  const markViewMoved = (): void => {
    markDirty();
    store.setCameraYawDegrees(camera.getYawDegrees());
  };

  markViewMoved();

  const consumeDirty = (): boolean => {
    const wasDirty = isDirty;

    isDirty = false;

    return wasDirty;
  };

  const raiseInteractionFps = (): void => fpsController.raise(FPS_INTERACTION);

  canvas.addEventListener('pointerdown', raiseInteractionFps);
  canvas.addEventListener('pointermove', raiseInteractionFps);
  canvas.addEventListener('wheel', raiseInteractionFps);

  const stopGpuApp = runGpuApp<SiteSceneGpuSession>({
    init: () =>
      initSiteScene({ canvas, camera, fpsController, markDirty: markViewMoved, consumeDirty }),
    onReady: ({ sink }) => {
      // reaction, not autorun: the sink runs untracked, so nothing it reaches —
      // the camera it re-frames today, whatever it drives tomorrow — can be
      // caught reading or writing observables from inside a tracked body.
      //
      // Two of them rather than one: the ground and what stands on it are
      // uploaded to their own buffers, and moving the house must not cost a
      // re-upload of the terrain grid.
      stopWatchingTerrain = reaction(
        () => readSceneTerrain(store),
        terrain => sink.applyTerrain(terrain),
        { fireImmediately: true }
      );
      stopWatchingObjects = reaction(
        () => readSceneObjects(store),
        objects => sink.applyObjects(objects),
        { fireImmediately: true }
      );
      // The analysis is switched on and off on its own, and costs a texture
      // upload rather than a buffer one, so it is watched apart from the ground
      // it is painted over.
      stopWatchingOverlay = reaction(
        () => store.scene.analysisRaster,
        raster => sink.applyOverlay(raster),
        { fireImmediately: true }
      );
      // The sun moves on its own — the study's slider and its day animation —
      // and moves nothing else, so it is watched apart from the geometry.
      stopWatchingSun = reaction(
        () => store.sun.light,
        sunlight => sink.applySun(sunlight),
        { fireImmediately: true }
      );
    },
    initErrorMessage: 'Failed to initialize the site planner 3D view',
  });

  return {
    resetCamera: () => {
      camera.reset();
      markViewMoved();
    },

    dispose: () => {
      stopWatchingTerrain?.();
      stopWatchingObjects?.();
      stopWatchingOverlay?.();
      stopWatchingSun?.();
      canvas.removeEventListener('pointerdown', raiseInteractionFps);
      canvas.removeEventListener('pointermove', raiseInteractionFps);
      canvas.removeEventListener('wheel', raiseInteractionFps);
      camera.destroy();
      fpsController.dispose();
      stopGpuApp();
    },
  };
}

async function initSiteScene({
  canvas,
  camera,
  fpsController,
  markDirty,
  consumeDirty,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly camera: OrbitCamera;
  readonly fpsController: FpsController;
  readonly markDirty: VoidFunction;
  readonly consumeDirty: () => boolean;
}): Promise<SiteSceneGpuSession> {
  const context = await createGpuContext(canvas);
  const { device } = context;

  // Past this point the teardown is not with the caller yet, so a pipeline that
  // fails to build would leave the adapter holding a live device for good.
  try {
    let sunlight: Sunlight = INITIAL_SUNLIGHT;
    let terrainField: Heightfield | undefined;
    let shadowProjection = EMPTY_SHADOW_PROJECTION;

    const uniforms = createSceneUniforms(device);
    const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
    const depthManager = createDepthTextureManager(MSAA_SAMPLE_COUNT, DEPTH_FORMAT);
    const shadowMap = createShadowMap(device);
    const terrainLayer = new TerrainLayer(uniforms.buffer, msaaManager, depthManager, shadowMap);
    const objectsLayer = new ObjectsLayer(uniforms.buffer, msaaManager, depthManager, shadowMap);

    /** The light's box follows the ground it covers and the sun that casts it. */
    const refreshShadowProjection = (): void => {
      if (!isNil(terrainField)) {
        shadowProjection = computeShadowProjection({
          field: terrainField,
          sunDirection: sunlight.direction,
        });
      }
    };

    // Back to front: the camera and the light first, then the shadow map the lit
    // passes read, then the backdrop, the ground standing against it, and last
    // what stands on the ground.
    const layerManager = new RenderLayerManager([
      createSceneUpdateLayer({
        camera,
        uniforms,
        fpsController,
        getSunlight: () => sunlight,
        getShadowProjection: () => shadowProjection,
        markDirty,
      }),
      new ShadowLayer(shadowMap, [terrainLayer, objectsLayer], () => sunlight.intensity > 0),
      new SkyLayer(msaaManager),
      terrainLayer,
      objectsLayer,
    ]);

    layerManager.initAll(context);

    const stopRenderLoop = startRenderLoop({
      canvas,
      context,
      layerManager,
      fpsController,
      shouldRender: consumeDirty,
      onResize: () => {
        markDirty();
        fpsController.raise(FPS_RESIZE);
      },
    });

    return {
      sink: {
        applyTerrain: (terrain: SceneTerrain) => {
          terrainField = terrain.field;
          camera.setHome(computeCameraHome(terrain.field));
          terrainLayer.applyTerrain(terrain);
          refreshShadowProjection();
          markDirty();
        },
        applyObjects: (objects: SceneObjects) => {
          objectsLayer.applyObjects(objects);
          markDirty();
        },
        applyOverlay: (raster: AnalysisRaster | undefined) => {
          terrainLayer.applyOverlay(raster);
          markDirty();
        },
        applySun: (nextSunlight: Sunlight) => {
          sunlight = nextSunlight;
          refreshShadowProjection();
          markDirty();
          // The day animation moves the sun several times a second; without
          // this the governor would leave it playing at the idle frame rate.
          fpsController.raise(FPS_ANIMATION);
        },
      },

      cleanup: () => {
        stopRenderLoop();
        layerManager.dispose();
        msaaManager.dispose();
        depthManager.dispose();
        shadowMap.dispose();
        uniforms.dispose();
        device.destroy();
      },
    };
  } catch (error) {
    device.destroy();

    throw error;
  }
}

/** One reactive read of everything the ground of the scene is built from. */
function readSceneTerrain(store: SitePlannerStore): SceneTerrain {
  return {
    field: store.terrain.heightfield,
    boundaryPolygons: store.boundaryPolygons,
    coverage: store.terrain.plotCoverage,
  };
}

/** One reactive read of everything standing on that ground. */
function readSceneObjects(store: SitePlannerStore): SceneObjects {
  return {
    house: store.scene.buildingsGeometry,
    houseGhost: store.scene.buildingsGhostGeometry,
    foundations: store.scene.foundationsGeometry,
    roofOverlays: store.scene.roofOverlaysGeometry,
    furniture: store.scene.sceneFurniture,
    trees: store.scene.sceneTrees,
    cars: store.scene.sceneCars,
    pathDrape: store.scene.pathDrapeGeometry,
  };
}

/**
 * The view the camera returns to, read off the sampled terrain: the grid spans
 * the plot's bounding box, so its centre is the plot's, and the framing radius
 * is the half-diagonal of the box the terrain actually occupies — the rise of
 * the ground included, so a steep plot is not cut off at the top.
 */
function computeCameraHome(field: Heightfield): OrbitCameraHome {
  const extent: Meters = (field.resolution - 1) * field.cellSizeMeters;
  const { minElevation, maxElevation } = computeElevationRange(field);
  const center = {
    x: field.originMeters.x + extent * HALF,
    y: field.originMeters.y + extent * HALF,
  };

  return {
    target: planToWorld(center, (minElevation + maxElevation) * HALF),
    radiusMeters: Math.hypot(extent, extent, maxElevation - minElevation) * HALF,
  };
}
