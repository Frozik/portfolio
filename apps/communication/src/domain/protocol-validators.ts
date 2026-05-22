import { z } from 'zod';
import { UUID_V4_REGEX } from './constants';
import { InvalidPayloadError } from './errors';
import { IDENTITY_PROVIDERS } from './IdentityProvider';

// Maximum size of a `signal:publish` payload after JSON serialization. Bytes,
// not characters — verified via `Buffer.byteLength(json, 'utf8')`.
export const MAX_SIGNAL_PAYLOAD_BYTES = 16_384;

// Marker thrown by the size refinement so the caller can distinguish
// "too large" from generic "invalid" without parsing zod's issue tree.
const SIGNAL_PAYLOAD_TOO_LARGE_MESSAGE = 'signal-payload-too-large';
const SIGNAL_PAYLOAD_NULL_MESSAGE = 'signal-payload-null';

function runParse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    // Surface the FIRST issue — usually the most informative.
    const firstIssue = result.error.issues[0];
    const message = firstIssue?.message ?? 'invalid payload';
    throw new InvalidPayloadError(message);
  }
  return result.data;
}

const userSummarySchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
});

const initiatorSummarySchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  socketId: z.string().min(1),
});

export const HandshakeAuthSchema = z.object({
  roomId: z.string().regex(UUID_V4_REGEX, 'roomId must be a UUID v4'),
  provider: z.enum(IDENTITY_PROVIDERS).optional(),
  token: z.string().min(1, 'token must not be empty').optional(),
});

export const InitiatePayloadSchema = z.object({
  command: z.string().min(1, 'command must not be empty'),
  payload: z.unknown(),
  correlationId: z.string().min(1, 'correlationId must not be empty'),
});

export const InitiateAckSchema = z.object({
  socketCount: z.number().int().nonnegative(),
  users: z.array(userSummarySchema).readonly(),
  correlationId: z.string().min(1),
});

export const ExecuteEventSchema = z.object({
  command: z.string().min(1),
  payload: z.unknown(),
  correlationId: z.string().min(1),
  initiator: initiatorSummarySchema,
});

export const ExecuteAckSchema = z.object({
  payload: z.unknown(),
  correlationId: z.string().min(1),
});

export const ResponseEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('success'),
    correlationId: z.string().min(1),
    responder: initiatorSummarySchema.optional(),
    payload: z.unknown(),
  }),
  z.object({
    kind: z.literal('timeout'),
    correlationId: z.string().min(1),
    responder: initiatorSummarySchema.optional(),
  }),
  z.object({
    kind: z.literal('responder-disconnected'),
    correlationId: z.string().min(1),
    responder: initiatorSummarySchema.optional(),
  }),
  z.object({
    kind: z.literal('dispatch-rejected'),
    correlationId: z.string().min(1),
    reason: z.string().min(1),
  }),
]);

export const RoomPresenceEventSchema = z.object({
  socketCount: z.number().int().nonnegative(),
  users: z.array(userSummarySchema).readonly(),
});

export const TokenExpiringEventSchema = z.object({
  expiresAt: z.string().min(1),
  secondsRemaining: z.number().int().nonnegative(),
});

export const RefreshTokenPayloadSchema = z.object({
  token: z.string().min(1),
});

const authErrorCodeSchema = z.enum([
  'auth/invalid-token',
  'auth/expired-token',
  'auth/wrong-audience',
  'auth/wrong-issuer',
  'auth/missing-fields',
  'auth/jwks-unreachable',
  'auth/missing-name-claim',
  'auth/sub-mismatch',
  'auth/rate-limited',
]);

export const RefreshTokenAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), expiresAt: z.string().min(1) }),
  z.object({ ok: z.literal(false), error: authErrorCodeSchema }),
]);

export const SignalPublishPayloadSchema = z
  .object({
    payload: z.unknown(),
    correlationId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.payload === null || value.payload === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: SIGNAL_PAYLOAD_NULL_MESSAGE,
        path: ['payload'],
      });
      return;
    }
    const json = JSON.stringify(value.payload);
    const byteLength = Buffer.byteLength(json, 'utf8');
    if (byteLength > MAX_SIGNAL_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: SIGNAL_PAYLOAD_TOO_LARGE_MESSAGE,
        path: ['payload'],
      });
    }
  });

export const SignalEventOutboundSchema = z.object({
  payload: z.unknown(),
  from: initiatorSummarySchema,
  correlationId: z.string().min(1).optional(),
});

