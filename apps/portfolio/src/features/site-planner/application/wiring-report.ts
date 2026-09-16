import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { pointAlongPolyline, polylineLength } from '../domain/geometry/wall-geometry';
import type { CableTypeId } from '../domain/model/cables';
import { CABLE_RESERVE_RATIO, cableAreaMm2, cableTypeById } from '../domain/model/cables';
import type { CircuitGroupId, DeviceId, DeviceKind } from '../domain/model/electrical';
import { cableTypeOfGroup, DEVICE_KINDS } from '../domain/model/electrical';
import type { InstallationPresetId } from '../domain/model/installation';
import {
  CONDUIT_FILL_LIMIT,
  installationBoreAreaMm2,
  installationPreset,
} from '../domain/model/installation';
import type { Storey } from '../domain/model/storeys';
import { devicesOf, groupsOf, wiringRoutesOf } from '../domain/model/storeys';
import type { WiringRouteId } from '../domain/model/wiring-routes';
import type { Meters } from '../domain/units';
import type { PlanWire } from './wire-scenes';

/** One группа as the cable journal lists it: what cable, how much of it. */
export interface CableLine {
  readonly groupId: CircuitGroupId;
  readonly panelId: DeviceId;
  readonly cableTypeId: CableTypeId;
  readonly consumerCount: number;
  /** The runs of the group summed, cutting reserve added. */
  readonly lengthMeters: Meters;
}

/** A drawn stretch whose conduit the cables riding it overfill. */
interface OverfilledStretch {
  readonly routeId: WiringRouteId;
  readonly segmentIndex: number;
  readonly fillRatio: number;
  readonly at: Vector2;
}

/**
 * What the storey's wiring adds up to (`wiring.md` §3.4): the cable journal
 * per группа, the metres per cable type and per installation method, the
 * points by kind, and every drawn stretch whose conduit is overfilled. Pure
 * over the derived runs, so it is exactly as current as the plan.
 */
export interface WiringReport {
  readonly lines: readonly CableLine[];
  readonly cableMetersByType: Readonly<Partial<Record<CableTypeId, Meters>>>;
  readonly installationMetersByPreset: Readonly<Partial<Record<InstallationPresetId, Meters>>>;
  readonly deviceCounts: Readonly<Record<DeviceKind, number>>;
  readonly overfilled: readonly OverfilledStretch[];
}

export function deriveWiringReport(storey: Storey, wires: readonly PlanWire[]): WiringReport {
  const devices = devicesOf(storey);
  const groups = groupsOf(storey);
  const cableByGroup = new Map(groups.map(group => [group.id, cableTypeOfGroup(group, devices)]));
  const lines: CableLine[] = groups.map(group => {
    const runs = wires.filter(wire => wire.groupId === group.id);
    const raw = runs.reduce((sum, wire) => sum + wire.lengthMeters, 0);

    return {
      groupId: group.id,
      panelId: group.panelId,
      cableTypeId: cableByGroup.get(group.id) ?? 'vvg-3x2.5',
      consumerCount: group.deviceIds.length,
      lengthMeters: raw * (1 + CABLE_RESERVE_RATIO),
    };
  });

  const cableMetersByType: Partial<Record<CableTypeId, Meters>> = {};

  for (const line of lines) {
    cableMetersByType[line.cableTypeId] =
      (cableMetersByType[line.cableTypeId] ?? 0) + line.lengthMeters;
  }

  const installationMetersByPreset: Partial<Record<InstallationPresetId, Meters>> = {};
  const overfilled: OverfilledStretch[] = [];

  for (const route of wiringRoutesOf(storey)) {
    route.segments.forEach((segment, index) => {
      const stretchPoints = [route.points[index], route.points[index + 1]];
      const length = polylineLength(stretchPoints);

      installationMetersByPreset[segment.installation] =
        (installationMetersByPreset[segment.installation] ?? 0) + length;

      const bore = installationBoreAreaMm2(installationPreset(segment.installation));

      if (isNil(bore)) {
        return;
      }

      const riding = wires.filter(wire =>
        wire.stretches.some(
          stretch => stretch.routeId === route.id && stretch.segmentIndex === index
        )
      );
      const filled = riding.reduce((sum, wire) => {
        const cableTypeId = isNil(wire.groupId) ? undefined : cableByGroup.get(wire.groupId);

        return sum + cableAreaMm2(cableTypeById(cableTypeId ?? 'vvg-3x1.5'));
      }, 0);
      const fillRatio = filled / bore;

      if (fillRatio > CONDUIT_FILL_LIMIT) {
        overfilled.push({
          routeId: route.id,
          segmentIndex: index,
          fillRatio,
          at: pointAlongPolyline(stretchPoints, length / 2),
        });
      }
    });
  }

  const deviceCounts = Object.fromEntries(
    DEVICE_KINDS.map(kind => [kind, devices.filter(device => device.kind === kind).length])
  ) as Record<DeviceKind, number>;

  return { lines, cableMetersByType, installationMetersByPreset, deviceCounts, overfilled };
}
