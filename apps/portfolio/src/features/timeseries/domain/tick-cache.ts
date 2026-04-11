import { LRUCache } from 'lru-cache';

import { computeXTicks, computeYTicks } from './axis-ticks';
import type { ETimeScale, IAxisTick } from './types';

const DEFAULT_MAX_SIZE = 50;

/**
 * LRU cache for axis tick computations.
 *
 * computeXTicks creates Temporal objects and formats date/time strings;
 * computeYTicks computes nice step sizes and formats value labels.
 * Both are expensive relative to simple math (~1-3ms for fine time scales).
 *
 * Cache keyed by input parameters — hits when returning to a previously
 * viewed viewport range (zoom out/in cycles, tab switching).
 */
export class TickCache {
  private readonly cache: LRUCache<string, IAxisTick[]>;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.cache = new LRUCache({ max: maxSize });
  }

  getXTicks(
    timeStart: number,
    timeEnd: number,
    scale: ETimeScale,
    plotWidthPx: number
  ): IAxisTick[] {
    const key = `x:${timeStart}:${timeEnd}:${scale}:${Math.round(plotWidthPx)}`;
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const ticks = computeXTicks(timeStart, timeEnd, scale, plotWidthPx);
    this.cache.set(key, ticks);
    return ticks;
  }

  getYTicks(valueMin: number, valueMax: number, plotHeightPx: number): IAxisTick[] {
    const key = `y:${valueMin}:${valueMax}:${Math.round(plotHeightPx)}`;
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const ticks = computeYTicks(valueMin, valueMax, plotHeightPx);
    this.cache.set(key, ticks);
    return ticks;
  }
}
