import { useEffect } from 'react';

import { useRootStore } from '../../../app/stores/StoreContext';
import type { ITemplateConfig, RoomId } from '../domain/types';
import type { IRetroIdentity } from '../infrastructure/identity-repo';
import { createUserDirectoryRepo } from '../infrastructure/user-directory-repo';
import { createYjsRoomProviders } from '../infrastructure/yjs-providers';
import { RoomStore } from './RoomStore';
import { UserDirectoryStore } from './UserDirectoryStore';

export interface IUseRoomStoreParams {
  readonly roomId: RoomId;
  readonly identity: IRetroIdentity;
  readonly createIfMissing: {
    readonly name: string;
    readonly template: ITemplateConfig;
    readonly votesPerParticipant: number;
  } | null;
}

function getRoomStoreKey(roomId: RoomId): string {
  return `retro-room:${roomId}`;
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
const USER_DIRECTORY_KEY = 'retro-user-directory';

export function useRoomStore(params: IUseRoomStoreParams): RoomStore {
  const rootStore = useRootStore();
  const storeKey = getRoomStoreKey(params.roomId);

  const directory = rootStore.getOrCreateFeatureStore(
    USER_DIRECTORY_KEY,
    () => new UserDirectoryStore(createUserDirectoryRepo())
  );

  const store = rootStore.getOrCreateFeatureStore(storeKey, () => {
    const providers = createYjsRoomProviders(params.roomId);
    return new RoomStore(
      params.roomId,
      params.identity,
      providers,
      params.createIfMissing,
      directory
    );
  });

  useEffect(() => {
    return () => {
      rootStore.disposeFeatureStore(storeKey);
    };
  }, [rootStore, storeKey]);

  return store;
}
