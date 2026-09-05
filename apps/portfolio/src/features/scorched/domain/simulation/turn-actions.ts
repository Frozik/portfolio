import { BATTERY_HEALTH_BONUS } from '../constants';
import { applyBatteries, createShield, moveWithFuel } from '../items/behaviors';
import { getTankCenter } from '../tank-geometry';
import { getSurfaceHeight } from '../terrain/heightfield';
import type { ItemId, TankState, WorldEvent } from '../types';
import type { RoundState } from './round-state';
import { finishTurn, getActiveTank } from './turn-flow';

/** One press of a fuel key drives one column, so a held key drives at the key's repeat rate. */
const FUEL_MOVE_COLUMNS_PER_REQUEST = 1;
/** A single battery is spent per use, so the player watches the bar climb ten at a time. */
const BATTERIES_PER_USE = 1;

/** Turn actions are the aiming player's alone: nothing happens once the shell is in the air. */
function getAimingTank(state: RoundState): TankState | undefined {
  const tank = getActiveTank(state);

  return state.phase === 'aiming' ? tank : undefined;
}

/** [MANUAL §8] Retreating forfeits the round's points but denies the killer their bounty. */
export function retreat(state: RoundState): readonly WorldEvent[] {
  const tank = getAimingTank(state);

  if (tank === undefined) {
    return state.events;
  }

  tank.hasRetreated = true;
  tank.isAlive = false;
  state.retreatedIds.push(tank.playerId);
  state.events.push({
    type: 'tank-retreated',
    playerId: tank.playerId,
    position: getTankCenter(tank),
  });
  finishTurn(state);

  return state.events;
}

/**
 * [MANUAL §7] A bubble raised in the field, out of the tank's own locker, on its own turn — the
 * manual's alternative to paying Auto Defense to do it. Raising a second one replaces whatever
 * is standing rather than stacking with it, so the tier that goes up last is the tier that holds.
 */
export function raiseShield(state: RoundState, itemId: ItemId): readonly WorldEvent[] {
  const tank = getAimingTank(state);

  if (tank === undefined) {
    return state.events;
  }

  const shield = createShield(itemId);

  if (shield === undefined || state.inventories.consumeItem(tank.playerId, itemId) <= 0) {
    return state.events;
  }

  tank.shield = shield;
  state.events.push({ type: 'shield-raised', playerId: tank.playerId, tier: shield.tier });

  return state.events;
}

/**
 * [MANUAL §7] A battery spent in the field. One press is one battery, and a tank already at the
 * cap spends nothing — the manual is explicit that a battery is never wasted.
 */
export function spendBattery(state: RoundState): readonly WorldEvent[] {
  const tank = getAimingTank(state);

  if (tank === undefined) {
    return state.events;
  }

  const available = state.inventories.getItemCount(tank.playerId, 'battery');
  const use = applyBatteries(tank.health, Math.min(BATTERIES_PER_USE, available));

  if (use.consumed <= 0) {
    return state.events;
  }

  state.inventories.consumeItem(tank.playerId, 'battery', use.consumed);
  tank.health = use.health;
  state.events.push({
    type: 'tank-repaired',
    playerId: tank.playerId,
    amount: use.consumed * BATTERY_HEALTH_BONUS,
    health: tank.health,
  });

  return state.events;
}

/**
 * [MANUAL §7] Driving on fuel: one request moves the tank a column towards `direction`, uphill
 * costing extra and a slope the tracks cannot hold turning the drive into a slide.
 */
export function moveWithFuelUnits(state: RoundState, direction: number): readonly WorldEvent[] {
  const tank = getAimingTank(state);

  if (tank === undefined || Math.sign(direction) === 0) {
    return state.events;
  }

  const available = state.inventories.getItemCount(tank.playerId, 'fuel') + tank.fuelCreditWu;

  if (available <= 0) {
    return state.events;
  }

  const move = moveWithFuel(
    state.field,
    tank.columnIndex,
    direction,
    available,
    FUEL_MOVE_COLUMNS_PER_REQUEST
  );

  if (move.columnIndex === tank.columnIndex) {
    return state.events;
  }

  // Whole units leave the locker; the paid-but-unburnt fraction stays as credit for the next
  // column, so a long uphill drive costs its true price rather than a rounded-up unit per step.
  const owedWu = move.fuelSpent - tank.fuelCreditWu;
  const chargedUnits = Math.max(0, Math.ceil(owedWu));

  state.inventories.consumeItem(tank.playerId, 'fuel', chargedUnits);
  tank.fuelCreditWu = chargedUnits - owedWu;
  tank.columnIndex = move.columnIndex;
  tank.positionY = getSurfaceHeight(state.field, move.columnIndex);
  state.events.push({
    type: 'tank-moved',
    playerId: tank.playerId,
    columnIndex: tank.columnIndex,
    positionY: tank.positionY,
  });

  return state.events;
}
