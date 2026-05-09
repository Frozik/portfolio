import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { RoomId } from '../domain/types';
import { createAdaptiveQualityController } from '../infrastructure/adaptive-quality-controller';
import { createConfPeerConnection } from '../infrastructure/conf-peer-connection';
import { createConfSignalingClient } from '../infrastructure/conf-signaling-client';
import { createMediaStreamComposer } from '../infrastructure/media-stream-composer';
import { getConfRoomTopic } from '../infrastructure/signaling-config';
import { ConfRoomStore } from './ConfRoomStore';

function getConfRoomStoreKey(roomId: RoomId): string {
  return `conf-room:${roomId}`;
}

/**
 * Acquire the `ConfRoomStore` for `roomId`. Refcounted via
 * `useRefcountedFeatureStore`: multiple components mounted against the
 * same room share one store; the store is only disposed once every
 * consumer has unmounted, with a short grace window to absorb React
 * strict-mode's mount → cleanup → mount cycle. Without that, every
 * dev-mode mount would re-initialise the MediaPipe FaceLandmarker, the
 * media stream composer, and the peer connection — visible as
 * "FaceLandmarker created → Graph closed → FaceLandmarker created"
 * loops in the console.
 */
export function useConfRoomStore(roomId: RoomId, client: ICommunicationClient): ConfRoomStore {
  const rootStore = useRootStore();
  const storeKey = getConfRoomStoreKey(roomId);

  const store = rootStore.getOrCreateFeatureStore(storeKey, () => {
    return new ConfRoomStore(
      {
        roomId,
        topic: getConfRoomTopic(roomId),
        client,
      },
      {
        createSignalingClient: createConfSignalingClient,
        createPeerConnection: createConfPeerConnection,
        createMediaComposer: createMediaStreamComposer,
        createAdaptiveQualityController,
      }
    );
  });

  useRefcountedFeatureStore(rootStore, storeKey);

  return store;
}
