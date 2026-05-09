import { makeAutoObservable, runInAction } from 'mobx';

import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { TQualityTier } from '../domain/adaptive-quality';
import {
  MAX_PARTICIPANTS,
  PEER_DISCONNECTED_GRACE_MS,
  RTT_HISTORY_MAX_SAMPLES,
} from '../domain/constants';
import type { TEmotion } from '../domain/emotion';
import type { TGlassesStyle } from '../domain/glasses-style';
import { DEFAULT_GLASSES_STYLE } from '../domain/glasses-style';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId, RoomId } from '../domain/types';
import type {
  IAdaptiveQualityController,
  IAdaptiveQualityControllerParams,
} from '../infrastructure/adaptive-quality-controller';
import type {
  IConfPeerConnection,
  IConfPeerConnectionParams,
} from '../infrastructure/conf-peer-connection';
import type {
  IConfSignalingClient,
  IConfSignalingClientParams,
} from '../infrastructure/conf-signaling-client';
import type {
  IMediaStreamComposer,
  IMediaStreamComposerParams,
} from '../infrastructure/media-stream-composer';
import { getOrCreateParticipantId } from '../infrastructure/participant-identity';

/**
 * Lifecycle the view uses to render the right banner / spinner / error.
 * Kept as a discriminated string union so the presentation layer can
 * switch on it with `assertNever` safety.
 */
export type TConfRoomConnectionState =
  | 'idle'
  | 'acquiring-media'
  | 'connecting'
  | 'connected'
  | 'peer-disconnected'
  | 'room-full'
  | 'error';

/**
 * Factory bundle injected into the room store. Each factory produces a
 * single infrastructure object the store owns for the lifetime of the
 * call. Supplying them as factories (rather than baked-in references)
 * keeps the store unit-testable with fakes and mirrors the DDD
 * separation of application vs. infrastructure concerns.
 */
export interface IConfRoomStoreDeps {
  readonly createSignalingClient: (params: IConfSignalingClientParams) => IConfSignalingClient;
  readonly createPeerConnection: (params: IConfPeerConnectionParams) => IConfPeerConnection;
  readonly createMediaComposer: (
    params: IMediaStreamComposerParams
  ) => Promise<IMediaStreamComposer>;
  readonly createAdaptiveQualityController: (
    params: IAdaptiveQualityControllerParams
  ) => IAdaptiveQualityController;
}

export interface IConfRoomStoreParams {
  readonly roomId: RoomId;
  readonly topic: string;
  /**
   * Communication-server-backed transport. The store uses it for
   * both signaling fan-out (`signal:publish`) and TURN credentials
   * (`turn:request-credentials`). The owning hook is responsible
   * for the client lifecycle — the store does NOT call
   * `client.disconnect()` on dispose.
   */
  readonly client: ICommunicationClient;
}

/**
 * MobX store orchestrating the lifetime of a single conf room.
 *
 * Responsibilities:
 *  - acquire the local camera + microphone
 *  - open the signaling client and announce presence (`hello`)
 *  - drive perfect-negotiation peer connection setup
 *  - bubble connection state changes into a single `connectionState`
 *  - expose `toggleAudio`, `toggleVideo`, `setGlassesStyle` to the view
 *  - hand-feed glasses transforms from the presentation face-landmark
 *    hook into `localGlasses` / `remoteGlasses` observables
 *  - clean everything up on `dispose()`.
 */
export class ConfRoomStore {
  connectionState: TConfRoomConnectionState = 'idle';
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  isAudioMuted: boolean = false;
  isVideoMuted: boolean = false;
  glassesStyle: TGlassesStyle = DEFAULT_GLASSES_STYLE;
  localEmotion: TEmotion = 'neutral';
  remoteEmotion: TEmotion = 'neutral';
  qualityTier: TQualityTier = 'high';
  rttHistoryMs: readonly number[] = [];
  errorMessage: string | null = null;
  isShareDialogOpen: boolean = false;

