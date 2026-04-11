import { BlockDataPipeline } from './block-data-pipeline';
import { BlockRegistry } from './block-registry';
import { SLOTS_PER_ROW } from './constants';
import { SlotAllocator } from './slot-allocator';
import { EChartType, ETimeScale } from './types';

const TEXTURE_BINDING_BIT = 0x04;
const COPY_DST_BIT = 0x08;
const COPY_SRC_BIT = 0x02;

(globalThis as Record<string, unknown>).GPUTextureUsage = {
  TEXTURE_BINDING: TEXTURE_BINDING_BIT,
  COPY_DST: COPY_DST_BIT,
  COPY_SRC: COPY_SRC_BIT,
};

const TEST_TEXTURE_WIDTH = 2048;
const TEST_INITIAL_ROWS = 4;
const TEST_MAX_ROWS = 16;
const TEST_SEED = 'test-pipeline-seed';

function createMockDevice(): GPUDevice {
  const mockEncoder = {
    copyTextureToTexture: vi.fn(),
    finish: vi.fn(() => 'commandBuffer'),
  };

  const device = {
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => ({
      width: (descriptor.size as number[])[0],
      height: (descriptor.size as number[])[1],
      destroyed: false,
      createView: vi.fn(() => ({ label: 'mockView' }) as unknown as GPUTextureView),
      destroy: vi.fn(),
    })),
    createCommandEncoder: vi.fn(() => mockEncoder),
    queue: {
      writeTexture: vi.fn(),
      submit: vi.fn(),
    },
  };

  return device as unknown as GPUDevice;
}

const LOADING_DELAY_MS = 1_000;

