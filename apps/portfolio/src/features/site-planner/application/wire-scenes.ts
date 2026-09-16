import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { cableRunLengthMeters, runHeightMeters } from '../domain/geometry/cable-length';
import { pointAlongPolyline, wallCenterline } from '../domain/geometry/wall-geometry';
import type { WireAnchor } from '../domain/geometry/wire-routing';
import { routeWire } from '../domain/geometry/wire-routing';
import type { RouteStretch } from '../domain/geometry/wiring-route-graph';
import { routeAlongDrawnRoutes } from '../domain/geometry/wiring-route-graph';
import type { CircuitGroupId, DeviceId, ElectricalDevice } from '../domain/model/electrical';
import type { Storey } from '../domain/model/storeys';
import { devicesOf, groupsOf, switchLinksOf, wiringRoutesOf } from '../domain/model/storeys';
import type { WiringLevel } from '../domain/model/wiring-routes';
import type { Meters } from '../domain/units';

/** One derived cable run, panel→consumer or switch→light. */
export interface PlanWire {
  readonly points: readonly Vector2[];
  /** A switch→light link draws dashed; a circuit run draws solid. */
  readonly isSwitchLink: boolean;
  /** The группа the run belongs to — a switch link's is its light's. */
  readonly groupId: CircuitGroupId | undefined;
  /** The cable the run takes, drops at both ends included, no reserve. */
  readonly lengthMeters: Meters;
  /** The drawn stretches the run rides, for the conduit fill count. */
  readonly stretches: readonly RouteStretch[];
  /** Where the horizontal runs, and how high each end's device sits. */
  readonly level: WiringLevel;
  readonly fromHeightMeters: Meters;
  readonly toHeightMeters: Meters;
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

/** How high a device sits: its mounting height, or the run's own for a ceiling light. */
function deviceHeightMeters(
  device: ElectricalDevice,
  level: WiringLevel,
  storeyHeightMeters: Meters
): Meters {
  return device.host.kind === 'wall'
    ? device.host.heightMeters
    : runHeightMeters(level, storeyHeightMeters);
}

/**
 * The wiring the circuits imply: one run from the panel to every consumer of
 * its группа and a link from every switch to its light — along the DRAWN
 * routes wherever both ends reach them (`wiring.md` §3.3), along the walls
 * otherwise. Every run is measured as it is laid: the horizontal plus the
 * drops from the run's level to each device.
 */
export function deriveWires(storey: Storey): readonly PlanWire[] {
  const devices = devicesOf(storey);
  const routes = wiringRoutesOf(storey);
  const byId = new Map(devices.map(device => [device.id, device]));
  const groupOfDevice = new Map<DeviceId, CircuitGroupId>();

  for (const group of groupsOf(storey)) {
    for (const deviceId of group.deviceIds) {
      groupOfDevice.set(deviceId, group.id);
    }
  }

  const runBetween = (
    fromId: DeviceId,
    toId: DeviceId,
    groupId: CircuitGroupId | undefined,
    isSwitchLink: boolean
  ): PlanWire | undefined => {
    const from = byId.get(fromId);
    const to = byId.get(toId);

    if (isNil(from) || isNil(to)) {
      return undefined;
    }

    const fromAnchor = deviceAnchor(from);
    const toAnchor = deviceAnchor(to);
    const fromPoint = devicePlanPosition(storey, from);
    const toPoint = devicePlanPosition(storey, to);

    if (isNil(fromAnchor) || isNil(toAnchor) || isNil(fromPoint) || isNil(toPoint)) {
      return undefined;
    }

    const drawn = routeAlongDrawnRoutes(routes, fromPoint, toPoint);
    const points = drawn?.points ?? routeWire(storey.walls, fromAnchor, toAnchor);

    if (points.length < 2) {
      return undefined;
    }

    const firstStretch = drawn?.stretches[0];
    const level = routes.find(route => route.id === firstStretch?.routeId)?.level ?? 'ceiling';

    const fromHeightMeters = deviceHeightMeters(from, level, storey.heightMeters);
    const toHeightMeters = deviceHeightMeters(to, level, storey.heightMeters);

    return {
      points,
      isSwitchLink,
      groupId,
      stretches: drawn?.stretches ?? [],
      level,
      fromHeightMeters,
      toHeightMeters,
      lengthMeters: cableRunLengthMeters({
        planPoints: points,
        level,
        storeyHeightMeters: storey.heightMeters,
        fromHeightMeters,
        toHeightMeters,
      }),
    };
  };

  const wires: PlanWire[] = [];

  for (const group of groupsOf(storey)) {
    for (const deviceId of group.deviceIds) {
      const wire = runBetween(group.panelId, deviceId, group.id, false);

      if (!isNil(wire)) {
        wires.push(wire);
      }
    }
  }

  for (const link of switchLinksOf(storey)) {
    const wire = runBetween(link.switchId, link.lightId, groupOfDevice.get(link.lightId), true);

    if (!isNil(wire)) {
      wires.push(wire);
    }
  }

  return wires;
}
