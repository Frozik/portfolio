import { KeyedSlotPool } from '@frozik/utils/webgpu/keyedSlotPool';
import type { ISlotPoolGrowth } from '@frozik/utils/webgpu/lruSlotPool';
import { doubleSlotCapacity } from '@frozik/utils/webgpu/lruSlotPool';
import { generateMipmap } from 'webgpu-utils';

import { INITIAL_ATLAS_LAYERS, MIP_LEVEL_COUNT, TILE_SIZE_PX } from '../domain/constants';
import type { TileAtlasPort } from '../domain/ports/tile-atlas';
import { ResidentTileIndex } from '../domain/resident-tile-index';
import type { TileKey } from '../domain/tile-key';
import { tileCoordOf } from '../domain/tile-key';

const ATLAS_FORMAT: GPUTextureFormat = 'rgba8unorm';
const ONE_LAYER = 1;

/**
 * Every decoded tile lives in one layer of a mip-mapped `texture_2d_array`.
 * WebGPU writes only mip 0 of a layer and builds no mips itself, so a tile
 * lands in a single-layer staging texture, `generateMipmap` fills its chain,
 * and each level is copied into the layer. The array grows by doubling and
 * evicts the least recently used tile at its ceiling. Images are borrowed
 * for the upload only; the caller closes them.
 */
export class TileAtlas implements TileAtlasPort {
  private readonly slots: KeyedSlotPool<TileKey>;
  readonly coverage = new ResidentTileIndex();
  private readonly staging: GPUTexture;
  private texture: GPUTexture;
  /** Bumped whenever the array texture is recreated, so bind groups can follow it. */
  private textureVersion = 0;

  constructor(
    private readonly device: GPUDevice,
    /** The device's array-layer limit, or less; growth stops and eviction starts here. */
    maxLayers: number
  ) {
    this.texture = this.createArrayTexture(INITIAL_ATLAS_LAYERS);
    this.staging = device.createTexture({
      size: [TILE_SIZE_PX, TILE_SIZE_PX],
      format: ATLAS_FORMAT,
      mipLevelCount: MIP_LEVEL_COUNT,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.slots = new KeyedSlotPool<TileKey>({
      initialCapacity: INITIAL_ATLAS_LAYERS,
      maxCapacity: Math.max(INITIAL_ATLAS_LAYERS, maxLayers),
      growCapacity: doubleSlotCapacity,
      onGrow: this.handleGrow,
      onEvict: key => this.coverage.remove(key),
    });
  }

  get version(): number {
    return this.textureVersion;
  }

  get capacity(): number {
    return this.slots.capacity;
  }

  get usedCount(): number {
    return this.slots.allocatedCount;
  }

  createView(): GPUTextureView {
    return this.texture.createView({ dimension: '2d-array' });
  }

  store(key: TileKey, image: ImageBitmap): void {
    const layer = this.slots.allocate(key);
    this.coverage.insert(tileCoordOf(key));
    this.device.queue.copyExternalImageToTexture({ source: image }, { texture: this.staging }, [
      TILE_SIZE_PX,
      TILE_SIZE_PX,
    ]);
    generateMipmap(this.device, this.staging);

    const encoder = this.device.createCommandEncoder();
    for (let mipLevel = 0; mipLevel < MIP_LEVEL_COUNT; mipLevel++) {
      const size = TILE_SIZE_PX >> mipLevel;
      encoder.copyTextureToTexture(
        { texture: this.staging, mipLevel },
        { texture: this.texture, mipLevel, origin: [0, 0, layer] },
        [size, size, ONE_LAYER]
      );
    }
    this.device.queue.submit([encoder.finish()]);
  }

  layerOf(key: TileKey): number | undefined {
    return this.slots.getSlot(key);
  }

  has(key: TileKey): boolean {
    return this.slots.getSlot(key) !== undefined;
  }

  touch(key: TileKey): void {
    this.slots.touch(key);
  }

  dispose(): void {
    this.staging.destroy();
    this.texture.destroy();
  }

  private createArrayTexture(layers: number): GPUTexture {
    return this.device.createTexture({
      size: [TILE_SIZE_PX, TILE_SIZE_PX, layers],
      format: ATLAS_FORMAT,
      mipLevelCount: MIP_LEVEL_COUNT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
  }

  private readonly handleGrow = ({ newCapacity, usedSlots }: ISlotPoolGrowth): void => {
    const grown = this.createArrayTexture(newCapacity);
    if (usedSlots > 0) {
      const encoder = this.device.createCommandEncoder();
      for (let mipLevel = 0; mipLevel < MIP_LEVEL_COUNT; mipLevel++) {
        const size = TILE_SIZE_PX >> mipLevel;
        encoder.copyTextureToTexture(
          { texture: this.texture, mipLevel },
          { texture: grown, mipLevel },
          [size, size, usedSlots]
        );
      }
      this.device.queue.submit([encoder.finish()]);
    }
    this.texture.destroy();
    this.texture = grown;
    this.textureVersion++;
  };
}
