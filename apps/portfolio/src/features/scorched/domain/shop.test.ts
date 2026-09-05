import { describe, expect, it } from 'vitest';

import {
  AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND,
  MAX_ITEM_COUNT,
  TRUNCATED_BUNDLE_MARKUP,
} from './constants';
import { getUnitPrice } from './economy';
import { getItem } from './items/catalog';
import type { ShopEntryRef } from './shop';
import {
  addCartPurchase,
  findCartLine,
  getCartTotal,
  getShopArmsLevel,
  getShopPricing,
  isSameShopEntry,
  quoteShopPurchase,
  quoteShopSellBack,
  removeCartUnits,
} from './shop';
import { getWeapon } from './weapons/catalog';

const MISSILE: ShopEntryRef = { kind: 'weapon', weaponId: 'missile' };
const BATTERY: ShopEntryRef = { kind: 'item', itemId: 'battery' };
const AUTO_DEFENSE: ShopEntryRef = { kind: 'item', itemId: 'auto-defense' };

const ROUNDS_REMAINING = 4;
const PLENTY_OF_CASH = 1_000_000;
const NO_STOCK = 0;

describe('getShopPricing', () => {
  it('prices a weapon straight off the catalog', () => {
    expect(getShopPricing(MISSILE, ROUNDS_REMAINING)).toEqual(getWeapon('missile'));
  });

  it('prices an ordinary accessory straight off its table row', () => {
    expect(getShopPricing(BATTERY, ROUNDS_REMAINING)).toEqual(getItem('battery'));
  });

  it('[MANUAL §7] prices Auto Defense by the rounds still to play', () => {
    expect(getShopPricing(AUTO_DEFENSE, ROUNDS_REMAINING).cost).toBe(
      AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND * ROUNDS_REMAINING
    );
  });

  it('charges nothing for Auto Defense once the match has no rounds left', () => {
    expect(getShopPricing(AUTO_DEFENSE, 0).cost).toBe(0);
  });
});

describe('getShopArmsLevel', () => {
  it('reads the gate off whichever catalog the entry came from', () => {
    expect(getShopArmsLevel(MISSILE)).toBe(getWeapon('missile').armsLevel);
    expect(getShopArmsLevel(BATTERY)).toBe(getItem('battery').armsLevel);
  });
});

describe('quoteShopPurchase', () => {
  it('quotes a whole bundle at the catalog price', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);

    expect(quote.units).toBe(getWeapon('missile').bundleSize);
    expect(quote.cost).toBe(getWeapon('missile').cost);
    expect(quote.hasMarkup).toBe(false);
    expect(quote.isAffordable).toBe(true);
  });

  it('[MANUAL §8] truncates the final bundle at 99 and charges the surcharge', () => {
    const missile = getWeapon('missile');
    const owned = MAX_ITEM_COUNT - 2;
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, owned);

    expect(quote.units).toBe(2);
    expect(quote.hasMarkup).toBe(true);
    expect(quote.cost).toBe(Math.ceil(2 * getUnitPrice(missile) * (1 + TRUNCATED_BUNDLE_MARKUP)));
    expect(quote.cost).toBeGreaterThan(2 * getUnitPrice(missile));
  });

  it('reports a full inventory as unavailable rather than merely unaffordable', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, MAX_ITEM_COUNT);

    expect(quote.isAvailable).toBe(false);
    expect(quote.isAffordable).toBe(false);
  });

  it('marks a bundle the bank cannot cover as unaffordable but still available', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, 1, NO_STOCK);

    expect(quote.isAvailable).toBe(true);
    expect(quote.isAffordable).toBe(false);
  });
});

describe('quoteShopSellBack', () => {
  it('quotes Auto Defense back at the same rounds-scaled unit price', () => {
    const price = AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND * ROUNDS_REMAINING;

    expect(quoteShopSellBack(AUTO_DEFENSE, ROUNDS_REMAINING, 1)).toBe(Math.floor(price * 0.8));
  });
});

describe('the shop cart', () => {
  it('merges repeated purchases of the same entry into one line', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const lines = addCartPurchase(addCartPurchase([], MISSILE, quote), MISSILE, quote);

    expect(lines).toHaveLength(1);
    expect(lines[0].bundleCount).toBe(2);
    expect(lines[0].units).toBe(quote.units * 2);
    expect(getCartTotal(lines)).toBe(quote.cost * 2);
  });

  it('keeps different entries on separate lines', () => {
    const missileQuote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const batteryQuote = quoteShopPurchase(BATTERY, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const lines = addCartPurchase(
      addCartPurchase([], MISSILE, missileQuote),
      BATTERY,
      batteryQuote
    );

    expect(lines).toHaveLength(2);
    expect(findCartLine(lines, BATTERY)?.units).toBe(batteryQuote.units);
    expect(getCartTotal(lines)).toBe(missileQuote.cost + batteryQuote.cost);
  });

  it('remembers that a line carried the 99-cap surcharge', () => {
    const plain = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const truncated = quoteShopPurchase(
      MISSILE,
      ROUNDS_REMAINING,
      PLENTY_OF_CASH,
      MAX_ITEM_COUNT - 1
    );
    const lines = addCartPurchase(addCartPurchase([], MISSILE, plain), MISSILE, truncated);

    expect(lines[0].hasMarkup).toBe(true);
  });

  it('takes sold-back units off the line and refunds the receipt', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const lines = removeCartUnits([...addCartPurchase([], MISSILE, quote)], MISSILE, 1, 100);

    expect(lines[0].units).toBe(quote.units - 1);
    expect(getCartTotal(lines)).toBe(quote.cost - 100);
  });

  it('drops a line entirely once every unit of it has gone back', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const lines = removeCartUnits(
      addCartPurchase([], MISSILE, quote),
      MISSILE,
      quote.units,
      quote.cost
    );

    expect(lines).toHaveLength(0);
  });

  it('leaves the receipt alone when the entry was never bought', () => {
    const quote = quoteShopPurchase(MISSILE, ROUNDS_REMAINING, PLENTY_OF_CASH, NO_STOCK);
    const lines = addCartPurchase([], MISSILE, quote);

    expect(removeCartUnits(lines, BATTERY, 1, 10)).toBe(lines);
  });
});

describe('isSameShopEntry', () => {
  it('never confuses a weapon with an accessory that shares an id shape', () => {
    expect(isSameShopEntry(MISSILE, MISSILE)).toBe(true);
    expect(isSameShopEntry(MISSILE, BATTERY)).toBe(false);
  });
});
