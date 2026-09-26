import { isEqual } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

import type { MapView } from '../domain/map-view';
import { DEFAULT_VIEW, viewAround } from '../domain/map-view';
import type { LonLat } from '../domain/mercator';
import type { HomeStorage } from './ports/home-storage';
import type { MapViewControl } from './ports/map-view-control';
import type { PositionFailure, PositionSource } from './ports/position-source';

/** The per-frame readout the HUD shows; replaced only when a value moved. */
export interface MapStats {
  readonly zoom: number;
  readonly bearingDeg: number;
  readonly pitchDeg: number;
  readonly visibleTiles: number;
  readonly loadingTiles: number;
  readonly atlasUsed: number;
  readonly atlasCapacity: number;
  /** Encoded tiles held in the on-disk store beyond the atlas. */
  readonly cachedTiles: number;
}

const INITIAL_STATS: MapStats = {
  zoom: DEFAULT_VIEW.zoom,
  bearingDeg: DEFAULT_VIEW.bearingDeg,
  pitchDeg: DEFAULT_VIEW.pitchDeg,
  visibleTiles: 0,
  loadingTiles: 0,
  atlasUsed: 0,
  atlasCapacity: 0,
  cachedTiles: 0,
};

/**
 * Thin: the camera lives in the renderer and changes every frame, so only
 * what React shows is observable here, plus the commands the HUD sends back.
 */
export class OsmMapStore {
  stats: MapStats = INITIAL_STATS;
  /** A "where am I" request is out and unanswered. */
  locating = false;
  /** Why the last "where am I" press got no position, until the next press. */
  locateFailure: PositionFailure | undefined = undefined;
  private viewControl: MapViewControl | undefined;
  private cancelLocate: VoidFunction | undefined;
  /** Where the map opens and where "reset view" goes: the last place the user was found, else the default. */
  private homeView: MapView;

  constructor(
    private readonly requestPosition: PositionSource,
    private readonly homeStorage: HomeStorage
  ) {
    const remembered = homeStorage.read();
    this.homeView = remembered === undefined ? DEFAULT_VIEW : viewAround(remembered);
    makeAutoObservable<
      OsmMapStore,
      'viewControl' | 'cancelLocate' | 'homeView' | 'requestPosition' | 'homeStorage'
    >(
      this,
      {
        viewControl: false,
        cancelLocate: false,
        homeView: false,
        requestPosition: false,
        homeStorage: false,
      },
      { autoBind: true }
    );
  }

  get home(): MapView {
    return this.homeView;
  }

  /** The user was found here: remembered for the next visit and for "reset view". */
  setHome(position: LonLat): void {
    this.homeView = viewAround(position);
    this.homeStorage.write(position);
  }

  /** Centres the map on the user; a fresh request each press, the previous one withdrawn. */
  locate(): void {
    this.cancelLocate?.();
    this.locating = true;
    this.locateFailure = undefined;
    this.cancelLocate = this.requestPosition(
      position => {
        runInAction(() => {
          this.locating = false;
          this.setHome(position);
          this.viewControl?.moveTo(position);
        });
      },
      reason => {
        runInAction(() => {
          this.locating = false;
          this.locateFailure = reason;
        });
      }
    );
  }

  reportFrame(stats: MapStats): void {
    if (!isEqual(this.stats, stats)) {
      this.stats = stats;
    }
  }

  /** The renderer registers itself once running; the returned function detaches it. */
  attachViewControl(control: MapViewControl): VoidFunction {
    this.viewControl = control;
    return () => {
      if (this.viewControl === control) {
        this.viewControl = undefined;
      }
    };
  }

  resetView(): void {
    this.viewControl?.setView(this.homeView);
  }

  resetNorth(): void {
    this.viewControl?.resetNorth();
  }

  dispose(): void {
    this.cancelLocate?.();
    this.viewControl = undefined;
  }
}
