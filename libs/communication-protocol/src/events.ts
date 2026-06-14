/**
 * Socket.IO event-name constants for the communication server's wire protocol.
 * The single source of truth shared by the server (`apps/communication`) and
 * the browser client (`apps/portfolio`) so a typo can never drift one side out
 * of sync with the other.
 */
export const COMMAND_INITIATE = 'command:initiate';
export const COMMAND_EXECUTE = 'command:execute';
export const COMMAND_RESPONSE = 'command:response';
export const ROOM_PRESENCE = 'room:presence';
export const AUTH_TOKEN_EXPIRING = 'auth:token-expiring';
export const AUTH_TOKEN_EXPIRED = 'auth:token-expired';
export const AUTH_REFRESH_TOKEN = 'auth:refresh-token';
export const SIGNAL_PUBLISH = 'signal:publish';
export const SIGNAL_EVENT = 'signal:event';
export const TURN_REQUEST_CREDENTIALS = 'turn:request-credentials';
export const TURN_CREDENTIALS_RENEWED = 'turn:credentials-renewed';
export const SERVER_DRAINING = 'server:draining';
