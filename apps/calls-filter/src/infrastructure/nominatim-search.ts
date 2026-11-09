import Constants from 'expo-constants';
import { z } from 'zod';

import type { TSearchAddress } from '../contexts/places/domain/ports/geofences';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const RESULTS = 5;
const FOUND = z.array(z.object({ display_name: z.string(), lat: z.string(), lon: z.string() }));

/**
 * OpenStreetMap's Nominatim, by its usage policy: the app names itself in the User-Agent and
 * asks once per «Search», never per keystroke.
 */
export function nominatimSearch(language: () => string): TSearchAddress {
  const agent = `CallsFilter/${Constants.expoConfig?.version ?? 'dev'} (+https://github.com/Frozik/portfolio)`;
  return async query => {
    const url = `${NOMINATIM}?format=jsonv2&limit=${RESULTS}&accept-language=${encodeURIComponent(language())}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { 'User-Agent': agent } });
    if (!response.ok) {
      return [];
    }
    const found = FOUND.safeParse(await response.json());
    return found.success
      ? found.data.map(item => ({
          label: item.display_name,
          point: { latitude: Number(item.lat), longitude: Number(item.lon) },
        }))
      : [];
  };
}
