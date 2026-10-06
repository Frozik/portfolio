/**
 * A sender starts with the credit the receiver is going to grant, so both
 * ends must agree on it: it is part of the protocol, not a tuning knob.
 */
export const MUX_PROTOCOL_LIMITS = {
  initialCredit: 256 * 1024,
  maxDataBytes: 64 * 1024,
} as const;

/** Readable frames are longer than their bytes; past this a chunk goes as bytes (README, «JSON wire»). */
export const MUX_MAX_TEXT_MESSAGE_BYTES = 2 * MUX_PROTOCOL_LIMITS.maxDataBytes;

export const MUX_DEFAULT_SEND_BUFFER = {
  sendBufferBytes: 1024 * 1024,
  drainPollMs: 5,
} as const;