  readonly roomId: RoomId;
  readonly participantId: ParticipantId;
  /**
   * Ephemeral per-`ConfRoomStore`-instance nonce attached to every
   * outbound `hello`. A remote peer uses it to tell an echo (same
   * `participantId` + same `session`) from a reconnect (same
   * `participantId` + different `session`) and tear down its stale peer
   * connection when a drop is detected.
   */
  private readonly sessionId: string;

  private readonly topic: string;
  private readonly client: ICommunicationClient;
  private iceServers: readonly RTCIceServer[] = [];
  private readonly deps: IConfRoomStoreDeps;

  private signaling: IConfSignalingClient | null = null;
  private peer: IConfPeerConnection | null = null;
  private media: IMediaStreamComposer | null = null;
  private adaptiveQuality: IAdaptiveQualityController | null = null;

  private remotePeerId: ParticipantId | null = null;
  private remoteSessionId: string | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private unsubscribeSignalingMessages: (() => void) | null = null;
  private unsubscribePeerState: (() => void) | null = null;
  private unsubscribeRemoteStream: (() => void) | null = null;
  private unsubscribeMediaMute: (() => void) | null = null;
  private unsubscribeMediaGlasses: (() => void) | null = null;
  private unsubscribeMediaEmotion: (() => void) | null = null;
  private unsubscribeDataMessages: (() => void) | null = null;
  private unsubscribeQualityTier: (() => void) | null = null;
  private unsubscribeQualityStats: (() => void) | null = null;
  private unsubscribeTurnRenewed: (() => void) | null = null;
  /**
   * Timer armed when the peer connection first reports
   * `iceConnectionState: 'disconnected'`. A transient network blip can
   * recover within ICE consent freshness (~30 s); we proactively close
   * the peer after a shorter grace so the browser never has to surface
   * `ICE failed` itself (Firefox warns about it loudly).
   */
  private peerDisconnectedTimer: ReturnType<typeof setTimeout> | null = null;
  private isDisposed: boolean = false;
  private hasJoined: boolean = false;

  constructor(params: IConfRoomStoreParams, deps: IConfRoomStoreDeps) {
    this.roomId = params.roomId;
    this.topic = params.topic;
    this.client = params.client;
    this.deps = deps;
    this.participantId = getOrCreateParticipantId();
    this.sessionId = crypto.randomUUID();

    makeAutoObservable(
      this,
      {
        roomId: false,
        participantId: false,
        sessionId: false,
        deps: false,
        // Teardown handles — not UI state, no consumer subscribes to
        // them. Marking them non-observable lets the join flow assign
        // them outside a `runInAction` (otherwise MobX strict-mode
        // flags every assignment as a violation).
        unsubscribeSignalingMessages: false,
        unsubscribePeerState: false,
        unsubscribeRemoteStream: false,
        unsubscribeMediaMute: false,
        unsubscribeMediaGlasses: false,
        unsubscribeMediaEmotion: false,
        unsubscribeDataMessages: false,
        unsubscribeQualityTier: false,
        unsubscribeQualityStats: false,
        unsubscribeTurnRenewed: false,
        peerDisconnectedTimer: false,
      } as never,
      { autoBind: true }
    );
  }

  join(): Promise<void> {
    if (this.hasJoined || this.isDisposed) {
      return Promise.resolve();
    }
    this.hasJoined = true;
    // MobX `flow` returns a cancellable promise; wrapping `run` through
    // `flow.bound` would require declaring the generator ahead of
    // `makeAutoObservable`, so we schedule the flow explicitly here.
    return this.runJoinFlow();
  }

  toggleAudio(): void {
    if (this.media === null) {
      return;
    }
    const next = !this.isAudioMuted;
    this.media.setAudioMuted(next);
    this.isAudioMuted = next;
  }

  toggleVideo(): void {
    if (this.media === null) {
      return;
    }
    const next = !this.isVideoMuted;
    this.media.setVideoMuted(next);
    this.isVideoMuted = next;
  }

  setGlassesStyle(style: TGlassesStyle): void {
    if (this.glassesStyle === style) {
      return;
    }
    this.glassesStyle = style;
    this.media?.setGlassesStyle(style);
  }

  /** Derived flag for the few legacy call sites that still ask "is AR live?". */
  get isArEnabled(): boolean {
    return this.glassesStyle !== 'none';
  }

