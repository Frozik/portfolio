import { startCase } from 'lodash-es';

import type { WeaponId } from '../domain/types';

/**
 * [§1.3] Weapon names are short functional identifiers of record and stay as they are in both
 * languages. Most read correctly straight from their id; these few do not.
 */
const NAME_OVERRIDES: Readonly<Partial<Record<WeaponId, string>>> = {
  mirv: 'MIRV',
  'deaths-head': "Death's Head",
  'ton-of-dirt': 'Ton of Dirt',
};

export function getWeaponName(weaponId: WeaponId): string {
  return NAME_OVERRIDES[weaponId] ?? startCase(weaponId);
}
