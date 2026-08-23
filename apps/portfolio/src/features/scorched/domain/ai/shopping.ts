import {
  AI_DEFENSE_BUDGET_FRACTION,
  AI_MAX_SHOP_PURCHASES,
  AI_MIN_ROUNDS_FOR_AUTO_DEFENSE,
  AI_SHIELD_STOCK_TARGET,
  AI_SHOPPING_BUDGET_FRACTION,
} from '../constants';
import { getItemPricing, getItemsForArmsLevel, SHIELD_ITEM_PREFERENCE } from '../items';
import type { ItemId, WeaponId } from '../types';
import type { WeaponDefinition } from '../weapons/catalog';
import { getWeaponsForArmsLevel } from '../weapons/catalog';

/**
 * What an AI walks out of the shop with. The manual documents the eight personalities' aim, never
 * their spending, so this is our own rule and deliberately a plain one: buy the heaviest thing
 * affordable, keep a reserve for the rounds ahead, and stop before the list gets silly.
 *
 * The plan is advisory — the match re-quotes every bundle and simply refuses the ones that no
 * longer fit, so a stale plan can never overdraw a tank's bank.
 */
export function planAiPurchases(cash: number, armsLevel: number): readonly WeaponId[] {
  const catalog = [...getWeaponsForArmsLevel(armsLevel)]
    .filter(weapon => !weapon.isUnlimited)
    .sort((first, second) => second.cost - first.cost);
  const purchases: WeaponId[] = [];
  let budget = Math.floor(Math.max(0, cash) * AI_SHOPPING_BUDGET_FRACTION);

  for (let purchase = 0; purchase < AI_MAX_SHOP_PURCHASES; purchase++) {
    const affordable: WeaponDefinition | undefined = catalog.find(weapon => weapon.cost <= budget);

    if (affordable === undefined) {
      return purchases;
    }

    purchases.push(affordable.id);
    budget -= affordable.cost;
  }

  return purchases;
}

export interface AiItemShoppingContext {
  readonly cash: number;
  readonly armsLevel: number;
  readonly roundsRemaining: number;
  readonly getOwnedCount: (itemId: ItemId) => number;
}

/**
 * Defence before firepower: a bubble for the locker, Auto Defense to raise it every round, then
 * a battery. Advisory like the weapon plan — the match re-quotes every purchase.
 */
export function planAiItemPurchases(context: AiItemShoppingContext): readonly ItemId[] {
  const { cash, armsLevel, roundsRemaining, getOwnedCount } = context;
  const unlocked = getItemsForArmsLevel(armsLevel);
  const purchases: ItemId[] = [];
  let budget = Math.floor(Math.max(0, cash) * AI_DEFENSE_BUDGET_FRACTION);

  const tryBuy = (itemId: ItemId): boolean => {
    const item = unlocked.find(candidate => candidate.id === itemId);
    const cost = item === undefined ? 0 : getItemPricing(item, roundsRemaining).cost;

    if (item === undefined || cost <= 0 || cost > budget) {
      return false;
    }

    purchases.push(itemId);
    budget -= cost;

    return true;
  };

  const shieldsOwned = SHIELD_ITEM_PREFERENCE.reduce(
    (total, itemId) => total + getOwnedCount(itemId),
    0
  );
  const isShieldBought =
    shieldsOwned < AI_SHIELD_STOCK_TARGET &&
    SHIELD_ITEM_PREFERENCE.some(shieldItemId => tryBuy(shieldItemId));

  // Auto Defense only pays off with bubbles to raise and rounds left to raise them in.
  if (
    roundsRemaining >= AI_MIN_ROUNDS_FOR_AUTO_DEFENSE &&
    getOwnedCount('auto-defense') === 0 &&
    (shieldsOwned > 0 || isShieldBought)
  ) {
    tryBuy('auto-defense');
  }

  if (getOwnedCount('battery') === 0) {
    tryBuy('battery');
  }

  return purchases;
}