  openShareDialog(): void {
    this.isShareDialogOpen = true;
  }

  closeShareDialog(): void {
    this.isShareDialogOpen = false;
  }

  leave(): void {
    this.publishBye('leave');
    this.dispose();
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    this.unsubscribeSignalingMessages?.();
    this.unsubscribeSignalingMessages = null;
    this.unsubscribePeerState?.();
    this.unsubscribePeerState = null;
    this.unsubscribeRemoteStream?.();
    this.unsubscribeRemoteStream = null;
    this.unsubscribeMediaMute?.();
    this.unsubscribeMediaMute = null;
    this.unsubscribeMediaGlasses?.();
    this.unsubscribeMediaGlasses = null;
    this.unsubscribeMediaEmotion?.();
    this.unsubscribeMediaEmotion = null;
    this.unsubscribeDataMessages?.();
    this.unsubscribeDataMessages = null;
    this.unsubscribeQualityTier?.();
    this.unsubscribeQualityTier = null;
    this.unsubscribeQualityStats?.();
    this.unsubscribeQualityStats = null;
    this.unsubscribeTurnRenewed?.();
    this.unsubscribeTurnRenewed = null;

    try {
      this.adaptiveQuality?.dispose();
    } catch {
      // Controller dispose is idempotent but may race with ongoing polls.
    }
    this.adaptiveQuality = null;
    this.rttHistoryMs = [];

    try {
      this.peer?.close();
    } catch {
      // Already-closed peers throw; safe to ignore during teardown.
    }
    this.peer = null;

    try {
      this.signaling?.dispose();
    } catch {
      // Signaling dispose is best-effort — the websocket may already be closed.
    }
    this.signaling = null;

    try {
      this.media?.dispose();
    } catch {
      // Tracks may already be stopped when unmount happens mid-navigation.
    }
    this.media = null;

    this.localStream = null;
    this.remoteStream = null;
    this.localEmotion = 'neutral';
    this.remoteEmotion = 'neutral';
    this.remotePeerId = null;
    this.remoteSessionId = null;
    this.pendingIceCandidates = [];
  }

  private async runJoinFlow(): Promise<void> {
    runInAction(() => {
      this.connectionState = 'acquiring-media';
    });

    let media: IMediaStreamComposer;
    try {
      media = await this.deps.createMediaComposer({});
    } catch (error) {
      runInAction(() => {
        this.applyErrorState(error instanceof Error ? error.message : 'Failed to start call');
      });
      return;
    }

    if (this.isDisposed) {
      media.dispose();
      return;
    }

    media.setGlassesStyle(this.glassesStyle);

    const unsubscribeMute = media.onMuteStateChange(() => {
      runInAction(() => {
        this.isAudioMuted = media.isAudioMuted;
        this.isVideoMuted = media.isVideoMuted;
      });
    });
    const unsubscribeGlasses = media.onGlassesStyleChange(() => {
      runInAction(() => {
        this.glassesStyle = media.glassesStyle;
      });
    });
    const unsubscribeEmotion = media.onEmotionChange(nextEmotion => {
      runInAction(() => {
        this.localEmotion = nextEmotion;
      });
      this.peer?.sendDataMessage({ kind: 'emotion', value: nextEmotion });
    });

    // Best-effort TURN fetch — failure leaves us with host-only ICE
    // candidates which is enough for direct LAN-to-LAN connections.
    try {
      const turn = await this.client.requestTurnCredentials();
      runInAction(() => {
        this.iceServers = [
          {
            urls: [...turn.urls],
            username: turn.username,
            credential: turn.credential,
          },
        ];
      });
    } catch {
      runInAction(() => {
        this.iceServers = [];
      });
    }

    if (this.isDisposed) {
      media.dispose();
      return;
    }

    // v2: wire mid-call ICE restart with refreshed TURN credentials.
    // Server emits `turn:credentials-renewed` after every successful
    // `auth:refresh-token`; we use it as a hint to fetch fresh creds and
    // (when a peer is live) restart ICE so media keeps flowing past the
    // current credential's TTL.
    this.unsubscribeTurnRenewed = this.client.onTurnCredentialsRenewed(() => {
      void this.handleTurnCredentialsRenewed();
    });

    const signaling = this.deps.createSignalingClient({
      client: this.client,
      topic: this.topic,
      self: this.participantId,
    });
    const unsubscribeMessages = signaling.onMessage(message => {
      this.handleSignalingMessage(message);
    });

    runInAction(() => {
      this.media = media;
      this.localStream = media.stream;
      this.isAudioMuted = media.isAudioMuted;
      this.isVideoMuted = media.isVideoMuted;
      this.glassesStyle = media.glassesStyle;
      this.localEmotion = media.currentEmotion;
      this.unsubscribeMediaMute = unsubscribeMute;
      this.unsubscribeMediaGlasses = unsubscribeGlasses;
      this.unsubscribeMediaEmotion = unsubscribeEmotion;
      this.signaling = signaling;
      this.unsubscribeSignalingMessages = unsubscribeMessages;
      this.connectionState = 'connecting';
    });

    // Announce ourselves to whoever is already in the topic.
    this.publishHello();
  }

