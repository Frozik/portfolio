import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import {
  BATTERY_HEALTH_BONUS,
  CONTACT_TRIGGER_BUNDLE_SIZE,
  CONTACT_TRIGGER_COST,
  FUEL_COST_PER_WU,
  FUEL_EXTRA_COST_PER_WU_CLIMBED,
  HEAT_GUIDANCE_TURN_RATE_DEGREES_PER_TICK,
  MAG_DEFLECTOR_ACCELERATION_WU_PER_TICK_SQUARED,
  MAG_DEFLECTOR_CAPACITY,
  MAG_DEFLECTOR_RADIUS_WU,
  MAX_CLIMB_SLOPE_WU_PER_COLUMN,
  MAX_TANK_HEALTH,
  SHIELD_CAPACITY_BY_TIER,
  SUPER_MAG_ACCELERATION_WU_PER_TICK_SQUARED,
  SUPER_MAG_CAPACITY,
  SUPER_MAG_RADIUS_WU,
} from './constants';
import type { BundlePricing } from './economy';
import { getAutoDefensePrice } from './economy';
import type { Heightfield } from './terrain/heightfield';
import { getColumnCount, getColumnIndexAt, getSurfaceHeight } from './terrain/heightfield';
import type {
  GuidanceKind,
  ItemCounts,
  ItemId,
  MagDeflectorState,
  PlayerId,
  ShieldState,
  ShieldTier,
} from './types';
import type { WeaponDefinition } from './weapons/catalog';

export interface ShieldAbsorption {
  readonly shield: ShieldState | undefined;
  readonly absorbed: number;
  readonly passedThrough: number;
}

/**
 * What a shield does to a shell that reaches it.
 *
 * [MANUAL §7] `pass-through` is the famous suicide clause: your own shells leave through your
 * own bubble, and a descending one comes back in the same way. The bubble still soaks the
 * *indirect* damage, so the shot is survivable — right up until the blast outgrows the shield.
 */
export type ShieldInteraction = 'none' | 'absorb-direct-hit' | 'deflect' | 'pass-through';

export interface MagDeflection {
  readonly velocity: Vector2;
  readonly deflectors: readonly MagDeflectorState[];
}

export interface BatteryUse {
  readonly health: number;
  readonly consumed: number;
}

export interface FuelMove {
  readonly columnIndex: number;
  readonly fuelSpent: number;
  readonly didSlide: boolean;
}

/**
 * One row of the accessories table. The Contact Trigger row ($1 000 × 25) is a [MANUAL]
 * fact; the remaining prices are the researched table and are re-checked at M4.
 * Auto Defense carries no fixed price — `getAutoDefensePrice` scales it by the rounds left.
 */
export interface ItemDefinition {
  readonly id: ItemId;
  readonly cost: number;
  readonly bundleSize: number;
  readonly armsLevel: number;
}

export const ITEMS: readonly ItemDefinition[] = [
  { id: 'heat-guidance', cost: 15000, bundleSize: 1, armsLevel: 3 },
  { id: 'ballistic-guidance', cost: 8000, bundleSize: 1, armsLevel: 2 },
  { id: 'horizontal-guidance', cost: 5000, bundleSize: 1, armsLevel: 1 },
  { id: 'vertical-guidance', cost: 5000, bundleSize: 1, armsLevel: 1 },
  { id: 'lazy-boy', cost: 25000, bundleSize: 1, armsLevel: 4 },
  { id: 'battery', cost: 10000, bundleSize: 5, armsLevel: 0 },
  { id: 'mag-deflector', cost: 20000, bundleSize: 5, armsLevel: 3 },
  { id: 'shield', cost: 7000, bundleSize: 5, armsLevel: 0 },
  { id: 'force-shield', cost: 12000, bundleSize: 5, armsLevel: 2 },
  { id: 'heavy-shield', cost: 20000, bundleSize: 5, armsLevel: 3 },
  { id: 'super-mag', cost: 30000, bundleSize: 3, armsLevel: 4 },
  { id: 'auto-defense', cost: 0, bundleSize: 1, armsLevel: 2 },
  { id: 'fuel', cost: 2000, bundleSize: 100, armsLevel: 0 },
  {
    id: 'contact-trigger',
    cost: CONTACT_TRIGGER_COST,
    bundleSize: CONTACT_TRIGGER_BUNDLE_SIZE,
    armsLevel: 1,
  },
];

