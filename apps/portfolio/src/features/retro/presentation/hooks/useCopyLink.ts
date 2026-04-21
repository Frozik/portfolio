import { useCallback } from 'react';

import type { RoomStore } from '../../application/RoomStore';
import { writeTextToClipboard } from '../../infrastructure/clipboard';

export function useCopyLink(
  roomStore: RoomStore,
  url: string,
  successMessage: string,
  errorMessage: string
): () => Promise<void> {
  return useCallback(async () => {
    try {
      await writeTextToClipboard(url);
      // TODO: call roomStore.showToast(successMessage) when added
      void roomStore;
      void successMessage;
    } catch {
      // TODO: call roomStore.showToast(errorMessage) when added
      void errorMessage;
    }
  }, [roomStore, url, successMessage, errorMessage]);
}
