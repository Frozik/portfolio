import { random } from 'lodash-es';

import { FIELD_HEIGHT_WU, FIELD_WIDTH_WU } from '../domain/constants';
import type { Heightfield, TerrainColumn } from '../domain/terrain/heightfield';
import {
  CHANNELS_PER_TEXEL,
  MAX_CHANNEL_VALUE,
  PALETTE_NOISE_TILE_SIZE,
  SUPPORTED_TEXEL_ALPHA,
  TERRAIN_TEXTURE_FORMAT,
} from './render-constants';

const EMPTY_CHANNEL = 0;
const DIRT_PRESENT = MAX_CHANNEL_VALUE;
const TEXTURE_COUNT = 2;
const FIRST_TEXTURE_INDEX = 0;

/** Row 0 is the top of the field, so a texel row counts down from the field ceiling. */
function toWorldY(row: number, heightWu: number): number {
  return heightWu - row - 0.5;
}

function createPaletteNoiseTile(): Uint8Array {
  const tile = new Uint8Array(PALETTE_NOISE_TILE_SIZE * PALETTE_NOISE_TILE_SIZE);

  for (let index = 0; index < tile.length; index++) {
    tile[index] = random(MAX_CHANNEL_VALUE);
  }

  return tile;
}

/**
 * The pair of terrain textures the compute passes ping-pong between (§11.1). One texel is one
 * world unit: red carries dirt presence, green a palette variation that travels with the dirt as
 * it falls, blue the scorch left by a blast.
 *
 * The CPU only ever writes the whole thing — at the start of a round, or when the domain does
 * something to the field that a stamp cannot express. Everything in between is GPU work.
 */
export class TerrainTextureSet {
  private readonly textures: readonly GPUTexture[];
  private readonly views: readonly GPUTextureView[];
  private readonly texels: Uint8Array;
  private readonly paletteNoise = createPaletteNoiseTile();
  private currentIndexValue = FIRST_TEXTURE_INDEX;

  constructor(
    private readonly device: GPUDevice,
    readonly widthWu: number = FIELD_WIDTH_WU,
    readonly heightWu: number = FIELD_HEIGHT_WU
  ) {
    this.texels = new Uint8Array(widthWu * heightWu * CHANNELS_PER_TEXEL);
    this.textures = Array.from({ length: TEXTURE_COUNT }, () =>
      device.createTexture({
        size: [widthWu, heightWu],
        format: TERRAIN_TEXTURE_FORMAT,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.COPY_DST,
      })
    );
    this.views = this.textures.map(texture => texture.createView());
  }

  /** The texture the render pass must sample and the next compute pass must read. */
  get currentIndex(): number {
    return this.currentIndexValue;
  }

  get currentView(): GPUTextureView {
    return this.views[this.currentIndexValue];
  }

  getView(index: number): GPUTextureView {
    return this.views[index];
  }

  /** Hands the compute pass its source and destination, then makes the destination current. */
  swap(): void {
    this.currentIndexValue = (this.currentIndexValue + 1) % TEXTURE_COUNT;
  }

  /** Uploads the domain's terrain into both textures, discarding every scorch mark with it. */
  sync(field: Heightfield): void {
    for (let column = 0; column < this.widthWu; column++) {
      this.writeColumn(column, field[column]);
    }

    for (const texture of this.textures) {
      this.device.queue.writeTexture(
        { texture },
        this.texels,
        { bytesPerRow: this.widthWu * CHANNELS_PER_TEXEL, rowsPerImage: this.heightWu },
        { width: this.widthWu, height: this.heightWu }
      );
    }

    this.currentIndexValue = FIRST_TEXTURE_INDEX;
  }

  dispose(): void {
    for (const texture of this.textures) {
      texture.destroy();
    }
  }

  private writeColumn(column: number, terrainColumn: TerrainColumn | undefined): void {
    const surfaceHeight = terrainColumn?.surfaceHeight ?? 0;

    for (let row = 0; row < this.heightWu; row++) {
      const worldY = toWorldY(row, this.heightWu);
      const isDirt = worldY < surfaceHeight;
      const offset = (row * this.widthWu + column) * CHANNELS_PER_TEXEL;

      this.texels[offset] = isDirt ? DIRT_PRESENT : EMPTY_CHANNEL;
      this.texels[offset + 1] = isDirt ? this.readPaletteNoise(column, row) : EMPTY_CHANNEL;
      this.texels[offset + 2] = EMPTY_CHANNEL;
      this.texels[offset + 3] = SUPPORTED_TEXEL_ALPHA;
    }
  }

  private readPaletteNoise(column: number, row: number): number {
    const tileX = column % PALETTE_NOISE_TILE_SIZE;
    const tileY = row % PALETTE_NOISE_TILE_SIZE;

    return this.paletteNoise[tileY * PALETTE_NOISE_TILE_SIZE + tileX];
  }
}
