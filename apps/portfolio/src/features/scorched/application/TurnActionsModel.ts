import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { ScorchedRound } from '../domain/round';
import type { ItemCounts, ItemId, WorldEvent } from '../domain/types';
import type { WorldModel } from './WorldModel';

export interface ITurnActionsModelParams {
  readonly world: WorldModel;
  /** Turn actions belong to the human whose turn it is, and only while they are still aiming. */
  readonly canAct: () => boolean;
  /** The events an action produced, for the renderer's single funnel. */
  readonly onEvents: (events: readonly WorldEvent[]) => void;
}

/** What the turn actions bar spends mid-turn. */
const TURN_ITEM_IDS: readonly ItemId[] = [
  'fuel',
  'battery',
  'super-mag',
  'heavy-shield',
  'force-shield',
  'shield',
];

/** What a tank can do with its turn other than shoot, taken from the HUD rather than a device. */
export class TurnActionsModel {
  /**
   * [MANUAL §7] While this is on the arrow keys drive the tank on its fuel instead of turning the
   * barrel. It is a mode rather than a second pair of keys because the original made the same
   * choice, and because a phone has nowhere to put another pair of steppers.
   */
  isFuelMoveMode = false;

  private readonly world: WorldModel;
  private readonly canAct: () => boolean;
  private readonly onEvents: (events: readonly WorldEvent[]) => void;

  constructor(params: ITurnActionsModelParams) {
    this.world = params.world;
    this.canAct = params.canAct;
    this.onEvents = params.onEvents;

    makeAutoObservable<TurnActionsModel, 'world' | 'canAct' | 'onEvents'>(
      this,
      { world: false, canAct: false, onEvents: false },
      { autoBind: true }
    );
  }

  /** The active tank's locker as far as the bar cares: fuel, batteries and bubbles. */
  get itemCounts(): ItemCounts {
    const round = this.world.round;
    const playerId = round.activePlayerId;

    return isNil(playerId)
      ? {}
      : Object.fromEntries(
          TURN_ITEM_IDS.map(itemId => [itemId, round.getItemCount(playerId, itemId)])
        );
  }

  /** [MANUAL §8] Helicopter out: forfeits the round's points, but denies the killer their bounty. */
  retreat(): void {
    this.run(round => round.retreat());
  }

  /** [MANUAL §7] Spends one battery on the active tank: ten health back, one battery gone. */
  spendBattery(): void {
    this.run(round => round.spendBattery());
  }

  /** [MANUAL §7] Puts one of the tank's own bubbles up; a second one replaces the first. */
  raiseShield(itemId: ItemId): void {
    this.run(round => round.raiseShield(itemId));
  }

  setFuelMoveMode(isFuelMoveMode: boolean): void {
    this.isFuelMoveMode = isFuelMoveMode;
  }

  /** Positive drives right; one call is one column, paid for out of the tank's fuel. */
  driveTank(direction: number): void {
    this.run(round => round.moveWithFuelUnits(direction));

    // An empty tank has nothing left to steer with, and a drive mode still latched on would eat
    // the arrow keys for the rest of the turn without moving anything.
    if ((this.itemCounts.fuel ?? 0) <= 0) {
      this.isFuelMoveMode = false;
    }
  }

  /** The drive mode never outlives the turn it was switched on in. */
  beginTurn(): void {
    this.isFuelMoveMode = false;
  }

  private run(act: (round: ScorchedRound) => readonly WorldEvent[]): void {
    if (!this.canAct()) {
      return;
    }

    this.onEvents(act(this.world.round));
  }
}
