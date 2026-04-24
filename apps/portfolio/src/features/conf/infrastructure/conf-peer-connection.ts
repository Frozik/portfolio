import { isNil } from 'lodash-es';
import type { TConfDataChannelMessage } from '../domain/data-channel-protocol';
import { parseConfDataChannelMessage } from '../domain/data-channel-protocol';
import { DEFAULT_ICE_SERVERS } from '../domain/ice-servers';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId } from '../domain/types';

/**
 * Lifecycle states of the WebRTC peer connection as consumed by the
 * application layer. Mapped from the native `RTCPeerConnectionState`
 * plus a leading `idle` for the moment between construction and the
 * first negotiation attempt.
 */
export type TConfPeerConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface IConfPeerConnectionParams {
  /**
   * Deterministic "polite" role required by the perfect-negotiation
   * pattern. Exactly one peer must be polite; conf resolves this by
   * comparing the two `ParticipantId` UUIDs lexically — the smaller id
   * is polite. The application layer computes this once both ids are
   * known and passes the result in here.
   */
  readonly isPolite: boolean;
  readonly iceServers?: readonly RTCIceServer[];
  /** Id of the local participant — stamped onto every outbound signal. */
  readonly self: ParticipantId;
  /** Called whenever the peer connection produces a signaling message to send. */
  readonly onSignal: (message: TConfSignalMessage) => void;
}

export interface IConfPeerConnection {
  readonly state: TConfPeerConnectionState;
  readonly remoteStream: MediaStream | null;
  readonly nativePeerConnection: RTCPeerConnection;
  onStateChange(listener: (state: TConfPeerConnectionState) => void): () => void;
  onRemoteStream(listener: (stream: MediaStream | null) => void): () => void;
  onDataMessage(listener: (message: TConfDataChannelMessage) => void): () => void;
  onDataChannelOpen(listener: () => void): () => void;
  setLocalStream(stream: MediaStream): void;
  getVideoSender(): RTCRtpSender | null;
  sendDataMessage(message: TConfDataChannelMessage): void;
  handleSignal(message: TConfSignalMessage): Promise<void>;
  close(): void;
}

function mapConnectionState(nativeState: RTCPeerConnectionState): TConfPeerConnectionState {
  switch (nativeState) {
    case 'new':
      return 'idle';
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
  }
}

/**
 * WebRTC peer-connection wrapper implementing the MDN "perfect
 * negotiation" pattern.
 *
 * Perfect negotiation in a nutshell:
 *  - Both peers can create offers at any time (including simultaneous
 *    "glare").
 *  - One peer is marked polite; on a glare it rolls back its own
 *    pending local description and accepts the remote offer.
 *  - The impolite peer ignores remote offers that arrive while it is
 *    still busy with its own.
 *
 * Conf uses this wrapper once per room. AR and mute are orthogonal to
 * renegotiation — AR is a pure CSS overlay and mute flips
 * `track.enabled`, so this wrapper only ever negotiates once per
 * connection.
 */
