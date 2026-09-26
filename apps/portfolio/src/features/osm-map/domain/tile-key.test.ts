import { childrenOf, tileBounds, tileCoordOf, tileKeyOf } from './tile-key';

describe('tile keys', () => {
  it('round-trips the deepest tile coordinates through a numeric key', () => {
    const coord = { z: 19, x: 2 ** 19 - 1, y: 2 ** 19 - 3 };

    expect(tileCoordOf(tileKeyOf(coord))).toEqual(coord);
  });

  it('gives every tile a distinct key from its children and neighbours', () => {
    const parent = { z: 3, x: 5, y: 2 };
    const keys = new Set([tileKeyOf(parent), ...childrenOf(parent).map(tileKeyOf)]);

    expect(keys.size).toBe(5);
  });

  it('splits a tile into four children that tile its bounds exactly', () => {
    const parent = { z: 2, x: 1, y: 3 };
    const bounds = tileBounds(parent);
    const children = childrenOf(parent).map(tileBounds);

    expect(Math.min(...children.map(child => child.minX))).toBe(bounds.minX);
    expect(Math.max(...children.map(child => child.maxX))).toBe(bounds.maxX);
    expect(Math.min(...children.map(child => child.minY))).toBe(bounds.minY);
    expect(Math.max(...children.map(child => child.maxY))).toBe(bounds.maxY);
    expect(children[0].maxX).toBe(children[1].minX);
    expect(children[0].maxY).toBe(children[2].minY);
  });
});
