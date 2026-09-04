import { parseJson } from '@frozik/utils/parseJson';
import { isNil } from 'lodash-es';

import type { TConfDataChannelMessage } from '../domain/data-channel-protocol';
import { parseConfDataChannelMessage } from '../domain/data-channel-protocol';
import type {
  IConfPeerConnection,
  IConfPeerConnectionParams,
  TConfPeerConnectionState,
} from '../domain/ports/peer-connection';
import type { TConfSignalMessage } from '../domain/signaling-protocol';

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
 * `RTCPeerConnection` wrapper implementing MDN's perfect negotiation: both
 * peers may offer at any time; on a glare the polite one rolls back and
 * accepts the remote offer while the impolite one ignores it. Mute flips
 * `track.enabled` and the AR overlay is painted into the track, so a call
 * negotiates once.
 */
export function createConfPeerConnection(params: IConfPeerConnectionParams): IConfPeerConnection {
  const { isPolite, iceServers, self, onSignal } = params;

  const peer = new RTCPeerConnection({ iceServers: [...iceServers] });
  const remoteStream = new MediaStream();
  const stateListeners = new Set<(state: TConfPeerConnectionState) => void>();
  const streamListeners = new Set<(stream: MediaStream | undefined) => void>();
  const dataListeners = new Set<(message: TConfDataChannelMessage) => void>();
  const dataOpenListeners = new Set<VoidFunction>();

  let state: TConfPeerConnectionState = 'idle';
  let remoteStreamEmitted: MediaStream | undefined;
  let videoSender: RTCRtpSender | undefined;
  let isMakingOffer = false;
  let ignoreRemoteOffer = false;
  let isClosed = false;

  // Negotiated on both sides with the same id, so no peer has to be the "host".
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
    const message = parseConfDataChannelMessage(parseJson<unknown>(event.data));
    if (!isNil(message)) {
      dataListeners.forEach(listener => listener(message));
    }
  });

  function setState(next: TConfPeerConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    stateListeners.forEach(listener => listener(next));
  }

  function emitRemoteStream(stream: MediaStream | undefined): void {
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
    if (!isNil(event.candidate)) {
      onSignal({ type: 'ice', from: self, candidate: event.candidate.toJSON() });
    }
  });
  peer.addEventListener('negotiationneeded', () => {
    void runNegotiation();
  });
  peer.addEventListener('track', event => {
    remoteStream.addTrack(event.track);
    emitRemoteStream(remoteStream);
  });

  async function runNegotiation(): Promise<void> {
    if (isClosed) {
      return;
    }
    isMakingOffer = true;
    try {
      await peer.setLocalDescription();
      const { localDescription } = peer;
      if (!isNil(localDescription) && localDescription.type === 'offer') {
        onSignal({ type: 'offer', from: self, sdp: localDescription.sdp });
      }
    } catch {
      // A failed local offer is reported through `connectionstatechange`; the
      // perfect-negotiation pattern retries on the next `negotiationneeded`.
    } finally {
      isMakingOffer = false;
    }
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
    if (!isNil(localDescription) && localDescription.type === 'answer') {
      onSignal({ type: 'answer', from: self, sdp: localDescription.sdp });
    }
  }

  async function handleAnswer(sdp: string): Promise<void> {
    if (peer.signalingState === 'have-local-offer') {
      await peer.setRemoteDescription({ type: 'answer', sdp });
    }
  }

  /** Candidates for an offer the polite side rolled back are expected to fail and are dropped. */
  async function handleIce(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await peer.addIceCandidate(candidate);
    } catch (error) {
      if (!ignoreRemoteOffer) {
        throw error;
      }
    }
  }

  async function handleSignal(message: TConfSignalMessage): Promise<void> {
    if (isClosed) {
      return;
    }
    switch (message.type) {
      case 'offer':
        await handleOffer(message.sdp);
        return;
      case 'answer':
        await handleAnswer(message.sdp);
        return;
      case 'ice':
        await handleIce(message.candidate);
        return;
      case 'hello':
      case 'bye':
        return;
    }
  }

  function refreshIceServers(nextIceServers: readonly RTCIceServer[]): boolean {
    // Older WebViews lack `setConfiguration`; the call then keeps its current credentials.
    if (isClosed || typeof peer.setConfiguration !== 'function') {
      return false;
    }
    peer.setConfiguration({ iceServers: [...nextIceServers] });
    peer.restartIce();
    return true;
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
    setLocalStream(stream) {
      if (isClosed) {
        return;
      }
      for (const track of stream.getTracks()) {
        const sender = peer.addTrack(track, stream);
        if (track.kind === 'video') {
          videoSender = sender;
        }
      }
    },
    getVideoSender: () => videoSender,
    /** Ambient signals are dropped while the channel is not open; the next change resends them. */
    sendDataMessage(message) {
      if (!isClosed && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(message));
      }
    },
    handleSignal,
    refreshIceServers,
    close() {
      if (isClosed) {
        return;
      }
      isClosed = true;
      dataChannel.close();
      peer.close();
      stateListeners.clear();
      streamListeners.clear();
      dataListeners.clear();
      dataOpenListeners.clear();
      setState('closed');
      emitRemoteStream(undefined);
    },
  };
}
