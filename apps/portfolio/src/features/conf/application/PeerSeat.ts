import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import type { TEmotion } from '../domain/emotion';
import { decideOnHello } from '../domain/hello-policy';
import type { TConfPeerConnectionState } from '../domain/ports/peer-connection';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId } from '../domain/types';
import type { IPeerSessionDeps } from './PeerSession';
import { PeerSession } from './PeerSession';

type TByeReason = 'full' | 'leave';

export interface IPeerSeatParams {
  readonly self: ParticipantId;
  /** Per-instance nonce on every `hello`, so a peer can tell a reconnect from an echo. */
  readonly selfSession: string;
  readonly publish: (message: TConfSignalMessage) => void;
  readonly localStream: MediaStream;
  readonly readLocalEmotion: () => TEmotion;
  readonly readIceServers: () => readonly RTCIceServer[];
  readonly onPeerState: (state: TConfPeerConnectionState) => void;
  /** The peer stayed disconnected for the whole grace window and was closed. */
  readonly onPeerGraceExpired: () => void;
  /** A seated pair told this participant the room is full. */
  readonly onRoomFull: () => void;
}

/**
 * The room's one remote seat and the signaling conversation around it:
 * `hello` and `bye`, the offer that may seat a peer before its hello, and the
 * ICE candidates that wait for the seat to exist.
 */
export class PeerSeat {
  peer: PeerSession | undefined = undefined;

  private readonly params: IPeerSeatParams;
  private readonly deps: IPeerSessionDeps;
  private pendingIceCandidates: readonly RTCIceCandidateInit[] = [];

  constructor(params: IPeerSeatParams, deps: IPeerSessionDeps) {
    this.params = params;
    this.deps = deps;
    makeAutoObservable<PeerSeat, 'params' | 'deps' | 'pendingIceCandidates'>(
      this,
      { peer: observableRef, params: false, deps: false, pendingIceCandidates: false },
      { autoBind: true }
    );
  }

  handleMessage(message: TConfSignalMessage): void {
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
      default:
        assertNever(message);
    }
  }

  publishHello(): void {
    this.params.publish({
      type: 'hello',
      from: this.params.self,
      session: this.params.selfSession,
    });
  }

  publishBye(reason: TByeReason, target?: ParticipantId): void {
    this.params.publish({
      type: 'bye',
      from: this.params.self,
      reason,
      // `full` is addressed at the rejected newcomer; `leave` is a broadcast.
      ...(isNil(target) ? {} : { to: target }),
    });
  }

  /** Vacates the seat; a dropped peer's session is gone with it. */
  vacate(): void {
    this.peer?.dispose();
    this.peer = undefined;
    this.pendingIceCandidates = [];
  }

  dispose(): void {
    this.vacate();
  }

  private onRemoteHello(from: ParticipantId, session: string): void {
    const peer = this.peer;
    const decision = decideOnHello(peer, from, session);
    switch (decision.kind) {
      case 'reject':
        this.publishBye('full', from);
        return;
      case 'ignore':
        return;
      case 'record-session':
        if (!isNil(peer)) {
          peer.remoteSessionId = session;
        }
        return;
      case 'replace':
        this.vacate();
        this.seat(from, session);
        // Echoed so a late joiner who said hello first discovers us.
        this.publishHello();
        return;
      default:
        assertNever(decision);
    }
  }

  private seat(from: ParticipantId, session: string | undefined): void {
    const pendingIceCandidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];
    this.peer = new PeerSession(
      {
        remoteId: from,
        remoteSessionId: session,
        self: this.params.self,
        iceServers: this.params.readIceServers(),
        localStream: this.params.localStream,
        readLocalEmotion: this.params.readLocalEmotion,
        pendingIceCandidates,
        publish: this.params.publish,
        onStateChange: this.params.onPeerState,
        onGraceExpired: this.params.onPeerGraceExpired,
      },
      this.deps
    );
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
      this.seat(message.from, undefined);
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
      if (to === this.params.self) {
        this.params.onRoomFull();
      }
      return;
    }
    if (this.peer?.remoteId !== from) {
      return;
    }
    this.vacate();
    this.params.onPeerState('closed');
  }
}
