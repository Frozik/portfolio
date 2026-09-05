import { countAliveBullets, createBullet } from '../bullets';
import type { TankBox } from '../movement';
import type { Direction, IBulletTraits, TankRef, WorldEvent } from '../types';
import type { WorldState } from './world-state';

interface BulletShooter extends TankBox {
  readonly direction: Direction;
}

export function canFire(state: WorldState, owner: TankRef, maxBullets: number): boolean {
  return countAliveBullets(state.stage.bullets, owner) < maxBullets;
}

export function fireBullet(
  state: WorldState,
  owner: TankRef,
  shooter: BulletShooter,
  traits: IBulletTraits,
  events: WorldEvent[]
): void {
  const bullet = createBullet({
    id: state.nextBulletId++,
    owner,
    direction: shooter.direction,
    traits,
    tankPositionX: shooter.positionX,
    tankPositionY: shooter.positionY,
  });

  state.stage.bullets.push(bullet);
  events.push({
    type: 'bullet-fired',
    owner,
    position: { x: bullet.positionX, y: bullet.positionY },
  });
}
