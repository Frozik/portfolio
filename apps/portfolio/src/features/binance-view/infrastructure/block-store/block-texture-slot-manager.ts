import { assert } from '@frozik/utils/assert/assert';
import { LRUCache } from 'lru-cache';

/**
 * Bytes per texel for the texture formats this manager currently supports.
 * Extend the table when a new format is needed; an explicit lookup catches
 * misconfiguration at construction time.
 */
const BYTES_PER_TEXEL_BY_FORMAT: Partial<Record<GPUTextureFormat, number>> = {
  rgba32float: 16,
  rg32float: 8,
  r32float: 4,
};

export interface IBlockTextureSlotManagerOptions<TKey extends NonNullable<unknown>> {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  /** Texels occupied by a single slot along the X-axis. */
  readonly slotWidthTexels: number;
  /** Number of slots packed into one texture row (= floor(textureWidth / slotWidth)). */
  readonly slotsPerRow: number;
  /** Slot capacity at construction time. */
  readonly initialSlotCount: number;
  /** Hard upper bound on slot capacity — past this point, the LRU evicts. */
  readonly maxSlotCount: number;
  /** Number of additional slots to add when growing the texture. */
  readonly growStep: number;
  /** Invoked after a key has been LRU-evicted so the caller can clear cross-references. */
  readonly onEvict: (key: TKey) => void;
  readonly label?: string;
}

/**
 * Generic LRU-pool manager for **1-row strip + packed-slots** texture
 * geometry: each slot occupies a single contiguous run of
 * `slotWidthTexels` texels in a row, with `slotsPerRow` slots packed
 * per row. Used by mid-price (and later trades). The orderbook layer
 * uses {@link TextureRowManager} instead — its multi-row block geometry
 * is materially different and is not abstracted by this class.
 *
 * Allocation order:
 *   1. Existing slot for `key` (touch LRU recency).
 *   2. Free list (previously released slots).
 *   3. High-water-mark — append a new slot if below current capacity.
 *   4. Grow texture by `growStep` (up to `maxSlotCount`).
 *   5. LRU-evict the least-recently-used slot — fires `onEvict` with
 *      the evicted key, then reuses its slot.
 */
export class BlockTextureSlotManager<TKey extends NonNullable<unknown>> {
  private readonly device: GPUDevice;
  private readonly format: GPUTextureFormat;
  private readonly bytesPerTexel: number;
  private readonly slotWidthTexels: number;
  private readonly slotsPerRow: number;
  private readonly textureWidth: number;
  private readonly maxSlotCount: number;
  private readonly growStep: number;
  private readonly onEvict: (key: TKey) => void;
  private readonly label: string | undefined;

  private texture: GPUTexture;
  private capacitySlots: number;
  private highWaterMark = 0;
  private disposed = false;

  private readonly freeSlots: number[] = [];
  private readonly lru: LRUCache<number, TKey>;
  private readonly keyToSlot = new Map<TKey, number>();

  constructor(options: IBlockTextureSlotManagerOptions<TKey>) {
    assert(
      options.slotWidthTexels > 0,
      'BlockTextureSlotManager: slotWidthTexels must be positive'
    );
    assert(options.slotsPerRow > 0, 'BlockTextureSlotManager: slotsPerRow must be positive');
    assert(
      options.initialSlotCount > 0,
      'BlockTextureSlotManager: initialSlotCount must be positive'
    );
    assert(
      options.maxSlotCount >= options.initialSlotCount,
      'BlockTextureSlotManager: maxSlotCount must be >= initialSlotCount'
    );
    assert(options.growStep > 0, 'BlockTextureSlotManager: growStep must be positive');

    const bytesPerTexel = BYTES_PER_TEXEL_BY_FORMAT[options.format];
    assert(
      bytesPerTexel !== undefined,
      `BlockTextureSlotManager: unsupported texture format "${options.format}"`
    );

    this.device = options.device;
    this.format = options.format;
    this.bytesPerTexel = bytesPerTexel;
    this.slotWidthTexels = options.slotWidthTexels;
    this.slotsPerRow = options.slotsPerRow;
    this.textureWidth = options.slotWidthTexels * options.slotsPerRow;
    this.maxSlotCount = options.maxSlotCount;
    this.growStep = options.growStep;
    this.onEvict = options.onEvict;
    this.label = options.label;
    this.capacitySlots = options.initialSlotCount;

    this.texture = this.createBackingTexture(this.capacitySlots);
    this.lru = new LRUCache({ max: this.maxSlotCount });
  }

  allocate(key: TKey): number {
    this.assertNotDisposed();

    const existing = this.keyToSlot.get(key);
    if (existing !== undefined) {
      this.lru.get(existing);
      return existing;
    }

    const slotIndex =
      this.popFreeSlot() ??
      this.advanceHighWaterMark() ??
      this.growAndAdvance() ??
      this.evictAndReuseSlot();

    this.keyToSlot.set(key, slotIndex);
    this.lru.set(slotIndex, key);
    return slotIndex;
  }

  touch(key: TKey): void {
    const slotIndex = this.keyToSlot.get(key);
    if (slotIndex !== undefined) {
      this.lru.get(slotIndex);
    }
  }

