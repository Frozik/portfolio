import type { CableTypeId } from './cables';
import { cableTypeById } from './cables';
import type { CircuitGroupId, DeviceId, DeviceKind } from './electrical';
import type { RoomTypeId } from './rooms';

/**
 * What stands on the DIN rail of a щиток (`wiring.md` §3.6, brought
 * forward): the incomer, then one protective device per группа — a plain
 * breaker, or an RCBO where the group serves a wet room. Derived from the
 * groups, never drawn: a group added on the plan is a module added here.
 */
export type PanelModuleKind = 'incomer' | 'breaker' | 'rcbo';

/** What a группа mostly feeds, for the label on its breaker. */
type CircuitPurpose = 'lighting' | 'sockets' | 'mixed';

export interface PanelModule {
  readonly kind: PanelModuleKind;
  /** QF1, QF2 … — the schematic designation the electrician reads. */
  readonly designation: string;
  readonly amperes: number;
  /** DIN modules of 18 mm the device takes: 1 for a breaker, 2 for the rest. */
  readonly width: number;
  readonly groupId: CircuitGroupId | undefined;
  readonly purpose: CircuitPurpose | undefined;
  /** The room most of the group's consumers stand in, when one is known. */
  readonly roomTypeId: RoomTypeId | undefined;
}

export interface PanelAssembly {
  readonly panelId: DeviceId;
  readonly modules: readonly PanelModule[];
  readonly usedModules: number;
  /** The smallest stock enclosure that holds the modules plus reserve. */
  readonly enclosureModules: number;
}

/** One группа as the assembly reads it: cable, consumers, where they stand. */
export interface AssembledGroup {
  readonly id: CircuitGroupId;
  readonly cableTypeId: CableTypeId;
  readonly consumerKinds: readonly DeviceKind[];
  /** Any consumer in a wet room puts the whole group behind an RCBO. */
  readonly isWet: boolean;
  readonly roomTypeId: RoomTypeId | undefined;
}

/** Stock enclosures by module count; the smallest that fits is chosen. */
const ENCLOSURE_MODULES: readonly number[] = [12, 18, 24, 36, 54, 72];
/** A fifth of the rail stays free — the norm's reserve for what gets added later. */
const PANEL_RESERVE_RATIO = 0.2;
/** Stock incomer ratings for a house service. */
const INCOMER_AMPERES: readonly number[] = [25, 32, 40, 50, 63];
/** Not every group draws at once; the incomer is sized to half the sum. */
const DIVERSITY_FACTOR = 0.5;
const INCOMER_WIDTH = 2;
const BREAKER_WIDTH = 1;
const RCBO_WIDTH = 2;

export function derivePanelAssembly(
  panelId: DeviceId,
  groups: readonly AssembledGroup[]
): PanelAssembly {
  const breakers: PanelModule[] = groups.map((group, index) => ({
    kind: group.isWet ? 'rcbo' : 'breaker',
    designation: `QF${index + 1}`,
    amperes: cableTypeById(group.cableTypeId).breakerAmperes,
    width: group.isWet ? RCBO_WIDTH : BREAKER_WIDTH,
    groupId: group.id,
    purpose: purposeOf(group.consumerKinds),
    roomTypeId: group.roomTypeId,
  }));
  const demand = breakers.reduce((sum, module) => sum + module.amperes, 0) * DIVERSITY_FACTOR;
  const incomer: PanelModule = {
    kind: 'incomer',
    designation: 'QF0',
    amperes: INCOMER_AMPERES.find(amperes => amperes >= demand) ?? INCOMER_AMPERES.at(-1) ?? 0,
    width: INCOMER_WIDTH,
    groupId: undefined,
    purpose: undefined,
    roomTypeId: undefined,
  };
  const modules = [incomer, ...breakers];
  const usedModules = modules.reduce((sum, module) => sum + module.width, 0);
  const needed = Math.ceil(usedModules * (1 + PANEL_RESERVE_RATIO));

  return {
    panelId,
    modules,
    usedModules,
    enclosureModules:
      ENCLOSURE_MODULES.find(size => size >= needed) ?? ENCLOSURE_MODULES.at(-1) ?? needed,
  };
}

function purposeOf(kinds: readonly DeviceKind[]): CircuitPurpose | undefined {
  if (kinds.length === 0) {
    return undefined;
  }

  if (kinds.every(kind => kind === 'light')) {
    return 'lighting';
  }

  return kinds.every(kind => kind === 'outlet') ? 'sockets' : 'mixed';
}
