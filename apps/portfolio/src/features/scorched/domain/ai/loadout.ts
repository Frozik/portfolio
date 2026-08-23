import type { WeaponFamily, WeaponId } from '../types';
import type { WeaponDefinition } from '../weapons/catalog';
import { getFallbackWeaponId, WEAPONS } from '../weapons/catalog';

/**
 * Families an AI knows what to do with. The aim solver plans a plain ballistic arc, so anything
 * whose value comes from the player reading the terrain — riot charges, dirt weapons — is
 * left out rather than wasted; a roller still rewards a near miss, so it stays in.
 */
const AI_USABLE_FAMILIES: readonly WeaponFamily[] = ['ballistic', 'mirv', 'roller', 'leapfrog'];

/** The heaviest thing in the rack the tank still has ammunition for, else the free fallback. */
export function selectAiWeapon(getAmmoCount: (weaponId: WeaponId) => number): WeaponId {
  const best = WEAPONS.filter(
    weapon => AI_USABLE_FAMILIES.includes(weapon.family) && getAmmoCount(weapon.id) > 0
  ).reduce<WeaponDefinition | undefined>(
    (heaviest, weapon) =>
      heaviest === undefined || weapon.blastRadiusWu > heaviest.blastRadiusWu ? weapon : heaviest,
    undefined
  );

  return best?.id ?? getFallbackWeaponId();
}
