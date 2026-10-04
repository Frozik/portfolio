import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import { isNil } from 'lodash-es';
import '../platform/browser-apis';

import type {
  IFpsSummary,
  ILongFrame,
  INavigationTiming,
  IPerformanceSnapshot,
  IResourceSummary,
  IWebVital,
  TMemoryReading,
} from '../core/report';
import { RingBuffer } from '../core/ring-buffer';

const MAX_LONG_FRAMES = 50;
const MAX_LONG_FRAME_SCRIPTS = 5;
const SLOWEST_RESOURCES = 10;
const LONG_FRAME_ENTRY = 'long-animation-frame';
const LONG_TASK_ENTRY = 'longtask';

/**
 * Frames that blocked the main thread, kept as they happen, plus the page
 * timings read at report time: resources, navigation, memory, DOM size.
 */
export class PerformanceCollector {
  private readonly longFrames = new RingBuffer<ILongFrame>({ maxEntries: MAX_LONG_FRAMES });
  private readonly observer: PerformanceObserver | null;

  constructor() {
    this.observer = observeLongFrames(frame => this.longFrames.push(frame));
  }

  get longFrameCount(): number {
    return this.longFrames.size;
  }

  snapshot(vitals: readonly IWebVital[], fps: IFpsSummary | null): IPerformanceSnapshot {
    return {
      vitals,
      longFrames: this.longFrames.toArray(),
      resources: summarizeResources(),
      memory: readMemory(),
      fps,
      navigation: readNavigation(),
      domNodes: document.getElementsByTagName('*').length,
    };
  }

  dispose(): void {
    this.observer?.disconnect();
    this.longFrames.clear();
  }
}

function observeLongFrames(push: (frame: ILongFrame) => void): PerformanceObserver | null {
  if (typeof PerformanceObserver !== 'function') {
    return null;
  }
  const supported = PerformanceObserver.supportedEntryTypes;
  const type = supported.includes(LONG_FRAME_ENTRY)
    ? LONG_FRAME_ENTRY
    : supported.includes(LONG_TASK_ENTRY)
      ? LONG_TASK_ENTRY
      : null;
  if (type === null) {
    return null;
  }
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      push(toLongFrame(entry));
    }
  });
  observer.observe({ type, buffered: true });
  return observer;
}

function toLongFrame(entry: PerformanceEntry): ILongFrame {
  // Both are fractional; Temporal takes whole milliseconds only.
  const timestamp = millisecondsToISO8601(Math.round(performance.timeOrigin + entry.startTime));
  if (!isLongAnimationFrame(entry)) {
    return { timestamp, durationMs: Math.round(entry.duration), blockingMs: 0, scripts: [] };
  }
  return {
    timestamp,
    durationMs: Math.round(entry.duration),
    blockingMs: Math.round(entry.blockingDuration),
    scripts: [...entry.scripts]
      .sort((left, right) => right.duration - left.duration)
      .slice(0, MAX_LONG_FRAME_SCRIPTS)
      .map(script => ({
        source: script.sourceURL,
        functionName: script.sourceFunctionName,
        invoker: script.invoker,
        durationMs: Math.round(script.duration),
      })),
  };
}

function isLongAnimationFrame(
  entry: PerformanceEntry
): entry is PerformanceLongAnimationFrameTiming {
  return entry.entryType === LONG_FRAME_ENTRY;
}

function summarizeResources(): IResourceSummary {
  const entries = performance
    .getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => entry.entryType === 'resource');
  return {
    count: entries.length,
    transferBytes: entries.reduce((total, entry) => total + entry.transferSize, 0),
    slowest: [...entries]
      .sort((left, right) => right.duration - left.duration)
      .slice(0, SLOWEST_RESOURCES)
      .map(entry => ({
        name: entry.name.split(/[?#]/, 1)[0] ?? entry.name,
        initiator: entry.initiatorType,
        durationMs: Math.round(entry.duration),
        transferBytes: entry.transferSize,
      })),
  };
}

function readMemory(): TMemoryReading {
  const memory = performance.memory;
  if (isNil(memory)) {
    return { kind: 'unavailable', reason: 'performance.memory is not exposed by this browser' };
  }
  return {
    kind: 'heap',
    usedBytes: memory.usedJSHeapSize,
    totalBytes: memory.totalJSHeapSize,
    limitBytes: memory.jsHeapSizeLimit,
  };
}

function readNavigation(): INavigationTiming | null {
  const entry = performance.getEntriesByType('navigation')[0];
  if (!isNavigationTiming(entry)) {
    return null;
  }
  return {
    type: entry.type,
    ttfbMs: Math.round(entry.responseStart),
    domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
    loadMs: Math.round(entry.loadEventEnd),
  };
}

function isNavigationTiming(
  entry: PerformanceEntry | undefined
): entry is PerformanceNavigationTiming {
  return entry !== undefined && entry.entryType === 'navigation';
}
