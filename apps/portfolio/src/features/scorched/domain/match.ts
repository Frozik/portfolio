import { assert } from '@frozik/utils/assert/assert';

import { MAX_TANK_HEALTH, TERRAIN_COLUMN_COUNT } from './constants';
import type { BundlePricing } from './economy';
import { applyInterest, purchaseBundle, sellUnits } from './economy';
import { getItem, getItemPricing, isPermanentItem, selectAutoDefenseItem } from './items';
import type { RoundPlayerSetup } from './round';
import { ScorchedRound } from './round';
import type { MatchStanding } from './scoring';
import { countScoringKills, rankStandings, scoreRound } from './scoring';
import type { Heightfield } from './terrain/heightfield';
import { generateTerrain } from './terrain/terrain-generator';
import type {
  ItemCounts,
  ItemId,
  MatchOptions,
  MatchPhase,
  PlayerId,
  WeaponCounts,
  WeaponId,
  WorldEvent,
} from './types';
import { getWeapon } from './weapons/catalog';

export interface MatchPlayerState {
  readonly id: PlayerId;
  cash: number;
  kills: number;
  points: number;
  weapons: WeaponCounts;
  items: ItemCounts;
}

function addCount<Key extends string>(
  counts: Readonly<Partial<Record<Key, number>>>,
  key: Key,
  delta: number
): Readonly<Partial<Record<Key, number>>> {
  return { ...counts, [key]: Math.max(0, (counts[key] ?? 0) + delta) };
}

/** Tanks are spread evenly across the field so nobody starts pinned against a wall. */
export function getSpawnColumns(
  playerCount: number,
  columnCount: number = TERRAIN_COLUMN_COUNT
): readonly number[] {
  return Array.from({ length: playerCount }, (_unused, index) =>
    Math.min(columnCount - 1, Math.round(((index + 0.5) * columnCount) / playerCount))
  );
}

/**
 * The match: a sequence of rounds with the shop in between, banking each round's winnings at
 * interest and ranking the roster on aggregate kills at the end.
 */
export class ScorchedMatch {
  private readonly options: MatchOptions;
  private readonly playerStates: MatchPlayerState[];
  private phaseValue: MatchPhase = 'shop';
  private roundIndex = 0;
  private currentRound: ScorchedRound | undefined;

  constructor(options: MatchOptions) {
    this.options = options;
    this.playerStates = options.players.map(player => ({
      id: player.id,
      cash: options.startingCash,
      kills: 0,
      points: 0,
      weapons: {},
      items: {},
    }));
  }

  get phase(): MatchPhase {
    return this.phaseValue;
  }

  /** One-based number of the round being played or about to be played. */
  get roundNumber(): number {
    return this.roundIndex + 1;
  }

  get roundsRemaining(): number {
    return Math.max(0, this.options.roundCount - this.roundIndex);
  }

  get roundCount(): number {
    return this.options.roundCount;
  }

  get armsLevel(): number {
    return this.options.armsLevel;
  }

  get interestPercent(): number {
    return this.options.interestPercent;
  }

  get round(): ScorchedRound | undefined {
    return this.currentRound;
  }

  get players(): readonly MatchPlayerState[] {
    return this.playerStates;
  }

  get standings(): readonly MatchStanding[] {
    return rankStandings(
      this.playerStates.map(player => ({
        playerId: player.id,
        kills: player.kills,
        points: player.points,
      }))
    );
  }

  startRound(field: Heightfield = generateTerrain(this.options.terrain)): readonly WorldEvent[] {
    assert(this.phaseValue === 'shop', 'a round is already in progress');

    this.phaseValue = 'round';
    this.currentRound = new ScorchedRound({
      roundNumber: this.roundNumber,
      players: this.playerStates.map(player => this.createRoundSetup(player)),
      field,
      physics: this.options.physics,
      playOrder: this.options.playOrder,
    });

    return this.currentRound.start();
  }