  /**
   * v2: react to a server-issued `turn:credentials-renewed` hint by
   * fetching fresh TURN credentials and (when a peer connection is
   * live) requesting a mid-call ICE restart. Best-effort: any failure
   * leaves the existing call running with the previous creds — they
   * are still valid until their natural TTL expires.
   */
  private async handleTurnCredentialsRenewed(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    let nextIceServers: RTCIceServer[];
    try {
      const turn = await this.client.requestTurnCredentials();
      nextIceServers = [
        {
          urls: [...turn.urls],
          username: turn.username,
          credential: turn.credential,
        },
      ];
    } catch {
      return;
    }
    if (this.isDisposed) {
      return;
    }
    runInAction(() => {
      this.iceServers = nextIceServers;
    });
    // If a peer is already live, push the new creds and restart ICE.
    // `refreshIceServers` returns false on browsers that don't support
    // `setConfiguration`; in that case the existing call keeps running
    // with the prior creds and the next call naturally picks up fresh
    // ones (no crash, no thrown error).
    this.peer?.refreshIceServers(nextIceServers);
  }

  private handleSignalingMessage(message: TConfSignalMessage): void {
    if (this.isDisposed) {
      return;
    }
    switch (message.type) {
      case 'hello': {
        this.onRemoteHello(message.from, message.session);
        return;
      }
      case 'offer':
      case 'answer':
      case 'ice': {
        this.forwardToPeer(message);
        return;
      }
      case 'bye': {
        this.onRemoteBye(message.from, message.reason ?? 'leave');
        return;
      }
    }
  }

  /**
   * Is the remote slot currently held by a live peer? The slot is only
   * "occupied" when a `RTCPeerConnection` exists AND its state is one
   * of `idle` / `connecting` / `connected`. Native states
   * `disconnected` / `failed` / `closed` mean the peer dropped without
   * sending `bye`, so the slot is semantically free and can accept a
   * new joiner — otherwise a crashed or force-closed peer would wedge
   * the room forever.
   */
  private isRemoteSlotOccupied(): boolean {
    if (this.remotePeerId === null || this.peer === null) {
      return false;
    }
    const state = this.peer.state;
    return state === 'idle' || state === 'connecting' || state === 'connected';
  }

