import { describe, expect, test } from 'vitest';

import { TimestampedEventBuffer } from './timestamped-event-buffer';
import type { UnixTimeMs } from './types';

interface IFakeEvent {
  readonly timestampMs: UnixTimeMs;
  readonly label: string;
}

function event(timestampMs: number, label: string): IFakeEvent {
  return { timestampMs: timestampMs as UnixTimeMs, label };
}

describe('TimestampedEventBuffer', () => {
  test('drains events within half-open window and keeps future events', () => {
    const buffer = new TimestampedEventBuffer<IFakeEvent>();
    buffer.enqueue(event(900, 'old-discard'));
    buffer.enqueue(event(1000, 'in-a'));
    buffer.enqueue(event(1500, 'in-b'));
    buffer.enqueue(event(2000, 'boundary-excluded'));
    buffer.enqueue(event(2500, 'future'));

    const drained = buffer.drain(1000 as UnixTimeMs, 2000 as UnixTimeMs);

    expect(drained.map(item => item.label)).toEqual(['in-a', 'in-b']);
    expect(buffer.size).toBe(2);
  });

  test('drops stale events (older than `fromMs`) silently', () => {
    const buffer = new TimestampedEventBuffer<IFakeEvent>();
    buffer.enqueue(event(500, 'stale'));
    buffer.enqueue(event(1200, 'in'));

    const drained = buffer.drain(1000 as UnixTimeMs, 2000 as UnixTimeMs);

    expect(drained.map(item => item.label)).toEqual(['in']);
    expect(buffer.size).toBe(0);
  });

  test('returns empty array when no events fall into window', () => {
    const buffer = new TimestampedEventBuffer<IFakeEvent>();
    buffer.enqueue(event(2500, 'future'));

    const drained = buffer.drain(1000 as UnixTimeMs, 2000 as UnixTimeMs);
    expect(drained).toEqual([]);
    expect(buffer.size).toBe(1);
  });

  test('clear wipes all buffered events', () => {
    const buffer = new TimestampedEventBuffer<IFakeEvent>();
    buffer.enqueue(event(1000, 'a'));
    buffer.enqueue(event(2000, 'b'));
    buffer.clear();
    expect(buffer.size).toBe(0);
  });
});
