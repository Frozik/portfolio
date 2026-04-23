import { useEffect } from 'react';

import { useRootStore } from '../../../app/stores';
import type { RoomId } from '../domain';
import {
  createAdaptiveQualityController,
  createConfPeerConnection,
  createConfSignalingClient,
  createMediaStreamComposer,
  getConfRoomTopic,
  getConfSignalingConfig,
} from '../infrastructure';
import { ConfRoomStore } from './ConfRoomStore';

function getConfRoomStoreKey(roomId: RoomId): string {
  return `conf-room:${roomId}`;
}

/**
 * Acquire the `ConfRoomStore` for `roomId`. A fresh store is created on
 * first mount, registered in the root-store registry so navigating away
 * and back reuses the same call, and disposed via the registry when the
 * consuming component unmounts.
 */
export function useConfRoomStore(roomId: RoomId): ConfRoomStore {
  const rootStore = useRootStore();
  const storeKey = getConfRoomStoreKey(roomId);

  const store = rootStore.getOrCreateFeatureStore(storeKey, () => {
    const { serverUrls } = getConfSignalingConfig();
    return new ConfRoomStore(
      {
        roomId,
        topic: getConfRoomTopic(roomId),
        signalingServerUrls: serverUrls,
      },
      {
        createSignalingClient: createConfSignalingClient,
        createPeerConnection: createConfPeerConnection,
        createMediaComposer: createMediaStreamComposer,
        createAdaptiveQualityController,
      }
    );
  });

  useEffect(() => {
    return () => {
      rootStore.disposeFeatureStore(storeKey);
    };
  }, [rootStore, storeKey]);

  return store;
}
