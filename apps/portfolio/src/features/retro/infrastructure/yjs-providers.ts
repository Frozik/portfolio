import type { ITurnCredentialsAck } from '@frozik/communication-protocol/messages';
import { deleteDB } from 'idb';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import {
  buildCommunicationSignalingUrl,
  installCommunicationWebSocketShim,
  registerCommunicationSignaling,
} from '../../../shared/communication/YWebrtcSignalingConnAdapter';
import type { RoomId } from '../domain/types';
import { getSignalingConfig } from './signaling-config';

/**
 * The bundle of Yjs objects that back a single live retro room. The
 * application layer receives this handle and should call `destroy()` when
 * the user leaves the room — otherwise the persistence and network
 * providers will leak subscriptions and WebRTC sockets.
 */
export interface IYjsRoomProviders {
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  readonly webrtc: WebrtcProvider;
  whenSynced(): Promise<void>;
  destroy(): void;
}

export interface ICreateYjsRoomProvidersParams {
  readonly roomId: RoomId;
  readonly client: ICommunicationClient;
}

/**
 * Convert TURN credentials returned by the communication server
 * into the `RTCIceServer` shape consumed by `simple-peer`'s
 * underlying `RTCPeerConnection`.
 */
function toIceServer(creds: ITurnCredentialsAck): RTCIceServer {
  return {
    urls: [...creds.urls],
    username: creds.username,
    credential: creds.credential,
  };
}

/**
 * Create a new set of Yjs providers for `roomId`.
 *
 * The flow is:
 *   1. `Y.Doc`                 — in-memory CRDT document
 *   2. `IndexeddbPersistence`  — hydrates the doc from disk and persists
 *                                every subsequent mutation
 *   3. `WebrtcProvider`        — joins the signaling room and syncs with
 *                                other peers over WebRTC data channels.
 *                                v1.1 routes the y-webrtc signaling
 *                                envelopes through the new
 *                                `apps/communication` server via the
 *                                custom `MockWebSocket` adapter.
 *
 * TURN credentials are issued by the communication server on
 * demand. The provider boots with an empty `iceServers` list and
 * the credentials are spliced into `peerOpts.config.iceServers`
 * once the async ack returns — y-webrtc reads the option each time
 * it instantiates a new `simple-peer`, so future peers automatically
 * pick the relay up. Existing peers keep their original config,
 * which is acceptable because retro peers churn frequently.
 */
export function createYjsRoomProviders(params: ICreateYjsRoomProvidersParams): IYjsRoomProviders {
  const { roomId, client } = params;
  const config = getSignalingConfig();
  installCommunicationWebSocketShim();

  const doc = new Y.Doc();
  const persistenceId = `${config.roomPrefix}${roomId}`;
  const persistence = new IndexeddbPersistence(persistenceId, doc);

  const signalingToken = `retro-${persistenceId}-${crypto.randomUUID()}`;
  const unregisterSignaling = registerCommunicationSignaling({
    token: signalingToken,
    topic: persistenceId,
    client,
  });

  const peerConfig: { iceServers: RTCIceServer[] } = { iceServers: [] };
  const webrtc = new WebrtcProvider(persistenceId, doc, {
    signaling: [buildCommunicationSignalingUrl(signalingToken)],
    maxConns: config.maxPeers,
    filterBcConns: true,
    peerOpts: {
      config: peerConfig,
    },
  });

  let isDestroyed = false;
  // Best-effort TURN credentials fetch. Failure is non-fatal — we
  // simply leave `iceServers` empty so the WebRTC stack falls back
  // to host candidates only.
  void client
    .requestTurnCredentials()
    .then(creds => {
      if (isDestroyed) {
        return;
      }
      // Mutate in place so the live `peerOpts.config` reference
      // already wired into the provider sees the new servers.
      peerConfig.iceServers.length = 0;
      peerConfig.iceServers.push(toIceServer(creds));
    })
    .catch(() => {
      // Swallow — see comment above.
    });

  let syncedResolve: (() => void) | null = null;
  const syncedPromise = new Promise<void>(resolve => {
    syncedResolve = resolve;
  });
  const handleSynced = (): void => {
    syncedResolve?.();
  };
  persistence.once('synced', handleSynced);

  return {
    doc,
    persistence,
    webrtc,
    whenSynced(): Promise<void> {
      return syncedPromise;
    },
    destroy(): void {
      isDestroyed = true;
      persistence.off('synced', handleSynced);
      webrtc.destroy();
      persistence.destroy();
      doc.destroy();
      unregisterSignaling();
    },
  };
}

/**
 * Wipe all locally-persisted Yjs state for `roomId`. Used when the user
 * removes a retro from the lobby — purely local, other peers keep their
 * own copy.
 */
export async function deleteYjsRoomPersistence(roomId: RoomId): Promise<void> {
  const config = getSignalingConfig();
  const databaseName = `${config.roomPrefix}${roomId}`;
  await deleteDB(databaseName);
}
