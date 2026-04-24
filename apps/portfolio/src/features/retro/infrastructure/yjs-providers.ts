import { deleteDB } from 'idb';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';

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

/**
 * Create a new set of Yjs providers for `roomId`.
 *
 * The flow is:
 *   1. `Y.Doc`                 — in-memory CRDT document
 *   2. `IndexeddbPersistence`  — hydrates the doc from disk and persists
 *                                every subsequent mutation
 *   3. `WebrtcProvider`        — joins the signaling room and syncs with
 *                                other peers over WebRTC data channels
 *
 * `whenSynced()` resolves once IndexedDB has finished hydrating the doc.
 * The returned promise never waits on network peers — peer-sync status is
 * exposed separately via the webrtc provider's awareness events.
 */
export function createYjsRoomProviders(roomId: RoomId): IYjsRoomProviders {
  const config = getSignalingConfig();
  const doc = new Y.Doc();
  const persistenceId = `${config.roomPrefix}${roomId}`;
  const persistence = new IndexeddbPersistence(persistenceId, doc);
  const webrtc = new WebrtcProvider(persistenceId, doc, {
    signaling: [...config.signalingServers],
    maxConns: config.maxPeers,
    filterBcConns: true,
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
      persistence.off('synced', handleSynced);
      webrtc.destroy();
      persistence.destroy();
      doc.destroy();
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
