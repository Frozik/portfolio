import { isNil } from 'lodash-es';

import { MIN_TANK_HEALTH } from '../constants';
import type { ShieldAbsorption } from '../items/behaviors';
import { absorbWithShield, createShield, selectBestShieldItem } from '../items/behaviors';
import type { DamageCause, PlayerId, TankState } from '../types';
import type { RoundState } from './round-state';

/** [MANUAL §7] Auto Defense keeps watch all round: a collapsed bubble is replaced on the spot. */
function autoRaiseNextShield(state: RoundState, tank: TankState): void {
  const { inventories } = state;

  if (inventories.getItemCount(tank.playerId, 'auto-defense') <= 0) {
    return;
  }

  const nextItemId = selectBestShieldItem(itemId =>
    inventories.getItemCount(tank.playerId, itemId)
  );
  const shield = isNil(nextItemId) ? undefined : createShield(nextItemId);

  if (isNil(nextItemId) || shield === undefined) {
    return;
  }

  inventories.consumeItem(tank.playerId, nextItemId);
  tank.shield = shield;
  state.events.push({ type: 'shield-raised', playerId: tank.playerId, tier: shield.tier });
}

export function applyShieldAbsorption(
  state: RoundState,
  tank: TankState,
  absorption: ShieldAbsorption
): void {
  tank.shield = absorption.shield;
  state.events.push({
    type: 'shield-absorbed',
    playerId: tank.playerId,
    amount: absorption.absorbed,
    remaining: absorption.shield?.remaining ?? 0,
  });

  if (absorption.shield === undefined) {
    state.events.push({ type: 'shield-collapsed', playerId: tank.playerId });
    autoRaiseNextShield(state, tank);
  }
}

function destroyTank(state: RoundState, tank: TankState, killerId: PlayerId | undefined): void {
  tank.isAlive = false;
  state.killRecords.push({ killerId, victimId: tank.playerId });
  state.events.push({ type: 'tank-destroyed', playerId: tank.playerId, killerId });
}

/**
 * [MANUAL §7] The bubble soaks indirect damage no matter who fired the shell — including the
 * owner's own descending shot, which is what makes the suicide survivable but not safe.
 */
export function applyDamage(
  state: RoundState,
  playerId: PlayerId,
  amount: number,
  sourceId: PlayerId | undefined,
  cause: DamageCause
): void {
  const tank = state.tanks.find(candidate => candidate.playerId === playerId);

  if (tank === undefined || !tank.isAlive || amount <= 0) {
    return;
  }

  const absorption = absorbWithShield(tank.shield, amount);

  if (absorption.absorbed > 0) {
    applyShieldAbsorption(state, tank, absorption);
  }

  if (absorption.passedThrough <= 0) {
    return;
  }

  tank.health = Math.max(MIN_TANK_HEALTH, tank.health - absorption.passedThrough);
  state.damageRecords.push({
    dealerId: sourceId,
    targetId: playerId,
    amount: absorption.passedThrough,
  });
  state.events.push({
    type: 'tank-damaged',
    playerId,
    sourceId,
    amount: absorption.passedThrough,
    cause,
    health: tank.health,
  });

  if (tank.health <= MIN_TANK_HEALTH) {
    destroyTank(state, tank, sourceId);
  }
}
