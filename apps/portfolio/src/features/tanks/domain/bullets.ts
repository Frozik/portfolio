import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import {
  BULLET_SIZE_WU,
  BULLET_SPEED_FAST_WU_PER_SECOND,
  BULLET_SPEED_SLOW_WU_PER_SECOND,
  FAST_BULLET_STAR_LEVEL,
  MAX_BULLETS_DEFAULT,
  MAX_BULLETS_UPGRADED,
  PIERCING_BULLET_STAR_LEVEL,
  SECOND_BULLET_SLOT_STAR_LEVEL,
  TANK_SIZE_WU,
} from './constants';
import { getDirectionDelta, isHorizontalDirection } from './direction';
import { accumulateMovementSteps, rectanglesOverlap } from './movement';
import type { Terrain } from './terrain';

import type { Bullet, Direction, EnemyType, IBulletTraits, TankRef } from './types';

/** Keeps the 3-wu bullet centered on the 16-wu tank that fired it. */
const BULLET_CENTER_OFFSET_WU = Math.floor((TANK_SIZE_WU - BULLET_SIZE_WU) / 2);

export interface IBulletTarget {
  readonly ref: TankRef;
  readonly positionX: number;
  readonly positionY: number;
}

export interface IBulletContext {
  readonly terrain: Terrain;
  /** Every collidable tank; a bullet only ever hits the opposite side. */
  readonly targets: readonly IBulletTarget[];
}

export type BulletHit =
  | {
      readonly kind: 'terrain';
      readonly bulletId: number;
      readonly position: Vector2;
      readonly destroyedTerrain: boolean;
      readonly hitSteel: boolean;
      readonly hitBorder: boolean;
    }
  | { readonly kind: 'eagle'; readonly bulletId: number; readonly position: Vector2 }
  | {
      readonly kind: 'tank';
      readonly bulletId: number;
      readonly position: Vector2;
      readonly target: TankRef;
    }
  | {
      readonly kind: 'bullet';
      readonly bulletId: number;
      readonly otherBulletId: number;
      readonly position: Vector2;
    };

export function getPlayerBulletTraits(starLevel: number): IBulletTraits {
  return {
    fast: starLevel >= FAST_BULLET_STAR_LEVEL,
    piercing: starLevel >= PIERCING_BULLET_STAR_LEVEL,
  };
}

/** The 300-pt tier fires the ROM's property-1 bullet; no enemy ever fires piercing. */
export function getEnemyBulletTraits(enemyType: EnemyType): IBulletTraits {
  return { fast: enemyType === 'power', piercing: false };
}

export function getMaxBulletsForStarLevel(starLevel: number): number {
  return starLevel >= SECOND_BULLET_SLOT_STAR_LEVEL ? MAX_BULLETS_UPGRADED : MAX_BULLETS_DEFAULT;
}

export function getBulletSpeedWuPerSecond(traits: IBulletTraits): number {
  return traits.fast ? BULLET_SPEED_FAST_WU_PER_SECOND : BULLET_SPEED_SLOW_WU_PER_SECOND;
}

/** The domain fires on the rising edge only; input sources own any auto-repeat. */
export function isFireRisingEdge(previousFire: boolean, currentFire: boolean): boolean {
  return currentFire && !previousFire;
}

export function countAliveBullets(bullets: readonly Bullet[], owner: TankRef): number {
  return bullets.filter(
    bullet => bullet.isAlive && bullet.owner.side === owner.side && bullet.owner.slot === owner.slot
  ).length;
}

function getBulletCenter(bullet: Bullet): Vector2 {
  return {
    x: bullet.positionX + BULLET_SIZE_WU / 2,
    y: bullet.positionY + BULLET_SIZE_WU / 2,
  };
}

function getMuzzleOffset(direction: Direction): Vector2 {
  const leadingOffset = TANK_SIZE_WU - BULLET_SIZE_WU;

  switch (direction) {
    case 'up':
      return { x: BULLET_CENTER_OFFSET_WU, y: 0 };
    case 'down':
      return { x: BULLET_CENTER_OFFSET_WU, y: leadingOffset };
    case 'left':
      return { x: 0, y: BULLET_CENTER_OFFSET_WU };
    case 'right':
      return { x: leadingOffset, y: BULLET_CENTER_OFFSET_WU };
    default:
      return assertNever(direction);
  }
}

