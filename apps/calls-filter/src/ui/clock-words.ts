import type { IClockWords } from '../texts/policy-phrase';
import { useApp } from './AppContext';

/** What a phrase needs to name a schedule's clock: the phone's zone now, and cities by zone. */
export function useClockWords(): IClockWords {
  const app = useApp();
  return { phoneZone: app.device.timeZone, city: zone => app.zoneCity(zone) };
}