  /**
   * Handle a remote `hello`. Five outcomes depending on slot state,
   * participant id, and session nonce:
   *
   *  - Slot live + different `participantId` → third participant;
   *    reject with `bye{full}`.
   *  - Slot live + same `participantId` + same `session` → echo from
   *    the same session, ignore.
   *  - Slot live + same `participantId` + session previously unknown
   *    (we accepted them from an early offer) → record the session id,
   *    keep the live peer connection.
   *  - Slot live + same `participantId` + different `session` →
   *    reconnect after a drop: tear down the stale peer and accept
   *    fresh.
   *  - Slot free (either never taken or peer went
   *    disconnected/failed/closed without `bye`) → dispose any stale
   *    peer and accept normally. Different participant can walk in
   *    once the previous one's connection dies.
   */
  private onRemoteHello(from: ParticipantId, session: string): void {
    if (this.isRemoteSlotOccupied()) {
      if (this.remotePeerId !== from) {
        this.publishBye('full', from);
        return;
      }
      if (this.remoteSessionId === session) {
        return;
      }
      if (this.remoteSessionId === null) {
        this.remoteSessionId = session;
        return;
      }
      // Same participant with a new session nonce — WiFi drop / tab
      // reload. Tear down the stale peer before accepting the reconnect.
      this.disposePeerAndStream();
    } else if (this.peer !== null) {
      // Slot is semantically free but a dead peer is still attached —
      // tear it down before accepting the new joiner so the new peer
      // connection owns the media tracks cleanly.
      this.disposePeerAndStream();
    }

    this.acceptPeer(from, session);
    // Echo our own hello so a late joiner (who sent hello first) discovers us.
    this.publishHello();
  }

  private publishHello(): void {
    this.signaling?.publish({
      type: 'hello',
      from: this.participantId,
      session: this.sessionId,
    });
  }

  private acceptPeer(from: ParticipantId, session: string | null): void {
    if (this.media === null || this.signaling === null) {
      return;
    }

    this.remotePeerId = from;
    this.remoteSessionId = session;
    const isPolite = this.participantId < from;

    const peer = this.deps.createPeerConnection({
      isPolite,
      self: this.participantId,
      iceServers: this.iceServers,
      onSignal: message => {
        this.signaling?.publish(message);
      },
    });
    this.peer = peer;
    this.unsubscribePeerState = peer.onStateChange(state => {
      runInAction(() => {
        if (this.isDisposed) {
          return;
        }
        switch (state) {
          case 'idle':
          case 'connecting': {
            this.cancelPeerDisconnectedTimer();
            this.connectionState = 'connecting';
            return;
          }
          case 'connected': {
            this.cancelPeerDisconnectedTimer();
            this.connectionState = 'connected';
            this.errorMessage = null;
            this.startAdaptiveQuality();
            return;
          }
          case 'disconnected': {
            // Transient blip recovery window: keep the peer alive long
            // enough for ICE consent freshness to reconverge (e.g. wifi
            // switch). If we are still disconnected when the timer
            // fires, dispose the peer ourselves — that beats the
            // browser's own ICE-failed transition (~25-30 s) by ~20 s
            // and keeps the warning out of the console.
            this.connectionState = 'peer-disconnected';
            this.armPeerDisconnectedTimer();
            return;
          }
          case 'failed': {
            this.cancelPeerDisconnectedTimer();
            this.applyErrorState('Peer connection failed');
            return;
          }
          case 'closed': {
            this.cancelPeerDisconnectedTimer();
            if (this.connectionState !== 'error' && this.connectionState !== 'room-full') {
              this.connectionState = 'peer-disconnected';
            }
            return;
          }
        }
      });
    });
    this.unsubscribeRemoteStream = peer.onRemoteStream(stream => {
      runInAction(() => {
        this.remoteStream = stream;
      });
    });
    this.unsubscribeDataMessages = peer.onDataMessage(message => {
      if (message.kind === 'emotion') {
        runInAction(() => {
          this.remoteEmotion = message.value;
        });
      }
    });
    peer.onDataChannelOpen(() => {
      // Push our current emotion once the channel is live so the remote
      // renders the correct badge immediately, without waiting for the
      // next classifier commit.
      peer.sendDataMessage({ kind: 'emotion', value: this.localEmotion });
    });

    peer.setLocalStream(this.media.stream);

    // Drain any ICE candidates that arrived before the peer existed.
    if (this.pendingIceCandidates.length > 0) {
      const queued = this.pendingIceCandidates;
      this.pendingIceCandidates = [];
      for (const candidate of queued) {
        void peer.handleSignal({ type: 'ice', from, candidate });
      }
    }
  }