  /** [MANUAL §8] Round winnings are banked and earn interest before the shop opens. */
  completeRound(): void {
    const round = this.currentRound;

    assert(round !== undefined && round.phase === 'ended', 'the round is not over yet');

    const outcome = round.outcome;
    const scores = scoreRound(
      this.playerStates.map(player => player.id),
      outcome
    );

    for (const player of this.playerStates) {
      const score = scores.find(candidate => candidate.playerId === player.id);
      // The round spent from its own ledger; what is left is what the player keeps.
      const remaining = round.getRemainingInventory(player.id);

      player.weapons = remaining.weapons;
      player.items = remaining.items;
      player.points += score?.points ?? 0;
      player.kills += countScoringKills(outcome, player.id);
      player.cash = applyInterest(player.cash + (score?.cash ?? 0), this.options.interestPercent);
    }

    this.currentRound = undefined;
    this.roundIndex++;
    this.phaseValue = this.roundIndex >= this.options.roundCount ? 'finished' : 'shop';
  }

  buyWeapon(playerId: PlayerId, weaponId: WeaponId): boolean {
    const weapon = getWeapon(weaponId);

    if (weapon.armsLevel > this.options.armsLevel) {
      return false;
    }

    return this.buy(
      playerId,
      weapon,
      player => player.weapons[weaponId] ?? 0,
      (player, units) => {
        player.weapons = addCount(player.weapons, weaponId, units);
      }
    );
  }

  buyItem(playerId: PlayerId, itemId: ItemId): boolean {
    const item = getItem(itemId);
    const owner = this.requireShopPlayer(playerId);

    if (item.armsLevel > this.options.armsLevel) {
      return false;
    }

    // A permanent device is installed once; a second unit would never be spent.
    if (isPermanentItem(itemId) && (owner?.items[itemId] ?? 0) > 0) {
      return false;
    }

    return this.buy(
      playerId,
      getItemPricing(item, this.roundsRemaining),
      player => player.items[itemId] ?? 0,
      (player, units) => {
        player.items = addCount(player.items, itemId, units);
      }
    );
  }

  sellWeapon(playerId: PlayerId, weaponId: WeaponId, units: number): boolean {
    return this.sell(
      playerId,
      getWeapon(weaponId),
      player => player.weapons[weaponId] ?? 0,
      (player, sold) => {
        player.weapons = addCount(player.weapons, weaponId, -sold);
      },
      units
    );
  }

  sellItem(playerId: PlayerId, itemId: ItemId, units: number): boolean {
    return this.sell(
      playerId,
      getItemPricing(getItem(itemId), this.roundsRemaining),
      player => player.items[itemId] ?? 0,
      (player, sold) => {
        player.items = addCount(player.items, itemId, -sold);
      },
      units
    );
  }

  private sell(
    playerId: PlayerId,
    pricing: BundlePricing,
    getOwned: (player: MatchPlayerState) => number,
    revoke: (player: MatchPlayerState, units: number) => void,
    units: number
  ): boolean {
    const player = this.requireShopPlayer(playerId);

    if (player === undefined) {
      return false;
    }

    const result = sellUnits(pricing, player.cash, getOwned(player), units);

    if (result.units === 0) {
      return false;
    }

    player.cash = result.cash;
    revoke(player, result.units);

    return true;
  }

  private buy(
    playerId: PlayerId,
    pricing: BundlePricing,
    getOwned: (player: MatchPlayerState) => number,
    grant: (player: MatchPlayerState, units: number) => void
  ): boolean {
    const player = this.requireShopPlayer(playerId);

    if (player === undefined) {
      return false;
    }

    const result = purchaseBundle(pricing, player.cash, getOwned(player));

    if (result.units === 0) {
      return false;
    }

    player.cash = result.cash;
    grant(player, result.units);

    return true;
  }

  private requireShopPlayer(playerId: PlayerId): MatchPlayerState | undefined {
    if (this.phaseValue !== 'shop') {
      return undefined;
    }

    return this.playerStates.find(player => player.id === playerId);
  }

  /** [MANUAL §7] Auto Defense spends the tank's best bubble for it as the round opens. */
  private createRoundSetup(player: MatchPlayerState): RoundPlayerSetup {
    const spawnColumns = getSpawnColumns(this.playerStates.length);
    const columnIndex = spawnColumns[this.playerStates.indexOf(player)];
    const armedShieldItemId =
      (player.items['auto-defense'] ?? 0) > 0 ? selectAutoDefenseItem(player.items) : undefined;

    if (armedShieldItemId !== undefined) {
      player.items = addCount(player.items, armedShieldItemId, -1);
    }

    return {
      id: player.id,
      columnIndex,
      health: MAX_TANK_HEALTH,
      inventory: { weapons: player.weapons, items: player.items },
      armedShieldItemId,
    };
  }
}
