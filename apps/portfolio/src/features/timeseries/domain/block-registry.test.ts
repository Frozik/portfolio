import { BlockRegistry } from './block-registry';
import type { IBlockEntry } from './types';
import { EChartType, ETimeScale } from './types';

function createBlockEntry(overrides: Partial<IBlockEntry> = {}): IBlockEntry {
  return {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    timeStart: 0,
    timeEnd: 3600,
    scale: ETimeScale.Hour1,
    chartType: EChartType.Line,
    slot: { row: 0, slotIndex: 0 },
    pointCount: 180,
    baseTime: 0,
    baseValue: 100,
    pointTimes: new Float64Array(0),
    pointValues: new Float64Array(0),
    ...overrides,
  };
}

describe('BlockRegistry', () => {
  describe('insert and query', () => {
    it('inserts and retrieves a block entry', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        scale: ETimeScale.Hour1,
        chartType: EChartType.Line,
      });

      registry.insert(entry);
      const results = registry.queryVisible(ETimeScale.Hour1, 0, 3600);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(entry);
    });

    it('does not return entries with a different scale', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        scale: ETimeScale.Hour1,
      });

      registry.insert(entry);
      const results = registry.queryVisible(ETimeScale.Day1, 0, 3600);

      expect(results).toHaveLength(0);
    });

    it('filters by chartType when provided', () => {
      const registry = new BlockRegistry();
      const lineEntry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        chartType: EChartType.Line,
        slot: { row: 0, slotIndex: 0 },
      });
      const candlestickEntry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        chartType: EChartType.Candlestick,
        slot: { row: 0, slotIndex: 1 },
      });

      registry.insert(lineEntry);
      registry.insert(candlestickEntry);

      const lineResults = registry.queryVisible(ETimeScale.Hour1, 0, 3600, EChartType.Line);
      const candlestickResults = registry.queryVisible(
        ETimeScale.Hour1,
        0,
        3600,
        EChartType.Candlestick
      );

      expect(lineResults).toHaveLength(1);
      expect(lineResults[0]).toBe(lineEntry);
      expect(candlestickResults).toHaveLength(1);
      expect(candlestickResults[0]).toBe(candlestickEntry);
    });

    it('returns all chart types when chartType is not specified', () => {
      const registry = new BlockRegistry();
      const lineEntry = createBlockEntry({
        chartType: EChartType.Line,
        slot: { row: 0, slotIndex: 0 },
      });
      const candlestickEntry = createBlockEntry({
        chartType: EChartType.Candlestick,
        slot: { row: 0, slotIndex: 1 },
      });

      registry.insert(lineEntry);
      registry.insert(candlestickEntry);

      const results = registry.queryVisible(ETimeScale.Hour1, 0, 3600);

      expect(results).toHaveLength(2);
    });
  });

  describe('findCovering', () => {
    it('finds entry that fully covers a period', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 7200,
        scale: ETimeScale.Hour1,
        chartType: EChartType.Line,
      });

      registry.insert(entry);
      const result = registry.findCovering(ETimeScale.Hour1, 0, 3600, EChartType.Line);

      expect(result).toBe(entry);
    });

    it('returns undefined when no entry covers the period', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 1800,
        scale: ETimeScale.Hour1,
        chartType: EChartType.Line,
      });

      registry.insert(entry);
      const result = registry.findCovering(ETimeScale.Hour1, 0, 3600, EChartType.Line);

      expect(result).toBeUndefined();
    });

    it('returns undefined when chartType does not match', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        chartType: EChartType.Line,
      });

      registry.insert(entry);
      const result = registry.findCovering(ETimeScale.Hour1, 0, 3600, EChartType.Candlestick);

      expect(result).toBeUndefined();
    });

    it('returns undefined when scale does not match', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        scale: ETimeScale.Hour1,
        chartType: EChartType.Line,
      });

      registry.insert(entry);
      const result = registry.findCovering(ETimeScale.Day1, 0, 3600, EChartType.Line);

      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('removes an entry from the registry', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry();

      registry.insert(entry);
      expect(registry.getEntryCount()).toBe(1);

      registry.remove(entry);
      expect(registry.getEntryCount()).toBe(0);

      const results = registry.queryVisible(ETimeScale.Hour1, 0, 3600);
      expect(results).toHaveLength(0);
    });
  });

  describe('removeBySlot', () => {
    it('removes entry matching the given slot', () => {
      const registry = new BlockRegistry();
      const slot = { row: 2, slotIndex: 3 };
      const entry = createBlockEntry({ slot });

      registry.insert(entry);
      expect(registry.getEntryCount()).toBe(1);

      registry.removeBySlot(slot);
      expect(registry.getEntryCount()).toBe(0);
    });

    it('is a no-op when slot does not match any entry', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({ slot: { row: 0, slotIndex: 0 } });

      registry.insert(entry);
      registry.removeBySlot({ row: 99, slotIndex: 7 });

      expect(registry.getEntryCount()).toBe(1);
    });

    it('only removes the entry with matching slot', () => {
      const registry = new BlockRegistry();
      const entry1 = createBlockEntry({ slot: { row: 0, slotIndex: 0 } });
      const entry2 = createBlockEntry({
        slot: { row: 0, slotIndex: 1 },
        timeStart: 3600,
        timeEnd: 7200,
      });

      registry.insert(entry1);
      registry.insert(entry2);

      registry.removeBySlot({ row: 0, slotIndex: 0 });

      expect(registry.getEntryCount()).toBe(1);
      const results = registry.queryVisible(ETimeScale.Hour1, 0, 7200);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(entry2);
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const registry = new BlockRegistry();

      registry.insert(createBlockEntry({ slot: { row: 0, slotIndex: 0 } }));
      registry.insert(
        createBlockEntry({
          slot: { row: 0, slotIndex: 1 },
          timeStart: 3600,
          timeEnd: 7200,
        })
      );

      expect(registry.getEntryCount()).toBe(2);

      registry.clear();

      expect(registry.getEntryCount()).toBe(0);
      expect(registry.queryVisible(ETimeScale.Hour1, 0, 7200)).toHaveLength(0);
    });
  });

  describe('spatial queries', () => {
    it('returns only entries within the queried time range', () => {
      const registry = new BlockRegistry();
      const entry1 = createBlockEntry({
        timeStart: 0,
        timeEnd: 3600,
        slot: { row: 0, slotIndex: 0 },
      });
      const entry2 = createBlockEntry({
        timeStart: 100000,
        timeEnd: 103600,
        slot: { row: 0, slotIndex: 1 },
      });

      registry.insert(entry1);
      registry.insert(entry2);

      const results = registry.queryVisible(ETimeScale.Hour1, 0, 3600);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(entry1);
    });

    it('returns entries that partially overlap the query range', () => {
      const registry = new BlockRegistry();
      const entry = createBlockEntry({
        timeStart: 1000,
        timeEnd: 5000,
        slot: { row: 0, slotIndex: 0 },
      });

      registry.insert(entry);

      const results = registry.queryVisible(ETimeScale.Hour1, 3000, 6000);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(entry);
    });
  });
});
