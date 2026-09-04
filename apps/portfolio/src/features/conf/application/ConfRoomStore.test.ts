import type { ITurnCredentialsAck } from '@frozik/communication-protocol/messages';
import { when } from 'mobx';

import type { TEmotion } from '../domain/emotion';
import type { TGlassesStyle } from '../domain/glasses-style';
import type {
  IAdaptiveQualityController,
  IAdaptiveQualityControllerParams,
} from '../domain/ports/adaptive-quality-controller';
import type { IMediaStreamComposer } from '../domain/ports/media-composer';
import type {
  IConfPeerConnection,
  IConfPeerConnectionParams,
  TConfPeerConnectionState,
} from '../domain/ports/peer-connection';
import type { IConfSignalingClient } from '../domain/ports/signaling-client';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId, RoomId } from '../domain/types';
import type { ConfRoomTransport } from './ConfRoomStore';
import { ConfRoomStore } from './ConfRoomStore';

const ROOM_ID = 'room' as RoomId;
const ME = '1111' as ParticipantId;
const PEER = '2222' as ParticipantId;
const THIRD = '3333' as ParticipantId;
const TURN: ITurnCredentialsAck = { username: 'u', credential: 'c', ttl: 60, urls: ['turn:x'] };
const ASSETS = { round: 'round.svg', hippie: 'hippie.svg', teacher: 'teacher.svg' };

class FakeSignaling implements IConfSignalingClient {
  readonly state = 'open' as const;
  readonly published: TConfSignalMessage[] = [];
  private readonly listeners = new Set<(message: TConfSignalMessage) => void>();

  onMessage(listener: (message: TConfSignalMessage) => void): VoidFunction {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onStateChange(): VoidFunction {
    return () => undefined;
  }
  publish(message: TConfSignalMessage): void {
    this.published.push(message);
  }
  dispose(): void {}
  receive(message: TConfSignalMessage): void {
    this.listeners.forEach(listener => listener(message));
  }
}

class FakePeer implements IConfPeerConnection {
  state: TConfPeerConnectionState = 'idle';
  remoteStream: MediaStream | undefined = undefined;
  readonly nativePeerConnection = {} as RTCPeerConnection;
  readonly handled: TConfSignalMessage[] = [];
  closeCount = 0;
  private readonly stateListeners = new Set<(state: TConfPeerConnectionState) => void>();

  constructor(readonly params: IConfPeerConnectionParams) {}

  onStateChange(listener: (state: TConfPeerConnectionState) => void): VoidFunction {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
  onRemoteStream(): VoidFunction {
    return () => undefined;
  }
  onDataMessage(): VoidFunction {
    return () => undefined;
  }
  onDataChannelOpen(): VoidFunction {
    return () => undefined;
  }
  setLocalStream(): void {}
  getVideoSender(): RTCRtpSender | undefined {
    return undefined;
  }
  sendDataMessage(): void {}
  handleSignal(message: TConfSignalMessage): Promise<void> {
    this.handled.push(message);
    return Promise.resolve();
  }
  refreshIceServers(): boolean {
    return true;
  }
  close(): void {
    this.closeCount += 1;
    this.transition('closed');
  }
  transition(state: TConfPeerConnectionState): void {
    this.state = state;
    this.stateListeners.forEach(listener => listener(state));
  }
}

function createFakeComposer(): IMediaStreamComposer {
  let glassesStyle: TGlassesStyle = 'round';
  return {
    stream: {} as MediaStream,
    isAudioMuted: false,
    isVideoMuted: false,
    get glassesStyle() {
      return glassesStyle;
    },
    currentEmotion: 'neutral' as TEmotion,
    onMuteStateChange: () => () => undefined,
    onGlassesStyleChange: () => () => undefined,
    onEmotionChange: () => () => undefined,
    setAudioMuted(): void {},
    setVideoMuted(): void {},
    setGlassesStyle(style: TGlassesStyle): void {
      glassesStyle = style;
    },
    dispose(): void {},
  };
}

const NO_QUALITY_CONTROLLER = (
  _params: IAdaptiveQualityControllerParams
): IAdaptiveQualityController => ({
  currentTier: 'high',
  onTierChange: () => () => undefined,
  onStatsSample: () => () => undefined,
  dispose(): void {},
});

interface IHarness {
  readonly store: ConfRoomStore;
  readonly signaling: FakeSignaling;
  readonly peers: FakePeer[];
  readonly composerDisposed: { count: number };
}

function createHarness(options: { readonly turnFails?: boolean } = {}): IHarness {
  const signaling = new FakeSignaling();
  const peers: FakePeer[] = [];
  const composerDisposed = { count: 0 };
  const client: ConfRoomTransport = {
    state: 'open',
    signalPublish: () => Promise.resolve({ ok: true, recipientCount: 1 }),
    onSignalEvent: () => () => undefined,
    onConnectionStateChange: () => () => undefined,
    requestTurnCredentials: () =>
      options.turnFails === true ? Promise.reject(new Error('no turn')) : Promise.resolve(TURN),
    onTurnCredentialsRenewed: () => () => undefined,
  };
  const store = new ConfRoomStore(
    { roomId: ROOM_ID, topic: 'conf:room', participantId: ME, client, glassesAssetUrls: ASSETS },
    {
      createSignalingClient: () => signaling,
      createPeerConnection: params => {
        const peer = new FakePeer(params);
        peers.push(peer);
        return peer;
      },
      createMediaComposer: () => {
        const composer = createFakeComposer();
        const dispose = composer.dispose;
        composer.dispose = () => {
          composerDisposed.count += 1;
          dispose();
        };
        return Promise.resolve(composer);
      },
      createAdaptiveQualityController: NO_QUALITY_CONTROLLER,
    }
  );
  return { store, signaling, peers, composerDisposed };
}

async function joined(harness: IHarness): Promise<void> {
  await harness.store.join();
  await when(() => harness.store.connectionState === 'connecting');
}

describe('ConfRoomStore', () => {
  it('acquires media, announces itself and waits for a peer', async () => {
    const harness = createHarness();

    await joined(harness);

    expect(harness.store.connectionState).toBe('connecting');
    expect(harness.store.localStream).toBeDefined();
    expect(harness.signaling.published).toEqual([
      { type: 'hello', from: ME, session: expect.any(String) },
    ]);
  });

  it('still joins when no TURN server is available', async () => {
    const harness = createHarness({ turnFails: true });

    await joined(harness);
    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });

    expect(harness.peers[0]?.params.iceServers).toEqual([]);
  });

