import { assert } from '@frozik/utils/assert/assert';

import { CONTACT_TRIGGER_BUNDLE_SIZE, CONTACT_TRIGGER_COST } from '../constants';
import type { BundlePricing } from '../economy';
import { getAutoDefensePrice } from '../economy';
import type { ItemId } from '../types';

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
