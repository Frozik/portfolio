import { describe, expect, it } from 'vitest';
import { throttled } from './byte-stream-guards';

async function* chunks(sizes: readonly number[]): AsyncGenerator<number> {
  yield* sizes;
}

describe('byte stream guards', () => {
  it('spaces chunks out to the configured rate', async () => {
    const clock = { now: 0 };
    const sleeps: number[] = [];
    const sleeper = {
      nowMs: () => clock.now,
      sleep: (ms: number) => {
        sleeps.push(ms);
        clock.now += ms;
        return Promise.resolve();
      },
    };

    const passed = await Array.fromAsync(
      throttled(chunks([500, 500, 1000]), size => size, 1000, sleeper, new AbortController().signal)
    );

    expect(passed).toEqual([500, 500, 1000]);
    expect(sleeps).toEqual([500, 500, 1000]);
  });
});
