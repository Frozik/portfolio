import { FAILED_RETRY_SECONDS, MAX_CONCURRENT_LOADS } from './constants';
import { tileKeyOf } from './tile-key';
import type { TileSchedule } from './tile-schedule';
import {
  countLoading,
  earliestRetry,
  EMPTY_SCHEDULE,
  markFailed,
  markReady,
  reconcileSchedule,
  statusOf,
} from './tile-schedule';
import type { SelectedTile } from './tile-selection';

function tile(x: number, screenDistancePx: number): SelectedTile {
  const coord = { z: 5, x, y: 0 };
  return { key: tileKeyOf(coord), coord, edgePx: 300, screenDistancePx };
}

/** `count` tiles ordered from the screen centre outwards. */
function tiles(count: number): SelectedTile[] {
  return Array.from({ length: count }, (_, index) => tile(index, index * 10));
}

const STORED = (): boolean => true;
const EVICTED = (): boolean => false;

describe('tile schedule', () => {
  it('starts the tiles nearest the screen centre first and queues the rest behind the concurrency cap', () => {
    const selected = tiles(MAX_CONCURRENT_LOADS + 3);

    const { schedule, start } = reconcileSchedule(EMPTY_SCHEDULE, selected.toReversed(), 0, STORED);

    expect(start).toEqual(selected.slice(0, MAX_CONCURRENT_LOADS).map(item => item.key));
    expect(statusOf(schedule, selected[MAX_CONCURRENT_LOADS].key)?.kind).toBe('queued');
    expect(countLoading(schedule)).toBe(selected.length);
  });

  it('lets loads finish after their tiles left the view but forgets queued ones', () => {
    const selected = tiles(MAX_CONCURRENT_LOADS + 1);
    const first = reconcileSchedule(EMPTY_SCHEDULE, selected, 0, STORED);

    const { schedule, start, abort } = reconcileSchedule(first.schedule, [selected[0]], 1, STORED);

    expect(abort).toEqual([]);
    expect(start).toEqual([]);
    expect(countLoading(schedule)).toBe(MAX_CONCURRENT_LOADS);
    expect(statusOf(schedule, selected[MAX_CONCURRENT_LOADS].key)).toBeUndefined();
  });

  it('gives the slots of out-of-view loads to tiles in view, nearest the centre first', () => {
    const initial = tiles(MAX_CONCURRENT_LOADS);
    const first = reconcileSchedule(EMPTY_SCHEDULE, initial, 0, STORED);
    const arrived = [tile(20, 5), tile(21, 50)];

    const { schedule, start, abort } = reconcileSchedule(
      first.schedule,
      [initial[0], ...arrived],
      1,
      STORED
    );

    expect(start).toEqual([arrived[0].key, arrived[1].key]);
    expect(abort).toHaveLength(2);
    expect(abort.every(key => initial.slice(1).some(item => item.key === key))).toBe(true);
    expect(countLoading(schedule)).toBe(MAX_CONCURRENT_LOADS);
    expect(statusOf(schedule, initial[0].key)?.kind).toBe('loading');
  });

  it('queues a tile in view once no out-of-view load is left to give up', () => {
    const initial = tiles(MAX_CONCURRENT_LOADS);
    const first = reconcileSchedule(EMPTY_SCHEDULE, initial, 0, STORED);
    const arrived = tiles(MAX_CONCURRENT_LOADS + 1).slice(MAX_CONCURRENT_LOADS);

    const { schedule, start } = reconcileSchedule(
      first.schedule,
      [...initial, ...arrived],
      1,
      STORED
    );

    expect(start).toEqual([]);
    expect(statusOf(schedule, arrived[0].key)?.kind).toBe('queued');
  });

  it('keeps ready tiles even when they leave the view', () => {
    const [only] = tiles(1);
    let schedule: TileSchedule = reconcileSchedule(EMPTY_SCHEDULE, [only], 0, STORED).schedule;
    schedule = markReady(schedule, only.key, 0.5);

    schedule = reconcileSchedule(schedule, [], 1, STORED).schedule;

    expect(statusOf(schedule, only.key)).toEqual({ kind: 'ready', fadeStart: 0.5 });
  });

  it('retries a failed tile after its backoff and forgets one that left the view by then', () => {
    const [only] = tiles(1);
    let schedule: TileSchedule = reconcileSchedule(EMPTY_SCHEDULE, [only], 0, STORED).schedule;
    schedule = markFailed(schedule, only.key, 0);

    const tooEarly = reconcileSchedule(schedule, [only], FAILED_RETRY_SECONDS / 2, STORED);
    const lateEnough = reconcileSchedule(schedule, [only], FAILED_RETRY_SECONDS, STORED);
    const unwantedEarly = reconcileSchedule(schedule, [], FAILED_RETRY_SECONDS / 2, STORED);
    const unwantedLate = reconcileSchedule(schedule, [], FAILED_RETRY_SECONDS, STORED);

    expect(earliestRetry(schedule)).toBe(FAILED_RETRY_SECONDS);
    expect(earliestRetry(EMPTY_SCHEDULE)).toBeUndefined();
    expect(tooEarly.start).toEqual([]);
    expect(lateEnough.start).toEqual([only.key]);
    expect(statusOf(unwantedEarly.schedule, only.key)?.kind).toBe('failed');
    expect(statusOf(unwantedLate.schedule, only.key)).toBeUndefined();
  });

  it('reloads a tile the atlas evicted the next time it is selected', () => {
    const [only] = tiles(1);
    let schedule: TileSchedule = reconcileSchedule(EMPTY_SCHEDULE, [only], 0, STORED).schedule;
    schedule = markReady(schedule, only.key, 0);

    const { start } = reconcileSchedule(schedule, [only], 1, EVICTED);

    expect(start).toEqual([only.key]);
  });
});
