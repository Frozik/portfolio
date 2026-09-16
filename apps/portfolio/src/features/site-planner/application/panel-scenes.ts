import { isNil } from 'lodash-es';

import { distanceToMultiPolygonEdge } from '../domain/geometry/segment-distance';
import { cableTypeOfGroup } from '../domain/model/electrical';
import type { AssembledGroup, PanelAssembly } from '../domain/model/panel-assembly';
import { derivePanelAssembly } from '../domain/model/panel-assembly';
import type { RoomTypeId } from '../domain/model/rooms';
import type { Storey } from '../domain/model/storeys';
import { devicesOf, groupsOf } from '../domain/model/storeys';
import type { BuildingRoom } from './room-scenes';
import { devicePlanPosition } from './wire-scenes';

/**
 * A wall device stands on the wall's centreline — inside the masonry, outside
 * every room polygon — so its room is the nearest one within this reach.
 */
const ROOM_REACH_METERS = 0.35;

/**
 * Every щиток of the storey assembled (`wiring.md` §3.6): its groups read
 * with the cable they carry and the rooms their consumers stand in, so a
 * bathroom socket puts its group behind an RCBO and the breaker is captioned
 * by the room. Derived beside the wires, from the same storey.
 */
export function derivePanelAssemblies(
  storey: Storey,
  rooms: readonly BuildingRoom[]
): readonly PanelAssembly[] {
  const devices = devicesOf(storey);
  const groups = groupsOf(storey);
  const roomOf = (deviceId: string): BuildingRoom | undefined => {
    const device = devices.find(candidate => candidate.id === deviceId);
    const position = isNil(device) ? undefined : devicePlanPosition(storey, device);

    if (isNil(position)) {
      return undefined;
    }

    let nearest: { readonly room: BuildingRoom; readonly distance: number } | undefined;

    for (const room of rooms) {
      const distance = distanceToMultiPolygonEdge(room.polygons, position);

      if (distance <= ROOM_REACH_METERS && (isNil(nearest) || distance < nearest.distance)) {
        nearest = { room, distance };
      }
    }

    return nearest?.room;
  };

  return devices
    .filter(device => device.kind === 'panel')
    .map(panel => {
      const assembled: readonly AssembledGroup[] = groups
        .filter(group => group.panelId === panel.id)
        .map(group => {
          const consumerRooms = group.deviceIds.map(roomOf);

          return {
            id: group.id,
            cableTypeId: cableTypeOfGroup(group, devices),
            consumerKinds: group.deviceIds.flatMap(deviceId => {
              const device = devices.find(candidate => candidate.id === deviceId);

              return isNil(device) ? [] : [device.kind];
            }),
            isWet: consumerRooms.some(room => room?.isWet === true),
            roomTypeId: commonestRoomType(consumerRooms),
          };
        });

      return derivePanelAssembly(panel.id, assembled);
    });
}

/** The room type most of the consumers share, if any of them has one. */
function commonestRoomType(rooms: readonly (BuildingRoom | undefined)[]): RoomTypeId | undefined {
  const counts = new Map<RoomTypeId, number>();

  for (const room of rooms) {
    if (!isNil(room?.roomTypeId)) {
      counts.set(room.roomTypeId, (counts.get(room.roomTypeId) ?? 0) + 1);
    }
  }

  let best: { readonly roomTypeId: RoomTypeId; readonly count: number } | undefined;

  for (const [roomTypeId, count] of counts) {
    if (isNil(best) || count > best.count) {
      best = { roomTypeId, count };
    }
  }

  return best?.roomTypeId;
}
