import { describe, expect, it, vi } from 'vitest';

import type { IValueCodec } from './valueStorage';
import { createValueStorage } from './valueStorage';

const STORAGE_KEY = 'test:counter';

const COUNTER_CODEC: IValueCodec<number> = {
  fallback: 0,
  parse: raw => {
    const parsed = Number(raw);

    return Number.isInteger(parsed) ? parsed : undefined;
  },
  serialize: String,
};

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

  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('storage is unavailable');
  });

  return storage;
}

describe('createValueStorage', () => {
  it('answers the fallback before anything was written', () => {
    expect(createValueStorage(STORAGE_KEY, COUNTER_CODEC, createMemoryStorage()).read()).toBe(0);
  });

  it('round-trips a value through the codec', () => {
    const storage = createMemoryStorage();
    const counter = createValueStorage(STORAGE_KEY, COUNTER_CODEC, storage);

    counter.write(42);

    expect(storage.getItem(STORAGE_KEY)).toBe('42');
    expect(counter.read()).toBe(42);
  });

  it('answers the fallback for an entry the codec rejects', () => {
    const storage = createMemoryStorage('not-a-number');

    expect(createValueStorage(STORAGE_KEY, COUNTER_CODEC, storage).read()).toBe(0);
  });

  it('leaves no trace of its availability probe', () => {
    const storage = createMemoryStorage();

    createValueStorage(STORAGE_KEY, COUNTER_CODEC, storage);

    expect(storage.length).toBe(0);
  });

  it('keeps the value for the session when web storage is unusable', () => {
    const counter = createValueStorage(STORAGE_KEY, COUNTER_CODEC, createThrowingStorage());

    expect(counter.read()).toBe(0);

    counter.write(7);

    expect(counter.read()).toBe(7);
  });
});