export function getItem(itemId: ItemId): ItemDefinition {
  const item = ITEMS.find(candidate => candidate.id === itemId);

  assert(item !== undefined, `unknown item ${itemId}`);

  return item;
}

export function getItemsForArmsLevel(armsLevel: number): readonly ItemDefinition[] {
  return ITEMS.filter(item => item.armsLevel <= armsLevel);
}

/**
 * [MANUAL §7] Auto Defense carries no price of its own: it arms a bubble for every round still to
 * come, so the shop quotes it by the rounds left. Everything else is priced straight off the table.
 */
export function getItemPricing(item: ItemDefinition, roundsRemaining: number): BundlePricing {
  if (item.id !== 'auto-defense') {
    return item;
  }

  return { cost: getAutoDefensePrice(roundsRemaining), bundleSize: item.bundleSize };
}

const DEGREES_TO_RADIANS = Math.PI / 180;

const SHIELD_TIER_BY_ITEM: Readonly<Partial<Record<ItemId, ShieldTier>>> = {
  shield: 'shield',
  'force-shield': 'force',
  'heavy-shield': 'heavy',
  'super-mag': 'heavy',
};

/**
 * Bought once for the whole match: the device stays installed and is never spent. Everything
 * else is ammunition — shields go up and burn out, weapons leave with every shot.
 */
const PERMANENT_ITEM_IDS: readonly ItemId[] = [
  'auto-defense',
  'heat-guidance',
  'ballistic-guidance',
  'horizontal-guidance',
  'vertical-guidance',
  'lazy-boy',
];

export function isPermanentItem(itemId: ItemId): boolean {
  return PERMANENT_ITEM_IDS.includes(itemId);
}

/** [MANUAL §7] The bubbles strongest-first — Auto Defense arms by it, the AI shops by it. */
export const SHIELD_ITEM_PREFERENCE: readonly ItemId[] = [
  'super-mag',
  'heavy-shield',
  'force-shield',
  'shield',
];

export function createShield(itemId: ItemId): ShieldState | undefined {
  const tier = SHIELD_TIER_BY_ITEM[itemId];

  if (tier === undefined) {
    return undefined;
  }

  return { tier, remaining: SHIELD_CAPACITY_BY_TIER[tier], isLaserImmune: itemId === 'super-mag' };
}

/** The strongest bubble a locker holds, whoever is doing the choosing — the player or the AI. */
export function selectBestShieldItem(getItemCount: (itemId: ItemId) => number): ItemId | undefined {
  return SHIELD_ITEM_PREFERENCE.find(itemId => getItemCount(itemId) > 0);
}

export function selectAutoDefenseItem(items: ItemCounts): ItemId | undefined {
  return selectBestShieldItem(itemId => items[itemId] ?? 0);
}

/** Splits incoming damage into the part the bubble eats and the part that reaches the hull. */
export function absorbWithShield(
  shield: ShieldState | undefined,
  amount: number
): ShieldAbsorption {
  if (shield === undefined || amount <= 0) {
    return { shield, absorbed: 0, passedThrough: Math.max(0, amount) };
  }

  const absorbed = Math.min(shield.remaining, amount);
  const remaining = shield.remaining - absorbed;

  return {
    shield: remaining > 0 ? { ...shield, remaining } : undefined,
    absorbed,
    passedThrough: amount - absorbed,
  };
}

export function resolveShieldInteraction(
  shield: ShieldState | undefined,
  isOwnShot: boolean
): ShieldInteraction {
  if (shield === undefined) {
    return 'none';
  }

  if (isOwnShot) {
    return 'pass-through';
  }

  switch (shield.tier) {
    case 'force':
      return 'deflect';
    case 'shield':
    case 'heavy':
      return 'absorb-direct-hit';
    default:
      return assertNever(shield.tier);
  }
}

export function isLaserBlockedBy(shield: ShieldState | undefined): boolean {
  return shield?.isLaserImmune ?? false;
}

