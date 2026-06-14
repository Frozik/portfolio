import { MID_PRICE_SAMPLES_PER_BLOCK, MID_PRICE_TEXTURE_WIDTH } from '../domain/constants';
import type { UnixTimeMs } from '../domain/types';
import type { BlockTextureSlotManager } from './block-store/block-texture-slot-manager';
import { createMidPriceSlotManager } from './block-store/create-mid-price-slot-manager';

const FLOATS_PER_TEXEL = 4;
const MID_PRICE_SLOTS_PER_ROW = Math.floor(MID_PRICE_TEXTURE_WIDTH / MID_PRICE_SAMPLES_PER_BLOCK);

export interface IMidPriceTextureRowManagerParams {
  readonly device: GPUDevice;
  /** Called when a block is LRU-evicted so the index can clear its textureRowIndex. */
  readonly onEvict?: (blockId: UnixTimeMs) => void;
}

/**
 * Mid-price-flavoured wrapper around the generic
 * {@link BlockTextureSlotManager}. Preserves the `writeSamples` API the
 * orchestrator and renderer rely on (data is a `Float32Array` covering
 * a contiguous run of mid-price samples) while delegating slot
 * allocation, LRU eviction, and grow logic to the shared manager.
 */
export class MidPriceTextureRowManager {
  private readonly slotManager: BlockTextureSlotManager<UnixTimeMs>;

  constructor(params: IMidPriceTextureRowManagerParams) {
    const onEvictCallback = params.onEvict;
    this.slotManager = createMidPriceSlotManager({
      device: params.device,
      onEvict: (blockId: UnixTimeMs) => {
        onEvictCallback?.(blockId);
      },
    });
  }

  allocate(blockId: UnixTimeMs): number {
    return this.slotManager.allocate(blockId);
  }

  touch(blockId: UnixTimeMs): void {
    this.slotManager.touch(blockId);
  }

  release(blockId: UnixTimeMs): void {
    this.slotManager.free(blockId);
  }

  /**
   * Write a contiguous run of mid-price samples into the slot starting
   * at `firstSampleIndex` (texels into the slot). `data` is the active
   * block's full Float32Array; `dataOffsetFloats` selects the first
   * sample to upload.
   */
  writeSamples(
    slotIndex: number,
    firstSampleIndex: number,
    samples: number,
    data: Float32Array,
    dataOffsetFloats: number
  ): void {
    if (samples <= 0) {
      return;
    }
    const floatsThisRun = samples * FLOATS_PER_TEXEL;
    const sampleBytes = new Uint8Array(
      data.buffer,
      data.byteOffset + dataOffsetFloats * Float32Array.BYTES_PER_ELEMENT,
      floatsThisRun * Float32Array.BYTES_PER_ELEMENT
    );
    this.slotManager.writeRegion(slotIndex, firstSampleIndex, sampleBytes, samples);
  }

  /** Return the starting texel offset (row * textureWidth + column) for a slot. */
  slotTextureOffset(slotIndex: number): number {
    return this.slotManager.slotTextureOffset(slotIndex);
  }

  createView(): GPUTextureView {
    return this.slotManager.textureView;
  }

  get currentCapacityBlocks(): number {
    return this.slotManager.currentCapacitySlots;
  }

  get currentAllocatedBlocks(): number {
    return this.slotManager.currentAllocatedSlots;
  }

  dispose(): void {
    this.slotManager.dispose();
  }
}

export { MID_PRICE_SLOTS_PER_ROW };