const signalErrorCodeSchema = z.enum([
  'rate-limited',
  'payload-too-large',
  'invalid-payload',
  'not-in-room',
  'internal',
]);

export const SignalAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), recipientCount: z.number().int().nonnegative() }),
  z.object({ ok: z.literal(false), error: signalErrorCodeSchema }),
]);

export const TurnCredentialsAckSchema = z.object({
  username: z.string().min(1),
  credential: z.string().min(1),
  ttl: z.number().int().positive(),
  urls: z.array(z.string().min(1)).readonly(),
});

export const ServerDrainingEventSchema = z.object({}).strict();

export const TurnCredentialsRenewedEventSchema = z.object({}).strict();

export function parseHandshakeAuth(raw: unknown): z.infer<typeof HandshakeAuthSchema> {
  return runParse(HandshakeAuthSchema, raw);
}
export function parseInitiatePayload(raw: unknown): z.infer<typeof InitiatePayloadSchema> {
  return runParse(InitiatePayloadSchema, raw);
}
export function parseInitiateAck(raw: unknown): z.infer<typeof InitiateAckSchema> {
  return runParse(InitiateAckSchema, raw);
}
export function parseExecuteEvent(raw: unknown): z.infer<typeof ExecuteEventSchema> {
  return runParse(ExecuteEventSchema, raw);
}
export function parseExecuteAck(raw: unknown): z.infer<typeof ExecuteAckSchema> {
  return runParse(ExecuteAckSchema, raw);
}
export function parseResponseEvent(raw: unknown): z.infer<typeof ResponseEventSchema> {
  return runParse(ResponseEventSchema, raw);
}
export function parseRoomPresenceEvent(raw: unknown): z.infer<typeof RoomPresenceEventSchema> {
  return runParse(RoomPresenceEventSchema, raw);
}
export function parseTokenExpiringEvent(raw: unknown): z.infer<typeof TokenExpiringEventSchema> {
  return runParse(TokenExpiringEventSchema, raw);
}
export function parseRefreshTokenPayload(raw: unknown): z.infer<typeof RefreshTokenPayloadSchema> {
  return runParse(RefreshTokenPayloadSchema, raw);
}
export function parseRefreshTokenAck(raw: unknown): z.infer<typeof RefreshTokenAckSchema> {
  return runParse(RefreshTokenAckSchema, raw);
}
export function parseSignalPublishPayload(
  raw: unknown
): z.infer<typeof SignalPublishPayloadSchema> {
  // Distinguish null/oversized from generic-invalid so the caller can map to
  // the correct `SignalAck.error`.
  const result = SignalPublishPayloadSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(issue => issue.message);
    if (messages.includes(SIGNAL_PAYLOAD_TOO_LARGE_MESSAGE)) {
      throw new InvalidPayloadError(SIGNAL_PAYLOAD_TOO_LARGE_MESSAGE);
    }
    if (messages.includes(SIGNAL_PAYLOAD_NULL_MESSAGE)) {
      throw new InvalidPayloadError(SIGNAL_PAYLOAD_NULL_MESSAGE);
    }
    throw new InvalidPayloadError(messages[0] ?? 'invalid payload');
  }
  return result.data;
}
export function parseSignalEventOutbound(raw: unknown): z.infer<typeof SignalEventOutboundSchema> {
  return runParse(SignalEventOutboundSchema, raw);
}
export function parseSignalAck(raw: unknown): z.infer<typeof SignalAckSchema> {
  return runParse(SignalAckSchema, raw);
}
export function parseTurnCredentialsAck(raw: unknown): z.infer<typeof TurnCredentialsAckSchema> {
  return runParse(TurnCredentialsAckSchema, raw);
}
export function parseServerDrainingEvent(raw: unknown): z.infer<typeof ServerDrainingEventSchema> {
  return runParse(ServerDrainingEventSchema, raw);
}
export function parseTurnCredentialsRenewedEvent(
  raw: unknown
): z.infer<typeof TurnCredentialsRenewedEventSchema> {
  return runParse(TurnCredentialsRenewedEventSchema, raw);
}

// Export the marker messages so tests can reason about which branch of the
// signal-payload refinement fired.
export const SIGNAL_PAYLOAD_TOO_LARGE = SIGNAL_PAYLOAD_TOO_LARGE_MESSAGE;
export const SIGNAL_PAYLOAD_NULL = SIGNAL_PAYLOAD_NULL_MESSAGE;
