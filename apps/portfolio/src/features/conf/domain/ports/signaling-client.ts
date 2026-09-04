import type { ICommunicationClient } from '../../../../shared/communication/CommunicationClient';
import type { TConfSignalMessage } from '../signaling-protocol';
import type { ParticipantId } from '../types';

export type TConfSignalingConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

/** The slice of the communication client that carries conf signaling. */
export type ConfSignalingTransport = Pick<
  ICommunicationClient,
  'state' | 'signalPublish' | 'onSignalEvent' | 'onConnectionStateChange'
>;

export interface IConfSignalingClientParams {
  readonly client: ConfSignalingTransport;
  /** Room topic every published envelope carries, so receivers dispatch on their own room. */
  readonly topic: string;
  /** Local participant id, used to drop self-echoes together with `selfSession`. */
  readonly self: ParticipantId;
  /** Per-instance nonce: two tabs of one browser share `self` but not the session. */
  readonly selfSession: string;
}

export interface IConfSignalingClient {
  readonly state: TConfSignalingConnectionState;
  onMessage(listener: (message: TConfSignalMessage) => void): VoidFunction;
  onStateChange(listener: (state: TConfSignalingConnectionState) => void): VoidFunction;
  publish(message: TConfSignalMessage): void;
  dispose(): void;
}
