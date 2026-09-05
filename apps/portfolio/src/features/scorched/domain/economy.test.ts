import { describe, expect, it } from 'vitest';

import {
  AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND,
  DEFAULT_INTEREST_PERCENT,
  MAX_ITEM_COUNT,
} from './constants';
import {
  applyInterest,
  canAfford,
  getAutoDefensePrice,
  getUnitPrice,
  purchaseBundle,
  quoteBundle,
  quoteSellBack,
  sellUnits,
} from './economy';
import { getItem } from './items/catalog';
import { getWeapon } from './weapons/catalog';

/** $1 875 for five, so $375 a shell — the arithmetic every quote below is checked against. */
const MISSILE = getWeapon('missile');

describe('applyInterest', () => {
  it('pays the default 5% on the bank between rounds', () => {
    expect(applyInterest(10000, DEFAULT_INTEREST_PERCENT)).toBe(10500);
  });

  it('rounds the payout down to whole dollars', () => {
    expect(applyInterest(1999, DEFAULT_INTEREST_PERCENT)).toBe(2098);
  });

  it('leaves the bank alone when interest is switched off', () => {
    expect(applyInterest(10000, 0)).toBe(10000);
  });

  it('pays nothing on an empty bank', () => {
    expect(applyInterest(0, 30)).toBe(0);
  });
});

describe('quoteBundle', () => {
  it('sells a whole bundle at the list price', () => {
    expect(getUnitPrice(MISSILE)).toBe(375);
    expect(quoteBundle(MISSILE, 0)).toEqual({ units: 5, cost: 1875, hasMarkup: false });
  });

  it('sells the last full bundle that still fits under the cap', () => {
    expect(quoteBundle(MISSILE, MAX_ITEM_COUNT - 5)).toEqual({
      units: 5,
      cost: 1875,
      hasMarkup: false,
    });
  });

  it('truncates at the 99 cap and adds the 20% surcharge', () => {
    expect(quoteBundle(MISSILE, 97)).toEqual({ units: 2, cost: 900, hasMarkup: true });
  });

  it('rounds a truncated bundle up to the dollar', () => {
    expect(quoteBundle({ cost: 10, bundleSize: 20 }, 98)).toEqual({
      units: 1,
      cost: 1,
      hasMarkup: true,
    });
  });

  it('sells nothing to a full locker', () => {
    expect(quoteBundle(MISSILE, MAX_ITEM_COUNT)).toEqual({ units: 0, cost: 0, hasMarkup: false });
  });
});

describe('purchaseBundle', () => {
  it('takes the cash and hands over the bundle', () => {
    expect(purchaseBundle(MISSILE, 5000, 0)).toEqual({
      cash: 3125,
      ownedCount: 5,
      units: 5,
      spent: 1875,
    });
  });

  it('refuses the sale when the cash is short', () => {
    expect(purchaseBundle(MISSILE, 1874, 0)).toEqual({
      cash: 1874,
      ownedCount: 0,
      units: 0,
      spent: 0,
    });
  });

  it('refuses the sale when the locker is full', () => {
    expect(purchaseBundle(MISSILE, 100000, MAX_ITEM_COUNT).units).toBe(0);
  });

  it('knows what the player can afford', () => {
    expect(canAfford(1875, 1875)).toBe(true);
    expect(canAfford(1874, 1875)).toBe(false);
  });
});

describe('sell-back', () => {
  it('quotes 80% of the unit price', () => {
    expect(quoteSellBack(MISSILE, 5)).toBe(1500);
    expect(quoteSellBack(MISSILE, 1)).toBe(300);
  });

  it('never turns a profit against the shop price', () => {
    expect(quoteSellBack(MISSILE, 5)).toBeLessThan(MISSILE.cost);
  });

  it('pays for the shells and takes them off the rack', () => {
    expect(sellUnits(MISSILE, 1000, 5, 2)).toEqual({
      cash: 1600,
      ownedCount: 3,
      units: 2,
      spent: -600,
    });
  });

  it('cannot sell more than the tank owns', () => {
    expect(sellUnits(MISSILE, 0, 2, 10).units).toBe(2);
  });

  it('quotes the accessory table the same way', () => {
    const trigger = getItem('contact-trigger');

    expect(getUnitPrice(trigger)).toBe(40);
    expect(quoteSellBack(trigger, 25)).toBe(800);
  });
});

describe('getAutoDefensePrice', () => {
  it('scales with the rounds still to play', () => {
    expect(getAutoDefensePrice(4)).toBe(4 * AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND);
    expect(getAutoDefensePrice(0)).toBe(0);
  });

  it('never quotes a negative price after the last round', () => {
    expect(getAutoDefensePrice(-3)).toBe(0);
  });
});
