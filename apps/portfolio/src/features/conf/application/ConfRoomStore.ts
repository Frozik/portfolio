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
import { IceServers } from './IceServers';
import { LocalMedia } from './LocalMedia';
import { PeerSeat } from './PeerSeat';
import type { IPeerSessionDeps } from './PeerSession';
import type { PeerSession } from './PeerSession';

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

/**
 * One conf room: acquires the local media, opens the signaling conversation
 * and folds everything into `connectionState`. The media, the ICE servers and
 * the remote seat (`PeerSeat`, which owns the `hello` / `bye` conversation) are
 * sub-models; this store owns the join flow, the lifecycle and the dialog.
 */
export class ConfRoomStore {
  connectionState: TConfRoomConnectionState = 'idle';
  errorMessage: string | undefined = undefined;
  isShareDialogOpen = false;
  media: LocalMedia | undefined = undefined;
  seat: PeerSeat | undefined = undefined;

  readonly roomId: RoomId;
  readonly participantId: ParticipantId;

  /** Per-instance nonce on every `hello`, so a peer can tell a reconnect from an echo. */
  private readonly sessionId = crypto.randomUUID();
  private readonly topic: string;
  private readonly client: ConfRoomTransport;
  private readonly glassesAssetUrls: GlassesAssetUrls;
  private readonly deps: IConfRoomStoreDeps;
  private readonly sessionDisposables = new DisposableBag();
  private readonly iceServers: IceServers;
  /** The style chosen before the media exists; the media owns it afterwards. */
  private pendingGlassesStyle: TGlassesStyle = DEFAULT_GLASSES_STYLE;
  private isDisposed = false;

  constructor(params: IConfRoomStoreParams, deps: IConfRoomStoreDeps) {
    this.roomId = params.roomId;
    this.topic = params.topic;
    this.participantId = params.participantId;
    this.client = params.client;
    this.glassesAssetUrls = params.glassesAssetUrls;
    this.deps = deps;
    this.iceServers = new IceServers(params.client);

    makeAutoObservable<
      ConfRoomStore,
      | 'sessionId'
      | 'topic'
      | 'client'
      | 'glassesAssetUrls'
      | 'deps'
      | 'sessionDisposables'
      | 'iceServers'
      | 'isDisposed'
    >(
      this,
      {
        media: observableRef,
        seat: observableRef,
        roomId: false,
        participantId: false,
        sessionId: false,
        topic: false,
        client: false,
        glassesAssetUrls: false,
        deps: false,
        sessionDisposables: false,
        iceServers: false,
        isDisposed: false,
      },
      { autoBind: true }
    );
  }

  /** The last TURN renewal failed; the call keeps running on credentials that will expire. */
  get hasStaleTurnCredentials(): boolean {
    return this.iceServers.isStale;
  }

  get peer(): PeerSession | undefined {
    return this.seat?.peer;
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
    this.seat?.publishBye('leave');
    this.dispose();
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.seat?.dispose();
    this.seat = undefined;
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

    const iceServers = await this.iceServers.fetch();
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
    const seat = new PeerSeat(
      {
        self: this.participantId,
        selfSession: this.sessionId,
        publish: message => signaling.publish(message),
        localStream: media.stream,
        readLocalEmotion: () => media.emotion,
        readIceServers: () => this.iceServers.current,
        onPeerState: this.handlePeerState,
        onPeerGraceExpired: this.handlePeerGraceExpired,
        onRoomFull: this.handleRoomFull,
      },
      this.deps
    );
    // Registered in creation order so the LIFO drain drops the listeners first, then the
    // signaling client, and the media it publishes about last.
    this.sessionDisposables.add(media.dispose);
    this.sessionDisposables.add(
      this.client.onTurnCredentialsRenewed(() => {
        void this.iceServers.renew(servers => this.peer?.refreshIceServers(servers));
      })
    );
    this.sessionDisposables.add(() => signaling.dispose());
    this.sessionDisposables.add(signaling.onMessage(this.handleSignalingMessage));

    runInAction(() => {
      this.iceServers.adopt(iceServers);
      this.media = media;
      this.seat = seat;
      this.connectionState = 'connecting';
    });
    seat.publishHello();
  }

  private handleSignalingMessage(message: TConfSignalMessage): void {
    if (!this.isDisposed) {
      this.seat?.handleMessage(message);
    }
  }

  private handleRoomFull(): void {
    if (!this.isDisposed) {
      this.connectionState = 'room-full';
    }
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
    this.seat?.vacate();
    this.connectionState = 'peer-disconnected';
  }

  private applyErrorState(message: string): void {
    this.connectionState = 'error';
    this.errorMessage = message;
  }
}
