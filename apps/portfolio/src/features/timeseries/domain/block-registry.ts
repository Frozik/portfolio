import RBush from 'rbush';

import { SLOTS_PER_ROW } from './constants';
import type { EChartType, ETimeScale, IBlockEntry, ITextureSlot } from './types';

/**
 * Compute a unique numeric key for a texture slot.
 * Used for O(1) lookup when evicting by slot reference.
 */
function slotKey(slot: ITextureSlot): number {
  return slot.row * SLOTS_PER_ROW + slot.slotIndex;
}

/**
 * Wraps RBush for spatial queries of block entries.
 *
 * Blocks are indexed by time range (X axis) and scale ordinal (Y axis).
 * A secondary Map keyed by slot index provides O(1) lookup for eviction.
 */
export class BlockRegistry {
  private readonly tree = new RBush<IBlockEntry>();
  private readonly slotMap = new Map<number, IBlockEntry>();

  insert(entry: IBlockEntry): void {
    entry.minX = entry.timeStart;
    entry.maxX = entry.timeEnd;
    entry.minY = entry.scale;
    entry.maxY = entry.scale;

    this.tree.insert(entry);
    this.slotMap.set(slotKey(entry.slot), entry);
  }

  remove(entry: IBlockEntry): void {
    this.tree.remove(entry);
    this.slotMap.delete(slotKey(entry.slot));
  }

  removeBySlot(slot: ITextureSlot): void {
    const entry = this.slotMap.get(slotKey(slot));

    if (entry === undefined) {
      return;
    }

    this.remove(entry);
  }

  queryVisible(
    scale: ETimeScale,
    timeStart: number,
    timeEnd: number,
    chartType?: EChartType
  ): IBlockEntry[] {
    const results = this.tree.search({
      minX: timeStart,
      maxX: timeEnd,
      minY: scale,
      maxY: scale,
    });

    if (chartType === undefined) {
      return results;
    }

    return results.filter(entry => entry.chartType === chartType);
  }

  findCovering(
    scale: ETimeScale,
    periodStart: number,
    periodEnd: number,
    chartType: EChartType
  ): IBlockEntry | undefined {
    const candidates = this.tree.search({
      minX: periodStart,
      maxX: periodEnd,
      minY: scale,
      maxY: scale,
    });

    return candidates.find(
      entry =>
        entry.chartType === chartType &&
        entry.timeStart <= periodStart &&
        entry.timeEnd >= periodEnd
    );
  }

  clear(): void {
    this.tree.clear();
    this.slotMap.clear();
  }

  /** Returns the total number of entries in the registry. */
  getEntryCount(): number {
    return this.slotMap.size;
  }
}
