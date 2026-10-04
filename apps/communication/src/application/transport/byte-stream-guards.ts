export interface Sleeper {
  readonly nowMs: () => number;
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}

const MS_PER_SECOND = 1000;

/**
 * Token bucket over a stream: each chunk waits until the rate allows it.
 * The wait happens while the next chunk is not yet pulled, so a throttled
 * echo slows the sender instead of piling chunks up in memory.
 */
export async function* throttled<T>(
  source: AsyncIterable<T>,
  sizeOf: (item: T) => number,
  bytesPerSecond: number,
  { nowMs, sleep }: Sleeper,
  signal: AbortSignal
): AsyncGenerator<T> {
  const startedAt = nowMs();
  let passed = 0;
  for await (const item of source) {
    passed += sizeOf(item);
    const dueAt = startedAt + (passed / bytesPerSecond) * MS_PER_SECOND;
    const wait = dueAt - nowMs();
    if (wait > 0) {
      await sleep(wait, signal);
    }
    yield item;
  }
}
