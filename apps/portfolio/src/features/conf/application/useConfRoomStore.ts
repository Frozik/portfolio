import { useEffect } from 'react';

import { useRootStore } from '../../../app/stores/StoreContext';
import type { RoomId } from '../domain/types';
import { createAdaptiveQualityController } from '../infrastructure/adaptive-quality-controller';
import { createConfPeerConnection } from '../infrastructure/conf-peer-connection';
import { createConfSignalingClient } from '../infrastructure/conf-signaling-client';
import { createMediaStreamComposer } from '../infrastructure/media-stream-composer';
import { getConfRoomTopic, getConfSignalingConfig } from '../infrastructure/signaling-config';
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
