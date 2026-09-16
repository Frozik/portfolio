import type { DeviceId, DeviceKind, ElectricalDevice } from '../model/electrical';
import type { Opening, OpeningId } from '../model/openings';
import type { Wall } from '../model/walls';
import type { Meters } from '../units';
import { CEILING_RUN_OFFSET_METERS } from './cable-length';
import { polylineLength, wallCenterline } from './wall-geometry';

/** An opening as the unfolded wall shows it: where along, how wide, sill to head. */
interface ElevationOpening {
  readonly id: OpeningId;
  readonly kind: Opening['kind'];
  readonly fromMeters: Meters;
  readonly widthMeters: Meters;
  readonly sillMeters: Meters;
  readonly headMeters: Meters;
}

/** A device on the unfolded wall: where along, how high. */
interface ElevationDevice {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly alongMeters: Meters;
  readonly heightMeters: Meters;
}

/**
 * One wall unfolded into a sheet (`wiring.md` §3.6, brought forward): its
 * length and height, the openings cut into it, the devices hung on it at
 * their heights, and the ceiling run the cables drop from. Everything the
 * plan already knows, seen from the side — which is the view the electrician
 * marks the wall from.
 */
export interface WallElevation {
  readonly lengthMeters: Meters;
  readonly heightMeters: Meters;
  readonly openings: readonly ElevationOpening[];
  readonly devices: readonly ElevationDevice[];
  readonly runHeightMeters: Meters;
}

export function buildWallElevation({
  wall,
  openings,
  devices,
  storeyHeightMeters,
}: {
  readonly wall: Wall;
  readonly openings: readonly Opening[];
  readonly devices: readonly ElectricalDevice[];
  readonly storeyHeightMeters: Meters;
}): WallElevation {
  const lengthMeters = polylineLength(wallCenterline(wall));

  return {
    lengthMeters,
    heightMeters: storeyHeightMeters,
    openings: openings
      .filter(opening => opening.wallId === wall.id)
      .map(opening => ({
        id: opening.id,
        kind: opening.kind,
        fromMeters: opening.offsetMeters - opening.widthMeters / 2,
        widthMeters: opening.widthMeters,
        sillMeters: opening.sillMeters,
        headMeters: opening.headMeters,
      })),
    devices: devices.flatMap(device =>
      device.host.kind === 'wall' && device.host.wallId === wall.id
        ? [
            {
              id: device.id,
              kind: device.kind,
              alongMeters: device.host.offsetMeters,
              heightMeters: device.host.heightMeters,
            },
          ]
        : []
    ),
    runHeightMeters: storeyHeightMeters - CEILING_RUN_OFFSET_METERS,
  };
}