export function createMagDeflector(itemId: ItemId, ownerId: PlayerId, position: Vector2) {
  const isSuperMag = itemId === 'super-mag';

  return {
    ownerId,
    position,
    radiusWu: isSuperMag ? SUPER_MAG_RADIUS_WU : MAG_DEFLECTOR_RADIUS_WU,
    accelerationWuPerTickSquared: isSuperMag
      ? SUPER_MAG_ACCELERATION_WU_PER_TICK_SQUARED
      : MAG_DEFLECTOR_ACCELERATION_WU_PER_TICK_SQUARED,
    remainingCapacity: isSuperMag ? SUPER_MAG_CAPACITY : MAG_DEFLECTOR_CAPACITY,
  } satisfies MagDeflectorState;
}

/**
 * Our default model: a constant upward shove on anything inside the radius, drawn from a
 * per-round capacity budget so a deflector cannot hold off an entire barrage on its own.
 */
export function applyMagDeflection(
  position: Vector2,
  velocity: Vector2,
  deflectors: readonly MagDeflectorState[]
): MagDeflection {
  let pushWuPerTick = 0;
  const updated = deflectors.map(deflector => {
    const distanceWu = Math.hypot(
      position.x - deflector.position.x,
      position.y - deflector.position.y
    );

    if (deflector.remainingCapacity <= 0 || distanceWu > deflector.radiusWu) {
      return deflector;
    }

    pushWuPerTick += deflector.accelerationWuPerTickSquared;

    return { ...deflector, remainingCapacity: deflector.remainingCapacity - 1 };
  });

  return {
    velocity: { x: velocity.x, y: velocity.y + pushWuPerTick },
    deflectors: updated,
  };
}

/** [MANUAL §7] Batteries restore 10 health each and are never wasted past the cap. */
export function applyBatteries(health: number, batteryCount: number): BatteryUse {
  const missing = Math.max(0, MAX_TANK_HEALTH - health);
  const consumed = Math.min(batteryCount, Math.ceil(missing / BATTERY_HEALTH_BONUS));

  return {
    health: Math.min(MAX_TANK_HEALTH, health + consumed * BATTERY_HEALTH_BONUS),
    consumed,
  };
}

export function canFitGuidance(weapon: WeaponDefinition): boolean {
  return weapon.isGuidanceCompatible;
}

/** [MANUAL §7] Lazy Boy needs the player to nominate a spot before the shot goes out. */
export function requiresTargetSelection(guidance: GuidanceKind): boolean {
  return guidance === 'lazy-boy';
}

/**
 * [MANUAL §7] Ballistic guidance cancels the wind and nothing else — with air viscosity on it
 * is as blind as the Spoiler AI, which is exactly the interaction the manual calls out.
 */
export function getGuidedWindAcceleration(
  guidance: GuidanceKind | undefined,
  windAccelerationWuPerTickSquared: number
): number {
  return guidance === 'ballistic-guidance' ? 0 : windAccelerationWuPerTickSquared;
}

