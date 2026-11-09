import * as Location from 'expo-location';

import type { TCurrentPoint } from '../contexts/places/domain/ports/geofences';
import { positionNow } from './position-now';

/** A minute-old position answers «Where I am» at once; a new fix can take seconds outdoors. */
const RECENT_ENOUGH_MS = 60_000;

/** The phone's position now, when the location permission allows it and a fix comes in time. */
export const EXPO_CURRENT_POINT: TCurrentPoint = async () => {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  return positionNow(Location.Accuracy.High, RECENT_ENOUGH_MS);
};