  free(key: TKey): void {
    const slotIndex = this.keyToSlot.get(key);
    if (slotIndex === undefined) {
      return;
    }
    this.keyToSlot.delete(key);
    this.lru.delete(slotIndex);
    this.freeSlots.push(slotIndex);
  }

  getSlot(key: TKey): number | undefined {
    return this.keyToSlot.get(key);
  }

  /**
   * Write a `(writeWidthTexels × 1)` strip into `slotIndex`, starting
   * at `(columnInSlot, 0)` inside the slot. `data` is the raw byte view
   * of the source — the caller is responsible for matching the texture
   * format (e.g. for `rgba32float`, 16 bytes per texel).
   */
  writeRegion(
    slotIndex: number,
    columnInSlot: number,
    data: Uint8Array,
    writeWidthTexels: number
  ): void {
    this.assertNotDisposed();
    if (writeWidthTexels <= 0) {
      return;
    }
    assert(
      columnInSlot >= 0 && columnInSlot + writeWidthTexels <= this.slotWidthTexels,
      'BlockTextureSlotManager.writeRegion: write extends past slot bounds'
    );

    const { row, column } = this.slotOriginToTexelCoord(slotIndex);
    const bytesPerRow = this.textureWidth * this.bytesPerTexel;

    this.device.queue.writeTexture(
      { texture: this.texture, origin: { x: column + columnInSlot, y: row, z: 0 } },
      data,
      { bytesPerRow, rowsPerImage: 1 },
      { width: writeWidthTexels, height: 1, depthOrArrayLayers: 1 }
    );
  }

  /** Starting texel offset (`row * textureWidth + column`) for the slot. */
  slotTextureOffset(slotIndex: number): number {
    const { row, column } = this.slotOriginToTexelCoord(slotIndex);
    return row * this.textureWidth + column;
  }

  get textureView(): GPUTextureView {
    this.assertNotDisposed();
    return this.texture.createView();
  }

  get currentCapacitySlots(): number {
    return this.capacitySlots;
  }

  get currentAllocatedSlots(): number {
    return this.keyToSlot.size;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.texture.destroy();
    this.lru.clear();
    this.keyToSlot.clear();
    this.freeSlots.length = 0;
  }

  private assertNotDisposed(): void {
    assert(!this.disposed, 'BlockTextureSlotManager: instance is disposed');
  }

  private slotOriginToTexelCoord(slotIndex: number): { row: number; column: number } {
    const row = Math.floor(slotIndex / this.slotsPerRow);
    const column = (slotIndex % this.slotsPerRow) * this.slotWidthTexels;
    return { row, column };
  }

  private popFreeSlot(): number | undefined {
    return this.freeSlots.pop();
  }

  private advanceHighWaterMark(): number | undefined {
    if (this.highWaterMark >= this.capacitySlots) {
      return undefined;
    }
    const slotIndex = this.highWaterMark;
    this.highWaterMark++;
    return slotIndex;
  }

  private growAndAdvance(): number | undefined {
    if (this.capacitySlots >= this.maxSlotCount) {
      return undefined;
    }
    const newCapacity = Math.min(this.capacitySlots + this.growStep, this.maxSlotCount);
    this.growTexture(newCapacity);
    const slotIndex = this.highWaterMark;
    this.highWaterMark++;
    return slotIndex;
  }

  private evictAndReuseSlot(): number {
    const oldestSlot = this.lru.rkeys().next().value;
    assert(
      oldestSlot !== undefined,
      'BlockTextureSlotManager: cannot evict — LRU empty despite exhausted capacity'
    );
    const evictedKey = this.lru.get(oldestSlot);
    this.lru.delete(oldestSlot);
    if (evictedKey !== undefined) {
      this.keyToSlot.delete(evictedKey);
      this.onEvict(evictedKey);
    }
    return oldestSlot;
  }

  private growTexture(newCapacitySlots: number): void {
    const newTexture = this.createBackingTexture(newCapacitySlots);

    if (this.highWaterMark > 0) {
      const oldHeightRows = Math.ceil(this.capacitySlots / this.slotsPerRow);
      const usedHeightRows = Math.min(
        oldHeightRows,
        Math.ceil(this.highWaterMark / this.slotsPerRow)
      );
      const encoder = this.device.createCommandEncoder({ label: this.growEncoderLabel() });
      encoder.copyTextureToTexture(
        { texture: this.texture, origin: { x: 0, y: 0, z: 0 } },
        { texture: newTexture, origin: { x: 0, y: 0, z: 0 } },
        { width: this.textureWidth, height: usedHeightRows, depthOrArrayLayers: 1 }
      );
      this.device.queue.submit([encoder.finish()]);
    }

    this.texture.destroy();
    this.texture = newTexture;
    this.capacitySlots = newCapacitySlots;
  }

  private createBackingTexture(capacitySlots: number): GPUTexture {
    const heightRows = Math.ceil(capacitySlots / this.slotsPerRow);
    const textureUsage =
      GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;
    return this.device.createTexture({
      size: [this.textureWidth, heightRows],
      format: this.format,
      usage: textureUsage,
      label: this.label,
    });
  }

  private growEncoderLabel(): string | undefined {
    return this.label === undefined ? undefined : `${this.label}.grow`;
  }
}
