import { adb } from '@frozik/tooling/src/android-e2e/device.ts';

/** Play services builds the phone's position from these two; a test provider answers at once. */
const PROVIDERS = ['gps', 'network'] as const;

export const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041 } as const;
export const NEW_YORK = { latitude: 40.7484, longitude: -73.9857 } as const;

/** Puts the phone where a test needs it: what the app asks for next is answered from here. */
export async function phoneAt(point: { readonly latitude: number; readonly longitude: number }) {
  for (const provider of PROVIDERS) {
    await adb(
      'shell',
      'cmd',
      'location',
      'providers',
      'set-test-provider-location',
      provider,
      '--location',
      `${point.latitude},${point.longitude}`
    );
  }
}
