import { describe, expect, it } from 'vitest';

import type { ItemCounts } from '../types';
import type { AiItemShoppingContext } from './shopping';
import { planAiItemPurchases } from './shopping';

const RICH_CASH = 200000;
const FULL_ARMS_LEVEL = 4;
const EARLY_ROUNDS_REMAINING = 9;

function createContext(overrides: Partial<AiItemShoppingContext> = {}): AiItemShoppingContext {
  return {
    cash: RICH_CASH,
    armsLevel: FULL_ARMS_LEVEL,
    roundsRemaining: EARLY_ROUNDS_REMAINING,
    getOwnedCount: () => 0,
    ...overrides,
  };
}

function ownedCounts(items: ItemCounts): AiItemShoppingContext['getOwnedCount'] {
  return itemId => items[itemId] ?? 0;
}

describe('planAiItemPurchases', () => {
  it('kits a rich tank out with a bubble, Auto Defense and a battery', () => {
    const plan = planAiItemPurchases(createContext());

    expect(plan).toEqual(['super-mag', 'auto-defense', 'battery']);
  });

  it('buys the best bubble the defence budget can stand', () => {
    const plan = planAiItemPurchases(createContext({ cash: 40000 }));

    expect(plan[0]).toBe('force-shield');
  });

  it('skips Auto Defense when no bubble is owned or affordable', () => {
    const plan = planAiItemPurchases(createContext({ cash: 10000 }));

    expect(plan).not.toContain('auto-defense');
  });

  it('skips Auto Defense on the last round', () => {
    const plan = planAiItemPurchases(createContext({ roundsRemaining: 1 }));

    expect(plan).not.toContain('auto-defense');
  });

  it('leaves a stocked locker alone', () => {
    const plan = planAiItemPurchases(
      createContext({
        getOwnedCount: ownedCounts({
          'heavy-shield': 4,
          'auto-defense': 1,
          battery: 3,
        }),
      })
    );

    expect(plan).toEqual([]);
  });

  it('respects the arms level gate', () => {
    const plan = planAiItemPurchases(createContext({ armsLevel: 0 }));

    expect(plan[0]).toBe('shield');
    expect(plan).not.toContain('auto-defense');
  });

  it('plans nothing for a bankrupt tank', () => {
    expect(planAiItemPurchases(createContext({ cash: 0 }))).toEqual([]);
  });
});
