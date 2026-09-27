import { appendChunk, farEndTime, freshestTime, inDisplayOrder, insertLive } from './log-lanes';

type TEvent = { readonly id: string; readonly at: string };

const event = (id: string, at: string): TEvent => ({ id, at });
const keyOf = (row: TEvent): string => row.id;
const time = (row: TEvent): string => row.at;

describe('log lanes', () => {
  it('orders newest first for backward and oldest first for forward', () => {
    const rows = [event('b', '2026-01-02'), event('a', '2026-01-01')];
    expect(inDisplayOrder(rows, time, 'forward').map(keyOf)).toEqual(['a', 'b']);
    expect(inDisplayOrder(rows, time, 'backward').map(keyOf)).toEqual(['b', 'a']);
  });

  it('appends history without duplicates and inserts live rows at the fresh edge', () => {
    const lane = [event('c', '2026-01-03'), event('b', '2026-01-02')];
    expect(
      appendChunk(lane, [event('b', '2026-01-02'), event('a', '2026-01-01')], keyOf).map(keyOf)
    ).toEqual(['c', 'b', 'a']);
    expect(
      insertLive(
        lane,
        [event('d', '2026-01-04'), event('c', '2026-01-03')],
        keyOf,
        time,
        'backward'
      ).map(keyOf)
    ).toEqual(['d', 'c', 'b']);
    expect(freshestTime(lane, time, 'backward')).toBe('2026-01-03');
    expect(farEndTime(lane, time)).toBe('2026-01-02');
    expect(farEndTime([event('a', '2026-01-01'), event('b', '2026-01-02')], time)).toBe(
      '2026-01-02'
    );
  });
});
