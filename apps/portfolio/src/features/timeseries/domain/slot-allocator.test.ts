import { FLOATS_PER_POINT, POINTS_PER_SLOT, SLOTS_PER_ROW } from './constants';
import { SlotAllocator } from './slot-allocator';
import type { ITextureSlot } from './types';

const TEXTURE_BINDING_BIT = 0x04;
const COPY_DST_BIT = 0x08;
const COPY_SRC_BIT = 0x02;

(globalThis as Record<string, unknown>).GPUTextureUsage = {
  TEXTURE_BINDING: TEXTURE_BINDING_BIT,
  COPY_DST: COPY_DST_BIT,
  COPY_SRC: COPY_SRC_BIT,
};

const TEST_TEXTURE_WIDTH = 2048;
const TEST_INITIAL_ROWS = 2;
const TEST_MAX_ROWS = 8;

function createMockDevice(): GPUDevice {
  const mockEncoder = {
    copyTextureToTexture: vi.fn(),
    finish: vi.fn(() => 'commandBuffer'),
  };

  const device = {
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => {
      const texture = {
        width: (descriptor.size as number[])[0],
        height: (descriptor.size as number[])[1],
        destroyed: false,
        createView: vi.fn(() => ({ label: 'mockView' }) as unknown as GPUTextureView),
        destroy: vi.fn(function (this: { destroyed: boolean }) {
          this.destroyed = true;
        }),
      };
      return texture;
    }),
    createCommandEncoder: vi.fn(() => mockEncoder),
    queue: {
      writeTexture: vi.fn(),
      submit: vi.fn(),
    },
  };

  return device as unknown as GPUDevice;
}

function createEncodedData(pointCount: number): Float32Array {
  return new Float32Array(pointCount * FLOATS_PER_POINT);
}

