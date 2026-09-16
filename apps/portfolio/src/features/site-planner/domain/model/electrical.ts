import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';
import type { CableTypeId } from './cables';
import type { WallId } from './walls';

export type DeviceId = Opaque<'DeviceId', string>;

export function createDeviceId(): DeviceId {
  return crypto.randomUUID() as DeviceId;
}
export type CircuitGroupId = Opaque<'CircuitGroupId', string>;

/**
 * The electrical device kinds: the щиток is a
 * first-class kind — groups root at it — next to what it feeds.
 */
export type DeviceKind = 'panel' | 'outlet' | 'switch' | 'light';

/** Every kind, in the order the tool's picker offers them. */
export const DEVICE_KINDS: readonly DeviceKind[] = ['panel', 'outlet', 'switch', 'light'];

export function parseDeviceKind(value: string): DeviceKind | undefined {
  return DEVICE_KINDS.find(kind => kind === value);
}

export const DEFAULT_DEVICE_KIND: DeviceKind = 'outlet';

/**
 * Where a device lives: on a wall — the offset along its reference polyline
 * plus the mounting height, the way an opening is hosted — or on the ceiling,
 * where only a light goes.
 */
type DeviceHost =
  | {
      readonly kind: 'wall';
      readonly wallId: WallId;
      readonly offsetMeters: Meters;
      readonly heightMeters: Meters;
    }
  | { readonly kind: 'ceiling'; readonly position: Vector2 };

export interface ElectricalDevice {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly host: DeviceHost;
}

/**
 * The conventional mounting heights (the ПУЭ-era
 * practice): sockets low, switches at the hand, the щиток at the eye. A
 * placed device starts here and stays editable.
 */
const DEVICE_STANDARD_HEIGHTS_METERS: Readonly<Record<Exclude<DeviceKind, 'light'>, Meters>> = {
  panel: 1.5,
  outlet: 0.3,
  switch: 0.9,
};

/** Whether the kind hangs on a wall; a light is the one that does not. */

export function createWallDevice({
  kind,
  wallId,
  offsetMeters,
}: {
  readonly kind: Exclude<DeviceKind, 'light'>;
  readonly wallId: WallId;
  readonly offsetMeters: Meters;
}): ElectricalDevice {
  return {
    id: createDeviceId(),
    kind,
    host: {
      kind: 'wall',
      wallId,
      offsetMeters,
      heightMeters: DEVICE_STANDARD_HEIGHTS_METERS[kind],
    },
  };
}

export function createCeilingLight(position: Vector2): ElectricalDevice {
  return {
    id: createDeviceId(),
    kind: 'light',
    host: { kind: 'ceiling', position },
  };
}

/**
 * One группа rooted at a panel: the consumers it
 * feeds. Switch→light links live beside the groups — a link is wiring
 * geometry, membership is circuit bookkeeping, and the two are edited by the
 * same connect tool.
 */
export interface CircuitGroup {
  readonly id: CircuitGroupId;
  readonly panelId: DeviceId;
  readonly deviceIds: readonly DeviceId[];
  /** Absent means the section its consumers imply — read via {@link cableTypeOfGroup}. */
  readonly cableTypeId?: CableTypeId;
}

/** Lighting runs on 1.5 mm², everything with a socket on it on 2.5 mm². */
export function defaultCableTypeFor(consumerKinds: readonly DeviceKind[]): CableTypeId {
  const isLightingOnly = consumerKinds.length > 0 && consumerKinds.every(kind => kind === 'light');

  return isLightingOnly ? 'vvg-3x1.5' : 'vvg-3x2.5';
}

/** The cable a group is wired in: the override, or the section its consumers ask for. */
export function cableTypeOfGroup(
  group: CircuitGroup,
  devices: readonly ElectricalDevice[]
): CableTypeId {
  return (
    group.cableTypeId ??
    defaultCableTypeFor(
      group.deviceIds.flatMap(deviceId => {
        const device = devices.find(candidate => candidate.id === deviceId);

        return device === undefined ? [] : [device.kind];
      })
    )
  );
}

export interface SwitchLink {
  readonly switchId: DeviceId;
  readonly lightId: DeviceId;
}

export function createCircuitGroup(panelId: DeviceId): CircuitGroup {
  return { id: crypto.randomUUID() as CircuitGroupId, panelId, deviceIds: [] };
}
