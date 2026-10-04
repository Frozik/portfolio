import { describe, expect, it } from 'vitest';

import { RingBuffer } from './ring-buffer';

interface ILine {
  readonly text: string;
  readonly count: number;
}

function createBuffer(options: { maxEntries?: number; maxBytes?: number } = {}) {
  return new RingBuffer<ILine>({
    maxEntries: options.maxEntries ?? 100,
    maxBytes: options.maxBytes ?? 10_000,
    sizeOf: line => line.text.length,
    coalesce: (last, next) =>
      last.text === next.text ? { ...last, count: last.count + next.count } : undefined,
  });
}

describe('RingBuffer', () => {
  it('drops the oldest entries once the count limit is exceeded', () => {
    const buffer = createBuffer({ maxEntries: 2 });
    buffer.push({ text: 'a', count: 1 });
    buffer.push({ text: 'b', count: 1 });
    buffer.push({ text: 'c', count: 1 });

    expect(buffer.toArray().map(line => line.text)).toEqual(['b', 'c']);
  });

  it('drops the oldest entries once the byte budget is exceeded', () => {
    const buffer = createBuffer({ maxBytes: 5 });
    buffer.push({ text: 'aaa', count: 1 });
    buffer.push({ text: 'bb', count: 1 });
    buffer.push({ text: 'c', count: 1 });

    expect(buffer.toArray().map(line => line.text)).toEqual(['bb', 'c']);
  });

  it('keeps a single entry even when it alone exceeds the byte budget', () => {
    const buffer = createBuffer({ maxBytes: 2 });
    buffer.push({ text: 'oversized', count: 1 });

    expect(buffer.size).toBe(1);
  });

  it('folds a repeated line into the previous entry instead of taking a slot', () => {
    const buffer = createBuffer({ maxEntries: 2 });
    buffer.push({ text: 'same', count: 1 });
    buffer.push({ text: 'same', count: 1 });
    buffer.push({ text: 'same', count: 1 });

    expect(buffer.toArray()).toEqual([{ text: 'same', count: 3 }]);
  });

  it('returns a copy, so callers cannot mutate the history', () => {
    const buffer = createBuffer();
    buffer.push({ text: 'a', count: 1 });
    const snapshot = buffer.toArray();
    buffer.push({ text: 'b', count: 1 });

    expect(snapshot).toHaveLength(1);
  });

  it('starts over after clear', () => {
    const buffer = createBuffer({ maxBytes: 3 });
    buffer.push({ text: 'abc', count: 1 });
    buffer.clear();
    buffer.push({ text: 'de', count: 1 });
    buffer.push({ text: 'f', count: 1 });

    expect(buffer.toArray().map(line => line.text)).toEqual(['de', 'f']);
  });
});
