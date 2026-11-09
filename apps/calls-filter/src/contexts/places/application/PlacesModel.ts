import { uniqBy } from 'lodash-es';
import { action, makeObservable, observableRef, reaction } from 'mobx';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { IPlaceRule, TPlaceId } from '../../policy/domain/place-rule';
import type { IGeofences, TCurrentPoint, TSearchAddress } from '../domain/ports/geofences';

export interface IPlacesPorts {
  readonly geofences: IGeofences;
  readonly searchAddress: TSearchAddress;
  readonly currentPoint: TCurrentPoint;
  readonly diagnostics: IDiagnosticsLog;
}

/** A place's identity for its geofence: moving or resizing it is a different fence. */
const fenceKey = (place: IPlaceRule) =>
  `${place.id}@${place.latitude},${place.longitude}/${place.radius}`;

/** The places the groups use, watched by geofences; their states as the screens show them. */
export class PlacesModel {
  states: ReadonlyMap<TPlaceId, boolean | null> = new Map();
  /** One measurement at a time, in the order asked: a later answer never lands under an older one. */
  private measuring: Promise<void> = Promise.resolve();

  constructor(
    private readonly ports: IPlacesPorts,
    private readonly places: () => readonly IPlaceRule[],
    /** Android keeps geofences only for an app allowed location all the time. */
    private readonly backgroundAllowed: () => boolean
  ) {
    makeObservable(this, { states: observableRef, refresh: action });
  }

  /**
   * Re-registers the geofences whenever the set of places changes, and once location is allowed
   * all the time — a registration without it is refused; returns the stop.
   */
  follow(): () => void {
    return reaction(
      () => ({ places: uniqBy(this.places(), fenceKey), allowed: this.backgroundAllowed() }),
      ({ places }) => {
        void this.measure(async () => {
          try {
            await this.ports.geofences.watch(places);
          } catch (error: unknown) {
            this.failed('geofences-failed', error);
          }
        });
      },
      {
        fireImmediately: true,
        equals: (left, right) =>
          left.allowed === right.allowed &&
          left.places.map(fenceKey).join() === right.places.map(fenceKey).join(),
      }
    );
  }

  /** Where the phone is now, measured again: a geofence's crossing can be minutes late. */
  settle(): Promise<void> {
    return this.measure(async () => {
      try {
        await this.ports.geofences.settle(uniqBy(this.places(), fenceKey));
      } catch (error: unknown) {
        this.failed('places-settle-failed', error);
      }
    });
  }

  /** Resolves once every measurement asked for so far has landed. */
  whenSettled(): Promise<void> {
    return this.measuring;
  }

  private measure(work: () => Promise<void>): Promise<void> {
    this.measuring = this.measuring.then(work).then(() => this.refresh());
    return this.measuring;
  }

  refresh(): void {
    this.states = new Map(
      this.places().map(place => [place.id, this.ports.geofences.atPlace(place.id)])
    );
  }

  atPlace(place: TPlaceId): boolean | null {
    return this.states.get(place) ?? null;
  }

  search(query: string) {
    return this.ports.searchAddress(query);
  }

  here() {
    return this.ports.currentPoint();
  }

  private failed(event: string, error: unknown): void {
    this.ports.diagnostics.log('error', 'background', event, { error: String(error) });
  }
}
