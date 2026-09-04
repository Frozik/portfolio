import type { TConfDataChannelMessage } from '../data-channel-protocol';
import type { TConfSignalMessage } from '../signaling-protocol';
import type { ParticipantId } from '../types';

/** Native `RTCPeerConnectionState` plus `idle` for the moment before the first negotiation. */
export type TConfPeerConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface IConfPeerConnectionParams {
  /** Perfect negotiation needs exactly one polite peer; the lexically smaller participant id is. */
  readonly isPolite: boolean;
  readonly iceServers: readonly RTCIceServer[];
  /** Stamped onto every outbound signal. */
  readonly self: ParticipantId;
  readonly onSignal: (message: TConfSignalMessage) => void;
}

export interface IConfPeerConnection {
  readonly state: TConfPeerConnectionState;
  readonly remoteStream: MediaStream | undefined;
  readonly nativePeerConnection: RTCPeerConnection;
  onStateChange(listener: (state: TConfPeerConnectionState) => void): VoidFunction;
  onRemoteStream(listener: (stream: MediaStream | undefined) => void): VoidFunction;
  onDataMessage(listener: (message: TConfDataChannelMessage) => void): VoidFunction;
  onDataChannelOpen(listener: VoidFunction): VoidFunction;
  setLocalStream(stream: MediaStream): void;
  getVideoSender(): RTCRtpSender | undefined;
  sendDataMessage(message: TConfDataChannelMessage): void;
  handleSignal(message: TConfSignalMessage): Promise<void>;
  /**
   * Installs fresh TURN credentials and restarts ICE so media outlives the old
   * credential's TTL. `false` when the browser cannot reconfigure a live
   * connection; the call then continues on the previous credentials.
   */
  refreshIceServers(iceServers: readonly RTCIceServer[]): boolean;
  /** Idempotent. */
  close(): void;
}
