import { describe, expect, test, vi } from 'vitest';

import { BlockTextureSlotManager } from './block-texture-slot-manager';

const TEXTURE_BINDING_BIT = 0x04;
const COPY_DST_BIT = 0x08;
const COPY_SRC_BIT = 0x02;

(globalThis as Record<string, unknown>).GPUTextureUsage = {
  TEXTURE_BINDING: TEXTURE_BINDING_BIT,
  COPY_DST: COPY_DST_BIT,
  COPY_SRC: COPY_SRC_BIT,
};

const STUB_FORMAT: GPUTextureFormat = 'rgba32float';
const SLOT_WIDTH_TEXELS = 4;
const SLOTS_PER_ROW = 2;
const BYTES_PER_TEXEL = 16;

interface IRecordedTextureCreate {
  readonly width: number;
  readonly height: number;
}

interface IRecordedCopy {
  readonly fromTexture: GPUTexture;
  readonly toTexture: GPUTexture;
  readonly width: number;
  readonly height: number;
}

interface IStubDeviceHandle {
  readonly device: GPUDevice;
  readonly textureCreates: IRecordedTextureCreate[];
  readonly liveTextures: Set<GPUTexture>;
  readonly copies: IRecordedCopy[];
}

function createStubDevice(): IStubDeviceHandle {
  const textureCreates: IRecordedTextureCreate[] = [];
  const liveTextures = new Set<GPUTexture>();
  const copies: IRecordedCopy[] = [];

  const device = {
    createTexture: (descriptor: GPUTextureDescriptor): GPUTexture => {
      const sizeTuple = descriptor.size as readonly number[];
      textureCreates.push({ width: sizeTuple[0], height: sizeTuple[1] });
      const texture = {
        createView: () => ({}) as unknown as GPUTextureView,
        destroy: () => {
          liveTextures.delete(texture);
        },
      } as unknown as GPUTexture;
      liveTextures.add(texture);
      return texture;
    },
    createCommandEncoder: () => ({
      copyTextureToTexture: (
        source: { texture: GPUTexture },
        destination: { texture: GPUTexture },
        copySize: { width: number; height: number }
      ) => {
        copies.push({
          fromTexture: source.texture,
          toTexture: destination.texture,
          width: copySize.width,
          height: copySize.height,
        });
      },
      finish: () => ({}) as unknown as GPUCommandBuffer,
    }),
    queue: {
      writeTexture: vi.fn(),
      submit: vi.fn(),
    },
  } as unknown as GPUDevice;

  return { device, textureCreates, liveTextures, copies };
}

function createManager(
  device: GPUDevice,
  overrides: {
    readonly initialSlotCount?: number;
    readonly maxSlotCount?: number;
    readonly growStep?: number;
    readonly onEvict?: (key: string) => void;
  } = {}
): BlockTextureSlotManager<string> {
  return new BlockTextureSlotManager<string>({
    device,
    format: STUB_FORMAT,
    slotWidthTexels: SLOT_WIDTH_TEXELS,
    slotsPerRow: SLOTS_PER_ROW,
    initialSlotCount: overrides.initialSlotCount ?? 4,
    maxSlotCount: overrides.maxSlotCount ?? 8,
    growStep: overrides.growStep ?? 2,
    onEvict: overrides.onEvict ?? (() => undefined),
    label: 'test.slot-manager',
  });
}

