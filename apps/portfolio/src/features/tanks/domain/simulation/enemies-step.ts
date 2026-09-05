import { assertNever } from '@frozik/utils/assert/assertNever';

import { countAliveBullets, getEnemyBulletTraits } from '../bullets';
import { ENEMY_SPEED_BY_TYPE_WU_PER_SECOND } from '../constants';
import type { BlockedReaction } from '../enemy-ai';
import { decideBlockedReaction, decideEnemyAction } from '../enemy-ai';
import { advanceTank } from '../movement';
import type { EnemyTank, TankRef, WorldEvent } from '../types';
import { fireBullet } from './firing';
import { createAiContext, createMovementContext } from './tank-queries';
import type { WorldState } from './world-state';

function reactToBlock(enemy: EnemyTank, reaction: BlockedReaction): void {
  switch (reaction.kind) {
    case 'brake':
      enemy.brakeTicksRemaining = reaction.ticks;
      break;
    case 'turn':
      enemy.direction = reaction.direction;
      break;
    default:
      assertNever(reaction);
  }
}

export function stepEnemies(state: WorldState, events: WorldEvent[]): void {
  const { stage } = state;
  const aiContext = createAiContext(state);

  for (const enemy of stage.enemies) {
    if (enemy.twinkleTicksRemaining > 0) {
      enemy.twinkleTicksRemaining--;
      continue;
    }

    if (stage.freezeTicksRemaining > 0) {
      continue;
    }

    const owner: TankRef = { side: 'enemy', slot: enemy.slot };
    const decision = decideEnemyAction(
      enemy,
      aiContext,
      countAliveBullets(stage.bullets, owner) > 0
    );

    if (decision.fire) {
      fireBullet(state, owner, enemy, getEnemyBulletTraits(enemy.type), events);
    }

    if (enemy.brakeTicksRemaining > 0) {
      enemy.brakeTicksRemaining--;
      continue;
    }

    const stepResult = advanceTank(
      enemy,
      decision.direction,
      ENEMY_SPEED_BY_TYPE_WU_PER_SECOND[enemy.type],
      createMovementContext(state, enemy)
    );

    if (stepResult.isBlocked) {
      reactToBlock(enemy, decideBlockedReaction(enemy, aiContext));
    }
  }
}
