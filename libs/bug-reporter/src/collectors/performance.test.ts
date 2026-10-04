import { afterEach, describe, expect, it, vi } from 'vitest';

import { PerformanceCollector } from './performance';

class FakePerformanceObserver {
  static supportedEntryTypes = ['long-animation-frame'];
  static latest: FakePerformanceObserver | null = null;

  constructor(private readonly callback: (list: { getEntries(): unknown[] }) => void) {
    FakePerformanceObserver.latest = this;
  }

  observe(): void {}

  disconnect(): void {}

  emit(entries: unknown[]): void {
    this.callback({ getEntries: () => entries });
  }
}

describe('PerformanceCollector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('timestamps a long frame from fractional milliseconds without throwing', () => {
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    const collector = new PerformanceCollector();

    FakePerformanceObserver.latest?.emit([
      {
        entryType: 'long-animation-frame',
        startTime: 1234.8,
        duration: 180.4,
        blockingDuration: 120.2,
        scripts: [
          { sourceURL: 'app.js', sourceFunctionName: 'tick', invoker: 'rAF', duration: 150.6 },
        ],
      },
    ]);

    const [frame] = collector.snapshot([], null).longFrames;
    expect(frame?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(frame).toMatchObject({ durationMs: 180, blockingMs: 120 });
    expect(frame?.scripts[0]).toMatchObject({ functionName: 'tick', durationMs: 151 });
    collector.dispose();
  });
});
