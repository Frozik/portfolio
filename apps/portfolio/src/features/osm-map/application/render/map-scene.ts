import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import type { FrameState } from '@frozik/utils/webgpu/renderLayer';

import { metresPerUnitAt } from '../../domain/building-footprint';
import { selectBuildingTiles } from '../../domain/building-tile-selection';
import {
  BUILDING_RISE_SECONDS,
  FADE_IN_SECONDS,
  FPS_SAMPLE_QUIET_SECONDS,
  MAX_INSTANCES_PER_FRAME,
} from '../../domain/constants';
import type { DetailBudget } from '../../domain/detail-budget';
import { detailFactorOf, INITIAL_DETAIL_BUDGET, reportFps } from '../../domain/detail-budget';
import type { CameraGeometry, MapCameraState, Viewport } from '../../domain/map-camera';
import { cameraGeometry, viewOf } from '../../domain/map-camera';
import type { MapView } from '../../domain/map-view';
import type { TileAtlasPort } from '../../domain/ports/tile-atlas';
import type { TileStore } from '../../domain/ports/tile-store';
import { planTileInstances } from '../../domain/tile-instances';
import type { TileKey } from '../../domain/tile-key';
import { tileOrigin } from '../../domain/tile-key';
import type { SelectedTile } from '../../domain/tile-selection';
import { selectTiles } from '../../domain/tile-selection';
import type { BuildingPlacement, MapFrame } from '../../infrastructure/layers/map-frame';
import type { MapCameraController } from '../../infrastructure/map-camera-controller';
import {
  createTileInstanceData,
  writeTileInstances,
} from '../../infrastructure/tile-instance-buffer';
import type { TileLoader } from '../../infrastructure/tile-loader';
import type { MapStats } from '../OsmMapStore';

export interface MapSceneDependencies {
  readonly camera: MapCameraController;
  readonly loader: TileLoader<ImageBitmap>;
  readonly buildingLoader: TileLoader<LitMesh>;
  readonly atlas: TileAtlasPort;
  readonly store: TileStore;
  readonly onPoseChanged: (view: MapView) => void;
  readonly onStats: (stats: MapStats) => void;
}

/**
 * The per-frame pipeline: camera → visible tiles → loads → instances. It
 * hands the layer a frame only when something changed — the pose, the
 * detail budget, a tile landing or a fade still running — so an idle map
 * submits nothing.
 */
export class MapScene {
  private budget: DetailBudget = INITIAL_DETAIL_BUDGET;
  private appliedDetail = detailFactorOf(INITIAL_DETAIL_BUDGET);
  private lastCamera: MapCameraState | undefined;
  private lastViewport: Viewport = { widthPx: 0, heightPx: 0 };
  private geometry: CameraGeometry | undefined;
  private selected: readonly SelectedTile[] = [];
  private buildingTiles: readonly SelectedTile[] = [];
  /** When each building tile in the picture entered it; a tile that leaves and returns grows again. */
  private readonly buildingRises = new Map<TileKey, number>();
  private readonly instanceData = createTileInstanceData(MAX_INSTANCES_PER_FRAME);
  private loadsChanged = false;
  /** A fade or a rise ran last frame, so the next frame must be drawn to finish it. */
  private wasAnimating = false;
  private lastPoseChangeTime = Number.NEGATIVE_INFINITY;

  constructor(private readonly dependencies: MapSceneDependencies) {}

  /** Called by the loader whenever a tile lands or fails. */
  markLoadsChanged(): void {
    this.loadsChanged = true;
  }

  /**
   * The meter decays toward zero on skipped frames, so a reading counts only
   * while the camera is moving and every frame is really drawn — and only
   * while nothing is loading, since uploads and mip generation cost frames
   * that say nothing about how the device copes with drawing.
   */
  reportFrameRate(fps: number, nowSeconds: number): void {
    const moving = nowSeconds - this.lastPoseChangeTime <= FPS_SAMPLE_QUIET_SECONDS;
    if (moving && this.pendingCount === 0) {
      this.budget = reportFps(this.budget, fps);
    }
  }

  /** Whether the next frame must be drawn even though the camera is at rest. */
  get busy(): boolean {
    return (
      this.loadsChanged ||
      this.wasAnimating ||
      this.pendingCount > 0 ||
      this.nextRetryAt !== undefined
    );
  }

  private get pendingCount(): number {
    const { loader, buildingLoader } = this.dependencies;
    return loader.pendingCount + buildingLoader.pendingCount;
  }

  private get nextRetryAt(): number | undefined {
    const { loader, buildingLoader } = this.dependencies;
    const retries = [loader.nextRetryAt, buildingLoader.nextRetryAt].filter(
      retry => retry !== undefined
    );
    return retries.length === 0 ? undefined : Math.min(...retries);
  }

