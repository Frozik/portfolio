import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { BulletHit } from '../bullets';
import { stepBullets } from '../bullets';
import type { TankRef, WorldEvent } from '../types';
import { destroyBase, destroyEnemy, destroyPlayer } from './outcomes';
import { spawnPowerUp } from './power-ups-step';
import { collectBulletTargets } from './tank-queries';
import type { WorldState } from './world-state';

function damagePlayer(state: WorldState, slot: number, events: WorldEvent[]): void {
  const player = state.players[slot];
  const isVulnerable = !isNil(player) && player.isActive && player.shieldTicksRemaining <= 0;

  // Several bullets can land in the same tick; the ones after the fatal hit must not count.
  if (!isVulnerable || state.status !== 'playing') {
    return;
  }

  destroyPlayer(state, player, events);
}

function damageEnemy(state: WorldState, slot: number, events: WorldEvent[]): void {
  const enemy = state.stage.enemies.find(candidate => candidate.slot === slot);

  if (isNil(enemy)) {
    return;
  }

  enemy.hitPoints--;

  if (enemy.hitPoints > 0) {
    return;
  }

  destroyEnemy(state, enemy, true, events);

  if (enemy.isPowerUpCarrier) {
    spawnPowerUp(state, events);
  }
}

function damageTank(state: WorldState, target: TankRef, events: WorldEvent[]): void {
  switch (target.side) {
    case 'player':
      damagePlayer(state, target.slot, events);
      break;
    case 'enemy':
      damageEnemy(state, target.slot, events);
      break;
    default:
      assertNever(target.side);
  }
}

function applyBulletHit(state: WorldState, hit: BulletHit, events: WorldEvent[]): void {
  switch (hit.kind) {
    case 'terrain':
      events.push({
        type: 'bullet-ended',
        position: hit.position,
        reason: hit.hitBorder ? 'border' : hit.hitSteel ? 'steel' : 'terrain',
      });
      break;
    case 'eagle':
      events.push({ type: 'bullet-ended', position: hit.position, reason: 'eagle' });
      destroyBase(state, events);
      break;
    case 'bullet':
      events.push({ type: 'bullet-ended', position: hit.position, reason: 'bullet' });
      break;
    case 'tank':
      events.push({ type: 'bullet-ended', position: hit.position, reason: 'tank' });
      damageTank(state, hit.target, events);
      break;
    default:
      assertNever(hit);
  }
}

export function stepWorldBullets(state: WorldState, events: WorldEvent[]): void {
  const { stage } = state;
  const hits = stepBullets(stage.bullets, {
    terrain: stage.terrain,
    targets: collectBulletTargets(state),
  });

  for (const hit of hits) {
    applyBulletHit(state, hit, events);
  }

  stage.bullets = stage.bullets.filter(bullet => bullet.isAlive);
}
