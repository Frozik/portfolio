import { assert } from '@frozik/utils/assert/assert';

import {
  DEATHS_HEAD_WARHEAD_COUNT,
  DIRT_CHARGE_WEDGE_RADIUS_WU,
  MIRV_WARHEAD_COUNT,
  PLASMA_MAX_RADIUS_WU,
} from '../constants';
import type { WeaponFamily, WeaponId } from '../types';

/**
 * One row of the §6 table. Costs, bundles, radii and arms levels are [MANUAL] facts; the
 * tunnel lengths and flow volumes fill in the rows the manual prints as "—".
 */
export interface WeaponDefinition {
  readonly id: WeaponId;
  readonly family: WeaponFamily;
  readonly cost: number;
  readonly bundleSize: number;
  /** Blast or effect radius in wu; 0 for the families that have none of their own. */
  readonly blastRadiusWu: number;
  /** Warheads one trigger pull ends up producing. */
  readonly warheadCount: number;
  /** Per-hop radii of the Leap Frog; empty for every other family. */
  readonly hopRadiiWu: readonly number[];
  /** Volume of napalm or liquid dirt released; 0 for the rest. */
  readonly flowVolumeWu: number;
  readonly armsLevel: number;
  /** [MANUAL §6] The Baby Missile is the free fallback and never runs out. */
  readonly isUnlimited: boolean;
  /** [MANUAL §6] Guidance cannot be fitted to MIRVs, riot charges or plasma. */
  readonly isGuidanceCompatible: boolean;
}

const NO_HOPS: readonly number[] = [];

export const WEAPONS: readonly WeaponDefinition[] = [
  {
    id: 'baby-missile',
    family: 'ballistic',
    cost: 400,
    bundleSize: 10,
    blastRadiusWu: 10,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 0,
    isUnlimited: true,
    isGuidanceCompatible: true,
  },
  {
    id: 'missile',
    family: 'ballistic',
    cost: 1875,
    bundleSize: 5,
    blastRadiusWu: 20,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 0,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'baby-nuke',
    family: 'ballistic',
    cost: 10000,
    bundleSize: 3,
    blastRadiusWu: 40,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 0,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'nuke',
    family: 'ballistic',
    cost: 12000,
    bundleSize: 1,
    blastRadiusWu: 75,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 1,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'leap-frog',
    family: 'leapfrog',
    cost: 10000,
    bundleSize: 2,
    blastRadiusWu: 20,
    warheadCount: 1,
    hopRadiiWu: [20, 25, 30],
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'funky-bomb',
    family: 'funky',
    cost: 7000,
    bundleSize: 2,
    blastRadiusWu: 80,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 4,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'mirv',
    family: 'mirv',
    cost: 10000,
    bundleSize: 3,
    blastRadiusWu: 20,
    warheadCount: MIRV_WARHEAD_COUNT,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: false,
  },
  {
    id: 'deaths-head',
    family: 'mirv',
    cost: 20000,
    bundleSize: 1,
    blastRadiusWu: 35,
    warheadCount: DEATHS_HEAD_WARHEAD_COUNT,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 4,
    isUnlimited: false,
    isGuidanceCompatible: false,
  },
  {
    id: 'napalm',
    family: 'napalm',
    cost: 10000,
    bundleSize: 10,
    blastRadiusWu: 0,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 400,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'hot-napalm',
    family: 'napalm',
    cost: 20000,
    bundleSize: 2,
    blastRadiusWu: 0,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 900,
    armsLevel: 4,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'baby-roller',
    family: 'roller',
    cost: 5000,
    bundleSize: 10,
    blastRadiusWu: 10,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'roller',
    family: 'roller',
    cost: 6000,
    bundleSize: 5,
    blastRadiusWu: 20,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'heavy-roller',
    family: 'roller',
    cost: 6750,
    bundleSize: 2,
    blastRadiusWu: 45,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'riot-charge',
    family: 'riot-charge',
    cost: 2000,
    bundleSize: 10,
    blastRadiusWu: 36,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: false,
  },
  {
    id: 'riot-blast',
    family: 'riot-charge',
    cost: 5000,
    bundleSize: 5,
    blastRadiusWu: 60,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: false,
  },
  {
    id: 'riot-bomb',
    family: 'riot-bomb',
    cost: 5000,
    bundleSize: 5,
    blastRadiusWu: 30,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'heavy-riot-bomb',
    family: 'riot-bomb',
    cost: 4750,
    bundleSize: 2,
    blastRadiusWu: 45,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'dirt-clod',
    family: 'dirt-deposit',
    cost: 5000,
    bundleSize: 10,
    blastRadiusWu: 20,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 0,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'dirt-ball',
    family: 'dirt-deposit',
    cost: 5000,
    bundleSize: 5,
    blastRadiusWu: 35,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 0,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'ton-of-dirt',
    family: 'dirt-deposit',
    cost: 6750,
    bundleSize: 2,
    blastRadiusWu: 70,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 1,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'liquid-dirt',
    family: 'liquid-dirt',
    cost: 5000,
    bundleSize: 10,
    blastRadiusWu: 0,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 1200,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'dirt-charge',
    family: 'dirt-charge',
    cost: 5000,
    bundleSize: 5,
    blastRadiusWu: DIRT_CHARGE_WEDGE_RADIUS_WU,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 1,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
  {
    id: 'plasma-blast',
    family: 'plasma',
    cost: 9000,
    bundleSize: 5,
    blastRadiusWu: PLASMA_MAX_RADIUS_WU,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 3,
    isUnlimited: false,
    isGuidanceCompatible: false,
  },
  {
    id: 'laser',
    family: 'laser',
    cost: 5000,
    bundleSize: 5,
    blastRadiusWu: 0,
    warheadCount: 1,
    hopRadiiWu: NO_HOPS,
    flowVolumeWu: 0,
    armsLevel: 2,
    isUnlimited: false,
    isGuidanceCompatible: true,
  },
];

export function getWeapon(weaponId: WeaponId): WeaponDefinition {
  const weapon = WEAPONS.find(candidate => candidate.id === weaponId);

  assert(weapon !== undefined, `unknown weapon ${weaponId}`);

  return weapon;
}

/** [MANUAL §6] The shop only lists what the match's arms level unlocks. */
export function getWeaponsForArmsLevel(armsLevel: number): readonly WeaponDefinition[] {
  return WEAPONS.filter(weapon => weapon.armsLevel <= armsLevel);
}

/** The Baby Missile: what a bankrupt tank always has left to fire. */
export function getFallbackWeaponId(): WeaponId {
  const fallback = WEAPONS.find(weapon => weapon.isUnlimited);

  assert(fallback !== undefined, 'the catalog has no unlimited fallback weapon');

  return fallback.id;
}
