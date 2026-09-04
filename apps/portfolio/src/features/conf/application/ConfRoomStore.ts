import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { TQualityTier } from '../domain/adaptive-quality';
import type { TEmotion } from '../domain/emotion';
import type { GlassesAssetUrls, TGlassesStyle } from '../domain/glasses-style';
import { DEFAULT_GLASSES_STYLE } from '../domain/glasses-style';
import type {
  IMediaStreamComposer,
  IMediaStreamComposerParams,
} from '../domain/ports/media-composer';
import type { TConfPeerConnectionState } from '../domain/ports/peer-connection';
import type {
  ConfSignalingTransport,
  IConfSignalingClient,
  IConfSignalingClientParams,
} from '../domain/ports/signaling-client';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId, RoomId } from '../domain/types';
import { LocalMedia } from './LocalMedia';
import type { IPeerSessionDeps } from './PeerSession';
import { PeerSession } from './PeerSession';

/** Lifecycle the view switches on to render the banner, spinner or error. */
export type TConfRoomConnectionState =
  | 'idle'
  | 'acquiring-media'
  | 'connecting'
  | 'connected'
  | 'peer-disconnected'
  | 'room-full'
  | 'error';

/** The communication client members the room needs: signaling plus TURN credentials. */
export type ConfRoomTransport = ConfSignalingTransport &
  Pick<ICommunicationClient, 'requestTurnCredentials' | 'onTurnCredentialsRenewed'>;

/** Adapter factories, so the store runs against fakes in tests. */
export interface IConfRoomStoreDeps extends IPeerSessionDeps {
  readonly createSignalingClient: (params: IConfSignalingClientParams) => IConfSignalingClient;
  readonly createMediaComposer: (
    params: IMediaStreamComposerParams
  ) => Promise<IMediaStreamComposer>;
}

export interface IConfRoomStoreParams {
  readonly roomId: RoomId;
  readonly topic: string;
  readonly participantId: ParticipantId;
  /** Owned by the hook that created it; the store never disconnects it. */
  readonly client: ConfRoomTransport;
  readonly glassesAssetUrls: GlassesAssetUrls;
}

type TByeReason = 'full' | 'leave';

/**
 * One conf room: acquires the local media, announces itself over signaling,
 * seats at most one remote peer and folds everything into `connectionState`.
 * The media and the peer are sub-models; this store owns the signaling
 * conversation (`hello` / `bye`), the TURN credentials and the dialog.
 */
export class ConfRoomStore {
  connectionState: TConfRoomConnectionState = 'idle';
  errorMessage: string | undefined = undefined;
  /** The last TURN renewal failed; the call keeps running on credentials that will expire. */
  hasStaleTurnCredentials = false;
  isShareDialogOpen = false;
  media: LocalMedia | undefined = undefined;
  peer: PeerSession | undefined = undefined;

  readonly roomId: RoomId;
  readonly participantId: ParticipantId;

  /** Per-instance nonce on every `hello`, so a peer can tell a reconnect from an echo. */
  private readonly sessionId = crypto.randomUUID();
  private readonly topic: string;
  private readonly client: ConfRoomTransport;
  private readonly glassesAssetUrls: GlassesAssetUrls;
  private readonly deps: IConfRoomStoreDeps;
  private readonly sessionDisposables = new DisposableBag();
  private iceServers: readonly RTCIceServer[] = [];
  private signaling: IConfSignalingClient | undefined;
  /** The style chosen before the media exists; the media owns it afterwards. */
  private pendingGlassesStyle: TGlassesStyle = DEFAULT_GLASSES_STYLE;
  private pendingIceCandidates: readonly RTCIceCandidateInit[] = [];
  private isDisposed = false;

  constructor(params: IConfRoomStoreParams, deps: IConfRoomStoreDeps) {
    this.roomId = params.roomId;
    this.topic = params.topic;
    this.participantId = params.participantId;
    this.client = params.client;
    this.glassesAssetUrls = params.glassesAssetUrls;
    this.deps = deps;

    makeAutoObservable<
      ConfRoomStore,
      | 'sessionId'
      | 'topic'
      | 'client'
      | 'glassesAssetUrls'
      | 'deps'
      | 'sessionDisposables'
      | 'iceServers'
      | 'signaling'
      | 'pendingIceCandidates'
      | 'isDisposed'
    >(
      this,
      {
        media: observableRef,
        peer: observableRef,
        roomId: false,
        participantId: false,
        sessionId: false,
        topic: false,
        client: false,
        glassesAssetUrls: false,
        deps: false,
        sessionDisposables: false,
        iceServers: false,
        signaling: false,
        pendingIceCandidates: false,
        isDisposed: false,
      },
      { autoBind: true }
    );
  }

