import type { ISlotPoolGrowth } from '@frozik/utils/webgpu/lruSlotPool';
import { doubleSlotCapacity } from '@frozik/utils/webgpu/lruSlotPool';

import { FLOATS_PER_TEXEL, INITIAL_GPU_BLOCKS, MAX_GPU_BLOCKS } from '../../domain/constants';
import type { ITextureLayoutConfig, UnixTimeMs } from '../../domain/types';

import { KeyedSlotPool } from '../block-store/keyed-slot-pool';

const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';
const TEXTURE_USAGE =
  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;

export interface ITextureRowManagerParams {
  readonly device: GPUDevice;
  readonly layout: ITextureLayoutConfig;
  readonly initialBlocks?: number;
  readonly maxBlocks?: number;
  /** Called when a block is evicted from GPU so the owner can mark it in RBush. */
  readonly onEvict?: (blockId: UnixTimeMs) => void;
  /** Called after a grow recreates the backing texture; the owner must rebuild any bind group via {@link TextureRowManager.createView}. */
  readonly onTextureRecreated?: () => void;
}

/**
 * Manages the GPU data-texture as a fixed-width / growing-height buffer
 * divided into contiguous `rowsPerBlock`-row slots, one per orderbook
 * block.
 *
 * Slot bookkeeping (free list → high-water-mark → grow → LRU eviction,
 * plus the block↔slot mapping) is delegated to {@link KeyedSlotPool};
 * this class owns the multi-row texel layout and the uploads.
 */
export class TextureRowManager {
  private readonly device: GPUDevice;
  private readonly layout: ITextureLayoutConfig;
  private readonly onEvict: ((blockId: UnixTimeMs) => void) | undefined;
  private readonly onTextureRecreated: (() => void) | undefined;
  private readonly slots: KeyedSlotPool<UnixTimeMs>;

  private texture: GPUTexture;

  constructor(params: ITextureRowManagerParams) {
    const initialBlocks = params.initialBlocks ?? INITIAL_GPU_BLOCKS;

    this.device = params.device;
    this.layout = params.layout;
    this.onEvict = params.onEvict;
    this.onTextureRecreated = params.onTextureRecreated;

    this.texture = this.createBackingTexture(initialBlocks);
    this.slots = new KeyedSlotPool({
      initialCapacity: initialBlocks,
      maxCapacity: params.maxBlocks ?? MAX_GPU_BLOCKS,
      growCapacity: doubleSlotCapacity,
      onGrow: this.handleGrow,
      onEvict: this.handleEvict,
    });
  }

  /**
   * Reserve a slot for `blockId`. If the block already has a slot, return
   * it (updating LRU recency).
   */
  allocate(blockId: UnixTimeMs): number {
    return this.slots.allocate(blockId);
  }

  /** Refresh recency for an already-allocated block. */
  touch(blockId: UnixTimeMs): void {
    this.slots.touch(blockId);
  }

  /** Release a block's slot back to the free list. */
  release(blockId: UnixTimeMs): void {
    this.slots.free(blockId);
  }

  /**
   * Upload (partial or full) data for a block's slot starting at
   * `firstSnapshotIndex`.
   *
   * `snapshots` is the number of snapshots to write; the caller
   * provides a contiguous `Float32Array` covering those snapshots
   * starting at `dataOffsetFloats` within the array.
   */
  writeSnapshots(
    slotIndex: number,
    firstSnapshotIndex: number,
    snapshots: number,
    data: Float32Array,
    dataOffsetFloats: number
  ): void {
    const { textureWidth, rowsPerBlock, snapshotsPerRow } = this.layout;
    const snapshotSlots = textureWidth / snapshotsPerRow;
    const baseRow = slotIndex * rowsPerBlock;
    const bytesPerRow = textureWidth * FLOATS_PER_TEXEL * Float32Array.BYTES_PER_ELEMENT;

    let remaining = snapshots;
    let snapshotCursor = firstSnapshotIndex;
    let floatCursor = dataOffsetFloats;

    while (remaining > 0) {
      const rowOffsetInBlock = Math.floor(snapshotCursor / snapshotsPerRow);
      const columnSnapshot = snapshotCursor % snapshotsPerRow;
      const columnTexel = columnSnapshot * snapshotSlots;

      const snapshotsThisRow = Math.min(remaining, snapshotsPerRow - columnSnapshot);
      const texelsThisRow = snapshotsThisRow * snapshotSlots;
      const floatsThisRow = texelsThisRow * FLOATS_PER_TEXEL;

      this.device.queue.writeTexture(
        {
          texture: this.texture,
          origin: { x: columnTexel, y: baseRow + rowOffsetInBlock, z: 0 },
        },
        data.subarray(floatCursor, floatCursor + floatsThisRow),
        { bytesPerRow, rowsPerImage: 1 },
        { width: texelsThisRow, height: 1, depthOrArrayLayers: 1 }
      );

      remaining -= snapshotsThisRow;
      snapshotCursor += snapshotsThisRow;
      floatCursor += floatsThisRow;
    }
  }

  createView(): GPUTextureView {
    return this.texture.createView();
  }

  get currentCapacityBlocks(): number {
    return this.slots.capacity;
  }

  get currentAllocatedBlocks(): number {
    return this.slots.allocatedCount;
  }

  getSlotForBlock(blockId: UnixTimeMs): number | undefined {
    return this.slots.getSlot(blockId);
  }

  dispose(): void {
    this.texture.destroy();
    this.slots.clear();
  }

  private readonly handleEvict = (blockId: UnixTimeMs): void => {
    this.onEvict?.(blockId);
  };

  private readonly handleGrow = ({ newCapacity, usedSlots }: ISlotPoolGrowth): void => {
    const newTexture = this.createBackingTexture(newCapacity);

    if (usedSlots > 0) {
      const rowsUsed = usedSlots * this.layout.rowsPerBlock;
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToTexture(
        { texture: this.texture, origin: { x: 0, y: 0, z: 0 } },
        { texture: newTexture, origin: { x: 0, y: 0, z: 0 } },
        { width: this.layout.textureWidth, height: rowsUsed, depthOrArrayLayers: 1 }
      );
      this.device.queue.submit([encoder.finish()]);
    }

    this.texture.destroy();
    this.texture = newTexture;

    this.onTextureRecreated?.();
  };

  private createBackingTexture(capacityBlocks: number): GPUTexture {
    return this.device.createTexture({
      size: [this.layout.textureWidth, capacityBlocks * this.layout.rowsPerBlock],
      format: TEXTURE_FORMAT,
      usage: TEXTURE_USAGE,
    });
  }
}