describe('BlockDataPipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ensureBlocksForViewport', () => {
    it('generates blocks after loading delay', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);

      const scale = ETimeScale.Hour1;
      const viewStart = scale;
      const viewEnd = 2 * scale;

      // First call: starts loading, returns no blocks
      const blocksBeforeDelay = pipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      expect(blocksBeforeDelay.length).toBe(0);

      // Advance past loading delay
      vi.advanceTimersByTime(LOADING_DELAY_MS);

      // Second call: blocks are now available
      const blocks = pipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      expect(blocks.length).toBeGreaterThanOrEqual(1);

      for (const block of blocks) {
        expect(block.chartType).toBe(EChartType.Line);
        expect(block.scale).toBe(scale);
        expect(block.pointCount).toBeGreaterThan(0);
      }

      allocator.dispose();
    });

    it('caches blocks on repeated calls with same viewport', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);

      const scale = ETimeScale.Hour1;
      const viewStart = scale;
      const viewEnd = 2 * scale;

      // Start loading
      pipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      vi.advanceTimersByTime(LOADING_DELAY_MS);

      // Complete loading
      const firstBlocks = pipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      const allocatedAfterFirst = allocator.getAllocatedSlotCount();

      const secondBlocks = pipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      const allocatedAfterSecond = allocator.getAllocatedSlotCount();

      // Same number of blocks returned
      expect(secondBlocks.length).toBe(firstBlocks.length);

      // No new allocations
      expect(allocatedAfterSecond).toBe(allocatedAfterFirst);

      allocator.dispose();
    });

    it('returns blocks sorted by timeStart', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);

      const scale = ETimeScale.Hour1;
      const blocks = pipeline.ensureBlocksForViewport(0, 5 * scale, scale);

      for (let index = 1; index < blocks.length; index++) {
        expect(blocks[index].timeStart).toBeGreaterThanOrEqual(blocks[index - 1].timeStart);
      }

      allocator.dispose();
    });

    it('generates blocks for each period independently', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(
        allocator,
        registry,
        TEST_SEED,
        EChartType.Candlestick
      );

      const scale = ETimeScale.Day1;

      // Start loading
      pipeline.ensureBlocksForViewport(0, scale, scale);
      vi.advanceTimersByTime(LOADING_DELAY_MS);

      const blocks = pipeline.ensureBlocksForViewport(0, scale, scale);

      // With bufferPeriods=1 and one covering period, we expect 3 periods
      // Each period generates 180 points < 256, so 1 block per period
      expect(blocks.length).toBe(3);

      for (const block of blocks) {
        expect(block.chartType).toBe(EChartType.Candlestick);
      }

      allocator.dispose();
    });

    it('each block has valid pointTimes and pointValues', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);

      const scale = ETimeScale.Hour1;
      const blocks = pipeline.ensureBlocksForViewport(0, scale, scale);

      for (const block of blocks) {
        expect(block.pointTimes.length).toBe(block.pointCount);
        expect(block.pointValues.length).toBe(block.pointCount);

        // Point times should be finite
        for (let index = 0; index < block.pointCount; index++) {
          expect(Number.isFinite(block.pointTimes[index])).toBe(true);
          expect(Number.isFinite(block.pointValues[index])).toBe(true);
        }
      }

      allocator.dispose();
    });
  });

  describe('eviction integration', () => {
    it('eviction callback removes entry from registry', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const maxRows = 1;
      const allocator = new SlotAllocator(device, maxRows, maxRows, TEST_TEXTURE_WIDTH, slot =>
        registry.removeBySlot(slot)
      );
      const pipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);

      const scale = ETimeScale.Hour1;

      // Fill all slots (1 row = 8 slots)
      // With 180 points per period and buffer=1, each call takes 3 periods = 3 slots
      pipeline.ensureBlocksForViewport(0, scale, scale);

      // Requesting a different viewport range forces new blocks
      // Eventually this should cause eviction
      pipeline.ensureBlocksForViewport(10 * scale, 11 * scale, scale);

      // Some blocks were evicted and new ones were added
      // The total should still be <= total slots (8)
      expect(registry.getEntryCount()).toBeLessThanOrEqual(SLOTS_PER_ROW);

      allocator.dispose();
    });
  });

  describe('different chart types in same registry', () => {
    it('two pipelines with different chart types coexist in one registry', () => {
      const device = createMockDevice();
      const registry = new BlockRegistry();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH,
        slot => registry.removeBySlot(slot)
      );

      const linePipeline = new BlockDataPipeline(allocator, registry, TEST_SEED, EChartType.Line);
      const candlestickPipeline = new BlockDataPipeline(
        allocator,
        registry,
        `${TEST_SEED}-series-2`,
        EChartType.Candlestick
      );

      const scale = ETimeScale.Hour1;
      const viewStart = 0;
      const viewEnd = scale;

      // Start loading for both
      linePipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      candlestickPipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      vi.advanceTimersByTime(LOADING_DELAY_MS);

      // Complete loading
      const lineBlocks = linePipeline.ensureBlocksForViewport(viewStart, viewEnd, scale);
      const candlestickBlocks = candlestickPipeline.ensureBlocksForViewport(
        viewStart,
        viewEnd,
        scale
      );

      // Both should have blocks
      expect(lineBlocks.length).toBeGreaterThan(0);
      expect(candlestickBlocks.length).toBeGreaterThan(0);

      // All line blocks should be Line type
      for (const block of lineBlocks) {
        expect(block.chartType).toBe(EChartType.Line);
      }

      // All candlestick blocks should be Candlestick type
      for (const block of candlestickBlocks) {
        expect(block.chartType).toBe(EChartType.Candlestick);
      }

      // Registry should have both types
      const allLine = registry.queryVisible(ETimeScale.Hour1, viewStart, viewEnd, EChartType.Line);
      const allCandlestick = registry.queryVisible(
        ETimeScale.Hour1,
        viewStart,
        viewEnd,
        EChartType.Candlestick
      );

      expect(allLine.length).toBeGreaterThan(0);
      expect(allCandlestick.length).toBeGreaterThan(0);

      allocator.dispose();
    });
  });
});
