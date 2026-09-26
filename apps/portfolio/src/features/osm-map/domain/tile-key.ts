import type { GroundPoint } from './mercator';

export interface TileCoord {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** `z · 2^40 + x · 2^20 + y` — exact in a float64 up to zoom 20. */
export type TileKey = number;

const X_STRIDE = 2 ** 20;
const Z_STRIDE = 2 ** 40;
const CHILDREN_PER_TILE = 2;

export const ROOT_TILE: TileCoord = { z: 0, x: 0, y: 0 };

export function tileKeyOf({ z, x, y }: TileCoord): TileKey {
  return z * Z_STRIDE + x * X_STRIDE + y;
}

export function tileCoordOf(key: TileKey): TileCoord {
  const z = Math.floor(key / Z_STRIDE);
  const x = Math.floor((key - z * Z_STRIDE) / X_STRIDE);
  return { z, x, y: key - z * Z_STRIDE - x * X_STRIDE };
}

export function childrenOf({ z, x, y }: TileCoord): readonly TileCoord[] {
  const childZ = z + 1;
  const childX = x * CHILDREN_PER_TILE;
  const childY = y * CHILDREN_PER_TILE;
  return [
    { z: childZ, x: childX, y: childY },
    { z: childZ, x: childX + 1, y: childY },
    { z: childZ, x: childX, y: childY + 1 },
    { z: childZ, x: childX + 1, y: childY + 1 },
  ];
}

/** The tile at zoom `z` that contains `coord`; `coord` itself when already that coarse. */
export function ancestorAt({ z, x, y }: TileCoord, ancestorZ: number): TileCoord {
  const span = 2 ** (z - ancestorZ);
  return { z: ancestorZ, x: Math.floor(x / span), y: Math.floor(y / span) };
}

export interface GroundRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function tileWorldSize(z: number): number {
  return 1 / 2 ** z;
}

export function tileBounds({ z, x, y }: TileCoord): GroundRect {
  const size = tileWorldSize(z);
  return { minX: x * size, minY: y * size, maxX: (x + 1) * size, maxY: (y + 1) * size };
}

export function tileOrigin({ z, x, y }: TileCoord): GroundPoint {
  const size = tileWorldSize(z);
  return { x: x * size, y: y * size };
}
