import type { IValueCodec } from '@frozik/utils/storage/valueStorage';
import { createValueStorage } from '@frozik/utils/storage/valueStorage';
import { isNil } from 'lodash-es';

import type { HomeStorage } from '../application/ports/home-storage';
import type { LonLat } from '../domain/mercator';
import { MAX_LATITUDE } from '../domain/mercator';

const STORAGE_KEY = 'osm-map:home';
const MAX_LONGITUDE = 180;

function isLonLat(value: unknown): value is LonLat {
  if (isNil(value) || typeof value !== 'object') {
    return false;
  }
  const { lat, lon } = value as Partial<Record<keyof LonLat, unknown>>;
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Math.abs(lat) <= MAX_LATITUDE &&
    Math.abs(lon) <= MAX_LONGITUDE
  );
}

const HOME_CODEC: IValueCodec<LonLat | undefined> = {
  fallback: undefined,
  parse: raw => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isLonLat(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  },
  serialize: value => JSON.stringify(value),
};

export function createHomeStorage(storage: Storage = localStorage): HomeStorage {
  const value = createValueStorage(STORAGE_KEY, HOME_CODEC, storage);
  return {
    read: () => value.read(),
    write: position => value.write(position),
  };
}
