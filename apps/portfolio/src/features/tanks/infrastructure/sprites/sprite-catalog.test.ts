import { describe, expect, it } from 'vitest';

import { createSpriteCatalog } from './sprite-catalog';
import { getBrickSpriteId, getPlayerTankSpriteId, WATER_SPRITE_ID } from './sprite-ids';
import { TRANSPARENT_PIXEL } from './sprite-types';

const catalog = createSpriteCatalog();

describe('sprite catalog', () => {
  it('holds rectangular bitmaps', () => {
    for (const [id, definition] of catalog) {
      const rowWidths = new Set(definition.bitmap.map(row => row.length));

      expect(rowWidths.size, `sprite ${id} has rows of different widths`).toBe(1);
      expect(definition.bitmap.length, `sprite ${id} is empty`).toBeGreaterThan(0);
    }
  });

  it('splits every bitmap into whole animation frames', () => {
    for (const [id, definition] of catalog) {
      const width = definition.bitmap[0].length;

      expect(definition.frameCount, `sprite ${id} has no frames`).toBeGreaterThan(0);
      expect(width % definition.frameCount, `sprite ${id} has a partial frame`).toBe(0);
    }
  });

  it('resolves every pixel through the sprite palette', () => {
    for (const [id, definition] of catalog) {
      for (const row of definition.bitmap) {
        for (const pixel of row) {
          const isKnown = pixel === TRANSPARENT_PIXEL || pixel in definition.palette;

          expect(isKnown, `sprite ${id} uses unknown pixel '${pixel}'`).toBe(true);
        }
      }
    }
  });

  it('covers all 16 brick damage variants', () => {
    const booleans = [false, true];

    for (const topLeft of booleans) {
      for (const topRight of booleans) {
        for (const bottomLeft of booleans) {
          for (const bottomRight of booleans) {
            const id = getBrickSpriteId({ topLeft, topRight, bottomLeft, bottomRight });

            expect(catalog.has(id), `missing brick variant ${id}`).toBe(true);
          }
        }
      }
    }
  });

  it('blanks the quadrants a bullet already removed', () => {
    const intactId = getBrickSpriteId({
      topLeft: true,
      topRight: true,
      bottomLeft: true,
      bottomRight: true,
    });
    const chippedId = getBrickSpriteId({
      topLeft: false,
      topRight: true,
      bottomLeft: true,
      bottomRight: true,
    });

    const intact = catalog.get(intactId)?.bitmap ?? [];
    const chipped = catalog.get(chippedId)?.bitmap ?? [];

    expect(chipped[0].slice(0, 4)).toBe('....');
    expect(chipped[0].slice(4)).toBe(intact[0].slice(4));
    expect(chipped[7]).toBe(intact[7]);
  });

  it('packs the water shimmer as two frames', () => {
    const water = catalog.get(WATER_SPRITE_ID);

    expect(water?.frameCount).toBe(2);
  });

  it('gives every star level its own player tank art', () => {
    const starLevels = [0, 1, 2, 3];
    const accents = starLevels.map(
      starLevel => catalog.get(getPlayerTankSpriteId(0, starLevel, 0))?.palette['2']
    );

    expect(new Set(accents).size).toBe(starLevels.length);
  });
});
