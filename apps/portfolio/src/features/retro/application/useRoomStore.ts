import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { RoomId } from '../domain/types';
import type { IRetroIdentity } from '../infrastructure/identity-repo';
import { createYjsRoomProviders } from '../infrastructure/yjs-providers';
import type { IRoomCreateParams } from './RoomStore';
import { RoomStore } from './RoomStore';
import { getRetroLobbyStore } from './retroLobbyStoreAccessor';
import { getUserDirectoryStore } from './userDirectoryStoreAccessor';

export interface IUseRoomStoreParams {
  readonly roomId: RoomId;
  readonly identity: IRetroIdentity;
  readonly createIfMissing: IRoomCreateParams | null;
  readonly client: ICommunicationClient;
}

/**
 * Stable per-instance id for every `ICommunicationClient`. A sign-out →
 * sign-in cycle disconnects the old client and constructs a fresh one;
 * folding this id into the room-store key (see {@link getRoomStoreKey})
 * guarantees the old `RoomStore` — whose Yjs providers are bound to the
 * now-disconnected client — is torn down rather than reused for the new
 * client. A `WeakMap` keys off the client instance itself so ids are
 * reclaimed automatically when a client is garbage-collected.
 */
const clientInstanceIds = new WeakMap<ICommunicationClient, string>();

function getClientInstanceId(client: ICommunicationClient): string {
  const existing = clientInstanceIds.get(client);
  if (existing !== undefined) {
    return existing;
  }
  const id = crypto.randomUUID();
  clientInstanceIds.set(client, id);
  return id;
}

/**
 * The room-store key is scoped by both `roomId` and the owning client
 * instance. Keying on `roomId` alone let a store outlive the client that
 * created it across a sign-out → sign-in within the refcount grace window;
 * including the client id evicts the stale store when its owner changes.
 */
function getRoomStoreKey(roomId: RoomId, client: ICommunicationClient): string {
  return `retro-room:${roomId}:${getClientInstanceId(client)}`;
}

/**
 * Acquire the `RoomStore` for `roomId`. A fresh store (with its own Yjs
 * providers) is created on first use and memoised on the root store so
 * that navigating away and back within the SPA reuses the same
 * CRDT/WebRTC session.
 *
 * The returned store is disposed when the consuming component unmounts —
 * this tears down the WebRTC provider and IndexedDB persistence. The
 * `useEffect` cleanup purposely disposes on unmount rather than on deps
 * change: the factory closure is stable for the component's lifetime.
 */
export function useRoomStore(params: IUseRoomStoreParams): RoomStore {
  const rootStore = useRootStore();
  const storeKey = getRoomStoreKey(params.roomId, params.client);

  const directory = getUserDirectoryStore(rootStore);
  const lobby = getRetroLobbyStore(rootStore);

  const store = rootStore.getOrCreateFeatureStore(storeKey, () => {
    const providers = createYjsRoomProviders({
      roomId: params.roomId,
      client: params.client,
    });
    return new RoomStore({
      roomId: params.roomId,
      identity: params.identity,
      providers,
      createIfMissing: params.createIfMissing,
      directory,
      lobby,
    });
  });

  useRefcountedFeatureStore(rootStore, storeKey);

  return store;
}