describe('SlotAllocator', () => {
  describe('basic allocation', () => {
    it('allocates first slot at row 0, slotIndex 0', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const slot = allocator.allocateSlot();

      expect(slot).not.toBeNull();
      expect(slot?.row).toBe(0);
      expect(slot?.slotIndex).toBe(0);
      expect(allocator.getAllocatedSlotCount()).toBe(1);

      allocator.dispose();
    });

    it('allocates slots sequentially within a row', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const slots: ITextureSlot[] = [];
      for (let index = 0; index < SLOTS_PER_ROW; index++) {
        const slot = allocator.allocateSlot();
        expect(slot).not.toBeNull();
        slots.push(slot as ITextureSlot);
      }

      // All 8 slots should be in row 0
      for (let index = 0; index < SLOTS_PER_ROW; index++) {
        expect(slots[index].row).toBe(0);
        expect(slots[index].slotIndex).toBe(index);
      }

      // Next slot should be in row 1
      const nextSlot = allocator.allocateSlot();
      expect(nextSlot).not.toBeNull();
      expect(nextSlot?.row).toBe(1);
      expect(nextSlot?.slotIndex).toBe(0);

      allocator.dispose();
    });

    it('advances high-water-mark with each allocation', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      expect(allocator.getHighWaterMark()).toBe(0);

      allocator.allocateSlot();
      expect(allocator.getHighWaterMark()).toBe(1);

      allocator.allocateSlot();
      expect(allocator.getHighWaterMark()).toBe(2);

      allocator.dispose();
    });
  });

  describe('texture growth', () => {
    it('doubles texture capacity when all slots in current capacity are used', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const totalSlots = TEST_INITIAL_ROWS * SLOTS_PER_ROW;

      for (let index = 0; index < totalSlots; index++) {
        allocator.allocateSlot();
      }

      expect(allocator.getCapacity()).toBe(TEST_INITIAL_ROWS);

      // This allocation triggers growth
      const slot = allocator.allocateSlot();
      expect(slot).not.toBeNull();
      expect(allocator.getCapacity()).toBe(TEST_INITIAL_ROWS * 2);

      allocator.dispose();
    });

    it('caps growth at maxRows', () => {
      const device = createMockDevice();
      const maxRows = 4;
      const allocator = new SlotAllocator(device, 2, maxRows, TEST_TEXTURE_WIDTH);

      const totalSlots = maxRows * SLOTS_PER_ROW;

      for (let index = 0; index < totalSlots; index++) {
        allocator.allocateSlot();
      }

      expect(allocator.getCapacity()).toBe(maxRows);

      allocator.dispose();
    });
  });

  describe('free list', () => {
    it('reuses released slots', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const slot1 = allocator.allocateSlot() as ITextureSlot;
      allocator.allocateSlot();

      allocator.releaseSlot(slot1);
      expect(allocator.getAllocatedSlotCount()).toBe(1);

      // Next allocation should reuse the released slot
      const reusedSlot = allocator.allocateSlot();
      expect(reusedSlot).not.toBeNull();
      expect(reusedSlot?.row).toBe(slot1.row);
      expect(reusedSlot?.slotIndex).toBe(slot1.slotIndex);

      allocator.dispose();
    });

    it('free list is LIFO (stack)', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const slot1 = allocator.allocateSlot() as ITextureSlot;
      const slot2 = allocator.allocateSlot() as ITextureSlot;
      allocator.allocateSlot();

      allocator.releaseSlot(slot1);
      allocator.releaseSlot(slot2);

      // Should get slot2 first (LIFO)
      const reused1 = allocator.allocateSlot();
      expect(reused1?.row).toBe(slot2.row);
      expect(reused1?.slotIndex).toBe(slot2.slotIndex);

      // Then slot1
      const reused2 = allocator.allocateSlot();
      expect(reused2?.row).toBe(slot1.row);
      expect(reused2?.slotIndex).toBe(slot1.slotIndex);

      allocator.dispose();
    });
  });

  describe('LRU eviction', () => {
    it('evicts the oldest slot when texture is full', () => {
      const evictedSlots: ITextureSlot[] = [];
      const device = createMockDevice();
      const maxRows = 2;
      const allocator = new SlotAllocator(device, maxRows, maxRows, TEST_TEXTURE_WIDTH, slot =>
        evictedSlots.push(slot)
      );

      const totalSlots = maxRows * SLOTS_PER_ROW;

      for (let index = 0; index < totalSlots; index++) {
        allocator.allocateSlot();
      }

      // All slots full. Next allocation should evict oldest (first allocated).
      const newSlot = allocator.allocateSlot();
      expect(newSlot).not.toBeNull();
      expect(newSlot?.row).toBe(0);
      expect(newSlot?.slotIndex).toBe(0);
      expect(evictedSlots).toHaveLength(1);
      expect(evictedSlots[0].row).toBe(0);
      expect(evictedSlots[0].slotIndex).toBe(0);

      allocator.dispose();
    });

    it('touch prevents slot from being evicted', () => {
      const evictedSlots: ITextureSlot[] = [];
      const device = createMockDevice();
      const maxRows = 1;
      const allocator = new SlotAllocator(device, maxRows, maxRows, TEST_TEXTURE_WIDTH, slot =>
        evictedSlots.push(slot)
      );

      const totalSlots = SLOTS_PER_ROW;
      const slots: ITextureSlot[] = [];

      for (let index = 0; index < totalSlots; index++) {
        slots.push(allocator.allocateSlot() as ITextureSlot);
      }

      // Touch the first slot — makes it most recently used
      allocator.touch(slots[0]);

      // Next allocation should evict slot[1] (oldest untouched), not slot[0]
      const newSlot = allocator.allocateSlot();
      expect(newSlot).not.toBeNull();
      expect(evictedSlots).toHaveLength(1);
      expect(evictedSlots[0].row).toBe(slots[1].row);
      expect(evictedSlots[0].slotIndex).toBe(slots[1].slotIndex);

      allocator.dispose();
    });
  });

  describe('writeSlotData', () => {
    it('writes data to the correct texture position', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const slot = allocator.allocateSlot() as ITextureSlot;
      const pointCount = 100;
      const encoded = createEncodedData(pointCount);

      allocator.writeSlotData(slot, encoded, pointCount);

      expect(device.queue.writeTexture).toHaveBeenCalledTimes(1);

      allocator.dispose();
    });
  });

  describe('getTextureOffset', () => {
    it('computes correct offset for first slot', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const offset = allocator.getTextureOffset({ row: 0, slotIndex: 0 });
      expect(offset).toBe(0);

      allocator.dispose();
    });

    it('computes correct offset for second slot in first row', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const offset = allocator.getTextureOffset({ row: 0, slotIndex: 1 });
      expect(offset).toBe(POINTS_PER_SLOT);

      allocator.dispose();
    });

    it('computes correct offset for first slot in second row', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const offset = allocator.getTextureOffset({ row: 1, slotIndex: 0 });
      expect(offset).toBe(TEST_TEXTURE_WIDTH);

      allocator.dispose();
    });

    it('computes correct offset for arbitrary slot', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      const offset = allocator.getTextureOffset({ row: 3, slotIndex: 5 });
      expect(offset).toBe(3 * TEST_TEXTURE_WIDTH + 5 * POINTS_PER_SLOT);

      allocator.dispose();
    });
  });

  describe('touch', () => {
    it('is a no-op for unknown slot', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      // Should not throw
      allocator.touch({ row: 99, slotIndex: 7 });

      allocator.dispose();
    });
  });

  describe('dispose', () => {
    it('destroys the texture and clears state', () => {
      const device = createMockDevice();
      const allocator = new SlotAllocator(
        device,
        TEST_INITIAL_ROWS,
        TEST_MAX_ROWS,
        TEST_TEXTURE_WIDTH
      );

      allocator.allocateSlot();
      allocator.dispose();

      expect(allocator.getAllocatedSlotCount()).toBe(0);
    });
  });
});
