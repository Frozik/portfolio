import { describe, expect, it, vi } from 'vitest';

import { createBestScoreStorage } from './best-score-storage';

const STORAGE_KEY = 'tanks:best-score';

function createMemoryStorage(initialValue?: string): Storage {
  const entries = new Map<string, string>();

  if (initialValue !== undefined) {
    entries.set(STORAGE_KEY, initialValue);
  }

  return {
    get length(): number {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  };
}

function createThrowingStorage(): Storage {
  const storage = createMemoryStorage();

  vi.spyOn(storage, 'getItem').mockImplementation(() => {
    throw new Error('storage is unavailable');
  });
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('storage is unavailable');
  });

  return storage;
}

describe('createBestScoreStorage', () => {
  it('reports no best score on a first visit', () => {
    expect(createBestScoreStorage(createMemoryStorage()).read()).toBe(0);
  });

  it('round-trips a stored score', () => {
    const storage = createMemoryStorage();
    const bestScoreStorage = createBestScoreStorage(storage);

    bestScoreStorage.write(24_800);

    expect(storage.getItem(STORAGE_KEY)).toBe('24800');
    expect(bestScoreStorage.read()).toBe(24_800);
  });

  it('ignores an entry another tab left in a shape we do not write', () => {
    expect(createBestScoreStorage(createMemoryStorage('{"score":10}')).read()).toBe(0);
  });

  it('ignores a negative stored score', () => {
    expect(createBestScoreStorage(createMemoryStorage('-500')).read()).toBe(0);
  });

  it('survives storage that refuses to read', () => {
    expect(createBestScoreStorage(createThrowingStorage()).read()).toBe(0);
  });

  it('survives storage that refuses to write', () => {
    const bestScoreStorage = createBestScoreStorage(createThrowingStorage());

    expect(() => bestScoreStorage.write(1000)).not.toThrow();
  });
});
