import type { MuxSessionOptions } from './mux-session';

/**
 * A sender starts with the credit the receiver is going to grant, so both
 * ends must agree on it: it is part of the protocol, not a tuning knob.
 */
export const MUX_PROTOCOL_LIMITS = {
  initialCredit: 256 * 1024,
  maxDataBytes: 64 * 1024,
} as const;

/** The WebSocket subprotocol that names this wire format and its version (`MUX.md`). */
export const MUX_SUBPROTOCOL = 'frozik-mux.v1';

export const MUX_DEFAULT_SEND_BUFFER = {
  sendBufferBytes: 1024 * 1024,
  drainPollMs: 5,
} as const;

export function muxSessionOptions(
  role: MuxSessionOptions['role'],
  maxIncomingStreams: number
): MuxSessionOptions {
  return { ...MUX_PROTOCOL_LIMITS, ...MUX_DEFAULT_SEND_BUFFER, role, maxIncomingStreams };
}
