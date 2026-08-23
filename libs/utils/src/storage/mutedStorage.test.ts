import { describe, expect, it, vi } from 'vitest';

import { createMutedStorage } from './mutedStorage';

const STORAGE_KEY = 'test-game:muted';

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

describe('createMutedStorage', () => {
  it('plays with sound on for a first-time visitor', () => {
    expect(createMutedStorage(STORAGE_KEY, createMemoryStorage()).read()).toBe(false);
  });

  it('round-trips a muted preference', () => {
    const storage = createMemoryStorage();
    const mutedStorage = createMutedStorage(STORAGE_KEY, storage);

    mutedStorage.write(true);

    expect(storage.getItem(STORAGE_KEY)).toBe('true');
    expect(mutedStorage.read()).toBe(true);
  });

  it('round-trips unmuting again', () => {
    const mutedStorage = createMutedStorage(STORAGE_KEY, createMemoryStorage('true'));

    expect(mutedStorage.read()).toBe(true);

    mutedStorage.write(false);

    expect(mutedStorage.read()).toBe(false);
  });

  it('ignores an entry in a shape we never write', () => {
    expect(createMutedStorage(STORAGE_KEY, createMemoryStorage('{"muted":true}')).read()).toBe(
      false
    );
  });

  it('survives storage that refuses to read', () => {
    expect(createMutedStorage(STORAGE_KEY, createThrowingStorage()).read()).toBe(false);
  });

  it('survives storage that refuses to write', () => {
    expect(() =>
      createMutedStorage(STORAGE_KEY, createThrowingStorage()).write(true)
    ).not.toThrow();
  });
});
