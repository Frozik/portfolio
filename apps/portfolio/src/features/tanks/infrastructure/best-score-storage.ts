import { isNil } from 'lodash-es';

/** §10: the campaign's best score is the one thing that survives a reload. */
const BEST_SCORE_STORAGE_KEY = 'tanks:best-score';
const DECIMAL_RADIX = 10;
const NO_BEST_SCORE = 0;

export interface IBestScoreStorage {
  read(): number;
  write(score: number): void;
}

function parseBestScore(raw: string): number {
  const parsed = Number.parseInt(raw, DECIMAL_RADIX);

  return Number.isFinite(parsed) && parsed > NO_BEST_SCORE ? parsed : NO_BEST_SCORE;
}

/** Web storage throws in hardened profiles — every failure degrades to "no best score yet". */
export function createBestScoreStorage(storage: Storage = localStorage): IBestScoreStorage {
  return {
    read(): number {
      try {
        const raw = storage.getItem(BEST_SCORE_STORAGE_KEY);

        return isNil(raw) ? NO_BEST_SCORE : parseBestScore(raw);
      } catch {
        return NO_BEST_SCORE;
      }
    },

    write(score: number): void {
      try {
        storage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
      } catch {
        // A high score that cannot be stored is not worth interrupting the game for.
      }
    },
  };
}
