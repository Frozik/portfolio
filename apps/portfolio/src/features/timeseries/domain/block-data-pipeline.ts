import type { BlockRegistry } from './block-registry';
import { POINTS_PER_SLOT } from './constants';
import { generateTimeseriesData } from './data-generator';
import { encodePoints } from './delta-encoding';
import { alignedPeriods } from './period-alignment';
import type { SlotAllocator } from './slot-allocator';
import type { ETimeScale, IBlockEntry, ILoadingRegion, PointTransformFunction } from './types';
import { EChartType } from './types';

/** Simulated loading delay in milliseconds. */
const LOADING_DELAY_MS = 4000;

interface IPendingBlock {
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly scale: ETimeScale;
  readonly requestTime: number;
}

/**
 * Orchestrates block-based data generation and caching for a single series.
 *
 * Simulates async data loading: missing blocks are queued and "loaded"
 * after a delay (LOADING_DELAY_MS). During loading, the region is
 * reported via getLoadingRegions() for visual feedback.
 */
export class BlockDataPipeline {
  private readonly pendingBlocks = new Map<string, IPendingBlock>();
  private requestCounter = 0;

  constructor(
    private readonly allocator: SlotAllocator,
    private readonly registry: BlockRegistry,
    private readonly seed: string,
    private readonly chartType: EChartType,
    private readonly colorFn?: PointTransformFunction,
    private readonly sizeFn?: PointTransformFunction,
    private readonly isDebug?: () => boolean
  ) {}

  ensureBlocksForViewport(
    viewTimeStart: number,
    viewTimeEnd: number,
    scale: ETimeScale
  ): IBlockEntry[] {
    const periods = alignedPeriods(viewTimeStart, viewTimeEnd, scale);
    const visibleEntries: IBlockEntry[] = [];
    const now = performance.now();

    // Collect current period keys to prune stale pending entries
    const currentPeriodKeys = new Set<string>();

    for (const period of periods) {
      const pendingKey = `${scale}:${period.start}:${period.end}`;
      currentPeriodKeys.add(pendingKey);

      const existing = this.registry.findCovering(scale, period.start, period.end, this.chartType);

      if (existing !== undefined) {
        this.allocator.touch(existing.slot);
        visibleEntries.push(existing);
        // Clear any stale pending entry for this already-loaded block
        this.pendingBlocks.delete(pendingKey);
        continue;
      }

      const pending = this.pendingBlocks.get(pendingKey);

      if (pending === undefined) {
        this.requestCounter++;
        const requestNumber = this.requestCounter;

        if (this.isDebug?.()) {
          console.log(
            `>>> [#${requestNumber}] REQUEST ${EChartType[this.chartType]}` +
              ` [${period.start} → ${period.end}]` +
              ` scale=${scale}`
          );
        }

        // Start "loading" this block
        this.pendingBlocks.set(pendingKey, {
          periodStart: period.start,
          periodEnd: period.end,
          scale,
          requestTime: now,
        });
        continue;
      }

      // Check if loading delay has elapsed
      if (now - pending.requestTime >= LOADING_DELAY_MS) {
        this.pendingBlocks.delete(pendingKey);
        const newEntries = this.generateBlocksForPeriod(period.start, period.end, scale);
        visibleEntries.push(...newEntries);

        if (this.isDebug?.()) {
          const totalPoints = newEntries.reduce((sum, entry) => sum + entry.pointCount, 0);
          console.log(
            `>>> [#${this.requestCounter}] RESPONSE ${EChartType[this.chartType]}` +
              ` [${period.start} → ${period.end}]` +
              ` ${newEntries.length} block(s), ${totalPoints} points`
          );
        }
      }
      // Otherwise still loading — skip this block
    }

    // Prune pending entries for periods no longer in viewport
    for (const key of this.pendingBlocks.keys()) {
      if (!currentPeriodKeys.has(key)) {
        this.pendingBlocks.delete(key);
      }
    }

    return visibleEntries.sort((left, right) => left.timeStart - right.timeStart);
  }

  /** Returns time regions currently being loaded (for visual feedback). */
  getLoadingRegions(): ILoadingRegion[] {
    const now = performance.now();
    const regions: ILoadingRegion[] = [];

    for (const pending of this.pendingBlocks.values()) {
      const elapsed = now - pending.requestTime;
      const progress = Math.min(1, elapsed / LOADING_DELAY_MS);

      regions.push({
        timeStart: pending.periodStart,
        timeEnd: pending.periodEnd,
        progress,
      });
    }

    return regions;
  }

  private generateBlocksForPeriod(
    periodStart: number,
    periodEnd: number,
    scale: ETimeScale
  ): IBlockEntry[] {
    const points = generateTimeseriesData(periodStart, periodEnd, scale, this.seed);

    if (points.length === 0) {
      return [];
    }

    // Apply custom transform functions if provided
    if (this.colorFn !== undefined || this.sizeFn !== undefined) {
      for (let index = 0; index < points.length; index++) {
        const point = points[index];
        points[index] = {
          ...point,
          color:
            this.colorFn !== undefined ? this.colorFn(point.value, index, points) : point.color,
          size: this.sizeFn !== undefined ? this.sizeFn(point.value, index, points) : point.size,
        };
      }
    }

    const entries: IBlockEntry[] = [];

    if (points.length <= POINTS_PER_SLOT) {
      const entry = this.createBlock(points, periodStart, periodEnd, scale);
      if (entry !== null) {
        entries.push(entry);
      }
    } else {
      const chunkCount = Math.ceil(points.length / POINTS_PER_SLOT);

      for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
        const startIndex = chunkIndex * POINTS_PER_SLOT;
        const endIndex = Math.min(startIndex + POINTS_PER_SLOT, points.length);
        const chunk = points.slice(startIndex, endIndex);

        const chunkTimeStart = chunk[0].time;
        const chunkTimeEnd = chunk[chunk.length - 1].time;

        const entry = this.createBlock(chunk, chunkTimeStart, chunkTimeEnd, scale);
        if (entry !== null) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  private createBlock(
    points: readonly { time: number; value: number; size: number; color: number }[],
    timeStart: number,
    timeEnd: number,
    scale: ETimeScale
  ): IBlockEntry | null {
    const slot = this.allocator.allocateSlot();

    if (slot === null) {
      return null;
    }

    const baseTime = points[0].time;
    const baseValue = points[0].value;
    const encoded = encodePoints(points, baseTime, baseValue);

    this.allocator.writeSlotData(slot, encoded, points.length);

    const pointTimes = new Float64Array(points.length);
    const pointValues = new Float64Array(points.length);

    for (let index = 0; index < points.length; index++) {
      pointTimes[index] = points[index].time;
      pointValues[index] = points[index].value;
    }

    const entry: IBlockEntry = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      timeStart,
      timeEnd,
      scale,
      chartType: this.chartType,
      slot,
      pointCount: points.length,
      baseTime,
      baseValue,
      pointTimes,
      pointValues,
    };

    this.registry.insert(entry);

    return entry;
  }
}
