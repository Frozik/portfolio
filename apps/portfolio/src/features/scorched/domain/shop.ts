import type { BundlePricing, BundleQuote } from './economy';
import { canAfford, quoteBundle, quoteSellBack } from './economy';
import { getItem, getItemPricing, isPermanentItem } from './items/catalog';
import type { ItemId, WeaponId } from './types';
import { getWeapon } from './weapons/catalog';

/** A single row of the shop, whichever of the two catalogs it came from. */
export type ShopEntryRef =
  | { readonly kind: 'weapon'; readonly weaponId: WeaponId }
  | { readonly kind: 'item'; readonly itemId: ItemId };

/**
 * One line of the shop cart. The cart is a receipt of the current visit rather than a deferred
 * order: bundles are bought the moment they are tapped, exactly as the original's shop worked, and
 * the line is what lets the player see — and sell back — what this visit cost them.
 */
export interface CartLine {
  readonly entry: ShopEntryRef;
  readonly bundleCount: number;
  readonly units: number;
  readonly spent: number;
  /** True once the 99 cap truncated a bundle and the shop charged the surcharge. */
  readonly hasMarkup: boolean;
}

export interface ShopQuote extends BundleQuote {
  readonly isAffordable: boolean;
  /** False when the inventory is already at the 99 cap and no bundle can be sold at all. */
  readonly isAvailable: boolean;
}

function getShopEntryId(entry: ShopEntryRef): WeaponId | ItemId {
  return entry.kind === 'weapon' ? entry.weaponId : entry.itemId;
}

export function isSameShopEntry(first: ShopEntryRef, second: ShopEntryRef): boolean {
  return first.kind === second.kind && getShopEntryId(first) === getShopEntryId(second);
}

export function getShopPricing(entry: ShopEntryRef, roundsRemaining: number): BundlePricing {
  return entry.kind === 'weapon'
    ? getWeapon(entry.weaponId)
    : getItemPricing(getItem(entry.itemId), roundsRemaining);
}

export function getShopArmsLevel(entry: ShopEntryRef): number {
  return entry.kind === 'weapon'
    ? getWeapon(entry.weaponId).armsLevel
    : getItem(entry.itemId).armsLevel;
}

export function isPermanentEntry(entry: ShopEntryRef): boolean {
  return entry.kind === 'item' && isPermanentItem(entry.itemId);
}

/** What one press of Buy would cost right now, and whether the tank can stand it. */
export function quoteShopPurchase(
  entry: ShopEntryRef,
  roundsRemaining: number,
  cash: number,
  ownedCount: number
): ShopQuote {
  if (isPermanentEntry(entry) && ownedCount > 0) {
    return { units: 0, cost: 0, hasMarkup: false, isAvailable: false, isAffordable: false };
  }

  const quote = quoteBundle(getShopPricing(entry, roundsRemaining), ownedCount);

  return {
    ...quote,
    isAvailable: quote.units > 0,
    isAffordable: quote.units > 0 && canAfford(cash, quote.cost),
  };
}

export function quoteShopSellBack(
  entry: ShopEntryRef,
  roundsRemaining: number,
  units: number
): number {
  return quoteSellBack(getShopPricing(entry, roundsRemaining), units);
}

export function findCartLine(
  lines: readonly CartLine[],
  entry: ShopEntryRef
): CartLine | undefined {
  return lines.find(line => isSameShopEntry(line.entry, entry));
}

/** Folds a completed purchase into the receipt, merging it with the same entry bought earlier. */
export function addCartPurchase(
  lines: readonly CartLine[],
  entry: ShopEntryRef,
  quote: BundleQuote
): readonly CartLine[] {
  const existing = findCartLine(lines, entry);

  if (existing === undefined) {
    return [
      ...lines,
      { entry, bundleCount: 1, units: quote.units, spent: quote.cost, hasMarkup: quote.hasMarkup },
    ];
  }

  return lines.map(line =>
    line === existing
      ? {
          entry: line.entry,
          bundleCount: line.bundleCount + 1,
          units: line.units + quote.units,
          spent: line.spent + quote.cost,
          hasMarkup: line.hasMarkup || quote.hasMarkup,
        }
      : line
  );
}

/** Sold-back units leave the receipt; a line that empties out disappears from it entirely. */
export function removeCartUnits(
  lines: readonly CartLine[],
  entry: ShopEntryRef,
  units: number,
  proceeds: number
): readonly CartLine[] {
  const existing = findCartLine(lines, entry);

  if (existing === undefined || units <= 0) {
    return lines;
  }

  const remainingUnits = Math.max(0, existing.units - units);

  if (remainingUnits === 0) {
    return lines.filter(line => line !== existing);
  }

  return lines.map(line =>
    line === existing
      ? { ...line, units: remainingUnits, spent: Math.max(0, line.spent - proceeds) }
      : line
  );
}

export function getCartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.spent, 0);
}
