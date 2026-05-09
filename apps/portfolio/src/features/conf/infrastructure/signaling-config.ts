/**
 * Topic prefix applied to every conf room id on the wire. Keeps
 * conf rooms isolated from any retro room that might be running
 * on the same `apps/communication` deployment.
 */
export const CONF_ROOM_ID_NETWORK_PREFIX = 'frozik-conf-';

/** Build the topic / room key used by the communication server. */
export function getConfRoomTopic(roomId: string): string {
  return `${CONF_ROOM_ID_NETWORK_PREFIX}${roomId}`;
}
