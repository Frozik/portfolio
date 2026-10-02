import type { FrameState } from '@frozik/utils/webgpu/renderLayer';

import {
  BUILDING_RISE_SECONDS,
  BUILDINGS_HIDE_ZOOM,
  BUILDINGS_MIN_ZOOM,
  CARS_HIDE_ZOOM,
  CARS_MIN_ZOOM,
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
import type { StreetTile } from '../../domain/street-tile';
import { selectStreetTiles } from '../../domain/street-tile-selection';
import { metresPerUnitAt } from '../../domain/tile-grid';
import { planTileInstances } from '../../domain/tile-instances';
import type { TileKey } from '../../domain/tile-key';
import { tileOrigin } from '../../domain/tile-key';
import type { SelectedTile } from '../../domain/tile-selection';
import { selectTiles } from '../../domain/tile-selection';
import type {
  CarInstance,
  MapFrame,
  StreetTilePlacement,
} from '../../infrastructure/layers/map-frame';
import type { MapCameraController } from '../../infrastructure/map-camera-controller';
import {
  createTileInstanceData,
  writeTileInstances,
} from '../../infrastructure/tile-instance-buffer';
import type { TileLoader } from '../../infrastructure/tile-loader';
import type { StreetTraffic } from './street-traffic';

export interface MapSceneDependencies {
  readonly camera: MapCameraController;
  readonly loader: TileLoader<ImageBitmap>;
  readonly streetLoader: TileLoader<StreetTile>;
  readonly traffic: StreetTraffic;
  /** Whether a standing street tile has water to ripple, which keeps the frames coming. */
  readonly hasWater: (key: TileKey) => boolean;
  readonly atlas: TileAtlasPort;
  readonly onPoseChanged: (view: MapView) => void;
  readonly onBearing: (bearingDeg: number) => void;
  /** Whether any tile — raster or street — is still on its way. */
  readonly onLoading: (loading: boolean) => void;
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
  private streetTiles: readonly SelectedTile[] = [];
  /**
   * One decision for the whole picture, with a gap between showing and hiding
   * so the threshold never flickers. Both start shown: a map opened inside
   * the gap — a reload, a shared link — keeps what was on screen.
   */
  private buildingsShown = true;
  private carsShown = true;
  private wavesInView = false;
  /** When each street tile first stood while buildings were shown; kept until they are hidden, so a tile blinking at the edge never regrows. */
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

  /** Cars on the move or water rippling: frames keep coming, at the animation rate rather than the interaction rate. */
  get animatedAtRest(): boolean {
    return this.dependencies.traffic.moving || this.wavesInView;
  }

  private get pendingCount(): number {
    const { loader, streetLoader } = this.dependencies;
    return loader.pendingCount + streetLoader.pendingCount;
  }

  private get nextRetryAt(): number | undefined {
    const { loader, streetLoader } = this.dependencies;
    const retries = [loader.nextRetryAt, streetLoader.nextRetryAt].filter(
      retry => retry !== undefined
    );
    return retries.length === 0 ? undefined : Math.min(...retries);
  }

  advance(state: FrameState): MapFrame | undefined {
    const {
      camera,
      loader,
      streetLoader,
      traffic,
      hasWater,
      atlas,
      onPoseChanged,
      onBearing,
      onLoading,
    } = this.dependencies;
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
      this.buildingsShown = shown(
        cameraState.zoom,
        this.buildingsShown,
        BUILDINGS_MIN_ZOOM,
        BUILDINGS_HIDE_ZOOM
      );
      this.carsShown = shown(cameraState.zoom, this.carsShown, CARS_MIN_ZOOM, CARS_HIDE_ZOOM);
      this.streetTiles = this.buildingsShown
        ? selectStreetTiles(this.selected, cameraState.target)
        : [];
      if (!this.buildingsShown) {
        this.buildingRises.clear();
      }
      const view = viewOf(cameraState);
      onPoseChanged(view);
      onBearing(view.bearingDeg);
    }
    // A load finishing frees a network slot for the next queued tile, and a
    // failed tile's backoff runs out, so the schedule must run at rest too,
    // not only when the camera moved.
    const retryDue = this.nextRetryAt !== undefined && state.time >= this.nextRetryAt;
    if (poseChanged || this.loadsChanged || retryDue) {
      loader.reconcile(this.selected, state.time);
      streetLoader.reconcile(this.streetTiles, state.time);
    }
    onLoading(this.pendingCount > 0);

    const fading = this.selected.some(tile => {
      const ready = loader.readyTile(tile.key);
      return ready !== undefined && state.time - ready.fadeStart < FADE_IN_SECONDS;
    });
    const standing = this.streetTiles.filter(
      tile => streetLoader.readyTile(tile.key) !== undefined
    );
    const rising = this.trackBuildingRises(standing, state.time);
    if (this.carsShown) {
      traffic.step(
        standing.map(tile => tile.key),
        state.time
      );
    } else {
      traffic.pause();
    }
    this.wavesInView = standing.some(tile => hasWater(tile.key));
    const animating = fading || rising || traffic.moving || this.wavesInView;
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
    writeTileInstances(this.instanceData, instances, origin);
    const streetTiles = standing.map((tile): StreetTilePlacement => {
      const corner = tileOrigin(tile.coord);
      return {
        key: tile.key,
        offsetX: corner.x - origin.x,
        offsetZ: corner.y - origin.y,
        scale: 1 / metresPerUnitAt(tile.coord),
        riseStart: this.buildingRises.get(tile.key) ?? state.time,
      };
    });
    const placementOf = new Map(streetTiles.map((placement, index) => [placement.key, index]));
    const cars = traffic.poses().flatMap((pose): CarInstance[] => {
      const placementIndex = placementOf.get(pose.tileKey);
      return placementIndex === undefined ? [] : [{ ...pose, placementIndex }];
    });
    return {
      viewProjection: this.geometry.viewProjection,
      origin,
      cameraPosition: { x: position.x - origin.x, y: position.y, z: position.z - origin.y },
      fogStart: this.geometry.fogStart,
      fogEnd: this.geometry.fogEnd,
      time: state.time,
      instanceData: this.instanceData,
      instanceCount,
      streetTiles,
      cars,
    };
  }

  /** Stamps newcomers with now and says whether any standing tile is still growing. */
  private trackBuildingRises(standing: readonly SelectedTile[], nowSeconds: number): boolean {
    let rising = false;
    for (const { key } of standing) {
      const riseStart = this.buildingRises.get(key) ?? nowSeconds;
      this.buildingRises.set(key, riseStart);
      rising ||= nowSeconds - riseStart < BUILDING_RISE_SECONDS;
    }
    return rising;
  }
}

/** Shows past `showAt`, hides only below `hideAt`; in between, whatever it was. */
function shown(zoom: number, wasShown: boolean, showAt: number, hideAt: number): boolean {
  return zoom >= showAt || (wasShown && zoom >= hideAt);
}
