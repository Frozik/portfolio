import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { pointAlongPolyline, wallCenterline } from '../domain/geometry/wall-geometry';
import type { WireAnchor } from '../domain/geometry/wire-routing';
import { routeWire } from '../domain/geometry/wire-routing';
import type { DeviceId, ElectricalDevice } from '../domain/model/electrical';
import type { Storey } from '../domain/model/storeys';
import { devicesOf, groupsOf, switchLinksOf } from '../domain/model/storeys';

/** One derived wire run, panel→consumer or switch→light. */
export interface PlanWire {
  readonly points: readonly Vector2[];
  /** A switch→light link draws dashed; a circuit run draws solid. */
  readonly isSwitchLink: boolean;
}

/** Where a device's symbol stands on the plan, its wall host resolved. */
export function devicePlanPosition(storey: Storey, device: ElectricalDevice): Vector2 | undefined {
  const { host } = device;

  if (host.kind === 'ceiling') {
    return host.position;
  }

  const wall = storey.walls.find(candidate => candidate.id === host.wallId);

  if (isNil(wall)) {
    return undefined;
  }

  return pointAlongPolyline(wallCenterline(wall), host.offsetMeters);
}

/** An anchor for the wire router: the wall host, or the resolved free point. */
function deviceAnchor(device: ElectricalDevice): WireAnchor | undefined {
  if (device.host.kind === 'wall') {
    return {
      kind: 'wall',
      wallId: device.host.wallId,
      offsetMeters: device.host.offsetMeters,
    };
  }

  return { kind: 'point', position: device.host.position };
}

/**
 * The wiring the circuits imply: one run from
 * the panel to every consumer of its группа, walked along the walls, and a
 * dashed link from every switch to the light it commands.
 */
export function deriveWires(storey: Storey): readonly PlanWire[] {
  const devices = devicesOf(storey);
  const byId = new Map(devices.map(device => [device.id, device]));
  const wires: PlanWire[] = [];
  const routeBetween = (fromId: DeviceId, toId: DeviceId): readonly Vector2[] | undefined => {
    const from = byId.get(fromId);
    const to = byId.get(toId);

    if (isNil(from) || isNil(to)) {
      return undefined;
    }

    const fromAnchor = deviceAnchor(from);
    const toAnchor = deviceAnchor(to);

    if (isNil(fromAnchor) || isNil(toAnchor)) {
      return undefined;
    }

    const points = routeWire(storey.walls, fromAnchor, toAnchor);

    return points.length > 1 ? points : undefined;
  };

  for (const group of groupsOf(storey)) {
    for (const deviceId of group.deviceIds) {
      const points = routeBetween(group.panelId, deviceId);

      if (!isNil(points)) {
        wires.push({ points, isSwitchLink: false });
      }
    }
  }

  for (const link of switchLinksOf(storey)) {
    const points = routeBetween(link.switchId, link.lightId);

    if (!isNil(points)) {
      wires.push({ points, isSwitchLink: true });
    }
  }

  return wires;
}