  private forwardToPeer(
    message: Extract<TConfSignalMessage, { type: 'offer' | 'answer' | 'ice' }>
  ): void {
    if (this.peer === null) {
      // A remote peer started negotiation before we received their hello.
      // Stash ICE candidates; accept offers by treating them as an implicit
      // hello so the handshake can proceed.
      if (message.type === 'ice') {
        this.pendingIceCandidates.push(message.candidate);
        return;
      }
      if (message.type === 'offer') {
        // Session id will be filled in when the matching hello arrives.
        this.acceptPeer(message.from, null);
      } else {
        return;
      }
    }
    if (this.peer === null) {
      return;
    }
    void this.peer.handleSignal(message);
  }

  private onRemoteBye(from: ParticipantId, reason: 'full' | 'leave'): void {
    if (reason === 'full') {
      if (MAX_PARTICIPANTS > 0) {
        this.connectionState = 'room-full';
      }
      return;
    }
    if (this.remotePeerId !== from) {
      return;
    }
    this.disposePeerAndStream();
    this.connectionState = 'peer-disconnected';
  }

  private armPeerDisconnectedTimer(): void {
    if (this.peerDisconnectedTimer !== null) {
      return;
    }
    this.peerDisconnectedTimer = setTimeout(() => {
      this.peerDisconnectedTimer = null;
      if (this.isDisposed || this.peer === null) {
        return;
      }
      // Still disconnected after the grace window — clean up ourselves
      // before the browser's ICE consent freshness timeout transitions
      // the connection to `failed` and surfaces a console warning.
      runInAction(() => {
        this.disposePeerAndStream();
        this.connectionState = 'peer-disconnected';
      });
    }, PEER_DISCONNECTED_GRACE_MS);
  }

  private cancelPeerDisconnectedTimer(): void {
    if (this.peerDisconnectedTimer === null) {
      return;
    }
    clearTimeout(this.peerDisconnectedTimer);
    this.peerDisconnectedTimer = null;
  }

  private disposePeerAndStream(): void {
    this.cancelPeerDisconnectedTimer();
    this.unsubscribePeerState?.();
    this.unsubscribePeerState = null;
    this.unsubscribeRemoteStream?.();
    this.unsubscribeRemoteStream = null;
    this.unsubscribeDataMessages?.();
    this.unsubscribeDataMessages = null;
    this.unsubscribeQualityTier?.();
    this.unsubscribeQualityTier = null;
    this.unsubscribeQualityStats?.();
    this.unsubscribeQualityStats = null;
    try {
      this.adaptiveQuality?.dispose();
    } catch {
      // Best-effort teardown.
    }
    this.adaptiveQuality = null;
    try {
      this.peer?.close();
    } catch {
      // Best-effort teardown.
    }
    this.peer = null;
    this.remoteStream = null;
    this.remoteEmotion = 'neutral';
    this.remotePeerId = null;
    this.remoteSessionId = null;
    this.pendingIceCandidates = [];
    this.qualityTier = 'high';
    this.rttHistoryMs = [];
  }

  private startAdaptiveQuality(): void {
    if (this.adaptiveQuality !== null || this.peer === null || this.isDisposed) {
      return;
    }
    const videoSender = this.peer.getVideoSender();
    if (videoSender === null) {
      return;
    }
    const controller = this.deps.createAdaptiveQualityController({
      peerConnection: this.peer.nativePeerConnection,
      videoSender,
    });
    this.unsubscribeQualityTier = controller.onTierChange(tier => {
      runInAction(() => {
        this.qualityTier = tier;
      });
    });
    this.unsubscribeQualityStats = controller.onStatsSample(stats => {
      if (stats.rttMs === null) {
        return;
      }
      const sampledRtt = stats.rttMs;
      runInAction(() => {
        this.rttHistoryMs = [...this.rttHistoryMs, sampledRtt].slice(-RTT_HISTORY_MAX_SAMPLES);
      });
    });
    this.adaptiveQuality = controller;
    this.qualityTier = controller.currentTier;
  }

  private publishBye(reason: 'full' | 'leave', _target?: ParticipantId): void {
    if (this.signaling === null) {
      return;
    }
    this.signaling.publish({
      type: 'bye',
      from: this.participantId,
      reason,
    });
  }

  private applyErrorState(message: string): void {
    this.connectionState = 'error';
    this.errorMessage = message;
  }
}