  get localStream(): MediaStream | undefined {
    return this.media?.stream;
  }

  get remoteStream(): MediaStream | undefined {
    return this.peer?.remoteStream;
  }

  get isAudioMuted(): boolean {
    return this.media?.isAudioMuted ?? false;
  }

  get isVideoMuted(): boolean {
    return this.media?.isVideoMuted ?? false;
  }

  get glassesStyle(): TGlassesStyle {
    return this.media?.glassesStyle ?? this.pendingGlassesStyle;
  }

  get isArEnabled(): boolean {
    return this.glassesStyle !== 'none';
  }

  get localEmotion(): TEmotion {
    return this.media?.emotion ?? 'neutral';
  }

  get remoteEmotion(): TEmotion {
    return this.peer?.remoteEmotion ?? 'neutral';
  }

  get qualityTier(): TQualityTier {
    return this.peer?.qualityTier ?? 'high';
  }

  get rttHistoryMs(): readonly number[] {
    return this.peer?.rttHistoryMs ?? [];
  }

  join(): Promise<void> {
    if (this.connectionState !== 'idle' || this.isDisposed) {
      return Promise.resolve();
    }
    return this.runJoinFlow();
  }

  toggleAudio(): void {
    this.media?.toggleAudio();
  }

  toggleVideo(): void {
    this.media?.toggleVideo();
  }

  setGlassesStyle(style: TGlassesStyle): void {
    this.pendingGlassesStyle = style;
    this.media?.setGlassesStyle(style);
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
    this.disposePeer();
    this.sessionDisposables.disposeAll();
  }

  private async runJoinFlow(): Promise<void> {
    this.connectionState = 'acquiring-media';

    const composer = await this.deps
      .createMediaComposer({ glassesAssetUrls: this.glassesAssetUrls })
      .catch((error: unknown) => {
        runInAction(() => {
          this.applyErrorState(error instanceof Error ? error.message : 'Failed to start call');
        });
        return undefined;
      });
    if (isNil(composer)) {
      return;
    }
    if (this.isDisposed) {
      composer.dispose();
      return;
    }
    composer.setGlassesStyle(this.pendingGlassesStyle);

    // Host-only ICE is enough for LAN calls, so a missing TURN server is not fatal.
    const iceServers = await this.fetchIceServers();
    if (this.isDisposed) {
      composer.dispose();
      return;
    }

    const media = new LocalMedia(composer, emotion => {
      this.peer?.sendEmotion(emotion);
    });
    const signaling = this.deps.createSignalingClient({
      client: this.client,
      topic: this.topic,
      self: this.participantId,
      selfSession: this.sessionId,
    });
    // Registered in creation order so the LIFO drain drops the listeners first, then the
    // signaling client, and the media it publishes about last.
    this.sessionDisposables.add(media.dispose);
    this.sessionDisposables.add(
      this.client.onTurnCredentialsRenewed(() => {
        void this.renewIceServers();
      })
    );
    this.sessionDisposables.add(() => signaling.dispose());
    this.sessionDisposables.add(signaling.onMessage(this.handleSignalingMessage));

    runInAction(() => {
      this.iceServers = iceServers ?? [];
      this.media = media;
      this.signaling = signaling;
      this.connectionState = 'connecting';
    });
    this.publishHello();
  }

  private async fetchIceServers(): Promise<readonly RTCIceServer[] | undefined> {
    const turn = await this.client.requestTurnCredentials().catch(() => undefined);
    if (isNil(turn)) {
      return undefined;
    }
    return [{ urls: [...turn.urls], username: turn.username, credential: turn.credential }];
  }

  /** The server renewed its TURN secret; fresh credentials keep media flowing past the old TTL. */
  private async renewIceServers(): Promise<void> {
    const iceServers = await this.fetchIceServers();
    if (this.isDisposed) {
      return;
    }
    runInAction(() => {
      this.hasStaleTurnCredentials = isNil(iceServers);
      if (!isNil(iceServers)) {
        this.iceServers = iceServers;
        this.peer?.refreshIceServers(iceServers);
      }
    });
  }