export function createBullet(params: {
  readonly id: number;
  readonly owner: TankRef;
  readonly direction: Direction;
  readonly traits: IBulletTraits;
  readonly tankPositionX: number;
  readonly tankPositionY: number;
}): Bullet {
  const muzzleOffset = getMuzzleOffset(params.direction);

  return {
    id: params.id,
    owner: params.owner,
    direction: params.direction,
    traits: params.traits,
    speedWuPerSecond: getBulletSpeedWuPerSecond(params.traits),
    positionX: params.tankPositionX + muzzleOffset.x,
    positionY: params.tankPositionY + muzzleOffset.y,
    movementRemainder: 0,
    isAlive: true,
  };
}

function getLeadingEdgeWu(bullet: Bullet): number {
  switch (bullet.direction) {
    case 'up':
      return bullet.positionY;
    case 'down':
      return bullet.positionY + BULLET_SIZE_WU - 1;
    case 'left':
      return bullet.positionX;
    case 'right':
      return bullet.positionX + BULLET_SIZE_WU - 1;
    default:
      return assertNever(bullet.direction);
  }
}

function getPerpendicularCenterWu(bullet: Bullet): number {
  const center = getBulletCenter(bullet);

  return isHorizontalDirection(bullet.direction) ? center.y : center.x;
}

function resolveTerrainHit(bullet: Bullet, context: IBulletContext): BulletHit | undefined {
  const impact = context.terrain.applyBulletImpact({
    direction: bullet.direction,
    leadingEdgeWu: getLeadingEdgeWu(bullet),
    perpendicularCenterWu: getPerpendicularCenterWu(bullet),
    piercing: bullet.traits.piercing,
  });

  if (!impact.blocked) {
    return undefined;
  }

  bullet.isAlive = false;

  if (impact.hitEagle) {
    return { kind: 'eagle', bulletId: bullet.id, position: getBulletCenter(bullet) };
  }

  return {
    kind: 'terrain',
    bulletId: bullet.id,
    position: getBulletCenter(bullet),
    destroyedTerrain: impact.destroyedTerrain,
    hitSteel: impact.hitSteel,
    hitBorder: impact.hitBorder,
  };
}

function resolveBulletHit(bullet: Bullet, bullets: readonly Bullet[]): BulletHit | undefined {
  for (const other of bullets) {
    const isOpposingBullet =
      other.isAlive && other.id !== bullet.id && other.owner.side !== bullet.owner.side;

    if (
      isOpposingBullet &&
      rectanglesOverlap(
        bullet.positionX,
        bullet.positionY,
        BULLET_SIZE_WU,
        other.positionX,
        other.positionY,
        BULLET_SIZE_WU
      )
    ) {
      bullet.isAlive = false;
      other.isAlive = false;

      return {
        kind: 'bullet',
        bulletId: bullet.id,
        otherBulletId: other.id,
        position: getBulletCenter(bullet),
      };
    }
  }

  return undefined;
}

function resolveTankHit(bullet: Bullet, context: IBulletContext): BulletHit | undefined {
  for (const target of context.targets) {
    if (target.ref.side === bullet.owner.side) {
      continue;
    }

    if (
      rectanglesOverlap(
        bullet.positionX,
        bullet.positionY,
        BULLET_SIZE_WU,
        target.positionX,
        target.positionY,
        TANK_SIZE_WU
      )
    ) {
      bullet.isAlive = false;

      return {
        kind: 'tank',
        bulletId: bullet.id,
        position: getBulletCenter(bullet),
        target: target.ref,
      };
    }
  }

  return undefined;
}

/** One wu at a time, so nothing tunnels through an 8-wu feature. */
export function stepBullets(
  bullets: readonly Bullet[],
  context: IBulletContext
): readonly BulletHit[] {
  const hits: BulletHit[] = [];

  for (const bullet of bullets) {
    if (!bullet.isAlive) {
      continue;
    }

    const { steps, remainder } = accumulateMovementSteps(
      bullet.movementRemainder,
      bullet.speedWuPerSecond
    );
    bullet.movementRemainder = remainder;

    const delta = getDirectionDelta(bullet.direction);

    for (let step = 0; step < steps && bullet.isAlive; step++) {
      bullet.positionX += delta.x;
      bullet.positionY += delta.y;

      const hit =
        resolveTerrainHit(bullet, context) ??
        resolveBulletHit(bullet, bullets) ??
        resolveTankHit(bullet, context);

      if (hit !== undefined) {
        hits.push(hit);
      }
    }
  }

  return hits;
}