export function createConfPeerConnection(params: IConfPeerConnectionParams): IConfPeerConnection {
  const { isPolite, iceServers, self, onSignal } = params;

  const peer = new RTCPeerConnection({
    iceServers: [...(iceServers ?? DEFAULT_ICE_SERVERS)],
  });

  const remoteStream = new MediaStream();
  const stateListeners = new Set<(state: TConfPeerConnectionState) => void>();
  const streamListeners = new Set<(stream: MediaStream | null) => void>();
  const dataListeners = new Set<(message: TConfDataChannelMessage) => void>();
  const dataOpenListeners = new Set<() => void>();

  let state: TConfPeerConnectionState = 'idle';
  let remoteStreamEmitted: MediaStream | null = null;
  let videoSender: RTCRtpSender | null = null;
  let isMakingOffer = false;
  let ignoreRemoteOffer = false;
  let isClosed = false;

  // Negotiated (both peers open with the same id) so we don't have to
  // pick a "host" role — works symmetrically with perfect negotiation.
  const dataChannel = peer.createDataChannel('conf-side', {
    negotiated: true,
    id: 0,
    ordered: true,
  });

  dataChannel.addEventListener('open', () => {
    dataOpenListeners.forEach(listener => listener());
  });

  dataChannel.addEventListener('message', event => {
    if (typeof event.data !== 'string') {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }
    const message = parseConfDataChannelMessage(parsed);
    if (message === null) {
      return;
    }
    dataListeners.forEach(listener => listener(message));
  });

  function setState(next: TConfPeerConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    stateListeners.forEach(listener => listener(next));
  }

  function emitRemoteStream(stream: MediaStream | null): void {
    if (remoteStreamEmitted === stream) {
      return;
    }
    remoteStreamEmitted = stream;
    streamListeners.forEach(listener => listener(stream));
  }

  peer.addEventListener('connectionstatechange', () => {
    setState(mapConnectionState(peer.connectionState));
  });

  peer.addEventListener('icecandidate', event => {
    if (isNil(event.candidate)) {
      return;
    }
    onSignal({ type: 'ice', from: self, candidate: event.candidate.toJSON() });
  });

  peer.addEventListener('negotiationneeded', () => {
    void runNegotiation();
  });

  peer.addEventListener('track', event => {
    // Add any incoming track to the shared remote stream; emit it to
    // subscribers on the first track so the presentation layer can
    // bind `<video srcObject>` as soon as media arrives.
    remoteStream.addTrack(event.track);
    emitRemoteStream(remoteStream);
  });

  async function runNegotiation(): Promise<void> {
    if (isClosed) {
      return;
    }
    try {
      isMakingOffer = true;
      await peer.setLocalDescription();
      const { localDescription } = peer;
      if (isNil(localDescription) || localDescription.type !== 'offer') {
        return;
      }
      onSignal({ type: 'offer', from: self, sdp: localDescription.sdp });
    } catch {
      // Negotiation failure is surfaced via `connectionstatechange`.
    } finally {
      isMakingOffer = false;
    }
  }

  function setLocalStream(stream: MediaStream): void {
    if (isClosed) {
      return;
    }
    stream.getTracks().forEach(track => {
      const sender = peer.addTrack(track, stream);
      if (track.kind === 'video') {
        videoSender = sender;
      }
    });
  }

  async function handleOffer(sdp: string): Promise<void> {
    const offerCollision = isMakingOffer || peer.signalingState !== 'stable';
    ignoreRemoteOffer = !isPolite && offerCollision;
    if (ignoreRemoteOffer) {
      return;
    }
    await peer.setRemoteDescription({ type: 'offer', sdp });
    await peer.setLocalDescription();
    const { localDescription } = peer;
    if (isNil(localDescription) || localDescription.type !== 'answer') {
      return;
    }
    onSignal({ type: 'answer', from: self, sdp: localDescription.sdp });
  }

  async function handleAnswer(sdp: string): Promise<void> {
    if (peer.signalingState !== 'have-local-offer') {
      return;
    }
    await peer.setRemoteDescription({ type: 'answer', sdp });
  }

  async function handleIce(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await peer.addIceCandidate(candidate);
    } catch {
      // Late candidates after the connection closes, or candidates the
      // polite side ignored during a glare, arrive here. Safe to drop.
      if (!ignoreRemoteOffer) {
        throw new Error('failed to add remote ICE candidate');
      }
    }
  }

  async function handleSignal(message: TConfSignalMessage): Promise<void> {
    if (isClosed) {
      return;
    }
    switch (message.type) {
      case 'offer': {
        await handleOffer(message.sdp);
        return;
      }
      case 'answer': {
        await handleAnswer(message.sdp);
        return;
      }
      case 'ice': {
        await handleIce(message.candidate);
        return;
      }
      case 'hello':
      case 'bye': {
        // Session-level messages handled by the application layer.
        return;
      }
    }
  }

  function sendDataMessage(message: TConfDataChannelMessage): void {
    if (isClosed || dataChannel.readyState !== 'open') {
      // Drop silently: data channel isn't up yet (negotiating), or the
      // peer is torn down. Ambient signals (emotion, etc.) are safe to
      // drop since the next commit will retry.
      return;
    }
    try {
      dataChannel.send(JSON.stringify(message));
    } catch {
      // Send can race with channel close; swallow and move on.
    }
  }

  function close(): void {
    if (isClosed) {
      return;
    }
    isClosed = true;
    try {
      dataChannel.close();
    } catch {
      // Already-closed channels throw; ignore.
    }
    try {
      peer.close();
    } catch {
      // Already-closed connections throw; ignore.
    }
    stateListeners.clear();
    streamListeners.clear();
    dataListeners.clear();
    dataOpenListeners.clear();
    setState('closed');
    emitRemoteStream(null);
  }

  return {
    get state() {
      return state;
    },
    get remoteStream() {
      return remoteStreamEmitted;
    },
    get nativePeerConnection() {
      return peer;
    },
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    onRemoteStream(listener) {
      streamListeners.add(listener);
      return () => {
        streamListeners.delete(listener);
      };
    },
    onDataMessage(listener) {
      dataListeners.add(listener);
      return () => {
        dataListeners.delete(listener);
      };
    },
    onDataChannelOpen(listener) {
      dataOpenListeners.add(listener);
      return () => {
        dataOpenListeners.delete(listener);
      };
    },
    setLocalStream,
    getVideoSender: () => videoSender,
    sendDataMessage,
    handleSignal,
    close,
  };
}
