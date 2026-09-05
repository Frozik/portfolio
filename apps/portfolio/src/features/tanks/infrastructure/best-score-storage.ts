import type { IValueCodec } from '@frozik/utils/storage/valueStorage';
import { createValueStorage } from '@frozik/utils/storage/valueStorage';

import type { IBestScoreStorage } from '../domain/ports/best-score-storage';

const BEST_SCORE_STORAGE_KEY = 'tanks:best-score';
const DECIMAL_RADIX = 10;
const NO_BEST_SCORE = 0;

const BEST_SCORE_CODEC: IValueCodec<number> = {
  fallback: NO_BEST_SCORE,
  parse: raw => {
    const parsed = Number.parseInt(raw, DECIMAL_RADIX);

    return Number.isFinite(parsed) && parsed > NO_BEST_SCORE ? parsed : undefined;
  },
  serialize: String,
};

export function createBestScoreStorage(storage: Storage = localStorage): IBestScoreStorage {
  return createValueStorage(BEST_SCORE_STORAGE_KEY, BEST_SCORE_CODEC, storage);
}
