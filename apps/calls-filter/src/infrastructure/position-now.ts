import * as Location from 'expo-location';

import type { IPoint } from '../contexts/policy/domain/place-rule';

/**
 * Android waits for a fix as long as it takes; with location off, indoors, or on an emulator no
 * app asks for GPS, that is never. Past this the answer is «unknown», and what depends on it moves on.
 */
const POSITION_TIMEOUT_MS = 20_000;

/** The phone's position: a recent enough one it already has, else a new fix — or `null`. */
export async function positionNow(
  accuracy: Location.Accuracy,
  freshEnoughMs: number
): Promise<IPoint | null> {
  const known = await Location.getLastKnownPositionAsync({ maxAge: freshEnoughMs });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
  });
  try {
    const position =
      known ?? (await Promise.race([Location.getCurrentPositionAsync({ accuracy }), timedOut]));
    return position === null
      ? null
      : { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } finally {
    clearTimeout(timer);
  }
}
