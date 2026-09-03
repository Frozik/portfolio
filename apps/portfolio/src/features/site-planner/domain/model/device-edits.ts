import type { CircuitGroup, DeviceId, ElectricalDevice } from './electrical';
import { createCircuitGroup } from './electrical';
import type { Building, BuildingId } from './site-plan';
import { storeysOf } from './site-plan';
import { mapStoreys } from './storey-edits';
import type { StoreyId } from './storeys';
import { devicesOf, groupsOf, switchLinksOf } from './storeys';

export function addDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  device: ElectricalDevice
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, devices: [...devicesOf(storey), device] } : storey
  );
}

export function updateDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId,
  changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    devices: devicesOf(storey).map(device =>
      device.id === deviceId ? { ...device, ...changes } : device
    ),
  }));
}

/** Drops the device and every mention of it: membership, links, its own group. */
export function removeDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    devices: devicesOf(storey).filter(device => device.id !== deviceId),
    groups: groupsOf(storey)
      .filter(group => group.panelId !== deviceId)
      .map(group => ({
        ...group,
        deviceIds: group.deviceIds.filter(id => id !== deviceId),
      })),
    switchLinks: switchLinksOf(storey).filter(
      link => link.switchId !== deviceId && link.lightId !== deviceId
    ),
  }));
}

export function findDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId
): ElectricalDevice | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => devicesOf(storey))
        .find(device => device.id === deviceId);
}

/**
 * Joins a consumer to a panel's группа, minting the group on first use and
 * moving the consumer out of any other group — one device, one circuit.
 */
export function assignDeviceToPanel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  panelId: DeviceId,
  deviceId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const devices = devicesOf(storey);
    const hasBoth =
      devices.some(device => device.id === panelId) &&
      devices.some(device => device.id === deviceId);

    if (!hasBoth || panelId === deviceId) {
      return storey;
    }

    const cleared: readonly CircuitGroup[] = groupsOf(storey).map(group => ({
      ...group,
      deviceIds: group.deviceIds.filter(id => id !== deviceId),
    }));
    const existing = cleared.find(group => group.panelId === panelId);
    const groups =
      existing === undefined
        ? [...cleared, { ...createCircuitGroup(panelId), deviceIds: [deviceId] }]
        : cleared.map(group =>
            group.panelId === panelId
              ? { ...group, deviceIds: [...group.deviceIds, deviceId] }
              : group
          );

    return { ...storey, groups };
  });
}

/** Ties a switch to the light it commands; tying again unties nothing (idempotent). */
export function linkSwitchToLight(
  buildings: readonly Building[],
  buildingId: BuildingId,
  switchId: DeviceId,
  lightId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const devices = devicesOf(storey);
    const hasBoth =
      devices.some(device => device.id === switchId && device.kind === 'switch') &&
      devices.some(device => device.id === lightId && device.kind === 'light');
    const exists = switchLinksOf(storey).some(
      link => link.switchId === switchId && link.lightId === lightId
    );

    if (!hasBoth || exists) {
      return storey;
    }

    return { ...storey, switchLinks: [...switchLinksOf(storey), { switchId, lightId }] };
  });
}
