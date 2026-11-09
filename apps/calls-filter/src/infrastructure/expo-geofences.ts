import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { IGeofences } from '../contexts/places/domain/ports/geofences';
import type { IPlaceRule } from '../contexts/policy/domain/place-rule';
import { distanceMeters } from '../contexts/policy/domain/place-rule';
import { positionNow } from './position-now';

const GEOFENCE_TASK = 'calls-filter-places';

interface IGeofenceEvent {
  readonly eventType: Location.GeofencingEventType;
  readonly region: Location.LocationRegion;
}

/**
 * Android wakes the app on every crossing, even when it is closed; the verdict goes straight to
 * the screening service, which reads it when a call comes.
 */
TaskManager.defineTask<IGeofenceEvent>(GEOFENCE_TASK, ({ data, error }) => {
  if (error !== null || data.region.identifier === undefined) {
    return Promise.resolve();
  }
  CALL_SCREENING.setAtPlace(
    data.region.identifier,
    data.eventType === Location.GeofencingEventType.Enter
  );
  return Promise.resolve();
});

const FRESH_POSITION_MS = 120_000;

/**
 * Where each place stands right now. A geofence crossing can lag minutes behind the phone, so the
 * app measures again whenever it starts or comes to the front.
 */
async function settleFromHere(places: readonly IPlaceRule[], diagnostics: IDiagnosticsLog) {
  if (places.length === 0 || !(await Location.getForegroundPermissionsAsync()).granted) {
    return;
  }
  const here = await positionNow(Location.Accuracy.Balanced, FRESH_POSITION_MS);
  if (here === null) {
    diagnostics.log('warn', 'background', 'places-position-unknown');
    return;
  }
  for (const place of places) {
    CALL_SCREENING.setAtPlace(place.id, distanceMeters(here, place) <= place.radius);
  }
  diagnostics.log('info', 'background', 'places-settled', { places: String(places.length) });
}

export function expoGeofences(diagnostics: IDiagnosticsLog): IGeofences {
  return {
    async watch(places) {
      const watched = new Set<string>(places.map(place => place.id));
      for (const known of CALL_SCREENING.knownPlaces()) {
        if (!watched.has(known)) {
          CALL_SCREENING.setAtPlace(known, null);
        }
      }
      // Without location all the time even asking whether geofencing runs is refused.
      const background = await Location.getBackgroundPermissionsAsync();
      if (places.length === 0) {
        if (background.granted && (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
        }
        return;
      }
      if (!background.granted) {
        diagnostics.log('warn', 'permissions', 'places-without-background-location');
        return;
      }
      await Location.startGeofencingAsync(
        GEOFENCE_TASK,
        places.map(place => ({
          identifier: place.id,
          latitude: place.latitude,
          longitude: place.longitude,
          radius: place.radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        }))
      );
      await settleFromHere(places, diagnostics);
    },
    settle: places => settleFromHere(places, diagnostics),
    atPlace: place => CALL_SCREENING.atPlace(place),
  };
}
