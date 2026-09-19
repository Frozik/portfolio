import type { Vector2 } from '@frozik/utils/math/vector2';

import type { MeshWriter } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';

/** Where along the limb each thing is painted, and how big it is against the limb's own half width there. */
const BLOOM_SHARES = [0.34, 0.66] as const;
const BLOOM_PETALS = 6;
const BLOOM_PETAL_RADIUS_SHARE = 0.36;
const BLOOM_PETAL_AWAY_SHARE = 0.5;
const BLOOM_HEART_RADIUS_SHARE = 0.3;
const CLUSTER_SHARES = [0.2, 0.5, 0.8] as const;
const CLUSTER_BERRIES = 3;
const BERRY_RADIUS_SHARE = 0.28;
const BERRY_AWAY_SHARE = 0.42;
const BERRY_SHINE_SHARE = 0.36;
const LEAF_SHARES = [0.12, 0.44, 0.74] as const;
const LEAF_LENGTH_SHARE = 1.5;
const LEAF_HALF_WIDTH_SHARE = 0.42;
const LEAF_AWAY_SHARE = 0.55;
/** The horn: a pale binding where the string is hitched, and a red cap at the very end. */
const BINDING_SHARE = 0.9;
const BINDING_LENGTH_SHARE = 1.1;
const BINDING_HALF_WIDTH_SHARE = 1.35;
const CAP_SHARE = 0.98;
const CAP_RADIUS_SHARE = 1.2;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

/** A limb as the painter sees it: the line it runs along, how wide it is at each point of that line, and how strongly it shows. */
export interface PaintedLimb {
  readonly path: readonly Vector2[];
  /** Board metres, at the path point of that index. */
  readonly halfWidthAt: (index: number) => number;
  readonly alpha: number;
}

/**
 * The Khokhloma on a bow's limb, the way it runs on a painted one: golden
 * blooms down the broad of the limb, clusters of red berries between them,
 * leaves off to the sides, and at the horn a pale binding for the string
 * with a red cap over the end.
 */
export function paintLimb(writer: MeshWriter, limb: PaintedLimb): void {
  for (const share of BLOOM_SHARES) {
    writeBloom(writer, limb, share);
  }
  for (const share of CLUSTER_SHARES) {
    writeCluster(writer, limb, share);
  }
  LEAF_SHARES.forEach((share, index) => {
    writeLeaf(writer, limb, share, index % 2 === 0 ? 1 : -1);
  });
  writeHorn(writer, limb);
}

/** A golden bloom: petals round a darker heart, the biggest thing on the limb. */
function writeBloom(writer: MeshWriter, limb: PaintedLimb, share: number): void {
  const { at, across, halfWidth } = placeOn(limb, share);
  const gold = withAlpha(PALETTE.rim, limb.alpha);
  const turn = Math.atan2(across.y, across.x);
  for (let petal = 0; petal < BLOOM_PETALS; petal += 1) {
    const angle = turn + (petal / BLOOM_PETALS) * FULL_TURN;
    writer.circle(
      {
        x: at.x + Math.cos(angle) * halfWidth * BLOOM_PETAL_AWAY_SHARE,
        y: at.y + Math.sin(angle) * halfWidth * BLOOM_PETAL_AWAY_SHARE,
      },
      halfWidth * BLOOM_PETAL_RADIUS_SHARE,
      gold
    );
  }
  writer.circle(at, halfWidth * BLOOM_HEART_RADIUS_SHARE, withAlpha(PALETTE.berry, limb.alpha));
}

/** A cluster of berries, each with its shine: three of them across the limb. */
function writeCluster(writer: MeshWriter, limb: PaintedLimb, share: number): void {
  const { at, across, halfWidth } = placeOn(limb, share);
  const turn = Math.atan2(across.y, across.x);
  for (let berry = 0; berry < CLUSTER_BERRIES; berry += 1) {
    const angle = turn + QUARTER_TURN + (berry / CLUSTER_BERRIES) * FULL_TURN;
    const middle = {
      x: at.x + Math.cos(angle) * halfWidth * BERRY_AWAY_SHARE,
      y: at.y + Math.sin(angle) * halfWidth * BERRY_AWAY_SHARE,
    };
    const radius = halfWidth * BERRY_RADIUS_SHARE;
    writer.circle(middle, radius, withAlpha(PALETTE.berry, limb.alpha));
    writer.circle(
      { x: middle.x - radius * BERRY_SHINE_SHARE, y: middle.y + radius * BERRY_SHINE_SHARE },
      radius * BERRY_SHINE_SHARE,
      withAlpha(PALETTE.bandGold, limb.alpha)
    );
  }
}

/** A gold leaf lying along the limb, off to one side of it. */
function writeLeaf(writer: MeshWriter, limb: PaintedLimb, share: number, side: number): void {
  const { at, along, across, halfWidth } = placeOn(limb, share);
  const middle = {
    x: at.x + across.x * halfWidth * LEAF_AWAY_SHARE * side,
    y: at.y + across.y * halfWidth * LEAF_AWAY_SHARE * side,
  };
  const half = (halfWidth * LEAF_LENGTH_SHARE) / 2;
  const wide = halfWidth * LEAF_HALF_WIDTH_SHARE;
  writer.convexPolygon(
    [
      { x: middle.x - along.x * half, y: middle.y - along.y * half },
      { x: middle.x + across.x * wide * side, y: middle.y + across.y * wide * side },
      { x: middle.x + along.x * half, y: middle.y + along.y * half },
      { x: middle.x - across.x * wide * side * 0.35, y: middle.y - across.y * wide * side * 0.35 },
    ],
    withAlpha(PALETTE.rim, limb.alpha)
  );
}

/** The horn of the limb: the string's binding and the cap over the end. */
function writeHorn(writer: MeshWriter, limb: PaintedLimb): void {
  const binding = placeOn(limb, BINDING_SHARE);
  const half = (binding.halfWidth * BINDING_LENGTH_SHARE) / 2;
  writer.ribbon(
    [
      {
        x: binding.at.x - binding.along.x * half,
        y: binding.at.y - binding.along.y * half,
      },
      {
        x: binding.at.x + binding.along.x * half,
        y: binding.at.y + binding.along.y * half,
      },
    ],
    () => ({
      halfWidth: binding.halfWidth * BINDING_HALF_WIDTH_SHARE,
      color: withAlpha(PALETTE.steelLight, limb.alpha),
    })
  );
  const cap = placeOn(limb, CAP_SHARE);
  writer.circle(cap.at, cap.halfWidth * CAP_RADIUS_SHARE, withAlpha(PALETTE.berry, limb.alpha));
}

/** A place on the limb: the point, the way the limb runs there and the way across it, and its half width. */
function placeOn(
  limb: PaintedLimb,
  share: number
): {
  readonly at: Vector2;
  readonly along: Vector2;
  readonly across: Vector2;
  readonly halfWidth: number;
} {
  const last = limb.path.length - 1;
  const index = Math.min(last - 1, Math.max(0, Math.round(share * last)));
  const at = limb.path[index];
  const next = limb.path[index + 1];
  const run = { x: next.x - at.x, y: next.y - at.y };
  const size = Math.hypot(run.x, run.y);
  const along = size === 0 ? { x: 1, y: 0 } : { x: run.x / size, y: run.y / size };
  return {
    at,
    along,
    across: { x: -along.y, y: along.x },
    halfWidth: limb.halfWidthAt(index),
  };
}
