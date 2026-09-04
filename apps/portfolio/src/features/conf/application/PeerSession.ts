import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TQualityTier } from '../domain/adaptive-quality';
import { PEER_DISCONNECTED_GRACE_MS, RTT_HISTORY_MAX_SAMPLES } from '../domain/constants';
import type { TEmotion } from '../domain/emotion';
import type {
  IAdaptiveQualityController,
  IAdaptiveQualityControllerParams,
} from '../domain/ports/adaptive-quality-controller';
import type {
  IConfPeerConnection,
  IConfPeerConnectionParams,
  TConfPeerConnectionState,
} from '../domain/ports/peer-connection';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId } from '../domain/types';

export interface IPeerSessionDeps {
  readonly createPeerConnection: (params: IConfPeerConnectionParams) => IConfPeerConnection;
  readonly createAdaptiveQualityController: (
    params: IAdaptiveQualityControllerParams
  ) => IAdaptiveQualityController;
}

export interface IPeerSessionParams {
  readonly remoteId: ParticipantId;
  /** Unknown when the peer opened with an offer before its `hello` arrived. */
  readonly remoteSessionId: string | undefined;
  readonly self: ParticipantId;
  readonly iceServers: readonly RTCIceServer[];
  readonly localStream: MediaStream;
  readonly readLocalEmotion: () => TEmotion;
  /** Candidates that arrived before this session existed. */
  readonly pendingIceCandidates: readonly RTCIceCandidateInit[];
  readonly publish: (message: TConfSignalMessage) => void;
  readonly onStateChange: (state: TConfPeerConnectionState) => void;
  /** The peer stayed disconnected for the whole grace window and was closed. */
  readonly onGraceExpired: () => void;
}

const LIVE_STATES: ReadonlySet<TConfPeerConnectionState> = new Set([
  'idle',
  'connecting',
  'connected',
]);

/**
 * One remote participant: the peer connection, what it sends us (stream,
 * emotion), the adaptive quality of what we send it, and the grace timer
 * that closes a dropped peer before the browser's own ICE failure fires.
 */
export class PeerSession {
  remoteStream: MediaStream | undefined = undefined;
  remoteEmotion: TEmotion = 'neutral';
  qualityTier: TQualityTier = 'high';
  rttHistoryMs: readonly number[] = [];
  remoteSessionId: string | undefined;

  readonly remoteId: ParticipantId;

  private readonly peer: IConfPeerConnection;
  private readonly deps: IPeerSessionDeps;
  private readonly params: IPeerSessionParams;
  private readonly disposables = new DisposableBag();
  private adaptiveQuality: IAdaptiveQualityController | undefined;
  private graceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(params: IPeerSessionParams, deps: IPeerSessionDeps) {
    this.params = params;
    this.deps = deps;
    this.remoteId = params.remoteId;
    this.remoteSessionId = params.remoteSessionId;
    this.peer = deps.createPeerConnection({
      // The lexically smaller participant id is the polite side of perfect negotiation.
      isPolite: params.self < params.remoteId,
      self: params.self,
      iceServers: params.iceServers,
      onSignal: params.publish,
    });

    makeAutoObservable<
      PeerSession,
      'peer' | 'deps' | 'params' | 'disposables' | 'adaptiveQuality' | 'graceTimer'
    >(
      this,
      {
        remoteStream: observableRef,
        rttHistoryMs: observableRef,
        remoteId: false,
        peer: false,
        deps: false,
        params: false,
        disposables: false,
        adaptiveQuality: false,
        graceTimer: false,
      },
      { autoBind: true }
    );

    // Registered first so the LIFO drain unsubscribes every listener before `close()`
    // emits its final state change.
    this.disposables.add(() => this.peer.close());
    this.disposables.add(this.cancelGraceTimer);
    this.disposables.add(this.peer.onStateChange(this.handlePeerState));
    this.disposables.add(
      this.peer.onRemoteStream(stream => {
        runInAction(() => {
          this.remoteStream = stream;
        });
      })
    );
    this.disposables.add(
      this.peer.onDataMessage(message => {
        runInAction(() => {
          this.remoteEmotion = message.value;
        });
      })
    );
    this.disposables.add(
      this.peer.onDataChannelOpen(() => {
        this.sendEmotion(params.readLocalEmotion());
      })
    );

    this.peer.setLocalStream(params.localStream);
    for (const candidate of params.pendingIceCandidates) {
      void this.peer.handleSignal({ type: 'ice', from: params.remoteId, candidate });
    }
  }

  /** Whether the slot is really taken: a peer that dropped without `bye` no longer counts. */
  get isLive(): boolean {
    return LIVE_STATES.has(this.peer.state);
  }

  handleSignal(message: TConfSignalMessage): void {
    void this.peer.handleSignal(message);
  }

  sendEmotion(emotion: TEmotion): void {
    this.peer.sendDataMessage({ kind: 'emotion', value: emotion });
  }

  refreshIceServers(iceServers: readonly RTCIceServer[]): void {
    this.peer.refreshIceServers(iceServers);
  }

  dispose(): void {
    this.disposables.disposeAll();
  }

  private handlePeerState(state: TConfPeerConnectionState): void {
    switch (state) {
      case 'disconnected':
        this.armGraceTimer();
        break;
      case 'connected':
        this.cancelGraceTimer();
        this.startAdaptiveQuality();
        break;
      default:
        this.cancelGraceTimer();
    }
    this.params.onStateChange(state);
  }

  /**
   * A transient blip recovers within ICE consent freshness (~30 s); closing
   * ourselves after a shorter grace keeps the browser from surfacing its own
   * `ICE failed` warning.
   */
  private armGraceTimer(): void {
    if (!isNil(this.graceTimer)) {
      return;
    }
    this.graceTimer = setTimeout(() => {
      this.graceTimer = undefined;
      this.params.onGraceExpired();
    }, PEER_DISCONNECTED_GRACE_MS);
  }

  private cancelGraceTimer(): void {
    if (!isNil(this.graceTimer)) {
      clearTimeout(this.graceTimer);
      this.graceTimer = undefined;
    }
  }

  private startAdaptiveQuality(): void {
    if (!isNil(this.adaptiveQuality)) {
      return;
    }
    const videoSender = this.peer.getVideoSender();
    if (isNil(videoSender)) {
      return;
    }
    const controller = this.deps.createAdaptiveQualityController({
      peerConnection: this.peer.nativePeerConnection,
      videoSender,
    });
    this.adaptiveQuality = controller;
    this.qualityTier = controller.currentTier;
    this.disposables.add(() => controller.dispose());
    this.disposables.add(
      controller.onTierChange(tier => {
        runInAction(() => {
          this.qualityTier = tier;
        });
      })
    );
    this.disposables.add(
      controller.onStatsSample(stats => {
        if (isNil(stats.rttMs)) {
          return;
        }
        const rttMs = stats.rttMs;
        runInAction(() => {
          this.rttHistoryMs = [...this.rttHistoryMs, rttMs].slice(-RTT_HISTORY_MAX_SAMPLES);
        });
      })
    );
  }
}
