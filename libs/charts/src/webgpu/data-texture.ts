import type { ISlotPoolGrowth } from '@frozik/utils/webgpu/lruSlotPool';
import { doubleSlotCapacity, LruSlotPool } from '@frozik/utils/webgpu/lruSlotPool';

import { CHANNELS_PER_TEXEL, SLOT_TEXELS, SLOTS_PER_ROW, TEXTURE_WIDTH } from './slot-layout';

const INITIAL_ROWS = 4;
const DEFAULT_MAX_ROWS = 512;
/** Four lossless 32-bit channels: integers as they are, fractions as the bits of a float32. */
const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32uint';

export interface IDataTextureOptions {
  readonly maxRows?: number;
  /** The slot was taken for another chunk: whoever held it must upload again before drawing. */
  readonly onEvict: (slot: number) => void;
}

/**
 * The data of one chart on the GPU: a texture cut into fixed slots, grown by
 * doubling and, at its ceiling, reusing the slots touched longest ago.
 */
export class DataTexture {
  private readonly pool: LruSlotPool;
  private texture: GPUTexture;
  private textureView: GPUTextureView;
  private grown = 0;

  constructor(
    private readonly device: GPUDevice,
    options: IDataTextureOptions
  ) {
    this.texture = this.createTexture(INITIAL_ROWS);
    this.textureView = this.texture.createView();
    this.pool = new LruSlotPool({
      initialCapacity: INITIAL_ROWS * SLOTS_PER_ROW,
      maxCapacity: (options.maxRows ?? DEFAULT_MAX_ROWS) * SLOTS_PER_ROW,
      growCapacity: doubleSlotCapacity,
      onGrow: growth => this.grow(growth),
      onEvict: options.onEvict,
    });
  }

  get view(): GPUTextureView {
    return this.textureView;
  }

  /** Changes whenever the texture was replaced by a larger one: bind groups made for the old one are stale. */
  get generation(): number {
    return this.grown;
  }

  /** `undefined` when the texture is full and nothing can be evicted. */
  acquire(): number | undefined {
    return this.pool.acquire();
  }

  touch(slot: number): void {
    this.pool.touch(slot);
  }

  release(slot: number): void {
    this.pool.release(slot);
  }

  /** Index of the slot's first texel, counted row by row. */
  texelOf(slot: number): number {
    return slot * SLOT_TEXELS;
  }

  write(slot: number, texels: Uint32Array<ArrayBuffer>): void {
    const texelCount = texels.length / CHANNELS_PER_TEXEL;
    const first = this.texelOf(slot);
    this.device.queue.writeTexture(
      {
        texture: this.texture,
        origin: [first % TEXTURE_WIDTH, Math.floor(first / TEXTURE_WIDTH), 0],
      },
      texels,
      { bytesPerRow: texels.byteLength, rowsPerImage: 1 },
      [texelCount, 1, 1]
    );
  }

  dispose(): void {
    this.texture.destroy();
    this.pool.clear();
  }

  private createTexture(rows: number): GPUTexture {
    return this.device.createTexture({
      size: [TEXTURE_WIDTH, rows],
      format: TEXTURE_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
  }

  private grow({ newCapacity, usedSlots }: ISlotPoolGrowth): void {
    const larger = this.createTexture(newCapacity / SLOTS_PER_ROW);
    if (usedSlots > 0) {
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToTexture({ texture: this.texture }, { texture: larger }, [
        TEXTURE_WIDTH,
        Math.ceil(usedSlots / SLOTS_PER_ROW),
        1,
      ]);
      this.device.queue.submit([encoder.finish()]);
    }
    this.texture.destroy();
    this.texture = larger;
    this.textureView = larger.createView();
    this.grown += 1;
  }
}
