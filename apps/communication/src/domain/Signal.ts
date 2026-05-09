import type { DisplayName, UserId } from './types';

export type SignalPublishPayload = {
  payload: unknown;
  correlationId?: string;
};

export type SignalEventOutbound = {
  payload: unknown;
  from: { userId: UserId; displayName: DisplayName; socketId: string };
  correlationId?: string;
};

export type SignalAck =
  | { ok: true; recipientCount: number }
  | {
      ok: false;
      error: 'rate-limited' | 'payload-too-large' | 'invalid-payload' | 'not-in-room' | 'internal';
    };