  private handleSignalingMessage(message: TConfSignalMessage): void {
    if (this.isDisposed) {
      return;
    }
    switch (message.type) {
      case 'hello':
        this.onRemoteHello(message.from, message.session);
        return;
      case 'offer':
      case 'answer':
      case 'ice':
        this.forwardToPeer(message);
        return;
      case 'bye':
        this.onRemoteBye(message.from, message.reason ?? 'leave', message.to);
        return;
    }
  }

  /**
   * A `hello` while the slot is live is a third participant (rejected), an
   * echo (ignored), a late session id for a peer accepted from an early offer
   * (recorded) or the same participant back after a drop (peer replaced).
   */
  private onRemoteHello(from: ParticipantId, session: string): void {
    const peer = this.peer;
    if (!isNil(peer) && peer.isLive) {
      if (peer.remoteId !== from) {
        this.publishBye('full', from);
        return;
      }
      if (peer.remoteSessionId === session) {
        return;
      }
      if (isNil(peer.remoteSessionId)) {
        peer.remoteSessionId = session;
        return;
      }
    }
    this.disposePeer();
    this.acceptPeer(from, session);
    // Echoed so a late joiner who said hello first discovers us.
    this.publishHello();
  }

  private acceptPeer(from: ParticipantId, session: string | undefined): void {
    const media = this.media;
    const signaling = this.signaling;
    if (isNil(media) || isNil(signaling)) {
      return;
    }
    const pendingIceCandidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];
    this.peer = new PeerSession(
      {
        remoteId: from,
        remoteSessionId: session,
        self: this.participantId,
        iceServers: this.iceServers,
        localStream: media.stream,
        readLocalEmotion: () => media.emotion,
        pendingIceCandidates,
        publish: message => signaling.publish(message),
        onStateChange: this.handlePeerState,
        onGraceExpired: this.handlePeerGraceExpired,
      },
      this.deps
    );
  }

  private handlePeerState(state: TConfPeerConnectionState): void {
    if (this.isDisposed) {
      return;
    }
    switch (state) {
      case 'idle':
      case 'connecting':
        this.connectionState = 'connecting';
        return;
      case 'connected':
        this.connectionState = 'connected';
        this.errorMessage = undefined;
        return;
      case 'disconnected':
        this.connectionState = 'peer-disconnected';
        return;
      case 'failed':
        this.applyErrorState('Peer connection failed');
        return;
      case 'closed':
        if (this.connectionState !== 'error' && this.connectionState !== 'room-full') {
          this.connectionState = 'peer-disconnected';
        }
        return;
    }
  }

  private handlePeerGraceExpired(): void {
    if (this.isDisposed) {
      return;
    }
    this.disposePeer();
    this.connectionState = 'peer-disconnected';
  }

  /** Negotiation may start before the `hello`: an offer seats the peer, candidates wait for it. */
  private forwardToPeer(
    message: Extract<TConfSignalMessage, { type: 'offer' | 'answer' | 'ice' }>
  ): void {
    if (isNil(this.peer)) {
      if (message.type === 'ice') {
        this.pendingIceCandidates = [...this.pendingIceCandidates, message.candidate];
        return;
      }
      if (message.type === 'answer') {
        return;
      }
      this.acceptPeer(message.from, undefined);
    }
    this.peer?.handleSignal(message);
  }

  private onRemoteBye(
    from: ParticipantId,
    reason: TByeReason,
    to: ParticipantId | undefined
  ): void {
    if (reason === 'full') {
      // Only the addressed newcomer reacts; two peers broadcasting `full` at a third must not
      // flip each other into room-full.
      if (to === this.participantId) {
        this.connectionState = 'room-full';
      }
      return;
    }
    if (this.peer?.remoteId !== from) {
      return;
    }
    this.disposePeer();
    this.connectionState = 'peer-disconnected';
  }

  private publishHello(): void {
    this.signaling?.publish({ type: 'hello', from: this.participantId, session: this.sessionId });
  }

  private publishBye(reason: TByeReason, target?: ParticipantId): void {
    this.signaling?.publish({
      type: 'bye',
      from: this.participantId,
      reason,
      // `full` is addressed at the rejected newcomer; `leave` is a broadcast.
      ...(isNil(target) ? {} : { to: target }),
    });
  }

  private disposePeer(): void {
    this.peer?.dispose();
    this.peer = undefined;
    this.pendingIceCandidates = [];
  }

  private applyErrorState(message: string): void {
    this.connectionState = 'error';
    this.errorMessage = message;
  }
}