  advance(state: FrameState): MapFrame | undefined {
    const { camera, loader, buildingLoader, atlas, store, onPoseChanged, onStats } =
      this.dependencies;
    const cameraState = camera.tick();
    const viewport: Viewport = { widthPx: state.canvasWidth, heightPx: state.canvasHeight };
    const detail = detailFactorOf(this.budget);
    const poseChanged =
      cameraState !== this.lastCamera ||
      viewport.widthPx !== this.lastViewport.widthPx ||
      viewport.heightPx !== this.lastViewport.heightPx ||
      detail !== this.appliedDetail;

    if (poseChanged) {
      this.lastPoseChangeTime = state.time;
      this.lastCamera = cameraState;
      this.lastViewport = viewport;
      this.appliedDetail = detail;
      this.geometry = cameraGeometry(cameraState, viewport);
      this.selected = selectTiles(this.geometry, detail);
      this.buildingTiles = selectBuildingTiles(this.selected, cameraState.zoom);
      onPoseChanged(viewOf(cameraState));
    }
    // A load finishing frees a network slot for the next queued tile, and a
    // failed tile's backoff runs out, so the schedule must run at rest too,
    // not only when the camera moved.
    const retryDue = this.nextRetryAt !== undefined && state.time >= this.nextRetryAt;
    if (poseChanged || this.loadsChanged || retryDue) {
      loader.reconcile(this.selected, state.time);
      buildingLoader.reconcile(this.buildingTiles, state.time);
    }

    const fading = this.selected.some(tile => {
      const ready = loader.readyTile(tile.key);
      return ready !== undefined && state.time - ready.fadeStart < FADE_IN_SECONDS;
    });
    const standing = this.buildingTiles.filter(
      tile => buildingLoader.readyTile(tile.key) !== undefined
    );
    const rising = this.trackBuildingRises(standing, state.time);
    const animating = fading || rising;
    const changed = poseChanged || this.loadsChanged || animating || this.wasAnimating;
    this.loadsChanged = false;
    this.wasAnimating = animating;
    if (!changed || this.geometry === undefined) {
      return undefined;
    }

    const { origin, position } = this.geometry;
    const instances = planTileInstances(
      this.selected,
      {
        readyTile: key => {
          const ready = loader.readyTile(key);
          const layer = atlas.layerOf(key);
          return ready === undefined || layer === undefined
            ? undefined
            : { layer, fadeStart: ready.fadeStart };
        },
        layerOf: key => atlas.layerOf(key),
        coverage: atlas.coverage,
      },
      state.time
    );
    const instanceCount = instances.length;
    const view = viewOf(cameraState);
    writeTileInstances(this.instanceData, instances, origin);
    const buildings = standing.map((tile): BuildingPlacement => {
      const corner = tileOrigin(tile.coord);
      return {
        key: tile.key,
        offsetX: corner.x - origin.x,
        offsetZ: corner.y - origin.y,
        scale: 1 / metresPerUnitAt(tile.coord),
        riseStart: this.buildingRises.get(tile.key) ?? state.time,
      };
    });
    onStats({
      zoom: view.zoom,
      bearingDeg: view.bearingDeg,
      pitchDeg: view.pitchDeg,
      visibleTiles: this.selected.length,
      loadingTiles: loader.pendingCount,
      atlasUsed: atlas.usedCount,
      atlasCapacity: atlas.capacity,
      cachedTiles: store.count,
      buildingTiles: buildings.length,
      loadingBuildingTiles: buildingLoader.pendingCount,
    });
    return {
      viewProjection: this.geometry.viewProjection,
      cameraPosition: { x: position.x - origin.x, y: position.y, z: position.z - origin.y },
      fogStart: this.geometry.fogStart,
      fogEnd: this.geometry.fogEnd,
      time: state.time,
      instanceData: this.instanceData,
      instanceCount,
      buildings,
    };
  }

  /** Stamps newcomers with now, forgets leavers, and says whether any tile is still growing. */
  private trackBuildingRises(standing: readonly SelectedTile[], nowSeconds: number): boolean {
    const standingKeys = new Set(standing.map(tile => tile.key));
    for (const key of this.buildingRises.keys()) {
      if (!standingKeys.has(key)) {
        this.buildingRises.delete(key);
      }
    }
    let rising = false;
    for (const key of standingKeys) {
      const riseStart = this.buildingRises.get(key) ?? nowSeconds;
      this.buildingRises.set(key, riseStart);
      rising ||= nowSeconds - riseStart < BUILDING_RISE_SECONDS;
    }
    return rising;
  }
}
