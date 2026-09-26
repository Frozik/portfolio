import { makeAutoObservable, runInAction } from 'mobx';

import type { MapView } from '../domain/map-view';
import { DEFAULT_VIEW, viewAround } from '../domain/map-view';
import type { LonLat } from '../domain/mercator';
import type { HomeStorage } from './ports/home-storage';
import type { MapViewControl } from './ports/map-view-control';
import type { PositionFailure, PositionSource } from './ports/position-source';

/**
 * Thin: the camera lives in the renderer and changes every frame, so only
 * what React shows is observable here — the bearing for the compass, the
 * state of a "where am I" request — plus the commands the buttons send back.
 */
export class OsmMapStore {
  /** Where north is, for the compass; written by the renderer only when it moved. */
  bearingDeg = DEFAULT_VIEW.bearingDeg;
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

  /** The user was found here: remembered for the next visit. */
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

  reportBearing(bearingDeg: number): void {
    if (this.bearingDeg !== bearingDeg) {
      this.bearingDeg = bearingDeg;
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

  resetNorth(): void {
    this.viewControl?.resetNorth();
  }

  dispose(): void {
    this.cancelLocate?.();
    this.viewControl = undefined;
  }
}