  it('seats the first peer to say hello, with the smaller id being polite', async () => {
    const harness = createHarness();
    await joined(harness);

    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });
    harness.peers[0]?.transition('connected');

    expect(harness.peers).toHaveLength(1);
    expect(harness.peers[0]?.params.isPolite).toBe(true);
    expect(harness.store.connectionState).toBe('connected');
    expect(harness.signaling.published.filter(message => message.type === 'hello')).toHaveLength(2);
  });

  it('turns a third participant away with an addressed bye and stays connected', async () => {
    const harness = createHarness();
    await joined(harness);
    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });
    harness.peers[0]?.transition('connected');

    harness.signaling.receive({ type: 'hello', from: THIRD, session: 's3' });

    expect(harness.signaling.published.at(-1)).toEqual({
      type: 'bye',
      from: ME,
      reason: 'full',
      to: THIRD,
    });
    expect(harness.peers).toHaveLength(1);
    expect(harness.store.connectionState).toBe('connected');
  });

  it('reports room-full only when the bye is addressed to us', async () => {
    const harness = createHarness();
    await joined(harness);

    harness.signaling.receive({ type: 'bye', from: PEER, reason: 'full', to: THIRD });
    expect(harness.store.connectionState).toBe('connecting');

    harness.signaling.receive({ type: 'bye', from: PEER, reason: 'full', to: ME });
    expect(harness.store.connectionState).toBe('room-full');
  });

  it('replaces the peer when the same participant comes back with a new session', async () => {
    const harness = createHarness();
    await joined(harness);
    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });
    harness.peers[0]?.transition('connected');

    harness.signaling.receive({ type: 'hello', from: PEER, session: 's2' });

    expect(harness.peers).toHaveLength(2);
    expect(harness.peers[0]?.closeCount).toBe(1);
  });

  it('keeps early ICE candidates until an offer seats the peer', async () => {
    const harness = createHarness();
    await joined(harness);
    const candidate = { candidate: 'cand', sdpMid: '0' };

    harness.signaling.receive({ type: 'ice', from: PEER, candidate });
    expect(harness.peers).toHaveLength(0);

    harness.signaling.receive({ type: 'offer', from: PEER, sdp: 'v=0' });

    expect(harness.peers[0]?.handled).toEqual([
      { type: 'ice', from: PEER, candidate },
      { type: 'offer', from: PEER, sdp: 'v=0' },
    ]);
  });

  it('drops the peer on its bye and shows the disconnection', async () => {
    const harness = createHarness();
    await joined(harness);
    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });
    harness.peers[0]?.transition('connected');

    harness.signaling.receive({ type: 'bye', from: PEER, reason: 'leave' });

    expect(harness.store.connectionState).toBe('peer-disconnected');
    expect(harness.store.remoteStream).toBeUndefined();
    expect(harness.peers[0]?.closeCount).toBe(1);
  });

  it('broadcasts a bye and releases the media on leave', async () => {
    const harness = createHarness();
    await joined(harness);
    harness.signaling.receive({ type: 'hello', from: PEER, session: 's1' });

    harness.store.leave();

    expect(harness.signaling.published.at(-1)).toEqual({ type: 'bye', from: ME, reason: 'leave' });
    expect(harness.composerDisposed.count).toBe(1);
    expect(harness.peers[0]?.closeCount).toBe(1);
  });

  it('applies a glasses style picked before the camera was ready', async () => {
    const harness = createHarness();
    harness.store.setGlassesStyle('teacher');

    await joined(harness);

    expect(harness.store.glassesStyle).toBe('teacher');
  });
});
