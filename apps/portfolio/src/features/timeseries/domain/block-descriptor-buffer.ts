import { TEXTURE_WIDTH } from './constants';
import type { SlotAllocator } from './slot-allocator';
import type { IBlockEntry } from './types';

/** Number of 32-bit values per BlockDescriptor: textureOffset, pointCount, baseTimeDelta, baseValueDelta. */
const FLOATS_PER_DESCRIPTOR = 4;

/** Byte size of a single BlockDescriptor (4 x uint32/float32 = 16 bytes). */
const BYTES_PER_DESCRIPTOR = FLOATS_PER_DESCRIPTOR * Float32Array.BYTES_PER_ELEMENT;

/** Default maximum number of block descriptors the storage buffer can hold. */
const DEFAULT_MAX_BLOCKS = 64;

export interface IDescriptorWriteResult {
  readonly totalInstances: number;
  readonly globalBaseTime: number;
  readonly globalBaseValue: number;
}

/**
 * Manages the GPU storage buffer containing block descriptors that tell the
 * shader how to navigate the data texture.
 *
 * Each descriptor is 16 bytes (4 x u32/f32):
 *   textureOffset: u32  - row * TEXTURE_WIDTH + slotIndex * POINTS_PER_SLOT
 *   pointCount:    u32  - actual points in the block (1..256)
 *   baseTimeDelta: f32  - blockBaseTime - globalBaseTime
 *   baseValueDelta: f32 - blockBaseValue - globalBaseValue
 */
export class BlockDescriptorBuffer {
  private readonly device: GPUDevice;
  private readonly buffer: GPUBuffer;
  private readonly cpuBuffer: ArrayBuffer;
  private readonly f32View: Float32Array;
  private readonly u32View: Uint32Array;
  private readonly allocator: SlotAllocator;
  private readonly maxBlocks: number;

  constructor(device: GPUDevice, allocator: SlotAllocator, maxBlocks: number = DEFAULT_MAX_BLOCKS) {
    this.device = device;
    this.allocator = allocator;
    this.maxBlocks = maxBlocks;

    const bufferSize = maxBlocks * BYTES_PER_DESCRIPTOR;

    this.buffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cpuBuffer = new ArrayBuffer(bufferSize);
    this.f32View = new Float32Array(this.cpuBuffer);
    this.u32View = new Uint32Array(this.cpuBuffer);
  }

  /**
   * Write block descriptors for visible blocks into the storage buffer.
   *
   * For line/candlestick chart types that use pair-wise rendering (iid, iid+1),
   * `needsStitching = true` means cross-block point pairs are included, so
   * totalInstances = totalPoints - 1.
   *
   * For point-based chart types (rhombus), `needsStitching = false` and
   * totalInstances = totalPoints.
   */
  writeDescriptors(
    blocks: ReadonlyArray<IBlockEntry>,
    needsStitching: boolean
  ): IDescriptorWriteResult {
    const blockCount = Math.min(blocks.length, this.maxBlocks);

    if (blockCount === 0) {
      return { totalInstances: 0, globalBaseTime: 0, globalBaseValue: 0 };
    }

    const globalBaseTime = blocks[0].baseTime;
    const globalBaseValue = blocks[0].baseValue;
    let totalPoints = 0;

    for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
      const block = blocks[blockIndex];
      const offset = blockIndex * FLOATS_PER_DESCRIPTOR;
      const textureOffset = this.allocator.getTextureOffset(block.slot);

      this.u32View[offset] = textureOffset;
      this.u32View[offset + 1] = block.pointCount;
      this.f32View[offset + 2] = block.baseTime - globalBaseTime;
      this.f32View[offset + 3] = block.baseValue - globalBaseValue;

      totalPoints += block.pointCount;
    }

    const bytesToWrite = blockCount * BYTES_PER_DESCRIPTOR;
    this.device.queue.writeBuffer(this.buffer, 0, this.cpuBuffer, 0, bytesToWrite);

    const totalInstances = needsStitching ? Math.max(0, totalPoints - 1) : totalPoints;

    return { totalInstances, globalBaseTime, globalBaseValue };
  }

  getBuffer(): GPUBuffer {
    return this.buffer;
  }

  getTextureWidth(): number {
    return TEXTURE_WIDTH;
  }

  dispose(): void {
    this.buffer.destroy();
  }
}
