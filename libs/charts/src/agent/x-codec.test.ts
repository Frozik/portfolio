import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { numberCodec, timeCodec } from './x-codec';

describe('timeCodec', () => {
  const codec = timeCodec('Europe/Moscow');

  it('reads ISO date-times in its zone and prints them back the same way', () => {
    const position = codec.parse('2026-03-14T15:30');

    expect(position).toBe(
      Temporal.ZonedDateTime.from('2026-03-14T15:30[Europe/Moscow]').epochNanoseconds
    );
    expect(codec.print(position ?? 0n)).toBe('2026-03-14T15:30:00');
  });

  it('reads an instant with an offset in its own zone', () => {
    expect(codec.print(codec.parse('2026-03-14T12:30:00Z') ?? 0n)).toBe('2026-03-14T15:30:00');
  });

  it('refuses text that names no moment', () => {
    expect(codec.parse('whenever')).toBeUndefined();
  });
});

describe('numberCodec', () => {
  it('reads finite numbers only', () => {
    expect(numberCodec.parse(' 12.5 ')).toBe(12.5);
    expect(numberCodec.parse('')).toBeUndefined();
    expect(numberCodec.parse('Infinity')).toBeUndefined();
  });
});
