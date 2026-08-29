import type {
  ItemCounts,
  ItemId,
  PlayerId,
  PlayerInventory,
  WeaponCounts,
  WeaponId,
} from './types';
import type { WeaponDefinition } from './weapons/catalog';

interface MutableInventory {
  readonly weapons: Map<WeaponId, number>;
  readonly items: Map<ItemId, number>;
}

export interface RoundInventoryOwner {
  readonly id: PlayerId;
  readonly inventory: PlayerInventory;
}

function toMutableInventory(inventory: PlayerInventory): MutableInventory {
  return {
    weapons: new Map(Object.entries(inventory.weapons) as [WeaponId, number][]),
    items: new Map(Object.entries(inventory.items) as [ItemId, number][]),
  };
}

/**
 * The lockers as they are spent over a round: ammo drawn on firing, items drawn on use. It holds
 * no rules of its own beyond "you cannot spend what you do not have" — the round decides what a
 * spend means.
 */
export class RoundInventories {
  private readonly inventories = new Map<PlayerId, MutableInventory>();

  constructor(owners: readonly RoundInventoryOwner[]) {
    for (const owner of owners) {
      this.inventories.set(owner.id, toMutableInventory(owner.inventory));
    }
  }

  getAmmoCount(playerId: PlayerId, weaponId: WeaponId): number {
    return this.inventories.get(playerId)?.weapons.get(weaponId) ?? 0;
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.inventories.get(playerId)?.items.get(itemId) ?? 0;
  }

  getRemainingInventory(playerId: PlayerId): PlayerInventory {
    const inventory = this.inventories.get(playerId);

    return {
      weapons: Object.fromEntries(inventory?.weapons ?? []) as WeaponCounts,
      items: Object.fromEntries(inventory?.items ?? []) as ItemCounts,
    };
  }

  consumeAmmo(playerId: PlayerId, weapon: WeaponDefinition): boolean {
    if (weapon.isUnlimited) {
      return true;
    }

    const inventory = this.inventories.get(playerId);
    const count = inventory?.weapons.get(weapon.id) ?? 0;

    if (inventory === undefined || count <= 0) {
      return false;
    }

    inventory.weapons.set(weapon.id, count - 1);

    return true;
  }

  consumeItem(playerId: PlayerId, itemId: ItemId, amount = 1): number {
    const inventory = this.inventories.get(playerId);
    const available = inventory?.items.get(itemId) ?? 0;
    const consumed = Math.min(available, amount);

    if (inventory !== undefined && consumed > 0) {
      inventory.items.set(itemId, available - consumed);
    }

    return consumed;
  }

  consumeContactTrigger(playerId: PlayerId, isRequested: boolean | undefined): boolean {
    if (isRequested !== true) {
      return false;
    }

    return this.consumeItem(playerId, 'contact-trigger') > 0;
  }
}
