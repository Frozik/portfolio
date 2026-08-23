import {
  AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND,
  MAX_ITEM_COUNT,
  PERCENT_SCALE,
  SELL_BACK_FRACTION,
  TRUNCATED_BUNDLE_MARKUP,
} from './constants';

/** The two fields both the weapon and the accessory tables share. */
export interface BundlePricing {
  readonly cost: number;
  readonly bundleSize: number;
}

export interface BundleQuote {
  readonly units: number;
  readonly cost: number;
  /** True when the 99 cap truncated the bundle and the shop charged the surcharge. */
  readonly hasMarkup: boolean;
}

export interface PurchaseResult {
  readonly cash: number;
  readonly ownedCount: number;
  readonly units: number;
  readonly spent: number;
}

export function getUnitPrice(pricing: BundlePricing): number {
  return pricing.cost / pricing.bundleSize;
}

/** [MANUAL §8] The bank pays interest on whatever survives the round. */
export function applyInterest(bankedCash: number, interestPercent: number): number {
  return Math.floor(bankedCash * (1 + interestPercent / PERCENT_SCALE));
}

/**
 * [MANUAL §8] Bundles are fixed size, inventories cap at 99, and a bundle the cap truncates
 * carries roughly a 20% surcharge — you pay extra for the privilege of topping up.
 */
export function quoteBundle(pricing: BundlePricing, ownedCount: number): BundleQuote {
  const capacity = Math.max(0, MAX_ITEM_COUNT - ownedCount);

  if (capacity === 0) {
    return { units: 0, cost: 0, hasMarkup: false };
  }

  if (pricing.bundleSize <= capacity) {
    return { units: pricing.bundleSize, cost: pricing.cost, hasMarkup: false };
  }

  return {
    units: capacity,
    cost: Math.ceil(capacity * getUnitPrice(pricing) * (1 + TRUNCATED_BUNDLE_MARKUP)),
    hasMarkup: true,
  };
}

export function canAfford(cash: number, cost: number): boolean {
  return cash >= cost;
}

export function purchaseBundle(
  pricing: BundlePricing,
  cash: number,
  ownedCount: number
): PurchaseResult {
  const quote = quoteBundle(pricing, ownedCount);

  if (quote.units === 0 || !canAfford(cash, quote.cost)) {
    return { cash, ownedCount, units: 0, spent: 0 };
  }

  return {
    cash: cash - quote.cost,
    ownedCount: ownedCount + quote.units,
    units: quote.units,
    spent: quote.cost,
  };
}

/**
 * [MANUAL §8] The computer quotes a sale price rather than a full refund. §15: 80% keeps the
 * shop honest — a full refund would let a player liquidate every round just to bank interest.
 */
export function quoteSellBack(pricing: BundlePricing, units: number): number {
  return Math.floor(Math.max(0, units) * getUnitPrice(pricing) * SELL_BACK_FRACTION);
}

export function sellUnits(
  pricing: BundlePricing,
  cash: number,
  ownedCount: number,
  units: number
): PurchaseResult {
  const sold = Math.max(0, Math.min(units, ownedCount));
  const proceeds = quoteSellBack(pricing, sold);

  return { cash: cash + proceeds, ownedCount: ownedCount - sold, units: sold, spent: -proceeds };
}

/** [MANUAL §7] Auto Defense is bought for the rest of the match, so it is priced by the rounds. */
export function getAutoDefensePrice(roundsRemaining: number): number {
  return AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND * Math.max(0, roundsRemaining);
}
