import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { SpriteCatalog, SpriteDefinition } from './sprites/sprite-types';
import { TRANSPARENT_PIXEL } from './sprites/sprite-types';

const ATLAS_WIDTH_PX = 256;
/** One transparent texel between sprites so nearest sampling can never pick up a neighbour. */
const SPRITE_GUTTER_PX = 1;
const BYTES_PER_TEXEL = 4;
const HEX_RADIX = 16;
const HEX_COLOR_LENGTH = 7;
const OPAQUE_ALPHA = 255;

export interface AtlasUvRect {
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

/** What the render layers need from the atlas: where a sprite sits and how it animates. */
export interface SpriteUvLookup {
  /** UV rect of the whole sprite, animation frames included. */
  getUvRect(spriteId: string): AtlasUvRect;
  getFrameCount(spriteId: string): number;
}

export interface SpriteAtlas extends SpriteUvLookup {
  readonly textureView: GPUTextureView;
  dispose(): void;
}

interface PackedSprite {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
}

interface PackedAtlas {
  readonly placements: ReadonlyMap<string, PackedSprite>;
  readonly height: number;
}

function getBitmapWidth(definition: SpriteDefinition): number {
  return definition.bitmap[0].length;
}

/** Shelf packer: sprites are laid out in rows of descending height, which is plenty for a
 * few dozen tiny pixel-art tiles and keeps the atlas well under 512 × 512. */
function packSprites(catalog: SpriteCatalog): PackedAtlas {
  const entries = [...catalog.entries()].sort(
    ([, left], [, right]) => right.bitmap.length - left.bitmap.length
  );

  const placements = new Map<string, PackedSprite>();

  let shelfY = 0;
  let shelfHeight = 0;
  let cursorX = 0;

  for (const [spriteId, definition] of entries) {
    const width = getBitmapWidth(definition);
    const height = definition.bitmap.length;

    assert(
      width <= ATLAS_WIDTH_PX,
      `sprite ${spriteId} is ${width} px wide, wider than the ${ATLAS_WIDTH_PX} px atlas`
    );

    if (cursorX + width > ATLAS_WIDTH_PX) {
      shelfY += shelfHeight + SPRITE_GUTTER_PX;
      shelfHeight = 0;
      cursorX = 0;
    }

    placements.set(spriteId, {
      x: cursorX,
      y: shelfY,
      width,
      height,
      frameCount: definition.frameCount,
    });

    cursorX += width + SPRITE_GUTTER_PX;
    shelfHeight = Math.max(shelfHeight, height);
  }

  return { placements, height: shelfY + shelfHeight };
}

function parseHexColor(hex: string): readonly [number, number, number] {
  assert(
    hex.length === HEX_COLOR_LENGTH && hex.startsWith('#'),
    `invalid sprite color ${hex}, expected #RRGGBB`
  );

  return [
    Number.parseInt(hex.slice(1, 3), HEX_RADIX),
    Number.parseInt(hex.slice(3, 5), HEX_RADIX),
    Number.parseInt(hex.slice(5, 7), HEX_RADIX),
  ];
}

function rasterizeSprite(
  pixels: Uint8Array,
  atlasHeight: number,
  placement: PackedSprite,
  definition: SpriteDefinition
): void {
  definition.bitmap.forEach((row, rowIndex) => {
    [...row].forEach((pixel, columnIndex) => {
      if (pixel === TRANSPARENT_PIXEL) {
        return;
      }

      const color = definition.palette[pixel];

      assert(!isNil(color), `sprite palette has no color for pixel '${pixel}'`);

      const [red, green, blue] = parseHexColor(color);
      const texelX = placement.x + columnIndex;
      const texelY = placement.y + rowIndex;

      assert(texelY < atlasHeight, 'sprite placement exceeds the atlas height');

      const offset = (texelY * ATLAS_WIDTH_PX + texelX) * BYTES_PER_TEXEL;

      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = OPAQUE_ALPHA;
    });
  });
}

/** No image files and no `copyExternalImageToTexture` — the art is TypeScript data. */
export function createSpriteAtlas(device: GPUDevice, catalog: SpriteCatalog): SpriteAtlas {
  const { placements, height } = packSprites(catalog);
  const pixels = new Uint8Array(ATLAS_WIDTH_PX * height * BYTES_PER_TEXEL);

  for (const [spriteId, placement] of placements) {
    const definition = catalog.get(spriteId);

    assert(!isNil(definition), `sprite ${spriteId} vanished from the catalog`);

    rasterizeSprite(pixels, height, placement, definition);
  }

  const texture = device.createTexture({
    size: [ATLAS_WIDTH_PX, height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    pixels,
    { bytesPerRow: ATLAS_WIDTH_PX * BYTES_PER_TEXEL, rowsPerImage: height },
    { width: ATLAS_WIDTH_PX, height }
  );

  const textureView = texture.createView();

  function resolvePlacement(spriteId: string): PackedSprite {
    const placement = placements.get(spriteId);

    assert(!isNil(placement), `unknown sprite ${spriteId}`);

    return placement;
  }

  return {
    textureView,
    getUvRect(spriteId: string): AtlasUvRect {
      const placement = resolvePlacement(spriteId);

      return {
        minU: placement.x / ATLAS_WIDTH_PX,
        minV: placement.y / height,
        maxU: (placement.x + placement.width) / ATLAS_WIDTH_PX,
        maxV: (placement.y + placement.height) / height,
      };
    },
    getFrameCount(spriteId: string): number {
      return resolvePlacement(spriteId).frameCount;
    },
    dispose(): void {
      texture.destroy();
    },
  };
}