function steerTowards(velocity: Vector2, toTarget: Vector2, maxTurnDegrees: number): Vector2 {
  const speed = Math.hypot(velocity.x, velocity.y);
  const targetLength = Math.hypot(toTarget.x, toTarget.y);

  if (speed === 0 || targetLength === 0) {
    return velocity;
  }

  const currentAngle = Math.atan2(velocity.y, velocity.x);
  const desiredAngle = Math.atan2(toTarget.y, toTarget.x);
  const maxTurn = maxTurnDegrees * DEGREES_TO_RADIANS;
  const rawDelta = desiredAngle - currentAngle;
  const wrappedDelta = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
  const angle = currentAngle + clamp(wrappedDelta, -maxTurn, maxTurn);

  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

/** [MANUAL §7] Vertical guidance takes over only once the descending shell is nearly overhead. */
const VERTICAL_GUIDANCE_CAPTURE_WU = 60;
/** [MANUAL §7] Horizontal guidance flies the shell in once it descends to the target's level. */
const HORIZONTAL_GUIDANCE_ALTITUDE_BAND_WU = 30;

/**
 * Per-tick steering for the guidance the player fitted. Ballistic guidance is handled by
 * `getGuidedWindAcceleration` instead, because it corrects the environment, not the shell.
 * The single-axis systems only correct the descent — a climbing shell flies its own arc.
 */
export function applyGuidance(
  guidance: GuidanceKind,
  position: Vector2,
  velocity: Vector2,
  target: Vector2 | undefined,
  isDescending: boolean
): Vector2 {
  if (target === undefined) {
    return velocity;
  }

  const toTarget: Vector2 = { x: target.x - position.x, y: target.y - position.y };

  switch (guidance) {
    case 'heat-guidance':
    case 'lazy-boy':
      return steerTowards(velocity, toTarget, HEAT_GUIDANCE_TURN_RATE_DEGREES_PER_TICK);
    case 'horizontal-guidance':
      if (!isDescending || toTarget.y < -HORIZONTAL_GUIDANCE_ALTITUDE_BAND_WU) {
        return velocity;
      }

      return steerTowards(
        velocity,
        { x: toTarget.x, y: 0 },
        HEAT_GUIDANCE_TURN_RATE_DEGREES_PER_TICK
      );
    case 'vertical-guidance':
      if (!isDescending || Math.abs(toTarget.x) > VERTICAL_GUIDANCE_CAPTURE_WU) {
        return velocity;
      }

      return steerTowards(velocity, toTarget, HEAT_GUIDANCE_TURN_RATE_DEGREES_PER_TICK);
    case 'ballistic-guidance':
      return velocity;
    default:
      return assertNever(guidance);
  }
}

/** [MANUAL §5] One trigger arms the whole shot — every sub-warhead detonates on contact. */
export function shouldArmContactTrigger(isSelected: boolean, triggerCount: number): boolean {
  return isSelected && triggerCount > 0;
}

function slideDownhill(field: Heightfield, columnIndex: number): number {
  let current = columnIndex;

  for (let step = 0; step < getColumnCount(field); step++) {
    const height = getSurfaceHeight(field, current);
    const leftDrop = current > 0 ? height - getSurfaceHeight(field, current - 1) : 0;
    const rightDrop =
      current < getColumnCount(field) - 1 ? height - getSurfaceHeight(field, current + 1) : 0;
    const steepestDrop = Math.max(leftDrop, rightDrop);

    if (steepestDrop <= MAX_CLIMB_SLOPE_WU_PER_COLUMN) {
      return current;
    }

    current = leftDrop >= rightDrop ? current - 1 : current + 1;
  }

  return current;
}

/**
 * [MANUAL §7] Fuel buys one wu of level travel per unit and more when climbing; a slope the
 * tracks cannot hold sends the tank sliding back down for free.
 *
 * `maxColumns` bounds the drive itself rather than its price: a held arrow key asks for a column
 * at a time, and on level ground one unit of fuel would otherwise buy a whole column more than
 * the player asked for.
 */
export function moveWithFuel(
  field: Heightfield,
  columnIndex: number,
  direction: number,
  fuelUnits: number,
  maxColumns: number = Number.POSITIVE_INFINITY
): FuelMove {
  const step = Math.sign(direction);
  let current = getColumnIndexAt(field, columnIndex);
  let fuelSpent = 0;
  let columnsTravelled = 0;

  while (step !== 0 && fuelSpent < fuelUnits && columnsTravelled < maxColumns) {
    const nextColumn = current + step;

    if (nextColumn < 0 || nextColumn >= getColumnCount(field)) {
      break;
    }

    const climbWu = getSurfaceHeight(field, nextColumn) - getSurfaceHeight(field, current);

    if (climbWu > MAX_CLIMB_SLOPE_WU_PER_COLUMN) {
      break;
    }

    const stepCost = FUEL_COST_PER_WU + Math.max(0, climbWu) * FUEL_EXTRA_COST_PER_WU_CLIMBED;

    if (fuelSpent + stepCost > fuelUnits) {
      break;
    }

    fuelSpent += stepCost;
    columnsTravelled++;
    current = nextColumn;
  }

  const settled = slideDownhill(field, current);

  return { columnIndex: settled, fuelSpent, didSlide: settled !== current };
}
