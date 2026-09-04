import { useRootStore } from '../../../app/stores/StoreContext';
import { useRefcountedFeatureStore } from '../../../app/stores/useRefcountedFeatureStore';
import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { GlassesAssetUrls } from '../domain/glasses-style';
import type { RoomId } from '../domain/types';
import { createAdaptiveQualityController } from '../infrastructure/adaptive-quality-controller';
import { createConfPeerConnection } from '../infrastructure/conf-peer-connection';
import { createConfSignalingClient } from '../infrastructure/conf-signaling-client';
import { createMediaStreamComposer } from '../infrastructure/media-stream-composer';
import { getOrCreateParticipantId } from '../infrastructure/participant-identity';
import { getConfRoomTopic } from '../infrastructure/signaling-config';
import { ConfRoomStore } from './ConfRoomStore';

function getConfRoomStoreKey(roomId: RoomId): string {
  return `conf-room:${roomId}`;
}

/**
 * Composition root of a conf room. Refcounted so React strict mode's
 * mount → cleanup → mount does not rebuild the face landmarker, the media
 * composer and the peer connection on every dev-mode mount.
 */
export function useConfRoomStore(
  roomId: RoomId,
  client: ICommunicationClient,
  glassesAssetUrls: GlassesAssetUrls
): ConfRoomStore {
  const rootStore = useRootStore();
  const storeKey = getConfRoomStoreKey(roomId);

  const store = rootStore.getOrCreateFeatureStore(
    storeKey,
    () =>
      new ConfRoomStore(
        {
          roomId,
          topic: getConfRoomTopic(roomId),
          participantId: getOrCreateParticipantId(),
          client,
          glassesAssetUrls,
        },
        {
          createSignalingClient: createConfSignalingClient,
          createPeerConnection: createConfPeerConnection,
          createMediaComposer: createMediaStreamComposer,
          createAdaptiveQualityController,
        }
      )
  );

  useRefcountedFeatureStore(rootStore, storeKey);

  return store;
}
