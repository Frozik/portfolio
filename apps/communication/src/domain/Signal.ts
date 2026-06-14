import type { DisplayName, UserId } from './types';

export type { SignalAck } from '@frozik/communication-protocol/messages';

export type SignalPublishPayload = {
  payload: unknown;
  correlationId?: string;
};

export type SignalEventOutbound = {
  payload: unknown;
  from: { userId: UserId; displayName: DisplayName; socketId: string };
  correlationId?: string;
};
