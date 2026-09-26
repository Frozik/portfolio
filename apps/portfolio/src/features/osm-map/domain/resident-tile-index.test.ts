import { ResidentTileIndex } from './resident-tile-index';
import { tileKeyOf } from './tile-key';

describe('resident tile index', () => {
  it('finds the deepest resident ancestor of a tile', () => {
    const index = new ResidentTileIndex();
    index.insert({ z: 10, x: 5, y: 3 });
    index.insert({ z: 12, x: 21, y: 13 });
    index.insert({ z: 12, x: 22, y: 13 });

    expect(index.nearestAncestor({ z: 14, x: 86, y: 54 })).toEqual({ z: 12, x: 21, y: 13 });
    expect(index.nearestAncestor({ z: 14, x: 95, y: 54 })).toEqual({ z: 10, x: 5, y: 3 });
    expect(index.nearestAncestor({ z: 14, x: 0, y: 0 })).toBeUndefined();
  });

  it('lists resident descendants down to a depth and ignores neighbours', () => {
    const index = new ResidentTileIndex();
    index.insert({ z: 15, x: 10, y: 10 });
    index.insert({ z: 15, x: 11, y: 11 });
    index.insert({ z: 15, x: 12, y: 10 });
    index.insert({ z: 19, x: 160, y: 160 });

    const found = index.descendants({ z: 14, x: 5, y: 5 }, 3);

    expect(found).toEqual(
      expect.arrayContaining([
        { z: 15, x: 10, y: 10 },
        { z: 15, x: 11, y: 11 },
      ])
    );
    expect(found).toHaveLength(2);
  });

  it('forgets a tile once removed and tolerates repeats', () => {
    const index = new ResidentTileIndex();
    const coord = { z: 12, x: 21, y: 13 };
    index.insert(coord);
    index.insert(coord);

    expect(index.size).toBe(1);
    index.remove(tileKeyOf(coord));
    index.remove(tileKeyOf(coord));

    expect(index.size).toBe(0);
    expect(index.nearestAncestor({ z: 14, x: 86, y: 54 })).toBeUndefined();
  });
});
