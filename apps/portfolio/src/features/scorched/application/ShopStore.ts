import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { planAiItemPurchases, planAiPurchases } from '../domain/ai/shopping';
import { getItem } from '../domain/items/catalog';
import type { MatchPlayerState, ScorchedMatch } from '../domain/match';
import type { CartLine, ShopEntryRef } from '../domain/shop';
import {
  addCartPurchase,
  quoteShopPurchase,
  quoteShopSellBack,
  removeCartUnits,
} from '../domain/shop';
import type { PlayerId } from '../domain/types';
import { getWeapon } from '../domain/weapons/catalog';

export interface IShopStoreParams {
  /** `startMatch` swaps the match out, so the counter reads it through rather than holding one. */
  readonly getMatch: () => ScorchedMatch;
  /** The counter only trades while the shop screen is the one on show. */
  readonly isCounterOpen: () => boolean;
  /** Cash and lockers just moved; the HUD mirrors of both live outside the shop. */
  readonly onMatchChanged: VoidFunction;
}

/**
 * The counter itself: who is at it, who is queued behind them, the receipt of this visit and
 * every purchase or sell-back made against the match's bank. Which screen is on show and when the
 * queue is filled stay with `ScorchedStore` — the shop only knows about shopping.
 */
export class ShopStore {
  playerId: PlayerId | undefined;
  cart: readonly CartLine[] = [];

  private queue: readonly PlayerId[] = [];
  private readonly getMatch: () => ScorchedMatch;
  private readonly isCounterOpen: () => boolean;
  private readonly onMatchChanged: VoidFunction;

  constructor(params: IShopStoreParams) {
    this.getMatch = params.getMatch;
    this.isCounterOpen = params.isCounterOpen;
    this.onMatchChanged = params.onMatchChanged;

    makeAutoObservable<ShopStore, 'queue' | 'getMatch' | 'isCounterOpen' | 'onMatchChanged'>(
      this,
      {
        queue: false,
        getMatch: false,
        isCounterOpen: false,
        onMatchChanged: false,
      },
      { autoBind: true }
    );
  }

  buy(entry: ShopEntryRef): boolean {
    const playerId = this.playerId;
    const player = isNil(playerId) ? undefined : this.findPlayer(playerId);

    if (!this.isCounterOpen() || isNil(playerId) || isNil(player)) {
      return false;
    }

    const match = this.getMatch();
    const quote = quoteShopPurchase(
      entry,
      match.roundsRemaining,
      player.cash,
      this.getOwnedCount(playerId, entry)
    );
    const isBought =
      entry.kind === 'weapon'
        ? match.buyWeapon(playerId, entry.weaponId)
        : match.buyItem(playerId, entry.itemId);

    if (!isBought) {
      return false;
    }

    this.cart = addCartPurchase(this.cart, entry, quote);
    this.onMatchChanged();

    return true;
  }

  sell(entry: ShopEntryRef, units: number): boolean {
    const playerId = this.playerId;

    if (!this.isCounterOpen() || isNil(playerId)) {
      return false;
    }

    const match = this.getMatch();
    const owned = this.getOwnedCount(playerId, entry);
    const sold = Math.max(0, Math.min(units, owned));
    const isSold =
      entry.kind === 'weapon'
        ? match.sellWeapon(playerId, entry.weaponId, sold)
        : match.sellItem(playerId, entry.itemId, sold);

    if (!isSold) {
      return false;
    }

    this.cart = removeCartUnits(
      this.cart,
      entry,
      sold,
      quoteShopSellBack(entry, match.roundsRemaining, sold)
    );
    this.onMatchChanged();

    return true;
  }

  getOwnedCount(playerId: PlayerId, entry: ShopEntryRef): number {
    const player = this.findPlayer(playerId);

    if (isNil(player)) {
      return 0;
    }

    return entry.kind === 'weapon'
      ? (player.weapons[entry.weaponId] ?? 0)
      : (player.items[entry.itemId] ?? 0);
  }

  /** The shop lists an entry only when the match's arms level unlocks it [MANUAL §6]. */
  isEntryUnlocked(entry: ShopEntryRef): boolean {
    const armsLevel =
      entry.kind === 'weapon'
        ? getWeapon(entry.weaponId).armsLevel
        : getItem(entry.itemId).armsLevel;

    return armsLevel <= this.getMatch().armsLevel;
  }

  /** The shoppers to serve, in the order they get their turn at the counter. */
  setQueue(playerIds: readonly PlayerId[]): void {
    this.queue = [...playerIds];
  }

  /** Hands the counter to the next queued shopper; false once there is nobody left to serve. */
  openNext(): boolean {
    const [nextPlayerId, ...rest] = this.queue;

    if (isNil(nextPlayerId)) {
      return false;
    }

    this.queue = rest;
    this.playerId = nextPlayerId;
    this.cart = [];

    return true;
  }

  /** The shop is behind us: no shopper, no receipt. */
  close(): void {
    this.playerId = undefined;
    this.cart = [];
  }

  dispose(): void {
    this.queue = [];
    this.close();
  }

  /**
   * The AIs restock between rounds so a long match does not become a baby-missile duel —
   * but the shop is for survivors, exactly as it is for the humans queued ahead of them.
   */
  runAiShopping(playerIds: readonly PlayerId[]): void {
    const match = this.getMatch();

    for (const playerId of playerIds) {
      for (const itemId of planAiItemPurchases({
        cash: this.findPlayer(playerId)?.cash ?? 0,
        armsLevel: match.armsLevel,
        roundsRemaining: match.roundsRemaining,
        getOwnedCount: ownedItemId => this.findPlayer(playerId)?.items[ownedItemId] ?? 0,
      })) {
        match.buyItem(playerId, itemId);
      }

      // The weapon rack shops from what the defence run left in the bank.
      for (const weaponId of planAiPurchases(
        this.findPlayer(playerId)?.cash ?? 0,
        match.armsLevel
      )) {
        match.buyWeapon(playerId, weaponId);
      }
    }

    this.onMatchChanged();
  }

  private findPlayer(playerId: PlayerId): MatchPlayerState | undefined {
    return this.getMatch().players.find(player => player.id === playerId);
  }
}