describe('BlockTextureSlotManager', () => {
  test('allocate assigns sequential slots and getSlot retrieves them', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);

    const slotForA = manager.allocate('a');
    const slotForB = manager.allocate('b');

    expect(slotForA).toBe(0);
    expect(slotForB).toBe(1);
    expect(manager.getSlot('a')).toBe(0);
    expect(manager.getSlot('b')).toBe(1);
  });

  test('allocating an existing key returns its current slot without consuming a new one', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);

    manager.allocate('a');
    manager.allocate('b');
    const repeatedSlot = manager.allocate('a');

    expect(repeatedSlot).toBe(0);
    expect(manager.currentAllocatedSlots).toBe(2);
  });

  test('free returns the slot to the free list and a subsequent allocate reuses it', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);

    manager.allocate('a');
    manager.allocate('b');
    manager.free('a');

    const reusedSlot = manager.allocate('c');

    expect(reusedSlot).toBe(0);
    expect(manager.getSlot('a')).toBeUndefined();
    expect(manager.getSlot('c')).toBe(0);
  });

  test('grow increases capacity without losing existing slot assignments', () => {
    const { device, textureCreates, copies } = createStubDevice();
    const manager = createManager(device, {
      initialSlotCount: 2,
      maxSlotCount: 8,
      growStep: 2,
    });

    manager.allocate('a');
    manager.allocate('b');
    expect(manager.currentCapacitySlots).toBe(2);

    const slotAfterGrow = manager.allocate('c');

    expect(manager.currentCapacitySlots).toBeGreaterThan(2);
    expect(slotAfterGrow).toBe(2);
    expect(manager.getSlot('a')).toBe(0);
    expect(manager.getSlot('b')).toBe(1);
    expect(textureCreates.length).toBeGreaterThan(1);
    expect(copies.length).toBe(1);
  });

  test('hitting maxSlotCount evicts the LRU least-recent key and reuses its slot', () => {
    const onEvict = vi.fn();
    const { device } = createStubDevice();
    const manager = createManager(device, {
      initialSlotCount: 2,
      maxSlotCount: 2,
      growStep: 2,
      onEvict,
    });

    manager.allocate('oldest');
    manager.allocate('middle');
    manager.touch('oldest');
    manager.touch('middle');
    manager.touch('oldest');

    const slotForNew = manager.allocate('newest');

    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith('middle');
    expect(slotForNew).toBe(1);
    expect(manager.getSlot('middle')).toBeUndefined();
    expect(manager.getSlot('oldest')).toBe(0);
    expect(manager.getSlot('newest')).toBe(1);
  });

  test('writeRegion forwards to device.queue.writeTexture with the correct origin and extent', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);
    const slotIndex = manager.allocate('a');
    const writeWidthTexels = 2;
    const columnInSlot = 1;
    const data = new Uint8Array(writeWidthTexels * BYTES_PER_TEXEL);

    manager.writeRegion(slotIndex, columnInSlot, data, writeWidthTexels);

    const writeTextureMock = device.queue.writeTexture as unknown as ReturnType<typeof vi.fn>;
    expect(writeTextureMock).toHaveBeenCalledTimes(1);
    const [destination, payload, layout, extent] = writeTextureMock.mock.calls[0];
    expect(destination.origin).toEqual({ x: columnInSlot, y: 0, z: 0 });
    expect(payload).toBe(data);
    expect(layout.bytesPerRow).toBe(SLOTS_PER_ROW * SLOT_WIDTH_TEXELS * BYTES_PER_TEXEL);
    expect(extent).toEqual({ width: writeWidthTexels, height: 1, depthOrArrayLayers: 1 });
  });

  test('slotTextureOffset wraps slots across rows using slotsPerRow', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);

    expect(manager.slotTextureOffset(0)).toBe(0);
    expect(manager.slotTextureOffset(1)).toBe(SLOT_WIDTH_TEXELS);
    const expectedRowWidth = SLOTS_PER_ROW * SLOT_WIDTH_TEXELS;
    expect(manager.slotTextureOffset(2)).toBe(expectedRowWidth);
    expect(manager.slotTextureOffset(3)).toBe(expectedRowWidth + SLOT_WIDTH_TEXELS);
  });

  test('dispose destroys the backing texture and disallows further mutation', () => {
    const { device, liveTextures } = createStubDevice();
    const manager = createManager(device);
    manager.allocate('a');
    expect(liveTextures.size).toBe(1);

    manager.dispose();

    expect(liveTextures.size).toBe(0);
    expect(() => manager.allocate('b')).toThrow();
  });

  test('dispose is idempotent and a second call does not throw', () => {
    const { device } = createStubDevice();
    const manager = createManager(device);
    manager.dispose();
    expect(() => manager.dispose()).not.toThrow();
  });
});
