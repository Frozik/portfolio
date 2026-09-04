import RBush from 'rbush';

import { SLOTS_PER_ROW } from './constants';
import type { EChartType, ETimeScale, IBlockEntry, ITextureSlot } from './types';

function slotKey(slot: ITextureSlot): number {
  return slot.row * SLOTS_PER_ROW + slot.slotIndex;
}

/** Blocks are indexed by time range (X) and scale (Y) straight from their own fields. */
class BlockTree extends RBush<IBlockEntry> {
  toBBox(entry: IBlockEntry): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    return { minX: entry.timeStart, maxX: entry.timeEnd, minY: entry.scale, maxY: entry.scale };
  }

  compareMinX(left: IBlockEntry, right: IBlockEntry): number {
    return left.timeStart - right.timeStart;
  }

  compareMinY(left: IBlockEntry, right: IBlockEntry): number {
    return left.scale - right.scale;
  }
}

/** Spatial index over the loaded blocks with O(1) lookup by texture slot for eviction. */
export class BlockRegistry {
  private readonly tree = new BlockTree();
  private readonly slotMap = new Map<number, IBlockEntry>();

  insert(entry: IBlockEntry): void {
    this.tree.insert(entry);
    this.slotMap.set(slotKey(entry.slot), entry);
  }

  remove(entry: IBlockEntry): void {
    this.tree.remove(entry);
    this.slotMap.delete(slotKey(entry.slot));
  }

  removeBySlot(slot: ITextureSlot): void {
    const entry = this.slotMap.get(slotKey(slot));
    if (entry !== undefined) {
      this.remove(entry);
    }
  }

  queryVisible(
    scale: ETimeScale,
    timeStart: number,
    timeEnd: number,
    chartType?: EChartType
  ): readonly IBlockEntry[] {
    const results = this.tree.search({ minX: timeStart, maxX: timeEnd, minY: scale, maxY: scale });
    return chartType === undefined
      ? results
      : results.filter(entry => entry.chartType === chartType);
  }

  findCovering(
    scale: ETimeScale,
    periodStart: number,
    periodEnd: number,
    chartType: EChartType
  ): IBlockEntry | undefined {
    return this.tree
      .search({ minX: periodStart, maxX: periodEnd, minY: scale, maxY: scale })
      .find(
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

  getEntryCount(): number {
    return this.slotMap.size;
  }
}
